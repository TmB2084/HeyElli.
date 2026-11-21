export type CreatedOrderLinks={service:string|null;calendar:string|null};
// Derive navigation from the confirmed receipt, never from editable form fields.
export function createdOrderLinks(saved:{pdsReceipt?:{uuid:string;stoerungUUID:string};plannedFrom:string|null;technicianId:string},access:{service:boolean;calendar:boolean}):CreatedOrderLinks{
 const receipt=saved.pdsReceipt;if(!receipt?.uuid)return {service:null,calendar:null};
 const service=access.service?'/servicehub?'+new URLSearchParams({ansicht:'orders',akte:'order',id:receipt.uuid}):null;
 const start=saved.plannedFrom?new Date(saved.plannedFrom):null;
 const calendar=access.calendar&&receipt.stoerungUUID&&saved.technicianId&&start&&Number.isFinite(start.getTime())?'/planboard?'+new URLSearchParams({datum:new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(start),auftrag:receipt.uuid,einsatz:receipt.stoerungUUID,mitarbeiter:saved.technicianId}):null;
 return {service,calendar};
}
