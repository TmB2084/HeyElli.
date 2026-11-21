'use client';
import {assertDraftKey,decryptDraft,encryptDraft,type DraftKey} from '../../planboard/entwuerfe/crypto';
import {donePrefix} from '../../planboard/entwuerfe/storage';
import {incidentDraftPrefix,isToolDraft,latestToolDrafts,type ToolDraft} from './tool-drafts';
import {stageToolFile,restoreToolFile,removeToolFile} from './tool-draft-files';
const endpoint='/api/benutzerkonto/auftragsentwuerfe';
async function request(path='',body?:unknown){const response=await fetch(endpoint+path,{cache:'no-store',signal:AbortSignal.timeout(15000),...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const value=await response.json();if(!response.ok)throw Error(value.error??'Geschützte Auftragssicherung ist nicht erreichbar.');return value;}
export type ToolDraftSession=Awaited<ReturnType<typeof openToolDrafts>>;
export async function openToolDrafts(signal:AbortSignal,onProblem:(text:string)=>void,preferredBranch?:string){
 const value=await request('?key=1'),owner=value.owner;assertDraftKey(value);if(typeof owner!=='string'||!/^[a-f0-9]{64}$/.test(owner))throw Error('Benutzergebundene Sicherung ist nicht verfügbar.');
 const key:DraftKey={keyId:value.keyId,key:value.key},prefix=incidentDraftPrefix(owner),done=donePrefix(key.keyId);
 const fileIds=new Set<string>();
 let closed=false,release:(()=>void)|undefined,branch='',sequence=0,lastText='',timer:ReturnType<typeof setTimeout>|undefined,running:Promise<void>|undefined;
 function requireOpen(){if(closed||signal.aborted)throw Error('Auftragssicherung ist gesperrt. Bitte erneut anmelden.');}
 function records(){requireOpen();const records:ToolDraft[]=[];for(let i=0;i<localStorage.length;i++){const name=localStorage.key(i);if(!name?.startsWith(prefix)||localStorage.getItem(done+encodeURIComponent(name)))continue;const envelope=localStorage.getItem(name);if(!envelope)continue;const record=JSON.parse(decryptDraft(key,name,envelope));if(!isToolDraft(record)||name!==prefix+record.draftId)throw Error('Eine Auftragssicherung ist beschädigt. Vorhandene Eingaben wurden nicht geändert.');records.push(record);}return records;}
 async function sync(){requireOpen();if(running){await running;return sync();}running=(async()=>{
  const names=Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter((name):name is string=>!!name);
  for(const marker of names.filter(n=>n.startsWith(done+encodeURIComponent(prefix))&&localStorage.getItem(n)==='1')){requireOpen();await request('',{key:decodeURIComponent(marker.slice(done.length)),complete:true});localStorage.setItem(marker,'acked');}
  for(const record of latestToolDrafts(records())){requireOpen();const name=prefix+record.draftId,envelope=localStorage.getItem(name);if(!envelope)continue;const result=await request('',{key:name,envelope});if(result.completed)finishNames([name]);else finishNames(records().filter(item=>item.branchId===record.branchId&&item.sequence<record.sequence).map(item=>prefix+item.draftId));}

 })();try{await running;onProblem('');}finally{running=undefined;}}
 const changed=()=>{clearTimeout(timer);timer=setTimeout(()=>void sync().catch(()=>onProblem('Die zusätzliche Auftragssicherung ist gerade nicht erreichbar. Deine Eingaben bleiben auf diesem Gerät verschlüsselt gesichert.')),400);};
 function finishNames(names:string[]){if(!names.length)return;for(const name of names){localStorage.setItem(done+encodeURIComponent(name),'1');localStorage.removeItem(name);}changed();}
 async function claim(id:string){if(!navigator.locks)throw Error('Dieser Browser kann parallele Auftragserfassungen nicht sicher trennen. Bitte einen aktuellen Browser verwenden.');let resolve!:(claimed:boolean)=>void;const acquired=new Promise<boolean>(r=>{resolve=r;});void navigator.locks.request('heyelli:incident:'+owner+':'+id,{ifAvailable:true},async lock=>{if(!lock||closed||signal.aborted){resolve(false);return;}await new Promise<void>(r=>{release=r;resolve(true);});}).catch(()=>resolve(false));return acquired;}
 function close(){if(closed)return;closed=true;clearInterval(interval);clearTimeout(timer);release?.();key.key='';window.removeEventListener('online',changed);window.removeEventListener('heyelli:session-invalid',close);}
 const interval=setInterval(changed,30000);signal.addEventListener('abort',close,{once:true});window.addEventListener('heyelli:session-invalid',close);window.addEventListener('online',changed);
 try{
  requireOpen();let after='';do{const result=await request('?after='+encodeURIComponent(after));requireOpen();for(const item of result.records){if(!item.key.startsWith(prefix)||localStorage.getItem(done+encodeURIComponent(item.key)))continue;const remote=JSON.parse(decryptDraft(key,item.key,item.envelope));if(!isToolDraft(remote)||item.key!==prefix+remote.draftId)throw Error('Zusätzliche Auftragssicherung ist beschädigt.');const current=localStorage.getItem(item.key);if(current!==null&&decryptDraft(key,item.key,current)!==decryptDraft(key,item.key,item.envelope))throw Error('Abweichende Auftragssicherungen wurden erhalten.');if(current===null)localStorage.setItem(item.key,item.envelope);}after=result.next??'';}while(after);
  const available=latestToolDrafts(records());if(preferredBranch)available.sort((a,b)=>Number(b.branchId===preferredBranch)-Number(a.branchId===preferredBranch));let restored:ToolDraft|undefined;for(const candidate of available){if(await claim(candidate.branchId)){branch=candidate.branchId;sequence=candidate.sequence;restored=candidate;break;}}
  if(!branch){branch=crypto.randomUUID();if(!await claim(branch))throw Error('Auftragserfassung konnte nicht sicher geöffnet werden.');}
  if(restored){lastText=JSON.stringify(restored.state);for(const id of (Array.isArray(restored.state.fileIds)?restored.state.fileIds:[]))if(typeof id==='string')fileIds.add(id);}
  changed();
  return {owner,branchId:branch,initial:restored?.state,branches:available.map(record=>({id:record.branchId,updatedAt:record.updatedAt})),otherCount:available.length-(restored?1:0),
   save(state:Record<string,unknown>){requireOpen();const pending=state.pendingFile as {id?:string}|undefined;if(pending?.id)fileIds.add(pending.id);state={...state,fileIds:[...fileIds]};const text=JSON.stringify(state);if(text.length>100000)throw Error('Auftragssicherung ist zu groß. Vorhandene Sicherungen bleiben erhalten.');if(text===lastText)return;const record:ToolDraft={kind:'incident-tool',version:1,draftId:crypto.randomUUID(),branchId:branch,sequence:++sequence,updatedAt:new Date().toISOString(),state};localStorage.setItem(prefix+record.draftId,encryptDraft(key,prefix+record.draftId,JSON.stringify(record)));lastText=text;
    // Superseded local snapshots stay until their successor is confirmed remotely.
    changed();
   },
   async confirm(){await sync();const own=records().filter(record=>record.branchId===branch).sort((a,b)=>b.sequence-a.sequence);if(own.length>1)finishNames(own.slice(1).map(record=>prefix+record.draftId));},
   stageFile:(id:string,file:File)=>{requireOpen();fileIds.add(id);return stageToolFile(key,owner,branch,id,file);},restoreFile:(id:string)=>{requireOpen();return restoreToolFile(key,owner,branch,id);},complete(){requireOpen();const own=records().filter(record=>record.branchId===branch),files=new Set(own.flatMap(record=>{const file=record.state.pendingFile as {id?:string}|undefined;return [...(file?.id?[file.id]:[]),...(Array.isArray(record.state.fileIds)?record.state.fileIds.filter((id):id is string=>typeof id==='string'):[])];}));finishNames(own.map(record=>prefix+record.draftId));for(const id of files)void removeToolFile(owner,branch,id).catch(()=>onProblem('Bestätigte Auftragssicherung bereinigt; eine verschlüsselte Dateikopie bleibt geschützt auf diesem Gerät.'));lastText='';},close};
 }catch(error){close();throw error;}
}
