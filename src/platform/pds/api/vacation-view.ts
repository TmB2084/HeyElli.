import type {PdsTransport} from "./protocol.ts";
import {PdsProtocolError} from "./protocol.ts";
import type {CalendarEvent,VacationApproval} from "../../../apps/planboard/kalender/domain.ts";
// Explicit integration contract for an individually configured read-only view.
// These column names are not claimed to be PDS database column names.
export async function enrichVacationApprovals(api:PdsTransport,viewName:string,events:CalendarEvent[]){
 const vacations=events.filter(event=>event.type==="URLAUB");if(!vacations.length)return;
 const views=await api.request("GET","/datenansichten/list");
 if(!Array.isArray(views)||!views.some(view=>view?.name===viewName))throw new PdsProtocolError("Die konfigurierte Urlaubsgenehmigungs-Datenansicht ist nicht verfügbar.");
 const statuses=new Map<string,VacationApproval>();
 for(let page=0;page<1000;page++){
  const rows=await api.request("POST","/datenansichten/listdaten",{name:viewName,page,entriesPerPage:500});
  if(!Array.isArray(rows)||rows.length>500)throw new PdsProtocolError("Ungültige Urlaubsgenehmigungs-Datenansicht.");
  for(const row of rows){
   if(!row||typeof row!=="object"||typeof row.terminUUID!=="string"||!row.terminUUID||row.terminUUID.length>120||!["BEANTRAGT","GENEHMIGT"].includes(row.genehmigungsstatus)||statuses.has(row.terminUUID))throw new PdsProtocolError("Ungültige oder doppelte Urlaubsgenehmigungs-Zuordnung.");
   statuses.set(row.terminUUID,row.genehmigungsstatus);
  }
  if(rows.length<500){for(const event of vacations){const status=statuses.get(event.id);if(status)event.vacationApproval=status;}return;}
 }
 throw new PdsProtocolError("Zu viele Seiten in der Urlaubsgenehmigungs-Datenansicht.");
}
