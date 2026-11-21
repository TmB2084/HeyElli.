import {contractDefaultColors,type ContractService} from "./contract-service.ts";
import {defaultColorLayouts,type ColorLayouts,type ColorSource} from "./color-layout.ts";
import type {StatusCatalog} from "./status-catalog.ts";
import {checkOptions,type CalendarOptions,type CalendarAddress,type CalendarCategory,type CalendarLink,type OrderStatus} from "./options.ts";
export type ResourceGroup={id:string;name:string};
export type Resource={planningAvailable?:boolean;groupIds?:string[];planningFrom?:string;planningTo?:string;id:string;name:string;number:string;group:string};
export type VacationApproval="BEANTRAGT"|"GENEHMIGT";
export const vacationApprovalLabels={BEANTRAGT:"Beantragt",GENEHMIGT:"Genehmigt"};
export const vacationDefaultColors={BEANTRAGT:"#00c5c8",GENEHMIGT:"#00c5c8"};
export type CalendarEvent={continuationEvents?:CalendarEvent[];continuation?:import("./continuation.ts").ContinuationLink;vacationApproval?:VacationApproval;id:string;title:string;start:string;end:string;resourceIds:string[];status:"VORGEMERKT"|"FREI"|"GEPLANT";type:string;contractService?:ContractService;pimSync?:boolean;objectId?:string;address?:CalendarAddress;link?:CalendarLink;orderStatus?:OrderStatus;customer?:{id:string;name:string};location?:string;addressText?:string;notes?:string;mainTechnicianId?:string;serviceIncidentId?:string;companionTechnicianIds?:string[];fixed:boolean;allDay:boolean;categories:string[]};
export type CalendarColor={vacationApproval?:VacationApproval;status?:string;typ?:string;category?:string;orderStatus?:string;orderStatusName?:string;orderType?:string;contractService?:"MIT"|"OHNE";farbe:string};
export type CalendarData={source?:{mode:"simulator"|"pds-readonly";id:string|null};permissions?:{write:boolean;admin:boolean;serviceRead?:boolean};resourceGroups?:ResourceGroup[];workingTime?:import("./working-time.ts").CalendarWorkingTime;vacationApprovalSource?:"view"|"unavailable";resources:Resource[];events:CalendarEvent[];colors:CalendarColor[];categoryOptions?:CalendarCategory[];statusCatalogs?:StatusCatalog[];pdsColors?:CalendarColor[];colorLayouts?:ColorLayouts;colorSource:"simulation"|"view"|"fallback"};
export type CalendarChange={id:string;start:string;end:string;resourceIds:string[];options?:CalendarOptions;title?:string;notes?:string;mainTechnicianId?:string;companionTechnicianIds?:string[];expected:{start:string;end:string;resourceIds:string[];options?:CalendarOptions;mainTechnicianId?:string;title?:string;notes?:string}};
export const statusLabels={GEPLANT:"Geplant",VORGEMERKT:"Vorgemerkt",FREI:"Frei"};
export class CalendarError extends Error {status:number;constructor(message:string,status=400){super(message);this.status=status;}}
export function berlinWall(instant:string){
  const parts=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(instant));
  const p=(key:string)=>parts.find(part=>part.type===key)?.value;
  return `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}`;
}
export function wallInstant(wall:string){
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(wall))throw new CalendarError("Ungültiges Datum.");
  const utc=Date.parse(wall+"Z");const found=[1,2].map(offset=>new Date(utc-offset*3600000)).filter(date=>Number.isFinite(date.getTime())&&berlinWall(date.toISOString())===wall);
  if(found.length!==1)throw new CalendarError("Die Uhrzeit ist ungültig oder beim Zeitwechsel mehrdeutig. Bitte eine andere Uhrzeit wählen.");
  return found[0].toISOString();
}
export function addDays(day:string,count:number){return new Date(Date.parse(day+"T12:00:00Z")+count*86400000).toISOString().slice(0,10);}
export function wallMinutes(instant:string){return Date.parse(berlinWall(instant)+"Z")/60000;}
export function moveEvent(event:CalendarEvent,operation:"move"|"start"|"end",minutes:number,fromResource:string,toResource:string):CalendarEvent {
  if(event.fixed)throw new CalendarError("Fixierte Termine können nicht verschoben werden.");
  const step=event.allDay?1440:15,delta=Math.round(minutes/step)*step;
  function shift(value:string){return wallInstant(new Date((wallMinutes(value)+delta)*60000).toISOString().slice(0,16));}
  const start=operation==="end"?event.start:shift(event.start),end=operation==="start"?event.end:shift(event.end);
  if(wallMinutes(end)-wallMinutes(start)<step)throw new CalendarError(`Die Mindestdauer beträgt ${event.allDay?"einen Tag":"15 Minuten"}.`);
  let resourceIds=[...event.resourceIds];
  if(operation==="move"&&fromResource!==toResource){
    if(!resourceIds.includes(fromResource)||resourceIds.includes(toResource))throw new CalendarError("Der Zielressource ist dieser Termin bereits zugeordnet.");
    resourceIds=resourceIds.map(id=>id===fromResource?toResource:id);
  }
  return {...event,start,end,resourceIds};
}
export function checkChange(raw:unknown):CalendarChange {
  if(!raw||typeof raw!=="object")throw new CalendarError("Ungültige Terminänderung.");
  const value=raw as CalendarChange;
  function ids(input:unknown,empty=false){return Array.isArray(input)&&(empty||input.length>0)&&input.length<=100&&input.every(id=>typeof id==="string"&&id.length>0&&id.length<=100)&&new Set(input).size===input.length;}
  function instant(input:unknown){return typeof input==="string"&&input.length<=40&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(input)&&Number.isFinite(Date.parse(input));}
  if(typeof value.id!=="string"||!value.id||value.id.length>100||!instant(value.start)||!instant(value.end)||!ids(value.resourceIds)||!value.expected||!instant(value.expected.start)||!instant(value.expected.end)||!ids(value.expected.resourceIds))throw new CalendarError("Ungültige Terminänderung.");
  if(value.options!==undefined){checkOptions(value.options);checkOptions(value.expected.options);}
  if(value.title!==undefined&&(typeof value.title!=="string"||!value.title.trim()||value.title.length>200||typeof value.expected.title!=="string"))throw new CalendarError("Bitte einen Titel mit maximal 200 Zeichen angeben.");
  if(value.notes!==undefined&&(typeof value.notes!=="string"||value.notes.length>4000||typeof value.expected.notes!=="string"))throw new CalendarError("Die Beschreibung darf maximal 4000 Zeichen enthalten.");
  if(value.mainTechnicianId!==undefined&&(typeof value.mainTechnicianId!=="string"||!value.mainTechnicianId||value.mainTechnicianId.length>100||value.companionTechnicianIds===undefined))throw new CalendarError("Ungültiger Haupttechniker.");
  if(value.companionTechnicianIds!==undefined&&(!ids(value.companionTechnicianIds,true)||typeof value.expected.mainTechnicianId!=="string"||!value.expected.mainTechnicianId||value.expected.mainTechnicianId.length>100))throw new CalendarError("Ungültige Begleittechniker-Zuordnung.");
  if(Date.parse(value.end)-Date.parse(value.start)<15*60000||Date.parse(value.end)-Date.parse(value.start)>62*86400000)throw new CalendarError("Ein Termin benötigt mindestens 15 Minuten; maximal 62 Tage.");
  return {id:value.id,start:new Date(value.start).toISOString(),end:new Date(value.end).toISOString(),resourceIds:[...value.resourceIds],...(value.options!==undefined?{options:checkOptions(value.options)}:{}),...(value.title!==undefined?{title:value.title.trim()}:{}),...(value.notes!==undefined?{notes:value.notes}:{}),...(value.mainTechnicianId!==undefined?{mainTechnicianId:value.mainTechnicianId}:{}),...(value.companionTechnicianIds!==undefined?{companionTechnicianIds:[...value.companionTechnicianIds]}:{}),expected:{...value.expected,resourceIds:[...value.expected.resourceIds]}};
}
export function checkRange(from:string,to:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))||new Date(from).toISOString().slice(0,10)!==from||new Date(to).toISOString().slice(0,10)!==to||to<from||Date.parse(to)-Date.parse(from)>62*86400000)throw new CalendarError("Bitte einen gültigen Zeitraum von maximal 62 Tagen wählen.");
}
export const fallbackColors:CalendarColor[]=[{typ:"ABWESENHEIT",farbe:"#f2d685"},{typ:"URLAUB",farbe:"#f4acac"},{typ:"PRIVATE_ABWESENHEIT",farbe:"#d4c1a0"}];
export function orderStatusColor(event:CalendarEvent,colors:CalendarColor[]){
 return colors.find(rule=>rule.orderType&&rule.orderType===event.link?.type&&rule.orderStatus!=="*"&&rule.orderStatus===event.orderStatus?.id)?.farbe;
}
export type ResolvedEventColor={color:string;source:ColorSource;rule?:CalendarColor;neutral?:boolean};
export function eventColorDetails(event:CalendarEvent,colors:CalendarColor[],layouts:ColorLayouts=defaultColorLayouts()){
 const neutral=event.orderStatus||event.link?"#cad0db":"#b9c2d1";
 function sourceColor(source:ColorSource):ResolvedEventColor|undefined {
  let rule:CalendarColor|undefined;
  if(source==="status")rule=colors.find(rule=>rule.orderType&&rule.orderType===event.link?.type&&rule.orderStatus!=="*"&&rule.orderStatus===event.orderStatus?.id);
  else if(source==="category")rule=colors.find(rule=>rule.category&&!rule.orderType&&event.categories?.includes(rule.category));
  else if(event.type==="URLAUB"&&event.vacationApproval)rule=colors.find(rule=>!rule.orderType&&rule.vacationApproval===event.vacationApproval)??{vacationApproval:event.vacationApproval,farbe:vacationDefaultColors[event.vacationApproval]};
  else if(event.type==="SERVICEAUFTRAGEBENE"&&(event.contractService==="MIT"||event.contractService==="OHNE"))rule=colors.find(rule=>!rule.orderType&&rule.contractService===event.contractService)??{contractService:event.contractService,farbe:contractDefaultColors[event.contractService]};
  else rule=colors.find(rule=>!rule.orderType&&rule.typ===event.type);
  return rule?{color:rule.farbe,source,rule}:undefined;
 }
 const layout=event.type==="URLAUB"?{main:"type" as const,secondary:null}:layouts[event.type]??{main:"type" as const,secondary:null};
 return {main:sourceColor(layout.main)??{color:neutral,source:layout.main,neutral:true},secondary:layout.secondary?sourceColor(layout.secondary):undefined};
}
export function eventColors(event:CalendarEvent,colors:CalendarColor[],layouts?:ColorLayouts){
 const resolved=eventColorDetails(event,colors,layouts);
 return {main:resolved.main.color,secondary:resolved.secondary?.color};
}
export function eventColor(event:CalendarEvent,colors:CalendarColor[],layouts?:ColorLayouts){return eventColors(event,colors,layouts).main;}

export type CalendarCreation={title:string;start:string;end:string;resourceIds:string[];notes:string;options?:CalendarOptions;type?:string;referenceId?:string;referenceType?:string};
export function checkCreate(raw:unknown):CalendarCreation {
  if(!raw||typeof raw!=="object")throw new CalendarError("Ungültiger neuer Termin.");
  const value=raw as CalendarCreation;
  if(typeof value.title!=="string"||!value.title.trim()||value.title.length>200||typeof (value.notes??"")!=="string"||(value.notes??"").length>4000)throw new CalendarError("Bitte einen Titel (max. 200 Zeichen) und eine Beschreibung bis 4000 Zeichen angeben.");
  const checked=checkChange({id:"new",start:value.start,end:value.end,resourceIds:value.resourceIds,expected:{start:value.start,end:value.end,resourceIds:value.resourceIds}});
  const type=value.type??"FREIER";
  if(!["FREIER","VORGANG","PROJEKT","ABWESENHEIT","PRIVATE_ABWESENHEIT"].includes(type))throw new CalendarError("Dieser Termintyp kann nicht über die Termin-API angelegt werden.");
  if(["VORGANG","PROJEKT"].includes(type)&&(typeof value.referenceId!=="string"||!value.referenceId||value.referenceId.length>100))throw new CalendarError("Bitte den Vorgang bzw. die Projektakte auswählen.");
  if(type==="VORGANG"&&!["AUFTRAG","ANGEBOT","BEDARFSMELDUNG","RECHNUNG","LIEFERSCHEIN","BESTELLUNG","WARENEINGANG","ABRUFAUFTRAG","GUTSCHRIFT","RUECKNAHME"].includes(value.referenceType??""))throw new CalendarError("Ungültiger Vorgangstyp.");
  return {title:value.title.trim(),start:checked.start,end:checked.end,resourceIds:checked.resourceIds,notes:value.notes??"",...(value.type!==undefined?{type}:{}),...(value.options!==undefined?{options:checkOptions(value.options)}:{}),...(value.referenceId?{referenceId:value.referenceId,referenceType:value.referenceType}:{})};
}
export function calendarSlot(from:string,dayWidth:number,offset:number,view:"day"|"week"|"month",days:number){
  checkRange(from,from);
  if(!Number.isFinite(dayWidth)||dayWidth<=0||!Number.isFinite(offset)||offset<0||offset>=dayWidth*days)throw new CalendarError("Bitte eine Stelle innerhalb der Zeitachse wählen.");
  const minutes=view==="month"?Math.floor(offset/dayWidth)*1440+8*60:Math.floor(offset/dayWidth*1440/15)*15;
  const wall=new Date(Date.parse(from+"T00:00:00Z")+minutes*60000).toISOString().slice(0,16);
  const start=wallInstant(wall);
  return {start,end:new Date(Date.parse(start)+60*60000).toISOString()};
}

export function checkDeletion(raw:unknown){
  if(!raw||typeof raw!=="object")throw new CalendarError("Ungültige Löschanfrage.");
  const value=raw as {id?:unknown;expected?:CalendarChange["expected"]};
  const checked=checkChange({id:value.id,start:value.expected?.start,end:value.expected?.end,resourceIds:value.expected?.resourceIds,expected:value.expected});
  return {id:checked.id,expected:checked.expected};
}

export type CalendarWrite=Pick<CalendarEvent,'start'|'end'|'resourceIds'|'categories'>;
