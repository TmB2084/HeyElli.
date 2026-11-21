import {queueServiceHistory,type HistoryActor} from './history-outbox.ts';
import type {openOrderStore} from './order-store.ts';
import {serviceRecords} from './read-services.ts';
import {updateServicePlanning} from './calendar-api.ts';
import {planningVersion} from './planning-version.ts';
import {validateRequest} from '../api/index.ts';
import {CalendarError,wallInstant} from '../../../apps/planboard/kalender/domain.ts';
export function planExisting(store:ReturnType<typeof openOrderStore>,raw:unknown,actor?:HistoryActor){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new CalendarError('Ungültige Planung.');const input=raw as Record<string,unknown>;
 for(const key of ['orderId','incidentId','expected','appointment','technicianId'])if(typeof input[key]!=='string'||!input[key]||String(input[key]).length>2000)throw new CalendarError('Planungsangaben fehlen.');
 if(!Number.isInteger(input.duration)||Number(input.duration)<15||Number(input.duration)>1440||Number(input.duration)%15!==0||!Array.isArray(input.companionIds)||input.companionIds.length>100||input.companionIds.some(id=>typeof id!=='string'))throw new CalendarError('Ungültige Einsatzdauer oder Begleiter.');
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(input.appointment)))throw new CalendarError('Ungültiger Terminzeitpunkt.');
 const start=wallInstant(String(input.appointment)),end=new Date(Date.parse(start)+Number(input.duration)*60000).toISOString();
 const target={startZeitpunkt:start,endZeitpunkt:end,hauptmonteurUUID:input.technicianId,weiteremonteureUUIDs:input.companionIds};
 return store.apiTransaction(()=>{const order=serviceRecords(store).find(item=>item.uuid===input.orderId),previous=order?.rootEbene.ebenen.find(item=>item.uuid===input.incidentId);if(!previous)throw new CalendarError('Einsatz nicht gefunden.',404);
  if(planningVersion(previous)===planningVersion(target))return {changed:false,before:previous,after:previous};
  if(planningVersion(previous)!==input.expected)throw new CalendarError('Die Planung wurde zwischenzeitlich geändert. Eingaben bleiben erhalten. Bitte die aktuelle Akte erneut öffnen.',409);
  if(previous.startZeitpunkt&&previous.hauptmonteurUUID)throw new CalendarError('Der Einsatz ist bereits vollständig geplant.',409);
  validateRequest('POST','/service/updatestoerung',{uuid:previous.uuid,...target});const after=updateServicePlanning(store,{uuid:previous.uuid,...target},true);if(actor)queueServiceHistory(store,{actor,action:'service.planning.updated',target:'sim-service-termin-'+previous.uuid,events:['sim-service-termin-'+previous.uuid],changes:[{field:'planning',label:'Terminvergabe',before:{start:previous.startZeitpunkt,end:previous.endZeitpunkt,main:previous.hauptmonteurUUID,companions:previous.weiteremonteureUUIDs},after:{start:after!.startZeitpunkt,end:after!.endZeitpunkt,main:after!.hauptmonteurUUID,companions:after!.weiteremonteureUUIDs}}]});return {changed:true,before:previous,after};});
}
