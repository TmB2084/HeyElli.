import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleDayOffsets,weekday} from '../visible-days.ts';
import {axisPosition,axisMinutes,axisDragMinutes,axisSlot,workingTimeWindow} from '../time-axis.ts';
import {patchPreferences,defaultPreferences} from '../preferences.ts';
import {resourceCapacity} from '../working-time.ts';
const window={start:420,end:1020},width=600;
test('Saturday and Sunday disappear together in week and month; day navigation skips both',()=>{
 assert.deepEqual(visibleDayOffsets('2026-11-02',7,false),[0,1,2,3,4]);assert.equal(visibleDayOffsets('2026-11-01',30,false).length,21);assert.deepEqual(visibleDayOffsets('2026-11-07',1,false),[]);assert.equal(visibleDayOffsets('2026-11-02',7,true).length,7);assert.equal(weekday('2026-11-07'),'2026-11-09');assert.equal(weekday('2026-11-08',-1),'2026-11-06');
});
test('compressed axis creates and moves on actual Mondays, with exclusive end boundaries',()=>{
 const days=visibleDayOffsets('2026-11-02',14,false);
 assert.equal(axisPosition(5*1440+480,width,window,days),5*width);assert.equal(axisPosition(6*1440+480,width,window,days),5*width);
 assert.equal(axisPosition(7*1440+480,width,window,days),5*width+60);assert.equal(axisMinutes(5*width+60,width,window,days),7*1440+480);
 assert.equal(axisDragMinutes(4*1440+990,90,width,window,false,days),3*1440+480-990);
 assert.equal(axisDragMinutes(7*1440+480,-60,width,window,true,days),4*1440+1020-(7*1440+480));
 assert.equal(axisSlot('2026-11-02',width,5*width+60,'week',days.length,window,days).start,'2026-11-09T07:00:00.000Z');
 const month=visibleDayOffsets('2026-11-01',30,false);assert.equal(axisSlot('2026-11-01',72,5*72+1,'month',month.length,window,month).start,'2026-11-09T07:00:00.000Z');
});
test('weekend setting is validated and preserved with other personal preferences',()=>{
 const original=defaultPreferences(),hidden=patchPreferences(original,{showWeekends:false});assert.equal(hidden.showWeekends,false);assert.equal(patchPreferences(hidden,{showTentative:false}).showWeekends,false);assert.equal(original.showWeekends,undefined);for(const value of ['false',0,null])assert.throws(()=>patchPreferences(original,{showWeekends:value}));
});
test('working hours and capacity exclude hidden weekend days',()=>{
 const working={resourceId:'one',days:[{date:'2026-11-06',targetMinutes:480,intervals:[{start:480,end:1020}],breaks:[]},{date:'2026-11-07',targetMinutes:120,intervals:[{start:360,end:1200}],breaks:[]}]};
 assert.deepEqual(workingTimeWindow([working],['one'],'2026-11-06','2026-11-07',['2026-11-06']),{start:480,end:1020});
 assert.equal(resourceCapacity(working,[],'2026-11-06','2026-11-07',['2026-11-06']).scheduled,480);assert.equal(resourceCapacity(working,[],'2026-11-06','2026-11-07').scheduled,600);
});
test('legend visibility excludes appointments confined to hidden weekend dates',async()=>{
 const {visibleLegendEvents}=await import('../legend.ts');
 const event=(id,start,end)=>({id,start,end,resourceIds:['one']});
 const events=[event('fri','2026-11-06T08:00:00Z','2026-11-06T09:00:00Z'),event('sat','2026-11-07T08:00:00Z','2026-11-07T09:00:00Z'),event('sun','2026-11-08T08:00:00Z','2026-11-08T09:00:00Z')];
 assert.deepEqual(visibleLegendEvents(events,['one'],'2026-11-02',7,{start:0,end:1440},[0,1,2,3,4]).map(e=>e.id),['fri']);assert.equal(visibleLegendEvents(events,['one'],'2026-11-02',7,{start:0,end:1440}).length,3);
});
