import {withRouteAccess} from '@/platform/app-access/route-access';
import {maildeskOverview} from '@/apps/maildesk';
import {failure,headers} from './http';
export const GET=withRouteAccess('/api/maildesk','GET',async(request:Request)=>{try{const url=new URL(request.url);return Response.json(await maildeskOverview(url.searchParams.get('ordner')??'inbox',(url.searchParams.get('q')??'').slice(0,200),url.searchParams.get('neu')==='1'),{headers});}catch(error){return failure(error);}});
