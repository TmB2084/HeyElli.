// End-to-end requests against the named disposable fixture and its local Copilot stub.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
const f=JSON.parse(await readFile('/private/tmp/heyelli-chat-browser.json','utf8'));
if(!f.project.startsWith('heyelli-chat-browser-')||new URL(f.database).pathname!=='/heyelli_test'||new URL(f.database).hostname!=='127.0.0.1')throw Error('Isolated fixture required');
const pool=new Pool({connectionString:f.database});let cookie='',checks=0;const secret='fictional-copilot-secret-only-for-isolated-fixture';
async function call(path,body,extra={}){const r=await fetch(f.base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,Origin:f.base,'Content-Type':'application/json',...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});const v=await r.json();return {r,v};}
function check(value,message){assert.ok(value,message);checks++;}
async function admin(body,status=200){const {r,v}=await call('/api/verwaltung/copilot',body);assert.equal(r.status,status,JSON.stringify(v));checks++;return v;}
async function ask(question){const chat=(await call('/api/assistent/verlauf')).v,id=crypto.randomUUID(),{r,v}=await call('/api/assistent',{question,epoch:chat.epoch,id});assert.equal(r.status,200,JSON.stringify(v));check(v.hasAction===true,'expected explicit proposal');const action=(await call('/api/assistent/aktionen?'+new URLSearchParams({epoch:chat.epoch,turn:id}))).v.action;check(action?.state==='pending');return action;}
async function events(){const {r,v}=await call('/api/ressourcenkalender?from=2026-11-09&to=2026-11-23');assert.equal(r.status,200,JSON.stringify(v));return v.events;}
try{
 await pool.query("DELETE FROM platform.assistant_actions WHERE user_id='local-service-user'");await pool.query("DELETE FROM platform.assistant_chats WHERE user_id='local-service-user'");await pool.query("UPDATE platform.copilot_settings SET version=0,enabled=false,config_id=NULL,tested_version=NULL,tested_at=NULL WHERE id='central'");
 check((await pool.query("SELECT enabled,version FROM platform.copilot_settings WHERE id='central'")).rows[0].enabled===false);
 const login=await call('/api/simulator-session',{password:f.password});assert.equal(login.r.status,200);cookie=login.r.headers.getSetCookie().map(v=>v.split(';')[0]).join(';');
 check((await call('/api/assistent/status')).v.provider==='ollama');
 const localChat=(await call('/api/assistent/verlauf')).v;
 for(const question of ['Wer bist du?','Verschiebe meinen Termin auf morgen']){const local=await call('/api/assistent',{question,epoch:localChat.epoch,id:crypto.randomUUID()});check(local.r.ok,JSON.stringify(local.v));check(!local.v.hasAction);}
 check((await pool.query("SELECT count(*)::int AS n FROM platform.assistant_actions WHERE user_id='local-service-user'")).rows[0].n===0);

 await admin({action:'save',version:0,botId:'fixture-bot',secret:'invalid'},400);
 await admin({action:'save',version:0,botId:'fixture-bot',secret});
 let data=await admin();check(data.configured&&!data.settings.enabled&&!JSON.stringify(data).includes(secret));
 await admin({action:'mode',version:data.settings.version,enabled:true,confirm:true},409);
 await admin({action:'test',version:data.settings.version});data=await admin();check(!data.settings.enabled,'test must never release');
 await admin({action:'mode',version:data.settings.version,enabled:true,confirm:true});
 const proposal=await ask('Lege am 2026-11-16 einen freien Termin von 10 bis 11 Uhr bei Alex Beispiel an.');
 check(!(await events()).some(e=>e.title==='Fiktiver Copilot-Prüftermin'),'proposal alone does not write');
 check((await call('/api/assistent/aktionen',{id:proposal.id})).r.status===400);
 check((await call('/api/assistent/aktionen',{id:proposal.id,confirm:true},{Origin:'https://untrusted.invalid'})).r.status===403);
 const parallel=await Promise.all([call('/api/assistent/aktionen',{id:proposal.id,confirm:true}),call('/api/assistent/aktionen',{id:proposal.id,confirm:true})]);
 check(parallel.every(p=>p.r.ok),JSON.stringify(parallel.map(p=>p.v)));
 let rows=(await events()).filter(e=>e.title==='Fiktiver Copilot-Prüftermin');check(rows.length===1,'parallel confirmation must create exactly once');
 check((await call('/api/assistent/aktionen',{id:proposal.id,confirm:true})).v.state==='done');
 check((await events()).filter(e=>e.title==='Fiktiver Copilot-Prüftermin').length===1);
 const cancelled=await ask('Lege am 2026-11-16 einen freien Termin bei Alex Beispiel an.');check((await call('/api/assistent/aktionen',{id:cancelled.id,confirm:false})).v.state==='cancelled');check((await events()).filter(e=>e.title==='Fiktiver Copilot-Prüftermin').length===1);
 const old=rows[0],move=await ask(`Verschiebe ${old.id} am 2026-11-16 bei Alex Beispiel auf den 2026-11-17 um 10 Uhr.`);
 const changed=await call('/api/ressourcenkalender',{id:old.id,start:old.start,end:old.end,resourceIds:old.resourceIds,title:'Zwischenzeitlich geändert',expected:{start:old.start,end:old.end,resourceIds:old.resourceIds,title:old.title}});check(changed.r.ok,JSON.stringify(changed.v));
 check((await call('/api/assistent/aktionen',{id:move.id,confirm:true})).r.status===409,'stale proposal must fail');
 check((await events()).find(e=>e.id===old.id).title==='Zwischenzeitlich geändert');
 const fresh=await ask(`Verschiebe ${old.id} am 2026-11-16 bei Alex Beispiel auf den 2026-11-17 um 10 Uhr.`);const moved=await call('/api/assistent/aktionen',{id:fresh.id,confirm:true});check(moved.v.state==='done',JSON.stringify(moved.v));const event=(await events()).find(e=>e.id===old.id);check(event.start==='2026-11-17T09:00:00.000Z');check(event.title==='Zwischenzeitlich geändert');check(Date.parse(event.end)-Date.parse(event.start)===3600000);
 const order=await call('/api/pds-simulator/orders',{personId:'sim-person-1',problem:'Fiktiver Copilot-Serviceprüffall',reportedAt:'2026-11-11T10:00',channel:'Telefon',contact:'+49 30 00000001',externalOrderNumber:'',objectId:'sim-object-1',unitId:'sim-unit-1',bauleiterId:'sim-employee-4',technicianId:'sim-employee-1',appointment:'2026-11-19T09:00',appointmentDuration:'60',mobileIssue:false},{'Idempotency-Key':crypto.randomUUID()});check(order.r.status===201,JSON.stringify(order.v));
 const service=(await events()).find(e=>e.type==='SERVICEAUFTRAGEBENE'&&e.mainTechnicianId&&e.link?.id&&!e.continuation?.serviceCopy);check(!!service,'service seed required');const mobile=await ask(`Gib ${service.id} am ${service.start.slice(0,10)} einzeln mobil aus.`);const issued=await call('/api/assistent/aktionen',{id:mobile.id,confirm:true});check(issued.v.state==='done',JSON.stringify(issued.v));check((await call('/api/assistent/aktionen',{id:mobile.id,confirm:true})).v.state==='done');
 check((await pool.query("SELECT count(*)::int AS n FROM platform.audit_events WHERE target_id=$1 AND action='copilot.action.done'",[mobile.id])).rows[0].n===1);
 const resetProposal=await ask('Lege am 2026-11-16 einen freien Termin bei Alex Beispiel an.');const chat=(await call('/api/assistent/verlauf')).v;const reset=await fetch(f.base+'/api/assistent/verlauf',{method:'DELETE',headers:{Cookie:cookie,Origin:f.base,'Content-Type':'application/json'},body:JSON.stringify({epoch:chat.epoch})});check(reset.ok);check((await call('/api/assistent/aktionen',{id:resetProposal.id,confirm:true})).r.status===409);
 // A reader can never execute or configure, even when supplied a valid proposal ID.
 await pool.query("UPDATE platform.users SET role='reader' WHERE id='local-service-user'");check((await call('/api/assistent/aktionen',{id:proposal.id,confirm:true})).r.status===403);await admin(undefined,403);await pool.query("UPDATE platform.users SET role='admin' WHERE id='local-service-user'");
 data=await admin();await admin({action:'mode',version:data.settings.version,enabled:false});check((await call('/api/assistent/status')).v.provider==='ollama');
 const seeds=await readFile('database/seeds/platform_examples.sql','utf8');await pool.query(seeds);await pool.query(seeds);check((await pool.query("SELECT enabled FROM platform.copilot_settings WHERE id='central'")).rows[0].enabled===false);
 console.log(`${checks} isolierte Copilot-HTTP-Prüfungen erfolgreich; keine Microsoft-Verbindung.`);
}finally{await pool.query("UPDATE platform.users SET role='admin' WHERE id='local-service-user'");await pool.query("UPDATE platform.copilot_settings SET enabled=false WHERE id='central'");await pool.end();}
