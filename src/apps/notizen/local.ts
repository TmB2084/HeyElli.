'use client';
import {assertDraftKey,decryptDraft,encryptDraft,type DraftKey} from '../planboard/entwuerfe/crypto';
import {validNoteBuffer,type NoteBuffer} from './model';
export async function openNoteBuffers(owner:string,signal:AbortSignal){
 const response=await fetch('/api/benutzerkonto/notizen?key=1',{cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])}),value=await response.json();if(!response.ok||value.owner!==owner)throw Error('Geschützte lokale Notizensicherung ist nicht verfügbar.');assertDraftKey(value);const key:DraftKey={keyId:value.keyId,key:value.key},prefix='heyelli:personal-note:v1:'+owner+':';let closed=false,release:(()=>void)|undefined,storageKey=prefix+crypto.randomUUID();
 function valid(){if(closed||signal.aborted)throw Error('Notizensicherung ist gesperrt. Bitte erneut anmelden.');}
 function list(){valid();const copies:{key:string;value:NoteBuffer;envelope:string}[]=[];for(let i=0;i<localStorage.length;i++){const name=localStorage.key(i);if(!name?.startsWith(prefix))continue;const envelope=localStorage.getItem(name);if(!envelope)continue;const value=JSON.parse(decryptDraft(key,name,envelope));if(!validNoteBuffer(value))throw Error('Eine lokale Notizenfassung ist beschädigt und wurde erhalten.');copies.push({key:name,value,envelope});}return copies.sort((a,b)=>b.value.updatedAt.localeCompare(a.value.updatedAt));}
 async function claim(name:string){if(!navigator.locks)throw Error('Dieser Browser kann parallele Notizen nicht sicher trennen.');let ready!:(value:boolean)=>void;const acquired=new Promise<boolean>(r=>{ready=r;});void navigator.locks.request(name,{ifAvailable:true},async lock=>{if(!lock||closed||signal.aborted){ready(false);return;}await new Promise<void>(r=>{release=r;ready(true);});}).catch(()=>ready(false));return acquired;}
 function close(){if(closed)return;closed=true;key.key='';release?.();window.removeEventListener('heyelli:session-invalid',close);}
 signal.addEventListener('abort',close,{once:true});window.addEventListener('heyelli:session-invalid',close);
 try{let restored:NoteBuffer|undefined;for(const candidate of list()){if(await claim(candidate.key)){storageKey=candidate.key;restored=candidate.value;break;}}if(!restored&&!await claim(storageKey))throw Error('Notizensicherung konnte nicht geöffnet werden.');
 return {initial:restored,save(buffer:NoteBuffer){valid();localStorage.setItem(storageKey,encryptDraft(key,storageKey,JSON.stringify(buffer)));},confirmed(buffer:NoteBuffer){valid();const envelope=localStorage.getItem(storageKey);if(envelope&&decryptDraft(key,storageKey,envelope)===JSON.stringify(buffer))localStorage.removeItem(storageKey);},close};
 }catch(error){close();throw error;}
}
