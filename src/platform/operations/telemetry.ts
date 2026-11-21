import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {databaseConfig} from '../store/config.ts';
import {metricArea} from './model.ts';
const state=globalThis as typeof globalThis & {heyelliTelemetry?:{pool:Pool;pending:number}};
export function observeResponse(path:string,method:string,response:Response,started:number){
 const id=randomUUID(),milliseconds=Math.max(0,Math.min(60000,Math.round(performance.now()-started))),area=metricArea(path);
 const headers=new Headers(response.headers);headers.set('X-HeyElli-Request-ID',id);
 if(response.status>=500)console.error(JSON.stringify({kind:'heyelli.request',at:new Date().toISOString(),id,area,method:['GET','POST','PUT','PATCH','DELETE'].includes(method)?method:'other',status:response.status,durationMs:milliseconds}));
 // A separate bounded pool prevents unavailable telemetry from consuming business connections.
 try{if(!state.heyelliTelemetry){const pool=new Pool({...databaseConfig(process.env),max:1,connectionTimeoutMillis:500,statement_timeout:500});pool.on('error',()=>{});state.heyelliTelemetry={pool,pending:0};}
  const metrics=state.heyelliTelemetry;if(metrics.pending<16){metrics.pending++;void metrics.pool.query(`WITH expired AS (DELETE FROM platform.operation_metrics WHERE minute<now()-interval '24 hours') INSERT INTO platform.operation_metrics(minute,area,requests,failures,slow,duration_ms) VALUES(date_trunc('minute',now()),$1,1,$2,$3,$4) ON CONFLICT(minute,area) DO UPDATE SET requests=LEAST(operation_metrics.requests+1,1000000),failures=LEAST(operation_metrics.failures+$2,1000000),slow=LEAST(operation_metrics.slow+$3,1000000),duration_ms=LEAST(operation_metrics.duration_ms+$4,60000000000)`,[area,response.status>=500?1:0,milliseconds>=3000?1:0,milliseconds]).catch(()=>{}).finally(()=>{metrics.pending--;});}
 }catch{/* Telemetry never changes the business response. */}
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
