import {wallInstant,type CalendarEvent,type Resource} from './domain.ts';
import {dutyBalance} from './duty-balance.ts';
import type {DutyHolidayOptions} from './duty-holidays.ts';
export function dutyFairness(people:Resource[],events:CalendarEvent[],category:string,from:string,to:string,options:DutyHolidayOptions,now=new Date()){
 const cutoff=new Date(Math.max(Date.parse(from),Math.min(Date.parse(to),now.getTime()))).toISOString(),duties=events.filter(event=>event.categories.includes(category)),weights={...options,enabled:true};
 return {from,to,asOf:now.toISOString(),weighted:options.enabled,accounts:people.map(person=>{
  const past=dutyBalance(duties,person.id,from,cutoff,weights),planned=dutyBalance(duties,person.id,cutoff,to,weights);
  return {id:person.id,days:past.days,plannedDays:planned.days,holidayPoints:past.points,plannedHolidayPoints:planned.points,last:past.last};
 })};
}
export function fairnessStart(year:number,historyYears:number){return wallInstant(`${Math.max(2000,year-historyYears)}-01-01T00:00`);}
export type DutyFairness=ReturnType<typeof dutyFairness>;
