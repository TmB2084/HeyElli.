import {createHash,randomUUID} from "node:crypto";
import type {PdsCalendar} from "./calendar.ts";
import {CalendarError,checkChange,checkCreate,applyOptions,eventOptions,berlinWall,addDays,continuationPlan,continuationNotes,planningWarnings,transactionTypes,type CalendarEvent,type CalendarCreation,type ContinuationLink} from "../../../apps/planboard/kalender/domain.ts";
const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
export class PdsCalendarContinuation {
 private calendar:PdsCalendar;private partCalendar:(key:string)=>PdsCalendar;private allowServiceFreeContinuations:boolean;
 constructor(calendar:PdsCalendar,partCalendar:(key:string)=>PdsCalendar,options:{allowServiceFreeContinuations?:boolean}={}){this.calendar=calendar;this.partCalendar=partCalendar;this.allowServiceFreeContinuations=options.allowServiceFreeContinuations??false;}
 async handle(raw:unknown,creation:boolean,operationId?:string){
  const body=raw as {continuationChoice?:unknown;continuationHash?:unknown;acceptPlanningWarnings?:unknown;operationId?:unknown};
  const input=creation?checkCreate(raw):checkChange(raw);
  if(body.continuationChoice!==undefined&&!["single","split"].includes(String(body.continuationChoice)))throw new CalendarError("Ungültige Fortsetzungsauswahl.");
  if(body.continuationChoice==="single")return null;
  const requestedId=operationId??body.operationId??randomUUID();if(typeof requestedId!=="string"||!/^[a-f0-9-]{36}$/.test(requestedId))throw new CalendarError("Ungültige Fortsetzungskennung.");
  const changed=creation?undefined:checkChange(raw),created=creation?checkCreate(raw):undefined;
  const source=changed?await this.calendar.details(changed.id):undefined;
  const proposed:CalendarEvent=source&&changed?{...applyOptions(source,changed.options??{}),start:changed.start,end:changed.end,resourceIds:changed.resourceIds,...(changed.title!==undefined?{title:changed.title}:{}),...(changed.notes!==undefined?{notes:changed.notes}:{}),...(changed.mainTechnicianId?{mainTechnicianId:changed.mainTechnicianId}:{})}:applyOptions({id:"continuation-new",title:created!.title,start:created!.start,end:created!.end,resourceIds:created!.resourceIds,status:"GEPLANT",type:created!.type??"FREIER",notes:created!.notes,fixed:false,allDay:false,categories:[]},created!.options??{});
  if(source&&changed&&Date.parse(source.start)===Date.parse(changed.start)&&Date.parse(source.end)===Date.parse(changed.end))return null;
  if(source?.fixed)throw new CalendarError("Fixierte Termine können nicht aufgeteilt werden.",409);
  const from=berlinWall(proposed.start).slice(0,10),data=await this.calendar.list(from,addDays(from,61)),plan=continuationPlan(data,proposed,from);
  if(!plan.required){if(body.continuationChoice==="split"&&plan.reason)throw new CalendarError(plan.reason);return null;}
  if(plan.serviceCopy&&!this.allowServiceFreeContinuations){plan.reason="Zusätzliche native Service-Störungstermine sind über die dokumentierte PDS-API noch nicht anlegbar. Die freie HeyElli-Fortsetzung ist für diese Anbindung nicht freigegeben.";if(body.continuationChoice==="split")throw new CalendarError(plan.reason);}
  const planHash=hash(plan.segments),fingerprint=hash(input);
  const preview={continuationPlan:plan,continuationHash:planHash,operationId:requestedId};
  if(body.continuationChoice!=="split"||body.continuationHash!==planHash)return {preview};
  const existing=data.events.filter(event=>event.continuation?.operationId===requestedId);
  if(existing.some(event=>event.continuation?.fingerprint!==fingerprint||event.continuation?.planHash!==planHash))throw new CalendarError("Eine Fortsetzung wurde bereits mit anderen Daten teilweise gespeichert. Bitte neu laden und prüfen.",409);
  const plannedEvents=plan.segments.map((segment,index)=>({...proposed,id:index===0?proposed.id:`continuation-preview-${index}`,start:segment.start,end:segment.end}));
  const warnings=plannedEvents.flatMap((event,index)=>planningWarnings({...data,events:[...data.events.filter(value=>value.id!==proposed.id&&value.continuation?.operationId!==requestedId),...plannedEvents.filter((_,other)=>other!==index)]},event));
  const unique=[...new Map(warnings.map(warning=>[warning.resourceId+warning.kind+warning.message,warning])).values()];
  if(unique.length&&body.acceptPlanningWarnings!==true)return {warnings:unique};
  const service=proposed.type==="SERVICEAUFTRAGEBENE"||proposed.continuation?.serviceCopy;
  if(service&&(!proposed.serviceIncidentId||!proposed.link?.id))throw new CalendarError("Die bestehende Serviceauftragsebene fehlt.");
  const options={...eventOptions(proposed),fixed:false,allDay:false};
  const templates=plan.segments.map((segment,index)=>{
   const link:ContinuationLink={operationId:requestedId,fingerprint,planHash,part:index,sourceId:source?.id??requestedId,...(service?{serviceCopy:!source||index>0||!!source.continuation?.serviceCopy,serviceId:proposed.link!.id,incidentId:proposed.serviceIncidentId,mainId:proposed.resourceIds.includes(proposed.mainTechnicianId??"")?proposed.mainTechnicianId:proposed.resourceIds[0]}:{})};
   const notes=continuationNotes(proposed.notes??"",link);if(notes.length>4000)throw new CalendarError("Die Beschreibung ist für die zusätzliche Fortsetzungsreferenz zu lang (maximal 4000 Zeichen inklusive Referenz).");
   const type=created?.type??(proposed.link?.type==="PROJEKT"?"PROJEKT":proposed.link&&Object.hasOwn(transactionTypes,proposed.link.type)?"VORGANG":"FREIER");
   const template:CalendarCreation={title:proposed.title,notes,start:segment.start,end:segment.end,resourceIds:proposed.resourceIds,options,type,...(created?.referenceId?{referenceId:created.referenceId,referenceType:created.referenceType}:proposed.link&&["PROJEKT","VORGANG"].includes(type)?{referenceId:proposed.link.id,referenceType:proposed.link.type}:{})};
   checkCreate(template);return template;
  });
  const saved:CalendarEvent[]=[];
  try{for(let index=0;index<templates.length;index++){
   const template=templates[index],already=existing.find(event=>event.continuation?.part===index);
   if(already){if(Date.parse(already.start)!==Date.parse(template.start)||Date.parse(already.end)!==Date.parse(template.end)||already.title!==template.title||[...already.resourceIds].sort().join()!==[...template.resourceIds].sort().join())throw new CalendarError("Ein bereits gespeicherter Teil wurde zwischenzeitlich verändert.",409);saved.push(already);continue;}
   if(index===0&&source&&changed)saved.push(await this.calendar.update({...changed,start:template.start,end:template.end,notes:template.notes,expected:{...changed.expected,notes:source.notes??""}}));
   else saved.push(await this.partCalendar(`${requestedId}:${index}`).create(template));
  }}catch(error){if(saved.length)throw new CalendarError(`${saved.length} von ${templates.length} Terminen wurden gespeichert. Bitte dieselbe Anfrage erneut bestätigen; vorhandene Teile werden wiederverwendet. ${error instanceof Error?error.message:""}`,502);throw error;}
  return {saved:{...saved[0],continuationEvents:saved}};
 }
}
