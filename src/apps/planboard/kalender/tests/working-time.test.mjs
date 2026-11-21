import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SimulatedPdsApi} from '../../../../platform/pds/simulator/api.ts';
import {openOrderStore} from '../../../../platform/pds/simulator/order-store.ts';
import {PdsCalendar} from '../../../../platform/pds/api/calendar.ts';
import {readWorkingTime} from '../../../../platform/pds/api/working-time.ts';
import {resourceCapacity,wallInstant} from '../domain.ts';
const name='sim_calendar_working_times',from='2026-11-02',to='2026-11-08';
async function isolated(run){const dir=mkdtempSync(join(tmpdir(),'heyelli-work-'));const store=openOrderStore(join(dir,'test.sqlite'));try{await run(store);}finally{store.close();rmSync(dir,{recursive:true,force:true});}}
const event=(start,end,extra={})=>({id:'test',type:'FREIER',status:'GEPLANT',resourceIds:['sim-employee-1'],start:wallInstant(start),end:wallInstant(end),categories:[],...extra});
test('calendar uses the model view and native holiday APIs, with distinct employee models, breaks, weekends and holiday closures',()=>isolated(async store=>{
 const api=new SimulatedPdsApi(store),calls=[],calendar=new PdsCalendar({request:async(...args)=>{calls.push(args);return api.request(...args);}},{workingTimeView:name,vacationApprovalView:'sim_calendar_vacation_approvals'});
 const data=await calendar.list(from,to);assert.equal(data.workingTime.source,'view');assert.equal(data.workingTime.resources.length,3);
 assert.ok(calls.some(call=>call[1]==='/datenansichten/listdaten'&&call[2].name===name));for(const path of ['/administration/listfeiertage','/administration/listfeiertagsgruppen'])assert.ok(calls.some(call=>call[1]===path));
 const alex=data.workingTime.resources.find(value=>value.resourceId==='sim-employee-1'),kim=data.workingTime.resources.find(value=>value.resourceId==='sim-employee-2'),robin=data.workingTime.resources.find(value=>value.resourceId==='sim-employee-3');
 assert.deepEqual(alex.days[0].intervals,[{start:420,end:720},{start:750,end:930}]);assert.deepEqual(alex.days[0].breaks,[{start:720,end:750}]);assert.equal(alex.days.find(day=>day.date==='2026-11-05').intervals.length,0);assert.match(alex.days.find(day=>day.date==='2026-11-05').holiday,/Fiktiv/);assert.equal(alex.days.find(day=>day.date==='2026-11-07').intervals.length,0);
 assert.equal(resourceCapacity(alex,[],from,to).scheduled,30*60);assert.equal(resourceCapacity(kim,[],from,to).scheduled,32*60);assert.equal(resourceCapacity(robin,[],from,to).scheduled,21*60);
 const loadedAgain=await calendar.list(from,to);assert.deepEqual(loadedAgain.workingTime,data.workingTime);
 const dto=await api.request('POST','/mitarbeiter/details',{uuid:'sim-employee-1'});assert.equal(dto.arbeitszeitmodell,undefined);assert.equal(dto.feiertagsgruppeUUID,undefined);
}));
test('rest excludes model breaks, approved absences and planned appointments; overload is negative and overlap is counted per appointment',()=>{
 const working={resourceId:'sim-employee-1',days:[{targetMinutes:510,date:from,modelId:'m',modelName:'Demo',intervals:[{start:480,end:720},{start:750,end:1020}],breaks:[{start:720,end:750}]}]};
 const appointment=event(from+'T08:00',from+'T16:00');let capacity=resourceCapacity(working,[appointment],from,from);assert.equal(capacity.scheduled,510);assert.equal(capacity.booked,450);assert.equal(capacity.remaining,60);
 capacity=resourceCapacity(working,[appointment,{...appointment,id:'overlap'}],from,from);assert.equal(capacity.remaining,-390);
 capacity=resourceCapacity(working,[event(from+'T00:00','2026-11-03T00:00',{type:'URLAUB',vacationApproval:'GENEHMIGT'})],from,from);assert.equal(capacity.absence,510);assert.equal(capacity.booked,0);assert.equal(capacity.remaining,0);
 capacity=resourceCapacity(working,[event(from+'T06:00',from+'T08:00')],from,from);assert.equal(capacity.booked,120);assert.equal(capacity.remaining,390);
 const absence=event(from+'T08:00',from+'T10:00',{type:'ABWESENHEIT'});capacity=resourceCapacity(working,[absence,{...absence,id:'overlap'}],from,from);assert.equal(capacity.absence,120);
});
test('tentative/free appointments and requested leave do not reserve capacity; unknown model/approval is not represented as available capacity',()=>{
 const working={resourceId:'r',days:[{targetMinutes:480,date:from,modelId:'m',modelName:'Demo',intervals:[{start:480,end:960}],breaks:[]}]},appointment=event(from+'T08:00',from+'T16:00');
 const capacity=resourceCapacity(working,[{...appointment,status:'FREI'},{...appointment,status:'VORGEMERKT'},{...appointment,type:'URLAUB',vacationApproval:'BEANTRAGT'}],from,from);assert.equal(capacity.remaining,480);
 assert.equal(resourceCapacity(undefined,[],from,from),null);assert.equal(resourceCapacity(working,[],from,to),null);assert.equal(resourceCapacity(working,[{...appointment,type:'URLAUB'}],from,from),null);
});
test('half-day holidays use API group membership, assignments respect validity and planning periods',()=>isolated(async store=>{
 const api=new SimulatedPdsApi(store),rows=(await api.request('POST','/datenansichten/listdaten',{name})).filter(row=>row.mitarbeiterUUID==='sim-employee-1');
 const adapted={request:async(method,path,input)=>path==='/datenansichten/listdaten'&&input.name===name?rows:path==='/administration/listfeiertage'?[{uuid:'h',aktiv:true,naechstesDatum:from,halberTag:'NACHMITTAGS',bezeichnung:'Demo halb'}]:path==='/administration/listfeiertagsgruppen'?[{uuid:'sim-holidays-service',aktiveFeiertage:['h']}]:api.request(method,path,input)};
 const data=await readWorkingTime(adapted,name,[{id:'sim-employee-1',name:'Test',planningFrom:from,planningTo:from}],from,'2026-11-03');assert.deepEqual(data.resources[0].days[0].intervals,[{start:420,end:720}]);assert.deepEqual(data.resources[0].days[1].intervals,[]);
}));
test('missing configured view, denied APIs, malformed/overlapping models and missing holiday groups fail explicitly',()=>isolated(async store=>{
 const api=new SimulatedPdsApi(store),resource={id:'sim-employee-1',name:'Demo'},rows=await api.request('POST','/datenansichten/listdaten',{name});
 await assert.rejects(readWorkingTime({request:async()=>[]},name,[resource],from,to),/nicht verfügbar/);
 await assert.rejects(readWorkingTime({request:async()=>{throw Error('denied');}},name,[resource],from,to),/denied/);
 for(const invalid of [[{...rows[0],beginn:'25:00'}],[rows[0],rows[0]],[{...rows[0],feiertagsgruppeUUID:'missing'}],[{...rows[0],gueltigVon:'2026-02-30'}]])await assert.rejects(readWorkingTime({request:async(method,path,input)=>path==='/datenansichten/listdaten'?invalid:api.request(method,path,input)},name,[resource],from,to));
}));
test('view pagination and DST weekend do not inflate Monday working hours',()=>isolated(async store=>{
 const api=new SimulatedPdsApi(store),rows=await api.request('POST','/datenansichten/listdaten',{name}),filler=Array.from({length:500},(_,i)=>({...rows[0],mitarbeiterUUID:'unrelated-'+i})),pages=[];
 const data=await readWorkingTime({request:async(method,path,input)=>{if(path==='/datenansichten/listdaten'){pages.push(input.page);return input.page===0?filler:rows;}return api.request(method,path,input);}},name,[{id:'sim-employee-1',name:'Demo'}],'2026-10-24','2026-10-26');assert.deepEqual(pages,[0,1]);assert.equal(resourceCapacity(data.resources[0],[],'2026-10-24','2026-10-26').scheduled,480);
}));

test('daily target is independent of visual time windows; full-day absence consumes the target once',()=>{
 const working={resourceId:'r',days:[{targetMinutes:480,date:from,modelId:'m',modelName:'Demo target',intervals:[{start:420,end:1020}],breaks:[]}]};
 assert.equal(resourceCapacity(working,[],from,from).scheduled,480);
 const absence=event(from+'T00:00','2026-11-03T00:00',{type:'ABWESENHEIT'});
 assert.equal(resourceCapacity(working,[absence],from,from).remaining,0);
});
