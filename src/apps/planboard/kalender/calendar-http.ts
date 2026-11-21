import {DataLimitError} from '../../../platform/http-safety/limits';
import {appPermission} from '@/platform/app-access';
import {requireSimulatorWrites} from "@/platform/pds/connection";
import {guardDutyExclusions} from '@/apps/dutyboard/server';
import {permitted} from "@/platform/session";
import {session,sameOrigin} from "@/platform/session";
import {pdsApi} from "@/platform/pds/connection/api";
import {colorSettingsStore,calendarAuditStore} from "@/apps/planboard/kalender/server";
import {normalizeColorRules,CalendarError,CalendarConflictError,draftAuthors,type ConflictProvenance} from "@/apps/planboard/kalender/domain";
const headers={"Cache-Control":"no-store"};
function failure(error:unknown,provenance?:ConflictProvenance){return Response.json({error:error instanceof CalendarError||error instanceof DataLimitError?error.message:"Die PDS-Kalenderanfrage ist fehlgeschlagen.",...(error instanceof CalendarConflictError?{current:error.current,conflicts:error.conflicts,provenance}:{})},{status:error instanceof CalendarError?error.status:502,headers});}
export async function GET(request:Request){
 const user=await session();
  if(!permitted(user,"read")||!await appPermission(user,'/planboard','read'))return Response.json({error:user?"Für diese Aktion fehlt die Berechtigung.":"Bitte zuerst anmelden."},{status:user?403:401,headers});
  const url=new URL(request.url),api=await pdsApi();
  try{const data=await api.calendar.list(url.searchParams.get("from")??"",url.searchParams.get("to")??"");const statusCatalogs=await api.calendar.statusCatalogs();const local=await colorSettingsStore().readWithCatalogs(statusCatalogs),pdsColors=data.colorSource==="view"?normalizeColorRules(data.colors,statusCatalogs):[];return Response.json({...data,source:{mode:api.source.mode,id:api.source.mode==='simulator'?null:api.source.workspaceId},permissions:{serviceRead:await appPermission(user,'/servicehub','read'),write:api.source.mode==='simulator'&&(await appPermission(user,'/planboard')),admin:permitted(user,"admin")},statusCatalogs,pdsColors,colorLayouts:local.colorLayouts,colors:data.colorSource==="view"?[...pdsColors,...local.rules]:[...local.rules,...normalizeColorRules(data.colors,statusCatalogs)]},{headers});}catch(error){return failure(error);}finally{api.close();}
}
export async function POST(request:Request){
 try{await requireSimulatorWrites();}catch{return Response.json({error:"Echter PDS-Betrieb ist nur lesend freigegeben."},{status:409});}

  const user=await session();if(!user || !(await appPermission(user,'/planboard')))return Response.json({error:user?"Für diese Aktion fehlt die Berechtigung.":"Bitte zuerst anmelden."},{status:user?403:401,headers});
  if(!sameOrigin(request))return Response.json({error:"Unzulässiger Ursprung."},{status:403,headers});
  const api=await pdsApi("calendar:"+user.id,(before,after)=>calendarAuditStore().record(user.id,before,after),guardDutyExclusions);
  const receivedAt=new Date().toISOString();let editedAt:unknown;
  try{
    const reader=request.body?.getReader();if(!reader)throw new CalendarError("Terminänderung fehlt.");
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>32000){await reader.cancel();throw new CalendarError("Terminänderung zu groß.",413);}chunks.push(value);}
    let body:unknown;try{body=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw new CalendarError("Ungültige Terminänderung.");}
    await api.calendar.checkWriteAvailability(body);
    editedAt=(body as {editedAt?:unknown})?.editedAt;
    const continuation=await api.continuations.handle(body,false);
    if(continuation?.preview)return Response.json(continuation.preview,{status:409,headers});
    if(continuation?.warnings)return Response.json({planningWarnings:continuation.warnings},{status:409,headers});
    if(continuation?.saved)return Response.json(continuation.saved,{headers});
    const warnings=await api.calendar.planningWarnings(body);
    if(warnings.length&&(body as {acceptPlanningWarnings?:unknown}).acceptPlanningWarnings!==true)return Response.json({planningWarnings:warnings},{status:409,headers});
    return Response.json(await api.calendar.update(body),{headers});}catch(error){
    if(error instanceof CalendarConflictError){
      let current:ConflictProvenance['current']={};try{current=await calendarAuditStore().read(error.current,error.conflicts);}catch{/* Unknown is safer than assigning an unverified actor. */}
      return failure(error,{current,mine:draftAuthors(error.conflicts,user.displayName??'Angemeldeter Benutzer',editedAt,receivedAt)});
    }
    return failure(error);
  }finally{api.close();}
}

export async function DELETE(request:Request){
 try{await requireSimulatorWrites();}catch{return Response.json({error:"Echter PDS-Betrieb ist nur lesend freigegeben."},{status:409});}

  const user=await session();if(!user || !(await appPermission(user,'/planboard')))return Response.json({error:user?"Für diese Aktion fehlt die Berechtigung.":"Bitte zuerst anmelden."},{status:user?403:401,headers});
  if(!sameOrigin(request))return Response.json({error:"Unzulässiger Ursprung."},{status:403,headers});
  const api=await pdsApi("calendar-delete:"+user.id);
  try{
    const reader=request.body?.getReader();if(!reader)throw new CalendarError("Löschanfrage fehlt.");
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>16000){await reader.cancel();throw new CalendarError("Löschanfrage zu groß.",413);}chunks.push(value);}
    let input:unknown;try{input=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw new CalendarError("Ungültige Löschanfrage.");}
    return Response.json(await api.calendar.remove(input),{headers});
  }catch(error){return failure(error);}finally{api.close();}
}
