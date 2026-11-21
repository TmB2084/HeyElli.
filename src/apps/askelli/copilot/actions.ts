import 'server-only';
import {appPermission} from '@/platform/app-access';
import {createHash,randomUUID} from 'node:crypto';
import {session,sameOrigin} from '@/platform/session';
import {platformDatabase,PlatformError} from '@/platform/store';
import {pdsApi} from '@/platform/pds/connection/api';
import {requireSimulatorWrites} from '@/platform/pds/connection';
import {createCalendarEvent,updateCalendarEvent,issueCalendarOrder} from '@/apps/planboard/kalender/actions-server';
import {checkCreate,checkChange,eventOptions,type CalendarEvent} from '@/apps/planboard/kalender/domain';
import {copilotStore} from './index';
import type {ActionIntent} from './protocol';
import type {actionContext} from './context';
type Context=Awaited<ReturnType<typeof actionContext>>;
type Prepared={kind:ActionIntent['kind'];body:Record<string,unknown>;target?:{id:string;fingerprint:string};source:string};
const fingerprint=(event:CalendarEvent)=>createHash('sha256').update(JSON.stringify(event)).digest('hex');
const when=(value:string)=>new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export async function prepareAction(userId:string,epoch:string,turnId:string,version:number,intent:ActionIntent,context:Context){
 const user=await session();if(!user||user.id!==userId||!((await appPermission(user,'/'))&&(await appPermission(user,'/planboard'))))throw new PlatformError('Keine Schreibberechtigung.',403);
 
 await requireSimulatorWrites();const api=await pdsApi();try{
  let proposal:Prepared,preview:{title:string;rows:[string,string][]};const source=JSON.stringify(api.source);
  if(intent.kind==='create'){
   const resource=context.resources.find(r=>r.id===intent.resourceId);if(!resource)throw new PlatformError('Mitarbeiter ist nicht eindeutig im angefragten Kontext enthalten. Bitte den Namen angeben.',409);
   const body=checkCreate({title:intent.title,start:intent.start,end:intent.end,resourceIds:[resource.id],type:'FREIER'});proposal={kind:'create',body,source};preview={title:'Freien Termin anlegen',rows:[['Titel',body.title],['Mitarbeiter',resource.name],['Beginn',when(body.start)],['Ende',when(body.end)]]};
  }else{
   if(!context.events.some(e=>e.id===intent.eventId))throw new PlatformError('Termin ist nicht eindeutig im angefragten Kontext enthalten. Bitte Titel und Datum angeben.',409);
   const event=await api.calendar.details(intent.eventId);if(!event)throw new PlatformError('Termin nicht gefunden.',404);
   const target={id:event.id,fingerprint:fingerprint(event)},names=await api.calendar.resources(event.start.slice(0,10),event.end.slice(0,10));
   if(intent.kind==='move'){
    if(event.fixed||event.allDay||event.continuation)throw new PlatformError('Fixierte, ganztägige oder aufgeteilte Termine bitte im PlanBoard bearbeiten.',409);
    const end=new Date(Date.parse(intent.start)+Date.parse(event.end)-Date.parse(event.start)).toISOString();const body=checkChange({id:event.id,start:intent.start,end,resourceIds:event.resourceIds,expected:{start:event.start,end:event.end,resourceIds:event.resourceIds,title:event.title,notes:event.notes??'',mainTechnicianId:event.mainTechnicianId,options:eventOptions(event)}});
    proposal={kind:'move',body,target,source};preview={title:'Termin verschieben',rows:[['Termin',event.title],['Mitarbeiter',names.filter(r=>event.resourceIds.includes(r.id)).map(r=>r.name).join(', ')],['Bisher',when(event.start)+' – '+when(event.end)],['Neu',when(body.start)+' – '+when(body.end)],['Dauer und Besetzung','Bleiben erhalten']]};
   }else{
    if(event.type!=='SERVICEAUFTRAGEBENE'||event.link?.type!=='SERVICEAUFTRAG'||!event.link.id||!event.mainTechnicianId||event.continuation?.serviceCopy)throw new PlatformError('Für diesen Termin ist keine einzelne mobile Ausgabe möglich.',409);
    const mainName=names.find(r=>r.id===event.mainTechnicianId)?.name;if(!mainName)throw new PlatformError('Haupttechniker nicht eindeutig auflösbar. Bitte Auftrag im PlanBoard prüfen.',409);
    proposal={kind:'mobile',body:{id:event.id,mainId:event.mainTechnicianId},target,source};preview={title:'Serviceauftrag mobil ausgeben',rows:[['Auftrag',event.link.number||event.link.name||event.title],['Termin',when(event.start)],['Haupttechniker',mainName]]};
   }
  }
  const id=randomUUID();await platformDatabase().query('INSERT INTO platform.assistant_actions(id,user_id,epoch,turn_id,config_version,proposal,preview) SELECT $1,$2,$3,$4,$5,$6::jsonb,$7::jsonb FROM platform.assistant_chats WHERE user_id=$2 AND epoch=$3 ON CONFLICT(user_id,epoch,turn_id) DO NOTHING',[id,userId,epoch,turnId,version,JSON.stringify(proposal),JSON.stringify(preview)]);
 }finally{api.close();}
}
export async function ownAction(userId:string,epoch:string,turnId:string){const row=(await platformDatabase().query('SELECT id,state,preview,result,expires_at FROM platform.assistant_actions WHERE user_id=$1 AND epoch=$2 AND turn_id=$3',[userId,epoch,turnId])).rows[0];if(!row)return null;return {...row,expired:new Date(row.expires_at).getTime()<=Date.now()};}
export async function confirmAction(request:Request,input:Record<string,unknown>){
 const user=await session();if(!user||!((await appPermission(user,'/'))&&(await appPermission(user,'/planboard'))))throw new PlatformError('Keine Schreibberechtigung.',user?403:401);if(!sameOrigin(request))throw new PlatformError('Unzulässiger Ursprung.',403);
 if(typeof input.id!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(input.id)||typeof input.confirm!=='boolean')throw new PlatformError('Gültige Vorschlagskennung und ausdrückliche Bestätigung erforderlich.');
 const pool=platformDatabase(),client=await pool.connect();let claimed=false;
 try{
  await client.query('BEGIN');
  const config=(await client.query("SELECT * FROM platform.copilot_settings WHERE id='central' FOR SHARE")).rows[0];
  const row=(await client.query('SELECT * FROM platform.assistant_actions WHERE id=$1 AND user_id=$2 FOR UPDATE',[input.id,user.id])).rows[0];if(!row)throw new PlatformError('Vorschlag nicht gefunden.',404);
  if(row.state!=='pending'){await client.query('COMMIT');return {state:row.state,result:row.result??(row.state==='executing'?'Ausführung läuft oder muss geprüft werden. Nicht erneut auslösen.':'Vorschlag bereits bearbeitet.')};}
  const chat=(await client.query('SELECT epoch FROM platform.assistant_chats WHERE user_id=$1 FOR UPDATE',[user.id])).rows[0];
  const currentUser=(await client.query('SELECT role,enabled FROM platform.users WHERE id=$1 FOR SHARE',[user.id])).rows[0];
  if(!currentUser?.enabled||!await appPermission(user,'/')||!await appPermission(user,'/planboard'))throw new PlatformError('Keine Schreibberechtigung.',403);
  if(chat?.epoch!==row.epoch||!config?.enabled||config.version!==row.config_version||new Date(row.expires_at).getTime()<=Date.now())throw new PlatformError('Vorschlag abgelaufen oder Chat/Freigabe geändert. Bitte neu anfordern.',409);
  if(!input.confirm){await client.query("UPDATE platform.assistant_actions SET state='cancelled',result='Nicht ausgeführt.' WHERE id=$1",[row.id]);await client.query('COMMIT');return {state:'cancelled',result:'Nicht ausgeführt.'};}
  // Durable claim before the specialist write: a process crash must never repeat mobile issuance.
  await client.query("UPDATE platform.assistant_actions SET state='executing',result='Ausführung läuft. Bei Unterbrechung Status im PlanBoard prüfen; nicht erneut auslösen.' WHERE id=$1",[row.id]);await client.query('COMMIT');claimed=true;
  await client.query('BEGIN');const lockedConfig=(await client.query("SELECT enabled,version FROM platform.copilot_settings WHERE id='central' FOR SHARE")).rows[0];const lockedChat=(await client.query('SELECT epoch FROM platform.assistant_chats WHERE user_id=$1 FOR UPDATE',[user.id])).rows[0];const lockedUser=(await client.query('SELECT enabled,role FROM platform.users WHERE id=$1 FOR SHARE',[user.id])).rows[0];if(lockedChat?.epoch!==row.epoch||!lockedConfig?.enabled||lockedConfig.version!==row.config_version||!lockedUser?.enabled||!await appPermission(user,'/')||!await appPermission(user,'/planboard'))throw new PlatformError('Chat, Freigabe oder Berechtigung geändert. Bitte neu anfordern.',409);
  const current=await copilotStore().active();if(current.settings.version!==row.config_version)throw new PlatformError('Copilot-Freigabe geändert.',409);
  const proposal=row.proposal as Prepared;await requireSimulatorWrites();const api=await pdsApi();try{if(JSON.stringify(api.source)!==proposal.source)throw new PlatformError('Datenquelle geändert. Bitte neuen Vorschlag anfordern.',409);if(proposal.target){const event=await api.calendar.details(proposal.target.id);if(fingerprint(event)!==proposal.target.fingerprint)throw new PlatformError('Der Termin wurde zwischenzeitlich geändert. Bitte neuen Vorschlag anfordern.',409);}}finally{api.close();}
  const headers=new Headers(request.headers);headers.set('Content-Type','application/json');headers.set('Idempotency-Key',row.id);const forwarded=new Request(request.url,{method:'POST',headers,body:JSON.stringify(proposal.body)});
  const response=await (proposal.kind==='create'?createCalendarEvent:proposal.kind==='move'?updateCalendarEvent:issueCalendarOrder)(forwarded);const result=await response.json();
  const state=response.ok?'done':response.status>=500?'uncertain':'failed';const message=response.ok?(proposal.kind==='mobile'?'Auftrag mobil ausgegeben.':proposal.kind==='move'?'Termin verschoben.':'Termin angelegt.'):(typeof result.error==='string'?result.error:'Planung benötigt eine Prüfung im PlanBoard. Es wurde keine zusätzliche Warnung automatisch bestätigt.');
  await client.query('UPDATE platform.assistant_actions SET state=$2,result=$3 WHERE id=$1',[row.id,state,message]);await client.query('INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,$2,$3,$4::jsonb)',[user.id,'copilot.action.'+state,row.id,JSON.stringify([{field:'action',label:row.preview.title,before:null,after:row.preview.rows}])]);await client.query('COMMIT');return {state,result:message};
 }catch(error){await client.query('ROLLBACK');if(claimed){await pool.query("UPDATE platform.assistant_actions SET state=$2,result=$3 WHERE id=$1 AND state='executing'",[input.id,error instanceof PlatformError&&error.status<500?'failed':'uncertain',error instanceof PlatformError?error.message:'Ergebnis nicht bestätigt. Bitte den Termin oder Ausgabestatus im PlanBoard prüfen; nicht erneut auslösen.']);}throw error;}finally{client.release();}
}
