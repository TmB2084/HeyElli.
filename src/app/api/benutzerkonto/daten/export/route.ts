import {withRouteAccess} from '@/platform/app-access/route-access';
import {lifecycleRequest} from '@/platform/data-lifecycle/server';
const handle=(request:Request)=>lifecycleRequest(request,false,true);
export const GET=withRouteAccess('/api/benutzerkonto/daten/export','GET',handle);
