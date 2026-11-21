import type {PdsTransport} from "./protocol.ts";
import {PdsProtocolError} from "./protocol.ts";
import {addDays,unionIntervals,subtractIntervals,type Resource,type CalendarWorkingTime,type WorkInterval} from "../../../apps/planboard/kalender/domain.ts";
type ScheduleRow={mitarbeiterUUID:string;modellUUID:string;modellBezeichnung:string;gueltigVon:string;gueltigBis:string;wochentag:number;sollMinuten:number;beginn:string;ende:string;feiertagsgruppeUUID:string};
function fail(message:string):never{throw new PdsProtocolError(message);}
const date=(value:unknown):value is string=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
function minute(value:string){if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)&&value!=="24:00")fail("Ungültige Arbeitszeit.");return Number(value.slice(0,2))*60+Number(value.slice(3));}
export async function readWorkingTime(api:PdsTransport,name:string,resources:Resource[],from:string,to:string):Promise<CalendarWorkingTime>{
 const views=await api.request("GET","/datenansichten/list");if(!Array.isArray(views)||!views.some(view=>view?.name===name))fail("Arbeitszeit-Datenansicht ist nicht verfügbar.");
 const rows:ScheduleRow[]=[];let completed=false;
 for(let page=0;page<1000;page++){
  const values=await api.request("POST","/datenansichten/listdaten",{name,page,entriesPerPage:500});if(!Array.isArray(values)||values.length>500)fail("Ungültige Arbeitszeit-Datenansicht.");
  for(const row of values){if(!row||typeof row!=="object"||["mitarbeiterUUID","modellUUID","modellBezeichnung","feiertagsgruppeUUID"].some(key=>typeof row[key]!=="string"||!row[key]||row[key].length>120)||!date(row.gueltigVon)||!date(row.gueltigBis)||row.gueltigBis<row.gueltigVon||!Number.isInteger(row.sollMinuten)||row.sollMinuten<0||row.sollMinuten>1440||!Number.isInteger(row.wochentag)||row.wochentag<1||row.wochentag>7||typeof row.beginn!=="string"||typeof row.ende!=="string"||(row.beginn==="")!==(row.ende===""))fail("Unvollständiges Arbeitszeitmodell.");if(row.beginn&&minute(row.ende)<=minute(row.beginn))fail("Arbeitszeitfenster müssen innerhalb eines Tages liegen.");rows.push(row as ScheduleRow);}
  if(values.length<500){completed=true;break;}
 }
 if(!completed)fail("Zu viele Arbeitszeit-Seiten.");
 const [holidays,groups]=await Promise.all([api.request("GET","/administration/listfeiertage"),api.request("GET","/administration/listfeiertagsgruppen")]);
 if(!Array.isArray(holidays)||!Array.isArray(groups))fail("Feiertagsdaten fehlen.");
 return {source:"view",resources:resources.map(resource=>({resourceId:resource.id,days:Array.from({length:(Date.parse(to)-Date.parse(from))/86400000+1},(_,index)=>{
  const day=addDays(from,index),weekday=(new Date(day+"T12:00:00Z").getUTCDay()+6)%7+1;
  const applicable=rows.filter(row=>row.mitarbeiterUUID===resource.id&&row.gueltigVon<=day&&row.gueltigBis>=day&&row.wochentag===weekday);
  if(!applicable.length)return null;
  const first=applicable[0];if(applicable.some(row=>row.sollMinuten!==first.sollMinuten||row.modellUUID!==first.modellUUID||row.modellBezeichnung!==first.modellBezeichnung||row.feiertagsgruppeUUID!==first.feiertagsgruppeUUID)||applicable.some(row=>!row.beginn)&&applicable.length!==1)fail("Widersprüchliche Arbeitszeitmodelle.");
  const intervals:WorkInterval[]=applicable.filter(row=>row.beginn).map(row=>({start:minute(row.beginn),end:minute(row.ende)})).sort((a,b)=>a.start-b.start);
  if(intervals.some((value,index)=>index>0&&value.start<intervals[index-1].end))fail("Überlappende Arbeitszeitfenster.");
  if(!intervals.length&&first.sollMinuten!==0||intervals.length&&first.sollMinuten===0)fail("Sollzeit passt nicht zum Arbeitszeitmodell.");
  const pauses=intervals.slice(1).flatMap((value,index)=>value.start>intervals[index].end?[{start:intervals[index].end,end:value.start}]:[]);
  const group=groups.find(group=>group?.uuid===first.feiertagsgruppeUUID);if(!group||!Array.isArray(group.aktiveFeiertage)||group.aktiveFeiertage.some((id:unknown)=>typeof id!=="string")||new Set(group.aktiveFeiertage).size!==group.aktiveFeiertage.length)fail("Feiertagsgruppe des Arbeitszeitmodells fehlt.");
  const excluded:WorkInterval[]=[],names:string[]=[];
  for(const id of group.aktiveFeiertage){const holiday=holidays.find(holiday=>holiday?.uuid===id);if(!holiday)fail("Feiertag der Gruppe fehlt.");if(holiday.aktiv===false)continue;if(!date(holiday.naechstesDatum)||!["NEIN","VORMITTAGS","NACHMITTAGS"].includes(holiday.halberTag))fail("Feiertagsdatum oder Tagesanteil fehlt.");if(holiday.naechstesDatum!==day)continue;names.push(String(holiday.bezeichnung??id));excluded.push(holiday.halberTag==="NEIN"?{start:0,end:1440}:holiday.halberTag==="VORMITTAGS"?{start:0,end:720}:{start:720,end:1440});}
  const outside=resource.planningFrom&&day<resource.planningFrom||resource.planningTo&&day>resource.planningTo;
  const available=subtractIntervals(unionIntervals(intervals),excluded),minutes=(values:WorkInterval[])=>values.reduce((sum,value)=>sum+value.end-value.start,0);
  return {targetMinutes:outside?0:intervals.length?first.sollMinuten*minutes(available)/minutes(intervals):0,date:day,modelId:first.modellUUID,modelName:first.modellBezeichnung,intervals:outside?[]:available,breaks:pauses,...(names.length?{holiday:names.join(" · ")}:{})};
 }).filter((value):value is NonNullable<typeof value>=>value!==null)}))};
}
