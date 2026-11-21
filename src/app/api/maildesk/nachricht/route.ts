import {withRouteAccess} from '@/platform/app-access/route-access';
import {maildeskMessage} from '@/apps/maildesk';
import {failure,headers} from '../http';
export const GET=withRouteAccess('/api/maildesk/nachricht','GET',async(request:Request)=>{try{return Response.json(await maildeskMessage(new URL(request.url).searchParams.get('id')??''),{headers});}catch(error){return failure(error);}});
