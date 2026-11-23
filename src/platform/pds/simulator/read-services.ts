import materialPositions from '../../../../database/seeds/pds-simulator/service-positions.json' with {type:'json'};
import dispatchDocuments from '../../../../database/seeds/pds-simulator/dispatch-documents.json' with {type:'json'};
import {simulatorContractReferences} from "./service-contracts.ts";
import {wallInstant} from "../../../apps/planboard/kalender/domain.ts";
import {objects,orders as fixtures} from "./fixtures.ts";
import type {openOrderStore} from "./order-store.ts";
type Store=ReturnType<typeof openOrderStore>;
export const serviceCalendarId=(incidentUUID:string)=>`sim-service-termin-${incidentUUID}`;
export function planningTeam(main:unknown,others:unknown,override?:Record<string,unknown>){
  const original=[String(main??""),...(Array.isArray(others)?others.filter((id):id is string=>typeof id==="string"):[])].filter(Boolean);
  const ids=Array.isArray(override?.mitarbeiterUUIDs)?override.mitarbeiterUUIDs as string[]:original;
  const explicit=typeof override?.hauptmonteurUUID==='string'&&ids.includes(override.hauptmonteurUUID)?override.hauptmonteurUUID:undefined;
  const primary=explicit??(ids.includes(String(main))?String(main):ids.find(id=>!original.includes(id))??ids[0]);
  return {hauptmonteurUUID:primary,weiteremonteureUUIDs:ids.filter(id=>id!==primary)};
}
export function serviceRecords(store:Store) {
  type Incident={intervallUUID?:string;wartungsvertragUUID?:string;uuid:string;objektUUID:string;auszufuehrendeArbeiten:string;bemerkung?:string;hauptmonteurUUID?:string;weiteremonteureUUIDs?:string[];startZeitpunkt?:string;endZeitpunkt?:string;status:{uuid:string;bezeichnung:string}};
  type Service={uuid:string;vorgangsNummer:string;bezeichnung:string;personUUID:string;bearbeiterUUID?:string;vorgangStatus:{uuid:string;bezeichnung:string};rootEbene:{ebenen:Incident[]}};
  const records=new Map<string,Service>();
  for(const row of fixtures)records.set(row.id,{uuid:row.id,vorgangsNummer:row.number,bezeichnung:row.description,personUUID:objects.find(object=>object.id===row.objectId)!.customerNumber,vorgangStatus:{uuid:row.status==='Offen'?'sim-open':'sim-status-'+row.status.toLowerCase(),bezeichnung:row.status},rootEbene:{ebenen:[{uuid:row.id+'-incident',objektUUID:row.unitId||row.objectId,auszufuehrendeArbeiten:row.description,...(row.technicianId?{hauptmonteurUUID:row.technicianId}:{}),...(row.plannedFrom?{startZeitpunkt:row.plannedFrom}:{}),status:{uuid:row.status==='Offen'?'sim-open':'sim-status-'+row.status.toLowerCase(),bezeichnung:row.status}}]}});
  const incidents=store.apiEntities('incident');
  for(const row of store.apiEntities('service'))records.set(row.uuid,{uuid:row.uuid,vorgangsNummer:String(row.data.vorgangsNummer),bezeichnung:String((row.data.texte as {technischeVormerkung?:string})?.technischeVormerkung??''),personUUID:String(row.data.personUUID),...(row.data.bearbeiterUUID?{bearbeiterUUID:String(row.data.bearbeiterUUID)}:{}),vorgangStatus:{uuid:'sim-open',bezeichnung:'Offen'},rootEbene:{ebenen:incidents.filter(incident=>incident.data.serviceauftragUUID===row.uuid).map(incident=>({uuid:incident.uuid,objektUUID:String(incident.data.objektUUID),auszufuehrendeArbeiten:String(incident.data.auszufuehrendeArbeiten),...(typeof incident.data.bemerkung==="string"?{bemerkung:incident.data.bemerkung}:{}),...planningTeam(incident.data.hauptmonteurUUID,incident.data.weiteremonteureUUIDs),...(incident.data.startZeitpunkt?{startZeitpunkt:String(incident.data.startZeitpunkt)}:{}),...(incident.data.endZeitpunkt?{endZeitpunkt:String(incident.data.endZeitpunkt)}:{}),status:{uuid:'sim-open',bezeichnung:'Offen'}}))}});
  for(const {sequence,input}of store.storedOrders()) {
    const id=input.pdsReceipt?.uuid??`legacy-order-${sequence}`;
    if(records.has(id))continue;
    records.set(id,{uuid:id,vorgangsNummer:input.pdsReceipt?.number??`SIM-SA-${10002+sequence}`,bezeichnung:input.problem,personUUID:objects.find(object=>object.id===input.objectId)!.customerNumber,vorgangStatus:{uuid:'sim-open',bezeichnung:'Offen'},rootEbene:{ebenen:[{uuid:`legacy-incident-${sequence}`,objektUUID:input.unitId||input.objectId,auszufuehrendeArbeiten:input.problem,...(input.remark?{bemerkung:input.remark}:{}),...planningTeam(input.technicianId,input.companionTechnicianIds),...(input.appointment?{startZeitpunkt:wallInstant(input.appointment),...(input.appointmentDuration?{endZeitpunkt:new Date(Date.parse(wallInstant(input.appointment))+Number(input.appointmentDuration)*60000).toISOString()}:{})}:{}),status:{uuid:'sim-open',bezeichnung:'Offen'}}]}});
  }
  // Historical simulator orders have no native incident entity. Their calendar override
  // remains authoritative for subsequent API reads, without rewriting old order snapshots.
  for(const service of records.values())for(const incident of service.rootEbene.ebenen){
    Object.assign(incident,simulatorContractReferences(store,incident.uuid));
    const override=store.apiEntity(serviceCalendarId(incident.uuid));
    if(override?.kind==="calendar-event")Object.assign(incident,planningTeam(incident.hauptmonteurUUID,incident.weiteremonteureUUIDs,override.data),{startZeitpunkt:String(override.data.startZeitpunkt),endZeitpunkt:String(override.data.endZeitpunkt)});
    if(store.apiEntity(`calendar-deleted:${serviceCalendarId(incident.uuid)}`)?.kind==="calendar-deletion"){delete incident.startZeitpunkt;delete incident.endZeitpunkt;}
  }
  for(const service of records.values()){const status=store.apiEntity(`service-status:${service.uuid}`);if(status?.kind==="service-status")service.vorgangStatus={uuid:String(status.data.uuid),bezeichnung:String(status.data.bezeichnung)};}
  for(const service of records.values())for(const incident of service.rootEbene.ebenen){const stored=store.apiEntity(incident.uuid),positions=stored?.data.positionen!==undefined?stored.data.positionen:(materialPositions as Record<string,unknown>)[incident.uuid];if(positions!==undefined)Object.assign(incident,{positionen:positions});}
  return [...records.values()].map(service=>{const renamed=store.apiEntity(`status-label:SERVICEAUFTRAG:${service.vorgangStatus.uuid}`);return renamed?.kind==="status-label"?{...service,vorgangStatus:{...service.vorgangStatus,bezeichnung:String(renamed.data.bezeichnung)}}:service;});
}
export function serviceDocuments(store:Store,uuid:string) {
  const documents=store.apiEntities('document').filter(row=>row.data.referenzVorgangUUIDOpt===uuid).map(row=>({uuid:row.uuid,fileName:String(row.data.name)}));
  const legacy=store.storedOrders().find(row=>(row.input.pdsReceipt?.uuid??`legacy-order-${row.sequence}`)===uuid);
  if(legacy?.input.document && !documents.length)documents.push({uuid:`legacy-document-${legacy.sequence}`,fileName:legacy.input.document.name});
  return [...documents,...dispatchDocuments.filter(item=>item.order===uuid).map(item=>({uuid:item.uuid,fileName:item.fileName,...('datum'in item?{datum:item.datum}:{}),...('dokumententyp'in item?{dokumententyp:item.dokumententyp}:{})}))];
}
export function documentBytes(store:Store,uuid:string):Uint8Array|null {
  const fixture=dispatchDocuments.find(item=>item.uuid===uuid);if(fixture)return new TextEncoder().encode(fixture.text);
  const row=store.apiEntity(uuid);
  if(row?.kind==='document')return row.content;
  const legacy=/^legacy-document-(\d+)$/.exec(uuid);
  if(!legacy)return null;
  const order=store.storedOrders().find(row=>row.sequence===Number(legacy[1]));
  return order ? store.document(order.input.pdsReceipt?.number??`SIM-SA-${10002+order.sequence}`)?.bytes??null : null;
}
