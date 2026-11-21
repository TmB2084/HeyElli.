import {lstat,mkdir,readdir,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {developmentLock} from './dev-lock.mjs';
async function info(path){try{return await lstat(path);}catch(error){if(error.code==='ENOENT')return null;throw error;}}
async function directory(path){const item=await info(path);if(item&&(item.isSymbolicLink()||!item.isDirectory()))throw Error('Entwicklungs-Cache ist kein reguläres Verzeichnis. Keine Daten entfernt.');}
async function lockPath(path){const item=await info(path);if(item&&(!item.isFile()||item.isSymbolicLink()||item.nlink!==1))throw Error('Startsperre ist keine sichere reguläre Datei. Keine Daten entfernt.');return item;}
// The outer lease stays held for the launcher's lifetime, including the gap
// before Next acquires its own lock. Never delete an inode held by another Next.
export async function prepareDevelopmentCache(root){
 const next=resolve(root,'.next'),dev=join(next,'dev'),guardPath=join(next,'heyelli-dev-start.lock'),nextPath=join(dev,'lock');
 await directory(next);await directory(dev);await lockPath(guardPath);await lockPath(nextPath);
 await mkdir(next,{recursive:true});
 const guard=await developmentLock(guardPath);if(!guard)throw Error('Ein HeyElli-Start verwendet dieses Projekt bereits. Keine Daten entfernt.');
 let probe;
 try{
  await directory(next);await directory(dev);await lockPath(nextPath);await mkdir(dev,{recursive:true});
  probe=await developmentLock(nextPath);
  if(!probe)throw Error('Entwicklungsserver verwendet diesen Cache. Zuerst den bestehenden Server beenden; keine Daten entfernt.');
  // Check every top-level entry before changing any cache content. Keep the
  // locked inode until all cleanup is finished; unlinking it earlier is unsafe.
  const entries=await readdir(dev,{withFileTypes:true});
  if(entries.some(entry=>entry.isSymbolicLink()))throw Error('Entwicklungs-Cache enthält symbolische Links. Keine Daten entfernt.');
  for(const entry of entries)if(entry.name!=='lock')await rm(join(dev,entry.name),{recursive:true,force:true});
  probe.release();probe=null;
  return guard;
 }catch(error){probe?.release();guard.release();throw error;}
}
