import {Suspense} from "react";
import type {Metadata} from "next";
import {ResourceCalendar,PlannerWorkspace} from "@/apps/planboard/kalender";
export const metadata:Metadata={title:"PlanBoard | HeyElli"};
export default function ResourceCalendarPage(){return <PlannerWorkspace><Suspense fallback={<p role="status">Kalender wird geladen …</p>}><ResourceCalendar/></Suspense></PlannerWorkspace>;}
