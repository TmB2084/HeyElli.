import {pdsSource} from "@/platform/pds/connection";
import {Notice} from "@/platform/shell";
import {Suspense} from 'react';
import {session,permitted} from '@/platform/session';
import {DutyOverview,DutyWorkspace} from '@/apps/dutyboard';
import type {Metadata} from 'next';
export const metadata:Metadata={title:'DutyBoard | HeyElli'};
async function ProtectedDuty(){const user=await session();if(!user||!permitted(user,'read'))return <DutyWorkspace><Notice tone="error">Bitte mit einem freigeschalteten Benutzerkonto anmelden.</Notice></DutyWorkspace>;if((await pdsSource()).mode!=="simulator")return <DutyWorkspace><Notice tone="neutral">Die Bereitschaftsplanung ist im echten PDS-Lesebetrieb gesperrt. Simulatorpläne und Zuordnungen bleiben getrennt erhalten.</Notice></DutyWorkspace>;return <DutyOverview/>;}
export default function DutyPage(){return <Suspense fallback={<DutyWorkspace><p role="status">Bereitschaften werden geladen …</p></DutyWorkspace>}><ProtectedDuty/></Suspense>;}
