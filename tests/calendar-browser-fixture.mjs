// Disposable UI fixture: real calendar components, fictional data and controllable responses.
// No project .env, database or auth cookies are copied into this application.
import {mkdtemp,cp,symlink,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
const directory=await mkdtemp(join(tmpdir(),'heyelli-calendar-browser-'));
for(const name of ['src','package.json','tsconfig.json','next.config.ts',...(process.argv.includes('--adapter')?['database']:[])])await cp(name,join(directory,name),{recursive:true});
await symlink(resolve('node_modules'),join(directory,'node_modules'),'dir');
const stateFile=join(directory,'fixture-state.json'),logFile=join(directory,'fixture-requests.json');
const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const fixture={permissions:{write:true,admin:true},resources:[{id:'r1',name:'Test Alpha',number:'001',group:'Testgruppe'},{id:'r2',name:'Test Beta',number:'002',group:'Testgruppe'}],events:[{id:'a',title:'Testtermin Alpha',start:day+'T08:00:00Z',end:day+'T09:00:00Z',resourceIds:['r1'],status:'GEPLANT',type:'FREIER',fixed:false,categories:[]},{id:'b',title:'Testtermin Beta',start:day+'T10:00:00Z',end:day+'T11:00:00Z',resourceIds:['r2'],status:'GEPLANT',type:'FREIER',fixed:false,categories:[]}],colors:[{typ:'FREIER',farbe:'#94d9b8'}],colorSource:'simulation'};
await writeFile(stateFile,JSON.stringify({holdReads:false,writes:{},data:fixture}));await writeFile(logFile,'[]');
let source=`import {readFile,writeFile} from 'node:fs/promises';
const stateFile=${JSON.stringify(stateFile)},logFile=${JSON.stringify(logFile)};
async function state(){return JSON.parse(await readFile(stateFile,'utf8'));}
let logQueue=Promise.resolve();function log(event){logQueue=logQueue.then(async()=>{const list=JSON.parse(await readFile(logFile,'utf8'));list.push(event);await writeFile(logFile,JSON.stringify(list));});return logQueue;}
export async function GET(request:Request){const snapshot=await state();await log({method:'GET',phase:'start',url:request.url});while((await state()).holdReads){await new Promise(resolve=>setTimeout(resolve,100));}return Response.json(snapshot.data,{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){const body=await request.json();await log({method:'POST',id:body.id,phase:'start'});while((await state()).writes[body.id]==='hold'){await new Promise(resolve=>setTimeout(resolve,100));}const current=await state();if(current.writes[body.id]==='fail')return Response.json({error:'Gezielter Testfehler'},{status:503});if(current.writes[body.id]==='disconnect')return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{\"incomplete\":'));setTimeout(()=>controller.error(new Error('Gezielter Verbindungsabbruch')),50);}}),{headers:{'Content-Type':'application/json'}});const original=current.data.events.find((event:{id:string})=>event.id===body.id);if(!original||original.start!==body.expected.start||original.end!==body.expected.end||JSON.stringify([...original.resourceIds].sort())!==JSON.stringify([...body.expected.resourceIds].sort())||(body.title!==undefined&&original.title!==body.expected.title)||(body.notes!==undefined&&(original.notes??'')!==body.expected.notes))return Response.json({error:'Der Termin wurde zwischenzeitlich geändert. Bitte neu laden.'},{status:409});const saved={...original,start:body.start,end:body.end,resourceIds:body.resourceIds,...(body.title?{title:body.title}:{}),...(body.notes!==undefined?{notes:body.notes}:{})};current.data.events=current.data.events.map((event:{id:string})=>event.id===body.id?saved:event);await writeFile(stateFile,JSON.stringify(current));await log({method:'POST',id:body.id,phase:'done'});if(current.writes[body.id]==='disconnect-after-save')return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{\"incomplete\":'));setTimeout(()=>controller.error(new Error('Gezielter Antwortverlust nach Speicherung')),50);}}),{headers:{'Content-Type':'application/json'}});return Response.json(saved);}
`;
const databaseFile=join(directory,'retry-test.sqlite'),auditFile=join(directory,'fixture-audit.json');
await writeFile(auditFile,'{}');
if(process.argv.includes('--adapter')){
 const {openOrderStore}=await import('../src/platform/pds/simulator/order-store.ts');
 const {SimulatedPdsApi}=await import('../src/platform/pds/simulator/api.ts');
 const {PdsCalendar}=await import('../src/platform/pds/api/calendar.ts');
 const store=openOrderStore(databaseFile);
 try{
  const calendar=new PdsCalendar(new SimulatedPdsApi(store,'browser-seed'));
  await calendar.create({title:'Browser Retry Alpha',notes:'Original Alpha',start:day+'T08:00:00Z',end:day+'T09:00:00Z',resourceIds:['sim-employee-1']});
  await new PdsCalendar(new SimulatedPdsApi(store,'browser-seed-beta')).create({title:'Browser Retry Beta',notes:'Original Beta',start:day+'T10:00:00Z',end:day+'T11:00:00Z',resourceIds:['sim-employee-2']});
  if(process.argv.includes('--reopen'))await new PdsCalendar(new SimulatedPdsApi(store,'browser-seed-gamma')).create({title:'Browser Unsent Gamma',notes:'Original Gamma',start:day+'T14:00:00Z',end:day+'T15:00:00Z',resourceIds:['sim-employee-3']});
  if(process.argv.includes('--weekends')){
   const today=new Date(day+'T12:00:00Z'),saturday=new Date(today);saturday.setUTCDate(today.getUTCDate()+((6-today.getUTCDay()+7)%7));const sunday=new Date(saturday);sunday.setUTCDate(saturday.getUTCDate()+1);
   for(const [label,date,resource] of [['Samstag',saturday,'sim-employee-1'],['Sonntag',sunday,'sim-employee-2']]){const dateKey=date.toISOString().slice(0,10);await new PdsCalendar(new SimulatedPdsApi(store,'browser-'+label)).create({title:'Wochenendtest '+label,start:dateKey+'T09:00:00Z',end:dateKey+'T10:00:00Z',resourceIds:[resource]});}
  }
  if(process.argv.includes('--weekend-drag')){
   const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+5-((date.getUTCDay()+6)%7+1));const friday=date.toISOString().slice(0,10);
   const {wallInstant,addDays}=await import('../src/apps/planboard/kalender/model.ts');
   for(const [key,title,start,end,allDay] of [['move','Wochenendprüfung Verschieben','08:00','14:00',false],['resize','Wochenendprüfung Verlängern','14:00','16:00',false],['limited','Wochenendprüfung Arbeitszeit','08:00','14:00',false],['edge','Wochenendprüfung Rand verlängern','14:00','16:30',false],['allday','Wochenendprüfung Ganztag','00:00','00:00',true]])await new PdsCalendar(new SimulatedPdsApi(store,'browser-weekend-'+key)).create({title,start:wallInstant(friday+'T'+start),end:wallInstant((allDay?addDays(friday,1):friday)+'T'+end),resourceIds:['sim-employee-1'],options:{allDay}});
  }
 }finally{store.close();}
 source=`import {readFile,writeFile} from 'node:fs/promises';
import {openOrderStore} from '../../../platform/pds/simulator/order-store';
import {SimulatedPdsApi} from '../../../platform/pds/simulator/api';
import {PdsCalendar} from '../../../platform/pds/api/calendar';
import {CalendarError,CalendarConflictError,draftAuthors,fieldValue,mergeLabels,type CalendarEvent} from '../../../apps/planboard/kalender/domain';
const stateFile=${JSON.stringify(stateFile)},logFile=${JSON.stringify(logFile)},databaseFile=${JSON.stringify(databaseFile)},auditFile=${JSON.stringify(auditFile)};
async function state(){return JSON.parse(await readFile(stateFile,'utf8'));}
let logQueue=Promise.resolve();function log(event:unknown){logQueue=logQueue.then(async()=>{const list=JSON.parse(await readFile(logFile,'utf8'));list.push(event);await writeFile(logFile,JSON.stringify(list));});return logQueue;}
function adapter(actor='Alex Beispiel'){const store=openOrderStore(databaseFile),transport=new SimulatedPdsApi(store,'browser-retry');return {store,calendar:new PdsCalendar({request:async(...args:Parameters<SimulatedPdsApi['request']>)=>{if(['/termin/update','/service/updatestoerung','/termin/create'].includes(args[1]))await log({method:'PDS-WRITE',path:args[1]});return transport.request(...args);}},{workingTimeView:${process.argv.includes('--weekend-drag')?JSON.stringify('sim_calendar_working_times'):'undefined'},onSaved:async(before:CalendarEvent,after:CalendarEvent)=>{const audit=JSON.parse(await readFile(auditFile,'utf8'));for(const field of Object.keys(mergeLabels) as (keyof typeof mergeLabels)[])if(fieldValue(before,field)!==fieldValue(after,field))audit[after.id+':'+field]={value:fieldValue(after,field),author:{displayName:actor,at:new Date().toISOString(),source:'saved'}};await writeFile(auditFile,JSON.stringify(audit));}})};}
function disconnect(){return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{"incomplete":'));setTimeout(()=>controller.error(new Error('Controlled response loss')),50);}}),{headers:{'Content-Type':'application/json'}});}
export async function GET(request:Request){await log({method:'GET',phase:'start'});const {store,calendar}=adapter();try{const url=new URL(request.url);return Response.json({...await calendar.list(url.searchParams.get('from')!,url.searchParams.get('to')!),permissions:{write:true,admin:true}},{headers:{'Cache-Control':'no-store'}});}finally{store.close();}}
export async function POST(request:Request){const body=await request.json();await log({method:'POST',phase:'start',id:body.id});while((await state()).writes[body.id]==='hold'){await new Promise(resolve=>setTimeout(resolve,100));}const mode=(await state()).writes[body.id];if(mode==='disconnect')return disconnect();const actor=(await state()).actor??'Alex Beispiel';const {store,calendar}=adapter(actor);try{const saved=await calendar.update(body);await log({method:'POST',phase:'acknowledged',id:body.id});if(mode==='disconnect-after-save')return disconnect();return Response.json(saved);}catch(error){let provenance;if(error instanceof CalendarConflictError){const audit=JSON.parse(await readFile(auditFile,'utf8'));provenance={current:Object.fromEntries(error.conflicts.map(field=>{const stamp=audit[error.current.id+':'+field];return [field,stamp?.value===fieldValue(error.current,field)?stamp.author:{displayName:'Unbekannt',at:null,source:'unknown'}];})),mine:draftAuthors(error.conflicts,actor,body.editedAt,new Date().toISOString())};}await log({method:'POST',phase:'error',id:body.id,status:error instanceof CalendarError?error.status:502});return Response.json({error:error instanceof Error?error.message:'Test error',...(error instanceof CalendarConflictError?{current:error.current,conflicts:error.conflicts,provenance}:{})},{status:error instanceof CalendarError?error.status:502});}finally{store.close();}}
`;
}
await writeFile(join(directory,'src/app/api/ressourcenkalender/route.ts'),source);
await writeFile(join(directory,'src/app/api/simulator-session/route.ts'),`export async function GET(){return Response.json({authenticated:true,user:{displayName:'UI Test',role:'admin'},configured:true,mode:'local'});}`);
await writeFile(join(directory,'src/app/api/einstellungen/route.ts'),`export async function GET(){return Response.json({appearance:'dark',version:1,owner:'fixture-owner',defaultAppearance:'dark'});}`);
await writeFile(join(directory,'src/app/api/ressourcenkalender/ressourcenauswahl/route.ts'),`import {readFile,writeFile} from 'node:fs/promises';
const file=${JSON.stringify(stateFile)},defaults={selection:null,showTechnicianBadges:true,limitWorkingHours:false,showTentative:true,showWeekends:true,version:1};
export async function GET(){const state=JSON.parse(await readFile(file,'utf8'));return Response.json({...defaults,...state.preferences,owner:'fixture-owner',displayName:'UI Test'});}
export async function POST(request:Request){const body=await request.json(),state=JSON.parse(await readFile(file,'utf8')),current={...defaults,...state.preferences};if(body.owner!=='fixture-owner'||body.expectedVersion!==current.version)return Response.json({error:'Anzeigeeinstellungen wurden zwischenzeitlich geändert.'},{status:409});for(const key of ['selection','showTechnicianBadges','limitWorkingHours','showTentative','showWeekends'])if(body[key]!==undefined)current[key]=body[key];state.preferences={...current,version:current.version+1};await writeFile(file,JSON.stringify(state));return Response.json(state.preferences);}
`);
const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
const child=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:directory,env:{...process.env,APP_ENV:'test',NEXT_TELEMETRY_DISABLED:'1'},stdio:'ignore'});
let stopping=false;
async function stop(){if(stopping)return;stopping=true;if(child.exitCode===null){child.kill('SIGTERM');await once(child,'exit');}await rm(directory,{recursive:true,force:true});process.exit(0);}
process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
for(let i=0;i<120;i++){try{if((await fetch('http://127.0.0.1:'+port+'/api/simulator-session')).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
console.log(JSON.stringify({url:'http://127.0.0.1:'+port+'/planboard',stateFile,logFile,...(process.argv.includes('--adapter')?{databaseFile}:{})}));
