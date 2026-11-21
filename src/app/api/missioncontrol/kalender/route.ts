import {withRouteAccess} from '@/platform/app-access/route-access';
import {missionCalendarSetting} from '@/apps/missioncontrol';
import {body,failure,headers} from '../http';
export const POST=withRouteAccess('/api/missioncontrol/kalender','POST',async(request:Request)=>{try{return Response.json(await missionCalendarSetting(await body(request)),{headers});}catch(error){return failure(error);}});
