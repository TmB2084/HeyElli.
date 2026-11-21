import {appRoleStore} from '@/platform/app-access';
import 'server-only';
import {session,permitted} from '../../session';
import {PlatformError} from '../../store/model';
import {simulatorApi} from '../simulator/api-entry';
import {PdsHttpTransport,PdsCalendar,PdsCalendarContinuation,PdsLookups,PdsServices} from '../api';
import {pdsSource,sourceConfiguration} from './index';
import {ReadonlyPdsTransport} from './readonly';
export async function pdsApi(...args:Parameters<typeof simulatorApi>){
 const source=await pdsSource();
 if(source.mode==='simulator')return {...simulatorApi(...args),source};
 const user=await session();if(!permitted(user,'read'))throw new PlatformError('Bitte mit einem freigeschalteten Benutzerkonto anmelden.',401);
 const config=sourceConfiguration(source),transport=new ReadonlyPdsTransport(new PdsHttpTransport(config.baseUrl,config.token)),calendar=new PdsCalendar(transport,{...source.views});
 return {source,transport,calendar,continuations:new PdsCalendarContinuation(calendar,()=>new PdsCalendar(transport,{...source.views})),lookups:new PdsLookups(transport),services:new PdsServices(transport),close:()=>{}};
}

// Future write workflows must derive this actor server-side, never accept a client-supplied Bearbeiter.
export async function pdsActorForSession(){
 const user=await session();if(!user||!(await appRoleStore().rights(user.id)).writeApps.length)throw new PlatformError('Keine Schreibberechtigung.',403);
 // Die Sitzung trägt den PDS-Benutzer der aktiven Quelle (Zuordnung in der Benutzerverwaltung, bei jeder Anfrage geprüft).
 if(!user.pdsUserUUID)throw new PlatformError('PDS-Bearbeiterzuordnung fehlt.',409);return user;
}
