import {previewPath,usesStorageTypes} from '../../../platform/sharepoint/layout';
import {sharepointDocuments} from '../../../platform/sharepoint';
import {readMaintenancePage} from './maintenance-reader';
import {readCostCatalog,readObjectCosts} from './cost-search-reader';
import {scopeKey} from '../../../platform/sharepoint/documents';
import {requireAppRead} from '@/platform/app-access/route-access';
import 'server-only';
import type {DocumentLocation} from '../../../platform/sharepoint/layout';
import {createHash} from 'node:crypto';
import {enrichBmaLinks} from '@/platform/bmacloud';
import {appPermission} from '@/platform/app-access';
import {pdsApi} from '@/platform/pds/connection/api';
import type {PdsTransport} from '@/platform/pds/api';
import {readOverview,readCore,readExtras,ServiceReadError} from './reader';
import type {ServiceFile,ServiceFileExtras} from './model';
const revision=(core:Awaited<ReturnType<typeof readCore>>,source:unknown)=>createHash('sha256').update(JSON.stringify({file:core.file,costReference:core.row.kstKtrUUID,source})).digest('hex');
export async function serviceWorkspaceRead(kind?:string,uuid?:string,part='base',expected?:string,requestSignal?:AbortSignal,cursor=0,indexRevision=''){
 const user=await requireAppRead('/servicehub');
 if(part==='maintenance'){
  if(kind||!uuid||!expected||!/^[a-f0-9]{64}$/.test(expected))throw new ServiceReadError('Ungültige Wartungsauswahl.',400);
  const api=await pdsApi();try{if(createHash('sha256').update(JSON.stringify(api.source)).digest('hex')!==expected)throw new ServiceReadError('Die Datenquelle wurde geändert. Bitte die Serviceansicht neu öffnen.',409);
   const signal=AbortSignal.any([...(requestSignal?[requestSignal]:[]),AbortSignal.timeout(20000)]),transport:PdsTransport={request:(method,path,body)=>api.transport.request(method,path,body,{signal})};
   return await readMaintenancePage(transport,uuid,cursor,indexRevision,signal);
  }finally{api.close();}
 }
 if(part==='cost-catalog'||part==='cost-objects'){
  if(kind||!expected||!/^[a-f0-9]{64}$/.test(expected)||part==='cost-catalog'&&uuid)throw new ServiceReadError('Ungültige Kostenträgersuche.',400);
  const api=await pdsApi();try{if(createHash('sha256').update(JSON.stringify(api.source)).digest('hex')!==expected)throw new ServiceReadError('Die Datenquelle wurde geändert. Bitte die Serviceansicht neu öffnen.',409);
   const signal=AbortSignal.any([...(requestSignal?[requestSignal]:[]),AbortSignal.timeout(20000)]),transport:PdsTransport={request:(method,path,body)=>api.transport.request(method,path,body,{signal})};
   if(part==='cost-catalog')return {catalog:await readCostCatalog(transport)};
   let ids:unknown;try{ids=JSON.parse(uuid??'');}catch{throw new ServiceReadError('Ungültige Kostenträgerauswahl.',400);}if(!Array.isArray(ids))throw new ServiceReadError('Ungültige Kostenträgerauswahl.',400);
   return {objects:await readObjectCosts(transport,ids,signal)};
  }finally{api.close();}
 }
 if(!['base','extras'].includes(part)||kind&&(!['order','customer','object'].includes(kind)||!uuid||uuid.length>200||/[\x00-\x1f]/.test(uuid)))throw new ServiceReadError('Ungültige Auswahl.',400);
 if(part==='extras'&&(!kind||!expected||!/^[a-f0-9]{64}$/.test(expected)))throw new ServiceReadError('Stand der Grundakte fehlt. Bitte die Akte erneut öffnen.',400);
 const signal=AbortSignal.any([...(requestSignal?[requestSignal]:[]),AbortSignal.timeout(part==='extras'?12000:20000)]);
 const api=await pdsApi(),upstream:PdsTransport=api.transport;
 const transport:PdsTransport={request:(method,path,body)=>{signal.throwIfAborted();return upstream.request(method,path,body,{signal});}};
 try{
  if(!kind){const canWrite=await appPermission(user,'/servicehub');return {...await readOverview(transport),source:api.source.mode,costRevision:createHash('sha256').update(JSON.stringify(api.source)).digest('hex'),canReadCalendar:await appPermission(user,'/planboard','read'),canUploadDocuments:canWrite,canPrepareMaintenance:canWrite,canPlan:api.source.mode==='simulator'&&canWrite,loadedAt:new Date().toISOString()};}
  const core=await readCore(transport,kind as ServiceFile['kind'],uuid!),version=revision(core,api.source);
  if(part==='base')return {...core.file,revision:version,sourceRevision:createHash('sha256').update(JSON.stringify(api.source)).digest('hex')};
  if(version!==expected)throw new ServiceReadError('Die Akte wurde zwischenzeitlich geändert. Die aktuelle Grundakte wird neu geladen.',409);
  const extra=await readExtras(transport,core,signal),enriched=await enrichBmaLinks({...core.file,...extra},api.source.mode,signal);
  signal.throwIfAborted();
  const after=await readCore(transport,kind as ServiceFile['kind'],uuid!);
  if(revision(after,api.source)!==version)throw new ServiceReadError('Die Akte wurde zwischenzeitlich geändert. Die aktuelle Grundakte wird neu geladen.',409);
  const extras:ServiceFileExtras={...extra,bmaNotice:enriched.bmaNotice,contracts:enriched.contracts};
  return {revision:version,extras};
 }finally{api.close();}
}
export {ServiceReadError};

// Akte prüfen und Ablageort nach Vorgabe bestimmen (Objekte/<Stadt>/<straße_nr>/<Gewerk>/<Einheit>, Kunden/<kunde_nr>, Verträge beim Kunden).
export async function serviceDocumentScope(kind:string,id:string,contractId:string,signal?:AbortSignal):Promise<{scope:string;location:DocumentLocation}>{
 await requireAppRead('/servicehub');if(!['customer','object','order'].includes(kind)||!id||id.length>200||/[\x00-\x1f]/.test(id)||contractId.length>200)throw new ServiceReadError('Ungültige Aktenauswahl.',400);
 const api=await pdsApi();try{const transport:PdsTransport={request:(method,path,body)=>api.transport.request(method,path,body,{signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(15000)])})};const core=await readCore(transport,kind as ServiceFile['kind'],id);
  let location:DocumentLocation;
  if(contractId){if(kind!=='object')throw new ServiceReadError('Vertrag gehört nicht zu dieser Akte.',400);const extras=await readExtras(transport,core,signal),contract=extras.contracts?.find(item=>item.id===contractId);if(!contract)throw new ServiceReadError('Vertrag gehört nicht zur ausgewählten Objektakte.',404);
   const customer=core.file.customerId?(await readCore(transport,'customer',core.file.customerId).catch(()=>null))?.file:null;location={kind:'contract',customerName:customer?.name??'',customerNumber:customer?.number??'',contractName:contract.name||contractId};}
  else location=await documentLocation(transport,core);
  return {scope:scopeKey(api.source.mode==='simulator'?'simulator':'pds:'+api.source.workspaceId,contractId?'contract':kind,contractId||id),location};
 }finally{api.close();}
}
type CoreFile=Awaited<ReturnType<typeof readCore>>;
async function documentLocation(transport:PdsTransport,core:CoreFile,prefix=''):Promise<DocumentLocation>{
 const file=core.file,row=core.row as Record<string,unknown>;
 if(file.kind==='customer')return {kind:'customer',customerName:file.name,customerNumber:file.number??'',namePrefix:prefix};
 if(file.kind==='order'){const objectId=file.incidents?.find(incident=>incident.objectId)?.objectId;if(objectId){const target=await readCore(transport,'object',objectId).catch(()=>null);if(target)return documentLocation(transport,target,file.number||prefix);}
  const customer=file.customerId?await readCore(transport,'customer',file.customerId).catch(()=>null):null;return {kind:'customer',customerName:customer?.file.name??'',customerNumber:customer?.file.number??'',namePrefix:file.number||prefix};}
 const site=(value:unknown)=>{const standort=value&&typeof value==='object'?value as Record<string,unknown>:{};return {street:typeof standort.strasse==='string'?standort.strasse:'',city:typeof standort.ort==='string'?standort.ort:''};};
 if(file.objectType==='TECHNISCHE_EINHEIT'){const parentId=typeof row.parentUUID==='string'?row.parentUUID:'',parent=parentId?await readCore(transport,'object',parentId).catch(()=>null):null;const address=site(parent?(parent.row as Record<string,unknown>).standort:row.standort);
  // Gewerk = Fachbereich der Anlage (PDS-Handbuch „Anlagen und Bauteile erstellen“; API: fachbereichUUID + /mitarbeiter/listfachbereiche).
  const tradeId=typeof row.fachbereichUUID==='string'?row.fachbereichUUID:'';let trade='';
  if(tradeId){const list=await transport.request('GET','/mitarbeiter/listfachbereiche').catch(()=>null);if(Array.isArray(list))trade=String((list as Record<string,unknown>[]).find(entry=>entry.uuid===tradeId)?.bezeichnung??'');}
  return {kind:'unit',...address,trade,unitName:file.name,unitId:typeof row.dbid==='number'||typeof row.dbid==='string'?String(row.dbid):'',namePrefix:prefix};}
 return {kind:'object',...site(row.standort),namePrefix:prefix};
}

// Übernahme der bisherigen SharePoint-Hash-Ablage: Hash je Akte aus PDS neu bilden, zuordnen, Zielpfad zeigen.
// Nur Administratoren (Prüfung im Route Handler). Verträge ohne PDS-Rückverfolgung bleiben unverändert.
export async function sharepointLegacyPlan(signal?:AbortSignal){
 const documents=sharepointDocuments(),legacy=await documents.legacyFolders(signal);if(!legacy.length)return {items:[],unmatched:0};
 const api=await pdsApi();try{const transport:PdsTransport={request:(method,path,body)=>api.transport.request(method,path,body,{signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(30000)])})};
  const source=api.source.mode==='simulator'?'simulator':'pds:'+api.source.workspaceId,overview=await readOverview(transport),wanted=new Set(legacy.map(entry=>entry.scope)),found=new Map<string,{kind:'customer'|'object'|'order';id:string;title:string}>();
  for(const customer of overview.customers){const scope=scopeKey(source,'customer',customer.id);if(wanted.has(scope))found.set(scope,{kind:'customer',id:customer.id,title:customer.name});}
  for(const object of overview.objects){const scope=scopeKey(source,'object',object.id);if(wanted.has(scope))found.set(scope,{kind:'object',id:object.id,title:object.name});}
  for(const order of overview.orders){const scope=scopeKey(source,'order',order.id);if(wanted.has(scope))found.set(scope,{kind:'order',id:order.id,title:order.number});}
  const items=[];for(const entry of legacy){const akte=found.get(entry.scope);if(!akte)continue;const core=await readCore(transport,akte.kind,akte.id),location=await documentLocation(transport,core);items.push({scope:entry.scope,kind:akte.kind,id:akte.id,title:akte.title,files:entry.files,target:previewPath(location,usesStorageTypes(location)?'Sonstiges':undefined)});}
  return {items,unmatched:legacy.length-items.length};
 }finally{api.close();}
}
export async function sharepointLegacyMigrate(actor:string,scopes:unknown,signal?:AbortSignal){
 if(!Array.isArray(scopes)||!scopes.length||scopes.length>500||scopes.some(scope=>typeof scope!=='string'||!/^[a-f0-9]{64}$/.test(scope)))throw new ServiceReadError('Bitte die Übernahme aus der Vorschau bestätigen.',400);
 const plan=await sharepointLegacyPlan(signal),results:{scope:string;moved:number;error?:string}[]=[];
 const api=await pdsApi();try{const transport:PdsTransport={request:(method,path,body)=>api.transport.request(method,path,body,{signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(30000)])})};
  for(const scope of scopes as string[]){const item=plan.items.find(entry=>entry.scope===scope);if(!item){results.push({scope,moved:0,error:'Nicht mehr in der Vorschau.'});continue;}
   try{const location=await documentLocation(transport,await readCore(transport,item.kind,item.id));results.push({scope,...await sharepointDocuments().moveLegacy(actor,scope,location,signal)});}catch(error){results.push({scope,moved:0,error:error instanceof Error?error.message:'Übernahme fehlgeschlagen.'});}}
 }finally{api.close();}
 return {results};
}
