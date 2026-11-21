import {PdsProtocolError,type PdsTransport} from "./protocol.ts";
// PDS-CRM-Aufgaben (OpenAPI /crm/*, Handbuch Kap. 11.2). Aktivitäten (Gesprächsnotizen, Telefonate) bietet die API nicht an.
// Zuweisungen erwarten die benutzerUUID; heyelli-Konten sind Mitarbeitern zugeordnet → Brücke über /mitarbeiter/details.benutzerUUID.
export const taskStatuses=["OFFEN","IN_BEARBEITUNG","WARTEN","ERLEDIGT","ABGELEHNT"] as const;
export type TaskStatus=typeof taskStatuses[number];
export const openTaskStatuses:TaskStatus[]=["OFFEN","IN_BEARBEITUNG","WARTEN"];
export type TaskAssignment={id:string;userId:string;assignedAt?:string};
export type PdsTask={id:string;number?:number;subject:string;typeId?:string;due?:string;validFrom?:string;personId?:string;projectId?:string;objectId?:string;status:TaskStatus;description?:string;assignments?:TaskAssignment[]};
export type TaskInput={subject:string;typeId?:string;due?:string;personId?:string;objectId?:string;projectId?:string;description?:string;status?:TaskStatus};
export type TaskType={id:string;name:string;standard:boolean};
type Row=Record<string,unknown>;
const text=(value:unknown,max:number)=>typeof value==="string"&&value.length<=max?value:undefined;
const id=(value:unknown)=>typeof value==="string"&&value.length>0&&value.length<=200&&!/\s/.test(value)?value:undefined;
function instant(value:unknown,field:string){if(value===undefined||value===null||value==="")return undefined;if(typeof value!=="string"||!Number.isFinite(Date.parse(value))||value.length>40)throw new PdsProtocolError(`${field}: ungültiger Zeitpunkt.`);return new Date(value).toISOString();}
function status(value:unknown):TaskStatus{if(!taskStatuses.includes(value as TaskStatus))throw new PdsProtocolError("Ungültiger Aufgabenstatus.");return value as TaskStatus;}
export function readTask(value:unknown):PdsTask{
 if(!value||typeof value!=="object")throw new PdsProtocolError("Ungültige PDS-Aufgabe.");
 const row=value as Row,uuid=id(row.uuid);if(!uuid)throw new PdsProtocolError("Aufgaben-UUID fehlt.");
 const assignments=row.zuweisungen===undefined?undefined:Array.isArray(row.zuweisungen)?row.zuweisungen.map(item=>{const entry=item as Row,assignment=id(entry?.uuid),user=id(entry?.benutzerUUID);if(!assignment||!user)throw new PdsProtocolError("Unvollständige Aufgabenzuweisung.");return {id:assignment,userId:user,...(typeof entry.zugewiesen==="string"?{assignedAt:entry.zugewiesen}:{})};}):(()=>{throw new PdsProtocolError("Ungültige Aufgabenzuweisungen.");})();
 return {id:uuid,...(Number.isSafeInteger(row.dbid)?{number:row.dbid as number}:{}),subject:text(row.betreff,500)??"Ohne Betreff",...(id(row.typUUID)?{typeId:row.typUUID as string}:{}),...(typeof row.faelligam==="string"?{due:row.faelligam}:{}),...(typeof row.gueltigab==="string"?{validFrom:row.gueltigab}:{}),...(id(row.personUUID)?{personId:row.personUUID as string}:{}),...(id(row.projektakteUUID)?{projectId:row.projektakteUUID as string}:{}),...(id(row.objektUUID)?{objectId:row.objektUUID as string}:{}),status:row.status===undefined?"OFFEN":status(row.status),...(text(row.beschreibung,20000)!==undefined?{description:row.beschreibung as string}:{}),...(assignments?{assignments}:{})};
}
// Eingaben serverseitig prüfen; PDS erlaubt nur entweder Objekt oder Projektakte (Schema-Beschreibung PdsAPIAufgabeAnlegenRESTModel).
export function taskPayload(input:Partial<TaskInput>,creating:boolean):Row{
 const out:Row={};
 if(input.subject!==undefined||creating){const subject=typeof input.subject==="string"?input.subject.trim():"";if(!subject||subject.length>200)throw new PdsProtocolError("Bitte einen Betreff mit höchstens 200 Zeichen angeben.");out.betreff=subject;}
 if(input.description!==undefined){if(typeof input.description!=="string"||input.description.length>4000)throw new PdsProtocolError("Beschreibung zu lang (höchstens 4000 Zeichen).");out.beschreibung=input.description;}
 for(const [key,field] of [["typeId","typUUID"],["personId","personUUID"],["objectId","objektUUID"],["projectId","projektakteUUID"]] as const){const value=input[key];if(value===undefined||value==="")continue;if(!id(value))throw new PdsProtocolError("Ungültige Referenz.");out[field]=value;}
 if(out.objektUUID&&out.projektakteUUID)throw new PdsProtocolError("PDS erlaubt nur entweder ein Objekt oder eine Projektakte.");
 const due=instant(input.due,"Fällig am");if(due)out.faelligam=due;
 if(input.status!==undefined){if(creating)throw new PdsProtocolError("Der Status wird beim Anlegen von PDS gesetzt.");out.status=status(input.status);}
 return out;
}
export class PdsTasks{
 private api:PdsTransport;
 constructor(api:PdsTransport){this.api=api;}
 async types():Promise<TaskType[]>{
  const result=await this.api.request("GET","/crm/listaufgabentypen");
  if(!Array.isArray(result))throw new PdsProtocolError("Ungültige Aufgabentypen.");
  return result.map(item=>{const row=item as Row,uuid=id(row?.uuid);if(!uuid)throw new PdsProtocolError("Aufgabentyp ohne UUID.");return {id:uuid,name:text(row.bezeichnung,200)??uuid,standard:row.standard===true};});
 }
 // Liste ohne Zuweisungen/Beschreibung (PdsAPIAufgabeRESTModel); Filter nach Benutzer, Kunde oder Objekt bietet PDS nicht.
 async list(filter:{status?:TaskStatus[];dueBefore?:string;dueAfter?:string;query?:string}={},maximum=5000):Promise<{items:PdsTask[];truncated:boolean}>{
  const body:Row={...(filter.status?.length?{status:[...new Set(filter.status.map(status))]}:{}),...(filter.query?{suchwort:String(filter.query).slice(0,120)}:{}),...(filter.dueBefore?{faelligkeitVor:instant(filter.dueBefore,"Fällig vor")}:{}),...(filter.dueAfter?{faelligkeitNach:instant(filter.dueAfter,"Fällig nach")}:{})};
  const items:PdsTask[]=[];
  for(let page=0;page<100;page++){
   const result=await this.api.request("POST","/crm/listaufgaben",{...body,page,entriesPerPage:500}) as {totalHitCount?:unknown;resultList?:unknown};
   if(!Array.isArray(result?.resultList)||typeof result.totalHitCount!=="number")throw new PdsProtocolError("Ungültige PDS-Aufgabenliste.");
   items.push(...result.resultList.map(readTask));
   if(items.length>=maximum)return {items:items.slice(0,maximum),truncated:true};
   if(items.length>=result.totalHitCount||!result.resultList.length)return {items,truncated:false};
  }
  return {items,truncated:true};
 }
 async details(uuid:string){if(!id(uuid))throw new PdsProtocolError("Ungültige Aufgabe.");return readTask(await this.api.request("POST","/crm/aufgabedetails",{uuid}));}
 // Details für viele Aufgaben (Zuweisungen fehlen in der Liste); begrenzt parallel.
 async detailsMany(ids:string[],parallel=6){const out:PdsTask[]=[];for(let i=0;i<ids.length;i+=parallel)out.push(...await Promise.all(ids.slice(i,i+parallel).map(uuid=>this.details(uuid))));return out;}
 async create(input:TaskInput,assigneeUserIds:string[]=[]){
  const created=readTask(await this.api.request("POST","/crm/createaufgabe",taskPayload(input,true)));
  for(const user of [...new Set(assigneeUserIds)]){if(!id(user))throw new PdsProtocolError("Ungültiger PDS-Benutzer.");await this.api.request("POST","/crm/createaufgabezuweisung",{uuid:created.id,benutzerUUID:user});}
  return assigneeUserIds.length?this.details(created.id):created;
 }
 async update(uuid:string,patch:Partial<TaskInput>){if(!id(uuid))throw new PdsProtocolError("Ungültige Aufgabe.");return readTask(await this.api.request("POST","/crm/updateaufgabe",{uuid,...taskPayload(patch,false)}));}
 async assign(uuid:string,userId:string){if(!id(uuid)||!id(userId))throw new PdsProtocolError("Ungültige Zuweisung.");return readTask(await this.api.request("POST","/crm/createaufgabezuweisung",{uuid,benutzerUUID:userId}));}
 async unassign(assignmentId:string){if(!id(assignmentId))throw new PdsProtocolError("Ungültige Zuweisung.");await this.api.request("POST","/crm/removeaufgabezuweisung",{uuid:assignmentId});}
 // Mitarbeiter-UUID (heyelli-Zuordnung) → benutzerUUID für Aufgabenzuweisungen.
 async userForEmployee(employeeId:string){const row=await this.api.request("POST","/mitarbeiter/details",{uuid:employeeId}) as Row;if(row?.uuid!==employeeId)throw new PdsProtocolError("Mitarbeiter nicht gefunden.");const user=id(row.benutzerUUID);if(!user)throw new PdsProtocolError("Für diesen Mitarbeiter ist in PDS kein Benutzer hinterlegt.");return user;}
}
