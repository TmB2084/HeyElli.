// Disposable browser verification environment; no local .env or development data.
import {spawn,spawnSync} from 'node:child_process';import {randomBytes} from 'node:crypto';import {mkdtemp,cp,readFile,readdir,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {createServer,request as httpRequest} from 'node:http';import {Pool} from 'pg';import {connect} from 'node:net';
import {prepareTestAdmin} from './test-account.mjs';
const realModel=process.env.HEYELLI_BROWSER_REAL_MODEL==='1';
const root=resolve('.'),dir=await mkdtemp(join(tmpdir(),'heyelli-chat-browser-')),project='heyelli-chat-browser-'+randomBytes(5).toString('hex'),password=randomBytes(24).toString('hex'),env={...process.env,HEYELLI_TEST_POSTGRES_PASSWORD:randomBytes(32).toString('hex')};
const args=['compose','--env-file','/dev/null','-f','compose.test.yaml','-p',project];
function compose(command,capture=false){const result=spawnSync('docker',[...args,...command],{cwd:root,env,encoding:'utf8',stdio:capture?'pipe':'inherit'});if(result.status!==0)throw Error('Isolated database unavailable');return result.stdout;}
async function listen(server){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return server.address().port;}
let web,pool,proxy,model;let stopped=false;const held=[];let mode='normal',greetingCount=0;
async function stop(){if(stopped)return;stopped=true;web?.kill('SIGTERM');proxy?.close();model?.close();for(const response of held)response.destroy();await pool?.end();compose(['down','-v','--remove-orphans']);await rm(dir,{recursive:true,force:true});await rm('/private/tmp/heyelli-chat-browser.json',{force:true});process.exit(0);}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void stop());
try{
 compose(['up','-d','--wait']);const dbport=compose(['port','db','5432'],true).trim().split(':').at(-1);const url=new URL(`postgresql://heyelli_test@127.0.0.1:${dbport}/heyelli_test`);url.password=env.HEYELLI_TEST_POSTGRES_PASSWORD;pool=new Pool({connectionString:url.href});
 for(const name of (await readdir('database/migrations')).filter(name=>/^\d+_[a-z0-9_]+\.sql$/.test(name)).sort())await pool.query(await readFile('database/migrations/'+name,'utf8'));
 for(const name of ['examples.sql','platform_examples.sql'])await pool.query(await readFile('database/seeds/'+name,'utf8'));
 await prepareTestAdmin(pool,password);
 for(const name of ['src','public','database','package.json','package-lock.json','tsconfig.json','next.config.ts'])await cp(name,join(dir,name),{recursive:true});await cp(join(root,'node_modules'),join(dir,'node_modules'),{recursive:true,verbatimSymlinks:true});
 model=createServer(async(req,res)=>{if(req.url==='/control'){let body='';for await(const part of req)body+=part;mode=JSON.parse(body).mode;if(mode==='release'){for(const reply of held.splice(0))reply.end(JSON.stringify({message:{content:'Späte Testantwort: Termin mit Doppelklick öffnen.'}}));mode='normal';}res.end('ok');return;}
 let body='';for await(const part of req)body+=part;if(JSON.parse(body).format){greetingCount++;res.end(JSON.stringify({message:{content:JSON.stringify({greeting:'Hallo, ich bin Elli! Welche Bedienungsfrage '+greetingCount+' möchtest du ausprobieren?'})}}));return;}if(mode==='hold'){held.push(res);return;}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({message:{content:'Testantwort: Termin mit Doppelklick öffnen. Dies ist eine isolierte Speicherprüfung.'}}));});const modelport=await listen(model);
 if(!realModel)for(const file of ['server.ts','greeting-server.ts','ollama.ts']){const serverFile=join(dir,'src/apps/askelli/elli',file);await writeFile(serverFile,(await readFile(serverFile,'utf8')).replace('http://127.0.0.1:11434/api/chat',`http://127.0.0.1:${modelport}/api/chat`));}
 const reserve=createServer();const port=await listen(reserve);await new Promise(resolve=>reserve.close(resolve));
 web=spawn(process.execPath,[join(dir,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{cwd:dir,env:{...env,APP_ENV:'test',HEYELLI_TEST_DATABASE_URL:url.href,HEYELLI_TEST_SETTINGS_DIR:join(dir,'.local'),NEXT_TELEMETRY_DISABLED:'1'},stdio:'ignore'});
 for(let i=0;i<120;i++){try{const response=await fetch(`http://127.0.0.1:${port}/api/simulator-session`,{signal:AbortSignal.timeout(1000)});if(response.ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
 proxy=createServer(async(req,res)=>{
  if(req.url==='/__fixture_control'&&req.method==='POST'){let body='';for await(const chunk of req)body+=chunk;const command=JSON.parse(body);mode=command.mode;res.end('ok');return;}
  if(mode==='offline'){req.socket.destroy();return;}
  const drop=mode==='drop-once'&&req.url==='/api/assistent'&&req.method==='POST';if(drop)mode='normal';
  const upstream=httpRequest({hostname:'127.0.0.1',port,path:req.url,method:req.method,headers:req.headers},reply=>{if(drop){reply.resume();reply.on('end',()=>res.destroy());}else{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);}});upstream.on('error',()=>res.destroy());req.pipe(upstream);
 });proxy.on('upgrade',(req,socket,head)=>{const upstream=connect(port,'127.0.0.1',()=>{upstream.write(req.method+' '+req.url+' HTTP/1.1\r\n'+Object.entries(req.headers).map(([key,value])=>key+': '+value).join('\r\n')+'\r\n\r\n');if(head.length)upstream.write(head);socket.pipe(upstream);upstream.pipe(socket);});upstream.on('error',()=>socket.destroy());socket.on('error',()=>upstream.destroy());});const proxyport=await listen(proxy);
 await writeFile('/private/tmp/heyelli-chat-browser.json',JSON.stringify({realModel,base:`http://127.0.0.1:${proxyport}`,model:`http://127.0.0.1:${modelport}`,password,database:url.href,project,directory:dir,pid:process.pid,backend:port}),{mode:0o600});console.log('Isolierte Browserprüfung bereit. Steuerdatei: /private/tmp/heyelli-chat-browser.json');
}catch(error){console.error(error.message);await stop();}
