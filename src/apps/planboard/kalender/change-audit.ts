import {createHash} from 'node:crypto';
import type {Pool} from 'pg';
import type {CalendarEvent} from './model.ts';
import {mergeLabels,type MergeField} from './merge.ts';
import {fieldValue,type ConflictProvenance} from './change-provenance.ts';
const fingerprint=(event:CalendarEvent,field:MergeField)=>createHash('sha256').update(fieldValue(event,field)).digest('hex');
export function calendarChangeAudit(pool:Pool){
 return {
  async record(actor:string,before:CalendarEvent,after:CalendarEvent){
   const fields=(Object.keys(mergeLabels) as MergeField[]).filter(field=>fieldValue(before,field)!==fieldValue(after,field));
   if(!fields.length)return;
   // One statement: all affected field stamps share the database timestamp.
   await pool.query(`WITH stamps AS (
     INSERT INTO platform.audit_events(actor_id,action,target_id,changes) SELECT $1,stamp.action,$2,jsonb_build_array(detail.value) FROM unnest($3::text[]) WITH ORDINALITY AS stamp(action,n) JOIN jsonb_array_elements($4::jsonb) WITH ORDINALITY AS detail(value,n) USING(n)
    ) INSERT INTO platform.calendar_history(event_id,actor_id,actor_name,changes)
    VALUES($2,$1,COALESCE((SELECT display_name FROM platform.users WHERE id=$1),'Unbekannter Benutzer'),$4::jsonb)`,[actor,after.id,fields.map(field=>`calendar.field.${field}.${fingerprint(after,field)}`),JSON.stringify(fields.map(field=>({field,label:mergeLabels[field],before:before[field]??null,after:after[field]??null})))]);
  },
  async status(actor:string,eventId:string,before:string,after:string){
   await pool.query(`INSERT INTO platform.calendar_history(event_id,actor_id,actor_name,changes) VALUES($1,$2,COALESCE((SELECT display_name FROM platform.users WHERE id=$2),'Unbekannter Benutzer'),$3::jsonb)`,[eventId,actor,JSON.stringify([{field:'orderStatus',label:'Auftragsstatus',before,after}])]);
  },
  async mobile(actor:string,eventId:string,technician:string,operationId?:string){
   if(operationId){
    const client=await pool.connect();
    try{
     await client.query('BEGIN');
     await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[eventId+operationId]);
     const changes=JSON.stringify([{field:'mobileIssue',label:'Mobil ausgegeben',before:null,after:technician,operationId}]);
     await client.query(`INSERT INTO platform.calendar_history(event_id,actor_id,actor_name,changes) SELECT $1,$2,COALESCE((SELECT display_name FROM platform.users WHERE id=$2),'Unbekannter Benutzer'),$3::jsonb WHERE NOT EXISTS(SELECT 1 FROM platform.calendar_history WHERE event_id=$1 AND changes=$3::jsonb)`,[eventId,actor,changes]);
     await client.query('COMMIT');return;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
   }
   await pool.query(`INSERT INTO platform.calendar_history(event_id,actor_id,actor_name,changes) VALUES($1,$2,COALESCE((SELECT display_name FROM platform.users WHERE id=$2),'Unbekannter Benutzer'),$3::jsonb)`,[eventId,actor,JSON.stringify([{field:'mobileIssue',label:'Mobil ausgegeben',before:null,after:technician}])]);
  },
  async history(eventId:string){
   const {rows}=await pool.query("SELECT id::text,actor_name AS \"actorName\",created_at AS at,changes FROM platform.calendar_history WHERE event_id=$1 ORDER BY id DESC LIMIT 200",[eventId]);
   return rows;
  },
  async read(current:CalendarEvent,fields:MergeField[]):Promise<ConflictProvenance['current']>{
   const result:ConflictProvenance['current']={};
   for(const field of fields){
    // Inspect the latest stamp for this field, never an older matching value.
    const {rows}=await pool.query("SELECT e.action,e.created_at,u.display_name FROM platform.audit_events e LEFT JOIN platform.users u ON u.id=e.actor_id WHERE e.target_id=$1 AND starts_with(e.action,$2) ORDER BY e.id DESC LIMIT 1",[current.id,`calendar.field.${field}.`]);
    const row=rows[0];result[field]=row&&row.action===`calendar.field.${field}.${fingerprint(current,field)}`&&row.display_name?{displayName:row.display_name,at:new Date(row.created_at).toISOString(),source:'saved'}:{displayName:'Unbekannt',at:null,source:'unknown'};
   }
   return result;
  }
 };
}
