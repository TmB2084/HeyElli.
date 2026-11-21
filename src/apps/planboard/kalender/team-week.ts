import {addDays,wallInstant,type CalendarEvent} from './domain.ts';
export function teamWeek(anchor:string,weekends=true){const monday=addDays(anchor,-((new Date(anchor+'T12:00:00Z').getUTCDay()+6)%7));return Array.from({length:weekends?7:5},(_,index)=>addDays(monday,index));}
export function teamDayEvents(events:CalendarEvent[],resourceId:string,day:string){
 const start=Date.parse(wallInstant(day+'T00:00')),end=Date.parse(wallInstant(addDays(day,1)+'T00:00')),seen=new Set<string>();
 return events.filter(event=>{if(seen.has(event.id)||!event.resourceIds.includes(resourceId)||Date.parse(event.start)>=end||Date.parse(event.end)<=start)return false;seen.add(event.id);return true;}).sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title,'de'));
}
