import 'server-only';
import {appPermission} from '../../platform/app-access';
import {requireAppRead} from '../../platform/app-access/route-access';
import {microsoft365Environment} from '../../platform/mail/configuration';
import {platformDatabase,PlatformError} from '../../platform/store';
import {serviceMatchContext,type ServiceMatchContext} from '../servicehub/akten';
import {graphMailbox,MailboxError,testGraphMailbox} from './graph-mailbox';
import {maildeskSettings,validMailbox} from './settings';
import {categorize,matchMail,urgent} from './matching';
import type {MailFolder,MailMatch,MailMessage,MailState,MailSummary,MatchContext} from './model';
import {simulatorMailbox,simulatorMessages} from './simulator-mailbox';
import {emptyState,maildeskStore,type MailAction} from './store';
// MailDesk-Server: liest das geteilte Postfach, ordnet zu und speichert nur Entscheidungen.
const store=()=>maildeskStore(platformDatabase());
const listCache=new Map<string,{at:number;value:Promise<MailMessage[]>}>();
async function mailbox(){
 // Quelle kommt aus Einstellungen → Microsoft Graph → MailDesk-Postfach (nicht mehr aus Umgebungsvariablen).
 const settings=await maildeskSettings(platformDatabase()).read();
 if(settings.source==='graph'&&settings.mailbox){
  const configId=(await platformDatabase().query("SELECT config_id FROM platform.mail_settings WHERE id='central'")).rows[0]?.config_id??null,graph=graphMailbox(settings.mailbox,microsoft365Environment(configId));
  return {key:'graph:'+settings.mailbox,address:settings.mailbox,mode:'graph' as const,list:graph.list,read:graph.read};
 }
 return {key:'simulator',address:simulatorMailbox,mode:'simulator' as const,list:async()=>simulatorMessages(),read:async(id:string)=>{const found=simulatorMessages().find(item=>item.id===id);if(!found)throw new MailboxError('Nachricht nicht gefunden.',404);return found;}};
}
// Einstellungen (nur Administratoren): lesen, speichern, Verbindung prüfen.
export async function maildeskSettingsRead(){return maildeskSettings(platformDatabase()).read();}
export async function maildeskSettingsSave(actor:string,input:unknown){if(!input||typeof input!=='object'||Array.isArray(input))throw new PlatformError('Angaben fehlen.');const result=await maildeskSettings(platformDatabase()).save(actor,input as Record<string,unknown>);listCache.clear();return result;}
export async function maildeskSettingsCheck(actor:string,mailbox:unknown){
 const address=typeof mailbox==='string'?mailbox.trim().toLowerCase():'';if(!validMailbox(address))throw new PlatformError('Bitte eine gültige Postfachadresse eingeben.');
 const configId=(await platformDatabase().query("SELECT config_id FROM platform.mail_settings WHERE id='central'")).rows[0]?.config_id??null;
 const result=await testGraphMailbox(address,microsoft365Environment(configId));
 return {...result,settings:await maildeskSettings(platformDatabase()).recordCheck(actor,address,result.ok)};
}
async function messages(box:Awaited<ReturnType<typeof mailbox>>,fresh=false){
 const cached=listCache.get(box.key);if(cached&&!fresh&&Date.now()-cached.at<45000)return cached.value;
 const value=box.list();listCache.set(box.key,{at:Date.now(),value});value.catch(()=>{if(listCache.get(box.key)?.value===value)listCache.delete(box.key);});return value;
}
async function setup(fresh=false){
 const box=await mailbox(),context=await serviceMatchContext(fresh),source=box.key+'|'+context.source;
 const senders=await store().senders(source);
 return {box,context,source,match:{...context,senders} satisfies MatchContext};
}
function effective(message:MailMessage,state:MailState,context:MatchContext){
 const customers=new Map(context.customers.map(item=>[item.id,item]));
 const auto=matchMail({subject:message.subject,body:message.body||message.preview,from:message.from.address},context);
 let assignment:MailMatch|null=null,suggestion:MailMatch|null=null;
 if(state.decision==='manual'||state.decision==='confirmed'){if(state.customerId&&customers.has(state.customerId))assignment={kind:state.decision==='manual'?'manual':auto.assignment?.kind??auto.suggestion?.kind??'manual',customerId:state.customerId,objectId:state.objectId??undefined,orderNumber:state.orderNumber??undefined,score:100,reason:state.decision==='manual'?'Manuell zugeordnet':'Bestätigt'};}
 else if(state.decision==='auto'){assignment=auto.assignment;suggestion=auto.assignment?null:auto.suggestion;}
 return {assignment,suggestion,customerName:assignment?customers.get(assignment.customerId)?.name??null:null};
}
function summarize(message:MailMessage,state:MailState,context:MatchContext,people:Map<string,string>):MailSummary{
 const {assignment,suggestion,customerName}=effective(message,state,context);
 return {id:message.id,receivedAt:message.receivedAt,from:message.from,subject:message.subject,preview:message.preview,unread:message.unread,attachmentCount:message.attachments.length,assignment,suggestion,customerName,
  category:categorize({subject:message.subject,body:message.body||message.preview,from:message.from.address,attachments:message.attachments.length}),state,assigneeName:state.assigneeId?people.get(state.assigneeId)??null:null};
}
export function inFolder(item:MailSummary,folder:MailFolder,user:string){
 const s=item.state;switch(folder){
  case 'inbox':return !s.archived;case 'archive':return s.archived;case 'flagged':return s.flagged;
  case 'unassigned':return !s.archived&&!item.assignment&&!item.suggestion;case 'suggested':return !s.archived&&!item.assignment&&!!item.suggestion;
  case 'assigned':return !s.archived&&!!item.assignment&&!s.orderNumber;case 'order':return !!s.orderNumber;
  case 'mine':return !s.archived&&s.assigneeId===user;case 'attachments':return !s.archived&&item.attachmentCount>0;default:return false;}
}
const folders:MailFolder[]=['inbox','unassigned','suggested','assigned','order','archive','mine','flagged','attachments'];
function failure(error:unknown):never{if(error instanceof PlatformError)throw error;if(error instanceof MailboxError)throw new PlatformError(error.message,error.status);throw error;}
export async function maildeskOverview(folder:string,query:string,fresh=false){
 const user=await requireAppRead('/maildesk');
 try{
  const {box,context,source,match}=await setup(fresh),list=await messages(box,fresh),states=await store().states(source,list.map(item=>item.id)),people=new Map((await store().people()).map(item=>[item.id,item.name]));
  const all=list.map(message=>summarize(message,states.get(message.id)??emptyState,match,people)).sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt));
  const counts=Object.fromEntries(folders.map(name=>[name,all.filter(item=>inFolder(item,name,user.id)&&(name==='inbox'||name==='archive'?true:true)).length])) as Record<MailFolder,number>;
  const unread=all.filter(item=>item.unread&&!item.state.archived).length,terms=query.toLocaleLowerCase('de').split(/\s+/).filter(Boolean).slice(0,8);
  const chosen=(folders as string[]).includes(folder)?folder as MailFolder:'inbox';
  const visible=chosen==='inbox'&&!terms.length?all.filter(item=>inFolder(item,'inbox',user.id)):all.filter(item=>(terms.length?true:inFolder(item,chosen,user.id))&&terms.every(term=>[item.from.name,item.from.address,item.subject,item.preview,item.customerName??'',item.assignment?.evidence??'',item.state.orderNumber??''].join(' ').toLocaleLowerCase('de').includes(term)));
  const byCustomer=new Map<string,number>();for(const item of all)if(item.assignment&&!item.state.archived)byCustomer.set(item.assignment.customerId,(byCustomer.get(item.assignment.customerId)??0)+1);
  const customers=[...byCustomer].map(([id,count])=>({id,name:context.customers.find(item=>item.id===id)?.name??id,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'de'));
  const sent=chosen==='sent'?(await store().sent(source)).map(row=>({...row,createdAt:row.createdAt.toISOString()})):[];
  return {mailbox:{address:box.address,mode:box.mode},folder:chosen,counts:{...counts,sent:sent.length},unread,messages:chosen==='sent'?[]:visible,sent,customers,
   people:[...people].map(([id,name])=>({id,name})),me:user.id,canWrite:await appPermission(user,'/maildesk'),canCreateOrder:await appPermission(user,'/casedesk')&&context.source==='simulator',loadedAt:new Date().toISOString()};
 }catch(error){failure(error);}
}
function customerContext(context:ServiceMatchContext,customerId:string){
 return {orders:context.orders.filter(order=>order.customerId===customerId).slice(0,20),objects:context.objects.filter(item=>item.customerId===customerId).slice(0,50)};
}
export async function maildeskMessage(id:string){
 const user=await requireAppRead('/maildesk');
 if(typeof id!=='string'||!id||id.length>400)throw new PlatformError('Ungültige Nachricht.',400);
 try{
  const {box,context,source,match}=await setup(),message=await box.read(id),state=(await store().states(source,[id])).get(id)??emptyState,people=new Map((await store().people()).map(item=>[item.id,item.name]));
  const summary=summarize(message,state,match,people),customerId=summary.assignment?.customerId??summary.suggestion?.customerId,list=await messages(box);
  const allStates=customerId?await store().states(source,list.map(item=>item.id)):new Map<string,MailState>();
  const related=customerId?list.filter(item=>item.id!==id).map(item=>summarize(item,allStates.get(item.id)??emptyState,match,people)).filter(item=>item.assignment?.customerId===customerId).slice(0,10):[];
  const replies=(await store().sent(source)).filter(row=>row.messageId===id).map(row=>({...row,createdAt:row.createdAt.toISOString()}));
  return {message:{...message,body:message.body||message.preview},summary,customer:customerId?{...context.customers.find(item=>item.id===customerId),...customerContext(context,customerId)}:null,related,replies,
   customers:context.customers.map(item=>({id:item.id,name:item.name,number:item.number})),objects:context.objects,canWrite:await appPermission(user,'/maildesk'),canCreateOrder:await appPermission(user,'/casedesk')&&context.source==='simulator',canCreateTask:await appPermission(user,'/taskhub')&&context.source==='simulator'};
 }catch(error){failure(error);}
}
export async function maildeskAction(id:unknown,input:unknown){
 const user=await requireAppRead('/maildesk');
 if(!await appPermission(user,'/maildesk'))throw new PlatformError('Schreibrecht für MailDesk erforderlich.',403);
 if(typeof id!=='string'||!id||id.length>400||!input||typeof input!=='object'||Array.isArray(input))throw new PlatformError('Ungültige Auswahl.',400);
 const action=input as MailAction;
 try{
  const {box,context,source}=await setup(action.action==='order'),message=await box.read(id);
  if(action.action==='assign'||action.action==='confirm'){
   if(!context.customers.some(item=>item.id===action.customerId))throw new PlatformError('Kunde nicht gefunden.',404);
   if(action.objectId!=null&&!context.objects.some(item=>item.id===action.objectId&&item.customerId===action.customerId))throw new PlatformError('Objekt gehört nicht zu diesem Kunden.',400);
  }
  if(action.action==='order'){
   // Nur ein tatsächlich vorhandener Auftrag wird verknüpft; Kunde und Objekt stammen aus PDS, nicht aus der Eingabe.
   const order=context.orders.find(item=>item.number===action.orderNumber);if(!order)throw new PlatformError('Auftrag in PDS nicht gefunden.',404);
   const current=(await store().states(source,[id])).get(id)??emptyState;
   return await store().change(user.id,source,id,{action:'order',version:current.version,orderNumber:order.number,customerId:order.customerId,objectId:order.objectId||null},message.from.address);
  }
  return await store().change(user.id,source,id,action,message.from.address);
 }catch(error){failure(error);}
}
export async function maildeskReply(id:unknown,input:unknown){
 const user=await requireAppRead('/maildesk');
 if(!await appPermission(user,'/maildesk'))throw new PlatformError('Schreibrecht für MailDesk erforderlich.',403);
 if(typeof id!=='string'||!id||id.length>400||!input||typeof input!=='object'||Array.isArray(input))throw new PlatformError('Ungültige Antwort.',400);
 try{const {box,source}=await setup();await box.read(id);return await store().reply(user.id,source,id,input as {requestId:unknown;recipient:unknown;subject:unknown;body:unknown});}catch(error){failure(error);}
}
// Vorlage für den CaseDesk: Objekt/Einheit, Beschreibung und Kontakt aus der zugeordneten Mail.
export async function maildeskOrderTemplate(id:string){
 const user=await requireAppRead('/maildesk');
 if(!await appPermission(user,'/casedesk'))throw new PlatformError('Schreibrecht im CaseDesk erforderlich.',403);
 if(typeof id!=='string'||!id||id.length>400)throw new PlatformError('Ungültige Nachricht.',400);
 try{
  const {box,context,source,match}=await setup(),message=await box.read(id),state=(await store().states(source,[id])).get(id)??emptyState;
  const {assignment,suggestion}=effective(message,state,match),chosen=assignment??suggestion;
  const objects=new Map(context.objects.map(item=>[item.id,item]));let object=chosen?.objectId?objects.get(chosen.objectId):undefined,unit:typeof object;
  if(object?.parentId&&objects.has(object.parentId)){unit=object;object=objects.get(object.parentId);}
  if(!object&&chosen){const own=context.objects.filter(item=>item.customerId===chosen.customerId&&!item.parentId);if(own.length===1)object=own[0];}
  const body=(message.body||message.preview).replace(/\r/g,'').trim();
  return {messageId:message.id,subject:message.subject,from:message.from,receivedAt:message.receivedAt,customerId:chosen?.customerId??null,customerName:chosen?context.customers.find(item=>item.id===chosen.customerId)?.name??null:null,
   objectId:object?.id??null,objectName:object?.name??null,unitId:unit?.id??null,unitName:unit?.name??null,urgent:urgent(message.subject+' '+body),
   problem:(message.subject+'\n\n'+body).slice(0,2000),document:{name:('Mail '+message.subject).replace(/[^\p{L}\p{N} ._-]+/gu,'_').slice(0,80)+'.txt',text:`Von: ${message.from.name} <${message.from.address}>\nEingang: ${message.receivedAt}\nBetreff: ${message.subject}\n\n${body}`.slice(0,30000)}};
 }catch(error){failure(error);}
}
