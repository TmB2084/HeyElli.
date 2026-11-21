import 'server-only';
import {appPermission} from '../../platform/app-access';
import {requireAppRead} from '../../platform/app-access/route-access';
import {PdsProtocolError,PdsTasks} from '../../platform/pds/api';
import {pdsSource,requireSimulatorWrites} from '../../platform/pds/connection';
import {pdsActorForSession,pdsApi} from '../../platform/pds/connection/api';
import {platformDatabase,PlatformError} from '../../platform/store';
import {tasksOverview} from '../taskhub';
import {microsoft365Environment} from '../../platform/mail/configuration';
import {externalWritesBlocked,guardExternalWrites} from '../../platform/server-operation';
import {addMinutes,CalendarError,freeSlot,graphCalendar,sampleEvents,type CalendarEvent} from './calendar';
import {missionStore,type PlanEntry} from './store';
import {goalsStore} from './goals-store';
import {missionDone} from './goals';
// MissionControl: Tag und Woche planen, fokussiert arbeiten. Aufgaben kommen aus der App Aufgaben (PDS, MailDesk, Service);
// heyelli speichert nur persönliche Planung, Fokuszeiten und Notizen. Erledigen schreibt nur PDS-Aufgaben (Simulator).
const store=()=>missionStore(platformDatabase());
async function sourceKey(){const source=await pdsSource();return source.mode==='simulator'?'simulator':'pds:'+source.workspaceId;}
const berlinDay=(date:Date)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(date);
// Am Wochenende beginnt die Planung mit der kommenden Woche.
function weekDays(today:string,weeks=2){const base=new Date(today+'T12:00:00Z'),weekday=(base.getUTCDay()+6)%7,monday=new Date(base.getTime()+(weekday>=5?7-weekday:-weekday)*86400000);return Array.from({length:7*weeks},(_,index)=>new Date(monday.getTime()+index*86400000).toISOString().slice(0,10)).filter(day=>{const d=new Date(day+'T12:00:00Z').getUTCDay();return d!==0&&d!==6;});}
async function reader(){
 const user=await requireAppRead('/missioncontrol');
 if(!await appPermission(user,'/taskhub','read'))throw new PlatformError('MissionControl benötigt Lesezugriff auf die App Aufgaben.',403);
 return user;
}
async function writer(){const user=await reader();if(!await appPermission(user,'/missioncontrol'))throw new PlatformError('Schreibrecht für MissionControl erforderlich.',403);return user;}
export async function missionOverview(fresh=false){
 const user=await reader(),source=await sourceKey(),tasks=await tasksOverview(fresh),today=berlinDay(new Date()),days=weekDays(today);
 const calendar=await calendarFor(user.id);let calendarError=calendar.reason,events:CalendarEvent[]=[];
 try{events=await eventsFor(calendar,days[0]<today?days[0]:today,days.at(-1)!,days.includes(today)?days:[today,...days]);}catch(error){calendarError=error instanceof CalendarError?error.message:'Kalender derzeit nicht erreichbar.';}
 let plans=await store().plans(user.id,source);
 if(await pullBlocks(user.id,source,calendar,plans,events))plans=await store().plans(user.id,source);
 const byKey=new Map(plans.map(item=>[item.itemKey,item]));
 const me=tasks?.me??null,mine=(tasks?.items??[]).filter(item=>(me&&item.assigneeIds.includes(me))||byKey.has(item.key));
 const seconds=await store().seconds(user.id,source,days[0],days.at(-1)!),todaySeconds=new Map<string,number>();
 for(const row of seconds)if(row.day===today)todaySeconds.set(row.itemKey,(todaySeconds.get(row.itemKey)??0)+row.seconds);
 const notes=await store().noteCounts(source,mine.map(item=>item.key));
 const goalStore=goalsStore(platformDatabase()),weekStart=(()=>{const base=new Date(today+'T12:00:00Z'),offset=(base.getUTCDay()+6)%7;return new Date(base.getTime()-offset*86400000).toISOString().slice(0,10);})();
 const [goalLinks,goalRows,goalFocus,doneToday]=await Promise.all([goalStore.links(source),goalStore.list(source),goalStore.focusByGoal(source,weekStart,today),goalStore.doneBetween(user.id,source,today,today)]);
 const goalList=goalRows.map(goal=>({id:goal.id,title:goal.title,focusWeek:goalFocus.get(goal.id)??0}));
 return {today,days,items:mine.map(item=>({...item,plan:byKey.get(item.key)??null,notes:notes.get(item.key)??0,focusToday:todaySeconds.get(item.key)??0,goalId:goalLinks.get(item.key)??null})),goals:goalList,doneToday:doneToday.length,
  focus:await store().running(user.id),focusByDay:days.map(day=>({day,seconds:seconds.filter(row=>row.day===day).reduce((sum,row)=>sum+row.seconds,0)})),
  calendar:{mode:calendar.mode,reason:calendarError,events:events.filter(event=>!event.own)},people:tasks?.people??[],me,canWrite:await appPermission(user,'/missioncontrol'),canComplete:!!tasks?.canWritePds&&await appPermission(user,'/taskhub'),mailError:tasks?.mailError??'',loadedAt:new Date().toISOString()};
}
export async function missionPlan(input:unknown){
 const user=await writer();if(!input||typeof input!=='object'||Array.isArray(input))throw new PlatformError('Ungültige Eingabe.',400);
 const source=await sourceKey(),entry=await store().plan(user.id,source,input as Parameters<ReturnType<typeof missionStore>['plan']>[2]);
 if(entry){const today=berlinDay(new Date());await syncBlock(user.id,source,await calendarFor(user.id),entry,weekDays(today));}
 return {plan:entry?(await store().plans(user.id,source)).find(item=>item.itemKey===entry.itemKey)??null:null};
}
export async function missionFocus(input:unknown){
 const user=await writer();if(!input||typeof input!=='object'||Array.isArray(input))throw new PlatformError('Ungültige Eingabe.',400);
 const body=input as {action?:unknown;itemKey?:unknown;title?:unknown;planned?:unknown;minutes?:unknown};
 switch(body.action){
  case 'start':return {focus:await store().start(user.id,await sourceKey(),body.itemKey,body.title,body.planned)};
  case 'stop':return {stopped:await store().stop(user.id),focus:null};
  case 'extend':{const minutes=Number(body.minutes);if(![5,10,15].includes(minutes))throw new PlatformError('Ungültige Verlängerung.',400);return {focus:await store().extend(user.id,minutes)};}
  default:throw new PlatformError('Unbekannte Aktion.',400);
 }
}
export async function missionNotes(itemKey:unknown){
 await reader();if(typeof itemKey!=='string'||itemKey.length>460)throw new PlatformError('Ungültige Aufgabe.',400);
 return {notes:await store().notes(await sourceKey(),itemKey)};
}
export async function missionNoteChange(input:unknown){
 const user=await writer();if(!input||typeof input!=='object'||Array.isArray(input))throw new PlatformError('Ungültige Eingabe.',400);
 const body=input as {action?:unknown;itemKey?:unknown;text?:unknown;noteId?:unknown},source=await sourceKey();
 if(body.action==='remove'){await store().removeNote(user.id,source,body.noteId);return {ok:true};}
 return {note:await store().addNote(user.id,user.displayName??user.id,source,body.itemKey,body.text)};
}
// PDS-Aufgabe erledigen; auf Wunsch Notizen an die PDS-Beschreibung anhängen. Laufender Fokus auf dieser Aufgabe endet.
export async function missionComplete(input:unknown){
 const user=await writer();if(!input||typeof input!=='object'||Array.isArray(input))throw new PlatformError('Ungültige Eingabe.',400);
 const body=input as {itemKey?:unknown;appendNotes?:unknown;requestId?:unknown};
 if(typeof body.itemKey!=='string'||!body.itemKey.startsWith('pds:'))throw new PlatformError('Nur PDS-Aufgaben lassen sich hier erledigen; Mails und Aufträge in MailDesk bzw. im Service bearbeiten.',400);
 if(typeof body.requestId!=='string'||!/^[A-Za-z0-9-]{8,80}$/.test(body.requestId))throw new PlatformError('Anfragekennung fehlt.',400);
 if(!await appPermission(user,'/taskhub'))throw new PlatformError('Schreibrecht für Aufgaben erforderlich.',403);
 await requireSimulatorWrites();const actor=await pdsActorForSession(),taskId=body.itemKey.slice(4),source=await sourceKey();
 const api=await pdsApi(`${actor.id}:mission-done:${body.requestId}`);
 try{
  const tasks=new PdsTasks(api.transport),task=await tasks.details(taskId);let description:string|undefined;
  // Ein einziger Änderungsaufruf (Status und ggf. Beschreibung), damit Wiederholungen eindeutig bleiben.
  if(body.appendNotes===true){const notes=await store().notes(source,body.itemKey);if(notes.length){
   const stamp=(value:string)=>new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'}).format(new Date(value));
   const appended=`${task.description?task.description+'\n\n':''}Notizen aus HeyElli:\n${notes.map(note=>`- ${stamp(note.createdAt)} ${note.authorName}: ${note.body}`).join('\n')}`;
   if(appended.length>4000)throw new PlatformError('Beschreibung und Notizen sind zusammen zu lang für PDS (höchstens 4000 Zeichen).',400);
   description=appended;
  }}
  const done=await tasks.update(taskId,{status:'ERLEDIGT',...(description!==undefined?{description}:{})});
  const running=await store().running(user.id);if(running?.itemKey===body.itemKey)await store().stop(user.id);
  await missionDone(user.id,body.itemKey,task.subject);
  return {task:done};
 }catch(error){if(error instanceof PdsProtocolError)throw new PlatformError(error.message,422);throw error;}finally{api.close();}
}

// ---- Outlook-Kalender (Microsoft Graph) ----
// Modus: off (persönlich ausgeschaltet), sample (keine Microsoft-365-Verbindung: Beispielkalender, nichts wird geschrieben),
// graph (persönlicher Kalender des zugeordneten Microsoft-Kontos), error (Voraussetzung fehlt). Schreibzugriffe laufen
// über guardExternalWrites: in Instanzen mit HEYELLI_EXTERN_SCHREIBEN=aus (Testinstanz) wird nichts in Microsoft 365 geschrieben.
type Calendar={mode:'off'|'sample'|'graph'|'error';reason:string;client:ReturnType<typeof graphCalendar>|null};
async function calendarFor(userId:string):Promise<Calendar>{
 if(!(await store().settings(userId)).calendarSync)return {mode:'off',reason:'',client:null};
 const configId=(await platformDatabase().query("SELECT config_id FROM platform.mail_settings WHERE id='central'")).rows[0]?.config_id??null,env=microsoft365Environment(configId);
 if(!env.M365_TENANT_ID||!env.M365_CLIENT_ID||!env.M365_CLIENT_SECRET)return {mode:'sample',reason:'Keine Microsoft-365-Verbindung – Beispielkalender, es wird nichts in Outlook eingetragen.',client:null};
 const upn=(await platformDatabase().query('SELECT microsoft_upn FROM platform.users WHERE id=$1',[userId])).rows[0]?.microsoft_upn as string|undefined;
 if(!upn)return {mode:'error',reason:'Ihrem Konto ist kein Microsoft-Konto zugeordnet. Bitte in der Benutzerverwaltung hinterlegen lassen.',client:null};
 if(externalWritesBlocked())return {mode:'error',reason:'In dieser Instanz sind Schreibzugriffe auf Microsoft 365 abgeschaltet; Fokusblöcke werden nicht eingetragen.',client:null};
 return {mode:'graph',reason:'',client:graphCalendar(upn,env,guardExternalWrites(fetch))};
}
async function eventsFor(calendar:Calendar,from:string,to:string,days:string[]):Promise<CalendarEvent[]>{
 if(calendar.mode==='sample')return sampleEvents(days.filter(day=>day>=from&&day<=to));
 if(calendar.mode==='graph'&&calendar.client)return calendar.client.events(from,to);
 return [];
}
function earliestFor(day:string){
 const now=new Date(),today=berlinDay(now);if(day!==today)return '08:00';
 const [h,m]=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit',hour12:false}).format(now).split(':').map(Number),minutes=Math.ceil((h*60+m)/15)*15;
 const value=`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;return value<'08:00'?'08:00':value;
}
// Fokusblock zu einem Plan anlegen, verschieben oder entfernen. Fehler werden am Plan vermerkt, die Planung bleibt gültig.
async function syncBlock(userId:string,source:string,calendar:Calendar,entry:PlanEntry,days:string[]){
 if(calendar.mode==='off'||calendar.mode==='error')return;
 try{
  if(!entry.day){if(entry.eventId&&calendar.mode==='graph')await calendar.client!.remove(entry.eventId);if(entry.eventId||entry.time)await store().calendar(userId,source,entry.itemKey,{eventId:null,time:null,error:null});return;}
  if(entry.time&&entry.eventId&&!entry.calendarError)return; // unverändert eingetragen
  const minutes=entry.estimate??30;let time=entry.time;
  if(!time){
   const others=(await store().plans(userId,source)).filter(item=>item.day===entry.day&&item.time&&item.itemKey!==entry.itemKey).map(item=>({start:`${item.day}T${item.time}`,end:`${item.day}T${addMinutes(item.time!,item.estimate??30)}`}));
   const busy=(await eventsFor(calendar,entry.day,entry.day,days.includes(entry.day)?days:[entry.day])).filter(event=>event.busy&&!event.own&&!event.allDay);
   time=freeSlot(entry.day,minutes,[...busy,...others],earliestFor(entry.day));
   if(!time){await store().calendar(userId,source,entry.itemKey,{error:'Kein freier Platz zwischen 8 und 17 Uhr.'});return;}
  }
  const eventId=calendar.mode==='graph'?await calendar.client!.save(entry.eventId,`${userId}|${source}|${entry.itemKey}`,entry.title,{day:entry.day,time,minutes}):entry.eventId??'sample:'+entry.itemKey;
  await store().calendar(userId,source,entry.itemKey,{time,eventId,error:null});
 }catch(error){await store().calendar(userId,source,entry.itemKey,{error:error instanceof CalendarError?error.message:'Kalender derzeit nicht erreichbar.'});}
}
// In Outlook verschobene oder gelöschte Fokusblöcke übernehmen (Outlook ist für Uhrzeit und Tag maßgeblich).
async function pullBlocks(userId:string,source:string,calendar:Calendar,plans:PlanEntry[],events:CalendarEvent[]){
 if(calendar.mode!=='graph')return false;let changed=false;const byId=new Map(events.map(event=>[event.id,event]));
 for(const plan of plans)if(plan.eventId&&plan.day){const event=byId.get(plan.eventId);
  if(!event){await store().calendar(userId,source,plan.itemKey,{eventId:null,time:null,error:'Fokusblock wurde in Outlook gelöscht.'});changed=true;continue;}
  const day=event.start.slice(0,10),time=event.start.slice(11,16);
  if(day!==plan.day||time!==plan.time){await store().calendar(userId,source,plan.itemKey,{day,time,error:null});changed=true;}}
 return changed;
}
export async function missionCalendarSetting(input:unknown){
 const user=await writer();if(!input||typeof input!=='object'||typeof (input as {calendarSync?:unknown}).calendarSync!=='boolean')throw new PlatformError('Ungültige Eingabe.',400);
 const enable=(input as {calendarSync:boolean}).calendarSync,source=await sourceKey(),today=berlinDay(new Date()),days=weekDays(today);
 if(!enable){const calendar=await calendarFor(user.id);for(const plan of await store().plans(user.id,source))if(plan.eventId){if(calendar.mode==='graph'&&plan.day&&plan.day>=today){try{await calendar.client!.remove(plan.eventId);}catch{/* Eintrag bleibt in Outlook; Hinweis über Fehlerzustand */}}await store().calendar(user.id,source,plan.itemKey,{eventId:null,error:null});}}
 const result=await store().setCalendarSync(user.id,enable);
 if(enable){const calendar=await calendarFor(user.id);for(const plan of await store().plans(user.id,source))if(plan.day&&plan.day>=today)await syncBlock(user.id,source,calendar,plan,days);}
 return result;
}
