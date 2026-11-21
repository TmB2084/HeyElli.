import {spawn} from 'node:child_process';
import {prepareDevelopmentCache} from './dev-cache.mjs';
import {developmentArgs,developmentPort,developmentWebArgs,developmentMonitorHost} from './dev-options.mjs';
import {stopChild,superviseService} from './dev-services.mjs';
import {monitorAlreadyRunning} from './monitor-lease.mjs';
// Validate before starting workers or opening any port.
let options,port,host;try{options=developmentArgs(process.argv.slice(2));options.args=developmentWebArgs(options.args);port=developmentPort(options.args);host=developmentMonitorHost(options.args);}catch(error){console.error(error.message);process.exit(1);}
if(options.lan)console.warn('HeyElli: ausdrücklich gestarteter LAN-Testmodus. Nur in einem vertrauenswürdigen Testnetz verwenden; ohne vorgeschalteten vertrauenswürdigen Proxy bleibt die Anmeldequelle unbekannt.');
// Hold the outer native lease until all owned children have actually stopped.
const guard=await prepareDevelopmentCache(process.cwd());
let stopping=false;
const assistant=spawn(process.execPath,['scripts/assistant-runtime.mjs'],{stdio:'inherit'});assistant.on('error',()=>console.error('Elli: Anbietersteuerung konnte nicht gestartet werden.'));
const web=spawn(process.execPath,['node_modules/next/dist/bin/next','dev',...options.args],{stdio:'inherit'});
const worker=superviseService(()=>spawn(process.execPath,['scripts/mail-worker.mjs'],{stdio:'inherit'}),{message:'Maildienst wird neu gestartet.',graceMs:Infinity});
const monitor=superviseService(()=>spawn(process.execPath,['scripts/monitor.mjs','--managed'],{stdio:'inherit',env:{...process.env,HEYELLI_MONITOR_PORT:String(port),HEYELLI_MONITOR_HOST:host}}),{message:'Überwachungsdienst wird neu gestartet.',alreadyRunningCode:monitorAlreadyRunning});
async function stop(code=0){if(stopping)return;stopping=true;process.exitCode=code;await Promise.allSettled([stopChild(web,Infinity),worker.stop(),monitor.stop(),stopChild(assistant,Infinity)]);guard.release();}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void stop());
web.on('error',()=>void stop(1));web.on('exit',code=>void stop(code??1));
