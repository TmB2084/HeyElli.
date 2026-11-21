import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PdsCalendar} from '../../../../platform/pds/api/calendar.ts';
import {SimulatedPdsApi} from '../../../../platform/pds/simulator/api.ts';
import {openOrderStore} from '../../../../platform/pds/simulator/order-store.ts';
import {axisPosition,axisDragMinutes} from '../time-axis.ts';
import {visibleDayOffsets} from '../visible-days.ts';
import {moveEvent,wallInstant,wallMinutes} from '../model.ts';
const from='2026-11-01',days=visibleDayOffsets(from,30,false),origin=Date.parse(from+'T00:00:00Z')/60000,width=72;
async function isolated(run){const directory=mkdtempSync(join(tmpdir(),'calendar-weekend-drag-')),store=openOrderStore(join(directory,'test.sqlite'));try{await run(new PdsCalendar(new SimulatedPdsApi(store,'drag-test')));}finally{store.close();rmSync(directory,{recursive:true,force:true});}}
function delta(old,target,window,endEdge=false){const position=value=>axisPosition(wallMinutes(value)-origin,width,window,days);return axisDragMinutes(wallMinutes(old)-origin,position(target)-position(old),width,window,endEdge,days);}
async function save(calendar,old,changed){return calendar.update({id:old.id,start:changed.start,end:changed.end,resourceIds:changed.resourceIds,expected:{start:old.start,end:old.end,resourceIds:old.resourceIds}});}
for(const [label,window] of [['full',{start:0,end:1440}],['working',{start:420,end:990}]]){
 test('Friday to Monday move preserves six hours and UUID on '+label+' axis',()=>isolated(async calendar=>{
  const old=await calendar.create({title:'Fiktive Verschiebung',start:wallInstant('2026-11-06T08:00'),end:wallInstant('2026-11-06T14:00'),resourceIds:['sim-employee-1']});
  const ids=(await calendar.list('2026-11-01','2026-11-30')).events.map(e=>e.id).sort(),target=wallInstant('2026-11-09T08:00'),changed=moveEvent(old,'move',delta(old.start,target,window),'sim-employee-1','sim-employee-1'),saved=await save(calendar,old,changed);
  assert.equal(saved.id,old.id);assert.equal(saved.start,target);assert.equal(saved.end,wallInstant('2026-11-09T14:00'));assert.equal(Date.parse(saved.end)-Date.parse(saved.start),6*3600000);assert.deepEqual((await calendar.list('2026-11-01','2026-11-30')).events.map(e=>e.id).sort(),ids);
  const back=await save(calendar,saved,moveEvent(saved,'move',delta(saved.start,old.start,window),'sim-employee-1','sim-employee-1'));assert.equal(back.start,old.start);assert.equal(back.end,old.end);
 }));
 test('Friday to Monday resize keeps start and stores real 68-hour span on '+label+' axis',()=>isolated(async calendar=>{
  const old=await calendar.create({title:'Fiktive Verlängerung',start:wallInstant('2026-11-06T14:00'),end:wallInstant('2026-11-06T16:00'),resourceIds:['sim-employee-1']}),target=wallInstant('2026-11-09T10:00'),changed=moveEvent(old,'end',delta(old.end,target,window,true),'sim-employee-1','sim-employee-1'),saved=await save(calendar,old,changed);
  assert.equal(saved.id,old.id);assert.equal(saved.start,old.start);assert.equal(saved.end,target);assert.equal(Date.parse(saved.end)-Date.parse(saved.start),68*3600000);
 }));
}
test('resize from the exact Friday workday edge maps to Monday 07:15 and never jumps without movement',()=>{
 const window={start:420,end:990},old=wallInstant('2026-11-06T16:30'),target=wallInstant('2026-11-09T07:15');assert.equal(axisDragMinutes(wallMinutes(old)-origin,0,width,window,true,days),0);assert.equal(wallMinutes(old)+delta(old,target,window,true),wallMinutes(target));
});
test('all-day move preserves a full day when hidden work hours and weekend are crossed',()=>{
 const old={id:'all-day',title:'Ganztag',start:wallInstant('2026-11-06T00:00'),end:wallInstant('2026-11-07T00:00'),resourceIds:['one'],fixed:false,allDay:true};const target=wallInstant('2026-11-09T00:00'),changed=moveEvent(old,'move',delta(old.start,target,{start:420,end:990}),'one','one');assert.equal(changed.start,target);assert.equal(changed.end,wallInstant('2026-11-10T00:00'));assert.equal(Date.parse(changed.end)-Date.parse(changed.start),86400000);
});
