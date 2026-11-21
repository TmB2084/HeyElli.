import {randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import {PlatformError} from '../../platform/store/model.ts';
import type {MailState} from './model.ts';
// Entscheidungen je Nachricht, gelernte Absender und Antworten. Keine Mailinhalte außer der Antwort in der
// zentralen Mail-Warteschlange (dort gelten Testbetrieb, Kontingent und Inhaltsbereinigung).
const id=(value:unknown,max=200)=>typeof value==='string'&&value.length>=1&&value.length<=max&&!/[\x00-\x1f]/.test(value);
const email=(value:unknown)=>typeof value==='string'&&value.length<=320&&/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(value)&&!value.endsWith('.invalid');
export const emptyState:MailState={customerId:null,objectId:null,orderNumber:null,decision:'auto',assigneeId:null,flagged:false,archived:false,version:0,updatedAt:null};
function state(row:Record<string,unknown>):MailState{return {customerId:row.customer_id as string|null,objectId:row.object_id as string|null,orderNumber:row.order_number as string|null,decision:row.decision as MailState['decision'],assigneeId:row.assignee_id as string|null,flagged:row.flagged as boolean,archived:row.archived as boolean,version:row.version as number,updatedAt:(row.updated_at as Date).toISOString()};}
export type MailAction={action:'assign'|'confirm'|'clear'|'assignee'|'flag'|'archive'|'order';version:number;customerId?:unknown;objectId?:unknown;assigneeId?:unknown;value?:unknown;orderNumber?:unknown};
export function maildeskStore(pool:Pool){
 async function transaction<T>(actor:string,work:(client:PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('BEGIN');const user=(await client.query('SELECT enabled FROM platform.users WHERE id=$1 FOR SHARE',[actor])).rows[0];if(!user?.enabled)throw new PlatformError('Konto nicht aktiv.',403);const result=await work(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
 return {
  async states(source:string,ids:string[]){const rows=ids.length?(await pool.query('SELECT * FROM platform.maildesk_messages WHERE source=$1 AND message_id=ANY($2::text[])',[source,ids])).rows:[];return new Map(rows.map(row=>[row.message_id as string,state(row)]));},
  async senders(source:string){return (await pool.query('SELECT sender AS address,customer_id AS "customerId" FROM platform.maildesk_senders WHERE source=$1 ORDER BY sender LIMIT 20000',[source])).rows as {address:string;customerId:string}[];},
  async people(){return (await pool.query("SELECT id,display_name AS name FROM platform.users WHERE enabled ORDER BY display_name,id LIMIT 500")).rows as {id:string;name:string}[];},
  // sender: vom Server aus der gelesenen Nachricht übergeben, nie aus der Client-Eingabe.
  change:(actor:string,source:string,messageId:string,input:MailAction,sender:string)=>transaction(actor,async client=>{
   if(!id(messageId,400)||!input||typeof input!=='object'||!Number.isSafeInteger(input.version)||input.version<0)throw new PlatformError('Ungültige Auswahl.');
   await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['maildesk:'+source+':'+messageId]);
   const before=(await client.query('SELECT * FROM platform.maildesk_messages WHERE source=$1 AND message_id=$2 FOR UPDATE',[source,messageId])).rows[0],current=before?state(before):emptyState;
   if(current.version!==input.version)throw new PlatformError('Die Nachricht wurde zwischenzeitlich von jemand anderem bearbeitet. Die Ansicht wurde aktualisiert.',409);
   const next={...current};let learn=false;
   switch(input.action){
    case 'assign':case 'confirm':if(!id(input.customerId)||input.objectId!=null&&!id(input.objectId))throw new PlatformError('Ungültiger Kunde.');next.customerId=input.customerId as string;next.objectId=(input.objectId as string|undefined)??null;next.decision=input.action==='assign'?'manual':'confirmed';learn=email(sender);break;
    case 'clear':next.customerId=null;next.objectId=null;next.orderNumber=null;next.decision='cleared';break;
    case 'assignee':if(input.assigneeId!==null&&!id(input.assigneeId,120))throw new PlatformError('Ungültige Zuständigkeit.');if(input.assigneeId!==null&&!(await client.query('SELECT 1 FROM platform.users WHERE id=$1 AND enabled',[input.assigneeId])).rowCount)throw new PlatformError('Konto nicht gefunden oder nicht aktiv.');next.assigneeId=input.assigneeId as string|null;break;
    case 'flag':case 'archive':if(typeof input.value!=='boolean')throw new PlatformError('Ungültige Auswahl.');if(input.action==='flag')next.flagged=input.value;else next.archived=input.value;break;
    case 'order':if(typeof input.orderNumber!=='string'||!/^[\p{L}\p{N}][\p{L}\p{N}._/-]{0,79}$/u.test(input.orderNumber)||!id(input.customerId))throw new PlatformError('Ungültige Auftragsnummer.');next.orderNumber=input.orderNumber;next.customerId=input.customerId as string;next.objectId=input.objectId!=null&&id(input.objectId)?input.objectId as string:next.objectId;if(next.decision==='auto'||next.decision==='cleared')next.decision='confirmed';break;
    default:throw new PlatformError('Unbekannte Aktion.');
   }
   const row=(await client.query(`INSERT INTO platform.maildesk_messages(source,message_id,customer_id,object_id,order_number,decision,assignee_id,flagged,archived,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (source,message_id) DO UPDATE SET customer_id=$3,object_id=$4,order_number=$5,decision=$6,assignee_id=$7,flagged=$8,archived=$9,updated_by=$10,updated_at=now(),version=platform.maildesk_messages.version+1 RETURNING *`,
    [source,messageId,next.customerId,next.objectId,next.orderNumber,next.decision,next.assigneeId,next.flagged,next.archived,actor])).rows[0];
   if(learn&&next.customerId)await client.query('INSERT INTO platform.maildesk_senders(source,sender,customer_id,learned_by) VALUES($1,$2,$3,$4) ON CONFLICT (source,sender) DO UPDATE SET customer_id=$3,learned_by=$4,learned_at=now()',[source,sender.toLowerCase(),next.customerId,actor]);
   await client.query('INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,$2,$3,$4::jsonb)',[actor,'maildesk.'+input.action,messageId.slice(0,200),JSON.stringify([{field:input.action,label:'MailDesk',before:{customer:current.customerId,order:current.orderNumber,assignee:current.assigneeId,flagged:current.flagged,archived:current.archived},after:{customer:next.customerId,order:next.orderNumber,assignee:next.assigneeId,flagged:next.flagged,archived:next.archived}}])]);
   return state(row);
  }),
  reply:(actor:string,source:string,messageId:string,input:{requestId:unknown;recipient:unknown;subject:unknown;body:unknown})=>transaction(actor,async client=>{
   if(typeof input.requestId!=='string'||!/^[0-9a-f-]{36}$/.test(input.requestId)||!email(input.recipient)||typeof input.subject!=='string'||!input.subject.trim()||input.subject.length>300||/[\r\n]/.test(input.subject)||typeof input.body!=='string'||!input.body.trim()||input.body.length>20000)throw new PlatformError('Empfänger, Betreff und Text prüfen.');
   const repeated=(await client.query('SELECT r.*,q.status FROM platform.maildesk_replies r JOIN platform.mail_queue q ON q.id=r.queue_id WHERE r.id=$1',[input.requestId])).rows[0];
   if(repeated){if(repeated.actor_id!==actor||repeated.message_id!==messageId)throw new PlatformError('Anfragekennung bereits verwendet.',409);return {id:repeated.id as string,testMode:repeated.test_mode as boolean,repeated:true};}
   const settings=(await client.query("SELECT enabled,test_mode,sender FROM platform.mail_settings WHERE id='central' FOR SHARE")).rows[0];
   if(!settings?.enabled)throw new PlatformError('Der Mailversand (MS365-Graph) ist nicht freigegeben. Bitte in Outlook antworten.',409);
   if(!email(settings.sender))throw new PlatformError('Das zentrale Absenderpostfach ist ungültig.',409);
   const counts=(await client.query("SELECT count(*) FILTER(WHERE actor_id=$1)::int own,count(*)::int total FROM platform.maildesk_replies WHERE created_at>now()-interval '1 hour'",[actor])).rows[0];
   if(counts.own>=30||counts.total>=300)throw new PlatformError('Versandkontingent erreicht. Bitte später erneut versuchen.',429);
   const queueId=randomUUID();
   await client.query('INSERT INTO platform.mail_queue(id,request_id,sender,recipient,subject,body,actor_id,test_mode) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[queueId,input.requestId,settings.sender,input.recipient,input.subject,input.body,actor,settings.test_mode]);
   await client.query("INSERT INTO platform.mail_log(mail_id,actor_id,action) VALUES($1,$2,'queued')",[queueId,actor]);
   await client.query('INSERT INTO platform.maildesk_replies(id,source,message_id,actor_id,queue_id,test_mode) VALUES($1,$2,$3,$4,$5,$6)',[input.requestId,source,messageId,actor,queueId,settings.test_mode]);
   await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,'maildesk.reply',$2,$3::jsonb)",[actor,messageId.slice(0,200),JSON.stringify([{field:'reply',label:'MailDesk-Antwort',before:null,after:{queueId,testMode:settings.test_mode}}])]);
   return {id:input.requestId,testMode:settings.test_mode as boolean,repeated:false};
  }),
  async sent(source:string){return (await pool.query(`SELECT r.id,r.message_id AS "messageId",r.created_at AS "createdAt",r.test_mode AS "testMode",q.recipient,q.subject,q.status,u.display_name AS "actorName"
   FROM platform.maildesk_replies r JOIN platform.mail_queue q ON q.id=r.queue_id LEFT JOIN platform.users u ON u.id=r.actor_id WHERE r.source=$1 ORDER BY r.created_at DESC LIMIT 200`,[source])).rows as {id:string;messageId:string;createdAt:Date;testMode:boolean;recipient:string;subject:string;status:string;actorName:string|null}[];},
 };
}
