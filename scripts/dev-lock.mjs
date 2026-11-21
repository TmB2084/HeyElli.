import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let ready;
// Use the same native OS lock as the pinned Next.js version. PID, port, file
// contents and age are not proof of ownership. WASM has no usable lock.
export async function developmentLock(path){
 ready??=(async()=>{const {loadBindings}=require('next/dist/build/swc');const bindings=await loadBindings();const {Lockfile}=require('next/dist/build/lockfile');if(bindings.isWasm||typeof Lockfile?.tryAcquire!=='function')throw Error('Native Startsperren sind nicht verfügbar. Keine Daten entfernt.');return Lockfile;})();
 let Lockfile;try{Lockfile=await ready;}catch{throw Error('Native Startsperren sind nicht verfügbar. Keine Daten entfernt.');}
 const lock=Lockfile.tryAcquire(path,false);
 if(!lock)return null;
 let released=false;
 const release=()=>{if(released)return;released=true;process.off('exit',release);lock.unlockSync();};
 process.once('exit',release);
 return {release};
}
