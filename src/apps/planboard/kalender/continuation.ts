import {addDays,berlinWall,wallInstant,type CalendarData,type CalendarEvent} from "./model.ts";
import {subtractIntervals,type WorkInterval} from "./working-time.ts";
export type ContinuationSegment={start:string;end:string;minutes:number};
export type ContinuationPlan={segments:ContinuationSegment[];required:boolean;resourceNames?:string[];reason?:string;serviceCopy?:boolean};
export type ContinuationLink={operationId:string;fingerprint:string;planHash:string;part:number;sourceId:string;serviceCopy?:boolean;serviceId?:string;incidentId?:string;mainId?:string};
const marker="\n[HeyElli-Fortsetzung]";
export function readContinuation(text:string):{notes:string;link?:ContinuationLink}{
 const index=text.lastIndexOf(marker);if(index<0)return {notes:text};
 try{const value=JSON.parse(text.slice(index+marker.length));
  if(!value||!["operationId","fingerprint","planHash","sourceId"].every(key=>typeof value[key]==="string"&&value[key].length>0&&value[key].length<=120)||!Number.isInteger(value.part)||value.part<0||value.part>124||value.serviceCopy!==undefined&&typeof value.serviceCopy!=="boolean"||["serviceId","incidentId","mainId"].some(key=>value[key]!==undefined&&(typeof value[key]!=="string"||!value[key]||value[key].length>120)))return {notes:text};
  if(value.serviceCopy&&!["serviceId","incidentId","mainId"].every(key=>typeof value[key]==="string"&&value[key]))return {notes:text};
  return {notes:text.slice(0,index),link:value as ContinuationLink};
 }catch{return {notes:text};}
}
export function continuationNotes(notes:string,link:ContinuationLink){return readContinuation(notes).notes+marker+JSON.stringify(link);}
export function continuationPlan(data:CalendarData,proposal:CalendarEvent,from:string,days=62):ContinuationPlan{
 if(proposal.allDay||["URLAUB","ABWESENHEIT","PRIVATE_ABWESENHEIT"].includes(proposal.type))return {segments:[],required:false};
 const missing=(reason:string):ContinuationPlan=>({segments:[],required:false,reason});
 let remaining=(Date.parse(proposal.end)-Date.parse(proposal.start))/60000;const segments:ContinuationSegment[]=[];
 for(let index=0;index<days&&remaining>0;index++){
  const date=addDays(from,index);let common:WorkInterval[]=[{start:0,end:1440}];
  for(const id of proposal.resourceIds){
   const day=data.workingTime?.resources.find(resource=>resource.resourceId===id)?.days.find(day=>day.date===date);if(!day)return missing("Die gemeinsamen Arbeitszeiten sind nicht vollständig verfügbar.");
   let windows=day.intervals.map(value=>({...value}));
   const start=Date.parse(wallInstant(date+"T00:00")),end=Date.parse(wallInstant(addDays(date,1)+"T00:00"));
   for(const event of data.events.filter(event=>event.id!==proposal.id&&event.resourceIds.includes(id)&&event.status==="GEPLANT"&&Date.parse(event.start)<end&&Date.parse(event.end)>start)){
    if(event.type==="URLAUB"&&!event.vacationApproval)return missing("Für Urlaub im Planungszeitraum fehlt der Genehmigungsstatus.");
    if(["ABWESENHEIT","PRIVATE_ABWESENHEIT"].includes(event.type)||event.type==="URLAUB"&&event.vacationApproval==="GENEHMIGT"){
     const a=Math.max(start,Date.parse(event.start)),b=Math.min(end,Date.parse(event.end));
     const minute=(instant:number)=>instant===end?1440:Number(berlinWall(new Date(instant).toISOString()).slice(11,13))*60+Number(berlinWall(new Date(instant).toISOString()).slice(14,16));
     windows=subtractIntervals(windows,[{start:minute(a),end:minute(b)}]);
    }
   }
   common=common.flatMap(a=>windows.map(b=>({start:Math.max(a.start,b.start),end:Math.min(a.end,b.end)})).filter(value=>value.end>value.start));
  }
  for(const window of common){
   const toInstant=(minute:number)=>wallInstant(minute===1440?addDays(date,1)+"T00:00":date+"T"+String(Math.floor(minute/60)).padStart(2,"0")+":"+String(minute%60).padStart(2,"0"));
   const start=Math.max(Date.parse(toInstant(window.start)),Date.parse(proposal.start)),end=Date.parse(toInstant(window.end));if(start>=end)continue;
   let minutes=Math.min(remaining,(end-start)/60000);if(remaining>minutes&&remaining-minutes<15)minutes-=15-(remaining-minutes);if(minutes<15)continue;
   segments.push({start:new Date(start).toISOString(),end:new Date(start+minutes*60000).toISOString(),minutes});remaining-=minutes;if(remaining<=0)break;
  }
 }
 if(remaining>0)return missing("Innerhalb der nächsten 62 Tage wurden nicht genügend gemeinsame Arbeitszeiten gefunden.");
 if(segments.length>120)return missing("Die Aufteilung würde mehr als 120 Kalendereinträge erzeugen.");
 const dates=new Set(segments.map(segment=>berlinWall(segment.start).slice(0,10)));
 return {segments,resourceNames:proposal.resourceIds.map(id=>data.resources.find(resource=>resource.id===id)?.name??id),required:dates.size>1||!!segments.length&&berlinWall(segments[0].start).slice(0,10)!==from,serviceCopy:proposal.type==="SERVICEAUFTRAGEBENE"||proposal.continuation?.serviceCopy};
}
