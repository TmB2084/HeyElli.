import {addDays,wallInstant,type CalendarEvent} from "./model.ts";
export type WorkInterval={start:number;end:number}; // local minutes in one calendar day
export type WorkingDay={targetMinutes:number;date:string;modelId:string;modelName:string;intervals:WorkInterval[];breaks:WorkInterval[];holiday?:string};
export type ResourceWorkingTime={resourceId:string;days:WorkingDay[]};
export type CalendarWorkingTime={source:"view";resources:ResourceWorkingTime[]};
export function unionIntervals(values:WorkInterval[]):WorkInterval[]{
 const result:WorkInterval[]=[];for(const item of [...values].sort((a,b)=>a.start-b.start)){const last=result.at(-1);if(last&&item.start<=last.end)last.end=Math.max(last.end,item.end);else result.push({...item});}return result;
}
export function subtractIntervals(values:WorkInterval[],excluded:WorkInterval[]):WorkInterval[]{
 let result=values.map(value=>({...value}));for(const block of unionIntervals(excluded))result=result.flatMap(value=>block.end<=value.start||block.start>=value.end?[value]:[...(block.start>value.start?[{start:value.start,end:block.start}]:[]),...(block.end<value.end?[{start:block.end,end:value.end}]:[])]);return result;
}
export function intersectMinutes(values:WorkInterval[],range:WorkInterval){return values.reduce((sum,value)=>sum+Math.max(0,Math.min(value.end,range.end)-Math.max(value.start,range.start)),0);}
const duration=(values:WorkInterval[])=>values.reduce((sum,value)=>sum+value.end-value.start,0);
function instant(day:string,minute:number){return Date.parse(wallInstant(minute===1440?addDays(day,1)+"T00:00":day+"T"+String(Math.floor(minute/60)).padStart(2,"0")+":"+String(minute%60).padStart(2,"0")));}
function eventIntervals(day:WorkingDay,events:CalendarEvent[]):WorkInterval[]{
 const start=instant(day.date,0),end=instant(day.date,1440);
 return events.map(event=>({start:Math.max(start,Date.parse(event.start)),end:Math.min(end,Date.parse(event.end))})).filter(value=>value.end>value.start);
}
export function resourceCapacity(working:ResourceWorkingTime|undefined,events:CalendarEvent[],from:string,to:string,visibleDates?:string[]){
 if(!working)return null;
 const expectedDays=visibleDates?.length??(Date.parse(to+"T00:00:00Z")-Date.parse(from+"T00:00:00Z"))/86400000+1;
 const days=working.days.filter(day=>day.date>=from&&day.date<=to&&(!visibleDates||visibleDates.includes(day.date)));if(days.length!==expectedDays)return null;
 if(events.some(event=>event.type==="URLAUB"&&!event.vacationApproval&&event.status!=="FREI"))return null;
 let scheduled=0,absence=0,booked=0;
 const blocking=events.filter(event=>event.status==="GEPLANT");
 const absences=blocking.filter(event=>["ABWESENHEIT","PRIVATE_ABWESENHEIT"].includes(event.type)||event.type==="URLAUB"&&event.vacationApproval==="GENEHMIGT");
 const appointments=blocking.filter(event=>!absences.includes(event)&&event.type!=="URLAUB");
 for(const day of days){
  const available=day.intervals.map(value=>({start:instant(day.date,value.start),end:instant(day.date,value.end)}));
  const pauses=day.breaks.map(value=>({start:instant(day.date,value.start),end:instant(day.date,value.end)}));
  scheduled+=day.targetMinutes;
  const blocked=unionIntervals(eventIntervals(day,absences));
  for(const value of blocked)absence+=duration(available)?intersectMinutes(available,value)/duration(available)*day.targetMinutes:0;
  // Sum each appointment independently, so overlapping or out-of-hours assignments expose overload.
  for(const value of eventIntervals(day,appointments))booked+=duration(subtractIntervals([value],pauses))/60000;
 }
 return {scheduled,absence,booked,remaining:scheduled-absence-booked};
}
