import {resetFixtureBudget} from './browser/budget-reset.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {resourceBudgets} from '../src/platform/resource-budgets/repository.ts';
import {databaseConfig} from '../src/platform/store/config.ts';
import {BoundedPool} from '../src/platform/resource-budgets/pool.ts';
export async function checkResourceBudgets(pool){
 assert.match(process.env.HEYELLI_TEST_COMPOSE_PROJECT??'',/^heyelli-test-/);const a='quota:'+randomUUID(),b='quota:'+randomUUID(),store=resourceBudgets(pool),releases=[],before=(await pool.query('SELECT * FROM platform.resource_windows WHERE user_id IS NULL')).rows;
 const bounded=new BoundedPool(databaseConfig({...process.env,APP_ENV:'test'}));bounded.on('error',()=>{});
 try{
  await pool.query("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktive Last A','reader',true),($2,'Fiktive Last B','reader',true)",[a,b]);
  const peak=await Promise.allSettled(Array.from({length:32},()=>store.acquire(a,'normal')));for(const result of peak)if(result.status==='fulfilled')releases.push(result.value);assert.equal(releases.length,8);assert.equal(peak.filter(r=>r.status==='rejected'&&r.reason.status===429).length,24);const other=await store.acquire(b,'normal');await other();await Promise.all(releases.splice(0).map(done=>done()));
  const first=await store.acquire(a,'heavy');await assert.rejects(store.acquire(a,'heavy'),e=>e.status===429);const second=await store.acquire(b,'heavy');await assert.rejects(store.acquire(a,'heavy'),e=>e.status===429);await first();await second();
  await pool.query("INSERT INTO platform.resource_windows(scope,user_id,requests) VALUES($1,$2,600) ON CONFLICT(scope) DO UPDATE SET requests=600,window_start=now()",['user:'+a,a]);await assert.rejects(store.acquire(a,'normal'),e=>e.status===429);assert.equal((await pool.query('SELECT count(*)::int n FROM platform.resource_leases WHERE user_id=$1',[a])).rows[0].n,0);await pool.query("UPDATE platform.resource_windows SET window_start=now()-interval '2 minutes' WHERE user_id=$1",[a]);await(await store.acquire(a,'normal'))();
  let failures=0;const recovering=resourceBudgets({connect:()=>pool.connect(),query:(...args)=>{if(failures++===0)return Promise.reject(Error('Fictitious transient release failure'));return pool.query(...args);}});const release=await recovering.acquire(a,'normal');await release();assert.equal(failures,2);
  const client=await bounded.connect();try{assert.equal((await client.query('SHOW statement_timeout')).rows[0].statement_timeout,'10s');assert.equal((await client.query('SHOW lock_timeout')).rows[0].lock_timeout,'1500ms');await assert.rejects(client.query('SELECT pg_sleep(11)'),e=>e.code==='57014');assert.equal((await client.query('SELECT 1 AS value')).rows[0].value,1);}finally{client.release();}
  const holder=await pool.connect();try{await holder.query('BEGIN');await holder.query('SELECT * FROM platform.users WHERE id=$1 FOR UPDATE',[a]);await assert.rejects(bounded.query('UPDATE platform.users SET enabled=enabled WHERE id=$1',[a]),e=>e.code==='55P03');await holder.query('ROLLBACK');}finally{holder.release();}
  const held=await Promise.all(Array.from({length:5},()=>bounded.connect()));const pending=Array.from({length:24},()=>bounded.connect());await assert.rejects(bounded.connect(),e=>e.status===503);held.forEach(c=>c.release());for(const promise of pending)(await promise).release();
  // Prove the previous lock inversion, then verify reset waits before touching rows.
  const left=await pool.connect(),right=await pool.connect();try{
   await left.query('BEGIN');await right.query('BEGIN');
   await left.query("SELECT pg_advisory_xact_lock(hashtextextended('heyelli:request-budget',0))");
   await left.query("UPDATE platform.resource_windows SET requests=requests WHERE scope='global'");
   await right.query('UPDATE platform.resource_windows SET requests=requests WHERE scope=$1',['user:'+a]);
   const oldReset=right.query("UPDATE platform.resource_windows SET requests=0 WHERE scope='global'");
   const normalAdmission=left.query('UPDATE platform.resource_windows SET requests=requests WHERE scope=$1',['user:'+a]);
   const outcomes=await Promise.allSettled([oldReset,normalAdmission]);assert.ok(outcomes.some(r=>r.status==='rejected'&&r.reason.code==='40P01'));
   await left.query('ROLLBACK');await right.query('ROLLBACK');
   await left.query('BEGIN');await left.query("SELECT pg_advisory_xact_lock(hashtextextended('heyelli:request-budget',0))");
   const pid=(await right.query('SELECT pg_backend_pid() AS id')).rows[0].id;
   const resetting=resetFixtureBudget({connect:async()=>({query:(...args)=>right.query(...args),release(){}})});
   try{let waiting=false;for(let n=0;n<100;n++){waiting=(await pool.query("SELECT wait_event='advisory' AS waiting FROM pg_stat_activity WHERE pid=$1",[pid])).rows[0]?.waiting;if(waiting)break;await new Promise(r=>setTimeout(r,10));}assert.equal(waiting,true);
    await left.query('UPDATE platform.resource_windows SET requests=requests WHERE scope=$1',['user:'+a]);
   }finally{await left.query('COMMIT');await resetting;}
   assert.equal((await pool.query('SELECT requests FROM platform.resource_windows WHERE scope=$1',['user:'+a])).rows[0].requests,0);
  }finally{await left.query('ROLLBACK');await right.query('ROLLBACK');left.release();right.release();}
  const samples=[];for(let n=0;n<32;n++){const start=performance.now();await bounded.query('SELECT 1');samples.push(performance.now()-start);}samples.sort((x,y)=>x-y);assert.ok(samples[Math.ceil(samples.length*.95)-1]<1000);
 }finally{await Promise.all(releases.map(done=>done()));await bounded.end();await pool.query('DELETE FROM platform.resource_leases WHERE user_id=ANY($1::text[])',[[a,b]]);await pool.query('DELETE FROM platform.resource_windows WHERE user_id=ANY($1::text[]) OR user_id IS NULL',[[a,b]]);for(const row of before)await pool.query('INSERT INTO platform.resource_windows VALUES($1,$2,$3,$4)',[row.scope,row.user_id,row.window_start,row.requests]);await pool.query('DELETE FROM platform.users WHERE id=ANY($1::text[])',[[a,b]]);}
}
