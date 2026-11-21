import {appPermission} from '@/platform/app-access';
import {requireSimulatorWrites} from "@/platform/pds/connection";
import {session,sameOrigin} from '@/platform/session';
import {pdsApi} from "@/platform/pds/connection/api";
import {calendarAuditStore} from '@/apps/planboard/kalender/server';
const headers={'Cache-Control':'no-store'};
export async function POST(request:Request){
 try{await requireSimulatorWrites();}catch{return Response.json({error:"Echter PDS-Betrieb ist nur lesend freigegeben."},{status:409});}

 const user=await session();
 if(!user||!(await appPermission(user,'/planboard')))return Response.json({error:'Keine Schreibberechtigung.'},{status:user?403:401,headers});
 if(!sameOrigin(request))return Response.json({error:'Unzulässiger Ursprung.'},{status:403,headers});
 const text=await request.text();if(text.length>2000)return Response.json({error:'Anfrage zu groß.'},{status:413,headers});
 let body;try{body=JSON.parse(text);}catch{return Response.json({error:'Ungültige Anfrage.'},{status:400,headers});}
 if(!body||typeof body.id!=='string'||body.id.length>200||typeof body.mainId!=='string')return Response.json({error:'Termin und Haupttechniker fehlen.'},{status:400,headers});
 const api=await pdsApi(`calendar-mobile:${user.id}:${crypto.randomUUID()}`);let issued=false;
 try{
  const event=await api.calendar.details(body.id);
  if(event.type!=='SERVICEAUFTRAGEBENE'||event.link?.type!=='SERVICEAUFTRAG'||!event.link.id||!event.mainTechnicianId||event.continuation?.serviceCopy)return Response.json({error:'Für diesen Termin ist keine eindeutige mobile Serviceausgabe verfügbar.'},{status:400,headers});
  if(event.mainTechnicianId!==body.mainId)return Response.json({error:'Der Haupttechniker wurde geändert. Bitte Termin erneut öffnen.'},{status:409,headers});
  await api.transport.request('POST','/service/mobilausgeben',{uuid:event.link.id,auftragspool:false});issued=true;
  await calendarAuditStore().mobile(user.id,event.id,event.mainTechnicianId);
  return Response.json({ok:true},{headers});
 }catch{return Response.json({error:issued?'Mobil ausgegeben, aber die Historie konnte nicht gespeichert werden. Bitte keine erneute Ausgabe auslösen.':'Die Ausgabe konnte nicht bestätigt werden. Bitte den Ausgabestatus in PDS prüfen, bevor erneut ausgegeben wird.'},{status:502,headers});}finally{api.close();}
}
