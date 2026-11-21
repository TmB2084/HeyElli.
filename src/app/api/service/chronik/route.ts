import {withRouteAccess} from '@/platform/app-access/route-access';
import {chronicleRead,dispatchFailure} from '@/apps/servicehub/akten';
export const GET=withRouteAccess('/api/service/chronik','GET',async(request:Request)=>{try{return Response.json(await chronicleRead(new URL(request.url).searchParams,request.signal),{headers:{'Cache-Control':'no-store'}});}catch(error){return dispatchFailure(error);}});
