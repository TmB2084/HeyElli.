import {withRouteAccess} from '@/platform/app-access/route-access';
import {taskFormOptions} from '@/apps/taskhub';
import {failure,headers} from '../http';
export const GET=withRouteAccess('/api/aufgaben/vorlage','GET',async()=>{try{return Response.json(await taskFormOptions(),{headers});}catch(error){return failure(error);}});
