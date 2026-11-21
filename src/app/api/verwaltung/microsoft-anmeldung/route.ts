import {withRouteAccess} from '@/platform/app-access/route-access';
import {adminRequest,adminBody,adminHeaders,adminFailure} from '@/system/einstellungen';
import {microsoftAuthStore} from '@/system/anmeldung/microsoft';
import {PlatformError} from '@/platform/store';
async function scopedGET(){try{const {user}=await adminRequest();return Response.json(await microsoftAuthStore().read(user.id),{headers:adminHeaders});}catch(error){return adminFailure(error);}}
async function scopedPOST(request:Request){try{const {user}=await adminRequest(request),input=await adminBody(request) as Record<string,unknown>;if(!input||typeof input!=='object')throw new PlatformError('Eingabe fehlt.');const url=new URL(request.url);if(input.action==='save'){if(url.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new PlatformError('Zugangsdaten nur über HTTPS einrichten.',403);return Response.json(await microsoftAuthStore().save(user.id,input),{headers:adminHeaders});}if(input.action==='restore')return Response.json(await microsoftAuthStore().restore(user.id,input),{headers:adminHeaders});if(input.action==='mode')return Response.json(await microsoftAuthStore().toggle(user.id,input),{headers:adminHeaders});throw new PlatformError('Unbekannte Aktion.');}catch(error){return adminFailure(error);}}

export const GET=withRouteAccess('/api/verwaltung/microsoft-anmeldung','GET',scopedGET);

export const POST=withRouteAccess('/api/verwaltung/microsoft-anmeldung','POST',scopedPOST);
