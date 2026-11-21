import {defaultColorLayouts} from '../color-layout.ts';
const layout=(main)=>Object.fromEntries(Object.keys(defaultColorLayouts()).map(type=>[type,{main,secondary:null}]));
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PdsCalendar} from '../../../../platform/pds/api/calendar.ts';
import {SimulatedPdsApi} from '../../../../platform/pds/simulator/api.ts';
import {openOrderStore} from '../../../../platform/pds/simulator/order-store.ts';
import {createService} from '../../../../platform/pds/api/execute.ts';
import {SimulatedWriteApi} from '../../../../platform/pds/simulator/write-api.ts';
import {eventOptions,eventColor,defaultColorRules,wallInstant,transactionTypes,checkOptions,checkColorRules,optionKey} from '../domain.ts';
import {colorSettingsStore} from '../settings-store.ts';
const start=wallInstant('2026-11-03T08:00'),end=wallInstant('2026-11-03T09:00');
const input={title:'Fiktiver Optionentest',notes:'Nur Testdaten',start,end,resourceIds:['sim-employee-1']};
const change=(old,options,extra={})=>({id:old.id,start:old.start,end:old.end,resourceIds:old.resourceIds,options,expected:{start:old.start,end:old.end,resourceIds:old.resourceIds,options:eventOptions(old)},...extra});
async function isolated(run){const dir=mkdtempSync(join(tmpdir(),'heyelli-options-'));let store=openOrderStore(join(dir,'test.sqlite'));try{await run({dir,store,api:new SimulatedPdsApi(store,'options-write'),reopen(){store.close();store=openOrderStore(join(dir,'test.sqlite'));return new SimulatedPdsApi(store,'options-reopened');}});}finally{store.close();rmSync(dir,{recursive:true,force:true});}}
test('native calendar options and categories persist through create/update and reopening; exact documented DTOs',()=>isolated(async({api,reopen})=>{
 const calls=[];const calendar=new PdsCalendar({request:async(...args)=>{calls.push(args);return api.request(...args);}});
 const created=await calendar.create({...input,options:{status:'FREI',pimSync:true,categories:['sim-category-meeting']}});
 assert.equal(created.status,'FREI');assert.equal(created.pimSync,true);assert.deepEqual(created.categories,['sim-category-meeting']);
 const native=calls.find(args=>args[1]==='/termin/create')[2];assert.equal(native.status,'FREI');assert.equal(native.pimSynchronisation,true);assert.deepEqual(native.kategorienUUIDs,['sim-category-meeting']);assert.equal(native.options,undefined);
 const options={...eventOptions(created),status:'VORGEMERKT',allDay:true,categories:['sim-category-day']};
 const saved=await calendar.update(change(created,options,{start:wallInstant('2026-11-03T00:00'),end:wallInstant('2026-11-05T00:00')}));
 assert.equal(saved.allDay,true);assert.equal(saved.status,'VORGEMERKT');assert.equal(saved.end,wallInstant('2026-11-05T00:00'));
 await assert.rejects(calendar.update(change(created,{status:'GEPLANT'})),e=>e.status===409);
 const rows=await new PdsCalendar(reopen()).list('2026-11-02','2026-11-08');assert.equal(optionKey(eventOptions(rows.events.find(row=>row.id===saved.id))),optionKey(eventOptions(saved)));assert.equal(rows.categoryOptions.length,15);
}));
test('fixation requires a separate unlock, refuses stale snapshots and keeps all other settings',()=>isolated(async({api})=>{
 const calendar=new PdsCalendar(api);let old=await calendar.create({...input,options:{fixed:true,pimSync:true,categories:['sim-category-service']}});
 await assert.rejects(calendar.update(change(old,{status:'FREI'})),e=>e.status===409);
 await assert.rejects(calendar.update(change(old,{fixed:false,status:'FREI'})),/ausschließlich/);
 assert.equal((await calendar.update(change(old,{fixed:false},{expected:{...change(old,{}).expected,start:end}}))).fixed,false); // Already-current time is safe to acknowledge.
 old=await calendar.update(change(old,{fixed:false}));assert.equal(old.fixed,false);assert.equal(old.pimSync,true);assert.deepEqual(old.categories,['sim-category-service']);
 const fixed=await calendar.update(change(old,{fixed:true}));assert.equal(fixed.fixed,true);
}));
test('all supported creation types and transaction links resolve order status and customer through API',()=>isolated(async({store})=>{
 let i=0;
 for(const type of ['FREIER','ABWESENHEIT','PRIVATE_ABWESENHEIT','PROJEKT','VORGANG']){
  const types=type==='VORGANG'?Object.keys(transactionTypes):[undefined];
  for(const referenceType of types){
   const api=new SimulatedPdsApi(store,'type-'+i++),calendar=new PdsCalendar(api);
   const fields=type==='PROJEKT'?{referenceId:'sim-project-1'}:type==='VORGANG'?{referenceType,referenceId:'sim-transaction-'+referenceType.toLowerCase()}:{};
   const saved=await calendar.create({...input,type,...fields});assert.equal(saved.type,type);
   if(type==='VORGANG'||type==='PROJEKT'){assert.equal(saved.link.id,fields.referenceId);assert.ok(saved.orderStatus.name);assert.equal(saved.customer.id,'SIM-K-100');}
  }
 }
 const calendar=new PdsCalendar(new SimulatedPdsApi(store,'references'));
 assert.equal((await calendar.references('AUFTRAG','Beispiel'))[0].id,'sim-transaction-auftrag');assert.equal((await calendar.references('PROJEKT','Nord'))[0].id,'sim-project-1');
 assert.equal((await calendar.references('GUTSCHRIFT','sim-transaction-gutschrift'))[0].id,'sim-transaction-gutschrift');
 await assert.rejects(calendar.references('GUTSCHRIFT','a'.repeat(101)),/100/);
 await assert.rejects(calendar.create({...input,type:'VORGANG',referenceType:'AUFTRAG',referenceId:'sim-transaction-angebot'}));
}));
test('object and address use API references and address response origin matches documented nested shape',()=>isolated(async({api,reopen})=>{
 const calendar=new PdsCalendar(api);const refs=await calendar.references('ANSCHRIFT','Nord');assert.ok(refs.length);
 const address={...refs[0].address,zusatz:'Fiktiver Eingang A'};
 const created=await calendar.create({...input,options:{objectId:'sim-object-1',address}});
 assert.equal(created.address.urPostkommunikationswegUUID,address.urPostkommunikationswegUUID);assert.equal(created.address.zusatz,'Fiktiver Eingang A');assert.ok(created.location);
 const raw=await api.request('POST','/termin/details',{uuid:created.id});assert.equal(raw.anschrift.urPostkommunikationsweg.uuid,address.urPostkommunikationswegUUID);assert.equal(raw.anschrift.urPostkommunikationswegUUID,undefined);
 const saved=await calendar.update(change(created,{address:{...address,zusatz:'Fiktiver Eingang B'}}));assert.equal(saved.address.zusatz,'Fiktiver Eingang B');
 await assert.rejects(calendar.create({...input,options:{address:{urPostkommunikationswegUUID:'not-real'}}}),/nicht gefunden/);
 const persisted=(await new PdsCalendar(reopen()).list('2026-11-02','2026-11-08')).events.find(row=>row.id===saved.id);assert.deepEqual(persisted.address,saved.address);

}));
test('service status determines color before appointment status/category and flags do not alter order/team',()=>isolated(async({store,api})=>{
 const receipt=await createService(new SimulatedWriteApi(store,'options-service'),{customerUUID:'SIM-K-100',objectUUID:'sim-unit-1',description:'Fiktiver Service',externalNumber:'',reportedAt:'2026-11-03T08:00',technicianId:'sim-employee-1',companions:['sim-employee-2'],start,end},'SIM-Serviceauftrag',{pdsUserUUID:'sim-employee-4'});
 const calendar=new PdsCalendar(api);const old=(await calendar.list('2026-11-02','2026-11-08')).events.find(event=>event.link?.id===receipt.uuid);assert.ok(old);
 const saved=await calendar.update(change(old,{status:'FREI',pimSync:true,categories:['sim-category-service']}));
 assert.equal(saved.orderStatus.name,old.orderStatus.name);assert.equal(saved.mainTechnicianId,old.mainTechnicianId);assert.deepEqual(saved.companionTechnicianIds,old.companionTechnicianIds);assert.equal(saved.status,'FREI');
 const rules=[{category:'sim-category-service',farbe:'#ff0000'},{status:'FREI',farbe:'#00ff00'},{orderType:'SERVICEAUFTRAG',orderStatus:saved.orderStatus.id,farbe:'#0000ff'}];assert.equal(eventColor(saved,rules,layout('status')),'#0000ff');assert.equal(eventColor(saved,[{status:'FREI',farbe:'#00ff00'}]),'#ccffcc');
 assert.equal(eventColor({...saved,orderStatus:undefined,link:undefined},rules,layout('category')),'#ff0000');assert.equal(eventColor({...saved,orderStatus:undefined},rules,layout('category')),'#ff0000');
 const order=await api.request('POST','/service/details',{uuid:receipt.uuid});assert.equal(order.rootEbene.ebenen[0].auszufuehrendeArbeiten,'Fiktiver Service');
}));
test('invalid options fail before writing and all-day boundaries use German local dates',()=>isolated(async({api})=>{
 const calendar=new PdsCalendar(api);
 await assert.rejects(calendar.create({...input,options:{categories:['unknown']}}),/Kategorie/);
 await assert.rejects(calendar.create({...input,options:{allDay:true}}),/ganze Tage/);
 await assert.rejects(api.request('POST','/termin/create',{bezeichnung:'Demo',typ:'FREIER',status:'GEPLANT',ganzerTag:true,startZeitpunkt:start,endZeitpunkt:end,mitarbeiterUUIDs:input.resourceIds}),/Tagesgrenzen/);
 await assert.rejects(calendar.create({...input,start:'2026-11-02T23:00:30.000Z',end:wallInstant('2026-11-04T00:00'),options:{allDay:true}}),/ganze Tage/);
 assert.throws(()=>checkOptions({pimSync:'true'}));assert.throws(()=>checkOptions({categories:['x','x']}));
 const whole=await calendar.create({...input,start:wallInstant('2026-11-03T00:00'),end:wallInstant('2026-11-04T00:00'),options:{allDay:true}});assert.equal(whole.allDay,true);
}));
test('shared HeyElli colors validate rules, persist independently and reject stale configuration writes',()=>isolated(async({dir})=>{
 const file=join(dir,'colors.json'),settings=colorSettingsStore(file),initial=settings.read();assert.deepEqual(initial.rules,defaultColorRules);
 const saved=settings.write([{orderType:'AUFTRAG',orderStatus:'x',farbe:'#FF0011'},{typ:'FREIER',farbe:'#eeeeee'}],initial.version);assert.equal(saved.rules[0].farbe,'#ff0011');assert.deepEqual(colorSettingsStore(file).read(),saved);
 assert.throws(()=>settings.write([],initial.version),e=>e.status===409);assert.throws(()=>checkColorRules([{status:'FREI',farbe:'red'}]));assert.throws(()=>checkColorRules([{status:'FREI',typ:'FREIER',farbe:'#ffffff'}]));assert.throws(()=>checkColorRules([{status:'FREI',farbe:'#ffffff'},{status:'FREI',farbe:'#000000'}]));
 const event={status:'FREI',type:'ABWESENHEIT',link:{type:'AUFTRAG'},categories:['cat'],orderStatus:{id:'x',name:'Offen'}};assert.equal(eventColor(event,saved.rules,layout('status')),'#ff0011');assert.equal(eventColor({...event,orderStatus:{id:'unknown',name:'Unbekannt'}},saved.rules),'#cad0db');
 const ordered=[{status:'FREI',farbe:'#111111'},{typ:'ABWESENHEIT',farbe:'#222222'},{category:'cat',farbe:'#333333'}];assert.equal(eventColor({...event,orderStatus:undefined},ordered,layout('category')),'#333333');assert.equal(eventColor({...event,orderStatus:undefined,categories:[]},ordered),'#222222');
 // PDS rules precede local rules at the same hierarchy level.
 assert.equal(eventColor(event,[{orderType:'AUFTRAG',orderStatus:'x',farbe:'#123456'},...saved.rules],layout('status')),'#123456');
}));
