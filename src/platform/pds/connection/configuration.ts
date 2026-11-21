import {encryptedStore} from '../../secret-retention/encrypted-store.ts';
import {PlatformError} from '../../store/model.ts';
export type PdsConfiguration={baseUrl:string;token:string;workspaceId?:string};
const store=encryptedStore('pds','.env.pds.ui.local','pds-secrets','PDS_ENCRYPTED_CONFIG');
export function validatePdsConfiguration(input:unknown):PdsConfiguration{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new PlatformError('PDS-Konfiguration fehlt.');const value=input as Record<string,unknown>;
 if(typeof value.baseUrl!=='string'||value.baseUrl.length>1000||typeof value.token!=='string'||!value.token||value.token.length>6000||/[\s\r\n]/.test(value.token))throw new PlatformError('API-Basisadresse und Bearer-Token prüfen.');
 let url:URL;try{url=new URL(value.baseUrl);}catch{throw new PlatformError('Gültige HTTPS-API-Basisadresse erforderlich.');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new PlatformError('PDS erfordert HTTPS ohne Zugangsdaten, Suchparameter oder Fragment in der Adresse.');
 return {baseUrl:url.href.replace(/\/+$/,''),token:value.token};
}
export function savePdsConfiguration(input:unknown,workspaceId?:string,expectedExisting=false){return store.save({...validatePdsConfiguration(input),...(workspaceId?{workspaceId}:{})},expectedExisting);}
export function readPdsConfiguration(id?:string|null):PdsConfiguration|null{const value=store.read(id);if(value===null)return null;const config=value as Record<string,unknown>;return {...validatePdsConfiguration(config),...(typeof config.workspaceId==='string'?{workspaceId:config.workspaceId}:{})};}
export function archivePdsLegacy(){const previous=store.read();return previous===null?null:store.save(previous,true);}
