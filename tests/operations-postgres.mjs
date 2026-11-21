import {checkDevelopmentMonitor} from './development-monitor-isolated.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {createServer as httpServer} from 'node:http';
import {processMailQueue} from '../src/platform/mail/worker.ts';
import {once} from 'node:events';
import {spawnSync} from 'node:child_process';
import {Pool} from 'pg';
import {operationsStore,publishSample} from '../src/platform/operations/repository.ts';
import {collectSample,probeWeb} from '../src/platform/operations/collector.ts';
import {monitorTick} from '../src/platform/operations/probe.ts';
import {savePdsConfiguration} from '../src/platform/pds/connection/configuration.ts';
export async function checkOperations(pool){
 const project=process.env.HEYELLI_TEST_COMPOSE_PROJECT;assert.match(project??'',/^heyelli-test-[a-f0-9]+$/);
 assert.equal((await pool.query('SELECT count(*)::int n FROM platform.operation_monitor')).rows[0].n,0);
 await checkDevelopmentMonitor(pool);
 const root=await mkdtemp(join(tmpdir(),'heyelli-operations-')),previous={APP_ENV:process.env.APP_ENV,HEYELLI_TEST_SETTINGS_DIR:process.env.HEYELLI_TEST_SETTINGS_DIR};process.env.APP_ENV='test';process.env.HEYELLI_TEST_SETTINGS_DIR=root;
 const admin='operations:'+randomUUID(),reader='operations:'+randomUUID(),mail=randomUUID(),action=randomUUID(),events=[],state={},server=createServer(socket=>socket.end());server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;
 const mailSettings=(await pool.query("SELECT enabled,test_mode FROM platform.mail_settings WHERE id='central'")).rows[0];
 const beforeWorker=(await pool.query("SELECT * FROM platform.mail_worker_health WHERE id='central'")).rows[0],beforePds=(await pool.query("SELECT config_id FROM platform.pds_connection WHERE id='central'")).rows[0].config_id;
 const probePool=new Pool({connectionString:process.env.HEYELLI_TEST_DATABASE_URL,max:1,connectionTimeoutMillis:400,statement_timeout:500,query_timeout:750});probePool.on('error',()=>{});
 let paused=false;
 const store=operationsStore(pool),emit=line=>events.push(JSON.parse(line));
 function compose(args){const r=spawnSync('docker',['compose','--env-file','/dev/null','-f','compose.test.yaml','-p',project,...args],{env:process.env,stdio:'ignore'});assert.equal(r.status,0);}
 try{
  await pool.query("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktive Betriebsadministration','admin',true),($2,'Fiktiver Betriebsleser','reader',true)",[admin,reader]);
  await pool.query("INSERT INTO platform.mail_worker_health(id,last_seen,healthy) VALUES('central',now(),true) ON CONFLICT(id) DO UPDATE SET last_seen=now(),healthy=true");
  assert.equal(await probeWeb(port),true);const healthy=await collectSample(probePool,port);assert.equal(healthy.database,true);assert.equal(healthy.web,true);assert.equal(healthy.secrets,true);assert.deepEqual(await publishSample(pool,healthy,line=>emit(line)),[]);assert.equal(spawnSync(process.execPath,['scripts/monitor.mjs','--check'],{env:process.env,stdio:'ignore'}).status,0);
  await assert.rejects(store.read(reader),e=>e.status===403);
  await pool.query("UPDATE platform.mail_worker_health SET last_seen=now()-interval '3 minutes'");
  await pool.query("INSERT INTO platform.mail_queue(id,request_id,sender,recipient,subject,body,actor_id,status,test_mode,created_at) VALUES($1,$2,'fictitious@example.invalid','fictitious@example.invalid','PRIVATE FICTITIOUS PAYLOAD','PRIVATE FICTITIOUS PAYLOAD',$3,'queued',false,now()-interval '1 hour')",[mail,randomUUID(),admin]);
  const hanging=httpServer(()=>{});hanging.listen(0,'127.0.0.1');await once(hanging,'listening');let deliveries=0;
  try{await pool.query("UPDATE platform.mail_settings SET enabled=true,test_mode=false WHERE id='central'");
   const deliver=async()=>{deliveries++;await fetch('http://127.0.0.1:'+hanging.address().port,{signal:AbortSignal.timeout(50)});throw Error('Unreachable');};
   await processMailQueue(pool,deliver);await processMailQueue(pool,deliver);assert.equal(deliveries,1);assert.equal((await pool.query('SELECT status FROM platform.mail_queue WHERE id=$1',[mail])).rows[0].status,'unknown');
  }finally{hanging.closeAllConnections();await new Promise(resolveClose=>hanging.close(resolveClose));await pool.query("UPDATE platform.mail_settings SET enabled=$1,test_mode=$2 WHERE id='central'",[mailSettings.enabled,mailSettings.test_mode]);}
  await pool.query("UPDATE platform.mail_worker_health SET last_seen=now()-interval '3 minutes'");
  await pool.query("INSERT INTO platform.assistant_actions(id,user_id,epoch,turn_id,config_version,proposal,preview,state) VALUES($1,$2,$3,$4,1,'{}','{}','uncertain')",[action,admin,randomUUID(),randomUUID()]);
  await pool.query("INSERT INTO platform.operation_metrics VALUES(date_trunc('minute',now()),'test',20,3,5,80000)");
  const bad=await collectSample(probePool,port),codes=await publishSample(pool,bad,line=>emit(line));for(const code of ['worker','mailUnknown','actionUncertain','httpErrors','httpSlow'])assert.ok(codes.includes(code));
  const current=(await store.read(admin)).alarms.find(a=>a.code==='mailUnknown');await assert.rejects(store.acknowledge(reader,current.incident_id),e=>e.status===403);await store.acknowledge(admin,current.incident_id);await store.acknowledge(admin,current.incident_id);
  assert.equal((await pool.query("SELECT count(*)::int n FROM platform.audit_events WHERE action='operations.acknowledged' AND target_id=$1",[current.incident_id])).rows[0].n,1);
  const count=events.length;await publishSample(pool,bad,line=>emit(line));assert.equal(events.length,count);assert.equal((await store.read(admin)).alarms.find(a=>a.code==='mailUnknown').active,true);
  await new Promise(resolveClose=>server.close(resolveClose));assert.equal(await probeWeb(port),false);assert.ok((await monitorTick(probePool,port,state,line=>emit(line))).includes('web'));
  // Real interruption of only this disposable database; no development service touched.
  compose(['pause','db']);paused=true;await monitorTick(probePool,port,state,line=>emit(line));assert.ok(state.outage);const outage=state.outage;await monitorTick(probePool,port,state,line=>emit(line));assert.equal(events.filter(e=>e.incidentId===outage).length,1);
  compose(['unpause','db']);paused=false;await monitorTick(probePool,port,state,line=>emit(line));assert.equal(state.outage,undefined);assert.ok(events.some(e=>e.incidentId===outage&&e.event==='recovered'));
  const saved=savePdsConfiguration({baseUrl:'https://pds.example.invalid',token:'fictitious-operations-token'});await pool.query("UPDATE platform.pds_connection SET config_id=$1 WHERE id='central'",[saved]);assert.equal((await collectSample(probePool,port)).secrets,true);await rm(join(root,'.local/pds-secrets/master.key'));assert.equal((await collectSample(probePool,port)).secrets,false);assert.equal(existsSync(join(root,'.local/pds-secrets/master.key')),false);assert.equal((await pool.query("SELECT config_id FROM platform.pds_connection WHERE id='central'")).rows[0].config_id,saved);
  await pool.query("UPDATE platform.mail_queue SET status='queued' WHERE id=$1",[mail]);assert.ok((await publishSample(pool,await collectSample(probePool,port),line=>emit(line))).includes('queue'));
  await pool.query("UPDATE platform.mail_queue SET status='unknown' WHERE id=$1",[mail]);assert.equal((await pool.query('SELECT state FROM platform.assistant_actions WHERE id=$1',[action])).rows[0].state,'uncertain');
  const serialized=JSON.stringify({events,status:await store.read(admin)});assert.ok(!serialized.includes('PRIVATE FICTITIOUS PAYLOAD'));assert.ok(!serialized.includes('fictitious-operations-token'));assert.ok(!serialized.includes('example.invalid'));
  await pool.query("UPDATE platform.operation_monitor SET checked_at=now()-interval '2 minutes'");assert.equal((await store.read(admin)).monitor.fresh,false);assert.equal(spawnSync(process.execPath,['scripts/monitor.mjs','--check'],{env:process.env,stdio:'ignore'}).status,1);
 }finally{
  if(paused)compose(['unpause','db']);await probePool.end();if(server.listening)await new Promise(resolveClose=>server.close(resolveClose));
  await pool.query("UPDATE platform.mail_settings SET enabled=$1,test_mode=$2 WHERE id='central'",[mailSettings.enabled,mailSettings.test_mode]);
  await pool.query('DELETE FROM platform.assistant_actions WHERE id=$1',[action]);await pool.query('DELETE FROM platform.mail_log WHERE mail_id=$1',[mail]);await pool.query('DELETE FROM platform.mail_queue WHERE id=$1',[mail]);await pool.query("UPDATE platform.pds_connection SET config_id=$1 WHERE id='central'",[beforePds]);
  await pool.query('DELETE FROM platform.operation_metrics');await pool.query('DELETE FROM platform.operation_monitor');await pool.query('DELETE FROM platform.operation_alarms');
  await pool.query("DELETE FROM platform.mail_worker_health WHERE id='central'");if(beforeWorker)await pool.query('INSERT INTO platform.mail_worker_health(id,last_seen,last_success,healthy) VALUES($1,$2,$3,$4)',[beforeWorker.id,beforeWorker.last_seen,beforeWorker.last_success,beforeWorker.healthy]);
  await pool.query("DELETE FROM platform.audit_events WHERE actor_id=$1",[admin]);await pool.query('DELETE FROM platform.users WHERE id=ANY($1::text[])',[[admin,reader]]);for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}await rm(root,{recursive:true,force:true});
 }
 console.log('A07_REPORT '+JSON.stringify({status:'passed',databasePauseAndRecovery:true,closedWebService:true,staleWorker:true,hangingLocalProvider:true,noDuplicateDelivery:true,unclearActionsPreserved:true,missingKeyReadOnly:true,adminOnly:true,acknowledgementIdempotent:true,redactedDiagnostics:true,cliHealthyAndStale:true,cleanupCompleted:true}));
}
