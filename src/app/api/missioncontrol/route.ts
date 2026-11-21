import {withRouteAccess} from '@/platform/app-access/route-access';
import {missionOverview} from '@/apps/missioncontrol';
import {failure,headers} from './http';
export const GET=withRouteAccess('/api/missioncontrol','GET',async(request:Request)=>{try{return Response.json(await missionOverview(new URL(request.url).searchParams.get('neu')==='1'),{headers});}catch(error){return failure(error);}});
