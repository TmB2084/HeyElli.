import test from 'node:test';
import assert from 'node:assert/strict';
import {workingTimeWindow,axisPosition,axisMinutes,axisDragMinutes,axisSlot} from '../time-axis.ts';
const window={start:420,end:1020};
test('working hour bounds cover selected resources and period, retain pauses, fallback without intervals',()=>{
 const working=[{resourceId:'a',days:[{date:'2026-11-02',intervals:[{start:450,end:720},{start:750,end:1020}]},{date:'2026-11-03',intervals:[{start:360,end:1080}]}]},{resourceId:'b',days:[{date:'2026-11-02',intervals:[{start:420,end:1050}]}]}];
 assert.deepEqual(workingTimeWindow(working,['a','b'],'2026-11-02','2026-11-02'),{start:420,end:1050});
 assert.deepEqual(workingTimeWindow(working,['a'],'2026-11-02','2026-11-02'),{start:450,end:1020});
 for(const ids of [[],['missing']])assert.deepEqual(workingTimeWindow(working,ids,'2026-11-02','2026-11-02'),{start:0,end:1440});
 assert.deepEqual(workingTimeWindow(working,['a'],'2026-11-04','2026-11-04'),{start:0,end:1440});
});
test('axis clips hidden hours, maps visible time and drags across days with resize boundary semantics',()=>{
 assert.equal(axisPosition(420,600,window),0);assert.equal(axisPosition(1020,600,window),600);
 assert.equal(axisPosition(60,600,window),0);assert.equal(axisPosition(1200,600,window),600);
 assert.equal(axisPosition(1440+480,600,window),660);assert.equal(axisMinutes(660,600,window),1920);
 assert.equal(axisDragMinutes(480,60,600,window),60);
 assert.equal(axisDragMinutes(960,120,600,window),960); // 16:00 to next day 08:00
 assert.equal(axisDragMinutes(1020,-60,600,window,true),-60);
 assert.equal(axisDragMinutes(960,60,600,window,true),60);
 assert.equal(axisDragMinutes(420,0,600,window),0);
 assert.equal(axisPosition(1440,600,window)-axisPosition(0,600,window),600); // all day
});
test('creation follows compressed axis including month and quarter-hour rounding',()=>{
 const slot=axisSlot('2026-11-02',600,675,'week',7,window);
 assert.equal(slot.start,'2026-11-03T07:15:00.000Z'); // Berlin 08:15
 assert.equal(slot.end,'2026-11-03T08:15:00.000Z');
 assert.equal(axisSlot('2026-11-02',600,100,'month',30,{start:600,end:1080}).start,'2026-11-02T09:00:00.000Z');
 assert.throws(()=>axisSlot('2026-11-02',600,4200,'week',7,window));
 const full={start:0,end:1440};assert.equal(axisPosition(1500,360,full),375);assert.equal(axisDragMinutes(480,15,1440,full),15);
});
