import test from 'node:test';
import assert from 'node:assert/strict';
import {mobileSelection} from '../mobile-selection.ts';
const event={id:'one',type:'SERVICEAUFTRAGEBENE',link:{id:'service-one',type:'SERVICEAUFTRAG'},mainTechnicianId:'tech',start:'2026-11-06T23:30:00Z',end:'2026-11-07T01:00:00Z',resourceIds:['tech'],categories:[],fixed:false,status:'GEPLANT',title:'Example',allDay:false};
test('today is the Berlin calendar day; hidden and ineligible entries cannot be added',()=>{
 const other={...event,id:'other',start:'2026-11-08T08:00:00Z',end:'2026-11-08T09:00:00Z'};
 const values=[event,event,other,{...event,id:'cancelled',orderStatus:{id:'s',name:'Manuell storniert'}},{...event,id:'free',type:'FREIER'},{...event,id:'no-main',mainTechnicianId:undefined}];
 assert.deepEqual(mobileSelection(values,true,new Date('2026-11-07T12:00:00Z')).map(item=>item.id),['one']);
 assert.deepEqual(mobileSelection(values,false).map(item=>item.id),['one','other']);
 assert.deepEqual(mobileSelection([],false),[]);
});
test('appointments ending exactly at midnight are excluded from today',()=>{
 const ending={...event,end:'2026-11-06T23:00:00Z',start:'2026-11-06T22:00:00Z'};
 assert.deepEqual(mobileSelection([ending],true,new Date('2026-11-07T12:00:00Z')),[]);
});
