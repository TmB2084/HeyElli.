import {assertSecretCapacity} from '../secret-retention/server.ts';
import {existsSync,readdirSync,lstatSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {randomBytes,randomUUID,createCipheriv,createDecipheriv} from 'node:crypto';
import {parseEnv} from 'node:util';
import {PlatformError} from '../store/model.ts';
import {settingsDirectory} from '../server-operation/index.ts';
export type BmaConfig={baseUrl:string;token:string};
function root(){if(process.env.APP_ENV==='test'){if(!process.env.HEYELLI_TEST_SETTINGS_DIR)throw Error('Isolated settings required');return resolve(process.env.HEYELLI_TEST_SETTINGS_DIR);}return settingsDirectory();}
function master(create=false){const path=resolve(root(),'.local/bmacloud-secrets/master.key');if(create&&!existsSync(/* turbopackIgnore: true */ path)){if(readdirSync(/* turbopackIgnore: true */ root()).some(name=>/^\.env\.bmacloud\.[a-f0-9-]{36}\.local$/i.test(name)))throw new PlatformError('Master-Schlüssel fehlt. Geschützte Sicherung wiederherstellen lassen; vorhandene Zugangsdaten wurden nicht geändert.',503);mkdirSync(dirname(path),{recursive:true,mode:0o700});try{writeFileSync(path,randomBytes(32),{flag:'wx',mode:0o600});}catch(error){if(!existsSync(/* turbopackIgnore: true */ path))throw error;}}const info=lstatSync(/* turbopackIgnore: true */ path);if(!info.isFile()||info.isSymbolicLink()||(info.mode&0o077))throw Error('Unsafe key');const key=readFileSync(/* turbopackIgnore: true */ path);if(key.length!==32)throw Error('Invalid key');return key;}
export function validateConfig(input:unknown):BmaConfig{
 const v=input as BmaConfig;if(!v||typeof v.baseUrl!=='string'||v.baseUrl.length>1000||typeof v.token!=='string'||!v.token||v.token.length>6000||/[\s\x00-\x1f\x7f]/.test(v.token))throw new PlatformError('BMACloud-Adresse und API-Token prüfen.');
 let url:URL;try{url=new URL(v.baseUrl);}catch{throw new PlatformError('Gültige BMACloud-HTTPS-Adresse erforderlich.');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||/[\\\x00-\x20\x7f]/.test(v.baseUrl))throw new PlatformError('BMACloud erfordert HTTPS ohne Zugangsdaten, Suchparameter oder Fragment.');
 if(/\/(api|portal\.php)(\/|$)/i.test(url.pathname))throw new PlatformError('Adresse der BMACloud-Installation eingeben, ohne /api/v2 oder portal.php.');
 return {baseUrl:url.href.replace(/\/+$/,'')+'/',token:v.token};
}
function file(id:string){if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('Invalid configuration');return resolve(root(),`.env.bmacloud.${id}.local`);}
export function saveConfig(input:unknown){const config=validateConfig(input);assertSecretCapacity('bmacloud');const id=randomUUID(),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',master(true),iv),data=Buffer.concat([cipher.update(JSON.stringify(config),'utf8'),cipher.final()]);writeFileSync(file(id),'BMACLOUD_ENCRYPTED_CONFIG="'+[iv,cipher.getAuthTag(),data].map(v=>v.toString('base64url')).join('.')+'"\n',{flag:'wx',mode:0o600});return id;}
export function readConfig(id:string):BmaConfig{try{const path=file(id),info=lstatSync(/* turbopackIgnore: true */ path);if(!info.isFile()||info.isSymbolicLink()||(info.mode&0o077))throw Error();const raw=parseEnv(readFileSync(/* turbopackIgnore: true */ path,'utf8')).BMACLOUD_ENCRYPTED_CONFIG;if(!raw)throw Error();const [iv,tag,data,...extra]=raw.split('.').map(v=>Buffer.from(v,'base64url'));if(extra.length||iv.length!==12||tag.length!==16)throw Error();const cipher=createDecipheriv('aes-256-gcm',master(),iv);cipher.setAuthTag(tag);return validateConfig(JSON.parse(Buffer.concat([cipher.update(data),cipher.final()]).toString('utf8')));}catch{throw new PlatformError('Geschützte BMACloud-Zugangsdaten nicht lesbar. Einrichtung prüfen.',503);}}
