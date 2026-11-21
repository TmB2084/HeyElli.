import {encryptDraft,decryptDraft,ownEnvelope,type DraftKey} from './crypto.ts';
import type {DraftStorage} from '../kalender/drafts.ts';
export class DraftStorageLockedError extends Error {constructor(){super('Entwurfssicherung ist gesperrt. Bitte erneut anmelden.');}}
export function isDraftStorageLocked(error:unknown){return error instanceof DraftStorageLockedError||error instanceof Error&&error.message==='Entwurfssicherung ist gesperrt. Bitte erneut anmelden.';}
export function donePrefix(keyId:string){return 'heyelli:private-draft-done:v3:'+keyId+':';}
export function secureDraftStorage(raw:DraftStorage,key:DraftKey,owner:string,onChange:()=>void=()=>{}){
 const prefix='heyelli:calendar-draft:v2:'+encodeURIComponent(owner)+':',legacy='heyelli:calendar-drafts:'+owner;
 const allowed=(name:string)=>name.startsWith(prefix)||name===legacy;
 let active=true;
 const requireActive=()=>{if(!active)throw new DraftStorageLockedError();};
 const storage:DraftStorage={
  get length(){return raw.length;},key:index=>raw.key(index),
  getItem(name){requireActive();if(!allowed(name))return null;const value=raw.getItem(name);if(value===null)return null;try{let envelope;try{envelope=JSON.parse(value);}catch{/* Opaque legacy data is preserved encrypted as well. */}if(envelope?.v===3)return decryptDraft(key,name,value);storage.setItem(name,value);return value;}catch{throw Error('Gesicherter Entwurf ist beschädigt. Der ursprüngliche Datensatz wurde erhalten.');}},
  setItem(name,text){requireActive();if(!allowed(name))throw Error('Entwurf gehört nicht zum aktuellen Arbeitsbereich.');raw.setItem(name,encryptDraft(key,name,text));onChange();},
  removeItem(name){requireActive();if(!allowed(name))throw Error('Entwurf gehört nicht zum aktuellen Arbeitsbereich.');if(name!==legacy)raw.setItem(donePrefix(key.keyId)+encodeURIComponent(name),'1');raw.removeItem(name);onChange();}
 };
 return {storage,lock(){active=false;key.key='';},migrate(){
  // Encrypt in place only after a complete successful write. A quota or codec
  // failure leaves the original bytes untouched and prevents editing startup.
  const names=Array.from({length:raw.length},(_,i)=>raw.key(i)).filter((n):n is string=>!!n&&allowed(n));
  for(const name of names){const value=raw.getItem(name);if(value!==null&&!ownEnvelope(value,key.keyId)){let parsed;try{parsed=JSON.parse(value);}catch{/* Preserve malformed source as encrypted opaque bytes. */}if(parsed?.v===3)throw Error('Dieser Entwurf gehört zu einem anderen Benutzerkonto.');storage.setItem(name,value);}}
 }};
}
