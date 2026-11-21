import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createSimulatorOrder} from '../../../../platform/pds/simulator/write-gateway.ts';
import {validateOrder} from '../../../../platform/pds/simulator/order-store.ts';
import {createService} from '../../../../platform/pds/api/execute.ts';
import {SimulatedWriteApi} from '../../../../platform/pds/simulator/write-api.ts';
import {openOrderStore} from '../../../../platform/pds/simulator/order-store.ts';
import {SimulatedPdsApi} from '../../../../platform/pds/simulator/api.ts';
import {PdsCalendar} from '../../../../platform/pds/api/calendar.ts';
import {berlinWall,wallInstant,moveEvent,checkChange,checkRange,calendarSlot,checkCreate} from '../domain.ts';
const from='2026-11-02',to='2026-11-08';
const change=(old,updates)=>({id:old.id,start:old.start,end:old.end,resourceIds:old.resourceIds,expected:{start:old.start,end:old.end,resourceIds:old.resourceIds},...updates});
test('calendar reads PDS resources, deduplicates shared appointments, uses explicit color view and persists updates after reopening',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'calendar-'));const file=join(directory,'test.sqlite');let store=openOrderStore(file);
 try{
  const paths=[];let api=new SimulatedPdsApi(store,'calendar-test');let calendar=new PdsCalendar({request:async(...args)=>{paths.push(args[1]);return api.request(...args);}},{colorView:'sim_calendar_colors',simulatedColors:true});
  const data=await calendar.list(from,to);assert.equal(data.resources.length,3);assert.equal(data.events.length,15);assert.equal(data.colorSource,'simulation');assert.equal(data.events.find(event=>event.title.startsWith('Gemeinsamer')).resourceIds.length,2);
  for(const path of ['/mitarbeiter/detailsbatch','/administration/listressourcengruppen','/termin/listplanung','/termin/detailsbatch','/datenansichten/listdaten'])assert.ok(paths.includes(path));
  const old=data.events[0];const start=wallInstant('2026-11-02T09:00'),end=wallInstant('2026-11-02T12:30');
  const saved=await calendar.update(change(old,{start,end,resourceIds:['sim-employee-2'],status:'FREI'}));assert.equal(saved.status,old.status);assert.equal(saved.id,old.id);assert.equal(saved.start,start);assert.deepEqual(saved.resourceIds,['sim-employee-2']);
  assert.deepEqual((await calendar.update(change(old,{start,end}))).resourceIds,['sim-employee-2']); // Unchanged old resources preserve the newer assignment.
  store.close();store=openOrderStore(file);api=new SimulatedPdsApi(store,'calendar-reopened');calendar=new PdsCalendar(api);
  const loaded=await calendar.list(from,to);const persisted=loaded.events.find(event=>event.id===old.id);assert.equal(persisted.start,start);assert.deepEqual(persisted.resourceIds,['sim-employee-2']);assert.equal(store.apiEntities('calendar-event').length,1);assert.equal(loaded.events.length,15);
  const seed=JSON.parse(readFileSync('database/seeds/pds-simulator/calendar.json','utf8'));assert.equal(berlinWall(seed[0].startZeitpunkt),'2026-11-02T08:00');
 }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});
test('fixed appointments and invalid resources are rejected; concurrent stale changes do not overwrite each other in this process',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'calendar-lock-'));const store=openOrderStore(join(directory,'test.sqlite'));
 try{
  const calendar=new PdsCalendar(new SimulatedPdsApi(store,'calendar-lock'));const data=await calendar.list(from,to),old=data.events.find(event=>!event.fixed),fixed=data.events.find(event=>event.fixed);
  await assert.rejects(calendar.update(change(fixed,{start:wallInstant('2026-11-05T10:00')})),error=>error.status===409);
  await assert.rejects(calendar.update(change(old,{resourceIds:['not-a-pds-resource']})),/Ressource/);
  const results=await Promise.allSettled([calendar.update(change(old,{start:wallInstant('2026-11-02T08:15')})),calendar.update(change(old,{start:wallInstant('2026-11-02T08:30')}))]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.find(result=>result.status==='rejected').reason.status,409);
 }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});
test('drag and resize snap to 15 minutes, preserve companion resources, reject duplicate assignments and invalid DST times',()=>{
 const event={id:'test',start:wallInstant('2026-11-02T08:00'),end:wallInstant('2026-11-02T10:00'),resourceIds:['a','b'],fixed:false,allDay:false};
 const moved=moveEvent(event,'move',38,'a','c');assert.equal(berlinWall(moved.start),'2026-11-02T08:45');assert.equal(berlinWall(moved.end),'2026-11-02T10:45');assert.deepEqual(moved.resourceIds,['c','b']);
 assert.equal(berlinWall(moveEvent(event,'start',30,'a','a').start),'2026-11-02T08:30');assert.equal(berlinWall(moveEvent(event,'end',30,'a','a').end),'2026-11-02T10:30');
 assert.throws(()=>moveEvent(event,'move',15,'a','b'));assert.throws(()=>moveEvent(event,'start',120,'a','a'));assert.throws(()=>moveEvent({...event,fixed:true},'move',15,'a','a'));
 assert.throws(()=>wallInstant('2026-03-29T02:30'));assert.throws(()=>wallInstant('2026-10-25T02:30'));
 assert.throws(()=>checkChange(change(event,{end:event.start})));assert.throws(()=>checkRange('2026-02-30','2026-03-01'));
});
test('API failures never fall back to views; colors are explicit fallback without a configured color view',async()=>{
 const calls=[];const calendar=new PdsCalendar({request:async(method,path)=>{calls.push(path);throw new Error('API unauthorized');}},{colorView:'sim_calendar_colors'});
 await assert.rejects(calendar.list(from,to),/unauthorized/);assert.ok(!calls.includes('/datenansichten/list'));
 const directory=mkdtempSync(join(tmpdir(),'calendar-color-'));const store=openOrderStore(join(directory,'test.sqlite'));
 try{const data=await new PdsCalendar(new SimulatedPdsApi(store)).list(from,to);assert.equal(data.colorSource,'fallback');}finally{store.close();rmSync(directory,{recursive:true,force:true});}
});

test('planned service orders appear once in calendar API for main and companions, persist and stay linked when moved',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'calendar-service-')),file=join(directory,'test.sqlite');let store=openOrderStore(file);
 try{
  const input=validateOrder({personId:'sim-person-1',problem:'Kalender-Integration Demo',mobileIssue:true,reportedAt:'2026-11-02T10:00',channel:'Telefon',contact:'030 00000123',externalOrderNumber:'',objectId:'sim-object-1',unitId:'sim-unit-1',bauleiterId:'sim-employee-4',technicianId:'sim-employee-1',companionTechnicianIds:['sim-employee-2'],appointment:'2026-11-03T09:00',appointmentDuration:'90'});
  const user={id:'calendar-service-user',pdsUserUUID:'sim-employee-4'};
  const saved=await createSimulatorOrder(store,input,'calendar-order',user);
  assert.equal((await createSimulatorOrder(store,input,'calendar-order',user)).number,saved.number);
  let api=new SimulatedPdsApi(store,'calendar-write'),calendar=new PdsCalendar(api);
  let data=await calendar.list(from,to),events=data.events.filter(event=>event.title.startsWith(saved.number));
  assert.equal(events.length,1);let event=events[0];assert.equal(event.type,'SERVICEAUFTRAGEBENE');assert.equal(event.mainTechnicianId,'sim-employee-1');assert.deepEqual(event.companionTechnicianIds,['sim-employee-2']);assert.deepEqual(event.resourceIds,['sim-employee-1','sim-employee-2']);assert.equal(berlinWall(event.start),'2026-11-03T09:00');assert.equal(berlinWall(event.end),'2026-11-03T10:30');assert.doesNotMatch(event.notes,/Haupttechniker:|Begleitende Techniker:/);assert.match(event.notes,/Kalender-Integration Demo/);
  const rolePaths=[];
  const reversed=new PdsCalendar({request:async(method,path,body)=>{
    rolePaths.push(path);const result=await api.request(method,path,body);
    if(path==='/termin/detailsbatch')return result.map(row=>({...row,mitarbeiterUUIDs:[...row.mitarbeiterUUIDs].reverse(),text:'Keine Rollennamen im Freitext'}));
    return result;
  }});
  const resolved=(await reversed.list(from,to)).events.find(item=>item.id===event.id);
  assert.deepEqual(resolved.resourceIds,['sim-employee-2','sim-employee-1']);assert.equal(resolved.mainTechnicianId,'sim-employee-1');assert.deepEqual(resolved.companionTechnicianIds,['sim-employee-2']);
  assert.ok(rolePaths.includes('/service/details'));assert.ok(rolePaths.includes('/service/findstoerungtermin'));
  assert.equal(store.apiEntities('calendar-event').length,0); // projection, no duplicate free appointment
  const updated=await calendar.update(change(event,{start:wallInstant('2026-11-03T10:00'),end:wallInstant('2026-11-03T12:00'),resourceIds:['sim-employee-3','sim-employee-2']}));
  assert.doesNotMatch(updated.notes,/Haupttechniker:|Begleitende Techniker:/);assert.equal(updated.mainTechnicianId,'sim-employee-3');assert.deepEqual(updated.companionTechnicianIds,['sim-employee-2']);
  await createSimulatorOrder(store,input,'calendar-order',user);
  assert.equal(berlinWall((await calendar.list(from,to)).events.find(item=>item.id===event.id).start),'2026-11-03T10:00');
  let details=await api.request('POST','/service/details',{uuid:saved.pdsReceipt.uuid});let incident=details.rootEbene.ebenen[0];
  assert.equal(incident.hauptmonteurUUID,'sim-employee-3');assert.deepEqual(incident.weiteremonteureUUIDs,['sim-employee-2']);assert.equal(berlinWall(incident.startZeitpunkt),'2026-11-03T10:00');assert.equal(berlinWall(incident.endZeitpunkt),'2026-11-03T12:00');assert.equal(store.apiEntity(saved.pdsReceipt.uuid).data.mobilAusgegeben,true);
  store.close();store=openOrderStore(file);api=new SimulatedPdsApi(store);calendar=new PdsCalendar(api);
  events=(await calendar.list(from,to)).events.filter(item=>item.title.startsWith(saved.number));assert.equal(events.length,1);assert.equal(events[0].id,event.id);assert.deepEqual(events[0].resourceIds,['sim-employee-3','sim-employee-2']);assert.equal(berlinWall(events[0].end),'2026-11-03T12:00');
  assert.equal((await calendar.list('2026-11-04','2026-11-04')).events.filter(item=>item.id===event.id).length,0);
  const unplanned=await createSimulatorOrder(store,validateOrder({...input,mobileIssue:false,technicianId:'',appointment:'',companionTechnicianIds:[]}), 'unplanned-order',user);
  assert.equal((await calendar.list(from,to)).events.some(item=>item.title.startsWith(unplanned.number)),false);
 }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});
test('existing service plans without end get a marked provisional hour; historical plans include companion resources',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'calendar-history-'));const store=openOrderStore(join(directory,'test.sqlite'));
 try{
  const saved=await createService(new SimulatedWriteApi(store,'old-service'),{customerUUID:'SIM-K-100',objectUUID:'sim-unit-1',description:'Alte Planung',externalNumber:'',reportedAt:'2026-11-02T10:00',technicianId:'sim-employee-1',companions:['sim-employee-2'],start:wallInstant('2026-11-02T09:00')},'SIM-Serviceauftrag',{pdsUserUUID:'sim-employee-4'});
  const calendar=new PdsCalendar(new SimulatedPdsApi(store,'history-update'));
  const old=(await calendar.list(from,to)).events.find(event=>event.title.startsWith(saved.number));assert.match(old.title,/vorläufig 60 Min/);assert.equal(Date.parse(old.end)-Date.parse(old.start),3600000);
  const changed=await calendar.update(change(old,{end:wallInstant('2026-11-02T11:00')}));assert.doesNotMatch(changed.title,/vorläufig/);assert.deepEqual(changed.resourceIds,['sim-employee-1','sim-employee-2']);
  const input=validateOrder({personId:'sim-person-1',problem:'Historisch',reportedAt:'2026-11-02T10:00',channel:'Telefon',contact:'030 00000123',externalOrderNumber:'',objectId:'sim-object-1',unitId:'sim-unit-1',bauleiterId:'sim-employee-4',technicianId:'sim-employee-1',companionTechnicianIds:['sim-employee-2'],appointment:'2026-11-03T09:00'});
  const historical={...input};delete historical.appointmentDuration;const legacy=store.save(historical,'historical','legacy-user');
  const event=(await calendar.list(from,to)).events.find(event=>event.title.startsWith(legacy.number));assert.deepEqual(event.resourceIds,['sim-employee-1','sim-employee-2']);assert.match(event.title,/vorläufig/);
  const moved=await calendar.update(change(event,{start:wallInstant('2026-11-03T12:00'),end:wallInstant('2026-11-03T14:00'),resourceIds:['sim-employee-1','sim-employee-3']}));assert.doesNotMatch(moved.title,/vorläufig/);
  const legacyDetails=await new SimulatedPdsApi(store).request('POST','/service/details',{uuid:'legacy-order-1'});assert.equal(legacyDetails.rootEbene.ebenen[0].hauptmonteurUUID,'sim-employee-1');assert.deepEqual(legacyDetails.rootEbene.ebenen[0].weiteremonteureUUIDs,['sim-employee-3']);assert.equal(berlinWall(legacyDetails.rootEbene.ebenen[0].startZeitpunkt),'2026-11-03T12:00');
  const cleared=await calendar.update({...change(moved,{}),resourceIds:['sim-employee-1'],companionTechnicianIds:[],expected:{...change(moved,{}).expected,mainTechnicianId:'sim-employee-1'}});assert.deepEqual(cleared.companionTechnicianIds,[]);assert.equal(cleared.mainTechnicianId,'sim-employee-1');
  for(const appointmentDuration of ['0','14','16','1441','NaN'])assert.throws(()=>validateOrder({...input,appointmentDuration}));
 }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});

test('companion editing uses the service API, preserves the main technician and supports removing every companion',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'calendar-companions-')),file=join(directory,'test.sqlite');let store=openOrderStore(file);
 try{
  const receipt=await createService(new SimulatedWriteApi(store,'team-create'),{customerUUID:'SIM-K-100',objectUUID:'sim-unit-1',description:'Begleiter bearbeiten',externalNumber:'',reportedAt:'2026-11-03T08:00',technicianId:'sim-employee-1',companions:['sim-employee-2'],start:wallInstant('2026-11-03T09:00'),end:wallInstant('2026-11-03T10:00')},'SIM-Serviceauftrag',{pdsUserUUID:'sim-employee-4'});
  const calls=[];let api=new SimulatedPdsApi(store,'team-update');let calendar=new PdsCalendar({request:async(...args)=>{calls.push(args);return api.request(...args);}});
  const find=async()=> (await calendar.list(from,to)).events.find(event=>event.title.startsWith(receipt.number));
  const edit=(old,companions)=>({...change(old,{}),resourceIds:[old.mainTechnicianId,...companions],companionTechnicianIds:companions,expected:{...change(old,{}).expected,mainTechnicianId:old.mainTechnicianId}});
  let old=await find();calls.length=0;
  let saved=await calendar.update(edit(old,['sim-employee-2','sim-employee-3']));
  assert.equal(saved.mainTechnicianId,'sim-employee-1');assert.deepEqual(saved.companionTechnicianIds,['sim-employee-2','sim-employee-3']);
  assert.ok(!calls.some(call=>call[1]==='/termin/update'));
  assert.deepEqual(calls.find(call=>call[1]==='/service/updatestoerung')[2],{uuid:receipt.stoerungUUID,startZeitpunkt:old.start,endZeitpunkt:old.end,hauptmonteurUUID:'sim-employee-1',weiteremonteureUUIDs:['sim-employee-2','sim-employee-3']});
  await assert.rejects(calendar.update(edit(old,[])),error=>error.status===409);
  await assert.rejects(calendar.update(edit(saved,['sim-employee-1'])),/Ungültig|eindeutig/);
  await assert.rejects(calendar.update(edit(saved,['sim-employee-2','sim-employee-2'])),/Ungültig/);
  await assert.rejects(calendar.update(edit(saved,['unknown'])),/Ressource/);
  await assert.rejects(calendar.update({...edit(saved,[]),expected:{...edit(saved,[]).expected,mainTechnicianId:'sim-employee-2'}}),error=>error.status===409);
  saved=await calendar.update(edit(saved,['sim-employee-3']));assert.deepEqual(saved.resourceIds,['sim-employee-1','sim-employee-3']);
  saved=await calendar.update(edit(saved,[]));assert.deepEqual(saved.resourceIds,['sim-employee-1']);assert.deepEqual(saved.companionTechnicianIds,[]);
  const incident=(await api.request('POST','/service/details',{uuid:receipt.uuid})).rootEbene.ebenen[0];assert.equal(incident.hauptmonteurUUID,'sim-employee-1');assert.deepEqual(incident.weiteremonteureUUIDs,[]);
  store.close();store=openOrderStore(file);api=new SimulatedPdsApi(store,'team-reopened');calendar=new PdsCalendar(api);
  old=await find();assert.deepEqual(old.resourceIds,['sim-employee-1']);assert.equal(old.mainTechnicianId,'sim-employee-1');
  const unavailable=new PdsCalendar({request:async(...args)=>{if(args[1]==='/service/updatestoerung')throw Error('PDS nicht erreichbar');return api.request(...args);}});
  await assert.rejects(unavailable.update(edit(old,['sim-employee-2'])),/nicht erreichbar/);assert.deepEqual((await find()).resourceIds,['sim-employee-1']);
  const fixed=(await calendar.list(from,to)).events.find(event=>event.fixed);await assert.rejects(calendar.update({...edit(fixed,[]),expected:{...edit(fixed,[]).expected,mainTechnicianId:'sim-employee-1'}}));
 }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});

test('explicit main-technician changes preserve companions and refresh H/B roles after reopening',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'calendar-main-')),file=join(directory,'test.sqlite');let store=openOrderStore(file);
 try{
  const receipt=await createService(new SimulatedWriteApi(store,'main-create'),{customerUUID:'SIM-K-100',objectUUID:'sim-unit-1',description:'Haupttechniker wechseln',externalNumber:'',reportedAt:'2026-11-03T08:00',technicianId:'sim-employee-1',companions:['sim-employee-2'],start:wallInstant('2026-11-03T09:00'),end:wallInstant('2026-11-03T10:00')},'SIM-Serviceauftrag',{pdsUserUUID:'sim-employee-4'});
  let api=new SimulatedPdsApi(store,'main-update'),calendar=new PdsCalendar(api);
  const find=async()=>(await calendar.list(from,to)).events.find(event=>event.title.startsWith(receipt.number));
  const edit=(old,main,companions=old.companionTechnicianIds)=>({...change(old,{}),mainTechnicianId:main,companionTechnicianIds:companions,resourceIds:[main,...companions],expected:{...change(old,{}).expected,mainTechnicianId:old.mainTechnicianId}});
  const old=await find();let saved=await calendar.update(edit(old,'sim-employee-3'));
  assert.equal(saved.mainTechnicianId,'sim-employee-3');assert.deepEqual(saved.companionTechnicianIds,['sim-employee-2']);assert.deepEqual(saved.resourceIds,['sim-employee-3','sim-employee-2']);assert.equal(Date.parse(saved.start),Date.parse(old.start));assert.equal(saved.end,old.end);
  assert.equal(saved.notes,"Haupttechniker wechseln");
  assert.equal((await calendar.update(edit(old,'sim-employee-1'))).mainTechnicianId,'sim-employee-3'); // No local role change: preserve the newer main.
  await assert.rejects(calendar.update(edit(saved,'sim-employee-2')));
  await assert.rejects(calendar.update(edit(saved,'sim-employee-4')),/Ressource/);
  // A role swap with unchanged participant membership is a real edit too.
  const swapped=await calendar.update(edit(saved,'sim-employee-2',['sim-employee-3']));assert.equal(swapped.mainTechnicianId,'sim-employee-2');assert.deepEqual(swapped.companionTechnicianIds,['sim-employee-3']);
  const details=await api.request('POST','/service/details',{uuid:receipt.uuid});assert.equal(details.rootEbene.ebenen[0].hauptmonteurUUID,'sim-employee-2');assert.deepEqual(details.rootEbene.ebenen[0].weiteremonteureUUIDs,['sim-employee-3']);
  store.close();store=openOrderStore(file);api=new SimulatedPdsApi(store);calendar=new PdsCalendar(api);
  saved=await find();assert.equal(saved.mainTechnicianId,'sim-employee-2');assert.deepEqual(saved.companionTechnicianIds,['sim-employee-3']);assert.equal(saved.id,old.id);
 }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});

test('general appointments accept multiple resources and persist additions and removals through the calendar API',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'calendar-resources-')),file=join(directory,'test.sqlite');let store=openOrderStore(file);
 try{
  let calendar=new PdsCalendar(new SimulatedPdsApi(store,'resource-edit'));
  let old=(await calendar.list(from,to)).events.find(event=>event.title==='Wartung · Beispielhaus Nord');
  let saved=await calendar.update(change(old,{resourceIds:['sim-employee-1','sim-employee-2','sim-employee-3']}));
  assert.deepEqual(saved.resourceIds,['sim-employee-1','sim-employee-2','sim-employee-3']);assert.equal(saved.mainTechnicianId,undefined);
  saved=await calendar.update(change(saved,{resourceIds:['sim-employee-2','sim-employee-3']}));
  await assert.rejects(calendar.update(change(saved,{resourceIds:[]})));
  await assert.rejects(calendar.update(change(saved,{resourceIds:['sim-employee-2','sim-employee-2']})));
  store.close();store=openOrderStore(file);calendar=new PdsCalendar(new SimulatedPdsApi(store));
  old=(await calendar.list(from,to)).events.find(event=>event.id===saved.id);assert.deepEqual(old.resourceIds,['sim-employee-2','sim-employee-3']);assert.equal(old.start,saved.start);assert.equal(old.end,saved.end);
 }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});

test('new free appointments use documented create, persist and deduplicate repeated simulator requests',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'calendar-create-')),file=join(directory,'test.sqlite');let store=openOrderStore(file);
 try{
  let api=new SimulatedPdsApi(store,'create-request-1');const calls=[];
  let calendar=new PdsCalendar({request:async(...args)=>{calls.push(args);return api.request(...args);}});
  const input={title:' Neuer Demo-Termin ',start:wallInstant('2026-11-03T14:00'),end:wallInstant('2026-11-03T15:00'),resourceIds:['sim-employee-1','sim-employee-3'],notes:'Fiktive Beschreibung',status:'FREI',typ:'SERVICEAUFTRAGEBENE',fix:true};
  const saved=await calendar.create(input);assert.equal(saved.title,'Neuer Demo-Termin');assert.equal(saved.type,'FREIER');assert.equal(saved.status,'GEPLANT');assert.equal(saved.fixed,false);assert.deepEqual(saved.resourceIds,input.resourceIds);assert.equal(saved.notes,input.notes);
  assert.deepEqual(calls.find(call=>call[1]==='/termin/create'),['POST','/termin/create',{bezeichnung:'Neuer Demo-Termin',typ:'FREIER',status:'GEPLANT',startZeitpunkt:input.start,endZeitpunkt:input.end,mitarbeiterUUIDs:input.resourceIds,text:input.notes,ganzerTag:false,fix:false}]);
  assert.equal((await calendar.create(input)).id,saved.id);assert.equal(store.apiEntities('calendar-event').length,1);
  await assert.rejects(calendar.create({...input,title:'Anderer Termin'}),error=>error.status===409);
  store.close();store=openOrderStore(file);api=new SimulatedPdsApi(store,'create-request-1');calendar=new PdsCalendar(api);
  const loaded=(await calendar.list(from,to)).events.find(event=>event.id===saved.id);assert.equal(loaded.title,'Neuer Demo-Termin');assert.deepEqual(loaded.resourceIds,input.resourceIds);assert.equal(loaded.start,input.start);assert.equal((await calendar.create(input)).id,saved.id);assert.equal(store.apiEntities('calendar-event').length,1);
  const another=await new PdsCalendar(new SimulatedPdsApi(store,'create-request-2')).create({...input,title:'Zweiter Termin'});assert.notEqual(another.id,saved.id);
 }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});
test('appointment creation validates input and resources, requires workflow and never falls back to a view',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'calendar-create-invalid-'));const store=openOrderStore(join(directory,'test.sqlite'));
 try{
  const calendar=new PdsCalendar(new SimulatedPdsApi(store,'invalid-create'));
  const input={title:'Demo',start:wallInstant('2026-11-03T14:00'),end:wallInstant('2026-11-03T15:00'),resourceIds:['sim-employee-1'],notes:''};
  for(const patch of [{title:'  '},{title:'a'.repeat(201)},{notes:'a'.repeat(4001)},{notes:42},{start:'wrong'},{end:input.start},{resourceIds:[]},{resourceIds:['sim-employee-1','sim-employee-1']},{resourceIds:['unknown']},{resourceIds:['sim-employee-4']}])await assert.rejects(calendar.create({...input,...patch}));
  assert.equal(store.apiEntities('calendar-event').length,0);
  await assert.rejects(new SimulatedPdsApi(store).request('POST','/termin/create',{bezeichnung:'Demo',typ:'FREIER',status:'GEPLANT',startZeitpunkt:input.start,endZeitpunkt:input.end,mitarbeiterUUIDs:input.resourceIds}),error=>error.status===403);
  const calls=[];const unavailable=new PdsCalendar({request:async(...args)=>{calls.push(args[1]);throw Error('PDS nicht erreichbar');}});
  await assert.rejects(unavailable.create(input),/nicht erreichbar/);assert.ok(!calls.some(path=>path.startsWith('/datenansichten')));
  assert.throws(()=>checkCreate({...input,resourceIds:['x'.repeat(101)]}));
 }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});
test('double-click slot conversion selects date and 15-minute time from a scroll-independent track offset',()=>{
 let slot=calendarSlot('2026-11-02',360,570,'week',7);assert.equal(berlinWall(slot.start),'2026-11-03T14:00');assert.equal(berlinWall(slot.end),'2026-11-03T15:00');
 slot=calendarSlot('2026-11-03',1440,857,'day',1);assert.equal(berlinWall(slot.start),'2026-11-03T14:15');
 slot=calendarSlot('2026-11-01',72,72*4+20,'month',30);assert.equal(berlinWall(slot.start),'2026-11-05T08:00');
 assert.throws(()=>calendarSlot('2026-11-03',360,-1,'week',7));assert.throws(()=>calendarSlot('2026-11-03',360,2520,'week',7));assert.throws(()=>calendarSlot('2026-03-29',1440,150,'day',1));
});

test('deleting a shared appointment removes it from every resource, persists and cannot resurrect via update',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'calendar-delete-')),file=join(directory,'test.sqlite');let store=openOrderStore(file);
 const deletion=event=>({id:event.id,expected:{start:event.start,end:event.end,resourceIds:event.resourceIds}});
 try{
  const calls=[];let api=new SimulatedPdsApi(store,'delete-test'),calendar=new PdsCalendar({request:async(...args)=>{calls.push(args);return api.request(...args);}});
  const shared=(await calendar.list(from,to)).events.find(event=>event.title==='Gemeinsamer Einsatz · Musterwerk');
  await calendar.remove(deletion(shared));assert.deepEqual(calls.find(call=>call[1]==='/termin/delete'),['POST','/termin/delete',{uuid:shared.id}]);
  assert.ok(!(await calendar.list(from,to)).events.some(event=>event.id===shared.id));
  await assert.rejects(calendar.update(change(shared,{start:wallInstant('2026-11-04T10:00')})),error=>error.status===404);
  assert.equal(store.apiEntities('calendar-deletion').length,1);
  store.close();store=openOrderStore(file);api=new SimulatedPdsApi(store,'delete-reopen');calendar=new PdsCalendar(api);
  assert.ok(!(await calendar.list(from,to)).events.some(event=>event.id===shared.id));
  await assert.rejects(api.request('POST','/termin/details',{uuid:shared.id}),error=>error.status===404);
  const seed=JSON.parse(readFileSync('database/seeds/pds-simulator/calendar.json','utf8'));assert.ok(seed.some(event=>event.uuid===shared.id));
  const fixed=(await calendar.list(from,to)).events.find(event=>event.fixed);await assert.rejects(calendar.remove(deletion(fixed)),error=>error.status===409);
  const old=(await calendar.list(from,to)).events.find(event=>!event.fixed);
  const changed=await calendar.update(change(old,{end:new Date(Date.parse(old.end)+15*60000).toISOString()}));
  await assert.rejects(calendar.remove(deletion(old)),error=>error.status===409);
  const unavailable=new PdsCalendar({request:async(...args)=>{if(args[1]==='/termin/delete')throw Error('PDS nicht erreichbar');return api.request(...args);}});
  await assert.rejects(unavailable.remove(deletion(changed)),/nicht erreichbar/);assert.ok((await calendar.list(from,to)).events.some(event=>event.id===changed.id));
  await assert.rejects(new SimulatedPdsApi(store).request('POST','/termin/delete',{uuid:changed.id}),error=>error.status===403);
  await assert.rejects(calendar.remove({id:changed.id,expected:{}}));
  const created=await new PdsCalendar(new SimulatedPdsApi(store,'create-to-delete')).create({title:'Neu zum Löschen',start:wallInstant('2026-11-03T14:00'),end:wallInstant('2026-11-03T15:00'),resourceIds:['sim-employee-1'],notes:''});
  await calendar.remove(deletion(created));assert.ok(!(await calendar.list(from,to)).events.some(item=>item.id===created.id));
 }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});
test('deleting a service appointment preserves the service order and removes its planned times in service API reads',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'calendar-delete-service-'));const store=openOrderStore(join(directory,'test.sqlite'));
 try{
  const receipt=await createService(new SimulatedWriteApi(store,'delete-service-create'),{customerUUID:'SIM-K-100',objectUUID:'sim-unit-1',description:'Fiktiver Löschtest',externalNumber:'',reportedAt:'2026-11-03T08:00',technicianId:'sim-employee-1',companions:['sim-employee-2'],start:wallInstant('2026-11-03T09:00'),end:wallInstant('2026-11-03T10:00')},'SIM-Serviceauftrag',{pdsUserUUID:'sim-employee-4'});
  const api=new SimulatedPdsApi(store,'delete-service'),calendar=new PdsCalendar(api);
  const event=(await calendar.list(from,to)).events.find(item=>item.title.startsWith(receipt.number));
  await calendar.remove({id:event.id,expected:{start:event.start,end:event.end,resourceIds:event.resourceIds}});
  assert.ok(!(await calendar.list(from,to)).events.some(item=>item.id===event.id));
  const service=await api.request('POST','/service/details',{uuid:receipt.uuid});assert.equal(service.vorgangsNummer,receipt.number);assert.equal(service.rootEbene.ebenen[0].startZeitpunkt,undefined);assert.equal(service.rootEbene.ebenen[0].endZeitpunkt,undefined);assert.equal(service.rootEbene.ebenen[0].hauptmonteurUUID,'sim-employee-1');assert.deepEqual(service.rootEbene.ebenen[0].weiteremonteureUUIDs,['sim-employee-2']);assert.equal(store.apiEntity(receipt.uuid).data.mobilAusgegeben,true);
 }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});
test('documented PDS delete accepts empty success responses but rejects HTTP and API errors',async()=>{
 const {PdsHttpTransport}=await import('../../../../platform/pds/api/protocol.ts');
 for(const status of [200,204]){
  const api=new PdsHttpTransport('https://pds.example.invalid/pds/rest/api','synthetic-placeholder',async()=>new Response(null,{status}));
  assert.equal(await api.request('POST','/termin/delete',{uuid:'demo-id'}),undefined);
 }
 const denied=new PdsHttpTransport('https://pds.example.invalid/pds/rest/api','synthetic-placeholder',async()=>new Response(null,{status:403}));await assert.rejects(denied.request('POST','/termin/delete',{uuid:'demo-id'}),/403/);
 const failed=new PdsHttpTransport('https://pds.example.invalid/pds/rest/api','synthetic-placeholder',async()=>Response.json({errorCode:'SIM_FAILED'}));await assert.rejects(failed.request('POST','/termin/delete',{uuid:'demo-id'}),/fachlichen Fehler/);
});


test('appointment title and description update through API and persist, including empty description and stale text conflicts',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'calendar-text-')),file=join(directory,'test.sqlite');let store=openOrderStore(file);
 try{
  let api=new SimulatedPdsApi(store,'text-update'),calendar=new PdsCalendar(api);
  const edit=(old,patch)=>({...change(old,{}),...patch,expected:{...change(old,{}).expected,...('title'in patch?{title:old.title}:{}),...('notes'in patch?{notes:old.notes??''}:{})}});
  const old=(await calendar.list(from,to)).events.find(event=>event.title==='Wartung · Beispielhaus Nord');
  let saved=await calendar.update(edit(old,{title:'  Neuer Kalendertitel  ',notes:'Erste Zeile\nZweite Zeile'}));assert.equal(saved.title,'Neuer Kalendertitel');assert.equal(saved.notes,'Erste Zeile\nZweite Zeile');assert.deepEqual(saved.resourceIds,old.resourceIds);assert.equal(Date.parse(saved.start),Date.parse(old.start));
  await assert.rejects(calendar.update(edit(old,{title:'Veralteter Titel'})),error=>error.status===409);
  await assert.rejects(calendar.update(edit(old,{notes:'Veraltete Beschreibung'})),error=>error.status===409);
  for(const patch of [{title:''},{title:' '},{title:'x'.repeat(201)},{notes:42},{notes:'x'.repeat(4001)}])await assert.rejects(calendar.update(edit(saved,patch)));
  saved=await calendar.update(edit(saved,{notes:''}));assert.equal(saved.notes,'');
  store.close();store=openOrderStore(file);api=new SimulatedPdsApi(store,'text-reopened');calendar=new PdsCalendar(api);
  const loaded=(await calendar.list(from,to)).events.find(event=>event.id===old.id);assert.equal(loaded.title,'Neuer Kalendertitel');assert.equal(loaded.notes,'');
  const fixed=(await calendar.list(from,to)).events.find(event=>event.fixed);await assert.rejects(calendar.update(edit(fixed,{title:'Fixierter Termin'})),error=>error.status===409);
 }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});
test('service appointment text edits preserve order descriptions and roles, and survive subsequent planning changes',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'calendar-service-text-')),file=join(directory,'test.sqlite');let store=openOrderStore(file);
 try{
  const receipt=await createService(new SimulatedWriteApi(store,'text-service-create'),{customerUUID:'SIM-K-100',objectUUID:'sim-unit-1',description:'Ursprüngliche Auftragsbeschreibung',externalNumber:'',reportedAt:'2026-11-03T08:00',technicianId:'sim-employee-1',companions:['sim-employee-2'],start:wallInstant('2026-11-03T09:00'),end:wallInstant('2026-11-03T10:00')},'SIM-Serviceauftrag',{pdsUserUUID:'sim-employee-4'});
  const calls=[];let api=new SimulatedPdsApi(store,'service-text');let calendar=new PdsCalendar({request:async(...args)=>{calls.push(args);return api.request(...args);}});
  const old=(await calendar.list(from,to)).events.find(event=>event.title.startsWith(receipt.number));calls.length=0;
  const patch={...change(old,{}),title:'Serviceeinsatz neu benannt',notes:'Neue Terminbeschreibung',mainTechnicianId:old.mainTechnicianId,companionTechnicianIds:old.companionTechnicianIds,expected:{...change(old,{}).expected,title:old.title,notes:old.notes??'',mainTechnicianId:old.mainTechnicianId}};
  let saved=await calendar.update(patch);assert.equal(saved.title,patch.title);assert.equal(saved.notes,patch.notes);assert.equal(saved.mainTechnicianId,'sim-employee-1');assert.deepEqual(saved.companionTechnicianIds,['sim-employee-2']);
  assert.ok(!calls.some(call=>call[1]==='/service/updatestoerung'));assert.deepEqual(calls.find(call=>call[1]==='/termin/update')[2],{uuid:old.id,bezeichnung:patch.title,text:patch.notes});
  const service=await api.request('POST','/service/details',{uuid:receipt.uuid});assert.equal(service.rootEbene.ebenen[0].auszufuehrendeArbeiten,'Ursprüngliche Auftragsbeschreibung');assert.equal(service.vorgangsNummer,receipt.number);
  saved=await calendar.update({...change(saved,{end:wallInstant('2026-11-03T11:00')}),mainTechnicianId:saved.mainTechnicianId,companionTechnicianIds:saved.companionTechnicianIds,expected:{...change(saved,{}).expected,mainTechnicianId:saved.mainTechnicianId}});assert.equal(saved.title,patch.title);assert.equal(saved.notes,patch.notes);
  store.close();store=openOrderStore(file);api=new SimulatedPdsApi(store,'service-text-reopened');calendar=new PdsCalendar(api);
  saved=(await calendar.list(from,to)).events.find(event=>event.id===old.id);assert.equal(saved.title,patch.title);assert.equal(saved.notes,patch.notes);assert.equal(saved.mainTechnicianId,'sim-employee-1');
  const failing=new PdsCalendar({request:async(...args)=>{if(args[1]==='/termin/update')throw Error('Fiktiver Textfehler');return api.request(...args);}});
  await assert.rejects(failing.update({...change(saved,{end:wallInstant('2026-11-03T12:00')}),notes:'Nicht gespeichert',mainTechnicianId:saved.mainTechnicianId,companionTechnicianIds:saved.companionTechnicianIds,expected:{...change(saved,{}).expected,notes:saved.notes,mainTechnicianId:saved.mainTechnicianId}}),error=>error.status===502&&/Einsatzplanung wurde gespeichert/.test(error.message));
  const partial=(await calendar.list(from,to)).events.find(event=>event.id===saved.id);assert.equal(berlinWall(partial.end),'2026-11-03T12:00');assert.equal(partial.notes,patch.notes);
 }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});

test('Bereitschaft category always saves FREE for creation and edits',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'calendar-duty-status-'));const store=openOrderStore(join(directory,'test.sqlite'));
 try{const calendar=new PdsCalendar(new SimulatedPdsApi(store,'duty-status-test'));const category=(await calendar.categories()).find(item=>item.name==='Bereitschaft');assert.ok(category);const created=await calendar.create({title:'Bereitschaft',start:wallInstant('2027-01-04T07:00'),end:wallInstant('2027-01-11T07:00'),resourceIds:['sim-employee-1'],type:'FREIER',options:{categories:[category.id],status:'GEPLANT'}});assert.equal(created.status,'FREI');const saved=await calendar.update({...change(created,{}),options:{status:'VORGEMERKT'},expected:{...change(created,{}).expected,options:{status:created.status,allDay:created.allDay,fixed:created.fixed,pimSync:created.pimSync,categories:created.categories,objectId:created.objectId??''}}});assert.equal(saved.status,'FREI');assert.equal((await calendar.details(saved.id)).status,'FREI');
 }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});

test('availability guard rejects creates and merged updates before any simulator mutation',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'calendar-availability-')),store=openOrderStore(join(directory,'test.sqlite'));
 try{const api=new SimulatedPdsApi(store,'guard-test'),calendar=new PdsCalendar(api),input={title:'Guard-Test',start:wallInstant('2027-01-04T07:00'),end:wallInstant('2027-01-11T07:00'),resourceIds:['sim-employee-1'],type:'FREIER',options:{categories:[]}},created=await calendar.create(input);let seen;
  const guarded=new PdsCalendar(api,{beforeSave:async proposed=>{seen=proposed;throw Error('Persönliche Sperrwoche');}}),count=store.apiEntities('calendar-event').length;
  await assert.rejects(guarded.checkWriteAvailability(input,true),/Sperrwoche/);await assert.rejects(guarded.create(input),/Sperrwoche/);assert.equal(store.apiEntities('calendar-event').length,count);
  await calendar.update(change(created,{resourceIds:['sim-employee-2']}));
  await assert.rejects(guarded.update({...change(created,{}),title:'Nicht speichern',expected:{...change(created,{}).expected,title:created.title}}),/Sperrwoche/);assert.deepEqual(seen.resourceIds,['sim-employee-2']);assert.equal((await calendar.details(created.id)).title,created.title);
 }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});
