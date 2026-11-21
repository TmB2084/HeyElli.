import {withRouteAccess} from '@/platform/app-access/route-access';
import {adminRequest,adminBody,adminHeaders,adminFailure} from '@/system/einstellungen';
import {copilotStore} from '@/apps/askelli/copilot';
import {PlatformError} from '@/platform/store';
async function scopedGET(){try{const {user}=await adminRequest();return Response.json(await copilotStore().read(user.id),{headers:adminHeaders});}catch(error){return adminFailure(error);}}
async function scopedPOST(request:Request){try{const {user}=await adminRequest(request),input=await adminBody(request) as Record<string,unknown>;if(!input||typeof input!=='object')throw new PlatformError('Eingabe fehlt.');const url=new URL(request.url);if(url.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new PlatformError('Copilot nur über HTTPS einrichten.',403);const store=copilotStore();if(input.action==='save')return Response.json(await store.save(user.id,input),{headers:adminHeaders});if(input.action==='test')return Response.json(await store.test(user.id,input),{headers:adminHeaders});if(input.action==='mode')return Response.json(await store.mode(user.id,input),{headers:adminHeaders});throw new PlatformError('Unbekannte Aktion.');}catch(error){return adminFailure(error);}}

export const GET=withRouteAccess('/api/verwaltung/copilot','GET',scopedGET);

export const POST=withRouteAccess('/api/verwaltung/copilot','POST',scopedPOST);
