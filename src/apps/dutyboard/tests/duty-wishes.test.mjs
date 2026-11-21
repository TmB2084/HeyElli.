import test from 'node:test';
import assert from 'node:assert/strict';
import {checkSwap,exclusionEvents,exclusionDay,swapTargets} from '../wish-domain.ts';
import {dutyWeeks,dutyPlan,manualDutySlot} from '../../planboard/kalender/duty.ts';
const now=new Date('2026-11-07T12:00:00Z'),people=['a','b','c'].map(id=>({id,name:id,number:id,group:'Test'})),weeks=dutyWeeks(2028),event=(index,id,person)=>({id,title:'Bereitschaft',notes:'Behalten',start:weeks[index].start,end:weeks[index].end,resourceIds:[person],categories:['duty'],type:'FREIER',status:'FREI',fixed:false,allDay:false});
const first=event(0,'first','a'),second=event(1,'second','b');
test('adjacent weeks can be swapped without extending either duty; independent text is preserved',()=>{
 const current=[{...first,title:'Zwischenzeitlich umbenannt'},second],targets=checkSwap(2028,first,second,current,people,'duty',[],false,now);assert.deepEqual(targets.map(item=>item.resourceIds),[['b'],['a']]);assert.equal(current[0].title,'Zwischenzeitlich umbenannt');assert.equal(targets[0].start,first.start);
});
test('vacation and personal exclusions prevent swaps and automatic/manual assignments',()=>{
 const leave={...second,id:'leave',type:'URLAUB',categories:[],status:'GEPLANT',resourceIds:['a']};assert.throws(()=>checkSwap(2028,first,second,[first,second,leave],people,'duty',[],false,now),/abwesend/);
 assert.doesNotThrow(()=>checkSwap(2028,first,second,[first,second,{...leave,status:'FREI'}],people,'duty',[],false,now));
 const excluded={id:'excluded',user_id:'user-a',resource_id:'a',week_day:weeks[1].day};assert.throws(()=>checkSwap(2028,first,second,[first,second],people,'duty',[excluded],false,now));
 const blocked=exclusionEvents([excluded]);const plan=dutyPlan(2028,people,blocked,'duty',now);assert.notEqual(plan[1].resourceId,'a');assert.throws(()=>manualDutySlot(2028,weeks[1].day,people[0],blocked,'duty',now));
});
test('a third adjacent week, fixed or edited schedules, started weeks and missing employees reject swaps',()=>{
 assert.throws(()=>checkSwap(2028,first,second,[first,second,event(2,'third','a')],people,'duty',[],false,now),/zwei Bereitschaftswochen hintereinander/);
 assert.throws(()=>checkSwap(2028,{...first,fixed:true},second,[first,second],people,'duty',[],false,now));
 assert.throws(()=>checkSwap(2028,first,second,[{...first,resourceIds:['c']},second],people,'duty',[],false,now),/zwischenzeitlich/);
 assert.throws(()=>checkSwap(2028,first,second,[first,second],people,'duty',[],false,new Date(first.start)));
 assert.throws(()=>checkSwap(2028,first,second,[first,second],[people[0]],'duty',[],false,now));
});
test('partially applied exchanges resume without changing ids or accepting unrelated schedule edits',()=>{
 const targets=swapTargets(first,second),partial=[targets[0],second];assert.doesNotThrow(()=>checkSwap(2028,first,second,partial,people,'duty',[],true,now));assert.throws(()=>checkSwap(2028,first,second,partial,people,'duty',[],false,now));
 assert.throws(()=>checkSwap(2028,first,second,[{...targets[0],end:weeks[2].end},second],people,'duty',[],true,now));
 assert.equal(new Set(targets.map(item=>item.id)).size,2);
});
test('exclusions use complete Monday 07 to Monday 07 weeks and reject invalid/started days',()=>{
 const slot=exclusionDay(2028,weeks[0].day,now),blocked=exclusionEvents([{id:'one',user_id:'u',resource_id:'a',week_day:slot.day}])[0];assert.equal(blocked.start,slot.start);assert.equal(blocked.end,slot.end);assert.throws(()=>exclusionDay(2028,'2028-01-04',now));assert.throws(()=>exclusionDay(2028,slot.day,new Date(slot.start)));
});
test('equivalent PDS timestamp formats are accepted as the same Monday boundary',()=>{
 const zone={...first,start:first.start.replace('06:00:00.000Z','07:00:00+01:00'),end:first.end.replace('06:00:00.000Z','07:00:00+01:00')};assert.doesNotThrow(()=>checkSwap(2028,zone,second,[first,second],people,'duty',[],false,now));
});
