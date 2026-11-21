import {withRouteAccess} from '@/platform/app-access/route-access';
import {sameOrigin} from '@/platform/session';
import {adminBody} from '@/system/einstellungen';
import {PlatformError} from '@/platform/store';
import {servicePinRequest} from '@/apps/servicehub/akten';
const headers={'Cache-Control':'no-store'};
function failure(error:unknown){return Response.json({error:error instanceof PlatformError?error.message:'Die angehefteten Kunden sind derzeit nicht erreichbar. Bitte erneut versuchen.'},{status:error instanceof PlatformError?error.status:503,headers});}
export const GET=withRouteAccess('/api/service/angeheftet','GET',async()=>{try{return Response.json(await servicePinRequest(),{headers});}catch(error){return failure(error);}});
export const POST=withRouteAccess('/api/service/angeheftet','POST',async(request:Request)=>{try{
 if(!sameOrigin(request))throw new PlatformError('Unzulässiger Ursprung.',403);
 const input=await adminBody(request);if(!input||typeof input!=='object'||Array.isArray(input))throw new PlatformError('Ungültige Auswahl.');
 return Response.json(await servicePinRequest(input),{headers});
}catch(error){return failure(error);}});
