import type {Pool} from 'pg';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {existsSync,lstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {authorize} from './repository.ts';
import {exportOwnedDraft} from '../../apps/planboard/entwuerfe/repository.ts';
import {PlatformError} from '../store/model.ts';
type Scope={actor:string;subject:string;admin:boolean};
export async function* personalExport(pool:Pool,scope:Scope,options:{signal?:AbortSignal;business:boolean;sqlitePath?:string}){
 await authorize(pool,scope);const client=await pool.connect(),started=Date.now();let sqlite:DatabaseSync|undefined;
 async function valid(){options.signal?.throwIfAborted();if(Date.now()-started>300000)throw new PlatformError('Exportzeit überschritten. Bitte erneut versuchen.',503);await authorize(pool,scope);}
 async function* rows(type:string,query:string,values:unknown[]=[]){for(let offset=0;;offset+=50){await valid();const page=(await client.query(query+` LIMIT 50 OFFSET $${values.length+1}`,[...values,offset])).rows;for(const value of page)yield {type,value};if(page.length<50)return;}}
 try{
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await client.query("SET LOCAL statement_timeout='10s'");await client.query("SET LOCAL idle_in_transaction_session_timeout='30s'");yield {type:'manifest',format:1,createdAt:new Date().toISOString(),scope:'Ein Benutzerkonto',privateDraftContents:scope.actor===scope.subject,businessData:options.business,notice:'Vertrauliche Inhalte geschützt aufbewahren. Keine Zugangsdaten, Token oder Entschlüsselungsschlüssel enthalten.'};
  const user=scope.subject,hash=(id:string)=>createHash('sha256').update(id).digest('hex');
  const sources:[string,string,unknown[]][]=[
   ['browser-diagnostics','SELECT day::text,app,directive,blocked_kind,disposition,occurrences,first_seen,last_seen FROM platform.browser_reports WHERE user_id=$1 ORDER BY day,app,directive,blocked_kind,disposition',[user]],
   ['profile','SELECT id,display_name,role,app_role_id,enabled,created_at,updated_at FROM platform.users WHERE id=$1 ORDER BY id',[user]],
   ['role','SELECT r.id,r.name,r.apps,r.write_apps,r.tools FROM platform.users u JOIN platform.app_roles r ON r.id=COALESCE(u.app_role_id,u.role) WHERE u.id=$1 ORDER BY r.id',[user]],
   ['appearance-calendar','SELECT calendar,calendar_version,appearance,appearance_version,updated_at FROM platform.user_preferences WHERE owner_hash=$1 ORDER BY owner_hash',[hash(user)]],
   ['personal-notes',scope.actor===user?'SELECT body,version,updated_at FROM platform.personal_notes WHERE user_id=$1 ORDER BY user_id':'SELECT length(body) AS characters,version,updated_at FROM platform.personal_notes WHERE user_id=$1 ORDER BY user_id',[user]],
   ['tools','SELECT hidden_tools,version,updated_at FROM platform.tool_preferences WHERE user_id=$1 ORDER BY user_id',[user]],
   ['launcher','SELECT view_mode,version,updated_at FROM platform.launcher_preferences WHERE user_id=$1 ORDER BY user_id',[user]],
   ['service-hidden','SELECT source,kind,entity_id,hidden_at FROM platform.service_hidden_entries WHERE user_id=$1 ORDER BY source,kind,entity_id',[user]],
   ['maildesk-replies','SELECT id,source,message_id,queue_id,test_mode,created_at FROM platform.maildesk_replies WHERE actor_id=$1 ORDER BY created_at,id',[user]],
   ['maildesk-decisions','SELECT source,message_id,customer_id,object_id,order_number,decision,flagged,archived,version,updated_at FROM platform.maildesk_messages WHERE updated_by=$1 ORDER BY source,message_id',[user]],
   ['task-extras','SELECT source,task_id,checklist,links,version,updated_at FROM platform.task_extras WHERE updated_by=$1 ORDER BY source,task_id',[user]],
   ['customer-notes','SELECT id,source,customer_id,body,created_at FROM platform.customer_notes WHERE author_id=$1 ORDER BY created_at,id',[user]],
   ['mission-plan','SELECT source,item_key,title,plan_day,plan_time,important,position,estimate_minutes,calendar_event_id,updated_at FROM platform.mission_plan WHERE user_id=$1 ORDER BY source,plan_day,item_key',[user]],
   ['mission-focus','SELECT source,item_key,title,planned_minutes,started_at,ended_at,seconds FROM platform.mission_focus WHERE user_id=$1 ORDER BY started_at',[user]],
   ['mission-notes','SELECT id,source,item_key,body,created_at FROM platform.mission_notes WHERE author_id=$1 ORDER BY created_at,id',[user]],
   ['mission-settings','SELECT calendar_sync,updated_at FROM platform.mission_settings WHERE user_id=$1',[user]],
   ['mission-done','SELECT source,item_key,title,done_at FROM platform.mission_done WHERE user_id=$1 ORDER BY done_at',[user]],
   ['service-pinned','SELECT source,customer_id,pinned_at FROM platform.service_pinned_customers WHERE user_id=$1 ORDER BY source,customer_id',[user]],
   ['usage','SELECT app_path,visits FROM platform.app_usage WHERE user_id=$1 ORDER BY app_path',[user]],
   ['duty-preferences','SELECT selection,version,holiday_settings,holiday_version,updated_at FROM platform.duty_resource_preferences WHERE user_id=$1 ORDER BY user_id',[user]],
   ['pds-mapping','SELECT workspace_id,pds_user_uuid FROM platform.pds_user_mappings WHERE user_id=$1 ORDER BY workspace_id',[user]],
   ['feedback','SELECT epoch,turn_id,rating,reason,comment,question,answer,sources,knowledge_version,created_at,updated_at FROM platform.assistant_feedback WHERE user_id=$1 ORDER BY epoch,turn_id',[user]],
   ['mail','SELECT id,sender,recipient,subject,body,status,test_mode,created_at,processed_at,content_cleared_at FROM platform.mail_queue WHERE actor_id=$1 ORDER BY id',[user]],
   ['mail-activity','SELECT id,mail_id,action,created_at FROM platform.mail_log WHERE actor_id=$1 ORDER BY id',[user]],
   ['sessions','SELECT id,auth_mode,created_at,expires_at,revoked_at FROM platform.sessions WHERE user_id=$1 ORDER BY id',[user]],
   ['service-confirmations','SELECT id,source,order_id,incident_id,channel,test_mode,queue_id,created_at FROM platform.service_confirmations WHERE actor_id=$1 ORDER BY id',[user]],
   ['activity','SELECT id::text,action,target_id,created_at FROM platform.audit_events WHERE actor_id=$1 ORDER BY id',[user]],
   ['calendar-activity','SELECT id::text,event_id,created_at FROM platform.calendar_history WHERE actor_id=$1 ORDER BY id',[user]],
   ['duty-exclusions','SELECT id,resource_id,week_day,created_at FROM platform.duty_exclusions WHERE user_id=$1 ORDER BY id',[user]],
   ['duty-swaps','SELECT id,year,requester_id,partner_id,status,created_at,completed_at FROM platform.duty_swaps WHERE requester_id=$1 OR partner_id=$1 ORDER BY id',[user]],
   ['privacy-activity','SELECT id::text,actor_id,summary,created_at FROM platform.privacy_executions WHERE subject_id=$1 ORDER BY id',[user]],
   ['chat-removal-markers','SELECT epoch,turn_id,removed_at FROM platform.removed_chat_turns WHERE user_id=$1 ORDER BY epoch,turn_id',[user]],
  ];
  for(const [type,query,values]of sources)yield* rows(type,query,values);
  for(const workspace of (await client.query('SELECT id FROM platform.pds_workspaces ORDER BY id')).rows){if(!/^[a-f0-9-]{36}$/i.test(workspace.id))throw Error('Ungültiger Quellenbereich');const schema='pds_'+workspace.id.replaceAll('-','');yield* rows('pds-calendar-preferences',`SELECT $2::text AS workspace,calendar,calendar_version,appearance,appearance_version,updated_at FROM "${schema}".user_preferences WHERE owner_hash=$1 ORDER BY owner_hash`,[hash(workspace.id+':'+user),workspace.id]);}
  const chat=(await client.query('SELECT epoch,turns,drafts,pending,updated_at FROM platform.assistant_chats WHERE user_id=$1',[user])).rows[0];if(chat){yield {type:'chat-state',value:{epoch:chat.epoch,drafts:chat.drafts,pending:chat.pending,updatedAt:chat.updated_at}};for(const turn of chat.turns)yield {type:'chat-turn',value:turn};}
  const key=scope.actor===user?(await client.query('SELECT key_id,wrapped_key FROM platform.private_draft_keys WHERE user_id=$1',[user])).rows[0]:null;
  for await(const entry of rows('calendar-draft','SELECT storage_key,state,envelope,updated_at FROM platform.private_draft_copies WHERE user_id=$1 ORDER BY storage_key',[user])){const row=entry.value;yield {type:entry.type,value:{storageKey:row.storage_key,state:row.state,updatedAt:row.updated_at,...(key&&row.envelope?{draft:exportOwnedDraft(scope.actor,user,key,row.storage_key,row.envelope)}:{protected:!!row.envelope})}};}
  if(options.business){const path=options.sqlitePath??resolve('.local/pds-simulator/development.sqlite');if(existsSync(/* turbopackIgnore: true */ path)){const info=lstatSync(/* turbopackIgnore: true */ path);if(!info.isFile()||info.isSymbolicLink())throw Error('Unsichere Simulatorablage');sqlite=new (DatabaseSync as unknown as new(path:string,options:{readOnly:boolean})=>DatabaseSync)(path,{readOnly:true});sqlite.exec('BEGIN');const tables=new Set(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t=>t.name));
    for(const table of ['orders','customer_persons','person_customer_links'])if(tables.has(table)){for(let offset=0;;offset+=50){await valid();const page=sqlite.prepare(`SELECT * FROM ${table} WHERE created_by=? ORDER BY rowid LIMIT 50 OFFSET ?`).all(user,offset);for(const row of page)yield {type:'simulator-'+table,value:row};if(page.length<50)break;}}
    const chunks=tables.has('upload_chunks');
    if(tables.has('uploads'))for(let offset=0;;offset+=50){await valid();const files=sqlite.prepare(chunks?'SELECT id,name,created_at,coalesce(chunked_size,length(content)) AS bytes,transfer_id FROM uploads WHERE created_by=? ORDER BY id LIMIT 50 OFFSET ?':'SELECT id,name,created_at,length(content) AS bytes FROM uploads WHERE created_by=? ORDER BY id LIMIT 50 OFFSET ?').all(user,offset);for(const file of files){yield {type:'upload',value:file};for(let at=1;at<=Number(file.bytes);at+=65536){await valid();const part=file.transfer_id?sqlite.prepare('SELECT substr(content,?,65536) AS chunk FROM upload_chunks WHERE transfer_id=? AND position=?').get((at-1)%262144+1,file.transfer_id,Math.floor((at-1)/262144)*262144):sqlite.prepare('SELECT substr(content,?,65536) AS chunk FROM uploads WHERE id=? AND created_by=?').get(at,file.id,user);yield {type:'upload-content-base64',value:{id:file.id,offset:at-1,content:Buffer.from(part!.chunk as Uint8Array).toString('base64')}};}}if(files.length<50)break;}
  }}
  await valid();yield {type:'end',complete:true};
 }finally{sqlite?.close();await client.query('ROLLBACK');client.release();}
}
export function exportResponse(iterator:AsyncGenerator,signal:AbortSignal){
 const encoder=new TextEncoder();const stream=new ReadableStream<Uint8Array>({async pull(controller){try{signal.throwIfAborted();const next=await iterator.next();if(next.done)controller.close();else controller.enqueue(encoder.encode(JSON.stringify(next.value)+'\n'));}catch(error){await iterator.return(undefined);controller.error(error);}},async cancel(){await iterator.return(undefined);}});
 return new Response(stream,{headers:{'Cache-Control':'no-store','Content-Type':'application/x-ndjson; charset=utf-8','Content-Disposition':'attachment; filename="heyelli-datenexport.jsonl"','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; frame-ancestors 'none'"}});
}
