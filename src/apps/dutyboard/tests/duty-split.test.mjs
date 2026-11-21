import test from 'node:test';
import assert from 'node:assert/strict';
import {dutySplit} from '../split.ts';
const original={id:'duty',title:'Bereitschaft',resourceIds:['a'],start:'2030-01-07T06:00:00Z',end:'2030-01-14T06:00:00Z',categories:['duty'],type:'FREIER',status:'FREI',fixed:false,allDay:false};
const resources=['a','b'].map(id=>({id,name:id,number:id,group:'Team'}));
const now=new Date('2029-01-01');
test('split preserves contiguous coverage and validates the second technician and time',()=>{
 const plan=dutySplit(original,'2030-01-10T07:00','b',resources,[],now);assert.equal(plan.split,'2030-01-10T06:00:00.000Z');assert.equal(plan.resourceId,'b');
 for(const time of ['2030-01-07T07:00','2030-01-14T07:00','invalid'])assert.throws(()=>dutySplit(original,time,'b',resources,[],now));
 assert.throws(()=>dutySplit(original,'2030-01-10T07:00','a',resources,[],now));
 assert.throws(()=>dutySplit({...original,fixed:true},'2030-01-10T07:00','b',resources,[],now));
 assert.throws(()=>dutySplit(original,'2030-01-10T07:00','b',resources,[{...original,id:'leave',categories:[],type:'URLAUB',status:'GEPLANT',resourceIds:['b']}],now),/abwesend/);
 assert.throws(()=>dutySplit(original,'2030-01-10T07:00','b',resources,[{...original,id:'other',resourceIds:['b']}],now),/Bereitschaft/);
 assert.throws(()=>dutySplit(original,'2030-01-10T07:00','b',resources.map(item=>({...item,planningTo:'2030-01-09'})),[],now),/planbar/);
});
