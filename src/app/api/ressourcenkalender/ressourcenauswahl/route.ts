import {withRouteAccess} from '@/platform/app-access/route-access';
import {permitted} from "@/platform/session";
import {session,sameOrigin} from "@/platform/session";
import {resourceSelectionStore,selectionOwner} from "@/apps/planboard/kalender/server";
import {CalendarError} from "@/apps/planboard/kalender/domain";
const headers={"Cache-Control":"no-store"};
async function scopedGET(){
 const user=await session();if(!user || !permitted(user,"read"))return Response.json({error:user?"Für diese Aktion fehlt die Berechtigung.":"Bitte zuerst anmelden."},{status:user?403:401,headers});
 try{return Response.json({...await resourceSelectionStore().readSettings(user.id),displayName:user.displayName??'Angemeldeter Benutzer'},{headers});}catch{return Response.json({error:"Ressourcenauswahl konnte nicht geladen werden."},{status:500,headers});}
}
async function scopedPOST(request:Request){
 const user=await session();if(!user || !permitted(user,"read"))return Response.json({error:user?"Für diese Aktion fehlt die Berechtigung.":"Bitte zuerst anmelden."},{status:user?403:401,headers});
 if(!sameOrigin(request))return Response.json({error:"Unzulässiger Ursprung."},{status:403,headers});
 try{
  const reader=request.body?.getReader();if(!reader)throw new CalendarError("Ressourcenauswahl fehlt.");
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>1100000){await reader.cancel();throw new CalendarError("Eingabe zu groß.",413);}chunks.push(value);}
  const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if(body?.owner!==await selectionOwner(user.id))throw new CalendarError("Benutzer wurde gewechselt. Bitte Auswahl neu öffnen.",409);
  if(!Object.hasOwn(body,"showWeekends")&&!Object.hasOwn(body,"selection")&&!Object.hasOwn(body,"showTechnicianBadges")&&!Object.hasOwn(body,"limitWorkingHours")&&!Object.hasOwn(body,"showTentative"))throw new CalendarError("Einstellung fehlt.");
  return Response.json(await resourceSelectionStore().update(user.id,body,body.expectedVersion),{headers});
 }catch(error){return Response.json({error:error instanceof CalendarError?error.message:"Ressourcenauswahl konnte nicht gespeichert werden."},{status:error instanceof CalendarError?error.status:400,headers});}
}

export const GET=withRouteAccess('/api/ressourcenkalender/ressourcenauswahl','GET',scopedGET);

export const POST=withRouteAccess('/api/ressourcenkalender/ressourcenauswahl','POST',scopedPOST);
