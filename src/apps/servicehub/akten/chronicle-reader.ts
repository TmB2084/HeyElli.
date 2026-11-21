import {createHash} from 'node:crypto';
import type {PdsTransport} from '../../../platform/pds/api/index.ts';
import {readCore,readList,ServiceReadError} from './reader.ts';
import {dispatchId,dispatchPdsDocuments} from './dispatch-reader.ts';
import {chronicleDate,type ChronicleEntry} from './chronicle-model.ts';
const text=(value:unknown)=>typeof value==='string'?value:'';
const label=(value:unknown,max=200)=>text(value).replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,max);
export async function readChronicleServices(api:PdsTransport,unit:string){
 dispatchId(unit);const records=await readList(api,'/service/liststoerungen'),matches=records.filter(row=>row.serviceAuftragEbene&&typeof row.serviceAuftragEbene==='object'&&(row.serviceAuftragEbene as Record<string,unknown>).objektUUID===unit);if(matches.length>500)throw new ServiceReadError('Die Anlagenchronik ist auf 500 Einsätze begrenzt. Bitte den Umfang mit der PDS-Administration abstimmen.',413);
 let employees=new Map<string,string>(),notice='';try{employees=new Map((await readList(api,'/mitarbeiter/listmitarbeiter')).map(row=>[text(row.uuid),[label(row.vorname),label(row.nachname)].filter(Boolean).join(' ')]));}catch{notice='Technikernamen konnten nicht vollständig geladen werden.';}
 const rows:ChronicleEntry[]=[],orders=new Map<string,{id:string;number:string}>();
 for(const row of matches){const incident=row.serviceAuftragEbene as Record<string,unknown>,order=row.serviceAuftrag as Record<string,unknown>;if(!order||typeof order!=='object')throw new ServiceReadError('Auftragszuordnung der Anlagenchronik fehlt.');const orderId=dispatchId(order.uuid),incidentId=dispatchId(incident.uuid),orderNumber=label(order.vorgangsNummer)||'Serviceauftrag',status=order.vorgangStatus as Record<string,unknown>|undefined;
  const main=incident.hauptmonteurUUID?employees.get(text(incident.hauptmonteurUUID))||'Haupttechniker derzeit nicht auflösbar':'Haupttechniker nicht zugeordnet',work=label(incident.auszufuehrendeArbeiten,240),entry:ChronicleEntry={id:'service:'+orderId+':'+incidentId,kind:'service',title:orderNumber,date:chronicleDate(incident.startZeitpunkt),dateKind:'Termin',detail:[work,main,label(status?.bezeichnung)].filter(Boolean).join(' · '),origin:'PDS · Serviceeinsatz',orderId,orderNumber};
  const previous=rows.find(item=>item.id===entry.id);if(previous&&JSON.stringify(previous)!==JSON.stringify(entry))throw new ServiceReadError('Widersprüchliche Einsatzdaten in der Anlagenchronik.');if(!previous)rows.push(entry);orders.set(orderId,{id:orderId,number:orderNumber});
 }
 return {rows,orders:[...orders.values()],notice};
}
export async function readChronicleReports(api:PdsTransport,unit:string,orders:unknown,sourceRevision:string){
 if(!Array.isArray(orders)||!orders.length||orders.length>4||new Set(orders).size!==orders.length)throw new ServiceReadError('Ungültige Berichtsauswahl.',400);orders.forEach(dispatchId);
 const rows:ChronicleEntry[]=[],errors:string[]=[];
 for(const orderId of orders as string[]){const core=await readCore(api,'order',orderId);if(!core.file.incidents?.some(row=>row.objectId===unit))throw new ServiceReadError('Der Auftrag gehört nicht zu dieser technischen Einheit.',403);
  const catalog=await dispatchPdsDocuments(api,orderId);errors.push(...catalog.errors.map(error=>(core.file.number||'Auftrag')+': '+error));
  for(const document of catalog.items){rows.push({id:'pds:'+document.key,kind:'report',title:document.name,date:chronicleDate(document.modified),dateKind:'Dokumentdatum',detail:(document.documentType||'Auftragsunterlage')+' · '+(core.file.number||'Serviceauftrag')+(core.file.incidents.some(row=>row.objectId&&row.objectId!==unit)?' · Auftrag betrifft mehrere Einheiten':''),origin:document.origin,url:'/api/service/einsatzmappe/dokument?'+new URLSearchParams({order:orderId,revision:sourceRevision,key:document.key}),orders:[{id:orderId,number:core.file.number||'Serviceauftrag'}]});}
 }
 if(rows.length>1000||Buffer.byteLength(JSON.stringify(rows))>1024*1024)throw new ServiceReadError('Die Berichte überschreiten das Budget der Anlagenchronik.',413);
 return {rows,errors};
}
export const chronicleSourceRevision=(source:unknown)=>createHash('sha256').update(JSON.stringify(source)).digest('hex');
