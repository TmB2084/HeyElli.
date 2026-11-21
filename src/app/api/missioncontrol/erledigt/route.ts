import {withRouteAccess} from '@/platform/app-access/route-access';
import {missionComplete} from '@/apps/missioncontrol';
import {body,failure,headers} from '../http';
export const POST=withRouteAccess('/api/missioncontrol/erledigt','POST',async(request:Request)=>{try{return Response.json(await missionComplete(await body(request)),{headers});}catch(error){return failure(error);}});
