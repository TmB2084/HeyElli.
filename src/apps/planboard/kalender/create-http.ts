import {appPermission} from '@/platform/app-access';
import {requireSimulatorWrites} from "@/platform/pds/connection";
import {guardDutyExclusions} from '@/apps/dutyboard/server';
import {} from "@/platform/session";
import {session,sameOrigin} from "@/platform/session";
import {pdsApi} from "@/platform/pds/connection/api";
import {CalendarError} from "@/apps/planboard/kalender/domain";
const headers={"Cache-Control":"no-store"};
export async function POST(request:Request){
 try{await requireSimulatorWrites();}catch{return Response.json({error:"Echter PDS-Betrieb ist nur lesend freigegeben."},{status:409});}

  const user=await session();
  if(!user || !(await appPermission(user,'/planboard')))return Response.json({error:user?"Für diese Aktion fehlt die Berechtigung.":"Bitte zuerst anmelden."},{status:user?403:401,headers});
  if(!sameOrigin(request))return Response.json({error:"Unzulässiger Ursprung."},{status:403,headers});
  const key=request.headers.get("Idempotency-Key")??"";
  if(!/^[a-f0-9-]{36}$/.test(key))return Response.json({error:"Ungültige Anlagekennung."},{status:400,headers});
  try{
    const reader=request.body?.getReader();if(!reader)throw new CalendarError("Termindaten fehlen.");
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>16000){await reader.cancel();throw new CalendarError("Termindaten zu groß.",413);}chunks.push(value);}
    let input:unknown;try{input=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw new CalendarError("Ungültige Termindaten.");}
    const api=await pdsApi(`calendar-create:${user.id}:${key}`,undefined,guardDutyExclusions);
    try{await api.calendar.checkWriteAvailability(input,true);const continuation=await api.continuations.handle(input,true,key);
      if(continuation?.preview)return Response.json(continuation.preview,{status:409,headers});
      if(continuation?.warnings)return Response.json({planningWarnings:continuation.warnings},{status:409,headers});
      if(continuation?.saved)return Response.json(continuation.saved,{status:201,headers});
      const warnings=await api.calendar.planningWarnings(input,true);
      if(warnings.length&&(input as {acceptPlanningWarnings?:unknown}).acceptPlanningWarnings!==true)return Response.json({planningWarnings:warnings},{status:409,headers});
      return Response.json(await api.calendar.create(input),{status:201,headers});}finally{api.close();}
  }catch(error){return Response.json({error:error instanceof CalendarError?error.message:"Der Termin konnte nicht in PDS angelegt werden."},{status:error instanceof CalendarError?error.status:502,headers});}
}
