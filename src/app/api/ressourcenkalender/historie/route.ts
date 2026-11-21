import {withRouteAccess} from '@/platform/app-access/route-access';
import {session,permitted} from '@/platform/session';
import {pdsApi} from "@/platform/pds/connection/api";
import {calendarAuditStore} from '@/apps/planboard/kalender/server';
import {CalendarError} from '@/apps/planboard/kalender/domain';
const headers={'Cache-Control':'no-store'};
async function scopedGET(request:Request){
 const user=await session();
 if(!permitted(user,'read'))return Response.json({error:'Keine Leseberechtigung.'},{status:user?403:401,headers});
 const id=new URL(request.url).searchParams.get('id');
 if(!id||id.length>200)return Response.json({error:'Ungültiger Termin.'},{status:400,headers});
 const api=await pdsApi();
 try{
  await api.calendar.details(id);
  return Response.json({entries:api.source.mode==='simulator'?await calendarAuditStore().history(id):[]},{headers});
 }catch(error){return Response.json({error:error instanceof CalendarError?error.message:'Historie konnte nicht geladen werden.'},{status:error instanceof CalendarError?error.status:502,headers});}finally{api.close();}
}

export const GET=withRouteAccess('/api/ressourcenkalender/historie','GET',scopedGET);
