import {withRouteAccess} from '@/platform/app-access/route-access';
import {adminRequest,adminBody,adminFailure,adminHeaders} from "@/system/einstellungen";
import {systemSettingsStore} from "@/platform/store";
async function scopedGET() {
  try {await adminRequest();return Response.json(await systemSettingsStore().read(),{headers:adminHeaders});}
  catch(error){return adminFailure(error);}
}
async function scopedPOST(request:Request) {
  try {const {user}=await adminRequest(request);return Response.json(await systemSettingsStore().save(user.id,await adminBody(request)),{headers:adminHeaders});}
  catch(error){return adminFailure(error);}
}

export const GET=withRouteAccess('/api/verwaltung/einstellungen','GET',scopedGET);

export const POST=withRouteAccess('/api/verwaltung/einstellungen','POST',scopedPOST);
