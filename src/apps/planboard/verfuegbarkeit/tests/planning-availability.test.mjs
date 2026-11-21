import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planningAvailability,availabilityInput} from '../model.ts';
const day='2026-11-16',input={start:day+'T09:00',duration:60,main:'a',team:[]};
const dayRow={date:day,targetMinutes:480,modelId:'model',modelName:'Fiktiv',intervals:[{start:420,end:1020}],breaks:[{start:720,end:780}]};
const data=()=>({resources:['a','b','c'].map(id=>({id,name:id,group:'Service',number:id})),workingTime:{source:'view',resources:['a','b','c'].map(resourceId=>({resourceId,days:[structuredClone(dayRow)]}))},events:[]});
const event=(patch={})=>({id:'e',resourceIds:['a'],status:'GEPLANT',type:'FREIER',start:day+'T08:00:00Z',end:day+'T09:00:00Z',title:'Private Fachinformation',...patch});
test('availability distinguishes overlap from touching boundaries and suggests free staff / contiguous time',()=>{const d=data();d.events=[event()];const result=planningAvailability(d,input);assert.equal(result.people[0].status,'blocked');assert.deepEqual(result.alternatives.map(p=>p.id),['b','c']);assert.equal(result.slots[0].start,day+'T10:00');assert.equal(planningAvailability(d,{...input,start:day+'T10:00'}).people[0].status,'free');assert.ok(!JSON.stringify(result).includes('Private Fachinformation'));});
test('duration must fit one continuous interval; breaks cannot be added up',()=>{const d=data();const result=planningAvailability(d,{...input,start:day+'T11:30',duration:120});assert.equal(result.people[0].status,'blocked');assert.equal(result.slots[0].start,day+'T13:00');assert.equal(result.slots[0].end,day+'T15:00');});
test('confirmed leave blocks, requested leave and free appointments do not; missing approval stays unknown',()=>{for(const [patch,status]of [[{type:'URLAUB',vacationApproval:'GENEHMIGT'},'blocked'],[{type:'URLAUB',vacationApproval:'BEANTRAGT'},'free'],[{type:'URLAUB'},'unknown'],[{status:'FREI'},'free'],[{status:'VORGEMERKT'},'free']]){const d=data();d.events=[event(patch)];assert.equal(planningAvailability(d,input).people[0].status,status);}});
test('missing models, planning periods and holidays never invent free times',()=>{const d=data();delete d.workingTime;assert.equal(planningAvailability(d,input).people[0].status,'unknown');assert.deepEqual(planningAvailability(d,input).slots,[]);const h=data();h.workingTime.resources[0].days[0].holiday='Fiktiver Feiertag';h.workingTime.resources[0].days[0].intervals=[];assert.equal(planningAvailability(h,input).people[0].status,'blocked');const p=data();p.resources[0].planningFrom='2026-11-17';assert.equal(planningAvailability(p,input).people[0].status,'unknown');});
test('suggestions keep companions free for the complete duration and alternatives cannot hide their conflict',()=>{const d=data();d.events=[event(),event({id:'companion',resourceIds:['b'],end:day+'T10:00:00Z'})];const result=planningAvailability(d,{...input,team:['b']});assert.equal(result.people[1].status,'blocked');assert.deepEqual(result.alternatives,[]);assert.equal(result.slots[0].start,day+'T11:00');});
test('overnight and DST preserve elapsed duration; missing following day is not free',()=>{const d=data();d.workingTime.resources[0].days=[{...dayRow,date:'2026-10-25',intervals:[{start:60,end:240}],breaks:[]}];const result=planningAvailability(d,{...input,start:'2026-10-25T01:00',duration:240});assert.equal(result.people[0].status,'free');const overnight=data();assert.equal(planningAvailability(overnight,{...input,start:day+'T23:00',duration:120}).people[0].status,'unknown');});
test('availability inputs are bounded, deduplicated and reject malformed / nonexistent dates',()=>{const params=new URLSearchParams({start:input.start,duration:'60',main:'a',team:'["b","b","a"]'});assert.deepEqual(availabilityInput(params).team,['b']);for(const [key,value]of [['duration','14'],['duration','1441'],['team','{}'],['start','2026-02-30T09:00'],['start','2026-03-29T02:30']]){const p=new URLSearchParams(params);p.set(key,value);assert.throws(()=>availabilityInput(p));}});

test('PDS availability uses documented read endpoints, working-time views and leaves out order enrichment',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{openOrderStore}=await import('../../../../platform/pds/simulator/order-store.ts'),{SimulatedPdsApi}=await import('../../../../platform/pds/simulator/api.ts'),{PdsCalendar}=await import('../../../../platform/pds/api/calendar.ts');
 const directory=mkdtempSync(join(tmpdir(),'availability-')),store=openOrderStore(join(directory,'fiction.sqlite'));
 try{const api=new SimulatedPdsApi(store),paths=[],transport={request:async(...args)=>{paths.push(args[1]);return api.request(...args);}},calendar=new PdsCalendar(transport,{workingTimeView:'sim_calendar_working_times',vacationApprovalView:'sim_calendar_vacation_approvals'}),result=await calendar.availability(day,'2026-11-29');assert.ok(result.resources.length);assert.ok(result.workingTime.resources.length);assert.ok(paths.includes('/termin/listplanung'));assert.ok(paths.includes('/datenansichten/listdaten'));assert.ok(!paths.some(path=>path.startsWith('/service/')||path==='/termin/listkategorien'));assert.ok(planningAvailability(result,{...input,main:'sim-employee-1'}).people.length);}finally{store.close();rmSync(directory,{recursive:true,force:true});}
});

test('half-day holidays retain the remaining validated work intervals',()=>{const d=data();d.workingTime.resources[0].days[0]={...dayRow,holiday:'Fiktiver halber Feiertag',intervals:[{start:780,end:1020}],breaks:[]};assert.equal(planningAvailability(d,input).people[0].status,'blocked');assert.equal(planningAvailability(d,{...input,start:day+'T13:00'}).people[0].status,'free');});

test('availability is an explicit read-only shared business source, with either app right required',async()=>{const {apiPolicy,requirePolicy}=await import('../../../../platform/app-access/access-policy.ts');assert.equal(apiPolicy('/api/planung/verfuegbarkeit'),'app');await requirePolicy({id:'fictional',role:'reader'},'/api/planung/verfuegbarkeit','GET',async(_id,app,right)=>app==='/casedesk'&&right==='read');await requirePolicy({id:'fictional',role:'reader'},'/api/planung/verfuegbarkeit','GET',async(_id,app,right)=>app==='/servicehub'&&right==='read');await assert.rejects(requirePolicy({id:'fictional',role:'reader'},'/api/planung/verfuegbarkeit','GET',async(_id,app)=>app==='/planboard'));await assert.rejects(requirePolicy(null,'/api/planung/verfuegbarkeit','GET',async()=>true));});

test('contiguous midnight windows can accommodate an overnight assignment, and missing day interrupts them',()=>{const d=data();d.workingTime.resources[0].days=[{...dayRow,intervals:[{start:1380,end:1440}],breaks:[]},{...dayRow,date:'2026-11-17',intervals:[{start:0,end:180}],breaks:[]}];const request={...input,start:day+'T23:00',duration:120};assert.equal(planningAvailability(d,request).people[0].status,'free');d.workingTime.resources[0].days.pop();assert.equal(planningAvailability(d,request).people[0].status,'unknown');});

test('staff quota stops before loading details or appointments',async()=>{const {PdsCalendar}=await import('../../../../platform/pds/api/calendar.ts');let calls=0;const calendar=new PdsCalendar({request:async(method,path)=>{calls++;assert.equal(path,'/mitarbeiter/listmitarbeiter');return {resultList:[],totalHitCount:301};}});await assert.rejects(calendar.availability(day,day),/Datenumfang/);assert.equal(calls,1);});

function nightAvailability(date='2026-10-25',end=300){const d=data();d.workingTime.resources[0].days=[{...dayRow,date,intervals:[{start:0,end}],breaks:[]}];return d;}
test('repeated-hour suggestions advance to an unambiguous start that the same editor can save',()=>{
 const d=nightAvailability();d.events=[event({start:'2026-10-24T22:00:00Z',end:'2026-10-25T01:30:00Z'})];
 const result=planningAvailability(d,{...input,start:'2026-10-25T01:00'});assert.deepEqual(result.slots[0],{start:'2026-10-25T03:00',end:'2026-10-25T04:00'});
 const accepted=availabilityInput(new URLSearchParams({start:result.slots[0].start,duration:'60',main:'a',team:'[]'}));assert.equal(planningAvailability(d,accepted).people[0].status,'free');
});
test('skipping the repeated hour never consumes an occupied interval or shortens the duration',()=>{
 const d=nightAvailability('2026-10-25',210);d.events=[event({start:'2026-10-24T22:00:00Z',end:'2026-10-25T01:30:00Z'})];
 assert.deepEqual(planningAvailability(d,{...input,start:'2026-10-25T01:00'}).slots,[]);
 d.workingTime.resources[0].days.push({...dayRow,date:'2026-10-26',intervals:[{start:420,end:600}],breaks:[]});
 assert.deepEqual(planningAvailability(d,{...input,start:'2026-10-25T01:00'}).slots[0],{start:'2026-10-26T07:00',end:'2026-10-26T08:00'});
});
test('DST alternatives still respect companion occupancy for the full elapsed duration',()=>{
 const d=nightAvailability();d.workingTime.resources[1].days=structuredClone(d.workingTime.resources[0].days);d.events=[event({start:'2026-10-24T22:00:00Z',end:'2026-10-25T01:30:00Z'}),event({id:'companion',resourceIds:['b'],start:'2026-10-25T02:00:00Z',end:'2026-10-25T03:00:00Z'})];
 const result=planningAvailability(d,{...input,start:'2026-10-25T01:00',team:['b']});assert.deepEqual(result.slots[0],{start:'2026-10-25T04:00',end:'2026-10-25T05:00'});
});
test('spring-forward suggestions keep the requested elapsed minutes and never invent a missing local hour',async()=>{
 const {wallInstant}=await import('../../kalender/domain.ts');const d=nightAvailability('2026-03-29',360);d.events=[event({start:'2026-03-28T23:00:00Z',end:'2026-03-29T01:15:00Z'})];
 const result=planningAvailability(d,{...input,start:'2026-03-29T01:00',duration:90});assert.deepEqual(result.slots[0],{start:'2026-03-29T03:15',end:'2026-03-29T04:45'});
 assert.equal(Date.parse(wallInstant(result.slots[0].end))-Date.parse(wallInstant(result.slots[0].start)),90*60000);
});
