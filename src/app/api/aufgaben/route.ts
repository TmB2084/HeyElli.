import {withRouteAccess} from '@/platform/app-access/route-access';
import {tasksOverview} from '@/apps/taskhub';
import {failure,headers} from './http';
export const GET=withRouteAccess('/api/aufgaben','GET',async(request:Request)=>{try{return Response.json(await tasksOverview(new URL(request.url).searchParams.get('neu')==='1'),{headers});}catch(error){return failure(error);}});
