import {existsSync,lstatSync,mkdirSync,readdirSync,readFileSync,openSync,writeFileSync,fsyncSync,closeSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {randomBytes,randomUUID,createCipheriv,createDecipheriv} from 'node:crypto';
import {parseEnv} from 'node:util';
import {PlatformError} from '../store/model.ts';
import {secretRoot,assertSecretCapacity} from './lifecycle.ts';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
// Immutable files are candidates, never an active pointer. PostgreSQL alone
// publishes the reference. An unsuccessful transaction leaves a harmless orphan.
export function encryptedStore(provider:'pds'|'graph'|'sharepoint',legacy:string,keyDirectory:string,variable:string){
 const file=(id?:string|null)=>{if(id!==undefined&&id!==null&&!uuid.test(id))throw new PlatformError('Ungültige Konfigurationsreferenz.',503);return resolve(secretRoot(),id?`.env.${provider}.${id}.local`:legacy);};
 function master(create=false,expectedExisting=false){
  const root=secretRoot(),path=resolve(root,'.local',keyDirectory,'master.key');
  if(!existsSync(/* turbopackIgnore: true */ path)&&create){
   if(expectedExisting||existsSync(/* turbopackIgnore: true */ file())||readdirSync(/* turbopackIgnore: true */ root).some(name=>new RegExp('^\\.env\\.'+provider+'\\.[a-f0-9-]{36}\\.local$','i').test(name)))throw new PlatformError('Master-Schlüssel fehlt. Geschützte Sicherung wiederherstellen lassen; vorhandene Zugangsdaten wurden nicht geändert.',503);
   mkdirSync(dirname(path),{recursive:true,mode:0o700});
   let fd:number|undefined;try{fd=openSync(path,'wx',0o600);writeFileSync(fd,randomBytes(32));fsyncSync(fd);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}finally{if(fd!==undefined)closeSync(fd);}
  }
  try{const info=lstatSync(/* turbopackIgnore: true */ path);if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||(info.mode&0o077))throw Error();const key=readFileSync(/* turbopackIgnore: true */ path);if(key.length!==32)throw Error();return key;}catch{throw new PlatformError('Master-Schlüssel fehlt oder ist nicht sicher lesbar. Geschützte Sicherung prüfen; vorhandene Zugangsdaten wurden nicht geändert.',503);}
 }
 return {
  read(id?:string|null):unknown|null{
   const path=file(id);if(!existsSync(/* turbopackIgnore: true */ path)){if(id)throw new PlatformError('Referenzierte Zugangsdaten fehlen. Geschützte Sicherung wiederherstellen lassen.',503);return null;}
   try{const info=lstatSync(/* turbopackIgnore: true */ path);if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||(info.mode&0o077))throw Error();const raw=parseEnv(readFileSync(/* turbopackIgnore: true */ path,'utf8'))[variable];if(!raw)throw Error();const parts=raw.split('.').map(s=>Buffer.from(s,'base64'));if(parts.length!==3||parts[0].length!==12||parts[1].length!==16)throw Error();const decipher=createDecipheriv('aes-256-gcm',master(),parts[0]);decipher.setAuthTag(parts[1]);return JSON.parse(Buffer.concat([decipher.update(parts[2]),decipher.final()]).toString('utf8'));}catch(error){if(error instanceof PlatformError)throw error;throw new PlatformError('Geschützte Zugangsdaten beschädigt oder nicht entschlüsselbar. Geschützte Sicherung prüfen.',503);}
  },
  save(value:unknown,expectedExisting=false){
   assertSecretCapacity(provider);const key=master(true,expectedExisting),id=randomUUID(),nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce),data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
   const fd=openSync(file(id),'wx',0o600);try{writeFileSync(fd,`${variable}="${[nonce,cipher.getAuthTag(),data].map(b=>b.toString('base64')).join('.')}"\n`);fsyncSync(fd);}finally{closeSync(fd);}return id;
  }
 };
}
