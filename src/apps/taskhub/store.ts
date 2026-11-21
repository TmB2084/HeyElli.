import type {Pool,PoolClient} from 'pg';
import {randomUUID} from 'node:crypto';
import {PlatformError} from '../../platform/store/model.ts';
import {emptyExtras,type ChecklistEntry,type HistoryEntry,type TaskExtras,type TaskLink} from './model.ts';
// Ergänzungen zu PDS-Aufgaben (Checkliste, Verknüpfungen, Verlauf). Optimistische Sperre über version, Audit je Änderung.
export type ExtrasChange=
 |{action:'check-add';text:string}
 |{action:'check-toggle';entryId:string}
 |{action:'check-remove';entryId:string}
 |{action:'link-add';link:TaskLink}
 |{action:'link-remove';linkId:string};
const row=(value:Record<string,unknown>|undefined):TaskExtras=>value?{checklist:value.checklist as ChecklistEntry[],links:value.links as TaskLink[],history:value.history as HistoryEntry[],version:Number(value.version)}:emptyExtras;
const plain=(value:unknown,max:number)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max&&!/[\x00-\x08\x0b-\x1f]/.test(value)?value.trim():null;
function validLink(link:TaskLink):TaskLink{
 if(!link||typeof link!=='object'||!['mail','order','document'].includes(link.kind))throw new PlatformError('Ungültige Verknüpfung.');
 const id=plain(link.id,400),label=plain(link.label,200);if(!id||!label)throw new PlatformError('Ungültige Verknüpfung.');
 const href=link.href===undefined?undefined:typeof link.href==='string'&&/^\/[a-z]/.test(link.href)&&link.href.length<=500?link.href:null;if(href===null)throw new PlatformError('Ungültiger Verweis.');
 const detail=link.detail===undefined?undefined:plain(link.detail,300)??undefined;
 return {kind:link.kind,id,label,...(detail?{detail}:{}),...(href?{href}:{})};
}
export function taskExtrasStore(pool:Pool){
 async function transaction<T>(actor:string,work:(client:PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('BEGIN');const user=(await client.query('SELECT enabled FROM platform.users WHERE id=$1 FOR SHARE',[actor])).rows[0];if(!user?.enabled)throw new PlatformError('Benutzerkonto ist nicht aktiv.',403);const result=await work(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
 return {
  async read(source:string,taskId:string){return row((await pool.query('SELECT * FROM platform.task_extras WHERE source=$1 AND task_id=$2',[source,taskId])).rows[0]);},
  async counts(source:string,ids:string[]){const rows=ids.length?(await pool.query("SELECT task_id,jsonb_array_length(checklist) AS total,(SELECT count(*) FROM jsonb_array_elements(checklist) e WHERE (e->>'done')::boolean) AS done FROM platform.task_extras WHERE source=$1 AND task_id=ANY($2::text[])",[source,ids])).rows:[];return new Map(rows.map(item=>[String(item.task_id),{total:Number(item.total),done:Number(item.done)}]));},
  // Verlaufseintrag für eine in PDS ausgeführte Änderung (Status, Zuweisung, Anlage) – PDS liefert keinen Verlauf über die API.
  note:(actor:string,actorName:string,source:string,taskId:string,text:string)=>transaction(actor,async client=>{
   await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['task:'+source+':'+taskId]);
   const current=row((await client.query('SELECT * FROM platform.task_extras WHERE source=$1 AND task_id=$2 FOR UPDATE',[source,taskId])).rows[0]);
   const history=[{at:new Date().toISOString(),actor:actorName.slice(0,120),text:text.slice(0,300)} satisfies HistoryEntry,...current.history].slice(0,100);
   await client.query(`INSERT INTO platform.task_extras(source,task_id,history,updated_by) VALUES($1,$2,$3::jsonb,$4)
    ON CONFLICT(source,task_id) DO UPDATE SET history=excluded.history,version=platform.task_extras.version+1,updated_by=excluded.updated_by,updated_at=now()`,[source,taskId,JSON.stringify(history),actor]);
   await client.query('INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,$2,$3,$4::jsonb)',[actor,'tasks.pds',taskId.slice(0,200),JSON.stringify([{field:'pds',label:'PDS-Aufgabe',before:null,after:text.slice(0,300)}])]);
  }),
  change:(actor:string,actorName:string,source:string,taskId:string,version:number,input:ExtrasChange)=>transaction(actor,async client=>{
   if(!plain(taskId,200)||!Number.isSafeInteger(version)||version<0||!input||typeof input!=='object')throw new PlatformError('Ungültige Eingabe.');
   await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['task:'+source+':'+taskId]);
   const current=row((await client.query('SELECT * FROM platform.task_extras WHERE source=$1 AND task_id=$2 FOR UPDATE',[source,taskId])).rows[0]);
   if(current.version!==version)throw new PlatformError('Die Aufgabe wurde zwischenzeitlich geändert. Die Ansicht wurde aktualisiert.',409);
   const next={checklist:[...current.checklist],links:[...current.links]};let text='';
   switch(input.action){
    case 'check-add':{const value=plain(input.text,200);if(!value)throw new PlatformError('Bitte einen Schritt mit höchstens 200 Zeichen eingeben.');if(next.checklist.length>=50)throw new PlatformError('Höchstens 50 Schritte.');next.checklist.push({id:randomUUID(),text:value,done:false});text=`Schritt „${value}“ hinzugefügt`;break;}
    case 'check-toggle':{const entry=next.checklist.find(item=>item.id===input.entryId);if(!entry)throw new PlatformError('Schritt nicht gefunden.',404);next.checklist=next.checklist.map(item=>item.id===entry.id?{...item,done:!item.done}:item);text=`Schritt „${entry.text}“ ${entry.done?'wieder offen':'erledigt'}`;break;}
    case 'check-remove':{const entry=next.checklist.find(item=>item.id===input.entryId);if(!entry)throw new PlatformError('Schritt nicht gefunden.',404);next.checklist=next.checklist.filter(item=>item.id!==entry.id);text=`Schritt „${entry.text}“ entfernt`;break;}
    case 'link-add':{const link=validLink(input.link);if(next.links.some(item=>item.kind===link.kind&&item.id===link.id))return current;if(next.links.length>=20)throw new PlatformError('Höchstens 20 Verknüpfungen.');next.links.push(link);text=`${link.kind==='mail'?'Mail':link.kind==='order'?'Auftrag':'Dokument'} „${link.label}“ verknüpft`;break;}
    case 'link-remove':{const link=next.links.find(item=>`${item.kind}:${item.id}`===input.linkId);if(!link)throw new PlatformError('Verknüpfung nicht gefunden.',404);next.links=next.links.filter(item=>item!==link);text=`Verknüpfung „${link.label}“ gelöst`;break;}
    default:throw new PlatformError('Unbekannte Aktion.');
   }
   const history=[{at:new Date().toISOString(),actor:actorName.slice(0,120),text:text.slice(0,300)},...current.history].slice(0,100);
   const saved=(await client.query(`INSERT INTO platform.task_extras(source,task_id,checklist,links,history,updated_by) VALUES($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6)
    ON CONFLICT(source,task_id) DO UPDATE SET checklist=excluded.checklist,links=excluded.links,history=excluded.history,version=platform.task_extras.version+1,updated_by=excluded.updated_by,updated_at=now() RETURNING *`,[source,taskId,JSON.stringify(next.checklist),JSON.stringify(next.links),JSON.stringify(history),actor])).rows[0];
   await client.query('INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,$2,$3,$4::jsonb)',[actor,'tasks.'+input.action,taskId.slice(0,200),JSON.stringify([{field:input.action,label:'Aufgabe',before:null,after:text.slice(0,300)}])]);
   return row(saved);
  }),
 };
}
