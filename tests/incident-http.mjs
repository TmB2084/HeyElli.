// This script writes only into the named disposable browser fixture.
import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {randomUUID,createHash} from 'node:crypto';import {Pool} from 'pg';
const f=JSON.parse(await readFile('/private/tmp/heyelli-chat-browser.json','utf8'));assert.match(f.project,/^heyelli-chat-browser-/);const db=new URL(f.database);assert.equal(db.hostname,'127.0.0.1');assert.equal(db.pathname,'/heyelli_test');assert.equal(db.username,'heyelli_test');assert.equal(new URL(f.base).hostname,'127.0.0.1');
const pool=new Pool({connectionString:f.database});
const login=await fetch(f.base+'/api/simulator-session',{method:'POST',headers:{'Content-Type':'application/json',Origin:f.base},body:JSON.stringify({password:f.password})});assert.equal(login.status,200);const cookie=login.headers.getSetCookie()[0].split(';')[0];
const input={personId:'sim-person-1',problem:'Fiktiver HTTP-Prüffall',reportedAt:'2026-11-11T10:00',channel:'Telefon',contact:'+49 30 00000001',externalOrderNumber:'',objectId:'sim-object-1',unitId:'sim-unit-1',bauleiterId:'sim-employee-4',technicianId:'sim-employee-1',appointment:'2026-11-16T09:00',appointmentDuration:'60',mobileIssue:true};
async function post(body,key=randomUUID(),withSession=true,origin=f.base){return fetch(f.base+'/api/pds-simulator/orders',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'Idempotency-Key':key,...(withSession?{Cookie:cookie}:{})},body:JSON.stringify(body)});}
try{
 assert.equal((await post(input,randomUUID(),false)).status,401);
 assert.equal((await post(input,randomUUID(),true,'https://example.invalid')).status,403);
 for(const body of [{...input,mobileIssue:'true'},{...input,technicianId:'',appointment:''}])assert.equal((await post(body)).status,400);
 await pool.query("UPDATE platform.users SET role='reader' WHERE id='local-service-user'");assert.equal((await post(input)).status,403);await pool.query("UPDATE platform.users SET role='admin' WHERE id='local-service-user'");
 const key=randomUUID();const responses=await Promise.all(Array.from({length:3},()=>post(input,key)));for(const response of responses)assert.equal(response.status,201);const receipts=await Promise.all(responses.map(response=>response.json()));assert.equal(new Set(receipts.map(row=>row.number)).size,1);assert.ok(receipts.every(row=>row.mobileIssued&&!row.warning));
 const history=(await pool.query("SELECT actor_name,created_at,changes FROM platform.calendar_history WHERE changes->0->>'operationId'=$1",['order-create:local-service-user:'+key])).rows;assert.equal(history.length,1);assert.equal(history[0].changes[0].after,'sim-employee-1');assert.ok(history[0].actor_name);assert.ok(Number.isFinite(Date.parse(history[0].created_at)));
 assert.equal((await post({...input,mobileIssue:false},key)).status,400);
 const offKey=randomUUID(),off=await post({...input,mobileIssue:false},offKey);assert.equal(off.status,201);const offReceipt=await off.json();assert.equal(offReceipt.mobileIssued,false);assert.notEqual(offReceipt.number,receipts[0].number);
 assert.equal((await pool.query("SELECT id FROM platform.calendar_history WHERE changes->0->>'operationId'=$1",['order-create:local-service-user:'+offKey])).rowCount,0);
 const filtered=await (await fetch(f.base+'/api/pds-simulator?resource=orders&objectId=sim-object-1&unitId=sim-unit-2&limit=50',{headers:{Cookie:cookie}})).json();assert.ok(filtered.items.every(row=>row.number!==receipts[0].number));
 const token=decodeURIComponent(cookie.slice(cookie.indexOf('=')+1));await pool.query('UPDATE platform.sessions SET revoked_at=now() WHERE token_hash=$1',[createHash('sha256').update(token).digest('hex')]);assert.equal((await post(input)).status,401);
 console.log('HTTP-Prüfung erfolgreich: 401/403, Ursprung, Validierung, Opt-in/Opt-out, parallele Wiederholung, genau ein Historieneintrag mit Benutzer/Zeitpunkt, TE-Filter und widerrufene Sitzung.');
}finally{await pool.query("UPDATE platform.users SET role='admin' WHERE id='local-service-user'");await pool.end();}
