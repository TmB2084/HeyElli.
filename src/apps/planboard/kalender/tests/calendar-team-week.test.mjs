import test from 'node:test';
import assert from 'node:assert/strict';
import {teamWeek,teamDayEvents} from '../team-week.ts';
const event={id:'one',title:'Gemeinsam',resourceIds:['a','b'],start:'2026-11-06T22:00:00Z',end:'2026-11-07T01:00:00Z'};
test('week starts Monday across year boundaries and respects hidden weekends',()=>{assert.deepEqual(teamWeek('2027-01-01',false),['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01']);assert.equal(teamWeek('2026-11-07').length,7);});
test('shared assignments appear for each technician and each overlapping Berlin day once',()=>{assert.equal(teamDayEvents([event,event],'a','2026-11-06').length,1);assert.equal(teamDayEvents([event],'b','2026-11-07').length,1);assert.equal(teamDayEvents([event],'c','2026-11-07').length,0);assert.equal(teamDayEvents([{...event,end:'2026-11-06T23:00:00Z'}],'a','2026-11-07').length,0);});
