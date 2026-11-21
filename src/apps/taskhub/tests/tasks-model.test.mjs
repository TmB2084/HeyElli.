import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dueGroup,inView} from '../model.ts';
// Fälligkeitsgruppen nach Berliner Kalendertag; „Heute“ enthält Überfälliges, erledigte Aufgaben erscheinen in keiner Ansicht.
const now=new Date('2026-11-21T10:00:00+01:00'); // Samstag
test('Fälligkeit wird nach Berliner Tag gruppiert',()=>{
 assert.equal(dueGroup(null,now),'none');
 assert.equal(dueGroup('2026-11-20T15:00:00Z',now),'overdue');
 assert.equal(dueGroup('2026-11-21T08:00:00+01:00',now),'overdue');
 assert.equal(dueGroup('2026-11-21T16:00:00+01:00',now),'today');
 assert.equal(dueGroup('2026-11-22T12:00:00+01:00',now),'week');
 assert.equal(dueGroup('2026-11-23T08:00:00+01:00',now),'later');
 assert.equal(dueGroup('2026-11-21T23:30:00Z',now),'week','23:30 UTC ist in Berlin bereits Sonntag');
});
test('Ansichten filtern offene Aufgaben',()=>{
 const item=(status,due)=>({key:'x',source:'pds',id:'x',title:'t',subtitle:'',due,status,assigneeIds:[],customerId:null,objectId:null,href:null,sources:['pds']});
 assert.ok(inView(item('OFFEN','2026-11-20T15:00:00Z'),'today',now));
 assert.ok(inView(item('OFFEN','2026-11-20T15:00:00Z'),'overdue',now));
 assert.ok(!inView(item('ERLEDIGT','2026-11-20T15:00:00Z'),'all',now));
 assert.ok(inView(item('WARTEN',null),'waiting',now));
 assert.ok(!inView(item('OFFEN',null),'waiting',now));
 assert.ok(inView(item('IN_BEARBEITUNG','2026-11-22T12:00:00+01:00'),'week',now));
});
