import {appRoleStore} from '@/platform/app-access';
import {withRouteAccess} from '@/platform/app-access/route-access';
import {session,permitted} from '@/platform/session';
import {platformStore} from '@/platform/store';
import {pdsApi} from '@/platform/pds/connection/api';
import {microsoftAuthStore} from '@/system/anmeldung/microsoft';
import type {AccountProfile} from '@/platform/shell';
const headers={'Cache-Control':'no-store'};
// Eigenes heyelli-Konto: Rolle, Anmeldung, Microsoft-Verknüpfung und zugeordneter PDS-Benutzer der aktiven Quelle.
async function scopedGET(){
 try{
  const user=await session();
  if(!user||!permitted(user,'read'))return Response.json({error:'Bitte mit einem freigeschalteten Benutzerkonto anmelden.'},{status:user?403:401,headers});
  const account=await platformStore().account(user.id),ms=microsoftAuthStore();
  const profile:AccountProfile={displayName:user.displayName?.trim()||'Angemeldeter Benutzer',role:user.role,roleName:(await appRoleStore().rights(user.id)).roleName,username:account.username,loginMode:user.mode,microsoftLinked:account.microsoftLinked,microsoftLinkAvailable:!account.microsoftLinked&&await ms.configured(),employee:null,employeeState:'none'};
  if(!user.pdsUserUUID)return Response.json(profile,{headers});
  let api:Awaited<ReturnType<typeof pdsApi>>|undefined;
  try{
   api=await pdsApi();
   const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date());
   const employee=(await api.calendar.resources(day,day,undefined,true)).find(item=>item.id===user.pdsUserUUID);
   profile.employee=employee?{name:employee.name,number:employee.number}:null;profile.employeeState=employee?'linked':'missing';
  }catch{profile.employeeState='unavailable';}finally{api?.close();}
  return Response.json(profile,{headers});
 }catch{return Response.json({error:'Kontoinformationen konnten nicht geladen werden. Bitte erneut versuchen.'},{status:503,headers});}
}

export const GET=withRouteAccess('/api/benutzerkonto','GET',scopedGET);
