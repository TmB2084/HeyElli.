import {withRouteAccess} from '@/platform/app-access/route-access';
import {missionFocus} from '@/apps/missioncontrol';
import {body,failure,headers} from '../http';
export const POST=withRouteAccess('/api/missioncontrol/fokus','POST',async(request:Request)=>{try{return Response.json(await missionFocus(await body(request)),{headers});}catch(error){return failure(error);}});
