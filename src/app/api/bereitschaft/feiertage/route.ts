import {withRouteAccess} from '@/platform/app-access/route-access';
import {requireSimulatorWrites} from "@/platform/pds/connection";
import {session,permitted,sameOrigin} from '@/platform/session';
import {dutyResourcePreferenceStore} from '@/apps/dutyboard/server';
import {CalendarError} from '@/apps/planboard/kalender/domain';
const headers={'Cache-Control':'no-store'};
async function scopedGET(){try{await requireSimulatorWrites();}catch{return Response.json({error:"Bereitschaftsplanung und Mitarbeiterzuordnungen sind für diese Quelle noch nicht freigegeben."},{status:409});}
 const user=await session();if(!user||!permitted(user,'read'))return Response.json({error:'Bitte anmelden.'},{status:user?403:401,headers});
 try{return Response.json({...await dutyResourcePreferenceStore().readHolidays(user.id),owner:user.id},{headers});}catch{return Response.json({error:'Feiertagseinstellungen konnten nicht geladen werden.'},{status:500,headers});}
}
async function scopedPOST(request:Request){
 try{await requireSimulatorWrites();}catch{return Response.json({error:"Diese Funktion ist im echten PDS-Lesebetrieb gesperrt."},{status:409});}

 const user=await session();if(!user||!permitted(user,'read'))return Response.json({error:'Keine Berechtigung.'},{status:user?403:401,headers});
 if(!sameOrigin(request))return Response.json({error:'Unzulässiger Ursprung.'},{status:403,headers});
 try{const reader=request.body?.getReader();if(!reader)throw new CalendarError('Einstellungen fehlen.');const chunks:Uint8Array[]=[];let size=0;while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>16000){await reader.cancel();throw new CalendarError('Eingabe zu groß.',413);}chunks.push(part.value);}
  const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(body?.owner!==user.id)throw new CalendarError('Benutzer wurde gewechselt. Bitte Einstellungen neu laden.',409);
  return Response.json({...await dutyResourcePreferenceStore().writeHolidays(user.id,body.holidays,body.expectedVersion),owner:user.id},{headers});
 }catch(error){return Response.json({error:error instanceof CalendarError?error.message:'Feiertagseinstellungen konnten nicht gespeichert werden.'},{status:error instanceof CalendarError?error.status:400,headers});}
}

export const GET=withRouteAccess('/api/bereitschaft/feiertage','GET',scopedGET);

export const POST=withRouteAccess('/api/bereitschaft/feiertage','POST',scopedPOST);
