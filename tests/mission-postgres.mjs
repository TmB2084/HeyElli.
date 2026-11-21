import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {missionStore} from '../src/apps/missioncontrol/store.ts';
// MissionControl: Planung (höchstens drei wichtige je Tag), eine laufende Fokussitzung je Benutzer, Notizen nur vom Verfasser löschbar.
export async function checkMissionStore(pool){
 const users=(await pool.query('SELECT id FROM platform.users WHERE enabled ORDER BY id LIMIT 2')).rows.map(row=>row.id),store=missionStore(pool),source='simulator|test-'+randomUUID();
 assert.equal(users.length,2);
 try{
  const day='2026-11-23';
  for(const n of [1,2,3])await store.plan(users[0],source,{itemKey:'pds:t'+n,title:'Aufgabe '+n,day,important:true,position:n});
  await assert.rejects(store.plan(users[0],source,{itemKey:'pds:t4',title:'Aufgabe 4',day,important:true}),error=>error.status===409);
  await store.plan(users[1],source,{itemKey:'pds:t4',title:'Aufgabe 4',day,important:true});
  await assert.rejects(store.plan(users[0],source,{itemKey:'pds:t5',title:'x',important:true}),/Tag/);
  await assert.rejects(store.plan(users[0],source,{itemKey:'kaputt',title:'x',day}),/Ungültige Aufgabe/);
  await assert.rejects(store.plan(users[0],source,{itemKey:'pds:t5',title:'x',day:'23.11.2026'}),/Tag/);
  const moved=await store.plan(users[0],source,{itemKey:'pds:t3',day:'2026-11-24',important:false,estimate:45});
  assert.deepEqual([moved.day,moved.important,moved.estimate,moved.title],['2026-11-24',false,45,'Aufgabe 3']);
  assert.equal(await store.plan(users[0],source,{itemKey:'pds:t3',day:null,estimate:null,position:0}),null,'leere Planung wird entfernt');
  assert.deepEqual((await store.plans(users[0],source)).map(item=>item.itemKey),['pds:t1','pds:t2']);
  const first=await store.start(users[0],source,'pds:t1','Aufgabe 1',25);
  const second=await store.start(users[0],source,'pds:t2','Aufgabe 2',null);
  assert.equal((await store.running(users[0])).id,second.id,'neuer Fokus beendet den vorigen');
  assert.equal((await pool.query('SELECT ended_at IS NOT NULL AS ended FROM platform.mission_focus WHERE id=$1',[first.id])).rows[0].ended,true);
  await assert.rejects(store.start(users[0],source,'pds:t2','Aufgabe 2',2),/Dauer/);
  assert.equal((await store.extend(users[0],10)).plannedMinutes,10);
  const stopped=await store.stop(users[0]);assert.ok(stopped.seconds>=0);assert.equal(await store.running(users[0]),null);
  await assert.rejects(store.extend(users[0],5),error=>error.status===404);
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date());
  assert.ok((await store.seconds(users[0],source,today,today)).every(row=>row.day===today));
  const note=await store.addNote(users[0],'Kim Muster',source,'pds:t1','  Speicher 300 l  ');assert.equal(note.body,'Speicher 300 l');
  await assert.rejects(store.addNote(users[0],'Kim Muster',source,'pds:t1',' '),/2000 Zeichen/);
  assert.equal((await store.noteCounts(source,['pds:t1','pds:t2'])).get('pds:t1'),1);
  await assert.rejects(store.removeNote(users[1],source,note.id),error=>error.status===403);
  await store.removeNote(users[0],source,note.id);assert.deepEqual(await store.notes(source,'pds:t1'),[]);
 }finally{await pool.query('DELETE FROM platform.mission_plan WHERE source=$1',[source]);await pool.query('DELETE FROM platform.mission_focus WHERE source=$1',[source]);await pool.query('DELETE FROM platform.mission_notes WHERE source=$1',[source]);}
}
