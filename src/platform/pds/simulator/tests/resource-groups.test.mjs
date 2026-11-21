import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PdsCalendar} from '../../api/calendar.ts';
import {SimulatedPdsApi} from '../api.ts';
import {openOrderStore} from '../order-store.ts';
async function isolated(run){const dir=mkdtempSync(join(tmpdir(),'heyelli-resource-groups-')),store=openOrderStore(join(dir,'test.sqlite'));try{await run(store);}finally{store.close();rmSync(dir,{recursive:true,force:true});}}
test('resource groups and multiple employee memberships use documented APIs without additional view access',()=>isolated(async store=>{
 const calls=[],api=new SimulatedPdsApi(store),calendar=new PdsCalendar({request:async(...args)=>{calls.push(args);return api.request(...args);}});
 const data=await calendar.list('2026-11-02','2026-11-08');assert.equal(data.resourceGroups.length,3);assert.equal(calls.filter(call=>call[1]==='/administration/listressourcengruppen').length,1);assert.ok(!calls.some(call=>call[1].startsWith('/datenansichten/')));
 assert.deepEqual(data.resources.find(resource=>resource.id==='sim-employee-1').groupIds,['sim-group-service','sim-group-heating']);assert.deepEqual(data.resources.find(resource=>resource.id==='sim-employee-3').groupIds,['sim-group-service','sim-group-heating','sim-group-electrical']);assert.ok(!data.resources.some(resource=>resource.id==='sim-employee-4'));
 const heating=data.resources.filter(resource=>resource.groupIds.includes('sim-group-heating'));assert.deepEqual(heating.map(resource=>resource.id),['sim-employee-1','sim-employee-3']);
 const raw=await api.request('GET','/administration/listressourcengruppen');assert.ok(raw.every(group=>Object.keys(group).sort().join(',')==='bezeichnung,uuid'));
}));
test('group rename retains UUID and employee assignment; missing optional label falls back to UUID',()=>isolated(async store=>{
 const api=new SimulatedPdsApi(store),raw=await api.request('GET','/administration/listressourcengruppen'),transport={request:async(method,path,body)=>path==='/administration/listressourcengruppen'?raw.map(group=>group.uuid==='sim-group-heating'?{...group,bezeichnung:'Umbenannte Gruppe'}:group):api.request(method,path,body)};
 const calendar=new PdsCalendar(transport),groups=await calendar.resourceGroups(),resources=await calendar.resources('2026-11-02','2026-11-08');assert.equal(groups.find(group=>group.id==='sim-group-heating').name,'Umbenannte Gruppe');assert.match(resources[0].group,/Umbenannte Gruppe/);assert.ok(resources[0].groupIds.includes('sim-group-heating'));
 assert.deepEqual(await new PdsCalendar({request:async()=>[{uuid:'group-without-label'}]}).resourceGroups(),[{id:'group-without-label',name:'group-without-label'}]);
}));
test('invalid group catalogs and memberships fail instead of silently using views or interpreting first membership as primary',()=>isolated(async store=>{
 for(const values of [null,{},[{uuid:'x'},{uuid:'x'}],[{uuid:''}],[{uuid:42}],[{uuid:'x',bezeichnung:42}]]){const calls=[];await assert.rejects(new PdsCalendar({request:async(method,path)=>{calls.push(path);return values;}}).resourceGroups());assert.deepEqual(calls,['/administration/listressourcengruppen']);}
 const api=new SimulatedPdsApi(store);for(const membership of ['bad',[42],['x','x']])await assert.rejects(new PdsCalendar({request:async(method,path,body)=>{const result=await api.request(method,path,body);return path==='/mitarbeiter/detailsbatch'?result.map((record,index)=>index===0?{...record,ressourcengruppenUUIDs:membership}:record):result;}}).resources('2026-11-02','2026-11-08'),/Zuordnung/);
 await assert.rejects(new PdsCalendar({request:async()=>{throw Error('API denied');}}).resourceGroups(),/API denied/);
}));
