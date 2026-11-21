import type {PdsTransport} from '../../../platform/pds/api/index.ts';
import {ServiceReadError,readCore} from './reader.ts';
import {dispatchRefKey} from './dispatch-repository.ts';
import type {DispatchCatalog,DispatchTarget,DispatchReference} from './dispatch-model.ts';
export function dispatchId(value:unknown){if(typeof value!=='string'||!value||value.length>200||value==='.'||value==='..'||/[\x00-\x1f%\\/?#]/.test(value))throw new ServiceReadError('Ungültige Akten- oder Dokumentkennung.',400);return value;}
const text=(value:unknown)=>typeof value==='string'?value:'';
export async function dispatchRelations(api:PdsTransport,orderId:string){
 const core=await readCore(api,'order',dispatchId(orderId)),direct=[...new Set(core.file.incidents?.map(item=>item.objectId).filter(Boolean))];if(direct.length>12)throw new ServiceReadError('Die Einsatzmappe unterstützt bis zu zwölf technische Zuordnungen pro Auftrag.',413);
 const objects=new Map<string,Record<string,unknown>>();let pending=direct;
 for(let depth=0;pending.length;depth++){
  if(depth>=8||objects.size+pending.length>24)throw new ServiceReadError('Die Objekthierarchie überschreitet das Budget der Einsatzmappe.',413);pending.forEach(dispatchId);
  const rows=await api.request('POST','/objekt/detailsbatch',{uuids:pending});if(!Array.isArray(rows)||rows.length!==pending.length)throw new ServiceReadError('Objektzuordnung der Einsatzmappe ist unvollständig.');
  for(const row of rows){if(!row||typeof row!=='object'||!pending.includes(row.uuid)||objects.has(row.uuid))throw new ServiceReadError('Objektzuordnung der Einsatzmappe ist nicht eindeutig.');objects.set(row.uuid,row);}
  pending=[...new Set(rows.map(row=>text(row.parentUUID)).filter(id=>id&&!objects.has(id)))];
 }
 const targets:DispatchTarget[]=[{id:'order',label:'Auftrag',kind:'order',recordId:orderId}];
 let contacts:{name:string;phones:string[]}[]=[];
 if(core.file.customerId){const customer=await readCore(api,'customer',dispatchId(core.file.customerId));contacts=customer.file.contacts??[];targets.push({id:'customer',label:'Kunde · '+customer.file.name,kind:'customer',recordId:core.file.customerId});}
 for(const object of objects.values())targets.push({id:'object:'+object.uuid,label:(object.typ==='TECHNISCHE_EINHEIT'?'Technische Einheit':'Objekt')+' · '+(text(object.bezeichnung)||'Ohne Bezeichnung'),kind:'object',recordId:text(object.uuid)});
 // Only related contract IDs are projected, never arbitrary SharePoint folder IDs.
 const contracts=new Set<string>();
 for(const id of direct){const rows=await api.request('POST','/wartungsvertrag/listvertraegebyobjekt',{uuid:id});if(!Array.isArray(rows)||rows.length>100||Buffer.byteLength(JSON.stringify(rows))>1024*1024)throw new ServiceReadError('Zu viele Vertragszuordnungen für die Einsatzmappe.',413);for(const row of rows){const contract=dispatchId(row?.uuid);if(contracts.has(contract))continue;if(contracts.size>=20)throw new ServiceReadError('Mehr als zwanzig Vertragszuordnungen für die Einsatzmappe.',413);contracts.add(contract);targets.push({id:'contract:'+id+':'+contract,label:'Vertrag · '+(text(row.wartung?.bezeichnung)||contract),kind:'contract',recordId:contract,objectId:id});}}
 return {core,targets,contacts,objects:[...objects.values()]};
}
export async function dispatchPdsDocuments(api:PdsTransport,orderId:string,kind:'service'|'ruecklauf'='service',queries?:[string,string,string][]):Promise<DispatchCatalog>{
 dispatchId(orderId);const items=new Map<string,DispatchCatalog['items'][number]>(),errors:string[]=[];
 for(const [path,label,idValue]of queries??[['listdokumente','Grunddaten',orderId],['listauftragsdokumente','Auftrag',orderId]]){try{const rows=await api.request('GET','/'+kind+'/'+path+'/'+encodeURIComponent(dispatchId(idValue)));if(!Array.isArray(rows)||rows.length>500||Buffer.byteLength(JSON.stringify(rows))>1024*1024)throw Error();for(const row of rows){const id=dispatchId(row?.uuid),name=text(row.fileName);if(!name||name.length>500||/[\x00-\x1f]/.test(name))throw Error();const reference:DispatchReference={provider:'pds',target:'pds',id,library:''},key=dispatchRefKey(reference),previous=items.get(key);if(kind==='ruecklauf'&&!previous&&items.size>=500)throw Error();items.set(key,{key,reference,name,origin:previous?previous.origin+' / '+label:'PDS · '+label,modified:text(row.datum),documentType:text(row.dokumententyp?.bezeichnung).replace(/[\x00-\x1f]/g,' ').slice(0,120)});}}
 catch{errors.push('PDS-Dokumente aus '+label+' konnten nicht vollständig geladen werden.');}}
 return {items:[...items.values()],errors};
}
