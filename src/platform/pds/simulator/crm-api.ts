import seed from "../../../../database/seeds/pds-simulator/crm-tasks.json" with {type:"json"};
import {objects,units,employees} from "./fixtures.ts";
import {InvalidOrder,type openOrderStore} from "./order-store.ts";
type Store=ReturnType<typeof openOrderStore>;
type Row=Record<string,unknown>;
// PDS-Simulator für /crm/* (fiktive Aufgaben). Schreiben nur mit Simulator-Workflow, idempotent je Workflow-Schritt.
export const simulatorUserId=(employeeId:string)=>employeeId.replace(/^sim-employee-/,"sim-user-");
const users=()=>new Set(employees.map(employee=>simulatorUserId(employee.id)));
const statuses=["OFFEN","IN_BEARBEITUNG","ERLEDIGT","ABGELEHNT","WARTEN"];
export function crmTasks(store:Store):Row[]{
 const rows=new Map<string,Row>(seed.tasks.map(task=>[task.uuid,task as Row]));
 for(const record of store.apiEntities("crm-task"))rows.set(record.uuid,{...record.data,uuid:record.uuid});
 const deleted=new Set(store.apiEntities("crm-task-deletion").map(record=>String(record.data.targetUUID)));
 return [...rows.values()].filter(row=>!deleted.has(String(row.uuid)));
}
function check(input:Row){
 if(input.objektUUID!==undefined&&![...objects,...units].some(item=>item.id===input.objektUUID))throw new InvalidOrder("Objekt unbekannt.");
 if(input.personUUID!==undefined&&!objects.some(object=>object.customerNumber===input.personUUID))throw new InvalidOrder("Person unbekannt.");
 if(input.typUUID!==undefined&&!seed.types.some(type=>type.uuid===input.typUUID))throw new InvalidOrder("Aufgabentyp unbekannt.");
 if(input.objektUUID&&input.projektakteUUID)throw new InvalidOrder("Nur Objekt oder Projektakte.");
 if(input.status!==undefined&&!statuses.includes(String(input.status)))throw new InvalidOrder("Ungültiger Status.");
 for(const key of ["faelligam","gueltigab"])if(input[key]!==undefined&&!Number.isFinite(Date.parse(String(input[key]))))throw new InvalidOrder("Ungültiger Zeitpunkt.");
}
const listFields=(row:Row)=>{const {beschreibung,zuweisungen,...rest}=row;void beschreibung;void zuweisungen;return rest;};
export function crmRequest(store:Store,path:string,input:Row,workflow?:string):unknown{
 const find=(uuid:unknown)=>{const found=crmTasks(store).find(row=>row.uuid===uuid);if(!found)throw new InvalidOrder("Aufgabe nicht gefunden.");return found;};
 switch(path){
  case "/crm/listaufgabentypen":return seed.types;
  case "/crm/aufgabedetails":return find(input.uuid);
  case "/crm/listaufgaben":{
   const size=Number(input.entriesPerPage??500),page=Number(input.page??0);if(!Number.isInteger(size)||size<1||size>1000||!Number.isInteger(page)||page<0)throw new InvalidOrder("Ungültige Paginierung.");
   const wanted=Array.isArray(input.status)&&input.status.length?new Set(input.status as string[]):null,words=String(input.suchwort??"").toLowerCase().split(/\s+/).filter(Boolean);
   const before=input.faelligkeitVor?Date.parse(String(input.faelligkeitVor)):Infinity,after=input.faelligkeitNach?Date.parse(String(input.faelligkeitNach)):-Infinity;
   const projects=Array.isArray(input.projektakteUUIDs)&&input.projektakteUUIDs.length?new Set(input.projektakteUUIDs as string[]):null;
   const rows=crmTasks(store).filter(row=>(!wanted||wanted.has(String(row.status)))&&(!projects||projects.has(String(row.projektakteUUID)))&&words.every(word=>String(row.betreff??"").toLowerCase().includes(word)||String(row.beschreibung??"").toLowerCase().includes(word))&&(!row.faelligam||(Date.parse(String(row.faelligam))<before&&Date.parse(String(row.faelligam))>after))).sort((a,b)=>Number(a.dbid??0)-Number(b.dbid??0));
   return {totalHitCount:rows.length,resultList:rows.slice(page*size,(page+1)*size).map(listFields)};
  }
 }
 if(!workflow)throw new InvalidOrder("Schreibzugriff erfordert einen Simulator-Workflow.");
 const step=path==="/crm/createaufgabezuweisung"?`${path}:${String(input.uuid)}:${String(input.benutzerUUID)}`:`${path}:${String(input.uuid??"")}`;
 return store.apiStep(workflow,step,input,()=>{
  switch(path){
   case "/crm/createaufgabe":{check(input);const number=7000+crmTasks(store).length+1;const created=store.apiCreate("crm-task",{...input,dbid:number,status:"OFFEN",gueltigab:input.gueltigab??new Date().toISOString(),zuweisungen:[]});return {...created};}
   case "/crm/updateaufgabe":{const old=find(input.uuid);const next={...old,...input};check(next);const {uuid,...data}=next;return store.apiPut(String(uuid),"crm-task",data);}
   case "/crm/createaufgabezuweisung":{const old=find(input.uuid);if(!users().has(String(input.benutzerUUID)))throw new InvalidOrder("PDS-Benutzer unbekannt.");const list=(old.zuweisungen??[]) as Row[];if(list.some(item=>item.benutzerUUID===input.benutzerUUID))return old;const {uuid,...data}:Row={...old,zuweisungen:[...list,{uuid:`${String(old.uuid)}-a${list.length+1}-${String(input.benutzerUUID)}`,dbid:list.length+1,benutzerUUID:input.benutzerUUID,zugewiesen:new Date().toISOString()}]};return store.apiPut(String(uuid),"crm-task",data);}
   case "/crm/removeaufgabezuweisung":{const owner=crmTasks(store).find(row=>((row.zuweisungen??[]) as Row[]).some(item=>item.uuid===input.uuid));if(!owner)throw new InvalidOrder("Zuweisung nicht gefunden.");const {uuid,...data}:Row={...owner,zuweisungen:((owner.zuweisungen??[]) as Row[]).filter(item=>item.uuid!==input.uuid)};store.apiPut(String(uuid),"crm-task",data);return {};}
   case "/crm/deleteaufgabe":{find(input.uuid);store.apiCreate("crm-task-deletion",{targetUUID:input.uuid});return {};}
   default:throw new InvalidOrder("Schreibendpunkt nicht implementiert.");
  }
 });
}
