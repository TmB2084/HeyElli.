import {withRouteAccess} from '@/platform/app-access/route-access';
import {appPermission} from '@/platform/app-access';
import {requireSimulatorWrites} from "@/platform/pds/connection";
import {} from "@/platform/session";
import {PdsProtocolError} from "@/platform/pds/api";
import {createSimulatorContact} from "@/platform/pds/simulator/write-entry";
import {sameOrigin,session} from "@/platform/session";
import {InvalidOrder,localStore} from "@/platform/pds/simulator/orders";
async function scopedPOST(request:Request) {
 try{await requireSimulatorWrites();}catch{return Response.json({error:"Diese Funktion ist im echten PDS-Lesebetrieb gesperrt."},{status:409});}

  const user=await session();
  if(!user || !(await appPermission(user,'/casedesk'))) return Response.json({error:user?"Für diese Aktion fehlt die Berechtigung.":"Bitte zuerst anmelden."},{status:user?403:401});
  if(!sameOrigin(request)) return new Response(null,{status:403});
  try {
    const text=await request.text();if(text.length>2000)return new Response(null,{status:413});
    const input=JSON.parse(text);const store=localStore();
    try {const person=await createSimulatorContact(store,input,user.id);return Response.json({id:person.id,name:person.name,label:`${person.name} · ${person.function} · ${person.customerNumber}`,customerNumber:person.customerNumber,customerNumbers:person.customerNumbers,function:person.function,phones:person.phones},{status:201});} finally {store.close();}
  } catch(error) {return Response.json({error:error instanceof InvalidOrder || error instanceof PdsProtocolError ? error.message : "Person konnte nicht angelegt werden."},{status:error instanceof InvalidOrder || error instanceof PdsProtocolError || error instanceof SyntaxError ? 400:500});}
}

export const POST=withRouteAccess('/api/pds-simulator/persons','POST',scopedPOST);
