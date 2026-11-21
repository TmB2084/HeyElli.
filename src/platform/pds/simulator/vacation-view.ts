import seed from "../../../../database/seeds/pds-simulator/vacation-approvals.json" with {type:"json"};
import {CalendarError} from "../../../apps/planboard/kalender/domain.ts";
import {calendarRecords} from "./calendar-api.ts";
import type {openOrderStore} from "./order-store.ts";
export const vacationApprovalView={uuid:"sim-view-vacation-approvals",name:"sim_calendar_vacation_approvals",beschreibung:"Fiktive lesende Urlaubsgenehmigungs-Zuordnung; individueller View-Entwurf, kein PDS-Standardname",columns:[{uuid:"sim-col-vacation-appointment",name:"terminUUID",typeName:"TEXT"},{uuid:"sim-col-vacation-approval",name:"genehmigungsstatus",typeName:"TEXT"}]};
export function vacationApprovalRows(store:ReturnType<typeof openOrderStore>,input:{page?:number;entriesPerPage?:number}){
 const page=input.page??0,size=input.entriesPerPage??500;
 if(!Number.isInteger(page)||page<0||!Number.isInteger(size)||size<1||size>1000)throw new CalendarError("Ungültige Datenansichten-Paginierung.");
 const ids=new Set(calendarRecords(store).filter(event=>event.typ==="URLAUB").map(event=>event.uuid));
 return seed.filter(row=>ids.has(row.terminUUID)).slice(page*size,(page+1)*size);
}
