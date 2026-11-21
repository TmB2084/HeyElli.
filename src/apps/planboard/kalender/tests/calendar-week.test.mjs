import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarWeek,calendarWeekLabel} from '../calendar-week.ts';
test('ISO calendar weeks respect Monday boundaries and week-year rollover',()=>{
 assert.deepEqual(calendarWeek('2026-11-05'),{year:2026,week:45});
 assert.deepEqual(calendarWeek('2027-01-01'),{year:2026,week:53});
 assert.deepEqual(calendarWeek('2027-01-04'),{year:2027,week:1});
 assert.deepEqual(calendarWeek('2024-12-30'),{year:2025,week:1});
 assert.equal(calendarWeekLabel('2026-11-02','2026-11-08'),'KW 45');
 assert.equal(calendarWeekLabel('2026-11-01','2026-11-30'),'KW 44–49');
 assert.equal(calendarWeekLabel('2026-12-28','2027-01-04'),'KW 53/2026 – KW 1/2027');
});
