import {withRouteAccess} from '@/platform/app-access/route-access';
import {missionNoteChange,missionNotes} from '@/apps/missioncontrol';
import {body,failure,headers} from '../http';
export const GET=withRouteAccess('/api/missioncontrol/notizen','GET',async(request:Request)=>{try{return Response.json(await missionNotes(new URL(request.url).searchParams.get('aufgabe')),{headers});}catch(error){return failure(error);}});
export const POST=withRouteAccess('/api/missioncontrol/notizen','POST',async(request:Request)=>{try{return Response.json(await missionNoteChange(await body(request)),{headers});}catch(error){return failure(error);}});
