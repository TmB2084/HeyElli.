import {mailRepository} from '../src/platform/mail/repository.ts';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {processMailQueue} from '../src/platform/mail/worker.ts';
export async function checkMailWorker(pool){
 await pool.query("UPDATE platform.mail_settings SET test_mode=true WHERE id='central'");
 const add=async(testMode)=>{const id=randomUUID();await pool.query("INSERT INTO platform.mail_queue(id,request_id,sender,recipient,subject,body,actor_id,test_mode) VALUES($1,$2,'sender@example.invalid','recipient@example.invalid','Worker-Test','Fiktiv','test-worker',$3)",[id,randomUUID(),testMode]);return id;};
 const read=async id=>(await pool.query('SELECT * FROM platform.mail_queue WHERE id=$1',[id])).rows[0];
 const simulated=await add(true),live=await add(false);let calls=0;
 await pool.query("UPDATE platform.mail_settings SET enabled=false WHERE id='central'");await processMailQueue(pool,async()=>{calls++;return {status:'accepted',error:null};});assert.equal(calls,0);assert.equal((await read(simulated)).status,'queued');await pool.query("UPDATE platform.mail_settings SET enabled=true WHERE id='central'");
 await processMailQueue(pool,async()=>{calls++;return {status:'accepted',error:null};});
 assert.equal(calls,0);assert.equal((await read(simulated)).status,'simulated');assert.equal((await read(live)).status,'queued');
 await pool.query("UPDATE platform.mail_settings SET test_mode=false WHERE id='central'");
 await Promise.all([processMailQueue(pool,async()=>{calls++;return {status:'accepted',error:null};}),processMailQueue(pool,async()=>{calls++;return {status:'accepted',error:null};})]);
 assert.equal(calls,1);assert.equal((await read(live)).status,'accepted');
 const retry=await add(false);await processMailQueue(pool,async()=>({status:'retry',error:'Test',delay:120}));assert.equal((await read(retry)).status,'retry');assert.ok(new Date((await read(retry)).next_attempt_at)>new Date());
 await pool.query("UPDATE platform.mail_queue SET attempts=4,next_attempt_at=now() WHERE id=$1",[retry]);await processMailQueue(pool,async()=>({status:'retry',error:'Test'}));assert.equal((await read(retry)).status,'failed');
 const unknown=await add(false);await processMailQueue(pool,async()=>({status:'unknown',error:'Testabbruch'}));assert.equal((await read(unknown)).status,'unknown');
 const interrupted=await add(false);await pool.query("UPDATE platform.mail_queue SET status='sending' WHERE id=$1",[interrupted]);await processMailQueue(pool,async()=>{throw Error('unexpected send');});assert.equal((await read(interrupted)).status,'unknown');
 const repository=mailRepository(pool);
 await assert.rejects(repository.change('local-service-user',{action:'retry',id:unknown}),/Nur eindeutig/);
 await repository.change('local-service-user',{action:'retry',id:retry});assert.equal((await read(retry)).status,'queued');
 await repository.change('local-service-user',{action:'cancel',id:retry});assert.equal((await read(retry)).status,'cancelled');
 await assert.rejects(repository.change('local-service-user',{action:'cancel',id:live}),/nicht mehr/);
 const keys=['M365_TENANT_ID','M365_CLIENT_ID','M365_CLIENT_SECRET'],saved=keys.map(key=>process.env[key]);
 try{
  process.env.M365_TENANT_ID=randomUUID();process.env.M365_CLIENT_ID=randomUUID();process.env.M365_CLIENT_SECRET=randomUUID();
  let snapshot=await repository.read('local-service-user');await repository.change('local-service-user',{action:'settings',sender:'ready@example.invalid.test',version:snapshot.settings.version});
  snapshot=await repository.read('local-service-user');
  await assert.rejects(repository.change('local-service-user',{action:'mode',testMode:false,confirmLive:true,version:snapshot.settings.version}),/Hintergrunddienst/);
  await pool.query("INSERT INTO platform.mail_worker_health(id,last_seen,last_success,healthy) VALUES('central',now(),now(),true) ON CONFLICT(id) DO UPDATE SET last_seen=now(),last_success=now(),healthy=true");
  await assert.rejects(repository.change('local-service-user',{action:'mode',testMode:false,confirmLive:true,version:snapshot.settings.version}),/Absenderpostfach erfolgreich/);
  await repository.recordConnection('local-service-user',{sender:snapshot.settings.sender,authentication:true,mailbox:true},snapshot.settings.version);
  await repository.change('local-service-user',{action:'mode',testMode:false,confirmLive:true,version:snapshot.settings.version});
  snapshot=await repository.read('local-service-user');assert.equal(snapshot.settings.test_mode,false);
  await repository.change('local-service-user',{action:'settings',sender:'changed@example.invalid.test',version:snapshot.settings.version});snapshot=await repository.read('local-service-user');assert.equal(snapshot.settings.test_mode,true);assert.equal(snapshot.settings.connection_ok,false);
 }finally{keys.forEach((key,index)=>{if(saved[index]===undefined)delete process.env[key];else process.env[key]=saved[index];});}
 await pool.query("UPDATE platform.mail_settings SET test_mode=true WHERE id='central'");
}
