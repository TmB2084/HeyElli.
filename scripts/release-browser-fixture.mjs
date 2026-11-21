// Manual browser smoke test of an exact commit, without changing its application source.
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {createInterface} from 'node:readline';
import {Pool} from 'pg';
import {prepareDevelopmentCache} from './dev-cache.mjs';
import {verificationEnvironment,inspectSnapshot} from './verification-plan.mjs';
import {prepareTestAdmin} from './test-account.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--commit')throw Error('Aufruf: npm run test:browser -- --commit <SHA>');
const revision=spawnSync('git',['rev-parse','--verify',args[1]+'^{commit}'],{cwd:root,encoding:'utf8'});if(revision.status!==0||!/^[a-f0-9]{40,64}$/.test(revision.stdout.trim()))throw Error('Git-Commit nicht verfügbar.');const commit=revision.stdout.trim();
const directory=await mkdtemp(join(tmpdir(),'heyelli-release-browser-')),source=join(directory,'source'),project='heyelli-test-'+randomBytes(5).toString('hex'),password=randomBytes(24).toString('hex'),metadata=join(root,'.local/verification/browser.json');
const env={...verificationEnvironment(process.env,directory),HEYELLI_TEST_POSTGRES_PASSWORD:randomBytes(32).toString('hex')};let pool,server,cacheLease,stopping=false;
function compose(command,capture=false){const result=spawnSync('docker',['compose','--env-file','/dev/null','-f',join(source,'compose.test.yaml'),'-p',project,...command],{env,encoding:'utf8',stdio:capture?'pipe':'inherit'});if(result.status!==0)throw Error('Isolierte Browser-Datenbank nicht verfügbar.');return result.stdout;}
async function stopServer(){if(server&&server.exitCode===null&&server.signalCode===null){const exited=once(server,'exit');server.kill('SIGTERM');await exited;}cacheLease?.release();cacheLease=null;}
async function cleanup(){if(stopping)return;stopping=true;await stopServer();await pool?.end();try{compose(['down','-v','--remove-orphans']);}finally{await rm(directory,{recursive:true,force:true});await rm(metadata,{force:true});}}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void cleanup().then(()=>process.exit(0)));
try{
 await mkdir(source);const archive=spawnSync('git',['archive','--format=tar',commit],{cwd:root,maxBuffer:256*1024*1024});if(archive.status!==0)throw Error('Git-Export fehlgeschlagen.');if(spawnSync('tar',['-xf','-','-C',source],{input:archive.stdout}).status!==0)throw Error('Git-Export nicht lesbar.');await inspectSnapshot(source);
 if(spawnSync('npm',['ci','--no-fund'],{cwd:source,env,stdio:'inherit'}).status!==0)throw Error('Frische Paketinstallation fehlgeschlagen.');compose(['up','-d','--wait']);const port=compose(['port','db','5432'],true).trim().split(':').at(-1),db=new URL(`postgresql://heyelli_test@127.0.0.1:${port}/heyelli_test`);db.password=env.HEYELLI_TEST_POSTGRES_PASSWORD;pool=new Pool({connectionString:db.href});
 await pool.query('CREATE TABLE schema_migrations(name text PRIMARY KEY,checksum text NOT NULL)');for(const name of (await readdir(join(source,'database/migrations'))).filter(n=>/^\d+_[a-z0-9_]+\.sql$/.test(n)).sort()){const sql=await readFile(join(source,'database/migrations',name),'utf8');await pool.query(sql);await pool.query('INSERT INTO schema_migrations VALUES($1,$2)',[name,createHash('sha256').update(sql).digest('hex')]);}for(const name of ['examples.sql','platform_examples.sql'])await pool.query(await readFile(join(source,'database/seeds',name),'utf8'));await prepareTestAdmin(pool,password);
 const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const webPort=listener.address().port;await new Promise(r=>listener.close(r));const base=`http://127.0.0.1:${webPort}`;
 async function start(){cacheLease=await prepareDevelopmentCache(source);server=spawn(process.execPath,[join(source,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(webPort)],{cwd:source,env:{...env,APP_ENV:'test',HEYELLI_TEST_DATABASE_URL:db.href,},stdio:'ignore'});for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error('Prüfserver wurde beendet.');try{if((await fetch(base+'/api/simulator-session',{signal:AbortSignal.timeout(2000)})).ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}throw Error('Prüfserver startet nicht.');}
 await start();await mkdir(dirname(metadata),{recursive:true});await writeFile(metadata,JSON.stringify({base,username:'service',password,commit,project,directory}),{mode:0o600});console.log(JSON.stringify({ready:true,base,commit,metadata}));console.log('Prüfsteuerung: restart oder stop eingeben.');
 const lines=createInterface({input:process.stdin});for await(const line of lines){if(line.trim()==='stop')break;if(line.trim()==='restart'){await stopServer();await start();console.log('Prüfserver neu gestartet; gleiche getrennte Datenbank und Sitzung.');}}lines.close();
}catch{console.error('Isolierte Browserprüfung fehlgeschlagen; keine Zugangsdaten ausgegeben.');process.exitCode=1;}finally{await cleanup();}
