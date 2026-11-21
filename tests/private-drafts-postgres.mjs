import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {mkdtemp,rm,readFile,rename,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {privateDrafts} from '../src/apps/planboard/entwuerfe/repository.ts';
import {state as incidentState} from './fixtures/incident-state.mjs';
import {encryptDraft,decryptDraft} from '../src/apps/planboard/entwuerfe/crypto.ts';
export async function checkPrivateDrafts(pool){
 const folder=await mkdtemp(join(tmpdir(),'heyelli-private-drafts-')),before={APP_ENV:process.env.APP_ENV,HEYELLI_TEST_SETTINGS_DIR:process.env.HEYELLI_TEST_SETTINGS_DIR};process.env.APP_ENV='test';process.env.HEYELLI_TEST_SETTINGS_DIR=folder;
 const a='ad:11111111-aaaa-4111-8111-111111111111',b='ad:22222222-bbbb-4222-8222-222222222222';
 await pool.query("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktiver Entwurf A','reader',true),($2,'Fiktiver Entwurf B','reader',true)",[a,b]);
 const draft=id=>({draftId:id,writerId:id,original:{id:'event'},changed:{id:'event',notes:'Nicht verlieren '+id},operationId:id});
 try{
  const store=privateDrafts(pool),key=await store.key(a),other=await store.key(b);assert.notEqual(key.key,other.key);const name=id=>'heyelli:calendar-draft:v2:owner:'+id,payload=id=>encryptDraft(key,name(id),JSON.stringify(draft(id)));
  await store.change(a,{key:name('tab-a'),envelope:payload('tab-a')});await store.change(a,{key:name('tab-b'),envelope:payload('tab-b')});assert.equal((await store.read(a)).records.length,2);assert.equal((await store.read(b)).records.length,0);
  await assert.rejects(store.change(b,{key:name('tab-a'),envelope:payload('tab-a')}),e=>e.status===400);
  await store.change(a,{key:name('tab-a'),envelope:payload('tab-a')});await assert.rejects(store.change(a,{key:name('tab-a'),envelope:encryptDraft(key,name('tab-a'),JSON.stringify({...draft('tab-a'),changed:{id:'event',notes:'Fremder Stand'}}))}),e=>e.status===409);
  const saved=await store.read(a);assert.equal(decryptDraft(key,saved.records[0].key,saved.records[0].envelope),JSON.stringify(draft('tab-a')));
  await store.change(a,{key:name('tab-a'),complete:true});assert.equal((await store.change(a,{key:name('tab-a'),envelope:payload('tab-a')})).completed,true);assert.equal((await store.read(a)).records.length,1);
  const incidentId=crypto.randomUUID(),incidentKey='heyelli:incident-draft:v1:owner:'+incidentId,incident={kind:'incident-tool',version:1,draftId:incidentId,branchId:crypto.randomUUID(),sequence:1,updatedAt:new Date().toISOString(),state:incidentState},incidentEnvelope=encryptDraft(key,incidentKey,JSON.stringify(incident));
  await store.change(a,{key:incidentKey,envelope:incidentEnvelope});await store.change(a,{key:incidentKey,envelope:incidentEnvelope});
  assert.ok((await store.read(a)).records.some(record=>record.key===incidentKey));await assert.rejects(store.change(b,{key:incidentKey,envelope:incidentEnvelope}),e=>e.status===400);
  await assert.rejects(store.change(a,{key:incidentKey,envelope:encryptDraft(key,incidentKey,JSON.stringify({...incident,sequence:2}))}),e=>e.status===409);
  await store.change(a,{key:incidentKey,complete:true});assert.equal((await store.change(a,{key:incidentKey,envelope:incidentEnvelope})).completed,true);
  const row=(await pool.query('SELECT * FROM platform.private_draft_keys WHERE user_id=$1',[a])).rows[0];assert.ok(!row.wrapped_key.includes(key.key));const values=JSON.stringify((await pool.query('SELECT * FROM platform.private_draft_copies WHERE user_id=$1',[a])).rows);assert.ok(!values.includes('Nicht verlieren'));
  const path=join(folder,'.local/private-drafts/master.key');assert.equal((await stat(path)).mode&0o077,0);const bytes=await readFile(path);await rename(path,path+'.protected-backup');await assert.rejects(store.key(a));await assert.rejects(store.key('does-not-exist'),e=>e.status===401);await assert.rejects(store.key(b));await rename(path+'.protected-backup',path);assert.deepEqual(await readFile(path),bytes);assert.ok((await store.key(a)).key===key.key);
  const reopened=new Pool({connectionString:pool.options.connectionString});try{assert.ok((await privateDrafts(reopened).key(a)).key===key.key);assert.equal((await privateDrafts(reopened).read(a)).records.length,1);}finally{await reopened.end();}
 }finally{await pool.query('DELETE FROM platform.users WHERE id=ANY($1::text[])',[[a,b]]);for(const [name,value]of Object.entries(before)){if(value===undefined)delete process.env[name];else process.env[name]=value;}await rm(folder,{recursive:true,force:true});}
}
