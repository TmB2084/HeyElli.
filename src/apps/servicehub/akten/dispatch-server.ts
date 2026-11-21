import {ReturnViewError,simulatedReturnLinkView} from '../../../platform/pds/api';
import {readReturn,discoverReturns} from './return-reader';
import {readMaterials} from './material-reader';
import 'server-only';
import {createHash} from 'node:crypto';
import {requireAppRead,requireAppWrite} from '../../../platform/app-access/route-access';
import {appPermission} from '../../../platform/app-access';
import {pdsApi} from '../../../platform/pds/connection/api';
import type {PdsTransport} from '../../../platform/pds/api';
import {platformDatabase,PlatformError} from '../../../platform/store';
import {scopeKey} from '../../../platform/sharepoint/documents';
import {sharepointDocuments} from '../../../platform/sharepoint';
import {enrichBmaLinks} from '../../../platform/bmacloud';
import {readCore,ServiceReadError} from './reader';
import {dispatchRelations,dispatchPdsDocuments,dispatchId} from './dispatch-reader';
import {dispatchRepository,dispatchRefKey} from './dispatch-repository';
import type {DispatchCatalog,DispatchContext,DispatchDocument,DispatchTarget} from './dispatch-model';
function targetScope(source:string,target:DispatchTarget){return scopeKey(source,target.kind==='contract'?'contract':target.kind,target.recordId);}
async function withPack<T>(orderId:string,expected:string,write:boolean,signal:AbortSignal|undefined,work:(value:{user:Awaited<ReturnType<typeof requireAppRead>>;api:Awaited<ReturnType<typeof pdsApi>>;transport:PdsTransport;source:string;scope:string;revision:string})=>Promise<T>){
 const user=write?await requireAppWrite('/servicehub'):await requireAppRead('/servicehub');dispatchId(orderId);if(!/^[a-f0-9]{64}$/.test(expected))throw new PlatformError('Quellenstand der Auftragsakte fehlt. Bitte erneut öffnen.',409);
 const api=await pdsApi();try{const revision=createHash('sha256').update(JSON.stringify(api.source)).digest('hex');if(expected!==revision)throw new PlatformError('Die Datenquelle wurde geändert. Bitte die Auftragsakte erneut öffnen.',409);
  const source=api.source.mode==='simulator'?'simulator':'pds:'+api.source.workspaceId,scope=scopeKey(source,'dispatch-pack',orderId),limited=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(25000)]),transport:PdsTransport={request:(method,path,body)=>api.transport.request(method,path,body,{signal:limited})};
  await readCore(transport,'order',orderId);return await work({user,api,transport,source,scope,revision});
 }finally{api.close();}
}
async function folderCatalog(transport:PdsTransport,source:string,orderId:string,targetId:string,signal?:AbortSignal):Promise<DispatchCatalog>{
 let target:DispatchTarget|undefined;if(targetId==='order')target={id:'order',label:'Auftrag',kind:'order',recordId:orderId};else target=(await dispatchRelations(transport,orderId)).targets.find(target=>target.id===targetId);if(!target)throw new PlatformError('Der Dokumentordner gehört nicht zu diesem Auftrag.',403);
 const result=await sharepointDocuments().list(targetScope(source,target),signal);if(!result.enabled)return {items:[],errors:[],notice:'SharePoint ist noch nicht freigegeben.'};
 const library='library' in result?String(result.library):'';if(!/^[a-f0-9]{64}$/.test(library))throw new PlatformError('SharePoint-Bibliothek konnte nicht bestätigt werden.',503);
 return {items:result.items.map(item=>{const reference={provider:'sharepoint' as const,target:target!.id,id:item.id,library};return {key:dispatchRefKey(reference),reference,name:item.name,origin:'SharePoint · '+target!.label,modified:item.modified??'',url:item.url};}),errors:[],truncated:result.truncated};
}
export async function dispatchRead(orderId:string,expected:string,section:string,target:string,signal?:AbortSignal){return withPack(orderId,expected,false,signal,async({user,transport,source,scope,revision,api})=>{
 if(section==='return-index')return discoverReturns(transport,orderId,api.source.mode==='simulator'?simulatedReturnLinkView:api.source.views.returnLinkView);
 if(section==='return'){if(!target)throw new ServiceReadError('Rücklaufzuordnung fehlt.',400);const result=await readReturn(transport,orderId,target);return {...result,documents:{...result.documents,items:result.documents.items.map(item=>({...item,url:'/api/service/einsatzmappe/dokument?'+new URLSearchParams({order:orderId,revision,key:item.key,returnId:target})}))}};}
 if(section==='positions')return readMaterials(transport,orderId);
 if(section==='selection')return {scope,sourceRevision:revision,canWrite:await appPermission(user,'/servicehub'),selection:await dispatchRepository(platformDatabase()).read(scope)};
 if(section==='pds'){const result=await dispatchPdsDocuments(transport,orderId);return {...result,items:result.items.map(item=>({...item,url:'/api/service/einsatzmappe/dokument?'+new URLSearchParams({order:orderId,revision,key:item.key})}))};}
 if(section==='sharepoint')return folderCatalog(transport,source,orderId,target,signal);
 if(section==='context'){const relations=await dispatchRelations(transport,orderId);return {scope,sourceRevision:revision,canWrite:await appPermission(user,'/servicehub'),targets:relations.targets,contacts:relations.contacts,bmaObjects:relations.objects.filter(row=>row.typ==='TECHNISCHE_EINHEIT').map(row=>({id:String(row.uuid),name:String(row.bezeichnung||'Technische Einheit')}))} satisfies DispatchContext;}
 if(section==='bma'){
  const relations=await dispatchRelations(transport,orderId),links:{aid:number;number:string;name:string;url:string;object:string}[]=[],notices=new Set<string>();
  for(const object of relations.objects.filter(row=>row.typ==='TECHNISCHE_EINHEIT').slice(0,12)){
   const contracts=await transport.request('POST','/wartungsvertrag/listvertraegebyobjekt',{uuid:object.uuid});if(!Array.isArray(contracts)||contracts.length>100)throw new PlatformError('BMACloud-Zuordnung der Einsatzmappe überschreitet das Budget.',413);
   const file=await enrichBmaLinks({kind:'object',name:String(object.bezeichnung||''),objectType:'TECHNISCHE_EINHEIT',contracts:contracts.map(row=>({id:String(row.uuid),name:String(row.wartung?.bezeichnung||''),description:'',maintenanceCostCarrier:row.wartung?.kstKtr?{number:String(row.wartung.kstKtr.nummer||''),name:String(row.wartung.kstKtr.bezeichnung||'')}:undefined}))},api.source.mode,signal);
   if(file.bmaNotice)notices.add(file.bmaNotice);for(const contract of file.contracts??[]){if(contract.bma?.error)notices.add(contract.bma.error);for(const link of contract.bma?.links??[])if(!links.some(item=>item.aid===link.aid&&item.object===String(object.bezeichnung)))links.push({...link,object:String(object.bezeichnung||'Technische Einheit')});}
  }return {links,notices:[...notices]};
 }
 throw new PlatformError('Unbekannter Bereich der Einsatzmappe.');
});}
export async function dispatchSelect(orderId:string,expected:string,input:{scope?:unknown;key?:unknown;target?:unknown;selected?:unknown;version?:unknown},signal?:AbortSignal){return withPack(orderId,expected,true,signal,async({user,transport,source,scope})=>{
 if(input.scope!==scope||typeof input.key!=='string'||!/^[a-f0-9]{64}$/.test(input.key)||typeof input.selected!=='boolean'||!Number.isSafeInteger(input.version)||Number(input.version)<0)throw new PlatformError('Dokumentauswahl gehört nicht zum geöffneten Auftrag.',409);
 const store=dispatchRepository(platformDatabase());let item:DispatchDocument|undefined;
 if(input.selected){const catalog=input.target==='pds'?await dispatchPdsDocuments(transport,orderId):await folderCatalog(transport,source,orderId,String(input.target??''),signal);item=catalog.items.find(item=>item.key===input.key);if(!item)throw new PlatformError('Das Dokument ist in dieser Akte nicht mehr verfügbar. Bitte erneut laden.',409);}
 const reference=item?.reference??(await store.read(scope)).find(row=>row.key===input.key)?.reference;if(!reference)throw new PlatformError('Dieser Dokumentverweis gehört nicht zur Einsatzmappe.',404);
 return store.change(scope,source,orderId,user.id,reference,input.selected,Number(input.version));
});}
export async function dispatchDownload(orderId:string,expected:string,key:string,signal?:AbortSignal,returnId=''){return withPack(orderId,expected,false,signal,async({transport})=>{
 if(!/^[a-f0-9]{64}$/.test(key))throw new PlatformError('Ungültiger Dokumentverweis.');const catalog=returnId?(await readReturn(transport,orderId,returnId)).documents:await dispatchPdsDocuments(transport,orderId),item=catalog.items.find(item=>item.key===key);if(!item)throw new PlatformError('Das Dokument gehört nicht mehr zum Auftrag oder ist nicht verfügbar.',404);
 const bytes=await transport.request('GET','/dokument/downloaddokument/'+encodeURIComponent(item.reference.id));if(!(bytes instanceof Uint8Array)||bytes.byteLength>100*1024*1024)throw new PlatformError('PDS-Dokument konnte nicht innerhalb des Übertragungsbudgets geladen werden.',413);return {bytes,name:item.name};
});}
export function dispatchFailure(error:unknown){return Response.json({error:error instanceof PlatformError||error instanceof ServiceReadError||error instanceof ReturnViewError?error.message:'Die Einsatzmappe ist derzeit nicht erreichbar. Bitte erneut versuchen.'},{status:error instanceof PlatformError||error instanceof ServiceReadError||error instanceof ReturnViewError?error.status:503,headers:{'Cache-Control':'no-store'}});}
