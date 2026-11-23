import {withRouteAccess} from '@/platform/app-access/route-access';
import {sameOrigin} from '@/platform/session';
import {adminBody} from '@/system/einstellungen';
import {PlatformError} from '@/platform/store';
import {serviceFlagRequest} from '@/apps/servicehub/akten';

const headers={'Cache-Control':'no-store'};
function failure(error:unknown){
 return Response.json({error:error instanceof PlatformError?error.message:'Die Auftragsmarkierungen sind derzeit nicht erreichbar.'},{status:error instanceof PlatformError?error.status:503,headers});
}
export const GET=withRouteAccess('/api/service/markierungen','GET',async()=>{
 try{return Response.json(await serviceFlagRequest(),{headers});}catch(error){return failure(error);}
});
export const POST=withRouteAccess('/api/service/markierungen','POST',async(request:Request)=>{
 try{
  if(!sameOrigin(request))throw new PlatformError('Unzulässiger Ursprung.',403);
  const input=await adminBody(request);
  if(!input||typeof input!=='object'||Array.isArray(input))throw new PlatformError('Ungültige Auftragsmarkierung.');
  return Response.json(await serviceFlagRequest(input as Record<string,unknown>),{headers});
 }catch(error){return failure(error);}
});
