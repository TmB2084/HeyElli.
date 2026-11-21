import {withRouteAccess} from '@/platform/app-access/route-access';
import {saveExistingPlanning} from '@/apps/servicehub/akten';
import {CalendarError} from '@/apps/planboard/kalender/domain';
async function scopedPOST(request:Request){try{return Response.json(await saveExistingPlanning(request),{headers:{'Cache-Control':'no-store'}});}catch(error){return Response.json({error:error instanceof CalendarError?error.message:'Planung konnte nicht bestätigt werden. Eingaben bleiben erhalten.'},{status:error instanceof CalendarError?error.status:502,headers:{'Cache-Control':'no-store'}});}}

export const POST=withRouteAccess('/api/service/planung','POST',scopedPOST);
