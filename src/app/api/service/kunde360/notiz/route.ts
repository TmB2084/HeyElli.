import {withRouteAccess} from '@/platform/app-access/route-access';
import {customerNote} from '@/apps/servicehub/kunde360';
import {sameOrigin} from '@/platform/session';
import {adminBody} from '@/system/einstellungen';
import {PlatformError} from '@/platform/store';
const headers={'Cache-Control':'no-store'};
export const POST=withRouteAccess('/api/service/kunde360/notiz','POST',async(request:Request)=>{try{
 if(!sameOrigin(request))throw new PlatformError('Unzulässiger Ursprung.',403);
 const input=await adminBody(request);if(!input||typeof input!=='object'||Array.isArray(input))throw new PlatformError('Ungültige Eingabe.');
 const {customerId,...rest}=input as Record<string,unknown>;
 return Response.json(await customerNote(customerId,rest),{headers});
}catch(error){return Response.json({error:error instanceof PlatformError?error.message:'Die Notiz konnte nicht gespeichert werden.'},{status:error instanceof PlatformError?error.status:503,headers});}});
