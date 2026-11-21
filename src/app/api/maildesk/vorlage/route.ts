import {withRouteAccess} from '@/platform/app-access/route-access';
import {maildeskOrderTemplate} from '@/apps/maildesk';
import {failure,headers} from '../http';
export const GET=withRouteAccess('/api/maildesk/vorlage','GET',async(request:Request)=>{try{return Response.json(await maildeskOrderTemplate(new URL(request.url).searchParams.get('id')??''),{headers});}catch(error){return failure(error);}});
