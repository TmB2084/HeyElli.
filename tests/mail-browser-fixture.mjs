import {installMicrosoftBrowserAuthorization} from './microsoft-auth-browser-fixture.mjs';
import {installMailProviderFixture} from './mail-provider-fixture.mjs';
import {mkdtemp,cp,symlink,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {randomBytes} from 'node:crypto';
import {Pool} from 'pg';
const project='heyelli-browser-'+randomBytes(5).toString('hex'),env={...process.env,HEYELLI_TEST_POSTGRES_PASSWORD:randomBytes(32).toString('hex')},args=['compose','--env-file','/dev/null','-f','compose.test.yaml','-p',project];
function compose(values){const result=spawnSync('docker',[...args,...values],{env,encoding:'utf8'});if(result.status!==0)throw Error('Isolated database failed');return result.stdout;}
let child,pool,directory,stopping=false;
async function stop(){if(stopping)return;stopping=true;if(child&&child.exitCode===null){child.kill('SIGTERM');await once(child,'exit');}if(pool)await pool.end();compose(['down','-v','--remove-orphans']);if(directory)await rm(directory,{recursive:true,force:true});process.exit(0);}
process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
try{
 compose(['up','-d','--wait']);const portDB=compose(['port','db','5432']).trim().split(':').at(-1),url=new URL(`postgresql://heyelli_test@127.0.0.1:${portDB}/heyelli_test`);url.password=env.HEYELLI_TEST_POSTGRES_PASSWORD;
 pool=new Pool({connectionString:url.href});for(const name of (await readdir('database/migrations')).filter(name=>/^\d+_[a-z0-9_]+\.sql$/.test(name)).sort())await pool.query(await readFile('database/migrations/'+name,'utf8'));await pool.query(await readFile('database/seeds/platform_examples.sql','utf8'));await pool.query("UPDATE platform.users SET role='admin' WHERE id='local-service-user'");
 directory=await mkdtemp(join(tmpdir(),'heyelli-mail-browser-'));for(const name of ['src','database','package.json','tsconfig.json','next.config.ts'])await cp(name,join(directory,name),{recursive:true});await symlink(resolve('node_modules'),join(directory,'node_modules'),'dir');const proxyPath=join(directory,'src/proxy.ts');await writeFile(proxyPath,(await readFile(proxyPath,'utf8')).replace("path==='/anmeldung'||","path==='/test-login'||path==='/test-microsoft-authorize'||path==='/anmeldung'||"));const modeFile=await installMailProviderFixture(directory);await installMicrosoftBrowserAuthorization(directory,modeFile);const authPath=join(directory,'src/platform/accounts/index.ts');await writeFile(authPath,(await readFile(authPath,'utf8')).replace('const cookieName="service-session";',`const cookieName="${project}-session";`));const settings=join(directory,'.local/test-settings');await mkdir(settings,{recursive:true});
 await mkdir(join(directory,'src/app/test-login'),{recursive:true});await writeFile(join(directory,'src/app/test-login/route.ts'),`import {setSession} from '@/platform/session';export async function GET(request:Request){await setSession({id:'local-service-user',role:'admin',displayName:'Browser Test Admin',mode:'local',pdsUserUUID:'11111111-1111-4111-8111-111111111111'});return Response.redirect(new URL('/verwaltung',request.url));}`);
 const sessionRoute=join(directory,'src/app/api/simulator-session/route.ts');let sessionSource=await readFile(sessionRoute,'utf8');sessionSource="import {readFile} from 'node:fs/promises';\n"+sessionSource.replace('export async function GET()', 'async function originalGet()');sessionSource+=`\nexport async function GET(){const state=JSON.parse(await readFile(${JSON.stringify(modeFile)},'utf8'));if(state.sessionDelayMs)await new Promise(resolve=>setTimeout(resolve,Math.min(4000,state.sessionDelayMs)));return originalGet();}\n`;await writeFile(sessionRoute,sessionSource);
 const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
 child=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:directory,env:{...env,APP_ENV:'test',HEYELLI_TEST_DATABASE_URL:url.href,HEYELLI_TEST_SETTINGS_DIR:settings,NEXT_TELEMETRY_DISABLED:'1'},stdio:'ignore'});
 for(let i=0;i<120;i++){try{if((await fetch(`http://127.0.0.1:${port}/api/simulator-session`)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
 let handledSessionAction='';
 setInterval(async()=>{try{const state=JSON.parse(await readFile(modeFile,'utf8'));if(!state.sessionActionId||state.sessionActionId===handledSessionAction)return;handledSessionAction=state.sessionActionId;if(state.sessionAction==='expire')await pool.query("UPDATE platform.sessions SET expires_at=now()-interval '1 second' WHERE user_id='local-service-user' AND revoked_at IS NULL");if(state.sessionAction==='revoke')await pool.query("UPDATE platform.sessions SET revoked_at=now() WHERE user_id='local-service-user' AND revoked_at IS NULL");if(state.sessionAction==='shorten')await pool.query("UPDATE platform.sessions SET expires_at=now()+interval '5 seconds' WHERE user_id='local-service-user' AND revoked_at IS NULL");console.log(JSON.stringify({sessionAction:state.sessionAction,completed:true}));}catch{}},250);
 console.log(JSON.stringify({url:`http://127.0.0.1:${port}/test-login`,directory,settings,modeFile}));
 setInterval(async()=>{try{const row=(await pool.query('SELECT enabled,test_mode,connection_ok FROM platform.mail_settings')).rows[0];console.log(JSON.stringify({check:'test-mode',...row}));}catch{}},30000);
}catch{console.error('Browser fixture could not start.');await stop();}
