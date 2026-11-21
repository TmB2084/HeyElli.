import {standardPositionsForNewOrder} from '@/apps/casedesk/standardpositionen';
import {withRouteAccess} from '@/platform/app-access/route-access';
import {appPermission} from '@/platform/app-access';
import {requireSimulatorWrites} from "@/platform/pds/connection";
import {} from "@/platform/session";
import {PdsProtocolError} from "@/platform/pds/api";
import {createSimulatorOrder,serviceCalendarId,createdOrderLinks} from "@/platform/pds/simulator/write-entry";
import {calendarAuditStore} from "@/apps/planboard/kalender/server";
import { sameOrigin, session } from "@/platform/session";
import { InvalidOrder, localStore, validateOrder } from "@/platform/pds/simulator/orders";
async function scopedPOST(request:Request) {
 try{await requireSimulatorWrites();}catch{return Response.json({error:"Diese Funktion ist im echten PDS-Lesebetrieb gesperrt."},{status:409});}

  const user = await session();
  if (!user || !(await appPermission(user,'/casedesk'))) return Response.json({error:user?"Für diese Aktion fehlt die Berechtigung.":"Bitte zuerst anmelden."},{status:user?403:401});
  if (!sameOrigin(request)) return Response.json({error:"Unzulässiger Ursprung."},{status:403});
  const key = request.headers.get("Idempotency-Key") ?? "";
  if (!/^[a-f0-9-]{36}$/.test(key)) return Response.json({error:"Ungültige Anfragekennung."},{status:400});
  try {
    const text = await request.text();
    if (text.length > 16000) return Response.json({error:"Auftragsdaten zu groß. Bitte Dateien über den Upload übertragen."},{status:413});
    const raw = JSON.parse(text);
    const store = localStore();
    try {
      if(raw?.channel === "E-Mail") raw.document=store.uploaded(String(raw.document?.uploadId ?? ""),user.id);
      const input=validateOrder(raw,raw?.personScope==="all" ? store.allPersons() : store.persons(raw?.objectId));
      const saved=await createSimulatorOrder(store,input,key,user,await standardPositionsForNewOrder());
      let warning='';
      if(saved.mobileIssue&&saved.pdsReceipt){try{await calendarAuditStore().mobile(user.id,serviceCalendarId(saved.pdsReceipt.stoerungUUID),saved.technicianId,`order-create:${user.id}:${key}`);}catch{warning='Auftrag gespeichert und mobil ausgegeben. Die Terminhistorie konnte noch nicht ergänzt werden.';}}
      const [service,calendar]=await Promise.all([appPermission(user,'/servicehub','read'),appPermission(user,'/planboard','read')]);
      const links=createdOrderLinks(saved,{service,calendar});
      return Response.json({links,number:saved.number,mobileIssued:saved.mobileIssue,warning,document:saved.document ? {name:saved.document.name,category:saved.document.category} : null},{status:201});
    } finally { store.close(); }
  } catch(error) { return Response.json({error:error instanceof InvalidOrder || error instanceof PdsProtocolError ? error.message : "Auftrag konnte nicht gespeichert werden."},{status:error instanceof InvalidOrder || error instanceof PdsProtocolError || error instanceof SyntaxError ? 400 : 500}); }
}

export const POST=withRouteAccess('/api/pds-simulator/orders','POST',scopedPOST);
