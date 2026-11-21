import {withRouteAccess} from '@/platform/app-access/route-access';
import {permitted} from "@/platform/session";
import {session} from "@/platform/session";
import {pdsApi} from "@/platform/pds/connection/api";
import {CalendarError} from "@/apps/planboard/kalender/domain";
async function scopedGET(request:Request){
 const user=await session();
 const headers={"Cache-Control":"no-store"};if(!permitted(user,"read"))return Response.json({error:user?"Für diese Aktion fehlt die Berechtigung.":"Bitte zuerst anmelden."},{status:user?403:401,headers});
 const url=new URL(request.url),api=await pdsApi();try{return Response.json({items:await api.calendar.references(url.searchParams.get("kind")??"",url.searchParams.get("q")??"")},{headers});}catch(error){return Response.json({error:error instanceof CalendarError?error.message:"PDS-Suche fehlgeschlagen."},{status:error instanceof CalendarError?error.status:502,headers});}finally{api.close();}
}

export const GET=withRouteAccess('/api/ressourcenkalender/referenzen','GET',scopedGET);
