import type {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {PlatformError} from '../store/model.ts';
import {evaluate,diagnostic,alarmLabels,type AlarmCode,type Sample} from './model.ts';
export async function publishSample(pool:Pool,sample:Sample,emit:(line:string)=>void=console.error,incidentIds:Partial<Record<AlarmCode,string>>={}){
 const active=new Set(evaluate(sample)),client=await pool.connect(),events:string[]=[];
 try{await client.query('BEGIN');await client.query("SELECT pg_advisory_xact_lock(hashtextextended('heyelli:operations',0))");
  for(const code of Object.keys(alarmLabels) as AlarmCode[]){if(code==='monitor')continue;const prior=(await client.query('SELECT * FROM platform.operation_alarms WHERE code=$1',[code])).rows[0];
   if(active.has(code)){
    const id=prior?.active?prior.incident_id:incidentIds[code]??randomUUID();
    await client.query(`INSERT INTO platform.operation_alarms(code,active,incident_id,first_seen,last_seen) VALUES($1,true,$2,now(),now()) ON CONFLICT(code) DO UPDATE SET active=true,incident_id=$2,first_seen=CASE WHEN operation_alarms.active THEN operation_alarms.first_seen ELSE now() END,last_seen=now(),resolved_at=NULL,occurrences=LEAST(operation_alarms.occurrences+1,1000000),acknowledged_by=CASE WHEN operation_alarms.active THEN operation_alarms.acknowledged_by ELSE NULL END,acknowledged_at=CASE WHEN operation_alarms.active THEN operation_alarms.acknowledged_at ELSE NULL END`,[code,id]);
    if(!prior?.active)events.push(diagnostic(code,id,'raised'));
   }else if(prior?.active){await client.query('UPDATE platform.operation_alarms SET active=false,resolved_at=now() WHERE code=$1',[code]);events.push(diagnostic(code,prior.incident_id,'recovered'));}
  }
  await client.query("INSERT INTO platform.operation_monitor VALUES('local',now(),$1::jsonb) ON CONFLICT(id) DO UPDATE SET checked_at=now(),snapshot=$1::jsonb",[JSON.stringify(sample)]);
  // Only this newly introduced aggregate telemetry has rolling retention.
  await client.query("DELETE FROM platform.operation_metrics WHERE minute<now()-interval '24 hours'");await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 for(const event of events)emit(event);return [...active];
}
export function operationsStore(pool:Pool){return {
 async read(actor:string){const client=await pool.connect();try{await client.query('BEGIN');const user=(await client.query('SELECT role,enabled FROM platform.users WHERE id=$1 FOR SHARE',[actor])).rows[0];if(!user?.enabled||user.role!=='admin')throw new PlatformError('Administratorrechte erforderlich.',403);
  const monitor=(await client.query("SELECT checked_at,snapshot,checked_at>now()-interval '90 seconds' AS fresh FROM platform.operation_monitor WHERE id='local'")).rows[0]??null;
  const alarms=(await client.query('SELECT code,active,incident_id,first_seen,last_seen,resolved_at,occurrences,acknowledged_at FROM platform.operation_alarms ORDER BY active DESC,last_seen DESC LIMIT 20')).rows;
  await client.query('COMMIT');return {monitor,alarms};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}},
 async acknowledge(actor:string,id:unknown){if(typeof id!=='string'||! /^[a-f0-9-]{36}$/i.test(id))throw new PlatformError('Ungültige Alarmkennung.');const client=await pool.connect();try{await client.query('BEGIN');const user=(await client.query('SELECT role,enabled FROM platform.users WHERE id=$1 FOR SHARE',[actor])).rows[0];if(!user?.enabled||user.role!=='admin')throw new PlatformError('Administratorrechte erforderlich.',403);
  const result=await client.query('UPDATE platform.operation_alarms SET acknowledged_by=$1,acknowledged_at=now() WHERE incident_id=$2 AND active AND acknowledged_at IS NULL RETURNING code',[actor,id]);
  if(result.rowCount)await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id) VALUES($1,'operations.acknowledged',$2)",[actor,id]);
  await client.query('COMMIT');return {acknowledged:!!result.rowCount};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
};}
