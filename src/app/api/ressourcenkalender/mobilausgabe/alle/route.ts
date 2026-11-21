import {withRouteAccess} from '@/platform/app-access/route-access';
import {appPermission} from '@/platform/app-access';
import {requireSimulatorWrites} from "@/platform/pds/connection";
import {session,sameOrigin} from '@/platform/session';
import {pdsApi} from "@/platform/pds/connection/api";
import {calendarAuditStore} from '@/apps/planboard/kalender/server';
import type {CalendarEvent} from '@/apps/planboard/kalender/domain';
const headers={'Cache-Control':'no-store'};
async function scopedPOST(request:Request){
 try{await requireSimulatorWrites();}catch{return Response.json({error:"Echter PDS-Betrieb ist nur lesend freigegeben."},{status:409});}

 const user=await session();if(!user||!(await appPermission(user,'/planboard')))return Response.json({error:'Keine Schreibberechtigung.'},{status:user?403:401,headers});
 if(!sameOrigin(request))return Response.json({error:'Unzulässiger Ursprung.'},{status:403,headers});
 const reader=request.body?.getReader();if(!reader)return Response.json({error:'Auswahl fehlt.'},{status:400,headers});
 const chunks:Uint8Array[]=[];let size=0;while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>64000){await reader.cancel();return Response.json({error:'Auswahl zu groß.'},{status:413,headers});}chunks.push(item.value);}
 let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return Response.json({error:'Ungültige Auswahl.'},{status:400,headers});}
 if(!Array.isArray(body?.events)||!body.events.length||body.events.length>200||body.events.some((item:{id?:unknown;mainId?:unknown})=>!item||typeof item.id!=='string'||item.id.length>200||typeof item.mainId!=='string'||item.mainId.length>200))return Response.json({error:'Ungültige Terminauswahl.'},{status:400,headers});
 const api=await pdsApi(`calendar-mobile-bulk:${user.id}:${crypto.randomUUID()}`),groups=new Map<string,CalendarEvent[]>();let completed=0;
 try{
  const seen=new Set<string>();
  for(const item of body.events){if(seen.has(item.id))continue;seen.add(item.id);const event=await api.calendar.details(item.id);
   if(event.type!=='SERVICEAUFTRAGEBENE'||event.link?.type!=='SERVICEAUFTRAG'||!event.link.id||!event.mainTechnicianId||event.mainTechnicianId!==item.mainId||event.continuation?.serviceCopy||/storniert/i.test(event.orderStatus?.name??''))return Response.json({error:'Die Auswahl oder Haupttechniker haben sich geändert. Bitte neu auswählen.'},{status:409,headers});
   groups.set(event.link.id,[...(groups.get(event.link.id)??[]),event]);
  }
  for(const [id,events] of groups){let issued=false;try{
   await api.transport.request('POST','/service/mobilausgeben',{uuid:id,auftragspool:false});issued=true;completed++;
   for(const event of events)await calendarAuditStore().mobile(user.id,event.id,event.mainTechnicianId!);
  }catch{return Response.json({completed,error:issued?'Ausgabe erfolgt, aber Protokollierung unvollständig. Weitere Aufträge wurden nicht ausgegeben. Bitte nicht ungeprüft wiederholen.':'Ausgabe eines weiteren Auftrags konnte nicht bestätigt werden. Vorgang gestoppt; bitte Status in PDS prüfen.'},{headers});}}
  return Response.json({completed},{headers});
 }catch{return Response.json({error:'Auswahl konnte nicht geprüft werden. Keine Ausgabe gestartet.'},{status:502,headers});}finally{api.close();}
}

export const POST=withRouteAccess('/api/ressourcenkalender/mobilausgabe/alle','POST',scopedPOST);
