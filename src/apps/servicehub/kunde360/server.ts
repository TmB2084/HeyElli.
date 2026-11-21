import 'server-only';
import {appPermission} from '../../../platform/app-access';
import {requireAppRead} from '../../../platform/app-access/route-access';
import {maildeskOverview} from '../../maildesk';
import {PdsProtocolError,PdsTasks,PdsVisits,openTaskStatuses} from '../../../platform/pds/api';
import {pdsApi} from '../../../platform/pds/connection/api';
import {platformDatabase,PlatformError} from '../../../platform/store';
import {serviceMatchContext} from '../akten';
import {customerNotesStore} from './notes-store';
// Kunde 360: alle Daten eines Kunden an einem Ort – PDS (Aufträge, Aufgaben, Termine vor Ort), MailDesk und Notizen.
// Nur lesend aus PDS und MailDesk; Notizen speichert heyelli. Jede Quelle erscheint nur mit dem passenden App-Recht.
export type TimelineEntry={id:string;kind:'mail'|'task'|'order'|'note';at:string;title:string;detail:string;href?:string;status?:string};
const closedOrder=/erledigt|abgeschlossen|storniert|abgerechnet/i;
const notes=()=>customerNotesStore(platformDatabase());
function sourceKey(api:Awaited<ReturnType<typeof pdsApi>>){return api.source.mode==='simulator'?'simulator':'pds:'+api.source.workspaceId;}
function failure(error:unknown):never{if(error instanceof PlatformError)throw error;if(error instanceof PdsProtocolError)throw new PlatformError(error.message,422);throw error;}
export async function customerOverview(customerId:unknown){
 const user=await requireAppRead('/servicehub');
 if(typeof customerId!=='string'||!customerId||customerId.length>200)throw new PlatformError('Ungültiger Kunde.',400);
 const api=await pdsApi();
 try{
  const source=sourceKey(api),context=await serviceMatchContext(),customer=context.customers.find(item=>item.id===customerId);
  if(!customer)throw new PlatformError('Kunde nicht gefunden.',404);
  const objects=context.objects.filter(item=>item.customerId===customerId),objectIds=new Set(objects.map(item=>item.id)),objectName=new Map(objects.map(item=>[item.id,item.name]));
  const orders=context.orders.filter(order=>order.customerId===customerId),openOrders=orders.filter(order=>!closedOrder.test(order.status));
  const timeline:TimelineEntry[]=[];const warnings:string[]=[];const now=Date.now();
  for(const order of orders)if(order.nextStart&&Date.parse(order.nextStart)<=now)timeline.push({id:'order:'+order.id,kind:'order',at:order.nextStart,title:`Auftrag ${order.number}${order.title?' · '+order.title:''}`,detail:[order.status,objectName.get(order.objectId)].filter(Boolean).join(' · '),href:'/servicehub?'+new URLSearchParams({ansicht:'files',akte:'order',id:order.id}),status:order.status});
  // Termine vor Ort: PDS liefert Termine nur je Mitarbeiter; gefiltert auf die Objekte und Einheiten dieses Kunden.
  let visits:Awaited<ReturnType<PdsVisits['upcoming']>>=[];
  try{visits=(await new PdsVisits(api.transport,api.calendar).upcoming(objectIds)).slice(0,6);}catch{warnings.push('Termine vor Ort sind derzeit nicht abrufbar.');}
  const employees=new Map<string,string>();
  if(visits.length){const ids=[...new Set(visits.flatMap(visit=>visit.employeeIds))];try{const rows=await api.transport.request('POST','/mitarbeiter/detailsbatch',{uuids:ids});if(Array.isArray(rows))for(const row of rows as Record<string,unknown>[])employees.set(String(row.uuid),[row.vorname,row.nachname].filter(Boolean).join(' '));}catch{/* Namen optional */}}
  let tasks:{id:string;subject:string;due:string|null;status:string;objectName:string}[]=[],overdue=0;
  if(await appPermission(user,'/taskhub','read')){
   try{const listed=await new PdsTasks(api.transport).list({status:openTaskStatuses});
    const own=listed.items.filter(task=>task.personId===customerId||(task.objectId&&objectIds.has(task.objectId)));
    tasks=own.map(task=>({id:task.id,subject:task.subject,due:task.due??null,status:task.status,objectName:task.objectId?objectName.get(task.objectId)??'':''})).sort((a,b)=>(a.due??'9').localeCompare(b.due??'9'));
    overdue=tasks.filter(task=>task.due&&Date.parse(task.due)<now).length;
    // In der Zeitleiste ab „gültig ab“ (Anlage); ohne dieses Datum nur in „Offene Aufgaben“.
    for(const task of own)if(task.validFrom&&Date.parse(task.validFrom)<=now)timeline.push({id:'task:'+task.id,kind:'task',at:task.validFrom,title:`Aufgabe: ${task.subject}`,detail:['PDS-Aufgabe',task.due?'fällig '+new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short'}).format(new Date(task.due)):''].filter(Boolean).join(' · '),href:'/taskhub?'+new URLSearchParams({alle:'1',id:'pds:'+task.id}),status:task.status});
   }catch{warnings.push('PDS-Aufgaben sind derzeit nicht abrufbar.');}
  }
  let mailsThisWeek=0;
  if(await appPermission(user,'/maildesk','read')){
   try{const mail=await maildeskOverview('inbox','');
    for(const message of mail?.messages??[])if(message.assignment?.customerId===customerId){
     if(now-Date.parse(message.receivedAt)<7*86400000)mailsThisWeek++;
     timeline.push({id:'mail:'+message.id,kind:'mail',at:message.receivedAt,title:`Mail: ${message.subject||'(ohne Betreff)'}`,detail:[message.from.name||message.from.address,message.assigneeName?message.assigneeName+' zuständig':'',message.state.orderNumber?'Auftrag '+message.state.orderNumber:''].filter(Boolean).join(' · '),href:'/maildesk?'+new URLSearchParams({id:message.id})});
    }
   }catch{warnings.push('MailDesk ist derzeit nicht erreichbar.');}
  }
  const customerNotes=await notes().list(source,customerId);
  for(const note of customerNotes)timeline.push({id:'note:'+note.id,kind:'note',at:note.createdAt,title:'Notiz: '+(note.body.length>120?note.body.slice(0,117)+'…':note.body),detail:note.authorName});
  timeline.sort((a,b)=>b.at.localeCompare(a.at));
  return {customer:{id:customer.id,name:customer.name,number:customer.number},
   kpis:{openOrders:openOrders.length,unplanned:openOrders.filter(order=>order.unplanned).length,openTasks:tasks.length,overdueTasks:overdue,mailsThisWeek,objects:objects.length},
   visits:visits.map(visit=>({...visit,objectName:objectName.get(visit.objectId)??'',employees:visit.employeeIds.map(id=>employees.get(id)||'Unbekannt')})),
   tasks:tasks.slice(0,8),notes:customerNotes.map(note=>({...note,own:note.authorId===user.id})),timeline:timeline.slice(0,60),warnings,
   canNote:await appPermission(user,'/servicehub'),canCreateTask:await appPermission(user,'/taskhub')&&api.source.mode==='simulator',loadedAt:new Date(now).toISOString()};
 }catch(error){failure(error);}finally{api.close();}
}
export async function customerNote(customerId:unknown,input:unknown){
 const user=await requireAppRead('/servicehub');
 if(!await appPermission(user,'/servicehub'))throw new PlatformError('Schreibrecht im Service erforderlich.',403);
 if(typeof customerId!=='string'||!customerId||customerId.length>200||!input||typeof input!=='object'||Array.isArray(input))throw new PlatformError('Ungültige Eingabe.',400);
 const body=input as {action?:unknown;text?:unknown;noteId?:unknown};
 const api=await pdsApi();let source:string;
 try{source=sourceKey(api);const context=await serviceMatchContext();if(!context.customers.some(item=>item.id===customerId))throw new PlatformError('Kunde nicht gefunden.',404);}catch(error){failure(error);}finally{api.close();}
 if(body.action==='remove'){await notes().remove(user.id,source,customerId,body.noteId);return {ok:true};}
 return {note:await notes().add(user.id,user.displayName??user.id,source,customerId,body.text)};
}
