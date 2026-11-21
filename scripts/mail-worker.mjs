import nextEnv from '@next/env';
import {Pool} from 'pg';
import {databaseConfig} from '../src/platform/store/config.ts';
import {processMailQueue} from '../src/platform/mail/worker.ts';
nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
const pool=new Pool(databaseConfig(process.env));pool.on('error',()=>{});
let stopping=false;for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true;});
console.log('E-Mail-Warteschlangenverarbeitung gestartet.');
while(!stopping){try{await pool.query("INSERT INTO platform.mail_worker_health(id,last_seen) VALUES('central',now()) ON CONFLICT(id) DO UPDATE SET last_seen=now()");await processMailQueue(pool);await pool.query("UPDATE platform.mail_worker_health SET last_seen=now(),last_success=now(),healthy=true WHERE id='central'");}catch{try{await pool.query("UPDATE platform.mail_worker_health SET last_seen=now(),healthy=false WHERE id='central'");}catch{}console.error('E-Mail-Verarbeitung fehlgeschlagen; erneuter Versuch folgt.');}for(let i=0;i<15&&!stopping;i++)await new Promise(resolve=>setTimeout(resolve,1000));}
await pool.end();
