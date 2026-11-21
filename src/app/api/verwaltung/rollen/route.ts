import {withRouteAccess} from '@/platform/app-access/route-access';
import {adminRequest,adminBody,adminHeaders,adminFailure} from '@/system/einstellungen';
import {appRoleStore} from '@/platform/app-access';
async function scopedGET(){try{await adminRequest();return Response.json(await appRoleStore().read(),{headers:adminHeaders});}catch(error){return adminFailure(error);}}
async function scopedPOST(request:Request){try{const {user}=await adminRequest(request);return Response.json(await appRoleStore().mutate(user.id,await adminBody(request) as Record<string,unknown>),{headers:adminHeaders});}catch(error){return adminFailure(error);}}

export const GET=withRouteAccess('/api/verwaltung/rollen','GET',scopedGET);

export const POST=withRouteAccess('/api/verwaltung/rollen','POST',scopedPOST);
