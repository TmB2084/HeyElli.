import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {createServer} from 'node:net';import {spawn} from 'node:child_process';import {once} from 'node:events';
import {probeWeb} from '../src/platform/operations/web-probe.ts';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,ms=15000){const deadline=Date.now()+ms;while(Date.now()<deadline){if(await check())return;await pause(100);}throw Error('Isolierter Überwachungslauf nicht bereit.');}
async function stop(child,signal='SIGTERM'){if(child&&child.exitCode===null&&child.signalCode===null){const end=once(child,'exit');child.kill(signal);let timer;try{await Promise.race([end,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Isolierter Prozess beendet nicht.')),35000);})]);}finally{clearTimeout(timer);}}}
export async function checkDevelopmentMonitor(pool){
 assert.match(process.env.HEYELLI_TEST_COMPOSE_PROJECT??'',/^heyelli-test-[a-f0-9]+$/);
 const directory=await mkdtemp(join(tmpdir(),'heyelli-monitor-runtime-')),entry=resolve('scripts/dev.mjs'),monitor=resolve('scripts/monitor.mjs'),fixture=pathToFileURL(resolve('tests/fixtures/dev-service.mjs')).href;
 const server=createServer(socket=>socket.end());server.listen({port:0,host:'::1',ipv6Only:true});await once(server,'listening');const port=server.address().port;
 const env={...process.env,APP_ENV:'test',HEYELLI_TEST_SETTINGS_DIR:directory,HEYELLI_MONITOR_PORT:String(port),HEYELLI_MONITOR_HOST:'::1',TEST_MONITOR_PORT:String(port),TEST_MONITOR_HOST:'::1'};
 const spawnAt=(file,args=[],extra={})=>spawn(process.execPath,[file,...args],{cwd:directory,env:{...env,...extra},stdio:'ignore'});
 const last=async()=>(await pool.query("SELECT checked_at,snapshot FROM platform.operation_monitor WHERE id='local'")).rows[0];
 let owner,external,duplicate,parallel;
 const beforeWorker=(await pool.query("SELECT * FROM platform.mail_worker_health WHERE id='central'")).rows[0];
 try{
  await mkdir(join(directory,'scripts'),{recursive:true});await mkdir(join(directory,'node_modules/next/dist/bin'),{recursive:true});await mkdir(join(directory,'.local'),{recursive:true});
  await writeFile(join(directory,'node_modules/next/package.json'),'{"type":"module"}');
  for(const [path,mode]of [['scripts/assistant-runtime.mjs','assistant'],['scripts/mail-worker.mjs','worker'],['node_modules/next/dist/bin/next','web']])await writeFile(join(directory,path),`process.argv[2]=${JSON.stringify(mode)};process.argv[3]=${JSON.stringify(directory)};await import(${JSON.stringify(fixture)});`);
  await writeFile(join(directory,'scripts/monitor.mjs'),`import {appendFile} from 'node:fs/promises';if(process.env.HEYELLI_MONITOR_PORT!==process.env.TEST_MONITOR_PORT||process.env.HEYELLI_MONITOR_HOST!==process.env.TEST_MONITOR_HOST)throw Error('Wrong isolated port');await appendFile(${JSON.stringify(join(directory,'monitor-starts'))},String(process.pid)+'\\n');await import(${JSON.stringify(pathToFileURL(monitor).href)});`);
  await writeFile(join(directory,'.env.local'),'FICTITIOUS_RUNTIME_MARKER=keep\n');await writeFile(join(directory,'.local/persistent'),'fictitious data keep');
  await pool.query("INSERT INTO platform.mail_worker_health(id,last_seen,healthy) VALUES('central',now(),true) ON CONFLICT(id) DO UPDATE SET last_seen=now(),healthy=true");
  assert.equal(await probeWeb(port,'::1'),true);assert.equal(await probeWeb(port,'localhost'),true);assert.equal(await probeWeb(port,'127.0.0.1'),false);
  owner=spawnAt(entry,['--hostname','::1'],{PORT:String(port),HEYELLI_MONITOR_PORT:'1',HEYELLI_MONITOR_HOST:'127.0.0.1'});
  await until(async()=>!!await last());const first=await last();assert.equal(first.snapshot.web,true);
  duplicate=spawnAt(monitor);await until(()=>duplicate.exitCode!==null);assert.equal(duplicate.exitCode,75);
  await writeFile(join(directory,'.next/dev/sentinel'),'keep active cache');parallel=spawnAt(entry,['-p',String(port)]);await until(()=>parallel.exitCode!==null);assert.equal(parallel.exitCode,1);assert.equal(await readFile(join(directory,'.next/dev/sentinel'),'utf8'),'keep active cache');
  // Prove periodic publication, not merely a startup message.
  await until(async()=>+(await last()).checked_at>+first.checked_at,40000);
  const pids=async()=>(await readFile(join(directory,'monitor-starts'),'utf8')).trim().split('\n').map(Number),initial=(await pids()).at(-1),beforeCrash=await last();process.kill(initial,'SIGKILL');
  await until(async()=>((await pids()).at(-1)!==initial)&&+(await last()).checked_at>+beforeCrash.checked_at);assert.equal((await pids()).length,2);
  await stop(owner);assert.equal(owner.exitCode,0);for(const mode of ['web','worker','assistant'])assert.equal(await readFile(join(directory,mode+'.stopped'),'utf8'),'yes');const owned=(await pids()).at(-1);assert.throws(()=>process.kill(owned,0),error=>error.code==='ESRCH');
  const previous=await last();external=spawnAt(monitor);await until(async()=>+(await last()).checked_at>+previous.checked_at);
  owner=spawnAt(entry,['--hostname=::1','--port='+port]);await until(async()=>(await pids()).length===3);await pause(3400);assert.equal((await pids()).length,3);assert.equal(external.exitCode,null);await stop(owner,'SIGINT');assert.equal(owner.exitCode,0);assert.equal(external.exitCode,null);await stop(external);
  assert.equal(await readFile(join(directory,'.local/persistent'),'utf8'),'fictitious data keep');assert.equal(await readFile(join(directory,'.env.local'),'utf8'),'FICTITIOUS_RUNTIME_MARKER=keep\n');
  console.log('DEV_MONITOR_REPORT '+JSON.stringify({status:'passed',realLauncherAndMonitor:true,fixtureWebMailAndAssistant:true,automaticStart:true,customPort:true,ipv6OnlyWeb:true,explicitAddressFamily:true,localhostFallback:true,staleHostOverrideIgnored:true,duplicateStandaloneRejected:true,parallelLauncherRejected:true,periodicHeartbeat:true,crashRestart:true,gracefulTermAndInt:true,externalObserverPreserved:true,persistentFilesUnchanged:true}));
 }finally{
  for(const child of [owner,external,duplicate,parallel])await stop(child);
  await new Promise(r=>server.close(r));await pool.query('DELETE FROM platform.operation_monitor');await pool.query('DELETE FROM platform.operation_alarms');await pool.query('DELETE FROM platform.operation_metrics');await pool.query("DELETE FROM platform.mail_worker_health WHERE id='central'");if(beforeWorker)await pool.query('INSERT INTO platform.mail_worker_health(id,last_seen,last_success,healthy) VALUES($1,$2,$3,$4)',[beforeWorker.id,beforeWorker.last_seen,beforeWorker.last_success,beforeWorker.healthy]);await rm(directory,{recursive:true,force:true});
 }
}
