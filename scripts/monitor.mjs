import {existsSync} from 'node:fs';
import {localStore} from '../src/platform/pds/simulator/order-store.ts';
import {deliverServiceHistory} from '../src/platform/pds/simulator/history-outbox.ts';
// Local independent observer; it never retries mail or business actions.
import {setTimeout as pause} from 'node:timers/promises';
import {monitorLease,monitorAlreadyRunning} from './monitor-lease.mjs';
import {probeWeb,webProbeHost} from '../src/platform/operations/web-probe.ts';
import nextEnv from '@next/env';
import {Pool} from 'pg';
import {databaseConfig} from '../src/platform/store/config.ts';
import {monitorTick} from '../src/platform/operations/probe.ts';
nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
const port=Number(process.env.HEYELLI_MONITOR_PORT??3000);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Ungültiger lokaler Prüfport.');
const host=webProbeHost(process.env.HEYELLI_MONITOR_HOST??'localhost');
const checkOnly=process.argv.includes('--check');
let lease;if(!checkOnly){try{lease=await monitorLease(process.cwd());}catch{console.error('Überwachungssperre nicht verfügbar. Kein zweiter Dienst gestartet.');process.exit(1);}if(!lease){console.log('Überwachungsdienst läuft bereits. Kein zweiter Dienst gestartet.');process.exit(monitorAlreadyRunning);}}
const pool=new Pool({...databaseConfig(process.env),max:1,connectionTimeoutMillis:1500,statement_timeout:2000,query_timeout:2500});pool.on('error',()=>{});
let stopping=false;const shutdown=new AbortController();for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true;shutdown.abort();});
const wait=async ms=>{try{await pause(ms,undefined,{signal:shutdown.signal});}catch{if(!stopping)throw Error('Überwachungswartezeit fehlgeschlagen.');}};
try{
 if(checkOnly){
  const result=await pool.query("SELECT checked_at>now()-interval '90 seconds' AS fresh FROM platform.operation_monitor WHERE id='local'");
  const alarms=await pool.query('SELECT 1 FROM platform.operation_alarms WHERE active LIMIT 1');
  process.exitCode=result.rows[0]?.fresh&&!alarms.rowCount?0:1;console.log(process.exitCode?'Überwachung oder Betriebsbereitschaft gestört.':'Überwachung und Betriebsbereitschaft aktuell.');
 }else{
  // Allow a cold local web start to acquire its listener before raising alarms.
  if(process.argv.includes('--managed')){const deadline=Date.now()+15000;while(!stopping&&Date.now()<deadline&&!await probeWeb(port,host))await wait(200);}
  if(!stopping)console.log('Lokale Überwachung gestartet.');
  const state={};
  while(!stopping){await monitorTick(pool,port,state,undefined,host);
   // Retry only committed history messages, never the underlying business action.
   if(!stopping&&existsSync('.local/pds-simulator/development.sqlite')){let store;try{store=localStore();await deliverServiceHistory(store,pool);}catch{console.error('Ausstehende Historie bleibt gesichert; nächster Versuch im Hintergrund.');}finally{store?.close();}}
   if(!stopping)await wait(30000);
  }
 }
}catch{console.error('Betriebsprüfung nicht verfügbar.');process.exitCode=1;}finally{try{await pool.end();}finally{lease?.release();}}
