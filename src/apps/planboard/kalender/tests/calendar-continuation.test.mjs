import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PdsCalendar,PdsCalendarContinuation} from '../../../../platform/pds/api/index.ts';
import {SimulatedPdsApi} from '../../../../platform/pds/simulator/api.ts';
import {openOrderStore} from '../../../../platform/pds/simulator/order-store.ts';
import {serviceRecords} from '../../../../platform/pds/simulator/read-services.ts';
import {wallInstant,berlinWall,continuationPlan} from '../domain.ts';
const options={workingTimeView:'sim_calendar_working_times',vacationApprovalView:'sim_calendar_vacation_approvals'};
async function isolated(run){const dir=mkdtempSync(join(tmpdir(),'heyelli-continuation-')),file=join(dir,'test.sqlite');let store=openOrderStore(file);try{await run({store,reopen(){store.close();store=openOrderStore(file);return store;}});}finally{store.close();rmSync(dir,{recursive:true,force:true});}}
const input=()=>({title:'Fortsetzungstest',notes:'Nur fiktive Daten',start:wallInstant('2026-11-04T14:00'),end:wallInstant('2026-11-04T18:00'),resourceIds:['sim-employee-1']});
const calendar=(store,key)=>new PdsCalendar(new SimulatedPdsApi(store,key),options);
test('preview is read-only; confirmed continuation preserves workload and skips pauses and closed days',()=>isolated(async({store,reopen})=>{
 const api=calendar(store,'root'),batch=new PdsCalendarContinuation(api,key=>calendar(store,'part:'+key)),key=randomUUID(),request=input();
 const preview=await batch.handle(request,true,key);assert.ok(preview.preview);assert.equal(store.apiEntities('calendar-event').length,0);
 assert.deepEqual(preview.preview.continuationPlan.segments.map(value=>[berlinWall(value.start),berlinWall(value.end)]),[['2026-11-04T14:00','2026-11-04T15:30'],['2026-11-06T07:00','2026-11-06T09:30']]);assert.equal(preview.preview.continuationPlan.segments.reduce((sum,value)=>sum+value.minutes,0),240);
 const confirmed={...request,continuationChoice:'split',continuationHash:preview.preview.continuationHash,acceptPlanningWarnings:true};const result=await batch.handle(confirmed,true,key);assert.equal(result.saved.continuationEvents.length,2);assert.equal(store.apiEntities('calendar-event').length,2);
 const retry=await batch.handle(confirmed,true,key);assert.deepEqual(retry.saved.continuationEvents.map(value=>value.id),result.saved.continuationEvents.map(value=>value.id));assert.equal(store.apiEntities('calendar-event').length,2);
 const loaded=await calendar(reopen(),'reload').list('2026-11-04','2026-11-06');for(const event of result.saved.continuationEvents){const saved=loaded.events.find(value=>value.id===event.id);assert.equal(saved.continuation.operationId,key);assert.equal(saved.notes,'Nur fiktive Daten');}
}));
test('regular order continuations retain native order identity, with no additional orders',()=>isolated(async({store})=>{
 const api=calendar(store,'orders'),reference=(await api.references('AUFTRAG','Beispiel')).at(0);assert.ok(reference);
 const request={...input(),type:'VORGANG',referenceId:reference.id,referenceType:'AUFTRAG'},batch=new PdsCalendarContinuation(api,key=>calendar(store,key)),key=randomUUID();
 const preview=await batch.handle(request,true,key),result=await batch.handle({...request,continuationChoice:'split',continuationHash:preview.preview.continuationHash,acceptPlanningWarnings:true},true,key);
 for(const event of result.saved.continuationEvents){assert.equal(event.link.id,reference.id);assert.equal(event.type,'VORGANG');}
 assert.equal(store.apiEntities('service').length,0);assert.equal(store.apiEntities('incident').length,0);
}));
test('service continuation uses calendar-only creates, preserves original level and supports independent copy team edits',()=>isolated(async({store})=>{
 const calls=[],transport=new SimulatedPdsApi(store,'service-root'),api=new PdsCalendar({request:async(...args)=>{calls.push(args[1]);return transport.request(...args);}},options),batch=new PdsCalendarContinuation(api,key=>new PdsCalendar({request:async(...args)=>{calls.push(args[1]);return new SimulatedPdsApi(store,key).request(...args);}},options),{allowServiceFreeContinuations:true});
 const source=(await api.list('2026-11-02','2026-11-08')).events.find(event=>event.serviceIncidentId),identities=()=>serviceRecords(store).map(service=>[service.uuid,service.rootEbene.ebenen.map(level=>level.uuid)]),before=identities(),key=randomUUID();
 const request={id:source.id,start:source.start,end:wallInstant(berlinWall(source.start).slice(0,10)+'T18:00'),resourceIds:source.resourceIds,operationId:key,expected:{start:source.start,end:source.end,resourceIds:source.resourceIds}};
 const blocked=await new PdsCalendarContinuation(api,key=>calendar(store,key)).handle(request,false);assert.match(blocked.preview.continuationPlan.reason,/nicht freigegeben/);
 const preview=await batch.handle(request,false);assert.ok(preview.preview.continuationPlan.serviceCopy);const result=await batch.handle({...request,continuationChoice:'split',continuationHash:preview.preview.continuationHash,acceptPlanningWarnings:true},false);assert.deepEqual(identities(),before);
 assert.ok(!calls.some(path=>path.startsWith('/service/')&&/create|addstoerung/.test(path)));
 const copy=result.saved.continuationEvents[1];assert.equal(copy.serviceIncidentId,source.serviceIncidentId);assert.equal(copy.link.id,source.link.id);assert.equal(copy.mainTechnicianId,source.mainTechnicianId);assert.equal(copy.type,'SERVICEAUFTRAGEBENE');
 const raw=await transport.request('POST','/termin/details',{uuid:copy.id});assert.equal(raw.typ,'FREIER');assert.ok(!('vorgangtyp' in raw));
 const originalAfter=await api.details(source.id);calls.length=0;const main=source.mainTechnicianId==='sim-employee-3'?'sim-employee-1':'sim-employee-3';
 const edited=await api.update({id:copy.id,start:copy.start,end:copy.end,resourceIds:[main],mainTechnicianId:main,companionTechnicianIds:[],expected:{start:copy.start,end:copy.end,resourceIds:copy.resourceIds,mainTechnicianId:copy.mainTechnicianId}});assert.equal(edited.mainTechnicianId,main);assert.ok(!calls.includes('/service/updatestoerung'));assert.equal((await api.details(source.id)).end,originalAfter.end);assert.deepEqual(identities(),before);
}));
test('partial create failure can be retried without duplicate calendar entries',()=>isolated(async({store})=>{
 let fail=true;const api=calendar(store,'partial'),batch=new PdsCalendarContinuation(api,key=>{const value=calendar(store,key);if(key.endsWith(':1')){const create=value.create.bind(value);value.create=async raw=>{if(fail)throw Error('simulated outage');return create(raw);};}return value;}),request=input(),key=randomUUID();
 const preview=await batch.handle(request,true,key),confirmed={...request,continuationChoice:'split',continuationHash:preview.preview.continuationHash,acceptPlanningWarnings:true};
 await assert.rejects(batch.handle(confirmed,true,key),/1 von 2/);assert.equal(store.apiEntities('calendar-event').length,1);fail=false;
 const saved=await batch.handle(confirmed,true,key);assert.equal(saved.saved.continuationEvents.length,2);assert.equal(store.apiEntities('calendar-event').length,2);
}));
test('common windows, approved leave, changed previews and missing model data are handled explicitly',()=>isolated(async({store})=>{
 const api=calendar(store,'plan'),data=await api.list('2026-11-04','2026-11-20'),proposal={id:'new',...input(),type:'FREIER',status:'GEPLANT',fixed:false,allDay:false,categories:[],resourceIds:['sim-employee-1','sim-employee-2']};
 const plan=continuationPlan(data,proposal,'2026-11-04',17);assert.ok(plan.required);assert.equal(berlinWall(plan.segments[1].start).slice(0,10),'2026-11-09');
 assert.ok(continuationPlan({...data,workingTime:undefined},proposal,'2026-11-04').reason);
 const batch=new PdsCalendarContinuation(api,key=>calendar(store,key)),preview=await batch.handle(input(),true,randomUUID());const changed=await batch.handle({...input(),continuationChoice:'split',continuationHash:'wrong'},true,preview.preview.operationId);assert.ok(changed.preview);assert.equal(store.apiEntities('calendar-event').length,0);
 assert.equal(await batch.handle({...input(),continuationChoice:'single'},true,randomUUID()),null);
}));
test('partially updated original can resume without replaying stale update or adding duplicates',()=>isolated(async({store})=>{
 const api=calendar(store,'original-create'),source=await api.create({...input(),end:wallInstant('2026-11-04T15:00')});let fail=true;
 const batch=new PdsCalendarContinuation(api,key=>{const value=calendar(store,key),create=value.create.bind(value);value.create=async raw=>{if(fail)throw Error('outage');return create(raw);};return value;});
 const request={id:source.id,start:source.start,end:wallInstant('2026-11-04T18:00'),resourceIds:source.resourceIds,operationId:randomUUID(),expected:{start:source.start,end:source.end,resourceIds:source.resourceIds}};
 const preview=await batch.handle(request,false),confirmed={...request,continuationChoice:'split',continuationHash:preview.preview.continuationHash,acceptPlanningWarnings:true};
 await assert.rejects(batch.handle(confirmed,false),/1 von 2/);assert.equal((await api.details(source.id)).end,wallInstant('2026-11-04T15:30'));fail=false;
 const saved=await batch.handle(confirmed,false);assert.equal(saved.saved.id,source.id);assert.equal(saved.saved.continuationEvents.length,2);assert.equal(store.apiEntities('calendar-event').length,2);
}));
