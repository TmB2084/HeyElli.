import {lstat,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {developmentLock} from './dev-lock.mjs';
async function check(path,directory){try{const item=await lstat(path);if(item.isSymbolicLink()||(directory?!item.isDirectory():!item.isFile()||item.nlink!==1))throw Error('Unsichere Überwachungssperre. Keine Dateien verändert.');}catch(error){if(error.code!=='ENOENT')throw error;}}
// Same native operating-system lease as the pinned Next version. Never remove
// an apparently old lock or trust a PID/port. Keep it outside .next/dev cleanup.
export async function monitorLease(root){
 const local=resolve(root,'.local'),directory=join(local,'operations-runtime'),path=join(directory,'monitor.lock');
 await check(local,true);await check(directory,true);await check(path,false);
 await mkdir(directory,{recursive:true,mode:0o700});await check(local,true);await check(directory,true);await check(path,false);
 return developmentLock(path);
}
export const monitorAlreadyRunning=75;
