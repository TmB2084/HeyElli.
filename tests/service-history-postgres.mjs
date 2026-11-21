import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,cp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {openOrderStore} from '../src/platform/pds/simulator/order-store.ts';
import {serviceRecords} from '../src/platform/pds/simulator/read-services.ts';
import {changeServiceOrder,orderActionVersion} from '../src/platform/pds/simulator/service-actions.ts';
import {planExisting} from '../src/platform/pds/simulator/existing-planning.ts';
import {planningVersion} from '../src/platform/pds/simulator/planning-version.ts';
import {deliverServiceHistory} from '../src/platform/pds/simulator/history-outbox.ts';
export async function checkServiceHistory(pool){
 assert.match(process.env.HEYELLI_TEST_COMPOSE_PROJECT??'',/^heyelli-test-[a-f0-9]+$/);
 const directory=await mkdtemp(join(tmpdir(),'heyelli-history-'));await mkdir(join(directory,'.local/pds-simulator'),{recursive:true});await cp('database/migrations/pds-simulator',join(directory,'database/migrations/pds-simulator'),{recursive:true});const path=join(directory,'.local/pds-simulator/development.sqlite'),actor={id:'history:'+randomUUID(),name:'Fiktive Planerin'};let store=openOrderStore(path),trigger=false;
 try{
  const order=serviceRecords(store).find(o=>o.rootEbene.ebenen.length&&o.rootEbene.ebenen.every(i=>i.hauptmonteurUUID));
  const input={id:order.uuid,expected:orderActionVersion(order),operationId:randomUUID(),action:'mobile'};
  changeServiceOrder(store,actor.id,input,actor.name);assert.equal(store.historyPending().length,1);
  const original=JSON.parse(store.historyPending()[0].payload);
  await pool.query("CREATE FUNCTION public.history_test_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fictional history fault'; END $$");
  await pool.query('CREATE TRIGGER history_test_fault BEFORE INSERT ON platform.calendar_history FOR EACH ROW EXECUTE FUNCTION public.history_test_fault()');trigger=true;
  await assert.rejects(deliverServiceHistory(store,pool));assert.equal(store.historyPending().length,1);
  assert.equal((await pool.query('SELECT count(*)::int n FROM platform.audit_events WHERE actor_id=$1',[actor.id])).rows[0].n,0);
  assert.equal((await pool.query('SELECT count(*)::int n FROM platform.service_history_deliveries WHERE id=$1',[store.historyPending()[0].id])).rows[0].n,0);
  await pool.query('DROP TRIGGER history_test_fault ON platform.calendar_history');await pool.query('DROP FUNCTION public.history_test_fault()');trigger=false;
  store.close();store=openOrderStore(path);assert.equal(changeServiceOrder(store,actor.id,input,actor.name).changed,false);
  // Commit remotely, then simulate losing the local acknowledgement/process.
  await assert.rejects(deliverServiceHistory({...store,historyDelivered(){throw Error('fictional lost acknowledgement');}},pool));
  assert.equal(store.historyPending().length,1);store.close();store=openOrderStore(path);
  await Promise.all([deliverServiceHistory(store,pool),deliverServiceHistory(store,pool)]);assert.equal(store.historyPending().length,0);
  const rows=(await pool.query('SELECT changes,created_at FROM platform.audit_events WHERE actor_id=$1',[actor.id])).rows;assert.equal(rows.length,1);assert.equal(rows[0].created_at.toISOString(),original.at);assert.deepEqual(rows[0].changes,original.changes);
  const history=(await pool.query('SELECT actor_name,created_at FROM platform.calendar_history WHERE actor_id=$1',[actor.id])).rows;assert.equal(history.length,original.events.length);assert.ok(history.every(r=>r.actor_name===actor.name&&r.created_at.toISOString()===original.at));
  // Planning retry preserves intervening edits and does not create another order.
  const orders=serviceRecords(store),unplanned=orders.find(o=>o.rootEbene.ebenen.some(i=>!i.startZeitpunkt)),incident=unplanned.rootEbene.ebenen.find(i=>!i.startZeitpunkt);
  const planning={orderId:unplanned.uuid,incidentId:incident.uuid,expected:planningVersion(incident),appointment:'2026-11-10T08:00',duration:60,technicianId:'sim-employee-1',companionIds:[]};
  planExisting(store,planning,actor);assert.equal(store.historyPending().length,1);assert.equal(planExisting(store,planning,actor).changed,false);assert.equal(store.historyPending().length,1);
  assert.throws(()=>planExisting(store,{...planning,appointment:'2026-11-10T09:00'},actor),/zwischenzeitlich/);
  // Restart the actual observer: delivery must happen without a user retry.
  const server=createServer(socket=>socket.end());server.listen(0,'127.0.0.1');await once(server,'listening');
  const child=spawn(process.execPath,[resolve('scripts/monitor.mjs')],{cwd:directory,env:{PATH:process.env.PATH,HOME:process.env.HOME,APP_ENV:'test',NODE_ENV:'development',HEYELLI_TEST_SETTINGS_DIR:directory,HEYELLI_TEST_DATABASE_URL:process.env.HEYELLI_TEST_DATABASE_URL,HEYELLI_MONITOR_HOST:'127.0.0.1',HEYELLI_MONITOR_PORT:String(server.address().port)},stdio:'ignore'});
  try{const deadline=Date.now()+15000;while(store.historyPending().length&&Date.now()<deadline){assert.equal(child.exitCode,null);await new Promise(r=>setTimeout(r,100));}assert.equal(store.historyPending().length,0);}finally{if(child.exitCode===null){const ended=once(child,'exit');child.kill('SIGTERM');await ended;}await new Promise(r=>server.close(r));}
  assert.equal(child.exitCode,0);assert.equal(serviceRecords(store).length,orders.length);
  assert.equal((await pool.query("SELECT count(*)::int n FROM platform.audit_events WHERE actor_id=$1 AND action='service.planning.updated'",[actor.id])).rows[0].n,1);
  // Failure to enqueue must roll back the business change as well.
  const current=serviceRecords(store).find(o=>o.uuid===order.uuid),command={id:order.uuid,expected:orderActionVersion(current),operationId:randomUUID(),action:'cancel'};
  assert.throws(()=>changeServiceOrder({...store,historyEnqueue(){throw Error('fictional local write failure');}},actor.id,command,actor.name));
  assert.equal(orderActionVersion(serviceRecords(store).find(o=>o.uuid===order.uuid)),orderActionVersion(current));
 }finally{
  if(trigger){await pool.query('DROP TRIGGER history_test_fault ON platform.calendar_history');await pool.query('DROP FUNCTION public.history_test_fault()');}
  store.close();await rm(directory,{recursive:true,force:true});
 }
}
