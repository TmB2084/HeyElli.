import {spawn,spawnSync} from 'node:child_process';
import {readdirSync,readFileSync} from 'node:fs';
import {once} from 'node:events';
const owned=new WeakMap(),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function groupAlive(id){
 // kill(group, 0) can report EPERM for an already exiting group on macOS.
 // Inspect actual group membership instead; exited zombies cannot write files.
 if(process.platform==='linux'){
  for(const pid of readdirSync('/proc').filter(name=>/^\d+$/.test(name))){
   let text;try{text=readFileSync('/proc/'+pid+'/stat','utf8');}catch(error){if(error.code==='ENOENT'||error.code==='ESRCH')continue;throw error;}
   const fields=text.slice(text.lastIndexOf(')')+2).trim().split(/\s+/);
   if(Number(fields[2])===id&&fields[0]!=='Z')return true;
  }
  return false;
 }
 const result=spawnSync('ps',['-axo','pid=,pgid=,stat='],{encoding:'utf8'});
 if(result.status!==0)throw Error('Eigene Prüfprozessgruppe kann nicht sicher geprüft werden.');
 return result.stdout.split('\n').some(line=>{const fields=line.trim().split(/\s+/);return Number(fields[1])===id&&!!fields[2]&&!fields[2].startsWith('Z');});
}
// Dedicated POSIX process groups keep fixture children separate from live instances.
export function spawnTestProcess(command,args,options={}){
 if(process.platform==='win32')throw Error('Die isolierte Prozessgruppenprüfung benötigt macOS oder Linux.');
 const child=spawn(command,args,{...options,detached:true});owned.set(child,{});return child;
}
export function stopTestProcess(child,{graceMs=10000}={}){
 if(!child)return Promise.resolve();const state=owned.get(child);if(!state)throw Error('Fremder Prüfprozess wird nicht beendet.');
 return state.stopping??=(async()=>{
  if(!Number.isSafeInteger(child.pid))return;
  const closed=child.exitCode===null&&child.signalCode===null?once(child,'close'):Promise.resolve();
  const signal=value=>{try{process.kill(-child.pid,value);}catch(error){if(error.code!=='ESRCH'&&!(error.code==='EPERM'&&!groupAlive(child.pid)))throw error;}};
  const alive=()=>groupAlive(child.pid);
  signal('SIGTERM');let deadline=Date.now()+graceMs;
  while(alive()&&Date.now()<deadline)await pause(25);
  if(alive()){signal('SIGKILL');deadline=Date.now()+5000;while(alive()&&Date.now()<deadline)await pause(25);}
  if(alive())throw Error('Eigene Prüfprozessgruppe ist noch nicht vollständig beendet. Prüfdateien erhalten.');
  await closed;
 })();
}
