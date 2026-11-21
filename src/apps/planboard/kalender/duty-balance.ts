import {berlinWall,type CalendarEvent} from './domain.ts';
import {dutyHolidayBurden,type DutyHolidayOptions} from './duty-holidays.ts';
export function dutyIntervals(events:CalendarEvent[],id:string,from:string,to:string){
 const intervals=events.filter(event=>event.resourceIds.includes(id)).map(event=>({start:Math.max(Date.parse(from),Date.parse(event.start)),end:Math.min(Date.parse(to),Date.parse(event.end))})).filter(event=>event.end>event.start).sort((a,b)=>a.start-b.start),merged:{start:string;end:string}[]=[];
 for(const interval of intervals){const previous=merged.at(-1);if(previous&&Date.parse(previous.end)>=interval.start)previous.end=new Date(Math.max(Date.parse(previous.end),interval.end)).toISOString();else merged.push({start:new Date(interval.start).toISOString(),end:new Date(interval.end).toISOString()});}
 return merged;
}
export function dutyBalance(events:CalendarEvent[],id:string,from:string,to:string,options:DutyHolidayOptions){
 const groups={newYear:0,christmas:0,easter:0,pentecost:0,other:0},last={newYear:'',christmas:'',easter:'',pentecost:'',other:''};let days=0;
 for(const interval of dutyIntervals(events,id,from,to)){
  days+=(Date.parse(berlinWall(interval.end)+'Z')-Date.parse(berlinWall(interval.start)+'Z'))/86400000;
  const burden=dutyHolidayBurden(interval.start,interval.end,options);for(const key of Object.keys(groups) as (keyof typeof groups)[])groups[key]+=burden.groups[key];for(const holiday of burden.holidays)if(holiday.day>last[holiday.group])last[holiday.group]=holiday.day;
 }
 return {days,points:Object.values(groups).reduce((sum,value)=>sum+value,0),groups,last};
}
