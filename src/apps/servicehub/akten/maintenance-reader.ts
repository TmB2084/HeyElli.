import {createHash} from 'node:crypto';
import type {PdsTransport} from '../../../platform/pds/api/index.ts';
import {ServiceReadError} from './reader.ts';
import {pdsWebLink} from './pds-link.ts';
import {maintenanceDate,type MaintenanceRow} from './maintenance-model.ts';
const text=(value:unknown)=>typeof value==='string'?value:'';
function row(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new ServiceReadError('Ungültige Wartungsdaten.');return value as Record<string,unknown>;}
export async function readMaintenancePage(api:PdsTransport,objectId:string,cursor:number,expected:string,signal?:AbortSignal){
 if(!objectId||objectId.length>200||/[\x00-\x1f]/.test(objectId)||!Number.isSafeInteger(cursor)||cursor<0||cursor>5000||cursor%8!==0||cursor>0&&!/^[a-f0-9]{64}$/.test(expected))throw new ServiceReadError('Ungültige Wartungsauswahl.',400);
 const values=await api.request('POST','/wartungsvertrag/listvertraegebyobjekt',{uuid:objectId});if(!Array.isArray(values)||values.length>1000||Buffer.byteLength(JSON.stringify(values))>1024*1024)throw new ServiceReadError('Wartungsverträge überschreiten das Abfragebudget.',413);
 const refs=new Map<string,{contractId:string;intervalId:string;contract:string;description:string;closed:string;from:string;until:string;webLink?:string;issue:string}>();
 for(const value of values){const contract=row(value);if(!text(contract.uuid)||!text(contract.objektUUID))throw new ServiceReadError('Vertrags- oder Objektzuordnung einer Wartung fehlt.');if(contract.objektUUID!==objectId)continue;if(contract.wartung==null)continue;
  const maintenance=row(contract.wartung),period=maintenance.laufzeit==null?{}:row(maintenance.laufzeit),intervals=maintenance.intervalle??[];if(!Array.isArray(intervals))throw new ServiceReadError('Ungültige Wartungsintervallliste.');
  const issue=[maintenance.abschlussDatum,period.vonDatum,period.bisDatum].some(value=>value!=null&&value!==''&&!maintenanceDate(value))||maintenanceDate(period.vonDatum)&&maintenanceDate(period.bisDatum)&&maintenanceDate(period.vonDatum)>maintenanceDate(period.bisDatum)?'Vertragszeitraum nicht eindeutig.':'';
  for(const value of intervals){const interval=row(value),intervalId=text(interval.uuid);if(!intervalId||intervalId.length>200||intervalId==='.'||intervalId==='..'||/[\x00-\x1f%\\/?#]/.test(intervalId))throw new ServiceReadError('Kennung des Wartungsintervalls fehlt.');
   const ref={contractId:text(contract.uuid),intervalId,contract:text(maintenance.bezeichnung)||'Wartungsvertrag',description:text(maintenance.leistungsumfang)||text(maintenance.beschreibung),closed:maintenanceDate(maintenance.abschlussDatum),from:maintenanceDate(period.vonDatum),until:maintenanceDate(period.bisDatum),webLink:pdsWebLink(interval.weblink),issue};
   const previous=refs.get(intervalId);if(previous&&JSON.stringify(previous)!==JSON.stringify(ref))throw new ServiceReadError('Wartungsintervall ist mehreren oder widersprüchlichen Verträgen zugeordnet.');refs.set(intervalId,ref);
  }
 }
 if(refs.size>5000)throw new ServiceReadError('Zu viele Wartungsintervalle für dieses Objekt.',413);
 const sorted=[...refs.values()].sort((a,b)=>a.intervalId.localeCompare(b.intervalId)),revision=createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
 if(cursor>0&&expected!==revision)throw new ServiceReadError('Wartungszuordnungen wurden zwischenzeitlich geändert. Bitte erneut laden.',409);
 const rows:MaintenanceRow[]=[];
 for(let offset=cursor;offset<Math.min(cursor+8,sorted.length);offset+=3){signal?.throwIfAborted();rows.push(...await Promise.all(sorted.slice(offset,Math.min(offset+3,cursor+8)).map(async ref=>{
  const detail=row(await api.request('GET','/wartungsvertrag/wartungsintervalldetails/'+encodeURIComponent(ref.intervalId)));if(detail.uuid!==ref.intervalId)throw new ServiceReadError('Wartungsintervall konnte nicht eindeutig gelesen werden.');
  const serie=detail.intervallSerie==null?{}:row(detail.intervallSerie),due=maintenanceDate(serie.naechstesDatum),entry:MaintenanceRow={...ref,id:ref.contractId+':'+ref.intervalId,objectId,title:text(detail.bezeichnung)||'Wartung',due,webLink:pdsWebLink(detail.weblink)||ref.webLink,issue:ref.issue||(!due?'Fälligkeit nicht hinterlegt oder ungültig.':'')};
  if(Buffer.byteLength(JSON.stringify(entry))>16384)throw new ServiceReadError('Wartungsbeschreibung überschreitet das Abfragebudget.',413);return entry;
 })));}
 signal?.throwIfAborted();return {rows,revision,nextCursor:cursor+8<sorted.length?cursor+8:null};
}
