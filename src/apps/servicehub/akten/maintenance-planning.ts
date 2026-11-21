import type {MaintenanceRow} from './maintenance-model.ts';
import type {ServiceCore,ServiceExtrasResponse,ServiceIncident} from './model.ts';
export type MaintenanceCreation={orderId:string;incidentId:string};
/** Consume a confirmed creation result; this function only reads the created order. */
export async function loadMaintenancePlanning(created:MaintenanceCreation,row:MaintenanceRow,sourceRevision:string,transport:typeof fetch=fetch,signal?:AbortSignal):Promise<ServiceIncident>{
 if(!created||[created.orderId,created.incidentId].some(id=>typeof id!=='string'||!id||id.length>200||/[\x00-\x1f]/.test(id)))throw Error('Die Auftragserzeugung wurde nicht eindeutig bestätigt.');
 async function read(part:string,revision?:string){const response=await transport('/api/service?'+new URLSearchParams({kind:'order',id:created.orderId,part,...(revision?{revision}:{})}),{cache:'no-store',signal});const value=await response.json();if(!response.ok)throw Error(value.error||'Der angelegte Auftrag konnte nicht geprüft werden.');return value;}
 const core:ServiceCore=await read('base');if(core.kind!=='order'||!/^[a-f0-9]{64}$/.test(core.revision)||!sourceRevision||core.sourceRevision!==sourceRevision)throw Error('Der angelegte Auftrag konnte nicht eindeutig geprüft werden.');
 const matches=(incident:ServiceIncident)=>incident.id===created.incidentId&&incident.intervalId===row.intervalId&&incident.objectId===row.objectId;
 if(core.incidents?.filter(matches).length!==1)throw Error('Der bestätigte Auftrag gehört nicht eindeutig zu dieser Wartung.');
 const extra:ServiceExtrasResponse=await read('extras',core.revision);if(extra.revision!==core.revision)throw Error('Der Auftrag wurde zwischenzeitlich geändert. Bitte erneut lesen.');
 const candidates=extra.extras?.incidents??core.incidents,incident=candidates.filter(matches);if(incident.length!==1||!incident[0].planningVersion)throw Error('Der Planungsstand der Wartung konnte nicht geprüft werden.');return incident[0];
}
