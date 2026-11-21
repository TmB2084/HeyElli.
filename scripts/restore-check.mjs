import {Pool} from 'pg';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,rm,cp,chmod} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {decryptArchive,command,postgresManifest,stablePostgres,checkState} from './backup-core.mjs';
import {checkPayload} from './backup-snapshot.mjs';
import {verifyProtectedData,sanitizeRestoredDatabase} from './backup-verify.mjs';
import {verificationEnvironment} from './verification-plan.mjs';
import {prepareTestAdmin} from './test-account.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.length!==4||args[0]!=='--archive'||args[2]!=='--key-file')throw Error('Aufruf: npm run backup:check -- --archive Datei --key-file Schlüsseldatei');
const work=await mkdtemp(join(tmpdir(),'heyelli-restore-'));await chmod(work,0o700);const project='heyelli-restore-'+randomBytes(6).toString('hex'),env={...verificationEnvironment(process.env,work),HEYELLI_TEST_POSTGRES_PASSWORD:randomBytes(32).toString('hex')};
let pool,server,started=false,sourcePool;const start=Date.now(),report={status:'failed',startedAt:new Date().toISOString(),cleanup:false};
const compose=args=>command('docker',['compose','--env-file','/dev/null','-f',join(root,'compose.restore.yaml'),'-p',project,...args],{env});
try{
 const tar=join(work,'authenticated.tar.gz');await decryptArchive(resolve(args[1]),resolve(args[3]),tar);const payload=join(work,'payload');await command('python3',[join(root,'scripts/backup-extract.py'),tar,payload]);const manifest=await checkPayload(payload);report.archiveAuthenticated=true;report.checksums=true;
 started=true;await compose(['up','-d','--wait']);const published=spawnSync('docker',['compose','--env-file','/dev/null','-f',join(root,'compose.restore.yaml'),'-p',project,'port','db','5432'],{env,encoding:'utf8'});if(published.status!==0)throw Error('Prüfport nicht verfügbar');const port=published.stdout.trim().split(':').at(-1),db=new URL(`postgresql://heyelli_test@127.0.0.1:${port}/heyelli_test`);db.password=env.HEYELLI_TEST_POSTGRES_PASSWORD;pool=new Pool({connectionString:db.href});pool.on('error',()=>{});
 await command('docker',['compose','--env-file','/dev/null','-f',join(root,'compose.restore.yaml'),'-p',project,'exec','-T','db','pg_restore','-U','heyelli_test','-d','heyelli_test','--no-owner','--no-acl','--exit-on-error'],{env,input:join(payload,'postgres.dump')});
 const client=await pool.connect();let restored;try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');restored=await postgresManifest(client);await client.query('ROLLBACK');}finally{client.release();}
 if(JSON.stringify(restored)!==JSON.stringify(manifest.postgres))throw Error('Wiederhergestellte Datenbank weicht von Sicherung ab');report.databaseEqual=true;report.tables=restored.tables.length;report.rows=restored.tables.reduce((n,t)=>n+t.rows,0);report.sqliteFiles=manifest.files.filter(f=>f.sqlite).length;
 report.protectedData=await verifyProtectedData(pool,join(payload,'state'));
 await sanitizeRestoredDatabase(pool);report.safeRestore=true;
 const app=join(payload,'application');try{await cp(join(payload,'state/.local'),join(app,'.local'),{recursive:true});}catch(error){if(error.code!=='ENOENT')throw error;}
 for(const item of manifest.source)if(item.mode===0o700)await chmod(join(app,item.path),0o700);
 await command('npm',['ci','--no-fund'],{cwd:app,env});
 const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const webPort=listener.address().port;await new Promise(ok=>listener.close(ok));const base='http://127.0.0.1:'+webPort,password=randomBytes(32).toString('hex');
 await pool.query("INSERT INTO platform.users(id,display_name,role,enabled) VALUES('local-service-user','Isolierte Wiederherstellungsprüfung','admin',true) ON CONFLICT(id) DO UPDATE SET role='admin',enabled=true,app_role_id=NULL");await prepareTestAdmin(pool,password);
 server=spawn(process.execPath,[join(app,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(webPort)],{cwd:app,env:{...env,HEYELLI_TEST_SETTINGS_DIR:join(payload,'state'),HEYELLI_TEST_DATABASE_URL:db.href,},stdio:'ignore'});server.on('error',()=>{});
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error('Prüfserver beendet');try{if((await fetch(base+'/api/simulator-session',{signal:AbortSignal.timeout(2000)})).ok)break;}catch{}if(i===99)throw Error('Prüfserver nicht erreichbar');await new Promise(ok=>setTimeout(ok,300));}
 const login=await fetch(base+'/api/simulator-session',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username:'service',password}),signal:AbortSignal.timeout(30000)});if(!login.ok)throw Error('Prüfanmeldung fehlgeschlagen');const cookie=login.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');await login.arrayBuffer();report.http=[];
 for(const path of ['/service','/api/service','/api/verwaltung/pds','/api/verwaltung/email','/api/benutzerkonto']){const response=await fetch(base+path,{headers:{cookie},signal:AbortSignal.timeout(60000)});report.http.push({path,status:response.status});await response.arrayBuffer();if(!response.ok)throw Error('Wiederhergestellter Anwendungsweg nicht erreichbar');}
 const safety=(await pool.query("SELECT (SELECT active_source='simulator' FROM platform.pds_connection WHERE id='central') AND (SELECT NOT enabled AND test_mode FROM platform.mail_settings WHERE id='central') AND (SELECT NOT enabled FROM platform.copilot_settings WHERE id='central') AND (SELECT NOT enabled FROM platform.bmacloud_settings WHERE id='central') AND (SELECT NOT enabled FROM platform.microsoft_auth WHERE id='central') AS safe")).rows[0].safe;if(!safety)throw Error('Wiederherstellungssperren fehlen');if((await pool.query("SELECT to_regclass('platform.sharepoint_settings') IS NOT NULL AS present")).rows[0].present&&(await pool.query("SELECT enabled FROM platform.sharepoint_settings WHERE id='central'")).rows[0]?.enabled)throw Error('SharePoint-Wiederherstellungssperre fehlt');
 if(manifest.sourceRoot===root){const nextEnv=(await import('@next/env')).default;nextEnv.loadEnvConfig(root,true,{info(){},error(){}});const {databaseConfig}=await import('../src/platform/store/config.ts');sourcePool=new Pool({...databaseConfig(process.env),options:'-c default_transaction_read_only=on'});sourcePool.on('error',()=>{});const original=await sourcePool.connect();try{await original.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const current=await postgresManifest(original,{sourceStability:!!manifest.sourceStabilityPostgres});await original.query('ROLLBACK');report.sourceUnchanged=JSON.stringify(stablePostgres(current))===JSON.stringify(manifest.sourceStabilityPostgres??stablePostgres(manifest.postgres))&&await checkState(root,manifest.files,{logical:true});}finally{original.release();}if(!report.sourceUnchanged)throw Error('Quellvergleich geändert; Ursache vor Abschluss prüfen');}
 report.status='passed';report.backupPoint=manifest.snapshotAt??manifest.createdAt;
}catch{console.error('Wiederherstellungsprüfung fehlgeschlagen. Nur die eigene Prüfumgebung wird entfernt; Quelldaten und Zugangsdaten bleiben unverändert.');process.exitCode=1;}
finally{
 if(server&&server.exitCode===null&&server.signalCode===null){const exited=once(server,'exit');server.kill('SIGTERM');await exited;}
 await pool?.end();await sourcePool?.end();try{if(started)await compose(['down','-v','--remove-orphans']);report.cleanup=true;}catch{process.exitCode=1;}
 await rm(work,{recursive:true,force:true});report.finishedAt=new Date().toISOString();report.seconds=Math.round((Date.now()-start)/1000);await mkdir(join(root,'.local/verification'),{recursive:true});await writeFile(join(root,'.local/verification/restore-latest.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(report));
}
