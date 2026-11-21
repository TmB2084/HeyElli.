import {withRouteAccess} from '@/platform/app-access/route-access';
import {adminRequest,adminBody,adminFailure,adminHeaders} from '@/system/einstellungen';
import {pdsConnectionStore} from '@/platform/pds/connection';
import {PlatformError} from '@/platform/store';
async function scopedGET(){try{const {user}=await adminRequest();return Response.json(await pdsConnectionStore().read(user.id),{headers:adminHeaders});}catch(error){return adminFailure(error);}}
async function scopedPOST(request:Request){try{const {user}=await adminRequest(request),input=await adminBody(request);if(!input||typeof input!=='object'||!('action' in input))throw new PlatformError('PDS-Aktion fehlt.');const store=pdsConnectionStore();if(input.action==='test')return Response.json(await store.test(user.id),{headers:adminHeaders});if(input.action==='calendar-test')return Response.json(await store.calendarTest(user.id),{headers:adminHeaders});if(['source','views','mapping'].includes(String(input.action)))return Response.json(await store.configure(user.id,input as Record<string,unknown>),{headers:adminHeaders});if(input.action==='save'){const url=new URL(request.url);if(url.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new PlatformError('Zugangsdaten nur über HTTPS einrichten.',403);return Response.json(await store.save(user.id,input),{headers:adminHeaders});}throw new PlatformError('Unbekannte PDS-Aktion.');}catch(error){return adminFailure(error);}}

export const GET=withRouteAccess('/api/verwaltung/pds','GET',scopedGET);

export const POST=withRouteAccess('/api/verwaltung/pds','POST',scopedPOST);
