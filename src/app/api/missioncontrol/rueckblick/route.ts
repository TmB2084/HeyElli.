import {withRouteAccess} from '@/platform/app-access/route-access';
import {missionReview} from '@/apps/missioncontrol';
import {failure,headers} from '../http';
export const GET=withRouteAccess('/api/missioncontrol/rueckblick','GET',async()=>{try{return Response.json(await missionReview(),{headers});}catch(error){return failure(error);}});
