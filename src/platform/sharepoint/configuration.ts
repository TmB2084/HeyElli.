import {createHash} from 'node:crypto';
import {encryptedStore} from '../secret-retention/encrypted-store.ts';
import {PlatformError} from '../store/model.ts';
export type SharePointConfig={tenantId:string;clientId:string;secret:string;siteId:string;driveId:string;rootId:string};
export const sharePointSecrets=encryptedStore('sharepoint','.env.sharepoint.ui.local','sharepoint-secrets','SHAREPOINT_ENCRYPTED_CONFIG');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function validateConfig(input:unknown):SharePointConfig{
 if(!input||typeof input!=='object')throw new PlatformError('SharePoint-Einrichtung fehlt.');const v=input as Record<string,unknown>;
 if(typeof v.tenantId!=='string'||!uuid.test(v.tenantId)||typeof v.clientId!=='string'||!uuid.test(v.clientId)||typeof v.secret!=='string'||!v.secret||v.secret.length>4096||/[\x00-\x1f]/.test(v.secret))throw new PlatformError('Tenant-ID, Client-ID und Client-Secret prüfen.');
 const site=typeof v.siteId==='string'?v.siteId.split(','):[];
 if(site.length!==3||! /^[a-z0-9][a-z0-9-]*\.sharepoint\.com$/i.test(site[0])||!uuid.test(site[1])||!uuid.test(site[2]))throw new PlatformError('Site-ID vollständig eingeben: tenant.sharepoint.com,Website-UUID,Web-UUID.');
 if(typeof v.driveId!=='string'||! /^[A-Za-z0-9!_-]{1,200}$/.test(v.driveId)||typeof v.rootId!=='string'||! /^[A-Za-z0-9!_-]{1,200}$/.test(v.rootId))throw new PlatformError('Bibliotheks-ID und Stammordner-ID prüfen.');
 return {tenantId:v.tenantId.toLowerCase(),clientId:v.clientId.toLowerCase(),secret:v.secret,siteId:site.join(',').toLowerCase(),driveId:v.driveId,rootId:v.rootId};
}
export function readConfig(id:string){const value=sharePointSecrets.read(id);if(!value)throw new PlatformError('SharePoint-Zugangsdaten fehlen.',503);return validateConfig(value);}
export const libraryKey=(config:SharePointConfig)=>createHash('sha256').update(JSON.stringify([config.tenantId,config.siteId,config.driveId,config.rootId])).digest('hex');
export function safeLink(raw:unknown,config:SharePointConfig){try{const url=new URL(String(raw));return url.protocol==='https:'&&!url.username&&!url.password&&url.hostname===config.siteId.split(',')[0]?url.href:undefined;}catch{return undefined;}}
