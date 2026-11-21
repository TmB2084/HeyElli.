import {pdsWebLink} from './pds-link.ts';
import {planningVersion} from '../../../platform/pds/simulator/planning.ts';
import type {PdsTransport} from '../../../platform/pds/api/index.ts';
import type {ServiceCustomer,ServiceObject,ServiceOrder,ServiceIncident,ServiceFile,ServiceFileExtras} from './model.ts';
type Row=Record<string,unknown>;
export class ServiceReadError extends Error {status:number;constructor(message:string,status=502){super(message);this.status=status;}}
const record=(value:unknown):Row=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new ServiceReadError('Unvollständige Antwort der Datenquelle.');return value as Row;};
const text=(value:unknown)=>typeof value==='string'?value:'';
const array=(value:unknown):unknown[]=>value===undefined?[]:Array.isArray(value)?value:(()=>{throw new ServiceReadError('Ungültige Liste der Datenquelle.');})();
const id=(row:Row)=>{const value=text(row.uuid);if(!value)throw new ServiceReadError('Kennung in der Datenquelle fehlt.');return value;};
const costCarrier=(value:unknown)=>{if(value===undefined||value===null)return undefined;const row=record(value);const number=text(row.nummer),name=text(row.bezeichnung);if(!number&&!name)return undefined;return {number,name};};
const status=(value:unknown)=>value?text(record(value).bezeichnung):'';
const address=(value:unknown)=>{if(!value)return '';const row=record(value);return [text(row.strasse),[text(row.plz),text(row.ort)].filter(Boolean).join(' ')].filter(Boolean).join(', ');};
export async function readList(api:PdsTransport,path:string):Promise<Row[]>{
 const rows:Row[]=[];let bytes=0;
 for(let page=0;page<40;page++){
  const result=record(await api.request('POST',path,{page,entriesPerPage:500}));
  if(!Number.isSafeInteger(result.totalHitCount)||Number(result.totalHitCount)<0||!Array.isArray(result.resultList))throw new ServiceReadError('Ungültige Listenantwort der Datenquelle.');
  const items=result.resultList.map(record);if(items.length>500)throw new ServiceReadError('Ungültige Seitengröße der Datenquelle.');
  bytes+=Buffer.byteLength(JSON.stringify(items));if(bytes>16*1024*1024)throw new ServiceReadError('Abfragebudget erreicht. Bitte den Datenumfang mit der Administration begrenzen.',413);
  rows.push(...items);if(rows.length>=Number(result.totalHitCount))return rows;
  if(!items.length)throw new ServiceReadError('Die Datenquelle liefert eine unvollständige Liste.');
 }
 throw new ServiceReadError('Zu viele Datensätze für die Serviceübersicht. Bitte den Datenumfang mit der PDS-Administration abstimmen.');
}
function incident(value:unknown,employees:Map<string,string>,loading=false):ServiceIncident{
 const row=record(value),technicianId=text(row.hauptmonteurUUID);
 return {intervalId:text(row.intervallUUID),technicianId,companionIds:array(row.weiteremonteureUUIDs).map(text),planningVersion:planningVersion(row),id:id(row),objectId:text(row.objektUUID),work:text(row.auszufuehrendeArbeiten),status:status(row.status),start:text(row.startZeitpunkt),end:text(row.endZeitpunkt),technician:technicianId?(employees.get(technicianId)||(loading?'Name noch nicht geladen':'Mitarbeiter nicht verfügbar')):'',companions:array(row.weiteremonteureUUIDs).map(value=>employees.get(text(value))||(loading?'Name noch nicht geladen':'Mitarbeiter nicht verfügbar'))};
}
export async function readOverview(api:PdsTransport){
 const [rows,people,objectRows,employeeRows]=await Promise.all([readList(api,'/service/liststoerungen'),readList(api,'/person/listkunden'),readList(api,'/objekt/listobjekte'),readList(api,'/mitarbeiter/listmitarbeiter')]);
 const employees=new Map(employeeRows.map(row=>[id(row),[text(row.vorname),text(row.nachname)].filter(Boolean).join(' ')]));
 const customers:ServiceCustomer[]=people.map(row=>({id:id(row),name:text(row.name)||'Kunde ohne Namen',number:row.kundenRolle?text(record(row.kundenRolle).kundennummer):''}));
 const objects:ServiceObject[]=objectRows.map(row=>({id:id(row),name:text(row.bezeichnung)||'Objekt ohne Namen',customerId:text(row.personUUID),parentId:text(row.parentUUID),type:text(row.typ),address:address(row.standort)}));
 const grouped=new Map<string,ServiceOrder>();
 for(const row of rows){const service=record(row.serviceAuftrag),key=id(service);let order=grouped.get(key);if(!order){order={id:key,number:text(service.vorgangsNummer)||'Ohne Nummer',title:text(service.bezeichnung),status:status(service.vorgangStatus),customerId:text(service.personUUID),incidents:[]};grouped.set(key,order);}const entry=incident(row.serviceAuftragEbene,employees);if(!order.incidents.some(existing=>existing.id===entry.id))order.incidents.push(entry);}
 return {orders:[...grouped.values()].sort((a,b)=>a.number.localeCompare(b.number,'de',{numeric:true})),customers,objects};
}
export async function readCore(api:PdsTransport,kind:ServiceFile['kind'],uuid:string){
 const paths={order:'/service/details',customer:'/person/details',object:'/objekt/details'};
 const row=record(await api.request('POST',paths[kind],{uuid}));if(text(row.uuid)!==uuid)throw new ServiceReadError('Der ausgewählte Eintrag ist nicht mehr verfügbar.',404);const webLink=pdsWebLink(row.webLink);
 let file:ServiceFile;
 if(kind==='order')file={kind,webLink,name:text(row.bezeichnung)||text(row.vorgangsNummer)||'Serviceauftrag',number:text(row.vorgangsNummer),status:status(row.vorgangStatus),customerId:text(row.personUUID),incidents:array(row.rootEbene?record(row.rootEbene).ebenen:undefined).map(value=>incident(value,new Map(),true))};
 else if(kind==='object')file={kind,webLink,name:text(row.bezeichnung)||'Objekt',customerId:text(row.personUUID),objectId:uuid,objectType:text(row.typ),address:address(row.standort),fields:array(row.objektInfoFelder).map(value=>{const field=record(value);return {name:text(field.bezeichnung),value:text(field.wert)};}).filter(field=>field.name&&field.value)};
 else file={kind,webLink,name:text(row.name)||'Kunde',number:row.kundenRolle?text(record(row.kundenRolle).kundennummer):'',customerId:uuid,address:address(row.hauptanschrift??array(row.postKommunikationswege)[0]),contacts:array(row.ansprechpartner).map(value=>{const entry=record(value),person=record(entry.person);return {name:text(person.name)||'Ansprechpartner',phones:array(entry.ekommunikationswege).map(value=>{const phone=record(value);return ['FESTNETZ','MOBIL'].includes(text(phone.typ))&&phone.kategorie==='GESCHAEFTLICH'?text(phone.value):'';}).filter(Boolean)};})};
 return {file,row};
}
export async function readExtras(api:PdsTransport,core:Awaited<ReturnType<typeof readCore>>,signal?:AbortSignal):Promise<ServiceFileExtras>{
 const {file,row}=core,extras:ServiceFileExtras={};signal?.throwIfAborted();
 if(file.kind==='order'){
  try{const employees=new Map((await readList(api,'/mitarbeiter/listmitarbeiter')).map(row=>[id(row),[text(row.vorname),text(row.nachname)].filter(Boolean).join(' ')]));extras.incidents=array(row.rootEbene?record(row.rootEbene).ebenen:undefined).map(value=>incident(value,employees));}
  catch{signal?.throwIfAborted();extras.incidents=file.incidents?.map(entry=>({...entry,technician:entry.technicianId?'Name derzeit nicht verfügbar':'',companions:(entry.companionIds??[]).map(()=>'Name derzeit nicht verfügbar')}));extras.extraNotice='Technikernamen konnten nicht aktualisiert werden. Die Terminangaben bleiben verfügbar.';}
 }
 if(file.kind==='object')await Promise.all([
  (async()=>{const costId=text(row.kstKtrUUID);if(!costId)return;try{
   const rows=(await Promise.all([readList(api,'/administration/listkostentraeger'),readList(api,'/administration/listkostenstelle')])).flat().filter(item=>text(item.uuid)===costId);
   const matches=rows.map(costCarrier).filter(value=>value!==undefined);
   if(!matches.length||matches.some(value=>value.number!==matches[0].number||value.name!==matches[0].name))throw new ServiceReadError('Kostenreferenz nicht eindeutig.');
   extras.costCarrier=matches[0];
  }catch{signal?.throwIfAborted();extras.costCarrierError='Kostenträger konnte nicht aufgelöst werden. Bitte die API-Berechtigung und Verbindung prüfen.';}})(),
  (async()=>{try{const values=await api.request('POST','/wartungsvertrag/listvertraegebyobjekt',{uuid:id(row)});if(!Array.isArray(values))throw new ServiceReadError('Ungültige Vertragsliste.');extras.contracts=values.map(value=>{const contract=record(value);id(contract);const maintenance=contract.wartung?record(contract.wartung):{},billing=contract.rechnung?record(contract.rechnung):{};return {id:id(contract),maintenanceCostCarrier:costCarrier(maintenance.kstKtr),billingCostCarrier:costCarrier(billing.kstKtr),name:text(maintenance.bezeichnung)||'Wartungsvertrag',description:text(maintenance.beschreibung)||text(maintenance.leistungsumfang)};});}catch{signal?.throwIfAborted();extras.contractError='Wartungsverträge konnten nicht geladen werden. Bitte die API-Berechtigung und Verbindung prüfen.';}})()
 ]);
 signal?.throwIfAborted();return extras;
}
// Combined reader retained for CLI/domain callers; the UI requests core and extras separately.
export async function readFile(api:PdsTransport,kind:ServiceFile['kind'],uuid:string):Promise<ServiceFile>{const core=await readCore(api,kind,uuid);return {...core.file,...await readExtras(api,core)};}
