import {withRouteAccess} from '@/platform/app-access/route-access';
import {session,sameOrigin,permitted} from "@/platform/session";
import {appearanceSettingsStore,appearanceOwner} from "@/apps/planboard/kalender/server";
import {CalendarError} from "@/apps/planboard/kalender/domain";
import {systemSettingsStore} from "@/platform/store";
const headers={"Cache-Control":"no-store"};
function failure(error:unknown) {return Response.json({error:error instanceof CalendarError?error.message:"Darstellungseinstellungen sind derzeit nicht verfügbar."},{status:error instanceof CalendarError?error.status:503,headers});}
async function scopedGET() {
  try {
    const user=await session();
    if(!user||!permitted(user,"read"))return Response.json({error:"Bitte zuerst anmelden."},{status:user?403:401,headers});
    return Response.json({...await appearanceSettingsStore().read(user.id),owner:appearanceOwner(user.id),defaultAppearance:(await systemSettingsStore().read()).defaultAppearance},{headers});
  }catch(error){return failure(error);}
}
async function scopedPOST(request:Request) {
  try {
    const user=await session();
    if(!user||!permitted(user,"read"))return Response.json({error:"Bitte zuerst anmelden."},{status:user?403:401,headers});
    if(!sameOrigin(request))return Response.json({error:"Unzulässiger Ursprung."},{status:403,headers});
    const reader=request.body?.getReader();if(!reader)throw new CalendarError("Darstellung fehlt.");
    let size=0;const chunks:Uint8Array[]=[];
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw new CalendarError("Eingabe zu groß.",413);}chunks.push(value);}
    let body;try{body=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw new CalendarError("Ungültige Eingabe.");}
    if(!body||body.owner!==appearanceOwner(user.id))throw new CalendarError("Benutzer wurde gewechselt. Bitte neu laden.",409);
    if(body.importIfUnset!==undefined&&typeof body.importIfUnset!=="boolean")throw new CalendarError("Ungültige Übernahmeoption.");
    return Response.json({...await appearanceSettingsStore().write(user.id,body.appearance,body.expectedVersion,body.importIfUnset===true),owner:appearanceOwner(user.id)},{headers});
  }catch(error){return failure(error);}
}

export const GET=withRouteAccess('/api/einstellungen','GET',scopedGET);

export const POST=withRouteAccess('/api/einstellungen','POST',scopedPOST);
