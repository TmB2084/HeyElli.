import {withRouteAccess} from '@/platform/app-access/route-access';
import {adminHeaders,adminFailure} from '@/system/einstellungen';
import {incidentDefaultsRequest} from '@/apps/casedesk/standardpositionen';
async function handle(request:Request){try{return Response.json(await incidentDefaultsRequest(request),{headers:adminHeaders});}catch(error){return adminFailure(error);}}
export const GET=withRouteAccess('/api/verwaltung/stoerungsmeister','GET',handle);
export const POST=withRouteAccess('/api/verwaltung/stoerungsmeister','POST',handle);
