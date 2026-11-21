import 'server-only';
import {createHash} from 'node:crypto';
import {requireAppWrite} from '../../../platform/app-access/route-access';
import {pdsApi} from '../../../platform/pds/connection/api';
import type {PdsTransport} from '../../../platform/pds/api';
import {platformDatabase,PlatformError} from '../../../platform/store';
import {readAppointmentMessage} from './confirmation-reader';
import {serviceConfirmations} from './confirmation-repository';
import {dispatchId} from './dispatch-reader';
import type {ConfirmationInput} from './confirmation-model';
export async function confirmationRequest(input:Record<string,unknown>,signal?:AbortSignal){
 const user=await requireAppWrite('/servicehub'),store=serviceConfirmations(platformDatabase());
 if(!['preview','confirm'].includes(String(input.action)))throw new PlatformError('Unbekannte Terminbestätigungsaktion.');
 const orderId=dispatchId(input.orderId),incidentId=dispatchId(input.incidentId);if(typeof input.sourceRevision!=='string'||!/^[a-f0-9]{64}$/.test(input.sourceRevision))throw new PlatformError('Datenquelle fehlt. Bitte die Akte erneut öffnen.',409);
 if(input.action==='confirm'){
  const previous=await store.previous(user.id,input as unknown as ConfirmationInput);if(previous)return {...previous,...(previous.channel==='outlook'?{url:store.outlook(input as unknown as ConfirmationInput)}:{})};
 }
 const api=await pdsApi();try{
  const sourceRevision=createHash('sha256').update(JSON.stringify(api.source)).digest('hex');if(sourceRevision!==input.sourceRevision)throw new PlatformError('Die Datenquelle wurde geändert. Bitte die Vorschau erneut laden.',409);
  const limited=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(20000)]),transport:PdsTransport={request:(method,path,body)=>api.transport.request(method,path,body,{signal:limited})},message=await readAppointmentMessage(transport,orderId,incidentId,sourceRevision),settings=await store.settings(user.id);
  if(input.action==='preview')return {message,settings};
  if(input.fingerprint!==message.fingerprint||input.subject!==message.subject||input.body!==message.body)throw new PlatformError('Termin, Haupttechniker, Adresse oder Kundenkontakte wurden geändert. Bitte die Vorschau erneut laden. Es wurde keine Nachricht vorbereitet.',409);
  limited.throwIfAborted();const result=await store.commit(user.id,api.source.mode==='simulator'?'simulator':'pds:'+api.source.workspaceId,input as unknown as ConfirmationInput);return {...result,...(result.channel==='outlook'?{url:store.outlook(input as unknown as ConfirmationInput)}:{})};
 }finally{api.close();}
}
