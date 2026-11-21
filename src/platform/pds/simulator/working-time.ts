import rows from "../../../../database/seeds/pds-simulator/working-times.json" with {type:"json"};
import holidays from "../../../../database/seeds/pds-simulator/holidays.json" with {type:"json"};
import {CalendarError} from "../../../apps/planboard/kalender/domain.ts";
export const workingTimeView={uuid:"sim-view-working-times",name:"sim_calendar_working_times",beschreibung:"Fiktive individuelle lesende Arbeitszeitmodelle; kein PDS-Standardname",columns:Object.keys(rows[0]).map((name,index)=>({uuid:`sim-col-working-${index}`,name,typeName:["wochentag","sollMinuten"].includes(name)?"INTEGER":"TEXT"}))};
export function workingTimeRows(input:{page?:number;entriesPerPage?:number}){
 const page=input.page??0,size=input.entriesPerPage??500;if(!Number.isInteger(page)||page<0||!Number.isInteger(size)||size<1||size>1000)throw new CalendarError("Ungültige Datenansichten-Paginierung.");return rows.slice(page*size,(page+1)*size);
}
export const simulatedHolidays=holidays;
