import {deliverServiceHistory} from '../../../platform/pds/simulator/history-outbox';
import {localStore} from '../../../platform/pds/simulator/order-store';
import {appPermission} from '@/platform/app-access';
import 'server-only';
import {session,sameOrigin} from '@/platform/session';
import {requireSimulatorWrites} from '@/platform/pds/connection';
import {planExistingLocal} from '@/platform/pds/simulator/planning-server';
import {platformDatabase} from '@/platform/store';
import {CalendarError} from '@/apps/planboard/kalender/domain';
export async function saveExistingPlanning(request:Request){
 const user=await session();if(!user||!(await appPermission(user,'/servicehub')))throw new CalendarError('Keine Planungsberechtigung.',user?403:401);if(!sameOrigin(request))throw new CalendarError('Unzulässiger Ursprung.',403);try{await requireSimulatorWrites();}catch{throw new CalendarError('Echte PDS-Schreibfunktionen sind noch nicht freigegeben.',409);}
 const reader=request.body?.getReader();if(!reader)throw new CalendarError('Planung fehlt.');let size=0;const chunks:Uint8Array[]=[];while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>16000){await reader.cancel();throw new CalendarError('Planung zu groß.',413);}chunks.push(item.value);}let input:unknown;try{input=JSON.parse(Buffer.concat(chunks).toString());}catch{throw new CalendarError('Ungültige Planung.');}
 planExistingLocal(input,{id:user.id,name:user.displayName??user.id});let warning='';const store=localStore();try{try{if(!await deliverServiceHistory(store,platformDatabase()))warning='Planung gespeichert; die Historie wird im Hintergrund ergänzt.';}catch{warning='Planung gespeichert; die Historie ist gesichert und wird automatisch nachgetragen.';}}finally{store.close();}return {ok:true,warning};
}
