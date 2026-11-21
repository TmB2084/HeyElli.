import 'server-only';
import {requireAppRead} from '../../../platform/app-access/route-access';
import {pdsApi} from '../../../platform/pds/connection/api';
import type {PdsTransport} from '../../../platform/pds/api';
import {sharepointDocuments} from '../../../platform/sharepoint';
import {scopeKey} from '../../../platform/sharepoint/documents';
import {readCore,ServiceReadError} from './reader';
import {dispatchId} from './dispatch-reader';
import {readMaintenancePage} from './maintenance-reader';
import {readChronicleServices,readChronicleReports,chronicleSourceRevision} from './chronicle-reader';
import {chronicleDate,type ChronicleEntry} from './chronicle-model';
export async function chronicleRead(params:URLSearchParams,signal?:AbortSignal){
 await requireAppRead('/servicehub');const id=dispatchId(params.get('id')),expected=params.get('revision');if(!expected||!/^[a-f0-9]{64}$/.test(expected))throw new ServiceReadError('Quellenstand fehlt. Bitte die Akte erneut öffnen.',409);
 const api=await pdsApi();try{
  if(chronicleSourceRevision(api.source)!==expected)throw new ServiceReadError('Die Datenquelle wurde geändert. Bitte die Akte erneut öffnen.',409);
  const limited=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(20000)]),transport:PdsTransport={request:(method,path,body)=>api.transport.request(method,path,body,{signal:limited})},unit=await readCore(transport,'object',id);if(unit.file.objectType!=='TECHNISCHE_EINHEIT')throw new ServiceReadError('Die Anlagenchronik gehört zu einer technischen Einheit.',400);
  const part=params.get('part');if(part==='services')return await readChronicleServices(transport,id);
  if(part==='maintenance'){const result=await readMaintenancePage(transport,id,Number(params.get('cursor')??0),params.get('indexRevision')??'',limited);return {...result,rows:result.rows.map(row=>({id:'maintenance:'+row.id,kind:'maintenance',title:row.title,date:row.due,dateKind:'Fälligkeit',detail:[row.contract!==row.title?row.contract:'',row.issue,row.closed?'Vertrag abgeschlossen':row.until?'Vertrag bis '+row.until:''].filter(Boolean).join(' · '),origin:'PDS · Wartungsintervall',url:row.webLink} satisfies ChronicleEntry))};}
  if(part==='reports'){let orders:unknown;try{orders=JSON.parse(params.get('orders')??'null');}catch{throw new ServiceReadError('Ungültige Berichtsauswahl.',400);}return await readChronicleReports(transport,id,orders,expected);}
  if(part==='sharepoint'){const source=api.source.mode==='simulator'?'simulator':'pds:'+api.source.workspaceId,result=await sharepointDocuments().list(scopeKey(source,'object',id),limited);return {rows:result.items.map(item=>({id:'sharepoint:'+('library'in result?result.library:'')+':'+item.id,kind:'report',title:item.name,date:chronicleDate(item.modified),dateKind:'Geändert',detail:'Unterlage dieser technischen Einheit',origin:'SharePoint',url:item.url} satisfies ChronicleEntry)),notice:!result.enabled?'SharePoint ist noch nicht freigegeben.':result.truncated?'Die ersten 100 SharePoint-Dateien sind enthalten; weitere Dateien direkt in SharePoint prüfen.':''};}
  throw new ServiceReadError('Unbekannter Chronikbereich.',400);
 }finally{api.close();}
}
