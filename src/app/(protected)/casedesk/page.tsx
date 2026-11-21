import {Suspense} from 'react';
import type {Metadata} from 'next';
import {IncidentWorkspace} from '@/apps/casedesk/erfassung';
import {IncidentContent} from '@/apps/casedesk/erfassung/server';
import {Notice} from '@/platform/shell';
export const metadata:Metadata={title:'CaseDesk | HeyElli'};
export default function IncidentsPage(){return <Suspense fallback={<IncidentWorkspace><Notice tone="neutral">Serviceerfassung wird geladen …</Notice></IncidentWorkspace>}><IncidentContent/></Suspense>;}
