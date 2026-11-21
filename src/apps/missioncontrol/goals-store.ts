import type {Pool,PoolClient} from 'pg';
import {randomUUID} from 'node:crypto';
import {PlatformError} from '../../platform/store/model.ts';
// Teamziele (MissionControl): anlegen, ändern, archivieren, Tageswerte, Aufgaben zuordnen, Erledigt-Protokoll.
export type GoalMetric='unplanned_orders'|'overdue_tasks'|'open_offers'|'manual';
export type Goal={id:string;title:string;metric:GoalMetric;direction:'max'|'min';target:number;startValue:number|null;manualValue:number|null;offerStatuses:string[];offerMinAgeDays:number|null;ownerName:string|null;periodFrom:string;periodTo:string;archived:boolean;version:number;updatedAt:string};
export type GoalInput={id?:unknown;version?:unknown;title?:unknown;metric?:unknown;direction?:unknown;target?:unknown;startValue?:unknown;offerStatuses?:unknown;offerMinAgeDays?:unknown;ownerName?:unknown;periodFrom?:unknown;periodTo?:unknown};
export const metrics:GoalMetric[]=['unplanned_orders','overdue_tasks','open_offers','manual'];
const int=(value:unknown,min:number,max:number,label:string)=>{if(!Number.isInteger(value)||Number(value)<min||Number(value)>max)throw new PlatformError(`${label}: ganze Zahl zwischen ${min} und ${max}.`);return Number(value);};
const date=(value:unknown,label:string)=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z')))throw new PlatformError(`${label}: ungültiges Datum.`);return value;};
const goal=(row:Record<string,unknown>):Goal=>({id:String(row.id),title:String(row.title),metric:row.metric as GoalMetric,direction:row.direction as 'max'|'min',target:Number(row.target),startValue:row.start_value==null?null:Number(row.start_value),manualValue:row.manual_value==null?null:Number(row.manual_value),offerStatuses:(row.offer_statuses as string[])??[],offerMinAgeDays:row.offer_min_age_days==null?null:Number(row.offer_min_age_days),ownerName:row.owner_name==null?null:String(row.owner_name),periodFrom:String(row.from_text),periodTo:String(row.to_text),archived:row.archived===true,version:Number(row.version),updatedAt:new Date(String(row.updated_at)).toISOString()});
const COLUMNS='*,period_from::text AS from_text,period_to::text AS to_text';
export function goalsStore(pool:Pool){
 async function transaction<T>(actor:string,work:(client:PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('BEGIN');const user=(await client.query('SELECT enabled FROM platform.users WHERE id=$1 FOR SHARE',[actor])).rows[0];if(!user?.enabled)throw new PlatformError('Benutzerkonto ist nicht aktiv.',403);const result=await work(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
 const audit=(client:PoolClient,actor:string,action:string,target:string,after:unknown)=>client.query('INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,$2,$3,$4::jsonb)',[actor,'mission.goal-'+action,target,JSON.stringify([{field:action,label:'Ziel',before:null,after}])]);
 return {
  async list(source:string,includeArchived=false){return (await pool.query(`SELECT ${COLUMNS} FROM platform.mission_goals WHERE source=$1 ${includeArchived?'':'AND NOT archived'} ORDER BY period_to,title LIMIT 100`,[source])).rows.map(goal);},
  save:(actor:string,source:string,input:GoalInput)=>transaction(actor,async client=>{
   const title=typeof input.title==='string'?input.title.trim():'';if(!title||title.length>160)throw new PlatformError('Bitte einen Titel mit höchstens 160 Zeichen angeben.');
   if(!metrics.includes(input.metric as GoalMetric))throw new PlatformError('Ungültige Kennzahl.');const metric=input.metric as GoalMetric;
   if(input.direction!=='max'&&input.direction!=='min')throw new PlatformError('Ungültige Richtung.');
   const target=int(input.target,0,1000000,'Zielwert'),start=input.startValue==null||input.startValue===''?null:int(input.startValue,0,1000000,'Ausgangswert');
   const from=date(input.periodFrom,'Beginn'),to=date(input.periodTo,'Ende');if(to<from)throw new PlatformError('Das Ende liegt vor dem Beginn.');
   const statuses=metric==='open_offers'?(Array.isArray(input.offerStatuses)?[...new Set(input.offerStatuses)]:[]):[];
   if(metric==='open_offers'&&(!statuses.length||statuses.length>20||statuses.some(item=>typeof item!=='string'||!item||item.length>200)))throw new PlatformError('Bitte mindestens einen Angebotsstatus wählen.');
   const age=metric==='open_offers'&&input.offerMinAgeDays!=null&&input.offerMinAgeDays!==''?int(input.offerMinAgeDays,1,365,'Mindestalter'):null;
   const owner=typeof input.ownerName==='string'&&input.ownerName.trim()?input.ownerName.trim().slice(0,120):null;
   if(input.id){
    if(typeof input.id!=='string'||!/^[0-9a-f-]{36}$/i.test(input.id))throw new PlatformError('Ungültiges Ziel.');
    const before=(await client.query('SELECT version FROM platform.mission_goals WHERE id=$1 AND source=$2 FOR UPDATE',[input.id,source])).rows[0];if(!before)throw new PlatformError('Ziel nicht gefunden.',404);
    if(Number(before.version)!==Number(input.version))throw new PlatformError('Das Ziel wurde zwischenzeitlich geändert. Bitte neu laden.',409);
    const row=(await client.query(`UPDATE platform.mission_goals SET title=$3,metric=$4,direction=$5,target=$6,start_value=$7,offer_statuses=$8,offer_min_age_days=$9,owner_name=$10,period_from=$11,period_to=$12,version=version+1,updated_by=$13,updated_at=now() WHERE id=$1 AND source=$2 RETURNING ${COLUMNS}`,[input.id,source,title,metric,input.direction,target,start,statuses,age,owner,from,to,actor])).rows[0];
    await audit(client,actor,'update',String(input.id),{title,metric,target});return goal(row);
   }
   const row=(await client.query(`INSERT INTO platform.mission_goals(id,source,title,metric,direction,target,start_value,offer_statuses,offer_min_age_days,owner_name,period_from,period_to,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13) RETURNING ${COLUMNS}`,[randomUUID(),source,title,metric,input.direction,target,start,statuses,age,owner,from,to,actor])).rows[0];
   await audit(client,actor,'create',String(row.id),{title,metric,target});return goal(row);
  }),
  archive:(actor:string,source:string,id:unknown,archived:boolean)=>transaction(actor,async client=>{if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))throw new PlatformError('Ungültiges Ziel.');const row=(await client.query(`UPDATE platform.mission_goals SET archived=$3,version=version+1,updated_by=$4,updated_at=now() WHERE id=$1 AND source=$2 RETURNING ${COLUMNS}`,[id,source,archived,actor])).rows[0];if(!row)throw new PlatformError('Ziel nicht gefunden.',404);await audit(client,actor,archived?'archive':'restore',id,{archived});return goal(row);}),
  manual:(actor:string,source:string,id:unknown,value:unknown)=>transaction(actor,async client=>{if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))throw new PlatformError('Ungültiges Ziel.');const amount=int(value,0,1000000,'Wert');const row=(await client.query(`UPDATE platform.mission_goals SET manual_value=$3,version=version+1,updated_by=$4,updated_at=now() WHERE id=$1 AND source=$2 AND metric='manual' RETURNING ${COLUMNS}`,[id,source,amount,actor])).rows[0];if(!row)throw new PlatformError('Nur manuelle Ziele lassen sich so ändern.',404);await audit(client,actor,'value',id,{value:amount});return goal(row);}),
  async record(goalId:string,day:string,value:number){await pool.query('INSERT INTO platform.mission_goal_values(goal_id,day,value) VALUES($1,$2,$3) ON CONFLICT(goal_id,day) DO UPDATE SET value=excluded.value',[goalId,day,Math.max(0,Math.min(1000000,Math.round(value)))]);},
  async history(goalIds:string[],from:string){const rows=goalIds.length?(await pool.query('SELECT goal_id,day::text AS day,value FROM platform.mission_goal_values WHERE goal_id=ANY($1::uuid[]) AND day>=$2::date ORDER BY day',[goalIds,from])).rows:[];const map=new Map<string,{day:string;value:number}[]>();for(const row of rows){const list=map.get(String(row.goal_id))??[];list.push({day:String(row.day),value:Number(row.value)});map.set(String(row.goal_id),list);}return map;},
  async links(source:string){return new Map((await pool.query('SELECT item_key,goal_id FROM platform.mission_goal_items WHERE source=$1',[source])).rows.map(row=>[String(row.item_key),String(row.goal_id)]));},
  link:(actor:string,source:string,itemKey:unknown,goalId:unknown)=>transaction(actor,async client=>{
   if(typeof itemKey!=='string'||!/^(pds|mail|order):[^\s]{1,450}$/.test(itemKey))throw new PlatformError('Ungültige Aufgabe.');
   if(goalId===null||goalId===''){await client.query('DELETE FROM platform.mission_goal_items WHERE source=$1 AND item_key=$2',[source,itemKey]);return null;}
   if(typeof goalId!=='string'||!(await client.query('SELECT 1 FROM platform.mission_goals WHERE id=$1 AND source=$2 AND NOT archived',[goalId,source])).rowCount)throw new PlatformError('Ziel nicht gefunden.',404);
   await client.query('INSERT INTO platform.mission_goal_items(goal_id,source,item_key,linked_by) VALUES($1,$2,$3,$4) ON CONFLICT(source,item_key) DO UPDATE SET goal_id=excluded.goal_id,linked_by=excluded.linked_by,linked_at=now()',[goalId,source,itemKey,actor]);return goalId;
  }),
  // Fokuszeit des Teams je Ziel im Zeitraum (über die zugeordneten Aufgaben).
  async focusByGoal(source:string,from:string,to:string){return new Map((await pool.query(`SELECT i.goal_id,sum(COALESCE(f.seconds,LEAST(86400,EXTRACT(EPOCH FROM now()-f.started_at)::integer)))::integer AS seconds FROM platform.mission_focus f JOIN platform.mission_goal_items i ON i.source=f.source AND i.item_key=f.item_key WHERE f.source=$1 AND (f.started_at AT TIME ZONE 'Europe/Berlin')::date BETWEEN $2::date AND $3::date GROUP BY 1`,[source,from,to])).rows.map(row=>[String(row.goal_id),Number(row.seconds)]));},
  async done(user:string,source:string,itemKey:string,title:string){await pool.query('INSERT INTO platform.mission_done(id,user_id,source,item_key,title) VALUES($1,$2,$3,$4,$5)',[randomUUID(),user,source,itemKey,title.slice(0,300)||itemKey]);},
  async doneBetween(user:string,source:string,from:string,to:string){return (await pool.query(`SELECT item_key,title,done_at FROM platform.mission_done WHERE user_id=$1 AND source=$2 AND (done_at AT TIME ZONE 'Europe/Berlin')::date BETWEEN $3::date AND $4::date ORDER BY done_at DESC LIMIT 200`,[user,source,from,to])).rows.map(row=>({itemKey:String(row.item_key),title:String(row.title),doneAt:new Date(String(row.done_at)).toISOString()}));},
  async teamFocus(source:string,from:string,to:string){return Number((await pool.query(`SELECT COALESCE(sum(COALESCE(seconds,LEAST(86400,EXTRACT(EPOCH FROM now()-started_at)::integer))),0)::integer AS s FROM platform.mission_focus WHERE source=$1 AND (started_at AT TIME ZONE 'Europe/Berlin')::date BETWEEN $2::date AND $3::date`,[source,from,to])).rows[0].s);},
 };
}
