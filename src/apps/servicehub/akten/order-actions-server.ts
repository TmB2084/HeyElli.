import {deliverServiceHistory} from '../../../platform/pds/simulator/history-outbox';
import 'server-only';
import {createHash} from 'node:crypto';
import {requireAppRead} from '@/platform/app-access/route-access';
import {appPermission} from '@/platform/app-access';
import {sameOrigin} from '@/platform/session';
import {pdsApi} from '@/platform/pds/connection/api';
import {requireSimulatorWrites} from '@/platform/pds/connection';
import {localStore} from '../../../platform/pds/simulator/order-store';
import {changeServiceOrder,orderActionVersion} from '../../../platform/pds/simulator/service-actions';
import {orderActions} from './order-actions-model';
import {CalendarError} from '../../planboard/kalender/domain';
import {platformDatabase} from '@/platform/store';
import {privateDraftInput} from '@/apps/planboard/entwuerfe/server';
export async function serviceOrderActions(request:Request){
 const user=await requireAppRead('/servicehub'),id=new URL(request.url).searchParams.get('id')??'';
 if(!id||id.length>200||/[\x00-\x1f]/.test(id))throw new CalendarError('Ungültiger Auftrag.');
 const canWrite=await appPermission(user,'/servicehub');
 if(request.method==='GET'){
  const api=await pdsApi();try{const order=await api.transport.request('POST','/service/details',{uuid:id}) as {uuid?:string;vorgangStatus?:{bezeichnung:string};rootEbene?:{ebenen:{hauptmonteurUUID?:string}[]}};
   if(order.uuid!==id||!order.vorgangStatus||!Array.isArray(order.rootEbene?.ebenen))throw new CalendarError('Auftragsstatus konnte nicht gelesen werden.',502);
   const catalog=await api.transport.request('GET','/service/liststatus') as {uuid:string;bezeichnung:string}[];
   if(!Array.isArray(catalog)||catalog.length>200||catalog.some(item=>typeof item.uuid!=='string'||typeof item.bezeichnung!=='string'))throw new CalendarError('Statusauswahl ist nicht verfügbar.',502);
   const ids=[...new Set(order.rootEbene.ebenen.map(item=>item.hauptmonteurUUID).filter((id):id is string=>!!id))];if(ids.length>30)throw new CalendarError('Zu viele Haupttechniker für eine gemeinsame Ausgabe.',413);
   const technicians=await Promise.all(ids.map(async uuid=>{const person=await api.transport.request('POST','/mitarbeiter/details',{uuid}) as {vorname?:string;nachname?:string};const name=[person.vorname,person.nachname].filter(Boolean).join(' ');if(!name)throw new CalendarError('Haupttechniker konnten nicht geprüft werden.',502);return name;}));
   return {technicians,expected:orderActionVersion(order),sourceRevision:createHash('sha256').update(JSON.stringify(api.source)).digest('hex'),status:order.vorgangStatus.bezeichnung,canWrite:canWrite&&api.source.mode==='simulator',actions:orderActions(order.vorgangStatus.bezeichnung,catalog,order.rootEbene.ebenen.length>0&&order.rootEbene.ebenen.every(item=>!!item.hauptmonteurUUID))};
  }finally{api.close();}
 }
 if(!canWrite)throw new CalendarError('Keine Schreibberechtigung im Service.',403);
 if(!sameOrigin(request))throw new CalendarError('Unzulässiger Ursprung.',403);
 try{await requireSimulatorWrites();}catch{throw new CalendarError('Der PDS-Schreibbetrieb ist noch nicht freigegeben.',409);}
 const body=await privateDraftInput(request);
 if(typeof body.expected!=='string'||!/^[a-f0-9]{64}$/.test(body.expected)||typeof body.operationId!=='string'||!/^[a-f0-9-]{36}$/.test(body.operationId)||typeof body.action!=='string'||body.action.length>200)throw new CalendarError('Aktionsvorschau fehlt.');
 const api=await pdsApi();try{if(api.source.mode!=='simulator')throw new CalendarError('Der PDS-Schreibbetrieb ist noch nicht freigegeben.',409);if(createHash('sha256').update(JSON.stringify(api.source)).digest('hex')!==body.sourceRevision)throw new CalendarError('Die Datenquelle wurde geändert. Bitte den Auftrag neu öffnen.',409);}finally{api.close();}
 const store=localStore();try{
  const result=changeServiceOrder(store,user.id,{id,expected:body.expected,operationId:body.operationId,action:body.action},user.displayName??user.id);
  let warning='';try{if(!await deliverServiceHistory(store,platformDatabase()))warning='Auftrag geändert; die Historie wird im Hintergrund ergänzt.';}catch{warning='Auftrag geändert; die Historie ist gesichert und wird automatisch nachgetragen.';}
  return {ok:true,status:result.after,warning};
 }finally{store.close();}
}
