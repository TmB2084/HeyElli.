import type {Pool,PoolClient} from 'pg';
import {randomUUID} from 'node:crypto';
import {PlatformError} from '../../platform/store/model.ts';
// MissionControl: persönliche Planung (Tag, wichtig, Reihenfolge, Schätzung), Fokuszeiten und Notizen zu Aufgaben.
export type PlanEntry={itemKey:string;title:string;day:string|null;important:boolean;position:number;estimate:number|null;time:string|null;eventId:string|null;calendarError:string|null};
export type FocusSession={id:string;itemKey:string;title:string;plannedMinutes:number|null;startedAt:string;endedAt:string|null;seconds:number|null};
export type MissionNote={id:string;itemKey:string;body:string;authorId:string|null;authorName:string;createdAt:string};
export type PlanChange={itemKey:unknown;title?:unknown;day?:unknown;important?:unknown;position?:unknown;estimate?:unknown};
const MAX_IMPORTANT=3;
const key=(value:unknown)=>typeof value==='string'&&/^(pds|mail|order):[^\s]{1,450}$/.test(value)?value:null;
const text=(value:unknown,max:number)=>typeof value==='string'&&value.trim()&&value.trim().length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)?value.trim():null;
const iso=(value:unknown)=>value instanceof Date?value.toISOString():value==null?null:String(value);
const plan=(row:Record<string,unknown>):PlanEntry=>({itemKey:String(row.item_key),title:String(row.title),day:row.day_text==null?null:String(row.day_text),important:row.important===true,position:Number(row.position),estimate:row.estimate_minutes==null?null:Number(row.estimate_minutes),time:row.time_text==null?null:String(row.time_text).slice(0,5),eventId:row.calendar_event_id==null?null:String(row.calendar_event_id),calendarError:row.calendar_error==null?null:String(row.calendar_error)});
const focus=(row:Record<string,unknown>):FocusSession=>({id:String(row.id),itemKey:String(row.item_key),title:String(row.title),plannedMinutes:row.planned_minutes==null?null:Number(row.planned_minutes),startedAt:iso(row.started_at)!,endedAt:iso(row.ended_at),seconds:row.seconds==null?null:Number(row.seconds)});
export function missionStore(pool:Pool){
 async function transaction<T>(actor:string,work:(client:PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('BEGIN');const user=(await client.query('SELECT enabled FROM platform.users WHERE id=$1 FOR SHARE',[actor])).rows[0];if(!user?.enabled)throw new PlatformError('Benutzerkonto ist nicht aktiv.',403);const result=await work(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
 return {
  async plans(user:string,source:string){return (await pool.query('SELECT *,plan_day::text AS day_text,plan_time::text AS time_text FROM platform.mission_plan WHERE user_id=$1 AND source=$2 ORDER BY important DESC,position,item_key LIMIT 2000',[user,source])).rows.map(plan);},
  // Planung ändern: Tag (YYYY-MM-DD oder null), wichtig (höchstens drei je Tag), Reihenfolge, Schätzung in Minuten.
  plan:(user:string,source:string,input:PlanChange)=>transaction(user,async client=>{
   const itemKey=key(input.itemKey);if(!itemKey)throw new PlatformError('Ungültige Aufgabe.');
   await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['mission:'+user+':'+source]);
   const current=(await client.query('SELECT *,plan_day::text AS day_text,plan_time::text AS time_text FROM platform.mission_plan WHERE user_id=$1 AND source=$2 AND item_key=$3 FOR UPDATE',[user,source,itemKey])).rows[0];
   const before=current?plan(current):null,title=input.title===undefined?before?.title??null:text(input.title,300);if(!title)throw new PlatformError('Titel fehlt.');
   let planDay=before?.day??null;if(input.day!==undefined){if(input.day===null||input.day==='')planDay=null;else if(typeof input.day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(input.day)&&Number.isFinite(Date.parse(input.day+'T00:00:00Z')))planDay=input.day;else throw new PlatformError('Ungültiger Tag.');}
   let important=before?.important??false;if(input.important!==undefined){if(typeof input.important!=='boolean')throw new PlatformError('Ungültige Angabe.');important=input.important;}
   if(important&&!planDay)throw new PlatformError('Wichtige Aufgaben brauchen einen Tag.');
   if(important&&(!before?.important||before.day!==planDay)){const count=Number((await client.query('SELECT count(*) FROM platform.mission_plan WHERE user_id=$1 AND source=$2 AND plan_day=$3 AND important AND item_key<>$4',[user,source,planDay,itemKey])).rows[0].count);if(count>=MAX_IMPORTANT)throw new PlatformError(`Höchstens ${MAX_IMPORTANT} wichtige Aufgaben je Tag. Bitte zuerst eine andere zurückstufen.`,409);}
   let position=before?.position??0;if(input.position!==undefined){if(!Number.isInteger(input.position)||Number(input.position)<0||Number(input.position)>100000)throw new PlatformError('Ungültige Reihenfolge.');position=Number(input.position);}
   let estimate=before?.estimate??null;if(input.estimate!==undefined){if(input.estimate===null)estimate=null;else if(Number.isInteger(input.estimate)&&Number(input.estimate)>=5&&Number(input.estimate)<=600)estimate=Number(input.estimate);else throw new PlatformError('Schätzung zwischen 5 und 600 Minuten.');}
   if(!planDay&&!important&&estimate===null&&position===0&&!before?.eventId){await client.query('DELETE FROM platform.mission_plan WHERE user_id=$1 AND source=$2 AND item_key=$3',[user,source,itemKey]);return null;}
   const row=(await client.query(`INSERT INTO platform.mission_plan(user_id,source,item_key,title,plan_day,important,position,estimate_minutes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT(user_id,source,item_key) DO UPDATE SET title=excluded.title,plan_time=CASE WHEN platform.mission_plan.plan_day IS DISTINCT FROM excluded.plan_day OR platform.mission_plan.estimate_minutes IS DISTINCT FROM excluded.estimate_minutes THEN NULL ELSE platform.mission_plan.plan_time END,plan_day=excluded.plan_day,important=excluded.important,position=excluded.position,estimate_minutes=excluded.estimate_minutes,updated_at=now() RETURNING *,plan_day::text AS day_text,plan_time::text AS time_text`,[user,source,itemKey,title,planDay,important,position,estimate])).rows[0];
   return plan(row);
  }),
  // Kalenderstand eines Plans (Uhrzeit, Ereigniskennung, letzter Fehler); leere Pläne ohne Kalendereintrag werden aufgeräumt.
  async calendar(user:string,source:string,itemKey:string,change:{day?:string;time?:string|null;eventId?:string|null;error?:string|null}){
   const sets:string[]=[],values:unknown[]=[user,source,itemKey];
   if(change.day!==undefined){if(!/^\d{4}-\d{2}-\d{2}$/.test(change.day))throw new PlatformError('Ungültiger Tag.');values.push(change.day);sets.push(`plan_day=$${values.length}::date`);}
   if(change.time!==undefined){if(change.time!==null&&!/^\d{2}:\d{2}$/.test(change.time))throw new PlatformError('Ungültige Uhrzeit.');values.push(change.time);sets.push(`plan_time=$${values.length}::time`);}
   if(change.eventId!==undefined){values.push(change.eventId);sets.push(`calendar_event_id=$${values.length}`);}
   if(change.error!==undefined){values.push(change.error?change.error.slice(0,300):null);sets.push(`calendar_error=$${values.length}`);}
   if(!sets.length)return;
   await pool.query(`UPDATE platform.mission_plan SET ${sets.join(',')} WHERE user_id=$1 AND source=$2 AND item_key=$3`,values);
   await pool.query('DELETE FROM platform.mission_plan WHERE user_id=$1 AND source=$2 AND item_key=$3 AND plan_day IS NULL AND NOT important AND estimate_minutes IS NULL AND position=0 AND calendar_event_id IS NULL',[user,source,itemKey]);
  },
  async settings(user:string){const row=(await pool.query('SELECT calendar_sync FROM platform.mission_settings WHERE user_id=$1',[user])).rows[0];return {calendarSync:row?.calendar_sync===true};},
  setCalendarSync:(user:string,value:boolean)=>transaction(user,async client=>{await client.query('INSERT INTO platform.mission_settings(user_id,calendar_sync) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET calendar_sync=excluded.calendar_sync,updated_at=now()',[user,value]);await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,'mission.calendar',$1,$2::jsonb)",[user,JSON.stringify([{field:'calendarSync',label:'Outlook-Kalender',before:null,after:value}])]);return {calendarSync:value};}),
  async running(user:string){const row=(await pool.query('SELECT * FROM platform.mission_focus WHERE user_id=$1 AND ended_at IS NULL',[user])).rows[0];return row?focus(row):null;},
  // Fokus starten: beendet eine laufende Sitzung des Benutzers und beginnt eine neue (eine Aufgabe zur Zeit).
  start:(user:string,source:string,itemKey:unknown,title:unknown,planned:unknown)=>transaction(user,async client=>{
   const item=key(itemKey),name=text(title,300);if(!item||!name)throw new PlatformError('Ungültige Aufgabe.');
   const minutes=planned==null?null:Number.isInteger(planned)&&Number(planned)>=5&&Number(planned)<=600?Number(planned):(()=>{throw new PlatformError('Geplante Dauer zwischen 5 und 600 Minuten.');})();
   await client.query("UPDATE platform.mission_focus SET ended_at=now(),seconds=LEAST(86400,GREATEST(0,EXTRACT(EPOCH FROM now()-started_at)::integer)) WHERE user_id=$1 AND ended_at IS NULL",[user]);
   return focus((await client.query('INSERT INTO platform.mission_focus(id,user_id,source,item_key,title,planned_minutes) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[randomUUID(),user,source,item,name,minutes])).rows[0]);
  }),
  stop:(user:string)=>transaction(user,async client=>{const row=(await client.query("UPDATE platform.mission_focus SET ended_at=now(),seconds=LEAST(86400,GREATEST(0,EXTRACT(EPOCH FROM now()-started_at)::integer)) WHERE user_id=$1 AND ended_at IS NULL RETURNING *",[user])).rows[0];return row?focus(row):null;}),
  extend:(user:string,minutes:number)=>transaction(user,async client=>{const row=(await client.query('UPDATE platform.mission_focus SET planned_minutes=LEAST(600,COALESCE(planned_minutes,0)+$2) WHERE user_id=$1 AND ended_at IS NULL RETURNING *',[user,minutes])).rows[0];if(!row)throw new PlatformError('Kein laufender Fokus.',404);return focus(row);}),
  // Fokuszeit je Aufgabe und Tag (Berliner Kalendertag) für Tagesanzeige und Rückblick.
  async seconds(user:string,source:string,from:string,to:string){return (await pool.query(`SELECT item_key,((started_at AT TIME ZONE 'Europe/Berlin')::date)::text AS day,sum(COALESCE(seconds,LEAST(86400,EXTRACT(EPOCH FROM now()-started_at)::integer)))::integer AS seconds FROM platform.mission_focus WHERE user_id=$1 AND source=$2 AND (started_at AT TIME ZONE 'Europe/Berlin')::date BETWEEN $3::date AND $4::date GROUP BY 1,2 ORDER BY 2,1`,[user,source,from,to])).rows.map(row=>({itemKey:String(row.item_key),day:String(row.day),seconds:Number(row.seconds)}));},
  async notes(source:string,itemKey:string){return (await pool.query('SELECT * FROM platform.mission_notes WHERE source=$1 AND item_key=$2 ORDER BY created_at,id LIMIT 200',[source,itemKey])).rows.map(row=>({id:String(row.id),itemKey:String(row.item_key),body:String(row.body),authorId:row.author_id==null?null:String(row.author_id),authorName:String(row.author_name),createdAt:iso(row.created_at)!}) satisfies MissionNote);},
  async noteCounts(source:string,keys:string[]){const rows=keys.length?(await pool.query('SELECT item_key,count(*)::integer AS n FROM platform.mission_notes WHERE source=$1 AND item_key=ANY($2::text[]) GROUP BY 1',[source,keys])).rows:[];return new Map(rows.map(row=>[String(row.item_key),Number(row.n)]));},
  addNote:(user:string,userName:string,source:string,itemKey:unknown,body:unknown)=>transaction(user,async client=>{
   const item=key(itemKey),value=typeof body==='string'?body.trim():'';if(!item)throw new PlatformError('Ungültige Aufgabe.');
   if(!value||value.length>2000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))throw new PlatformError('Bitte eine Notiz mit höchstens 2000 Zeichen eingeben.');
   const row=(await client.query('INSERT INTO platform.mission_notes(id,source,item_key,body,author_id,author_name) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[randomUUID(),source,item,value,user,userName.slice(0,120)||user.slice(0,120)])).rows[0];
   await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,'mission.note-add',$2,$3::jsonb)",[user,item.slice(0,200),JSON.stringify([{field:'note',label:'Notiz zur Aufgabe',before:null,after:{id:row.id,length:value.length}}])]);
   return {id:String(row.id),itemKey:item,body:value,authorId:user,authorName:String(row.author_name),createdAt:iso(row.created_at)!} satisfies MissionNote;
  }),
  removeNote:(user:string,source:string,id:unknown)=>transaction(user,async client=>{
   if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))throw new PlatformError('Ungültige Notiz.');
   const row=(await client.query('SELECT author_id,item_key FROM platform.mission_notes WHERE id=$1 AND source=$2 FOR UPDATE',[id,source])).rows[0];
   if(!row)throw new PlatformError('Notiz nicht gefunden.',404);if(row.author_id!==user)throw new PlatformError('Nur eigene Notizen können gelöscht werden.',403);
   await client.query('DELETE FROM platform.mission_notes WHERE id=$1',[id]);
   await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,'mission.note-remove',$2,$3::jsonb)",[user,String(row.item_key).slice(0,200),JSON.stringify([{field:'note',label:'Notiz zur Aufgabe',before:{id},after:null}])]);
  }),
 };
}
