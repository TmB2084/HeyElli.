import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SimulatedPdsApi} from '../api.ts';
import {openOrderStore} from '../order-store.ts';
import {PdsTasks,taskPayload,readTask,PdsVisits,PdsCalendar} from '../../api/index.ts';
import {ReadonlyPdsTransport} from '../../connection/readonly.ts';
// CRM-Aufgaben und Termine vor Ort nach PDS-OpenAPI (/crm/*, /termin/listplanung + detailsbatch); Simulator mit fiktiven Daten.
const store=()=>openOrderStore(join(mkdtempSync(join(tmpdir(),'pds-crm-')),'t.sqlite'));
test('Aufgaben lesen: Liste ohne Zuweisungen, Details mit Zuweisungen, Typen',async()=>{
 const tasks=new PdsTasks(new SimulatedPdsApi(store()));
 const types=await tasks.types();assert.ok(types.some(type=>type.name==='Rückruf'&&type.standard));
 const open=await tasks.list({status:['OFFEN','IN_BEARBEITUNG','WARTEN']});
 assert.equal(open.truncated,false);assert.ok(open.items.length>=4);assert.ok(open.items.every(item=>item.status!=='ERLEDIGT'&&item.assignments===undefined));
 const detail=await tasks.details('sim-task-1');assert.equal(detail.assignments.length,2);assert.equal(detail.objectId,'sim-object-2');
 const due=await tasks.list({dueBefore:'2026-11-18T00:00:00Z'});assert.deepEqual(due.items.map(item=>item.id).sort(),['sim-task-2','sim-task-6']);
});
test('Aufgaben schreiben: anlegen mit Zuweisung, Status ändern, Zuweisung lösen – idempotent je Workflow',async()=>{
 const shared=store();
 const tasks=new PdsTasks(new SimulatedPdsApi(shared,'user-1:task:abc'));
 const user=await tasks.userForEmployee('sim-employee-2');assert.equal(user,'sim-user-2');
 const created=await tasks.create({subject:'Rückruf Testkunde',objectId:'sim-object-1',personId:'SIM-K-100',typeId:'sim-task-type-1',due:'2026-11-26T09:00:00+01:00'},[user]);
 assert.equal(created.status,'OFFEN');assert.equal(created.assignments.length,1);assert.equal(created.due,'2026-11-26T08:00:00.000Z');
 const again=await new PdsTasks(new SimulatedPdsApi(shared,'user-1:task:abc')).create({subject:'Rückruf Testkunde',objectId:'sim-object-1',personId:'SIM-K-100',typeId:'sim-task-type-1',due:'2026-11-26T09:00:00+01:00'},[user]);
 assert.equal(again.id,created.id,'Wiederholung legt keine zweite Aufgabe an');
 const updated=await new PdsTasks(new SimulatedPdsApi(shared,'user-1:task:upd')).update(created.id,{status:'ERLEDIGT'});assert.equal(updated.status,'ERLEDIGT');
 await new PdsTasks(new SimulatedPdsApi(shared,'user-1:task:rm')).unassign(created.assignments[0].id);
 assert.equal((await tasks.details(created.id)).assignments.length,0);
 await assert.rejects(new PdsTasks(new SimulatedPdsApi(shared)).create({subject:'ohne Workflow'}),/Schreibzugriff/);
});
test('Eingaben werden vor PDS geprüft',()=>{
 assert.throws(()=>taskPayload({subject:' '},true),/Betreff/);
 assert.throws(()=>taskPayload({subject:'x',objectId:'a',projectId:'b'},true),/entweder/);
 assert.throws(()=>taskPayload({subject:'x',status:'ERLEDIGT'},true),/Status/);
 assert.throws(()=>taskPayload({due:'morgen'},false),/Zeitpunkt/);
 assert.throws(()=>readTask({uuid:'x',status:'KAPUTT'}),/status/i);
 assert.deepEqual(taskPayload({subject:' Hallo ',objectId:'o1'},true),{betreff:'Hallo',objektUUID:'o1'});
});
test('Echtes PDS: Aufgaben lesen erlaubt, Aufgaben schreiben gesperrt',async()=>{
 const calls=[];const upstream={async request(method,path){calls.push(path);return path==='/crm/listaufgabentypen'?[]:{totalHitCount:0,resultList:[]};}};
 const tasks=new PdsTasks(new ReadonlyPdsTransport(upstream));
 await tasks.types();await tasks.list();
 await assert.rejects(tasks.create({subject:'x'}),/nur zum Lesen/);
 await assert.rejects(tasks.update('a',{status:'ERLEDIGT'}),/nur zum Lesen/);
 assert.deepEqual(calls,['/crm/listaufgabentypen','/crm/listaufgaben']);
});
test('Termine vor Ort: nur geplante/vorgemerkte Einsätze am Objekt, sortiert, ohne Vergangenheit',async()=>{
 const api=new SimulatedPdsApi(store()),visits=new PdsVisits(api,new PdsCalendar(api));
 const now=new Date('2026-11-21T12:00:00+01:00');
 const west=await visits.upcoming(['sim-object-3','sim-unit-4','sim-unit-5'],now);
 assert.deepEqual(west.map(visit=>visit.start.slice(0,10)),['2026-11-24','2026-12-03','2026-12-14']);
 assert.equal(west[0].status,'GEPLANT');assert.deepEqual(west[0].employeeIds,['sim-employee-2','sim-employee-3']);
 assert.equal(west[1].status,'VORGEMERKT');
 assert.deepEqual(await visits.upcoming([],now),[]);
 const nord=await visits.upcoming(['sim-object-1','sim-unit-1','sim-unit-2'],now);assert.deepEqual(nord.map(visit=>visit.objectId),['sim-unit-2']);
});
