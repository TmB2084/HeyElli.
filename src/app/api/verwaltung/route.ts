import {withRouteAccess} from '@/platform/app-access/route-access';
import {adminRequest,adminFailure,adminHeaders} from "@/system/einstellungen";
async function scopedGET() {
  try {const {user,store}=await adminRequest();return Response.json(await store.overview(user.id),{headers:adminHeaders});}
  catch(error) {return adminFailure(error);}
}

export const GET=withRouteAccess('/api/verwaltung','GET',scopedGET);
