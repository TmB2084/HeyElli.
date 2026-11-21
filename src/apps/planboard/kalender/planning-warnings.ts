import {addDays,berlinWall,wallInstant,type CalendarData,type CalendarEvent} from "./model.ts";
import {resourceCapacity,subtractIntervals} from "./working-time.ts";
export type PlanningWarning={resourceId:string;kind:"outside"|"overbooked"|"overlap"|"unknown";message:string};
const absence=(event:CalendarEvent)=>["ABWESENHEIT","PRIVATE_ABWESENHEIT"].includes(event.type)||event.type==="URLAUB";
const reserves=(event:CalendarEvent)=>event.status==="GEPLANT"&&(event.type!=="URLAUB"||event.vacationApproval==="GENEHMIGT");
const label=(date:string)=>date.split("-").reverse().join(".");
export function planningWarnings(data:CalendarData,proposed:CalendarEvent):PlanningWarning[]{
 const from=berlinWall(proposed.start).slice(0,10),to=berlinWall(new Date(Date.parse(proposed.end)-1).toISOString()).slice(0,10),warnings:PlanningWarning[]=[];
 const before=data.events,after=[...before.filter(event=>event.id!==proposed.id),proposed];
 for(const resourceId of proposed.resourceIds){
  const name=data.resources.find(resource=>resource.id===resourceId)?.name??resourceId,working=data.workingTime?.resources.find(item=>item.resourceId===resourceId);
  let unknown=false,worst:{date:string;remaining:number}|undefined;const outside:string[]=[];
  for(let date=from;date<=to;date=addDays(date,1)){
   const day=working?.days.find(day=>day.date===date),start=Date.parse(wallInstant(date+"T00:00")),end=Date.parse(wallInstant(addDays(date,1)+"T00:00"));
   if(!day){unknown=true;continue;}
   const instant=(minute:number)=>minute===1440?end:Date.parse(wallInstant(date+"T"+String(Math.floor(minute/60)).padStart(2,"0")+":"+String(minute%60).padStart(2,"0")));
   const interval={start:Math.max(start,Date.parse(proposed.start)),end:Math.min(end,Date.parse(proposed.end))};
   if(!absence(proposed)&&subtractIntervals([interval],day.intervals.map(value=>({start:instant(value.start),end:instant(value.end)}))).some(value=>value.end-value.start>1000))outside.push(date);
   const relevant=(events:CalendarEvent[])=>events.filter(event=>event.resourceIds.includes(resourceId)&&Date.parse(event.start)<end&&Date.parse(event.end)>start);
   const previous=resourceCapacity(working,relevant(before),date,date),next=resourceCapacity(working,relevant(after),date,date);
   if(!previous||!next){unknown=true;continue;}
   if(next.remaining<0&&next.remaining<previous.remaining-.001&&(!worst||next.remaining<worst.remaining))worst={date,remaining:next.remaining};
  }
  if(outside.length)warnings.push({resourceId,kind:"outside",message:`${name}: außerhalb der Arbeitszeit (einschließlich Pausen/Feiertagen) am ${outside.slice(0,3).map(label).join(", ")}${outside.length>3?` und ${outside.length-3} weiteren Tagen`:""}.`});
  if(reserves(proposed)){
   const conflicts=before.filter(event=>event.id!==proposed.id&&event.resourceIds.includes(resourceId)&&reserves(event)&&Date.parse(event.start)<Date.parse(proposed.end)&&Date.parse(event.end)>Date.parse(proposed.start));
   if(conflicts.length)warnings.push({resourceId,kind:"overlap",message:`${name}: zeitliche Überschneidung mit ${conflicts.slice(0,3).map(event=>`„${event.title}“`).join(", ")}${conflicts.length>3?` und ${conflicts.length-3} weiteren Terminen`:""}.`});
  }
  if(worst)warnings.push({resourceId,kind:"overbooked",message:`${name}: Überbuchung am ${label(worst.date)}; rechnerische Restkapazität ${new Intl.NumberFormat("de-DE",{maximumFractionDigits:2}).format(worst.remaining/60)} h.`});
  if(unknown)warnings.push({resourceId,kind:"unknown",message:`${name}: Arbeitszeit oder Kapazität kann für diesen Zeitraum nicht vollständig geprüft werden.`});
 }
 return warnings;
}
