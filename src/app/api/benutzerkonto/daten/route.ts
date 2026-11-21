import {withRouteAccess} from '@/platform/app-access/route-access';
import {lifecycleRequest} from '@/platform/data-lifecycle/server';
const handle=(request:Request)=>lifecycleRequest(request,false,false);
export const GET=withRouteAccess('/api/benutzerkonto/daten','GET',handle);
export const POST=withRouteAccess('/api/benutzerkonto/daten','POST',handle);
