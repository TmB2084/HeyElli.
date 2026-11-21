import {withRouteAccess} from '@/platform/app-access/route-access';
import {adminRequest,adminBody,adminHeaders,adminFailure} from '@/system/einstellungen';
import {platformDatabase} from '@/platform/store';
import {operationsStore} from '@/platform/operations';
export const GET=withRouteAccess('/api/verwaltung/betriebsstatus','GET',async()=>{try{const {user}=await adminRequest();return Response.json(await operationsStore(platformDatabase()).read(user.id),{headers:adminHeaders});}catch(error){return adminFailure(error);}});
export const POST=withRouteAccess('/api/verwaltung/betriebsstatus','POST',async(request:Request)=>{try{const {user}=await adminRequest(request),body=await adminBody(request) as {id?:unknown};return Response.json(await operationsStore(platformDatabase()).acknowledge(user.id,body?.id),{headers:adminHeaders});}catch(error){return adminFailure(error);}});
