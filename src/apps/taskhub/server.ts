import 'server-only';
import {appPermission} from '../../platform/app-access';
import {requireAppRead} from '../../platform/app-access/route-access';
import {activeWorkspaceSql} from '../../platform/accounts/core';
import {maildeskOverview} from '../maildesk';
import {PdsProtocolError,PdsTasks,PdsVisits,openTaskStatuses,taskStatuses,type PdsTask,type PdsTransport,type TaskStatus,type Visit} from '../../platform/pds/api';
import {requireSimulatorWrites} from '../../platform/pds/connection';
import {pdsActorForSession,pdsApi} from '../../platform/pds/connection/api';
import {platformDatabase,PlatformError} from '../../platform/store';
import {serviceMatchContext,type ServiceMatchContext} from '../servicehub/akten';
import type {TaskItem,TaskLink} from './model';
import {taskExtrasStore,type ExtrasChange} from './store';
// Aufgaben-App: PDS-Aufgaben sind führend (gespeichert in PDS), dazu lesend Mails aus MailDesk und Aufträge ohne Termin.
const store=()=>taskExtrasStore(platformDatabase());
const MAX_DETAILS=300;
type Person={id:string;name:string;userId:string|null};
const staffCache=new Map<string,{at:number;value:Promise<Person[]>}>();
function sourceKey(api:Awaited<ReturnType<typeof pdsApi>>){return api.source.mode==='simulator'?'simulator':'pds:'+api.source.workspaceId;}
async function staff(transport:PdsTransport,source:string){
 const cached=staffCache.get(source);if(cached&&Date.now()-cached.at<5*60000)return cached.value;
 const value=(async()=>{
  const ids:string[]=[];
  for(let page=0;page<40;page++){const result=await transport.request('POST','/mitarbeiter/listmitarbeiter',{page,entriesPerPage:500}) as {totalHitCount?:number;resultList?:{uuid?:string}[]};if(!Array.isArray(result?.resultList))throw new PdsProtocolError('Ungültige Mitarbeiterliste.');ids.push(...result.resultList.map(row=>String(row.uuid??'')).filter(Boolean));if(ids.length>=(result.totalHitCount??0)||!result.resultList.length)break;}
  const people:Person[]=[];
  for(let i=0;i<ids.length;i+=500){const batch=await transport.request('POST','/mitarbeiter/detailsbatch',{uuids:ids.slice(i,i+500)});if(!Array.isArray(batch))throw new PdsProtocolError('Mitarbeiterdetails fehlen.');for(const row of batch as Record<string,unknown>[])people.push({id:String(row.uuid),name:[row.vorname,row.nachname].filter(value=>typeof value==='string'&&value).join(' ')||String(row.personalNummer??row.uuid),userId:typeof row.benutzerUUID==='string'&&row.benutzerUUID?row.benutzerUUID:null});}
  return people.sort((a,b)=>a.name.localeCompare(b.name,'de'));
 })();
 staffCache.set(source,{at:Date.now(),value});value.catch(()=>{if(staffCache.get(source)?.value===value)staffCache.delete(source);});return value;
}
function failure(error:unknown):never{if(error instanceof PlatformError)throw error;if(error instanceof PdsProtocolError)throw new PlatformError(error.message,422);throw error;}
const closedOrder=/erledigt|abgeschlossen|storniert|abgerechnet/i;
function names(context:ServiceMatchContext|null){
 const customers=new Map((context?.customers??[]).map(item=>[item.id,item])),objects=new Map((context?.objects??[]).map(item=>[item.id,item]));
 const objectLabel=(id?:string|null)=>{if(!id)return '';const item=objects.get(id);if(!item)return '';const parent=item.parentId?objects.get(item.parentId):undefined;return parent?`${parent.name} · ${item.name}`:item.name;};
 const customerOf=(task:{personId?:string;objectId?:string})=>task.personId&&customers.has(task.personId)?task.personId:task.objectId?objects.get(task.objectId)?.customerId||null:null;
 // Untertitel ohne Wiederholung (Kunden heißen oft wie ihr Objekt).
 const subtitle=(customer:string|null|undefined,objectId?:string|null)=>{const name=customer?customers.get(customer)?.name??'':'';const names=name.split(/,\s*/);return [name,...objectLabel(objectId).split(' · ').filter(part=>part&&part!==name&&!names.includes(part))].filter(Boolean).join(' · ');};
 return {customers,objects,objectLabel,customerOf,subtitle};
}
async function mailOwners(){return new Map((await platformDatabase().query(`SELECT user_id,pds_user_uuid FROM platform.pds_user_mappings WHERE workspace_id=${activeWorkspaceSql}`)).rows.map(row=>[String(row.user_id),String(row.pds_user_uuid)]));}
export async function tasksOverview(fresh=false){
 const user=await requireAppRead('/taskhub');
 const api=await pdsApi();
 try{
  const source=sourceKey(api),people=await staff(api.transport,source),byUser=new Map(people.flatMap(person=>person.userId?[[person.userId,person.id] as const]:[]));
  const context=await serviceMatchContext(fresh).catch(()=>null),label=names(context),items:TaskItem[]=[];
  const tasks=new PdsTasks(api.transport),listed=await tasks.list({status:openTaskStatuses});
  const detailed=await tasks.detailsMany(listed.items.slice(0,MAX_DETAILS).map(task=>task.id));
  for(const task of detailed){const customer=label.customerOf(task);items.push({key:'pds:'+task.id,source:'pds',id:task.id,title:task.subject,subtitle:label.subtitle(customer,task.objectId),due:task.due??null,status:task.status,assigneeIds:(task.assignments??[]).map(item=>byUser.get(item.userId)??'user:'+item.userId),customerId:customer,objectId:task.objectId??null,href:null,sources:['pds']});}
  if(context&&await appPermission(user,'/servicehub','read'))for(const order of context.orders)if(order.unplanned&&!closedOrder.test(order.status))items.push({key:'order:'+order.id,source:'order',id:order.id,title:`Termin planen: ${order.number}`,subtitle:[label.customers.get(order.customerId)?.name,order.title].filter(Boolean).join(' · '),due:null,status:'OFFEN',assigneeIds:order.technicianIds??[],customerId:order.customerId||null,objectId:order.objectId||null,href:`/servicehub?ansicht=orders&akte=order&id=${encodeURIComponent(order.id)}`,sources:['order']});
  let mailError='';
  if(await appPermission(user,'/maildesk','read')){
   try{const owners=await mailOwners(),mail=await maildeskOverview('inbox','',fresh);
    for(const message of mail?.messages??[])if(message.state.assigneeId&&!message.state.archived)items.push({key:'mail:'+message.id,source:'mail',id:message.id,title:message.subject||'(ohne Betreff)',subtitle:[message.customerName,message.from.name||message.from.address].filter(Boolean).join(' · '),due:null,status:'OFFEN',assigneeIds:[owners.get(message.state.assigneeId)??'user:'+message.state.assigneeId],customerId:message.assignment?.customerId??null,objectId:message.assignment?.objectId??null,href:`/maildesk?id=${encodeURIComponent(message.id)}`,sources:['mail']});
   }catch(error){mailError=error instanceof PlatformError?error.message:'MailDesk derzeit nicht erreichbar.';}
  }
  const counts=await store().counts(source,detailed.map(task=>task.id));
  return {items:items.map(item=>({...item,checklist:item.source==='pds'?counts.get(item.id)??null:null})),people:people.map(({id,name})=>({id,name})),me:user.pdsUserUUID??null,source:api.source.mode,
   canWrite:await appPermission(user,'/taskhub'),canWritePds:api.source.mode==='simulator',truncated:listed.truncated||listed.items.length>MAX_DETAILS,mailError,loadedAt:new Date().toISOString()};
 }catch(error){failure(error);}finally{api.close();}
}
// Termine vor Ort am Objekt der Aufgabe (inkl. übergeordnetem Objekt und dessen Einheiten).
export async function visitsFor(api:Awaited<ReturnType<typeof pdsApi>>,context:ServiceMatchContext|null,objectId:string|null|undefined,limit=3):Promise<Visit[]>{
 if(!objectId)return [];
 const objects=context?.objects??[],own=objects.find(item=>item.id===objectId),root=own?.parentId||objectId;
 const ids=new Set([objectId,root,...objects.filter(item=>item.parentId===root).map(item=>item.id)]);
 return (await new PdsVisits(api.transport,api.calendar).upcoming(ids)).slice(0,limit);
}
export async function taskDetail(id:unknown){
 const user=await requireAppRead('/taskhub');
 if(typeof id!=='string'||!id||id.length>200)throw new PlatformError('Ungültige Aufgabe.',400);
 const api=await pdsApi();
 try{
  const source=sourceKey(api),tasks=new PdsTasks(api.transport),[task,types,people,context]=await Promise.all([tasks.details(id),tasks.types(),staff(api.transport,source),serviceMatchContext().catch(()=>null)]);
  const label=names(context),customer=label.customerOf(task),byUser=new Map(people.flatMap(person=>person.userId?[[person.userId,person] as const]:[]));
  const visits=await visitsFor(api,context,task.objectId).catch(()=>[]),names2=new Map(people.map(person=>[person.id,person.name]));
  return {task,typeName:types.find(type=>type.id===task.typeId)?.name??null,types,customer:customer?{id:customer,name:label.customers.get(customer)?.name??customer,number:label.customers.get(customer)?.number??''}:null,
   object:task.objectId?{id:task.objectId,name:label.objectLabel(task.objectId)||task.objectId,address:label.objects.get(task.objectId)?.address??''}:null,
   assignments:(task.assignments??[]).map(item=>({id:item.id,employeeId:byUser.get(item.userId)?.id??null,name:byUser.get(item.userId)?.name??'Unbekannter PDS-Benutzer',assignedAt:item.assignedAt??null})),
   visits:visits.map(visit=>({...visit,employees:visit.employeeIds.map(employee=>names2.get(employee)??'Unbekannt')})),
   extras:await store().read(source,id),people:people.filter(person=>person.userId).map(({id,name})=>({id,name})),
   canWrite:await appPermission(user,'/taskhub'),canWritePds:api.source.mode==='simulator'};
 }catch(error){failure(error);}finally{api.close();}
}
type ActionInput={action?:unknown;requestId?:unknown;status?:unknown;due?:unknown;employeeId?:unknown;assignmentId?:unknown;version?:unknown}&Record<string,unknown>;
const requestKey=(value:unknown)=>{if(typeof value!=='string'||!/^[A-Za-z0-9-]{8,80}$/.test(value))throw new PlatformError('Anfragekennung fehlt.',400);return value;};
async function writer(){
 const user=await requireAppRead('/taskhub');
 if(!await appPermission(user,'/taskhub'))throw new PlatformError('Schreibrecht für Aufgaben erforderlich.',403);
 return user;
}
export async function taskAction(id:unknown,raw:unknown){
 const user=await writer();
 if(typeof id!=='string'||!id||id.length>200||!raw||typeof raw!=='object'||Array.isArray(raw))throw new PlatformError('Ungültige Eingabe.',400);
 const input=raw as ActionInput,action=String(input.action??'');
 if(action.startsWith('check-')||action.startsWith('link-')){
  const api=await pdsApi();let source:string;try{source=sourceKey(api);await new PdsTasks(api.transport).details(id);}catch(error){failure(error);}finally{api.close();}
  return {extras:await store().change(user.id,user.displayName??user.id,source,id,Number(input.version),input as unknown as ExtrasChange)};
 }
 await requireSimulatorWrites();const actor=await pdsActorForSession();
 const api=await pdsApi(`${actor.id}:task:${requestKey(input.requestId)}`);
 try{
  const source=sourceKey(api),tasks=new PdsTasks(api.transport);let note='';let task:PdsTask;
  switch(action){
   case 'status':{if(!taskStatuses.includes(input.status as TaskStatus))throw new PlatformError('Ungültiger Status.',400);task=await tasks.update(id,{status:input.status as TaskStatus});note=`Status: ${String(input.status)}`;break;}
   case 'due':{task=await tasks.update(id,{due:typeof input.due==='string'?input.due:undefined});note=`Fällig am geändert`;break;}
   case 'assign':{if(typeof input.employeeId!=='string')throw new PlatformError('Mitarbeiter fehlt.',400);const userId=await tasks.userForEmployee(input.employeeId);task=await tasks.assign(id,userId);note='Zuweisung ergänzt';break;}
   case 'unassign':{if(typeof input.assignmentId!=='string')throw new PlatformError('Zuweisung fehlt.',400);const before=await tasks.details(id);if(!before.assignments?.some(item=>item.id===input.assignmentId))throw new PlatformError('Zuweisung gehört nicht zu dieser Aufgabe.',400);await tasks.unassign(input.assignmentId);task=await tasks.details(id);note='Zuweisung gelöst';break;}
   default:throw new PlatformError('Unbekannte Aktion.',400);
  }
  await store().note(user.id,user.displayName??user.id,source,id,note);
  return {task};
 }catch(error){failure(error);}finally{api.close();}
}
export type TaskCreateInput={requestId:string;subject:string;typeId?:string;due?:string;customerId?:string;objectId?:string;description?:string;assigneeIds?:string[];checklist?:string[];links?:TaskLink[]};
// Aufgabe in PDS anlegen (nur Simulator freigegeben); Bezug nur aus vorhandenen PDS-Datensätzen, Ergänzungen in heyelli.
export async function taskCreate(raw:unknown){
 const user=await writer();
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new PlatformError('Ungültige Eingabe.',400);
 const input=raw as Partial<TaskCreateInput>;
 await requireSimulatorWrites();const actor=await pdsActorForSession();
 const api=await pdsApi(`${actor.id}:task-create:${requestKey(input.requestId)}`);
 try{
  const source=sourceKey(api),context=await serviceMatchContext(),tasks=new PdsTasks(api.transport);
  if(input.customerId!==undefined&&!context.customers.some(item=>item.id===input.customerId))throw new PlatformError('Kunde nicht gefunden.',404);
  const object=input.objectId?context.objects.find(item=>item.id===input.objectId):undefined;if(input.objectId&&!object)throw new PlatformError('Objekt nicht gefunden.',404);
  if(object&&input.customerId&&object.customerId!==input.customerId)throw new PlatformError('Objekt gehört nicht zu diesem Kunden.',400);
  const assignees=Array.isArray(input.assigneeIds)?[...new Set(input.assigneeIds)].slice(0,10):[];
  const userIds=await Promise.all(assignees.map(employee=>{if(typeof employee!=='string')throw new PlatformError('Ungültige Zuweisung.',400);return tasks.userForEmployee(employee);}));
  const task=await tasks.create({subject:String(input.subject??''),typeId:input.typeId,due:input.due,personId:input.customerId??object?.customerId,objectId:input.objectId,description:input.description},userIds);
  const extras=store(),name=user.displayName??user.id;
  await extras.note(user.id,name,source,task.id,'Aufgabe in PDS angelegt');
  let current=await extras.read(source,task.id);
  for(const text of (Array.isArray(input.checklist)?input.checklist:[]).slice(0,20))if(typeof text==='string'&&text.trim())current=await extras.change(user.id,name,source,task.id,current.version,{action:'check-add',text});
  for(const link of (Array.isArray(input.links)?input.links:[]).slice(0,5))current=await extras.change(user.id,name,source,task.id,current.version,{action:'link-add',link});
  return {task,extras:current};
 }catch(error){failure(error);}finally{api.close();}
}
// Auswahllisten für „Aufgabe anlegen“: Typen und Benutzer aus PDS, Kunden und Objekte aus dem Service-Kontext.
export async function taskFormOptions(){
 const user=await requireAppRead('/taskhub');
 const api=await pdsApi();
 try{
  const source=sourceKey(api),tasks=new PdsTasks(api.transport),[types,people,context]=await Promise.all([tasks.types(),staff(api.transport,source),serviceMatchContext()]);
  return {types,people:people.filter(person=>person.userId).map(({id,name})=>({id,name})),me:user.pdsUserUUID??null,customers:context.customers.map(({id,name,number})=>({id,name,number})),objects:context.objects.map(({id,customerId,parentId,name,address})=>({id,customerId,parentId,name,address})),
   canCreate:api.source.mode==='simulator'&&await appPermission(user,'/taskhub')&&!!user.pdsUserUUID,reason:api.source.mode!=='simulator'?'Echtes PDS ist nur lesend freigegeben; Aufgaben werden dort in PDS angelegt.':!user.pdsUserUUID?'Ihrem Konto ist kein PDS-Benutzer zugeordnet.':''};
 }catch(error){failure(error);}finally{api.close();}
}
