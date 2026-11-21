import {ResourceError} from '@/platform/resource-budgets/model';
import {DataLimitError} from '@/platform/http-safety/limits';
import {withRouteAccess} from '@/platform/app-access/route-access';
import {pdsApi} from '@/platform/pds/connection/api';
import {availabilityInput,planningAvailability} from '@/apps/planboard/verfuegbarkeit';
import {addDays} from '@/apps/planboard/kalender/domain';
const headers={'Cache-Control':'no-store'};
async function scopedGET(request:Request){
 let input;try{input=availabilityInput(new URL(request.url).searchParams);}catch{return Response.json({error:'Bitte Mitarbeiter, Beginn und eine gültige Dauer auswählen.'},{status:400,headers});}
 try{const api=await pdsApi();try{const data=await api.calendar.availability(input.start.slice(0,10),addDays(input.start.slice(0,10),13));
 // Existing planning is currently writable only locally. Exclude precisely that
 // service occurrence; other appointments, including continued visits, still count.
 if(input.existingIncidentId&&api.source.mode==='simulator')data.events=data.events.filter(event=>event.id!=='sim-service-termin-'+input.existingIncidentId);
 return Response.json(planningAvailability(data,input),{headers});}finally{api.close();}}
 catch(error){if(error instanceof ResourceError||error instanceof DataLimitError)return Response.json({error:error.message},{status:error.status,headers});return Response.json({error:'Die Verfügbarkeit konnte nicht vollständig geprüft werden. Bitte später erneut versuchen. Deine Eingaben bleiben erhalten.'},{status:502,headers});}
}
export const GET=withRouteAccess('/api/planung/verfuegbarkeit','GET',scopedGET);
