import {withRouteAccess} from '@/platform/app-access/route-access';
import {missionPlan} from '@/apps/missioncontrol';
import {body,failure,headers} from '../http';
export const POST=withRouteAccess('/api/missioncontrol/plan','POST',async(request:Request)=>{try{return Response.json(await missionPlan(await body(request)),{headers});}catch(error){return failure(error);}});
