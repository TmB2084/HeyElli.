import {browserServerDiagnostics} from './browser-server-diagnostics.mjs';
import {mergeBrowserReports} from './browser-results.mjs';
import {spawnTestProcess,stopTestProcess} from './test-process.mjs';
import {installReturnBrowserFixture} from '../tests/return-browser-fixture.mjs';
import {installSharePointFixture} from '../tests/sharepoint-fixture.mjs';
import {verificationEnvironment} from './verification-plan.mjs';
// Automatic browser gate: disposable source, database, credentials and browser profiles.
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,cp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {createInterface} from 'node:readline';
import {Pool} from 'pg';
import {prepareTestAdmin} from './test-account.mjs';
const root=process.cwd(),directory=await mkdtemp(join(tmpdir(),'heyelli-browser-auto-')),source=join(directory,'source'),project='heyelli-test-'+randomBytes(6).toString('hex'),password=randomBytes(24).toString('hex');
const artifacts=resolve(process.env.HEYELLI_BROWSER_ARTIFACTS??'.local/verification/browser'),env={...verificationEnvironment(process.env,directory),PLAYWRIGHT_BROWSERS_PATH:process.env.PLAYWRIGHT_BROWSERS_PATH??join(root,'.local/browser-engines'),APP_ENV:'test',NEXT_TELEMETRY_DISABLED:'1',HEYELLI_TEST_POSTGRES_PASSWORD:randomBytes(32).toString('hex'),HEYELLI_TEST_SETTINGS_DIR:join(directory,'settings')};
const manual=process.argv.includes('--manual'),metadata=join(root,'.local/verification/native-'+project+'.json');
const grep=process.argv.find(value=>value.startsWith('--grep='))?.slice(7);
const engine=process.env.HEYELLI_BROWSER_ENGINE;if(engine&&!['chromium','webkit'].includes(engine))throw Error('Unbekannter Prüfbrowser.');const engines=engine?[engine]:['chromium','webkit'];
const mutation=process.argv.find(value=>value.startsWith('--mutation='))?.split('=')[1];if(mutation&&!['navigation','rights'].includes(mutation))throw Error('Unbekannte Prüfstörung.');
let pool,server,started=false,cleaned=false;const serverDiagnostics=browserServerDiagnostics();
function compose(args,capture=false){const result=spawnSync('docker',['compose','--env-file','/dev/null','-f',join(root,'compose.test.yaml'),'-p',project,...args],{env,encoding:'utf8',stdio:capture?'pipe':'inherit'});if(result.status!==0)throw Error('Isolierte Browser-Datenbank nicht verfügbar.');return result.stdout;}
async function cleanup(){if(cleaned)return;cleaned=true;await stopTestProcess(server);await pool?.end();let removed=!started;try{if(started){compose(['down','-v','--remove-orphans']);removed=true;}}finally{await rm(directory,{recursive:true,force:true});if(manual)await rm(metadata,{force:true});await writeFile(join(artifacts,'cleanup.json'),JSON.stringify({status:removed?'passed':'failed',ownServerStopped:true,ownDatabaseAndVolumeRemoved:removed,ownSourceRemoved:true})+'\n');}}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void cleanup().then(()=>process.exit(1)));
try{
 await mkdir(source);await mkdir(env.HEYELLI_TEST_SETTINGS_DIR);await mkdir(artifacts,{recursive:true});for(const name of await readdir(artifacts))if(/^(results\.json|cleanup\.json|(?:chromium|webkit)-(?:[EAK][0-9]+\.png|[a-z-]+\.axe\.json))$/.test(name))await rm(join(artifacts,name),{force:true});
 for(const name of ['src','public','database','package.json','package-lock.json','tsconfig.json','next.config.ts'])await cp(join(root,name),join(source,name),{recursive:true});// Keep installed modules within the isolated root; Turbopack cannot follow an external dependency link.
 await cp(join(root,'node_modules'),join(source,'node_modules'),{recursive:true,verbatimSymlinks:true});await installSharePointFixture(source);await installReturnBrowserFixture(source);
 if(mutation==='navigation'){const file=join(source,'src/apps/servicehub/katalog/example-repository.ts'),content=await readFile(file,'utf8');if(!content.includes('href: "/planboard"'))throw Error('Navigationsstörung nicht einsetzbar.');await writeFile(file,content.replace('href: "/planboard"','href: "/missing-planner"'));}
 started=true;compose(['up','-d','--wait']);const port=compose(['port','db','5432'],true).trim().split(':').at(-1),url=new URL(`postgresql://heyelli_test@127.0.0.1:${port}/heyelli_test`);url.password=env.HEYELLI_TEST_POSTGRES_PASSWORD;env.HEYELLI_TEST_DATABASE_URL=url.href;
 pool=new Pool({connectionString:url.href});for(const file of (await readdir('database/migrations')).filter(n=>/^\d+.*\.sql$/.test(n)).sort())await pool.query(await readFile('database/migrations/'+file,'utf8'));for(const file of ['examples.sql','platform_examples.sql'])await pool.query(await readFile('database/seeds/'+file,'utf8'));await prepareTestAdmin(pool,password);
 await pool.query("CREATE TABLE public.browser_return_fault(id text PRIMARY KEY,mode text NOT NULL)");await pool.query("INSERT INTO public.browser_return_fault VALUES('central','normal')");
 const mixed='ad:'+randomUUID(),admin='local-service-user';await pool.query("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktive gemischte Rechte','dispatcher',true)",[mixed]);const role='browser-'+randomUUID();await pool.query("INSERT INTO platform.app_roles(id,name,base_role,apps,write_apps) VALUES($1,'Fiktive gemischte Rechte','dispatcher',$2::jsonb,$3::jsonb)",[role,JSON.stringify(['/servicehub','/planboard','/benutzerkonto','/hilfe']),JSON.stringify(mutation==='rights'?['/servicehub','/planboard']:['/servicehub'])]);await pool.query('UPDATE platform.users SET app_role_id=$1 WHERE id=$2',[role,mixed]);
 const {openOrderStore}=await import('../src/platform/pds/simulator/order-store.ts'),{SimulatedPdsApi}=await import('../src/platform/pds/simulator/api.ts'),{PdsCalendar}=await import('../src/platform/pds/api/calendar.ts');const store=openOrderStore(join(source,'.local/pds-simulator/development.sqlite'));const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date());
 try{for(const[title,res,hour]of [['Browser Alpha','sim-employee-1','08'],['Browser Beta','sim-employee-2','10']])await new PdsCalendar(new SimulatedPdsApi(store,randomUUID())).create({title,notes:'Fiktive ursprüngliche Notiz',start:day+'T'+hour+':00:00Z',end:day+'T'+String(Number(hour)+1).padStart(2,'0')+':00:00Z',resourceIds:[res]});}finally{store.close();}
 const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const webPort=listener.address().port;await new Promise(r=>listener.close(r));const base=`http://127.0.0.1:${webPort}`;
 const fixture=join(directory,'fixture.json');await writeFile(fixture,JSON.stringify({base,username:'service',password,database:url.href,admin,mixed,day,simulatorDatabase:join(source,'.local/pds-simulator/development.sqlite')}),{mode:0o600});
 // No debug logs/traces with credentials. Only sanitized reporter artifacts survive.
 server=spawnTestProcess(process.execPath,[resolve('node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(webPort)],{cwd:source,env,stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',chunk=>serverDiagnostics.record('stdout',chunk));server.stderr.on('data',chunk=>serverDiagnostics.record('stderr',chunk));
 let ready=false;for(let n=0;n<160;n++){if(server.exitCode!==null)throw Error('Browser-Prüfserver beendet.');try{if((await fetch(base+'/api/simulator-session',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}if(!ready)throw Error('Browser-Prüfserver nicht bereit.');
 if(manual){await mkdir(join(root,'.local/verification'),{recursive:true});await writeFile(metadata,JSON.stringify({base,fixture,project}),{mode:0o600});console.log(JSON.stringify({ready:true,base,metadata}));const lines=createInterface({input:process.stdin});for await(const line of lines)if(line.trim()==='stop')break;lines.close();}else{
 const browserEnv={...env,HEYELLI_BROWSER_FIXTURE_FILE:fixture,HEYELLI_BROWSER_ARTIFACTS:artifacts,HEYELLI_BROWSER_TEMP_DIR:join(directory,'playwright-results')};
 const selected=mutation?['chromium']:engines,parts=[];
 const installed=spawnSync(process.execPath,['node_modules/playwright/cli.js','install',...(process.platform==='linux'&&process.env.HEYELLI_BROWSER_SYSTEM_DEPS!=='installed'?['--with-deps']:[]),...selected],{env:browserEnv,stdio:'inherit',timeout:300000});if(installed.status!==0)throw Error('Prüfbrowser konnten nicht installiert werden.');
 for(const engine of selected){
  await rm(join(artifacts,'results.json'),{force:true});
  const result=spawnSync(process.execPath,['node_modules/playwright/cli.js','test','--config=playwright.config.mjs','--project='+engine,...(mutation?['--grep',mutation==='navigation'?'E04 ':'E02 ']:grep?['--grep',grep]:[])],{env:browserEnv,stdio:'inherit',timeout:600000});
  let report;try{report=JSON.parse(await readFile(join(artifacts,'results.json'),'utf8'));}catch{report={status:'failed',cases:[],steps:[]};}
  if(result.status!==0)report.status='failed';parts.push({engine,report});
 }
 await stopTestProcess(server);server=undefined;
 const report=mergeBrowserReports(selected,parts);report.serverDiagnostics=serverDiagnostics.snapshot();if(report.serverDiagnostics.status!=='passed')report.status='failed';console.log('BROWSER_SERVER_REPORT '+JSON.stringify(report.serverDiagnostics));await writeFile(join(artifacts,'results.json'),JSON.stringify(report,null,2)+'\n');if(report.status!=='passed')throw Error('Automatische Browserprüfung fehlgeschlagen.');
 console.log('Browserprüfung abgeschlossen; ausschließlich bereinigte Artefakte: '+artifacts);
 }
}catch(error){console.error(error.message);process.exitCode=1;}finally{await cleanup();}
