import {withRouteAccess} from '@/platform/app-access/route-access';
import {sameOrigin} from '@/platform/session';
import {adminBody} from '@/system/einstellungen';
import {PlatformError} from '@/platform/store';
import {dispatchRead,dispatchSelect,dispatchFailure} from '@/apps/servicehub/akten';
const headers={'Cache-Control':'no-store'};
export const GET=withRouteAccess('/api/service/einsatzmappe','GET',async(request:Request)=>{try{const p=new URL(request.url).searchParams;return Response.json(await dispatchRead(p.get('order')??'',p.get('revision')??'',p.get('section')??'selection',p.get('target')??'',request.signal),{headers});}catch(error){return dispatchFailure(error);}});
export const POST=withRouteAccess('/api/service/einsatzmappe','POST',async(request:Request)=>{try{if(!sameOrigin(request))throw new PlatformError('Unzulässiger Ursprung.',403);const p=new URL(request.url).searchParams,input=await adminBody(request);if(!input||typeof input!=='object'||Array.isArray(input))throw new PlatformError('Ungültige Dokumentauswahl.');return Response.json(await dispatchSelect(p.get('order')??'',p.get('revision')??'',input,request.signal),{headers});}catch(error){return dispatchFailure(error);}});
