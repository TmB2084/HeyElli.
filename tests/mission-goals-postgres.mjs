import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {goalsStore} from '../src/apps/missioncontrol/goals-store.ts';
import {missionStore} from '../src/apps/missioncontrol/store.ts';
// MissionControl-Ziele: Eingabeprüfung, Versionskonflikt, manuelle Werte, Tageswerte, Zuordnung (ein Ziel je Aufgabe),
// Fokuszeit je Ziel und Erledigt-Protokoll. Alles in einer eigenen Test-Quelle, danach entfernt.
export async function checkMissionGoals(pool){
 const users=(await pool.query('SELECT id FROM platform.users WHERE enabled ORDER BY id LIMIT 2')).rows.map(row=>row.id),store=goalsStore(pool),source='simulator|test-'+randomUUID();
 const base={title:'Aufträge ohne Termin unter 5',metric:'unplanned_orders',direction:'max',target:5,periodFrom:'2026-10-01',periodTo:'2026-12-31'};
 try{
  await assert.rejects(store.save(users[0],source,{...base,title:' '}),/Titel/);
  await assert.rejects(store.save(users[0],source,{...base,metric:'wartungsquote'}),/Kennzahl/);
  await assert.rejects(store.save(users[0],source,{...base,periodTo:'2026-09-01'}),/Ende/);
  await assert.rejects(store.save(users[0],source,{...base,metric:'open_offers'}),/Angebotsstatus/);
  const goal=await store.save(users[0],source,base);assert.deepEqual([goal.metric,goal.target,goal.periodFrom,goal.version],['unplanned_orders',5,'2026-10-01',1]);
  const offers=await store.save(users[0],source,{...base,title:'Angebote',metric:'open_offers',offerStatuses:['sim-order-open','sim-order-open'],offerMinAgeDays:7,target:2});
  assert.deepEqual(offers.offerStatuses,['sim-order-open']);assert.equal(offers.offerMinAgeDays,7);
  const updated=await store.save(users[1],source,{...base,id:goal.id,version:1,target:3});assert.equal(updated.target,3);
  await assert.rejects(store.save(users[0],source,{...base,id:goal.id,version:1,target:4}),error=>error.status===409);
  await assert.rejects(store.manual(users[0],source,goal.id,3),error=>error.status===404,'nur manuelle Ziele');
  const manual=await store.save(users[0],source,{...base,title:'Prüfberichte',metric:'manual',direction:'min',target:11});
  assert.equal((await store.manual(users[0],source,manual.id,6)).manualValue,6);
  await store.record(goal.id,'2026-11-20',4);await store.record(goal.id,'2026-11-21',3);await store.record(goal.id,'2026-11-21',2);
  assert.deepEqual((await store.history([goal.id],'2026-11-01')).get(goal.id),[{day:'2026-11-20',value:4},{day:'2026-11-21',value:2}]);
  await store.link(users[0],source,'pds:t1',goal.id);await store.link(users[0],source,'pds:t1',offers.id);
  assert.equal((await store.links(source)).get('pds:t1'),offers.id,'eine Aufgabe zählt für genau ein Ziel');
  await assert.rejects(store.link(users[0],source,'pds:t2',randomUUID()),error=>error.status===404);
  const mission=missionStore(pool);await mission.start(users[0],source,'pds:t1','Aufgabe 1',25);await mission.stop(users[0]);
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date());
  assert.ok((await store.focusByGoal(source,today,today)).has(offers.id));
  await store.done(users[0],source,'pds:t1','Aufgabe 1');assert.equal((await store.doneBetween(users[0],source,today,today)).length,1);
  await store.archive(users[0],source,goal.id,true);assert.deepEqual((await store.list(source)).map(item=>item.title).sort(),['Angebote','Prüfberichte']);
  await assert.rejects(store.link(users[0],source,'pds:t3',goal.id),error=>error.status===404,'archivierte Ziele nehmen keine Aufgaben an');
  await store.link(users[0],source,'pds:t1',null);assert.equal((await store.links(source)).has('pds:t1'),false);
 }finally{
  await pool.query('DELETE FROM platform.mission_goals WHERE source=$1',[source]);await pool.query('DELETE FROM platform.mission_goal_items WHERE source=$1',[source]);
  await pool.query('DELETE FROM platform.mission_focus WHERE source=$1',[source]);await pool.query('DELETE FROM platform.mission_done WHERE source=$1',[source]);
 }
}
