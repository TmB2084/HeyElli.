import "server-only";
import {localStore} from "./order-store";
import {SimulatedPdsApi} from "./api";
import {PdsCalendarContinuation,PdsCalendar,PdsLookups,PdsServices} from "../api/index.ts";
import type {CalendarEvent,CalendarWrite} from "../../../apps/planboard/kalender/domain.ts";
export function simulatorApi(workflow?:string,onSaved?:(before:CalendarEvent,after:CalendarEvent)=>Promise<void>,beforeSave?:(event:CalendarWrite,previous?:CalendarEvent)=>Promise<void>) {
  const store=localStore();const transport=new SimulatedPdsApi(store,workflow);
  const options={onSaved,beforeSave,colorView:"sim_calendar_colors",workingTimeView:"sim_calendar_working_times",vacationApprovalView:"sim_calendar_vacation_approvals",simulatedColors:true};
  const calendar=new PdsCalendar(transport,options);
  return {transport,calendar,continuations:new PdsCalendarContinuation(calendar,key=>new PdsCalendar(new SimulatedPdsApi(store,`${workflow??"calendar"}:part:${key}`),options),{allowServiceFreeContinuations:true}),services:new PdsServices(transport),lookups:new PdsLookups(transport,{projectManagerFunctions:["sim-function-project-manager"]}),close:()=>store.close()};
}
