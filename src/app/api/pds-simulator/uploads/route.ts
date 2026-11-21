import {ResourceError} from '@/platform/resource-budgets/model';
import {DataLimitError} from '@/platform/http-safety/limits';
import {withRouteAccess} from '@/platform/app-access/route-access';
import {appPermission} from '@/platform/app-access';
import {requireSimulatorWrites} from "@/platform/pds/connection";
import {} from "@/platform/session";
import {sameOrigin,session} from "@/platform/session";
import {localStore,documentName,MAX_DOCUMENT_BYTES} from "@/platform/pds/simulator/orders";
async function scopedPOST(request:Request) {
 try{await requireSimulatorWrites();}catch{return Response.json({error:"Diese Funktion ist im echten PDS-Lesebetrieb gesperrt."},{status:409});}

  const user=await session();
  if(!user || !(await appPermission(user,'/casedesk'))) return Response.json({error:user?"Für diese Aktion fehlt die Berechtigung.":"Bitte zuerst anmelden."},{status:user?403:401});
  if(!sameOrigin(request))return new Response(null,{status:403});
  if(Number(request.headers.get("Content-Length"))>MAX_DOCUMENT_BYTES)return Response.json({error:"Maximal 100 MB."},{status:413});
  try {
    const name=documentName(decodeURIComponent(request.headers.get("X-File-Name") ?? ""));
    const id=request.headers.get("X-Upload-Id") ?? "";
    if(!/^[a-f0-9-]{36}$/.test(id))return Response.json({error:"Ungültige Upload-Kennung."},{status:400});
    const store=localStore();
    try{return Response.json(await store.receiveUpload(id,name,user.id,request.body),{status:201});}finally{store.close();}
  }catch(error){return Response.json({error:error instanceof Error ? error.message : "Upload fehlgeschlagen."},{status:error instanceof ResourceError?error.status:error instanceof DataLimitError?413:400});}
}

export const POST=withRouteAccess('/api/pds-simulator/uploads','POST',scopedPOST);
