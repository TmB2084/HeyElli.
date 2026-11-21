// Gesundheitsprüfung für Dienste ohne Port (Docker-Healthcheck in compose.server.yaml). Exit 0 = gesund, 1 = nicht gesund.
//   node scripts/health-check.mjs mail-worker        Herzschlag in der Datenbank (platform.mail_worker_health, schreibt der Mail-Worker alle ca. 15 s)
//   node scripts/health-check.mjs assistant-runtime  Herzschlag-Datei (schreibt assistant-runtime.mjs alle ca. 10 s)
// Gibt nie Konfigurationswerte aus.
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {databaseConfig} from '../src/platform/store/config.ts';
import {heartbeatFresh} from './heartbeat.mjs';

export const MAIL_WORKER_SQL="SELECT healthy AND last_seen>now()-interval '120 seconds' AS ok FROM platform.mail_worker_health WHERE id='central'";
export async function mailWorkerHealthy(query){return (await query(MAIL_WORKER_SQL)).rows[0]?.ok===true;}
export async function healthy(target,{query,fresh=heartbeatFresh}={}){
  if(target==='mail-worker')return mailWorkerHealthy(query);
  if(target==='assistant-runtime')return fresh('assistant-runtime',120);
  return false;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const target=process.argv[2];let client=null,ok=false;
  try{
    if(target==='mail-worker'){client=new pg.Client({...databaseConfig(process.env),connectionTimeoutMillis:4000});await client.connect();}
    ok=await healthy(target,{query:sql=>client.query(sql)});
  }catch{ok=false;}
  finally{await client?.end().catch(()=>{});}
  process.exit(ok?0:1);
}
