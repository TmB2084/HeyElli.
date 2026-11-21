import type {Metadata} from 'next';
import {Suspense} from 'react';
import {MissionControlWorkspace} from '@/apps/missioncontrol';
export const metadata:Metadata={title:'MissionControl | HeyElli'};
export default function MissionControlPage(){return <Suspense fallback={<main className="login-page"><p role="status">Sitzung wird geprüft …</p></main>}><MissionControlWorkspace/></Suspense>;}
