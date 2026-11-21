import {withRouteAccess} from '@/platform/app-access/route-access';
import {adminRequest,adminBody,adminFailure,adminHeaders} from "@/system/einstellungen";
import {PlatformError} from "@/platform/store";
async function scopedDELETE(request:Request) {
  try {
    const {user,store}=await adminRequest(request),body=await adminBody(request);
    if (!body || typeof body!=="object" || !("id" in body) || typeof body.id!=="string") throw new PlatformError("Sitzungskennung fehlt.");
    await store.revokeSession(user.id,body.id);return Response.json({revoked:true},{headers:adminHeaders});
  } catch(error) {return adminFailure(error);}
}

export const DELETE=withRouteAccess('/api/verwaltung/sitzungen','DELETE',scopedDELETE);
