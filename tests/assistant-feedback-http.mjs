// Run only against the disposable assistant browser fixture, never development.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {Pool} from 'pg';
const f=JSON.parse(await readFile('/private/tmp/heyelli-chat-browser.json','utf8'));
assert.match(f.project,/^heyelli-chat-browser-/);const db=new URL(f.database);assert.equal(db.hostname,'127.0.0.1');assert.equal(db.username,'heyelli_test');assert.equal(db.pathname,'/heyelli_test');assert.equal(new URL(f.base).hostname,'127.0.0.1');
const pool=new Pool({connectionString:f.database});
async function request(path,method='GET',body,authenticated=true,origin=f.base){return fetch(f.base+path,{method,headers:{...(authenticated?{Cookie:cookie}:{}),...(method!=='GET'?{'Content-Type':'application/json',Origin:origin}:{})},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});}
const login=await fetch(f.base+'/api/simulator-session',{method:'POST',headers:{'Content-Type':'application/json',Origin:f.base},body:JSON.stringify({password:f.password})});assert.equal(login.status,200);
const cookie=login.headers.getSetCookie()[0].split(';')[0];
try{
 const chat=await (await request('/api/assistent/verlauf')).json();
 const body={epoch:chat.epoch,turnId:chat.turns[0]?.id??randomUUID(),rating:'down'};
 assert.equal((await request('/api/assistent/bewertungen?review=1','GET',undefined,false)).status,401);
 assert.equal((await request('/api/assistent/bewertungen','POST',body,true,'https://example.invalid')).status,403);
 assert.equal((await request('/api/assistent/bewertungen','POST','x'.repeat(5001))).status,413);
 assert.equal((await request('/api/assistent/bewertungen','POST',{...body,userId:'someone-else'})).status,400);
 for(const role of ['reader','dispatcher']){
  await pool.query('UPDATE platform.users SET role=$1 WHERE id=$2',[role,'local-service-user']);
  for(const method of ['GET','POST','DELETE'])assert.equal((await request('/api/assistent/bewertungen'+(method==='GET'?'?review=1':''),method,method==='GET'?undefined:body)).status,403,role+' '+method);
  const view=await (await request('/api/assistent/verlauf')).json();assert.equal(view.canRate,false);assert.deepEqual(view.feedback,[]);
 }
 await pool.query("UPDATE platform.users SET role='admin' WHERE id='local-service-user'");
 assert.equal((await request('/api/assistent/bewertungen?review=1')).status,200);
 const token=decodeURIComponent(cookie.slice(cookie.indexOf('=')+1));
 await pool.query('UPDATE platform.sessions SET revoked_at=now() WHERE token_hash=$1',[createHash('sha256').update(token).digest('hex')]);
 assert.equal((await request('/api/assistent/bewertungen?review=1')).status,401);
 console.log('Feedback HTTP: Adminzugriff, 401/403, Ursprung, Größenlimit, gefälschter Besitzer und Sitzungswiderruf erfolgreich geprüft.');
}finally{await pool.query("UPDATE platform.users SET role='admin' WHERE id='local-service-user'");await pool.end();}
