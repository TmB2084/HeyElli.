import nextEnv from '@next/env';
import {Pool} from 'pg';
import {spawn} from 'node:child_process';
import {databaseConfig} from '../src/platform/store/config.ts';
import {selectedAssistantProvider} from '../src/apps/askelli/elli/provider-policy.ts';
import {reconcileLocalAssistant} from './assistant-runtime-state.mjs';
import {beat} from './heartbeat.mjs';
nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
const pool=new Pool(databaseConfig(process.env));pool.on('error',()=>{});
let stopping=false,child=null,previous='';
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true;child?.kill('SIGTERM');});
while(!stopping){try{
 const row=(await pool.query("SELECT enabled FROM platform.copilot_settings WHERE id='central'")).rows[0],provider=selectedAssistantProvider(row?.enabled);
 if(stopping)break;
 if(child&&(child.exitCode!==null||child.signalCode!==null))child=null;
 child=await reconcileLocalAssistant(provider,child,{
  reachable:async()=>{try{return (await fetch((process.env.OLLAMA_BASE_URL||'http://127.0.0.1:11434').replace(/\/$/,'')+'/api/tags',{signal:AbortSignal.timeout(1200)})).ok;}catch{return false;}},
  start:()=>{if(stopping)return null;const created=spawn(process.execPath,['scripts/local-assistant.mjs'],{stdio:'inherit'});const clear=()=>{if(child===created)child=null;};created.on('exit',clear);created.on('error',clear);return created;},
  stop:owned=>owned.kill('SIGTERM')
 });
 if(provider!==previous){console.log(provider==='ollama'?'Elli nutzt lokales Ollama.':'Elli nutzt Copilot; lokale KI wird nicht benötigt.');previous=provider;}
 }catch{if(previous!=='unavailable')console.error('Elli: Anbieterstatus nicht erreichbar; erneute Prüfung folgt.');previous='unavailable';}
 beat('assistant-runtime'); // Herzschlag für die Gesundheitsprüfung (scripts/health-check.mjs)
 for(let i=0;i<3&&!stopping;i++)await new Promise(resolve=>setTimeout(resolve,1000));
}
child?.kill('SIGTERM');await pool.end();
