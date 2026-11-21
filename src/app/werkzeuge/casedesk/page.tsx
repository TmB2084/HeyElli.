import {Suspense} from 'react';
import {connection} from 'next/server';
import {redirect} from 'next/navigation';
import {session} from '@/platform/session';
import {appRoleStore} from '@/platform/app-access';
import {grantedTools} from '@/platform/app-access/tools';
import {IncidentContent} from '@/apps/casedesk/erfassung/server';
import {SessionBoundary} from '@/platform/shell/session-boundary';
import {ToolFrameBoundary} from '@/platform/shell/tool-frame-boundary';
async function Tool(){
 await connection();const user=await session();if(!user)redirect('/anmeldung');
 const rights=await appRoleStore().rights(user.id);
 if(!grantedTools(rights.apps,rights.tools).some(tool=>tool.id==='incident'))return <p role="alert">Dieses Werkzeug ist für deine Rolle nicht freigegeben.</p>;
 return <SessionBoundary><ToolFrameBoundary/><IncidentContent tool/></SessionBoundary>;
}
export default function ToolPage(){return <Suspense fallback={<p role="status">Werkzeug wird geladen …</p>}><Tool/></Suspense>;}
