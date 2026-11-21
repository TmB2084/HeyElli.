import {createHash} from 'node:crypto';
import {isIP} from 'node:net';
import type {Pool} from 'pg';
import type {LoginAttempt} from '../accounts/index.ts';
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export async function allowLogin(pool:Pool,attempt:LoginAttempt):Promise<boolean>{
 if(!attempt||!['password','microsoft'].includes(attempt.channel)||typeof attempt.account!=='string'||attempt.account.length>200||/[\x00-\x1f\x7f]/.test(attempt.account)||attempt.source!==null&&!isIP(attempt.source))throw Error('Ungültiger Anmeldekontext.');
 const account=attempt.account.normalize('NFKC').trim().toLowerCase();
 // OAuth has no account identity before Microsoft authenticates the user.
 // With no trustworthy source, do not recreate a shared 30-attempt lockout.
 const pair=attempt.channel==='microsoft'&&attempt.source===null?[]:[{scope:'login:v2:pair:'+digest(JSON.stringify([attempt.channel,attempt.source,account])),limit:30}];
 const local=[...pair,...(attempt.source?[{scope:'login:v2:source:'+digest(attempt.source),limit:120}]:[])];
 const global={scope:'login:v2:global',limit:3000},buckets=[...local,global];
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  // Atomic across processes. Locally blocked attempts do not exhaust the global budget.
  await client.query('SELECT pg_advisory_xact_lock(741963284)');
  const {rows}=await client.query("SELECT scope,attempts FROM platform.login_limits WHERE scope=ANY($1::text[]) AND window_start>now()-interval '15 minutes'",[buckets.map(bucket=>bucket.scope)]);
  const counts=new Map(rows.map(row=>[row.scope,Number(row.attempts)]));
  if(buckets.some(bucket=>(counts.get(bucket.scope)??0)>=bucket.limit)){await client.query('COMMIT');return false;}
  await client.query("DELETE FROM platform.login_limits WHERE window_start<=now()-interval '1 hour'");
  for(const bucket of buckets)await client.query("INSERT INTO platform.login_limits(scope,window_start,attempts) VALUES($1,now(),1) ON CONFLICT(scope) DO UPDATE SET attempts=CASE WHEN platform.login_limits.window_start<=now()-interval '15 minutes' THEN 1 ELSE platform.login_limits.attempts+1 END,window_start=CASE WHEN platform.login_limits.window_start<=now()-interval '15 minutes' THEN now() ELSE platform.login_limits.window_start END",[bucket.scope]);
  await client.query('COMMIT');return true;
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
