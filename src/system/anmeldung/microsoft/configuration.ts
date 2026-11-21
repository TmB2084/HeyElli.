import {existsSync,readFileSync,writeFileSync,mkdirSync,lstatSync,renameSync,unlinkSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {randomBytes,randomUUID,createCipheriv,createDecipheriv} from 'node:crypto';
import {parseEnv} from 'node:util';
import {PlatformError} from '../../../platform/store/model.ts';
import {settingsDirectory} from '../../../platform/server-operation/index.ts';
export type MicrosoftAuthConfig={tenantId:string;clientId:string;secret:string;redirectUri:string;configId:string};
export const isUUID=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
function paths(){const root=process.env.APP_ENV==='test'?process.env.HEYELLI_TEST_SETTINGS_DIR:settingsDirectory();if(!root)throw new Error('Isolated storage required');return {file:resolve(root,'.env.microsoft-auth.ui.local'),pending:resolve(root,'.env.microsoft-auth.pending.local'),previous:resolve(root,'.env.microsoft-auth.previous.local'),key:resolve(root,'.local/microsoft-auth-secrets/master.key')};}
function master(create=false){const path=paths().key;if(create&&!existsSync(/* turbopackIgnore: true */ path)){mkdirSync(dirname(path),{recursive:true,mode:0o700});try{writeFileSync(path,randomBytes(32),{flag:'wx',mode:0o600});}catch(error){if(!existsSync(/* turbopackIgnore: true */ path))throw error;}}const info=lstatSync(/* turbopackIgnore: true */ path);if(!info.isFile()||info.isSymbolicLink()||(info.mode&0o077))throw Error('Unsafe key');const key=readFileSync(/* turbopackIgnore: true */ path);if(key.length!==32)throw Error('Invalid key');return key;}

export function validateConfig(input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new PlatformError('Microsoft-Anmeldedaten fehlen.');const v=input as Record<string,unknown>;
 if(!isUUID(v.tenantId)||!isUUID(v.clientId)||typeof v.secret!=='string'||!v.secret.trim()||v.secret.length>2048||/[\x00-\x1f]/.test(v.secret)||typeof v.redirectUri!=='string'||v.redirectUri.length>1000)throw new PlatformError('Tenant-ID, Client-ID, Secret-Wert und Rücksprungadresse prüfen.');
 let uri:URL;try{uri=new URL(v.redirectUri);}catch{throw new PlatformError('Gültige Rücksprungadresse erforderlich.');}
 if(uri.username||uri.password||uri.search||uri.hash||uri.pathname!=='/api/auth/microsoft/callback'||uri.protocol!=='https:'&&!(uri.protocol==='http:'&&uri.hostname==='localhost'))throw new PlatformError('HTTPS-Rücksprungadresse mit /api/auth/microsoft/callback verwenden; HTTP ist nur für localhost erlaubt.');
 return {tenantId:v.tenantId.toLowerCase(),clientId:v.clientId.toLowerCase(),secret:v.secret,redirectUri:uri.href};
}
export function seal(value:unknown){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',master(true),iv),encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),encrypted].map(part=>part.toString('base64url')).join('.');}
export function unseal(value:string){const parts=value.split('.').map(part=>Buffer.from(part,'base64url'));if(parts.length!==3||parts[0].length!==12||parts[1].length!==16)throw Error('Invalid encrypted data');const cipher=createDecipheriv('aes-256-gcm',master(),parts[0]);cipher.setAuthTag(parts[1]);return JSON.parse(Buffer.concat([cipher.update(parts[2]),cipher.final()]).toString('utf8'));}
function writeConfig(file:string,value:MicrosoftAuthConfig){const temp=file+'.'+randomUUID()+'.tmp';try{writeFileSync(temp,`MS_AUTH_ENCRYPTED_CONFIG="${seal(value)}"\n`,{flag:'wx',mode:0o600});renameSync(temp,file);}finally{if(existsSync(/* turbopackIgnore: true */ temp))unlinkSync(temp);}}
function readFileConfig(path:string):MicrosoftAuthConfig|null{if(!existsSync(/* turbopackIgnore: true */ path))return null;try{const info=lstatSync(/* turbopackIgnore: true */ path);if(!info.isFile()||info.isSymbolicLink()||(info.mode&0o077))throw Error();const raw=parseEnv(readFileSync(/* turbopackIgnore: true */ path,'utf8')).MS_AUTH_ENCRYPTED_CONFIG;if(!raw)throw Error();const value=unseal(raw);if(!isUUID(value.configId))throw Error();return {...validateConfig(value),configId:value.configId};}catch{throw new PlatformError('Geschützte Microsoft-Anmeldekonfiguration nicht lesbar.',503);}}
export function hasPendingConfig(){return existsSync(/* turbopackIgnore: true */ paths().pending);}
export function readSavedConfig(){return readFileConfig(paths().file);}
export function readConfig():MicrosoftAuthConfig|null{return hasPendingConfig()?readFileConfig(paths().pending):readSavedConfig();}
export function saveConfig(input:unknown,configId:string){const value={...validateConfig(input),configId};if(!isUUID(configId))throw new PlatformError('Konfigurationskennung ungültig.');const previous=readSavedConfig();writeConfig(previous?paths().pending:paths().file,value);}
// A replacement becomes the saved baseline only after the full interactive test.
export function promoteConfig(expected:string){const current=readConfig();if(current?.configId!==expected)throw new PlatformError('Konfiguration wurde geändert.',409);if(!hasPendingConfig())return;const previous=readSavedConfig();if(previous)writeConfig(paths().previous,previous);renameSync(paths().pending,paths().file);}
export function restoreSavedConfig(expected:string){const current=readConfig(),saved=readSavedConfig();if(!hasPendingConfig()||!saved||current?.configId!==expected)throw new PlatformError('Keine passenden vorherigen Zugangsdaten verfügbar.',409);unlinkSync(paths().pending);return saved;}
