import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {verifyIdToken,authorization,discovery} from '../oidc.ts';
import {validateConfig,saveConfig,readConfig,seal,unseal,readSavedConfig,hasPendingConfig,promoteConfig,restoreSavedConfig} from '../configuration.ts';
import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const tenantId='11111111-1111-4111-8111-111111111111',clientId='22222222-2222-4222-8222-222222222222',oid='33333333-3333-4333-8333-333333333333';
const config={tenantId,clientId,secret:'fictional-test-secret',redirectUri:'http://localhost:3000/api/auth/microsoft/callback',configId:'44444444-4444-4444-8444-444444444444'};
const {privateKey,publicKey}=await generateKeyPair('RS256'),key={...await exportJWK(publicKey),kid:'fixture-key',alg:'RS256',use:'sig'},keys={keys:[key]};
async function signed(changes={}){const now=Math.floor(Date.now()/1000);return new SignJWT({sub:'fictional-subject',tid:tenantId,oid,ver:'2.0',nonce:'expected-nonce',iss:`https://login.microsoftonline.com/${tenantId}/v2.0`,aud:clientId,iat:now,nbf:now-1,exp:now+300,...changes}).setProtectedHeader({alg:'RS256',kid:'fixture-key'}).sign(privateKey);}
test('Microsoft ID token rejects wrong tenant, issuer, audience, nonce, lifetime and tampered signatures',async()=>{
 const token=await signed();assert.equal((await verifyIdToken(token,config,'expected-nonce',keys)).id,`entra:${tenantId}:${oid}`);
 for(const claims of [{tid:clientId},{iss:'https://attacker.example.invalid'},{aud:tenantId},{nonce:'other-nonce'},{exp:1},{nbf:Math.floor(Date.now()/1000)+3600},{oid:'fake'},{ver:'1.0'},{iat:1}])await assert.rejects(verifyIdToken(await signed(claims),config,'expected-nonce',keys));
 const bits=token.split('.');bits[1]=Buffer.from(JSON.stringify({tid:tenantId,oid,aud:clientId,nonce:'expected-nonce'})).toString('base64url');await assert.rejects(verifyIdToken(bits.join('.'),config,'expected-nonce',keys));
 await assert.rejects(verifyIdToken(token,config,'expected-nonce',{keys:[]}));
});
test('OAuth uses tenant-specific code flow, PKCE S256 and minimal identity scopes without Graph access',()=>{
 const url=new URL(authorization(config,{state:'state',nonce:'nonce',verifier:'verifier'}));assert.equal(url.hostname,'login.microsoftonline.com');assert.equal(url.searchParams.get('response_type'),'code');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('scope'),'openid profile');assert.equal(url.searchParams.has('client_secret'),false);assert.equal(url.searchParams.has('returnTo'),false);
});
test('Microsoft config disallows arbitrary tenants, insecure redirects and remote metadata endpoints',async()=>{
 for(const change of [{tenantId:'common'},{tenantId:'organizations'},{redirectUri:'http://heyelli.example.invalid/api/auth/microsoft/callback'},{redirectUri:'https://heyelli.example.invalid/other'},{redirectUri:'https://heyelli.example.invalid/api/auth/microsoft/callback?returnTo=https://bad.invalid'},{redirectUri:'https://user:password@heyelli.example.invalid/api/auth/microsoft/callback'},{secret:'bad\nsecret'}])assert.throws(()=>validateConfig({...config,...change}));
 await assert.rejects(discovery(config,async()=>Response.json({issuer:`https://login.microsoftonline.com/${tenantId}/v2.0`,authorization_endpoint:'https://attacker.example.invalid'})));
 await assert.rejects(discovery(config,async()=>{throw Error('SECRET-SHOULD-NOT-LEAK');}),error=>!error.message.includes('SECRET-SHOULD-NOT-LEAK'));
});
test('Microsoft settings and short-lived browser payload are encrypted separately from Graph/PDS',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'heyelli-ms-auth-')),before={APP_ENV:process.env.APP_ENV,HEYELLI_TEST_SETTINGS_DIR:process.env.HEYELLI_TEST_SETTINGS_DIR};process.env.APP_ENV='test';process.env.HEYELLI_TEST_SETTINGS_DIR=dir;
 try{saveConfig(config,config.configId);const content=await readFile(join(dir,'.env.microsoft-auth.ui.local'),'utf8');assert.ok(!content.includes(config.secret));assert.deepEqual(readConfig(),config);assert.equal((await stat(join(dir,'.env.microsoft-auth.ui.local'))).mode&0o777,0o600);assert.equal((await stat(join(dir,'.local/microsoft-auth-secrets/master.key'))).mode&0o777,0o600);assert.throws(()=>saveConfig({...config,tenantId:'common'},config.configId));assert.deepEqual(readConfig(),config);const cookie=seal({verifier:'ephemeral-secret'});assert.ok(!cookie.includes('ephemeral-secret'));assert.equal(unseal(cookie).verifier,'ephemeral-secret');assert.throws(()=>unseal(cookie+'tamper'));}finally{for(const [key,value]of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;}await rm(dir,{recursive:true,force:true});}
});

test('replacement credentials remain separate until successful test; restore keeps the baseline',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'heyelli-ms-pending-')),before={APP_ENV:process.env.APP_ENV,HEYELLI_TEST_SETTINGS_DIR:process.env.HEYELLI_TEST_SETTINGS_DIR};process.env.APP_ENV='test';process.env.HEYELLI_TEST_SETTINGS_DIR=dir;
 try{saveConfig(config,config.configId);const replacement={...config,configId:'66666666-6666-4666-8666-666666666666',secret:'fictional-invalid-replacement'};saveConfig(replacement,replacement.configId);assert.equal(hasPendingConfig(),true);assert.equal(readSavedConfig().secret,config.secret);assert.equal(readConfig().secret,replacement.secret);assert.throws(()=>restoreSavedConfig(config.configId));restoreSavedConfig(replacement.configId);assert.deepEqual(readConfig(),config);saveConfig(replacement,replacement.configId);promoteConfig(replacement.configId);assert.equal(hasPendingConfig(),false);assert.equal(readSavedConfig().secret,replacement.secret);assert.ok(!(await readFile(join(dir,'.env.microsoft-auth.previous.local'),'utf8')).includes(config.secret));}finally{for(const[key,value]of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;}await rm(dir,{recursive:true,force:true});}
});
