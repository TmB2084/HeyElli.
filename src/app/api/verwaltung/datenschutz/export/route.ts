import {withRouteAccess} from '@/platform/app-access/route-access';
import {lifecycleRequest} from '@/platform/data-lifecycle/server';
const handle=(request:Request)=>lifecycleRequest(request,true,true);
export const GET=withRouteAccess('/api/verwaltung/datenschutz/export','GET',handle);
