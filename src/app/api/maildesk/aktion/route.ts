import {withRouteAccess} from '@/platform/app-access/route-access';
import {sameOrigin} from '@/platform/session';
import {adminBody} from '@/system/einstellungen';
import {PlatformError} from '@/platform/store';
import {maildeskAction} from '@/apps/maildesk';
import {failure,headers} from '../http';
export const POST=withRouteAccess('/api/maildesk/aktion','POST',async(request:Request)=>{try{
 if(!sameOrigin(request))throw new PlatformError('Unzulässiger Ursprung.',403);
 const input=await adminBody(request);if(!input||typeof input!=='object'||Array.isArray(input))throw new PlatformError('Ungültige Eingabe.');
 const {id,...rest}=input as Record<string,unknown>;
 return Response.json(await maildeskAction(id,rest),{headers});
}catch(error){return failure(error);}});
