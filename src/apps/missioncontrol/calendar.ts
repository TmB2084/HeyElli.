import {createHash} from 'node:crypto';
import {readJsonLimited} from '../../platform/http-safety/limits.ts';
// Persönlicher Outlook-Kalender über Microsoft Graph (Anwendungsberechtigung Calendars.ReadWrite, per Zugriffsrichtlinie
// auf die Postfächer der Benutzer begrenzt). Gelesen werden nur Beginn, Ende, Betreff und Belegt-Status im Planungszeitraum;
// private Termine erscheinen ohne Betreff. Geschrieben werden ausschließlich eigene Fokusblöcke (Kategorie „HeyElli“).
export type CalendarEvent={id:string;subject:string;start:string;end:string;allDay:boolean;busy:boolean;own:boolean};
export type Block={day:string;time:string;minutes:number};
export class CalendarError extends Error{status:number;constructor(message:string,status=502){super(message);this.status=status;}}
export const CATEGORY='HeyElli';
const ZONE='Europe/Berlin';
type Env=NodeJS.ProcessEnv;
const text=(value:unknown)=>typeof value==='string'?value:'';
async function token(env:Env,transport:typeof fetch){
 const response=await transport(`https://login.microsoftonline.com/${env.M365_TENANT_ID}/oauth2/v2.0/token`,{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.M365_CLIENT_ID!,client_secret:env.M365_CLIENT_SECRET!,grant_type:'client_credentials',scope:'https://graph.microsoft.com/.default'})});
 if(!response.ok){if(response.body)await response.body.cancel();throw new CalendarError('Microsoft-365-Anmeldung für den Kalender abgelehnt.');}
 const value=await readJsonLimited(response,262144);if(typeof value.access_token!=='string'||!value.access_token)throw new CalendarError('Microsoft hat kein gültiges Zugriffstoken geliefert.');return value.access_token as string;
}
// Wandzeit in Berlin (YYYY-MM-DDTHH:MM) ↔ Graph-dateTime mit Zeitzone Europe/Berlin.
const wall=(day:string,time:string)=>`${day}T${time.slice(0,5)}:00`;
export function addMinutes(time:string,minutes:number){const [h,m]=time.split(':').map(Number),total=h*60+m+minutes;return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;}
function readEvent(row:Record<string,unknown>):CalendarEvent{
 const start=(row.start as {dateTime?:unknown})?.dateTime,end=(row.end as {dateTime?:unknown})?.dateTime,categories=Array.isArray(row.categories)?row.categories:[];
 return {id:text(row.id),subject:row.sensitivity==='private'?'Privater Termin':text(row.subject).slice(0,200)||'(ohne Betreff)',start:text(start).slice(0,16),end:text(end).slice(0,16),allDay:row.isAllDay===true,busy:row.showAs!=='free',own:categories.includes(CATEGORY)};
}
export function graphCalendar(upn:string,env:Env,transport:typeof fetch){
 const base=`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(upn)}`;
 async function call(method:'GET'|'POST'|'PATCH'|'DELETE',path:string,body?:unknown){
  const access=await token(env,transport);
  const response=await transport(base+path,{method,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${access}`,Prefer:`outlook.timezone="${ZONE}"`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  if(method==='DELETE'&&response.status===404){if(response.body)await response.body.cancel();return null;}
  if(!response.ok){if(response.body)await response.body.cancel();throw new CalendarError(response.status===403?'Kalenderzugriff verweigert: Anwendungsberechtigung Calendars.ReadWrite und Exchange-Zugriffsrichtlinie prüfen.':response.status===404?'Postfach nicht gefunden: Microsoft-Konto in der Benutzerverwaltung prüfen.':'Kalender derzeit nicht erreichbar.',response.status===404?404:502);}
  if(method==='DELETE'||method==='PATCH'||response.status===204){if(response.body)await response.body.cancel();return null;}
  return readJsonLimited(response,8*1024*1024);
 }
 return {
  async events(from:string,to:string):Promise<CalendarEvent[]>{
   const query=new URLSearchParams({startDateTime:`${from}T00:00:00`,endDateTime:`${to}T23:59:59`,$select:'id,subject,start,end,isAllDay,showAs,sensitivity,categories',$top:'250',$orderby:'start/dateTime'});
   const value=await call('GET','/calendarView?'+query) as {value?:unknown};
   return (Array.isArray(value?.value)?value.value as Record<string,unknown>[]:[]).map(readEvent).filter(item=>item.id&&item.start);
  },
  async save(eventId:string|null,key:string,title:string,block:Block):Promise<string>{
   const body={subject:`Fokus: ${title}`.slice(0,250),start:{dateTime:wall(block.day,block.time),timeZone:ZONE},end:{dateTime:wall(block.day,addMinutes(block.time,block.minutes)),timeZone:ZONE},showAs:'busy',categories:[CATEGORY],isReminderOn:false,body:{contentType:'text',content:'Fokusblock aus HeyElli MissionControl. Verschieben im Kalender wird übernommen.'}};
   if(eventId){await call('PATCH','/events/'+encodeURIComponent(eventId),body);return eventId;}
   // transactionId verhindert Doppelanlagen bei Wiederholung (Graph erkennt dieselbe Kennung).
   const created=await call('POST','/events',{...body,transactionId:createHash('sha256').update(key).digest('hex').slice(0,40)}) as {id?:unknown};
   if(typeof created?.id!=='string')throw new CalendarError('Kalendereintrag ohne Kennung.');return created.id;
  },
  async remove(eventId:string){await call('DELETE','/events/'+encodeURIComponent(eventId));},
 };
}
// Beispielkalender ohne Microsoft-365-Verbindung (lokal, fiktiv): feste Besprechungen, Fokusblöcke aus der Planung.
export function sampleEvents(days:string[]):CalendarEvent[]{
 return days.flatMap(day=>{const weekday=new Date(day+'T12:00:00Z').getUTCDay();return [
  ...(weekday===1||weekday===4?[{id:`sample:${day}:team`,subject:'Teambesprechung',start:`${day}T09:00`,end:`${day}T09:45`,allDay:false,busy:true,own:false}]:[]),
  {id:`sample:${day}:mittag`,subject:'Mittag',start:`${day}T12:00`,end:`${day}T12:45`,allDay:false,busy:true,own:false},
  ...(weekday===3?[{id:`sample:${day}:kunde`,subject:'Kundentermin (Telefon)',start:`${day}T14:00`,end:`${day}T14:30`,allDay:false,busy:true,own:false}]:[]),
 ];});
}
// Nächster freier Platz am Tag (08:00–16:30, 15-Minuten-Raster), belegte Termine und andere Blöcke ausgelassen.
export function freeSlot(day:string,minutes:number,busy:{start:string;end:string}[],earliest='08:00'):string|null{
 const ranges=busy.filter(item=>item.start.slice(0,10)===day).map(item=>[item.start.slice(11,16),item.end.slice(0,10)>day?'23:59':item.end.slice(11,16)] as const);
 for(let time=earliest;time<='16:30';time=addMinutes(time,15)){const end=addMinutes(time,minutes);if(end>'17:00')break;if(!ranges.some(([from,to])=>time<to&&end>from))return time;}
 return null;
}
