import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {privateDrafts} from '../src/apps/planboard/entwuerfe/repository.ts';
import {encryptDraft,decryptDraft} from '../src/apps/planboard/entwuerfe/crypto.ts';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {platformRepository} from '../src/platform/store/repository.ts';
import {assignPds} from './support/pds-assignment.mjs';
export const loadAcceptance={normalConcurrency:16,peakConcurrency:64,normalP95Ms:1000,peakP95Ms:3000,serverRssBytes:1536*1024*1024,uploadRssBytes:192*1024*1024};
export async function checkResourceLoad({pool,base,cookieName,memoryFile,adminCookie,sqlitePath}){
 assert.match(process.env.HEYELLI_TEST_COMPOSE_PROJECT??'',/^heyelli-test-/);const users=Array.from({length:16},()=>`ad:${randomUUID()}`),store=platformRepository(pool),cookies=[];
 const draftRoot=await mkdtemp(join(tmpdir(),'heyelli-load-drafts-')),previous={APP_ENV:process.env.APP_ENV,HEYELLI_TEST_SETTINGS_DIR:process.env.HEYELLI_TEST_SETTINGS_DIR};process.env.APP_ENV='test';process.env.HEYELLI_TEST_SETTINGS_DIR=draftRoot;
 const pct=values=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];
 try{
  for(const id of users){await pool.query("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktives Lastkonto','reader',true)",[id]);await assignPds(pool,id);const token=await store.issue({id,role:'reader',mode:'local'});cookies.push(cookieName+'='+token);}
  const drafts=privateDrafts(pool),key=await drafts.key(users[0]),draftId=randomUUID(),draftName='heyelli:calendar-draft:v2:load:'+draftId,payload=JSON.stringify({draftId,operationId:randomUUID(),original:{id:'fictitious-event'},changed:{id:'fictitious-event',notes:'Unveränderte fiktive Eingabe'}});await drafts.change(users[0],{key:draftName,envelope:encryptDraft(key,draftName,payload)});const originalDraft=JSON.stringify(await drafts.read(users[0]));
  const call=async index=>{const started=performance.now(),response=await fetch(base+'/api/benutzerkonto/daten',{headers:{cookie:cookies[index%cookies.length]},signal:AbortSignal.timeout(5000)}),text=await response.text();assert.ok(text.length<65536);if(response.status!==200){assert.ok([429,503].includes(response.status));assert.ok(text.includes('error'));}return {ms:performance.now()-started,status:response.status};};
  for(let n=0;n<16;n++)assert.equal((await call(n)).status,200);
  const normal=[];for(let batch=0;batch<4;batch++)normal.push(...await Promise.all(Array.from({length:16},(_,i)=>call(i))));assert.ok(normal.every(r=>r.status===200));
  const peak=await Promise.all(Array.from({length:64},(_,i)=>call(i))),recovery=[];for(let n=0;n<16;n++)recovery.push(await call(n));assert.ok(recovery.every(r=>r.status===200));
  assert.equal(JSON.stringify(await drafts.read(users[0])),originalDraft);const restored=(await drafts.read(users[0])).records[0];assert.equal(decryptDraft(await drafts.key(users[0]),restored.key,restored.envelope),payload);
  const samples=(await readFile(memoryFile,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));assert.ok(samples.length>0,'Speichermessung muss echte Prozessdaten enthalten.');let serverRss=0;const current=new Map();for(const sample of samples.sort((a,b)=>a.at-b.at)){current.set(sample.pid,sample);serverRss=Math.max(serverRss,[...current.values()].filter(v=>sample.at-v.at<200).reduce((sum,v)=>sum+v.rss,0));}assert.ok(serverRss<loadAcceptance.serverRssBytes);
  const processResult=spawnSync(process.execPath,['tests/upload-memory-fixture.mjs'],{encoding:'utf8',timeout:30000});assert.equal(processResult.status,0);const upload=JSON.parse(processResult.stdout.trim());assert.ok(upload.rssMax<loadAcceptance.uploadRssBytes);
  // Large fictional audit data; no real identities, business records or drafts.
  await pool.query("INSERT INTO platform.audit_events(actor_id,action,target_id,changes) SELECT CASE WHEN n%1000=0 THEN ($1::text[])[1] ELSE ($1::text[])[(n%15)+2] END,'fictitious.load',n::text,jsonb_build_array(jsonb_build_object('label','Fiktiver Wert','before',n,'after',n+1)) FROM generate_series(1,100000) n",[users]);await pool.query('ANALYZE platform.audit_events');
  const times=[];for(let n=0;n<16;n++){const start=performance.now();await pool.query('SELECT id FROM platform.audit_events WHERE actor_id=$1 ORDER BY id DESC LIMIT 50',[users[0]]);times.push(performance.now()-start);}
  const plan=(await pool.query('EXPLAIN (FORMAT JSON) SELECT id FROM platform.audit_events WHERE actor_id=$1 ORDER BY id DESC LIMIT 50',[users[0]])).rows[0]['QUERY PLAN'];assert.match(JSON.stringify(plan),/audit_actor_cursor/);
  const uploadId=randomUUID(),headers={cookie:adminCookie,origin:base,'Content-Type':'application/octet-stream','X-File-Name':'fictitious.eml','X-Upload-Id':uploadId};
  const initial=await fetch(base+'/api/pds-simulator/uploads',{method:'POST',headers,body:'Fictitious content'});assert.equal(initial.status,201);await initial.text();
  const sqlite=new DatabaseSync(sqlitePath,{readOnly:true});let interruptedCleanly=false;
  const controller=new AbortController();let attempt;
  try{const body=new ReadableStream({start(c){c.enqueue(Buffer.alloc(400000,65));}});attempt=fetch(base+'/api/pds-simulator/uploads',{method:'POST',headers:{...headers,'X-Upload-Id':randomUUID()},body,duplex:'half',signal:controller.signal}).catch(()=>null);
   for(let n=0;n<100;n++){if(sqlite.prepare("SELECT count(*) n FROM upload_transfers WHERE state='pending'").get().n)break;await new Promise(resolve=>setTimeout(resolve,20));}
   assert.equal(sqlite.prepare("SELECT count(*) n FROM upload_transfers WHERE state='pending'").get().n,1);controller.abort();await attempt;
   for(let n=0;n<100;n++){if(!sqlite.prepare("SELECT count(*) n FROM upload_transfers WHERE state='pending'").get().n)break;await new Promise(resolve=>setTimeout(resolve,20));}
   assert.equal(sqlite.prepare("SELECT count(*) n FROM upload_transfers WHERE state='pending'").get().n,0);assert.equal(sqlite.prepare('SELECT count(*) n FROM uploads').get().n,1);interruptedCleanly=true;
  }finally{controller.abort();await attempt;sqlite.close();}
  for(let n=0;n<100;n++){if(!(await pool.query("SELECT count(*)::int n FROM platform.resource_leases WHERE user_id='local-service-user'")).rows[0].n)break;await new Promise(resolve=>setTimeout(resolve,20));}
  assert.equal((await pool.query("SELECT count(*)::int n FROM platform.resource_leases WHERE user_id='local-service-user'")).rows[0].n,0);
  const report={profile:'16 normal / 64 peak',acceptance:loadAcceptance,normal:{requests:normal.length,p95Ms:Math.ceil(pct(normal.map(r=>r.ms)))},peak:{requests:peak.length,p95Ms:Math.ceil(pct(peak.map(r=>r.ms))),accepted:peak.filter(r=>r.status===200).length,rejected:peak.filter(r=>r.status!==200).length},recovery:{requests:recovery.length,allSucceeded:true,encryptedDraftUnchanged:true},serverRssMaxBytes:serverRss,upload,interruptedUploadCleaned:interruptedCleanly,audit:{rows:100000,p95Ms:Math.ceil(pct(times)),index:'audit_actor_cursor'}};
  assert.ok(report.normal.p95Ms<loadAcceptance.normalP95Ms);assert.ok(report.peak.p95Ms<loadAcceptance.peakP95Ms);assert.ok(report.audit.p95Ms<1000);console.log('A06_LOAD_REPORT '+JSON.stringify(report));return report;
 }finally{
  await pool.query('DELETE FROM platform.audit_events WHERE actor_id=ANY($1::text[])',[users]);await pool.query('ANALYZE platform.audit_events');await pool.query('DELETE FROM platform.resource_leases WHERE user_id=ANY($1::text[])',[users]);await pool.query('DELETE FROM platform.resource_windows WHERE user_id=ANY($1::text[])',[users]);await pool.query('DELETE FROM platform.sessions WHERE user_id=ANY($1::text[])',[users]);await pool.query('DELETE FROM platform.users WHERE id=ANY($1::text[])',[users]);for(const[k,v]of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}await rm(draftRoot,{recursive:true,force:true});
 }
}
export async function installMemoryProbe(directory){
 const probe=join(directory,'memory-probe.cjs'),memoryFile=join(directory,'memory.jsonl');await writeFile(memoryFile,'');
 await writeFile(probe,`const fs=require('node:fs');const output=${JSON.stringify(memoryFile)};let fd;try{fd=fs.openSync(output,fs.constants.O_WRONLY|fs.constants.O_APPEND)}catch{}if(fd!==undefined){setInterval(()=>{try{fs.writeSync(fd,JSON.stringify({at:Date.now(),rss:process.memoryUsage().rss,pid:process.pid})+'\\n')}catch{}},50).unref();process.once('exit',()=>{try{fs.closeSync(fd)}catch{}});}`);
 return {memoryFile,option:'--require '+resolve(probe)};
}
