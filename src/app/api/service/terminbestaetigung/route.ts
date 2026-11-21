import {withRouteAccess} from '@/platform/app-access/route-access';
import {sameOrigin} from '@/platform/session';
import {adminBody} from '@/system/einstellungen';
import {PlatformError} from '@/platform/store';
import {confirmationRequest,dispatchFailure} from '@/apps/servicehub/akten';
export const POST=withRouteAccess('/api/service/terminbestaetigung','POST',async(request:Request)=>{try{if(!sameOrigin(request))throw new PlatformError('Unzulässiger Ursprung.',403);const input=await adminBody(request);if(!input||typeof input!=='object'||Array.isArray(input))throw new PlatformError('Eingabe fehlt.');return Response.json(await confirmationRequest(input as Record<string,unknown>,request.signal),{headers:{'Cache-Control':'no-store'}});}catch(error){return dispatchFailure(error);}});
