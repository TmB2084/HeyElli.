import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openOrderStore,validateOrder} from '../../../../platform/pds/simulator/order-store.ts';
import {createSimulatorOrder} from '../../../../platform/pds/simulator/write-gateway.ts';
import {PdsServices} from '../../../../platform/pds/api/services.ts';
import {SimulatedPdsApi} from '../../../../platform/pds/simulator/api.ts';
import {parseCalendarDate,formatCalendarDate} from '../date-input.ts';
const input={personId:'sim-person-1',problem:'Fiktiver Optionsprüffall',reportedAt:'2026-11-11T10:00',channel:'Telefon',contact:'+49 30 00000001',externalOrderNumber:'',objectId:'sim-object-1',unitId:'sim-unit-1',bauleiterId:'sim-employee-4',technicianId:'sim-employee-1',appointment:'2026-11-16T09:00',appointmentDuration:'60'};
const actor={id:'test-actor',pdsUserUUID:'sim-employee-4'};
test('new service mobilization is explicit, validated and idempotent after lost confirmation',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'heyelli-incident-'));let store=openOrderStore(join(dir,'test.sqlite'));
 try{
  assert.equal(validateOrder(input).mobileIssue,false);
  for(const mobileIssue of [true,false]){
   const value=validateOrder({...input,mobileIssue}),key='issue-'+mobileIssue;
   const saved=await createSimulatorOrder(store,value,key,actor);
   assert.equal(store.apiEntity(saved.pdsReceipt.uuid).data.mobilAusgegeben===true,mobileIssue);
   const again=await createSimulatorOrder(store,value,key,actor);assert.equal(saved.number,again.number);
   assert.equal(store.apiEntities('service').length,mobileIssue?1:2);
   await assert.rejects(createSimulatorOrder(store,validateOrder({...input,mobileIssue:!mobileIssue}),key,actor),/andere Daten/);
  }
  for(const mobileIssue of ['true',1,{}])assert.throws(()=>validateOrder({...input,mobileIssue}));
  assert.throws(()=>validateOrder({...input,mobileIssue:true,technicianId:'',appointment:''}),/Haupttechniker/);
  store.close();store=openOrderStore(join(dir,'test.sqlite'));
  const again=await createSimulatorOrder(store,validateOrder({...input,mobileIssue:true}),'issue-true',actor);
  assert.equal(store.apiEntities('service').length,2);assert.equal(store.apiEntity(again.pdsReceipt.uuid).data.mobilAusgegeben,true);
 }finally{store.close();rmSync(dir,{recursive:true});}
});
test('existing orders are filtered by the selected technical unit, with no fallback to sibling units',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'heyelli-unit-orders-')),store=openOrderStore(join(dir,'test.sqlite'));
 try{
  const first=await createSimulatorOrder(store,validateOrder(input),'first',actor);
  const second=await createSimulatorOrder(store,validateOrder({...input,unitId:'sim-unit-2',problem:'Andere technische Einheit'}),'second',actor);
  const service=new PdsServices(new SimulatedPdsApi(store));
  const matches=await service.list('sim-object-1','',0,50,'sim-unit-1');
  assert.ok(matches.items.some(row=>row.number===first.number));assert.ok(!matches.items.some(row=>row.number===second.number));
  const sibling=await service.list('sim-object-1','',0,50,'sim-unit-2');assert.ok(sibling.items.some(row=>row.number===second.number));assert.ok(!sibling.items.some(row=>row.number===first.number));
  await assert.rejects(service.list('sim-object-1','',0,50,'sim-unit-3'),/gehört nicht/);
 }finally{store.close();rmSync(dir,{recursive:true});}
});
test('free-text calendar dates reject invalid and rollover dates and preserve German date order',()=>{
 assert.equal(parseCalendarDate('1.2.2028'),'2028-02-01');assert.equal(parseCalendarDate('29.02.2028'),'2028-02-29');assert.equal(formatCalendarDate('2026-11-16'),'16.11.2026');
 for(const text of ['31.02.2026','29.02.2027','04/05/2026','2026-11-16','32.01.2026','00.01.2026'])assert.equal(parseCalendarDate(text),'');
});
