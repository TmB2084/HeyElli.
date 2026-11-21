import type {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {ResourceError,resourceLimits as limits} from './model.ts';
export function resourceBudgets(pool:Pool){return {
 async acquire(actor:string,kind:'normal'|'heavy'|'export'){
  const client=await pool.connect(),id=randomUUID();try{await client.query('BEGIN');
   await client.query("SELECT pg_advisory_xact_lock(hashtextextended('heyelli:request-budget',0))");
   if(!(await client.query('SELECT 1 FROM platform.users WHERE id=$1 AND enabled',[actor])).rowCount)throw new ResourceError('Bitte zuerst anmelden.',401);
   const rows=(await client.query('SELECT user_id,kind,count(*)::int AS n FROM platform.resource_leases WHERE expires_at>now() GROUP BY user_id,kind')).rows;
   const count=(owner?:string,type?:string)=>rows.filter(r=>(!owner||r.user_id===owner)&&(!type||r.kind===type)).reduce((n,r)=>n+r.n,0);
   if(count()>=limits.active||count(actor)>=limits.userActive||kind==='heavy'&&(count(undefined,'heavy')>=limits.heavyActive||count(actor,'heavy')>=limits.userHeavy)||kind==='export'&&(count(undefined,'export')>=limits.exports||count(actor,'export')>=limits.userExports))throw new ResourceError('Gerade sind zu viele Anfragen aktiv. Eingaben bleiben erhalten; bitte kurz warten.');
   const windows:[string,number,string|null][]=[['global',limits.globalPerMinute,null],['user:'+actor,limits.perMinute,actor]];if(kind!=='normal')windows.push(['heavy:global',limits.globalHeavyPerMinute,null],['heavy:'+actor,limits.heavyPerMinute,actor]);
   for(const[scope,max,user]of windows){const row=(await client.query("SELECT requests,window_start>now()-interval '1 minute' AS current FROM platform.resource_windows WHERE scope=$1",[scope])).rows[0];if(row?.current&&row.requests>=max)throw new ResourceError('Anfragebudget erreicht. Eingaben bleiben erhalten; bitte kurz warten.');await client.query("INSERT INTO platform.resource_windows(scope,user_id,requests) VALUES($1,$2,1) ON CONFLICT(scope) DO UPDATE SET requests=CASE WHEN platform.resource_windows.window_start>now()-interval '1 minute' THEN platform.resource_windows.requests+1 ELSE 1 END,window_start=CASE WHEN platform.resource_windows.window_start>now()-interval '1 minute' THEN platform.resource_windows.window_start ELSE now() END",[scope,user]);}
   // Only transient expired admission tokens, never drafts or business records.
   await client.query('DELETE FROM platform.resource_leases WHERE expires_at<=now()');
   await client.query("INSERT INTO platform.resource_leases VALUES($1,$2,$3,now()+interval '10 minutes')",[id,actor,kind]);await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  let released=false;return async()=>{if(released)return;for(let attempt=0;;attempt++){try{await pool.query('DELETE FROM platform.resource_leases WHERE id=$1 AND user_id=$2',[id,actor]);released=true;return;}catch(error){if(attempt>=3)throw error;await new Promise(resolve=>setTimeout(resolve,25*(attempt+1)));}}};
 },
};}
