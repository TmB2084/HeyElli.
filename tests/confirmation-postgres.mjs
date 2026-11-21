import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {serviceConfirmations} from '../src/apps/servicehub/akten/confirmation-repository.ts';
import {processMailQueue} from '../src/platform/mail/worker.ts';
export async function checkConfirmation(pool){
 const store=serviceConfirmations(pool),admin=(await pool.query("SELECT id FROM platform.users WHERE role='admin' AND enabled LIMIT 1")).rows[0].id,reader='confirm-reader-'+randomUUID(),writer='confirm-writer-'+randomUUID(),source='fictitious-confirmation-source';
 const before=(await pool.query("SELECT enabled,test_mode,version,sender FROM platform.mail_settings WHERE id='central'")).rows[0];
 await pool.query("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktiver Leser','reader',true),($2,'Fiktive Disposition','dispatcher',true)",[reader,writer]);
 const message={requestId:randomUUID(),orderId:'fictitious-order',incidentId:'fictitious-incident',sourceRevision:'a'.repeat(64),fingerprint:'b'.repeat(64),recipient:'kunde@example.invalid',subject:'Terminbestätigung',body:'Fiktiver Termin mit Alex',channel:'graph',mailVersion:before.version,confirm:true};
 try{
  await assert.rejects(store.settings(reader),e=>e.status===403);await assert.rejects(store.commit(reader,source,message),e=>e.status===403);
  await pool.query("UPDATE platform.mail_settings SET enabled=false WHERE id='central'");await assert.rejects(store.commit(writer,source,message),e=>e.status===409);
  await pool.query("UPDATE platform.mail_settings SET enabled=true,test_mode=true,version=version+1 WHERE id='central'");const settings=await store.settings(writer);assert.equal(settings.testMode,true);assert.ok(!JSON.stringify(settings).includes('config_id'));message.mailVersion=settings.version;
  const concurrent={...message,requestId:randomUUID()},[a,b]=await Promise.all([store.commit(writer,source,message),store.commit(writer,source,concurrent)]);assert.equal(a.queueId,b.queueId);assert.equal(a.testMode,true);assert.equal([a,b].filter(row=>row.repeated).length,1);assert.equal((await pool.query('SELECT count(*)::integer n FROM platform.mail_queue WHERE id=$1',[a.queueId])).rows[0].n,1);
  for(const request of [message,concurrent]){const repeated=await store.commit(writer,source,request);assert.equal(repeated.repeated,true);assert.equal(repeated.queueId,a.queueId);}
  const canonical={...message,requestId:a.id},retry=await store.previous(writer,canonical);assert.equal(retry.repeated,true);assert.equal(retry.queueId,a.queueId);
  await assert.rejects(store.previous(admin,canonical),e=>e.status===409);await assert.rejects(store.previous(writer,{...canonical,recipient:'changed@example.invalid'}),e=>e.status===409);await assert.rejects(store.commit(writer,source,{...message,requestId:randomUUID(),mailVersion:settings.version-1}),e=>e.status===409);
  for(const input of [{confirm:'yes'},{recipient:'a@example.invalid\r\nBcc:b@example.invalid'},{subject:'X\nBcc:Y'},{sourceRevision:'invalid'},{body:'x'.repeat(4001)}])assert.throws(()=>store.commit(writer,source,{...message,...input}),e=>e.status===400);
  let sent=0;await processMailQueue(pool,async()=>{sent++;return {status:'failed',error:'Must not send'};});assert.equal(sent,0);assert.equal((await pool.query('SELECT status,test_mode FROM platform.mail_queue WHERE id=$1',[a.queueId])).rows[0].status,'simulated');
  for(let n=0;n<19;n++)await store.commit(writer,source,{...message,requestId:randomUUID(),recipient:'quota-'+n+'@example.invalid'});await assert.rejects(store.commit(writer,source,{...message,requestId:randomUUID(),recipient:'quota-over@example.invalid'}),e=>e.status===429);
  const outlook=await store.commit(writer,source,{...message,requestId:randomUUID(),channel:'outlook'});assert.equal(outlook.queueId,null);assert.equal(new URL(store.outlook(message)).protocol,'mailto:');
  assert.equal((await pool.query('SELECT count(*)::int n FROM platform.service_confirmations WHERE source=$1',[source])).rows[0].n,21);
 }finally{
  const ids=(await pool.query('SELECT queue_id FROM platform.service_confirmations WHERE source=$1 AND queue_id IS NOT NULL',[source])).rows.map(row=>row.queue_id);await pool.query('DELETE FROM platform.service_confirmations WHERE source=$1',[source]);await pool.query('DELETE FROM platform.audit_events WHERE target_id=$1',[message.orderId]);await pool.query('DELETE FROM platform.mail_log WHERE mail_id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM platform.mail_queue WHERE id=ANY($1::uuid[])',[ids]);await pool.query('DELETE FROM platform.users WHERE id=ANY($1::text[])',[[reader,writer]]);await pool.query("UPDATE platform.mail_settings SET enabled=$1,test_mode=$2,version=$3,sender=$4 WHERE id='central'",[before.enabled,before.test_mode,before.version,before.sender]);
 }
}
