import {withRouteAccess} from '@/platform/app-access/route-access';
import {lifecycleRequest} from '@/platform/data-lifecycle/server';
const handle=(request:Request)=>lifecycleRequest(request,true,false);
export const GET=withRouteAccess('/api/verwaltung/datenschutz','GET',handle);
export const POST=withRouteAccess('/api/verwaltung/datenschutz','POST',handle);
