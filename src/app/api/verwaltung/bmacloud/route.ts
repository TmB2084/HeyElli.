import {withRouteAccess} from '@/platform/app-access/route-access';
import {adminRequest,adminBody,adminFailure,adminHeaders} from '@/system/einstellungen';
import {bmaStore} from '@/platform/bmacloud';
import {PlatformError} from '@/platform/store';
async function scopedGET(){try{const {user}=await adminRequest();return Response.json(await bmaStore().read(user.id),{headers:adminHeaders});}catch(error){return adminFailure(error);}}
async function scopedPOST(request:Request){try{const {user}=await adminRequest(request),value=await adminBody(request);if(!value||typeof value!=='object'||Array.isArray(value))throw new PlatformError('BMACloud-Eingabe fehlt.');const input=value as Record<string,unknown>,store=bmaStore();if(input.action==='save'){const url=new URL(request.url);if(url.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new PlatformError('Zugangsdaten nur über HTTPS einrichten.',403);return Response.json(await store.save(user.id,input),{headers:adminHeaders});}if(input.action==='test')return Response.json(await store.test(user.id,input),{headers:adminHeaders});if(input.action==='mode')return Response.json(await store.mode(user.id,input),{headers:adminHeaders});throw new PlatformError('Unbekannte BMACloud-Aktion.');}catch(error){return adminFailure(error);}}

export const GET=withRouteAccess('/api/verwaltung/bmacloud','GET',scopedGET);

export const POST=withRouteAccess('/api/verwaltung/bmacloud','POST',scopedPOST);
