import {chronicleSourceRevision} from '@/apps/servicehub/akten';
import {connection} from 'next/server';
import {appPermission} from '@/platform/app-access';
import {session} from '@/platform/session';
import {pdsSource} from '@/platform/pds/connection';
import {Notice} from '@/platform/shell';
import {IncidentForm} from './incident-form';
import {IncidentWorkspace} from './incident-workspace';
export async function IncidentContent({tool=false}:{tool?:boolean}={}) {
  await connection();
  const source=await pdsSource();
  if(source.mode!=="simulator")return <IncidentWorkspace><Notice tone="neutral">Service-Neuanlagen sind im echten PDS-Lesebetrieb noch nicht freigegeben. Es wird kein Auftrag im Simulator als Ersatz angelegt.</Notice></IncidentWorkspace>;
  const user=await session();
  const [canWrite,canReadChronicle]=await Promise.all([
    appPermission(user,'/casedesk'),
    appPermission(user,'/servicehub','read'),
  ]);
  return <IncidentWorkspace>
    <IncidentForm tool={tool} canWrite={canWrite} chronicleRevision={canReadChronicle?chronicleSourceRevision(source):undefined} />
  </IncidentWorkspace>;
}
