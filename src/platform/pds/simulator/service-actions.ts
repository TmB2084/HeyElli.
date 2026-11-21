import {queueServiceHistory} from './history-outbox.ts';
import {createHash} from 'node:crypto';
import type {openOrderStore} from './order-store.ts';
import {serviceRecords,serviceCalendarId} from './read-services.ts';
import catalog from '../../../../database/seeds/pds-simulator/status-catalogs.json' with {type:'json'};
import {validateRequest} from '../api/index.ts';
import {CalendarError} from '../../../apps/planboard/kalender/domain.ts';
import {orderActions} from '../../../apps/servicehub/akten/order-actions-model.ts';
export const orderActionVersion=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function changeServiceOrder(store:ReturnType<typeof openOrderStore>,actor:string,input:{id:string;expected:string;operationId:string;action:string},actorName=actor){
 return store.apiTransaction(()=>{
  const fingerprint=orderActionVersion({actor,...input}),receipt=store.apiEntity('service-action:'+input.operationId);
  if(receipt){if(receipt.data.fingerprint!==fingerprint)throw new CalendarError('Vorgangskennung wurde bereits verwendet.',409);return {...receipt.data.result as {before:string;after:string;events:string[];technicians:string[];mobile:boolean},changed:false};}
  const order=serviceRecords(store).find(item=>item.uuid===input.id);if(!order)throw new CalendarError('Serviceauftrag nicht gefunden.',404);
  if(orderActionVersion(order)!==input.expected)throw new CalendarError('Der Auftrag wurde zwischenzeitlich geändert. Bitte den aktuellen Stand prüfen und die Aktion erneut auswählen.',409);
  const available=catalog.SERVICEAUFTRAG.map(item=>{const override=store.apiEntity('status-label:SERVICEAUFTRAG:'+item.uuid);return {...item,bezeichnung:override?.kind==='status-label'?String(override.data.bezeichnung):item.bezeichnung};});
  const action=orderActions(order.vorgangStatus.bezeichnung,available,order.rootEbene.ebenen.length>0&&order.rootEbene.ebenen.every(item=>!!item.hauptmonteurUUID)).find(item=>item.id===input.action);
  if(!action)throw new CalendarError('Diese Aktion ist für den aktuellen Auftrag nicht verfügbar.',409);
  const target=available.find(item=>item.bezeichnung===action.target);if(!target)throw new CalendarError('Zielstatus ist nicht verfügbar.',409);
  validateRequest('POST',action.kind==='mobile'?'/service/mobilausgeben':'/service/updatestatus',action.kind==='mobile'?{uuid:order.uuid,auftragspool:false}:{uuid:order.uuid,statusBezeichnung:target.bezeichnung});
  if(action.kind==='mobile'){const stored=store.apiEntity(order.uuid);if(stored?.kind==='service')store.apiUpdate(order.uuid,{...stored.data,mobilAusgegeben:true,auftragspool:false});store.apiPut('service-mobile:'+order.uuid,'service-mobile',{mobilAusgegeben:true,auftragspool:false});}
  store.apiPut('service-status:'+order.uuid,'service-status',{uuid:target.uuid,bezeichnung:target.bezeichnung});
  const result={before:order.vorgangStatus.bezeichnung,after:target.bezeichnung,events:order.rootEbene.ebenen.map(item=>serviceCalendarId(item.uuid)),technicians:order.rootEbene.ebenen.map(item=>item.hauptmonteurUUID??''),mobile:action.kind==='mobile'};
  queueServiceHistory(store,{actor:{id:actor,name:actorName},action:'service.status.updated',target:input.id,events:result.events,changes:[{field:'orderStatus',label:'Auftragsstatus',before:result.before,after:result.after},...(result.mobile?[{field:'mobileIssue',label:'Mobil ausgegeben',before:null,after:result.technicians.join(', ')}]:[])]});
  store.apiPut('service-action:'+ input.operationId,'service-action',{fingerprint,result});return {...result,changed:true};
 });
}
