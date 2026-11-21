import {secureDraftStorage,donePrefix} from './storage.ts';
import {ownEnvelope,decryptDraft,assertDraftKey,type DraftKey} from './crypto.ts';
import {listDrafts} from '../kalender/drafts.ts';
import type {DraftStorage} from '../kalender/drafts.ts';
type Session={key:DraftKey;store:ReturnType<typeof secureDraftStorage>;stop:()=>void};
let active:Session|undefined;
export function lockPrivateDrafts(){active?.stop();active?.store.lock();active=undefined;}
class DraftSyncError extends Error{status:number;constructor(message:string,status:number){super(message);this.status=status;}}
async function json(path:string,options?:RequestInit){const response=await fetch(path,{...options,cache:'no-store',signal:AbortSignal.timeout(20000)}),value=await response.json();if(!response.ok){if(response.status===401||response.status===403)window.dispatchEvent(new Event('heyelli:session-change'));throw new DraftSyncError(value.error??'Zusätzliche Entwurfssicherung nicht erreichbar.',response.status);}return value;}
export async function openPrivateDrafts(owner:string,signal:AbortSignal,onProblem:(text:string)=>void,onRestored:()=>void):Promise<DraftStorage>{
 const key=await json('/api/ressourcenkalender/entwuerfe?key=1');assertDraftKey(key);if((key as DraftKey&{owner?:string}).owner!==owner)throw Error('Benutzer oder Datenquelle wurde gewechselt. Entwurfsschutz erneut öffnen.');if(signal.aborted)throw new DOMException('Abgebrochen','AbortError');lockPrivateDrafts();
 let stopped=false,running=false,restoring=false,lastRestored=0,syncFailures=0,restoreFailures=0,timer:ReturnType<typeof setTimeout>|undefined;
 const raw=localStorage,done=donePrefix(key.keyId),backed=new Map<string,string>();
 const changed=()=>{clearTimeout(timer);timer=setTimeout(()=>void cycle(true),350);};
 const store=secureDraftStorage(raw,key,owner,changed);
 function stop(){stopped=true;clearTimeout(timer);clearInterval(interval);window.removeEventListener('online',changed);window.removeEventListener('heyelli:session-invalid',lockPrivateDrafts);}
 async function sync(){if(stopped||running||signal.aborted)return;running=true;try{
  store.migrate();listDrafts(store.storage,owner);
  const names=Array.from({length:raw.length},(_,i)=>raw.key(i)).filter((name):name is string=>!!name);
  for(const name of names.filter(n=>n.startsWith(done)&&raw.getItem(n)==='1')){if(stopped)return;const storageKey=decodeURIComponent(name.slice(done.length));await json('/api/ressourcenkalender/entwuerfe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:storageKey,complete:true})});raw.setItem(name,'acked:'+Date.now());/* Keep acknowledgement markers: delayed tabs must not restore old branches. */}
  for(const name of names.filter(n=>n.startsWith('heyelli:calendar-draft:v2:'))){if(stopped)return;const envelope=raw.getItem(name);if(!envelope||!ownEnvelope(envelope,key.keyId)||backed.get(name)===envelope)continue;const value=await json('/api/ressourcenkalender/entwuerfe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:name,envelope})});backed.set(name,envelope);if(value.completed&&raw.getItem(name)===envelope)raw.removeItem(name);}
 syncFailures=0;if(!restoreFailures)onProblem('');
 }catch(error){syncFailures++;if(!stopped&&navigator.onLine&&(syncFailures>=3||error instanceof DraftSyncError&&[400,409,413].includes(error.status)))onProblem(error instanceof Error?error.message:'Zusätzliche Sicherung derzeit nicht verfügbar. Entwürfe bleiben verschlüsselt auf diesem Gerät.');}finally{running=false;}}
 const interval=setInterval(()=>void cycle(false),30000);window.addEventListener('online',changed);window.addEventListener('heyelli:session-invalid',lockPrivateDrafts);
 active={key,store,stop};try{store.migrate();listDrafts(store.storage,owner);}catch(error){lockPrivateDrafts();throw error;}
 async function restore(force=false){if(stopped||restoring||!force&&Date.now()-lastRestored<60000)return;restoring=true;try{let after='';do{if(stopped||signal.aborted)return;const result=await json('/api/ressourcenkalender/entwuerfe?after='+encodeURIComponent(after));for(const item of result.records){if(stopped)return;if(raw.getItem(done+encodeURIComponent(item.key)))continue;if(!ownEnvelope(item.envelope,key.keyId))throw Error('Zusätzliche Entwurfssicherung ist beschädigt.');decryptDraft(key,item.key,item.envelope);const local=raw.getItem(item.key);if(local===null)raw.setItem(item.key,item.envelope);else{try{decryptDraft(key,item.key,local);}catch{raw.setItem('heyelli:private-corrupt:v3:'+key.keyId+':'+crypto.randomUUID(),local);raw.setItem(item.key,item.envelope);}}}after=result.next??'';}while(after);lastRestored=Date.now();restoreFailures=0;if(!stopped){onRestored();if(!syncFailures)onProblem('');}}catch(error){restoreFailures++;if(!stopped&&restoreFailures>=3)onProblem(error instanceof Error?error.message:'Wiederherstellung wird erneut versucht.');}finally{restoring=false;}}
 async function cycle(force:boolean){await sync();await restore(force);}
 void cycle(true);
 signal.addEventListener('abort',()=>{if(active?.store===store)lockPrivateDrafts();},{once:true});return store.storage;
}
export async function backupDeviceDrafts(){
 const status=await json('/api/benutzerkonto/geraet');
 const ownerKeys=Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter((name):name is string=>!!name&&(name==='heyelli:calendar-drafts:'+status.owner||(name.startsWith('heyelli:calendar-draft:v2:'+encodeURIComponent(status.owner)+':')||name.startsWith('heyelli:incident-draft:v1:'+encodeURIComponent(status.owner)+':'))));
 if(ownerKeys.some(name=>{const value=localStorage.getItem(name);return value&&!ownEnvelope(value,status.keyId);})){const key=await json('/api/ressourcenkalender/entwuerfe?key=1');assertDraftKey(key);if(key.keyId!==status.keyId||(key as DraftKey&{owner?:string}).owner!==status.owner)throw Error('Benutzer wurde gewechselt. Es wurde nichts entfernt.');const legacy=secureDraftStorage(localStorage,key,status.owner);legacy.migrate();listDrafts(legacy.storage,status.owner);}
 const raw=localStorage,keys=Array.from({length:raw.length},(_,i)=>raw.key(i)).filter((k):k is string=>!!k),done=donePrefix(status.keyId),copies:{key:string;value:string}[]=[];
 for(const marker of keys.filter(k=>k.startsWith(done)&&raw.getItem(k)==='1'))await json('/api/benutzerkonto/geraet',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:decodeURIComponent(marker.slice(done.length)),complete:true})});
 for(const name of keys.filter(k=>k.startsWith('heyelli:calendar-draft:v2:')||k.startsWith('heyelli:incident-draft:v1:'))){const envelope=raw.getItem(name);if(envelope&&ownEnvelope(envelope,status.keyId)){await json('/api/benutzerkonto/geraet',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:name,envelope})});copies.push({key:name,value:envelope});}}
 return {copies,keyId:status.keyId};
}
export function removeConfirmedDeviceCopies(confirmed:Awaited<ReturnType<typeof backupDeviceDrafts>>){
 // Never remove a branch written while backup or confirmation was pending.
 for(const item of confirmed.copies)if(localStorage.getItem(item.key)===item.value)localStorage.removeItem(item.key);
 window.dispatchEvent(new Event('heyelli:session-invalid'));localStorage.setItem('heyelli:session-ended',crypto.randomUUID());
}
