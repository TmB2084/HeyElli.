import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {microsoftAuthRepository} from '../src/system/anmeldung/microsoft/repository.ts';
import {readConfig,unseal} from '../src/system/anmeldung/microsoft/configuration.ts';
import {hash} from '../src/system/anmeldung/microsoft/oidc.ts';
import {platformRepository} from '../src/platform/store/repository.ts';
import {assignPds} from './support/pds-assignment.mjs';
export async function checkMicrosoftAuth(pool){
 const dir=await mkdtemp(join(tmpdir(),'heyelli-ms-postgres-')),before={APP_ENV:process.env.APP_ENV,HEYELLI_TEST_SETTINGS_DIR:process.env.HEYELLI_TEST_SETTINGS_DIR};process.env.APP_ENV='test';process.env.HEYELLI_TEST_SETTINGS_DIR=dir;
 const tenantId='11111111-1111-4111-8111-111111111111',clientId='22222222-2222-4222-8222-222222222222',oid='33333333-3333-4333-8333-333333333333',other='55555555-5555-4555-8555-555555555555';
 const actor='ad:99999999-9999-4999-8999-999999999999',msUser=`entra:${tenantId}:${oid}`,input={tenantId,clientId,secret:'fictional-secret-not-real',redirectUri:'http://localhost:3000/api/auth/microsoft/callback'};
 const {privateKey,publicKey}=await generateKeyPair('RS256'),jwks={keys:[{...await exportJWK(publicKey),kid:'fixture',alg:'RS256',use:'sig'}]},pending=new Map();let tokenCalls=0;
 const transport=async(url,options)=>{const path=new URL(url).pathname;
  if(path.endsWith('/.well-known/openid-configuration'))return Response.json({issuer:`https://login.microsoftonline.com/${tenantId}/v2.0`,authorization_endpoint:`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,token_endpoint:`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,id_token_signing_alg_values_supported:['RS256']});
  if(path.endsWith('/keys'))return Response.json(jwks);
  if(path.endsWith('/token')){tokenCalls++;const body=new URLSearchParams(options.body),test=pending.get(body.get('code'));assert.ok(test);assert.equal(body.get('code_verifier'),test.verifier);const now=Math.floor(Date.now()/1000),token=await new SignJWT({ver:'2.0',tid:tenantId,oid:test.oid??oid,nonce:test.nonce,roles:['admin']}).setProtectedHeader({alg:'RS256',kid:'fixture'}).setIssuer(`https://login.microsoftonline.com/${tenantId}/v2.0`).setAudience(clientId).setSubject('fictional').setIssuedAt(now).setNotBefore(now-1).setExpirationTime(now+300).sign(privateKey);return Response.json({id_token:token});}
  throw Error('Unexpected network call');
 };
 const store=microsoftAuthRepository(pool,transport),platform=platformRepository(pool);let codeCount=0,readerId='';
 async function attempt(purpose='test',user=oid){const value=await store.begin(purpose,'http://localhost:3000',purpose==='test'?actor:undefined),payload=unseal(value.cookie),code='fixture-code-'+codeCount++;pending.set(code,{...payload,oid:user});return {...value,state:payload.state,code};}
 async function finish(flow){return store.finish(flow.state,flow.cookie,flow.code,'http://localhost:3000');}
 try{
  await pool.query("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fictional operations admin','admin',true),($2,'Fictional Microsoft admin','admin',true)",[actor,msUser]);
  assert.equal(await store.available(),false);
  await assert.rejects(store.save(msUser,{...input,version:0}),error=>error.status===409);
  let version=(await store.read(actor)).settings.version;await store.save(actor,{...input,version});version=(await store.read(actor)).settings.version;assert.equal((await store.read(actor)).settings.enabled,false);assert.ok(!JSON.stringify(await store.read(actor)).includes(input.secret));
  await assert.rejects(store.toggle(actor,{version,enabled:true,confirm:true}),error=>error.status===409);await assert.rejects(store.begin('login','http://localhost:3000'));await assert.rejects(store.begin('test','https://attacker.invalid',actor));
  const test=await attempt();await assert.rejects(store.finish(test.state,'tampered',test.code,'http://localhost:3000'));assert.equal((await finish(test)).purpose,'test');assert.equal(await store.available(),false);assert.equal((await pool.query("SELECT count(*)::int AS n FROM platform.sessions WHERE auth_mode='microsoft'")).rows[0].n,0);await assert.rejects(finish(test));assert.equal(tokenCalls,1);
  await store.toggle(actor,{version,enabled:true,confirm:true});assert.equal(await store.available(),true);await assert.rejects(store.toggle(actor,{version,enabled:false}),error=>error.status===409);version=(await store.read(actor)).settings.version;
  const login=await attempt('login'),parallel=await Promise.allSettled([finish(login),finish(login)]);assert.equal(parallel.filter(value=>value.status==='fulfilled').length,1);const result=parallel.find(value=>value.status==='fulfilled').value;
  // Der Anmeldetest hat das Konto des testenden Administrators mit seinem Microsoft-Konto verknüpft.
  assert.equal(result.id,msUser);assert.equal((await pool.query('SELECT microsoft_subject FROM platform.users WHERE id=$1',[actor])).rows[0].microsoft_subject,msUser);
  const identity=await platform.authenticateMicrosoft(result.id,result.upn,result.revision);assert.equal(identity.id,actor);assert.equal(identity.role,'admin');const issued=await platform.issueSession(identity);assert.equal((await platform.read(issued.token)).mode,'microsoft');
  // Nicht verknüpfte Microsoft-Konten werden abgewiesen; es entsteht kein Konto.
  const unknown=await finish(await attempt('login',other));await assert.rejects(platform.authenticateMicrosoft(unknown.id,unknown.upn,unknown.revision),/nicht verknüpft/);assert.equal((await pool.query('SELECT count(*)::int AS n FROM platform.users WHERE id=$1 OR microsoft_subject=$1',[unknown.id])).rows[0].n,0);
  const reader=await platform.saveUser(actor,{displayName:'Fictional Microsoft reader',username:'ms.reader',role:'reader',enabled:true,version:0});readerId=reader.id;
  await platform.linkMicrosoft(reader.id,unknown.id);
  await assert.rejects(platform.authenticateMicrosoft(unknown.id,null,unknown.revision),/PDS-Zuordnung fehlt/);await assignPds(pool,reader.id);
  const readerLogin=await finish(await attempt('login',other));const readerIdentity=await platform.authenticateMicrosoft(readerLogin.id,readerLogin.upn,readerLogin.revision);assert.equal(readerIdentity.id,reader.id);assert.equal(readerIdentity.role,'reader');const readerSession=await platform.issueSession(readerIdentity);assert.equal((await platform.read(readerSession.token)).role,'reader');
  const current=(await pool.query('SELECT version FROM platform.users WHERE id=$1',[reader.id])).rows[0].version;
  await platform.saveUser(actor,{id:reader.id,displayName:'Fictional Microsoft reader',username:'ms.reader',role:'reader',enabled:false,version:current});assert.equal(await platform.read(readerSession.token),null);
  const expired=await attempt('login');await pool.query("UPDATE platform.microsoft_auth_flows SET expires_at=now()-interval '1 second' WHERE state_hash=$1",[hash(expired.state)]);await assert.rejects(finish(expired));
  const old=await attempt('login');await store.save(actor,{...input,version});assert.equal(await store.available(),false);assert.equal(await platform.read(issued.token),null);await assert.rejects(finish(old));await assert.rejects(platform.issueSession(identity));
  assert.equal(readConfig().secret,input.secret);
 }finally{
  await pool.query('DELETE FROM platform.microsoft_auth_flows');await pool.query("UPDATE platform.microsoft_auth SET enabled=false,config_id=NULL,tested_at=NULL,tested_version=NULL,tested_user_id=NULL,tested_actor=NULL,checked_at=NULL,version=version+1 WHERE id='central'");const ids=[actor,msUser,`entra:${tenantId}:${other}`,readerId].filter(Boolean);await pool.query('DELETE FROM platform.sessions WHERE user_id=ANY($1::text[])',[ids]);await pool.query('DELETE FROM platform.pds_user_mappings WHERE user_id=ANY($1::text[])',[ids]);await pool.query('DELETE FROM platform.users WHERE id=ANY($1::text[])',[ids]);
  for(const [key,value]of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;}await rm(dir,{recursive:true,force:true});
 }
}
