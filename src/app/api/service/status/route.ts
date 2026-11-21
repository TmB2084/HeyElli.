import {withRouteAccess} from '@/platform/app-access/route-access';
import {serviceOrderActions} from '@/apps/servicehub/akten';
import {PlatformError} from '@/platform/store';
import {CalendarError} from '@/apps/planboard/kalender/domain';
async function handle(request:Request){try{return Response.json(await serviceOrderActions(request),{headers:{'Cache-Control':'no-store'}});}catch(error){return Response.json({error:(error instanceof CalendarError||error instanceof PlatformError)?error.message:'Auftragsaktion konnte nicht bestätigt werden. Bitte den aktuellen Auftragsstatus prüfen.'},{status:(error instanceof CalendarError||error instanceof PlatformError)?error.status:502,headers:{'Cache-Control':'no-store'}});}}
export const GET=withRouteAccess('/api/service/status','GET',handle);
export const POST=withRouteAccess('/api/service/status','POST',handle);
