import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {taskExtrasStore} from '../src/apps/taskhub/store.ts';
// Ergänzungen zu PDS-Aufgaben: Checkliste, Verknüpfungen, Verlauf (neueste zuerst), Konflikterkennung und Audit.
export async function checkTaskExtras(pool){
 const users=(await pool.query('SELECT id FROM platform.users WHERE enabled ORDER BY id LIMIT 2')).rows.map(row=>row.id),store=taskExtrasStore(pool),source='simulator|test-'+randomUUID();
 assert.equal(users.length,2);
 try{
  assert.deepEqual(await store.read(source,'t1'),{checklist:[],links:[],history:[],version:0});
  let extras=await store.change(users[0],'Kim Muster',source,'t1',0,{action:'check-add',text:' Maße aufnehmen '});
  assert.equal(extras.version,1);assert.deepEqual(extras.checklist.map(item=>[item.text,item.done]),[['Maße aufnehmen',false]]);
  await assert.rejects(store.change(users[1],'Robin Demo',source,'t1',0,{action:'check-add',text:'veraltet'}),error=>error.status===409);
  const parallel=await Promise.allSettled([store.change(users[0],'Kim Muster',source,'t1',1,{action:'check-add',text:'A'}),store.change(users[1],'Robin Demo',source,'t1',1,{action:'check-add',text:'B'})]);
  assert.equal(parallel.filter(item=>item.status==='fulfilled').length,1);
  extras=await store.read(source,'t1');assert.equal(extras.version,2);
  extras=await store.change(users[0],'Kim Muster',source,'t1',2,{action:'check-toggle',entryId:extras.checklist[0].id});assert.equal(extras.checklist[0].done,true);
  extras=await store.change(users[0],'Kim Muster',source,'t1',3,{action:'link-add',link:{kind:'mail',id:'m-1',label:'Angebot Speichertausch',href:'/maildesk?id=m-1'}});
  const same=await store.change(users[0],'Kim Muster',source,'t1',4,{action:'link-add',link:{kind:'mail',id:'m-1',label:'Angebot Speichertausch'}});assert.equal(same.version,4,'doppelte Verknüpfung wird nicht erneut gespeichert');
  await assert.rejects(store.change(users[0],'Kim Muster',source,'t1',4,{action:'link-add',link:{kind:'mail',id:'m-2',label:'x',href:'https://example.test'}}),/Verweis/);
  await assert.rejects(store.change(users[0],'Kim Muster',source,'t1',4,{action:'check-add',text:'a'.repeat(201)}),/200 Zeichen/);
  await store.note(users[1],'Robin Demo',source,'t1','Status: ERLEDIGT');
  extras=await store.read(source,'t1');
  assert.equal(extras.version,5);assert.equal(extras.history[0].text,'Status: ERLEDIGT');assert.equal(extras.history[0].actor,'Robin Demo');
  assert.match(extras.history.at(-1).text,/Maße aufnehmen/,'ältester Eintrag zuletzt');
  const counts=await store.counts(source,['t1','t2']);assert.deepEqual(counts.get('t1'),{total:2,done:1});assert.equal(counts.has('t2'),false);
  const audit=(await pool.query("SELECT action FROM platform.audit_events WHERE target_id='t1' AND action LIKE 'tasks.%' ORDER BY id")).rows.map(row=>row.action);
  assert.ok(audit.includes('tasks.check-add')&&audit.includes('tasks.link-add')&&audit.includes('tasks.pds'));
 }finally{await pool.query('DELETE FROM platform.task_extras WHERE source=$1',[source]);}
}
