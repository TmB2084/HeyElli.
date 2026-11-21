import {withRouteAccess} from '@/platform/app-access/route-access';
import {missionGoalChange,missionGoals} from '@/apps/missioncontrol';
import {body,failure,headers} from '../http';
export const GET=withRouteAccess('/api/missioncontrol/ziele','GET',async()=>{try{return Response.json(await missionGoals(),{headers});}catch(error){return failure(error);}});
export const POST=withRouteAccess('/api/missioncontrol/ziele','POST',async(request:Request)=>{try{return Response.json(await missionGoalChange(await body(request)),{headers});}catch(error){return failure(error);}});
