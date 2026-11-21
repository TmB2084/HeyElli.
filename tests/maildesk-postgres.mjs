import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {maildeskStore} from '../src/apps/maildesk/store.ts';
import {maildeskSettings} from '../src/apps/maildesk/settings.ts';
// MailDesk speichert nur Entscheidungen; Konflikte, Absenderlernen, Zuständigkeit und Antworten über die Warteschlange.
export async function checkMaildesk(pool){
 const users=(await pool.query('SELECT id FROM platform.users WHERE enabled ORDER BY id LIMIT 2')).rows.map(row=>row.id),store=maildeskStore(pool),source='simulator|test-'+randomUUID();
 assert.equal(users.length,2);
 const settings=(await pool.query("SELECT enabled,sender,test_mode FROM platform.mail_settings WHERE id='central'")).rows[0];
 try{
  const first=await store.change(users[0],source,'m1',{action:'assign',version:0,customerId:'K1',objectId:'o1'},'Verwaltung@HV-Nord.example');
  assert.deepEqual([first.customerId,first.objectId,first.decision,first.version],['K1','o1','manual',1]);
  assert.deepEqual(await store.senders(source),[{address:'verwaltung@hv-nord.example',customerId:'K1'}]);
  await assert.rejects(store.change(users[1],source,'m1',{action:'flag',version:0,value:true},''),error=>error.status===409);
  const parallel=await Promise.allSettled([store.change(users[0],source,'m1',{action:'flag',version:1,value:true},''),store.change(users[1],source,'m1',{action:'archive',version:1,value:true},'')]);
  assert.equal(parallel.filter(item=>item.status==='fulfilled').length,1);assert.equal(parallel.filter(item=>item.status==='rejected'&&item.reason.status===409).length,1);
  let state=(await store.states(source,['m1'])).get('m1');assert.equal(state.version,2);
  await assert.rejects(store.change(users[0],source,'m1',{action:'assignee',version:2,assigneeId:'gibt-es-nicht'},''),/nicht gefunden/);
  state=await store.change(users[0],source,'m1',{action:'assignee',version:2,assigneeId:users[1]},'');assert.equal(state.assigneeId,users[1]);
  state=await store.change(users[0],source,'m1',{action:'order',version:3,orderNumber:'SIM-SA-10001',customerId:'K1',objectId:'u1'},'');assert.deepEqual([state.orderNumber,state.objectId,state.decision],['SIM-SA-10001','u1','manual']);
  state=await store.change(users[0],source,'m1',{action:'clear',version:4},'');assert.deepEqual([state.customerId,state.orderNumber,state.decision],[null,null,'cleared']);
  for(const input of [{action:'assign',version:0,customerId:''},{action:'flag',version:0,value:'ja'},{action:'order',version:0,orderNumber:'x y',customerId:'K1'},{action:'löschen',version:0},{action:'assign',version:-1,customerId:'K1'}])await assert.rejects(store.change(users[0],source,'m2',input,''));
  await store.change(users[0],source,'m3',{action:'confirm',version:0,customerId:'K2'},'kein-absender');assert.equal((await store.senders(source)).length,1);
  // Antworten: ohne freigegebenen Versand abgewiesen, sonst genau einmal eingereiht (Wiederholung ohne Duplikat).
  await pool.query("UPDATE platform.mail_settings SET enabled=false WHERE id='central'");
  const reply={requestId:randomUUID(),recipient:'kunde@mail.example',subject:'AW: Test',body:'Fiktive Antwort'};
  await assert.rejects(store.reply(users[0],source,'m1',reply),/nicht freigegeben/);
  await pool.query("UPDATE platform.mail_settings SET enabled=true,sender='service@heyelli.example',test_mode=true WHERE id='central'");
  const sent=await store.reply(users[0],source,'m1',reply),again=await store.reply(users[0],source,'m1',reply);
  assert.deepEqual([sent.testMode,sent.repeated,again.repeated],[true,false,true]);
  await assert.rejects(store.reply(users[1],source,'m1',reply),error=>error.status===409);
  await assert.rejects(store.reply(users[0],source,'m1',{...reply,requestId:randomUUID(),recipient:'kein-empfaenger'}),/Empfänger/);
  const rows=await store.sent(source);assert.equal(rows.length,1);assert.equal(rows[0].subject,'AW: Test');assert.equal(rows[0].testMode,true);
 }finally{
  const queue=(await pool.query('SELECT queue_id FROM platform.maildesk_replies WHERE source=$1',[source])).rows.map(row=>row.queue_id);
  await pool.query('DELETE FROM platform.maildesk_replies WHERE source=$1',[source]);
  if(queue.length){await pool.query('DELETE FROM platform.mail_log WHERE mail_id=ANY($1::uuid[])',[queue]);await pool.query('DELETE FROM platform.mail_queue WHERE id=ANY($1::uuid[])',[queue]);}
  await pool.query('DELETE FROM platform.maildesk_messages WHERE source=$1',[source]);await pool.query('DELETE FROM platform.maildesk_senders WHERE source=$1',[source]);
  await pool.query("UPDATE platform.mail_settings SET enabled=$1,sender=$2,test_mode=$3 WHERE id='central'",[settings.enabled,settings.sender,settings.test_mode]);
 }
}

// Postfachquelle: nur Administratoren, versioniert; Microsoft 365 erst nach erfolgreicher Prüfung genau dieses Postfachs.
export async function checkMaildeskSettings(pool){
 const admin=(await pool.query("SELECT id FROM platform.users WHERE enabled AND role='admin' ORDER BY id LIMIT 1")).rows[0]?.id,other=(await pool.query("SELECT id FROM platform.users WHERE enabled AND role<>'admin' ORDER BY id LIMIT 1")).rows[0]?.id,store=maildeskSettings(pool);
 const original=(await pool.query("SELECT * FROM platform.maildesk_settings WHERE id='central'")).rows[0];
 try{
  let current=await store.read();assert.equal(current.source,'simulator');
  if(other)await assert.rejects(store.save(other,{version:current.version,source:'simulator',mailbox:null}),error=>error.status===403);
  await assert.rejects(store.save(admin,{version:current.version,source:'graph',mailbox:'service@firma.example'}),/Verbindung prüfen/);
  await store.recordCheck(admin,'service@firma.example',false);current=await store.read();
  await assert.rejects(store.save(admin,{version:current.version,source:'graph',mailbox:'service@firma.example'}),/Verbindung prüfen/);
  await store.recordCheck(admin,'andere@firma.example',true);current=await store.read();
  await assert.rejects(store.save(admin,{version:current.version,source:'graph',mailbox:'service@firma.example'}),/Verbindung prüfen/);
  await store.recordCheck(admin,'service@firma.example',true);current=await store.read();assert.equal(current.checkFresh,true);
  current=await store.save(admin,{version:current.version,source:'graph',mailbox:'Service@Firma.example'});assert.deepEqual([current.source,current.mailbox,current.connectionReady],['graph','service@firma.example',true]);
  await assert.rejects(store.save(admin,{version:current.version-1,source:'simulator',mailbox:null}),error=>error.status===409);
  await assert.rejects(store.save(admin,{version:current.version,source:'simulator',mailbox:'keine-adresse'}),/gültige Postfachadresse/);
  current=await store.save(admin,{version:current.version,source:'simulator',mailbox:null});assert.equal(current.source,'simulator');
 }finally{await pool.query("UPDATE platform.maildesk_settings SET source=$1,mailbox=$2,checked_mailbox=$3,checked_at=$4,connection_ok=$5 WHERE id='central'",[original.source,original.mailbox,original.checked_mailbox,original.checked_at,original.connection_ok]);}
}
