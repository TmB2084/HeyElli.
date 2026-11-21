import {withRouteAccess} from '@/platform/app-access/route-access';
import {appPermission} from '@/platform/app-access';
import {requireSimulatorWrites} from "@/platform/pds/connection";
import {session,sameOrigin} from '@/platform/session';
import {pdsApi} from "@/platform/pds/connection/api";
import {calendarAuditStore} from '@/apps/planboard/kalender/server';
const headers={'Cache-Control':'no-store'};
async function scopedPOST(request:Request){
 try{await requireSimulatorWrites();}catch{return Response.json({error:"Echter PDS-Betrieb ist nur lesend freigegeben."},{status:409});}

 const user=await session();if(!user||!(await appPermission(user,'/planboard')))return Response.json({error:'Keine Schreibberechtigung.'},{status:user?403:401,headers});
 if(!sameOrigin(request))return Response.json({error:'Unzulässiger Ursprung.'},{status:403,headers});
 const text=await request.text();if(text.length>2000)return Response.json({error:'Anfrage zu groß.'},{status:413,headers});
 let body;try{body=JSON.parse(text);}catch{return Response.json({error:'Ungültige Anfrage.'},{status:400,headers});}
 if(!body||typeof body.id!=='string'||body.id.length>200||typeof body.status!=='string')return Response.json({error:'Terminstatus fehlt.'},{status:400,headers});
 const api=await pdsApi(`cancel:${user.id}:${crypto.randomUUID()}`);let saved=false;
 try{
  const event=await api.calendar.details(body.id);
  if(event.link?.type!=='SERVICEAUFTRAG'||!event.orderStatus||event.continuation?.serviceCopy)return Response.json({error:'Kein eindeutiger Serviceauftrag mit Status.'},{status:400,headers});
  if(event.orderStatus.id!==body.status)return Response.json({error:'Auftragsstatus wurde geändert. Bitte neu laden.'},{status:409,headers});
  if(/storniert/i.test(event.orderStatus.name))return Response.json({error:'Auftrag ist bereits storniert.'},{status:409,headers});
  const target=event.orderStatus.name.trim().toLocaleLowerCase('de')==='mobil abgeholt'?'Manuell storniert':'Storniert';
  const catalog=await api.calendar.statusCatalogs();
  if(!catalog.find(item=>item.type==='SERVICEAUFTRAG')?.statuses.some(item=>item.name===target))return Response.json({error:`Der PDS-Status „${target}“ ist nicht verfügbar.`},{status:400,headers});
  await api.transport.request('POST','/service/updatestatus',{uuid:event.link.id,statusBezeichnung:target});saved=true;
  await calendarAuditStore().status(user.id,event.id,event.orderStatus.name,target);
  return Response.json({ok:true,status:target},{headers});
 }catch{return Response.json({error:saved?'Status geändert, Historie konnte nicht gespeichert werden. Bitte neu laden.':'Statusänderung konnte nicht bestätigt werden. Bitte den Auftragsstatus prüfen.'},{status:502,headers});}finally{api.close();}
}

export const POST=withRouteAccess('/api/ressourcenkalender/stornieren','POST',scopedPOST);
