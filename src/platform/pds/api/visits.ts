import {PdsProtocolError,type PdsTransport} from "./protocol.ts";
import type {PdsCalendar} from "./calendar.ts";
// Termine vor Ort: PDS bietet Termine nur je Mitarbeiter und Zeitraum (/termin/listplanung, /termin/listterminebymitarbeiter),
// nicht je Kunde oder Objekt. Daher Planung aller Ressourcen laden, Details nachladen und nach objektUUID filtern.
export type Visit={id:string;title:string;start:string;end:string;allDay:boolean;status:"GEPLANT"|"VORGEMERKT";type:string;objectId:string;orderId?:string;orderType?:string;employeeIds:string[];address?:string};
export const visitTypes=new Set(["SERVICEAUFTRAGEBENE","TAETIGKEIT","VORGANG","PROJEKT"]);
const day=(date:Date)=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Berlin"}).format(date);
type Row=Record<string,unknown>;
export function readVisit(value:unknown):Visit|null{
 const row=value as Row;if(!row||typeof row!=="object"||typeof row.uuid!=="string")throw new PdsProtocolError("Ungültiger Termin.");
 if(!visitTypes.has(String(row.typ))||typeof row.objektUUID!=="string"||!row.objektUUID||(row.status!=="GEPLANT"&&row.status!=="VORGEMERKT"))return null;
 if(typeof row.startZeitpunkt!=="string"||typeof row.endZeitpunkt!=="string"||!Number.isFinite(Date.parse(row.startZeitpunkt))||!Number.isFinite(Date.parse(row.endZeitpunkt)))throw new PdsProtocolError("Termin ohne gültigen Zeitraum.");
 const address=row.anschrift as Row|undefined;
 return {id:row.uuid,title:typeof row.bezeichnung==="string"?row.bezeichnung.slice(0,200):"Termin",start:row.startZeitpunkt,end:row.endZeitpunkt,allDay:row.ganzerTag===true,status:row.status,type:String(row.typ),objectId:row.objektUUID,...(typeof row.vorgangUUID==="string"?{orderId:row.vorgangUUID}:{}),...(typeof row.vorgangstyp==="string"?{orderType:row.vorgangstyp}:{}),employeeIds:Array.isArray(row.mitarbeiterUUIDs)?row.mitarbeiterUUIDs.filter((id):id is string=>typeof id==="string"):[],...(address?{address:[address.strasse,[address.plz,address.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ")}:{})};
}
export class PdsVisits{
 private api:PdsTransport;private calendar:PdsCalendar;
 constructor(api:PdsTransport,calendar:PdsCalendar){this.api=api;this.calendar=calendar;}
 // Kommende Termine (ab jetzt, höchstens 56 Tage) an den angegebenen Objekten/Einheiten.
 async upcoming(objectIds:Iterable<string>,now=new Date(),days=56):Promise<Visit[]>{
  const wanted=new Set(objectIds);if(!wanted.size)return [];
  if(days<1||days>60)throw new PdsProtocolError("Zeitraum für Termine vor Ort ungültig.");
  const from=day(now),to=day(new Date(now.getTime()+days*86400000));
  const resources=await this.calendar.resources(from,to),ids:string[]=[];
  for(let i=0;i<resources.length;i+=500){
   for(let page=0;page<100;page++){
    const result=await this.api.request("POST","/termin/listplanung",{mitarbeiterUUIDs:resources.slice(i,i+500).map(item=>item.id),zeitraum:{vonDatum:from,bisDatum:to},page,entriesPerPage:500}) as {totalHitCount?:unknown;resultList?:unknown};
    if(!Array.isArray(result?.resultList)||typeof result.totalHitCount!=="number")throw new PdsProtocolError("Ungültige Terminplanung.");
    for(const plan of result.resultList as Row[])if(typeof plan?.uuid==="string"&&!ids.includes(plan.uuid))ids.push(plan.uuid);
    if((page+1)*500>=result.totalHitCount||!result.resultList.length)break;
   }
  }
  const visits:Visit[]=[];
  for(let i=0;i<ids.length;i+=500){
   const batch=await this.api.request("POST","/termin/detailsbatch",{uuids:ids.slice(i,i+500)});
   if(!Array.isArray(batch))throw new PdsProtocolError("Termindetails fehlen.");
   for(const item of batch){const visit=readVisit(item);if(visit&&wanted.has(visit.objectId)&&Date.parse(visit.end)>=now.getTime())visits.push(visit);}
  }
  return visits.sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
 }
}
