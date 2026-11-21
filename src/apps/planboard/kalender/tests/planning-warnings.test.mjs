import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {planningWarnings,wallInstant,eventOptions} from '../domain.ts';
import {PdsCalendar} from '../../../../platform/pds/api/calendar.ts';
import {SimulatedPdsApi} from '../../../../platform/pds/simulator/api.ts';
import {openOrderStore} from '../../../../platform/pds/simulator/order-store.ts';
const date='2026-11-04';
const event=(start,end,extra={})=>({id:'new',title:'Warnungstest',start:wallInstant(date+'T'+start),end:wallInstant(date+'T'+end),resourceIds:['r'],status:'GEPLANT',type:'FREIER',fixed:false,allDay:false,categories:[],...extra});
const day={date,targetMinutes:480,modelId:'m',modelName:'Demo',intervals:[{start:480,end:720},{start:750,end:1020}],breaks:[{start:720,end:750}]};
const data=(events=[])=>({resources:[{id:'r',name:'Ressource A'},{id:'b',name:'Begleiter'}],events,colors:[],colorSource:'simulation',workingTime:{source:'view',resources:[{resourceId:'r',days:[day]},{resourceId:'b',days:[day]}]}});
test('within-hours booking is quiet; pauses, off-hours and holiday closure warn without modifying the proposal',()=>{
 const candidate=event('09:00','10:00');assert.deepEqual(planningWarnings(data(),candidate),[]);
 for(const proposal of [event('07:00','09:00'),event('11:45','12:45')])assert.ok(planningWarnings(data(),proposal).some(warning=>warning.kind==='outside'));
 const closed=data();closed.workingTime.resources[0].days=[{...day,intervals:[],targetMinutes:0}];assert.ok(planningWarnings(closed,candidate).some(warning=>warning.kind==='outside'));assert.equal(candidate.start,wallInstant(date+'T09:00'));
});
test('overlap and worsened daily overload warn, replacing rather than double-counting the original event',()=>{
 const original=event('08:00','12:00',{id:'existing'}),another=event('13:00','17:00',{id:'other'});
 assert.deepEqual(planningWarnings(data([original]),original),[]);
 const proposal=event('08:00','17:30',{id:'existing'}),warnings=planningWarnings(data([original,another]),proposal);
 assert.ok(warnings.some(warning=>warning.kind==='overlap'));assert.ok(warnings.some(warning=>warning.kind==='overbooked'));assert.ok(warnings.some(warning=>warning.kind==='outside'));
 const oldOverloaded=event('06:00','18:00',{id:'existing'});assert.ok(!planningWarnings(data([oldOverloaded]),event('08:00','16:00',{id:'existing'})).some(warning=>warning.kind==='overbooked'));
});
test('all selected resources are checked; unknown models and dates warn instead of inventing availability',()=>{
 const busy=event('09:00','10:00',{resourceIds:['b'],id:'busy'}),warnings=planningWarnings(data([busy]),event('09:00','10:00',{resourceIds:['r','b']}));
 assert.ok(warnings.some(warning=>warning.resourceId==='b'&&warning.kind==='overlap'));assert.ok(!warnings.some(warning=>warning.resourceId==='r'));
 const unknown=data();delete unknown.workingTime;assert.equal(planningWarnings(unknown,event('09:00','10:00'))[0].kind,'unknown');
});
test('free/tentative appointments and requested leave do not create conflicts; approved absence does',()=>{
 const proposal=event('09:00','10:00');
 for(const value of [event('09:00','11:00',{id:'busy',status:'FREI'}),event('09:00','11:00',{id:'busy',status:'VORGEMERKT'}),event('09:00','11:00',{id:'busy',type:'URLAUB',vacationApproval:'BEANTRAGT'})])assert.deepEqual(planningWarnings(data([value]),proposal),[]);
 assert.ok(planningWarnings(data([event('09:00','11:00',{id:'busy',type:'URLAUB',vacationApproval:'GENEHMIGT'})]),proposal).some(warning=>warning.kind==='overlap'));
});
test('multi-day proposals inspect each day independently and detect a daily overload despite free weekly capacity',()=>{
 const value=data([event('08:00','12:00',{id:'busy'})]);value.workingTime.resources[0].days.push({...day,date:'2026-11-05'});
 const proposal={...event('11:00','17:00'),end:wallInstant('2026-11-05T10:00')};
 const warnings=planningWarnings(value,proposal);assert.ok(warnings.some(warning=>warning.kind==='overbooked'));assert.ok(warnings.some(warning=>warning.kind==='outside'));
});
test('server preview reads actual model data without creating/updating anything; later writes remain permitted',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'heyelli-warnings-')),store=openOrderStore(join(dir,'test.sqlite'));
 try{
  const api=new SimulatedPdsApi(store,'warnings-test'),calls=[],calendar=new PdsCalendar({request:async(...args)=>{calls.push(args[1]);return api.request(...args);}},{workingTimeView:'sim_calendar_working_times',vacationApprovalView:'sim_calendar_vacation_approvals'});
  const input={title:'Nur fiktiver Warnungstest',notes:'',start:wallInstant(date+'T18:00'),end:wallInstant(date+'T19:00'),resourceIds:['sim-employee-1']};
  assert.ok((await calendar.planningWarnings(input,true)).some(warning=>warning.kind==='outside'));assert.ok(!calls.includes('/termin/create'));assert.equal(store.apiEntities('calendar-event').length,0);
  const saved=await calendar.create(input);assert.equal(saved.title,input.title);const change={id:saved.id,start:saved.start,end:wallInstant(date+'T22:00'),resourceIds:saved.resourceIds,expected:{start:saved.start,end:saved.end,resourceIds:saved.resourceIds}};
  calls.length=0;assert.ok((await calendar.planningWarnings(change)).some(warning=>warning.kind==='outside'));assert.ok(!calls.includes('/termin/update'));
  const unchanged=await calendar.planningWarnings({...change,end:saved.end,title:'Nur Titel',expected:{...change.expected,title:saved.title,options:eventOptions(saved)}});assert.deepEqual(unchanged,[]);
  const updated=await calendar.update(change);assert.equal(updated.end,change.end);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
