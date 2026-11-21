import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseEnv} from 'node:util';
import {PlatformError} from '../store/model.ts';
import {encryptedStore} from '../secret-retention/encrypted-store.ts';
const store=encryptedStore('graph','.env.microsoft365.ui.local','mail-secrets','M365_ENCRYPTED_CONFIG');
export function microsoft365Environment(configId?:string|null):NodeJS.ProcessEnv{
 if(process.env.HEYELLI_TEST_DATABASE_URL&&process.env.APP_ENV!=='test')return process.env;
 try{const ui=store.read(configId);if(ui)return {...process.env,...ui as NodeJS.ProcessEnv};if(process.env.APP_ENV==='test')return process.env;const file=resolve('.env.microsoft365.local');return existsSync(/* turbopackIgnore: true */ file)?{...process.env,...parseEnv(readFileSync(/* turbopackIgnore: true */ file,'utf8'))}:process.env;}catch{return {NODE_ENV:process.env.NODE_ENV};}
}
export function validateMicrosoft365Configuration(input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new PlatformError('Microsoft-365-Daten fehlen.');const value=input as Record<string,unknown>,guid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
 if(typeof value.tenantId!=='string'||!guid.test(value.tenantId)||typeof value.clientId!=='string'||!guid.test(value.clientId)||typeof value.secret!=='string'||!value.secret||value.secret.length>2048||/[\r\n]/.test(value.secret))throw new PlatformError('Tenant-ID, Client-ID und Client-Secret prüfen.');
 return {M365_TENANT_ID:value.tenantId,M365_CLIENT_ID:value.clientId,M365_CLIENT_SECRET:value.secret,NODE_ENV:process.env.NODE_ENV};
}
export function saveMicrosoft365Configuration(input:unknown,expectedExisting=false){return store.save(validateMicrosoft365Configuration(input),expectedExisting);}
export function requireMicrosoft365Configuration(configId?:string|null){return store.read(configId);}
export function archiveMicrosoft365Legacy(){const previous=store.read();return previous===null?null:store.save(previous,true);}
