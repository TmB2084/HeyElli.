import {withRouteAccess} from '@/platform/app-access/route-access';
import {sameOrigin} from '@/platform/session';
import {adminBody} from '@/system/einstellungen';
import {PlatformError} from '@/platform/store';
import {taskCreate} from '@/apps/taskhub';
import {failure,headers} from '../http';
export const POST=withRouteAccess('/api/aufgaben/neu','POST',async(request:Request)=>{try{
 if(!sameOrigin(request))throw new PlatformError('Unzulässiger Ursprung.',403);
 const input=await adminBody(request);if(!input||typeof input!=='object'||Array.isArray(input))throw new PlatformError('Ungültige Eingabe.');
 return Response.json(await taskCreate(input),{headers});
}catch(error){return failure(error);}});
