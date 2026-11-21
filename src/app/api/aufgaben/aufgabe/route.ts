import {withRouteAccess} from '@/platform/app-access/route-access';
import {taskDetail} from '@/apps/taskhub';
import {failure,headers} from '../http';
export const GET=withRouteAccess('/api/aufgaben/aufgabe','GET',async(request:Request)=>{try{return Response.json(await taskDetail(new URL(request.url).searchParams.get('id')),{headers});}catch(error){return failure(error);}});
