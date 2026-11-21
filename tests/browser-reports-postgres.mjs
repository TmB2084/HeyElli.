import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {browserReports} from '../src/platform/http-safety/reports.ts';
export async function checkBrowserReports(pool){
 assert.match(process.env.HEYELLI_TEST_COMPOSE_PROJECT??'',/^heyelli-test-/);const a='browser:'+randomUUID(),b='browser:'+randomUUID(),store=browserReports(pool),report={app:'/servicehub',directive:'script-src-elem',blockedKind:'inline',disposition:'enforce'},before=(await pool.query("SELECT * FROM platform.browser_report_budgets WHERE scope='global'")).rows[0];
 try{
  await pool.query("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktiver Browseradministrator','admin',true),($2,'Fiktiver Browserbenutzer','reader',true)",[a,b]);
  await assert.rejects(store.read(b),e=>e.status===403);await assert.rejects(store.record('missing',[report]),e=>e.status===401);await assert.rejects(store.record(a,[{...report,app:'private-id'}]),e=>e.status===400);
  await Promise.all(Array.from({length:12},()=>store.record(b,[report])));let rows=(await store.read(a)).reports;assert.equal(rows.find(r=>r.app==='/servicehub').occurrences,'12');assert.ok(!JSON.stringify(rows).includes(b));
  for(let n=12;n<60;n+=4)await store.record(b,Array(4).fill(report));await assert.rejects(store.record(b,[report]),e=>e.status===429);assert.equal((await pool.query('SELECT occurrences FROM platform.browser_reports WHERE user_id=$1',[b])).rows[0].occurrences,60);
  await pool.query("UPDATE platform.browser_report_budgets SET window_start=now()-interval '2 minutes' WHERE scope=$1",['user:'+b]);await store.record(b,[report]);assert.equal((await pool.query('SELECT occurrences FROM platform.browser_reports WHERE user_id=$1',[b])).rows[0].occurrences,61);
  await pool.query("UPDATE platform.browser_report_budgets SET accepted=600,window_start=now() WHERE scope='global'");await assert.rejects(store.record(a,[report]),e=>e.status===429);assert.equal((await pool.query('SELECT count(*)::int n FROM platform.browser_reports WHERE user_id=$1',[a])).rows[0].n,0);
  await pool.query('UPDATE platform.users SET enabled=false WHERE id=$1',[b]);await assert.rejects(store.record(b,[report]),e=>e.status===401);
 }finally{await pool.query('DELETE FROM platform.browser_reports WHERE user_id=ANY($1::text[])',[[a,b]]);await pool.query('DELETE FROM platform.browser_report_budgets WHERE scope=ANY($1::text[])',[['user:'+a,'user:'+b,'global']]);if(before)await pool.query('INSERT INTO platform.browser_report_budgets VALUES($1,$2,$3)',[before.scope,before.window_start,before.accepted]);await pool.query('DELETE FROM platform.users WHERE id=ANY($1::text[])',[[a,b]]);}
}
