import {CalendarError,wallInstant} from "./model.ts";
import type {ResourceWorkingTime} from "./working-time.ts";
export type TimeWindow={start:number;end:number};
export function workingTimeWindow(working:ResourceWorkingTime[]|undefined,ids:string[],from:string,to:string,visibleDates?:string[]):TimeWindow {
 const resources=ids.map(id=>working?.find(row=>row.resourceId===id));
 if(!resources.length||resources.some(row=>!row))return {start:0,end:1440};
 const intervals=resources.flatMap(row=>row!.days.filter(day=>day.date>=from&&day.date<=to&&(!visibleDates||visibleDates.includes(day.date))).flatMap(day=>day.intervals));
 if(!intervals.length)return {start:0,end:1440};
 return {start:Math.floor(Math.min(...intervals.map(row=>row.start))/15)*15,end:Math.ceil(Math.max(...intervals.map(row=>row.end))/15)*15};
}
// Compress hidden hours equally for each day; never mix elapsed UTC hours with Berlin wall time.
export function axisPosition(minutes:number,width:number,window:TimeWindow,visibleDays?:number[]){
 const day=Math.floor(minutes/1440),minute=minutes-day*1440;
 const fraction=Math.max(0,Math.min(1,(minute-window.start)/(window.end-window.start)));
 if(!visibleDays)return (day+fraction)*width;
 if(!visibleDays.length)return 0;
 const index=visibleDays.indexOf(day);if(index>=0)return (index+fraction)*width;
 if(day<visibleDays[0])return (day-visibleDays[0]+fraction)*width;
 const last=visibleDays.at(-1)!;if(day>last)return (visibleDays.length+day-last-1+fraction)*width;
 return visibleDays.filter(value=>value<day).length*width;
}
export function axisMinutes(position:number,width:number,window:TimeWindow,visibleDays?:number[]){
 const day=Math.floor(position/width);
 const actualDay=visibleDays?(visibleDays[day]??(day<0?visibleDays[0]+day:visibleDays.at(-1)!+day-visibleDays.length+1)):day;
 return actualDay*1440+window.start+(position/width-day)*(window.end-window.start);
}
export function axisDragMinutes(start:number,delta:number,width:number,window:TimeWindow,endEdge=false,visibleDays?:number[]){
 if(delta===0)return 0;
 const invert=(position:number)=>endEdge&&Math.abs(position/width-Math.round(position/width))<1e-9?(visibleDays?.[Math.round(position/width)-1]??(Math.round(position/width)-1))*1440+window.end:axisMinutes(position,width,window,visibleDays);
 return invert(axisPosition(start,width,window,visibleDays)+delta)-invert(axisPosition(start,width,window,visibleDays));
}
export function axisSlot(from:string,width:number,offset:number,view:"day"|"week"|"month",days:number,window:TimeWindow,visibleDays?:number[]){
 if(!Number.isFinite(offset)||offset<0||offset>=width*days)throw new CalendarError("Bitte eine Stelle innerhalb der Zeitachse wählen.");
 const minutes=view==="month"?(visibleDays?.[Math.floor(offset/width)]??Math.floor(offset/width))*1440+Math.max(window.start,Math.min(480,window.end-15)):Math.floor(axisMinutes(offset,width,window,visibleDays)/15)*15;
 const start=wallInstant(new Date(Date.parse(from+"T00:00:00Z")+minutes*60000).toISOString().slice(0,16));
 return {start,end:new Date(Date.parse(start)+3600000).toISOString()};
}
