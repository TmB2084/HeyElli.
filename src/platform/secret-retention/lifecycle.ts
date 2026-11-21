import {readdirSync,existsSync} from 'node:fs';
import type {Pool,PoolClient} from 'pg';
import {readdir,lstat,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {PlatformError} from '../store/model.ts';
import {settingsDirectory} from '../server-operation/index.ts';
export type SecretProvider='bmacloud'|'copilot'|'pds'|'graph'|'sharepoint';
const tables={bmacloud:'bmacloud_settings',copilot:'copilot_settings',pds:'pds_connection',graph:'mail_settings',sharepoint:'sharepoint_settings'} as const;
export function secretRoot(){if(process.env.APP_ENV==='test'){if(!process.env.HEYELLI_TEST_SETTINGS_DIR)throw Error('Isolated settings required');return resolve(process.env.HEYELLI_TEST_SETTINGS_DIR);}return settingsDirectory();}
export function assertSecretCapacity(provider:SecretProvider){const root=secretRoot(),pattern=new RegExp('^\\.env\\.'+provider+'\\.[a-f0-9-]{36}\\.local$','i');if(readdirSync(/* turbopackIgnore: true */ root).filter(name=>pattern.test(name)).length>=1000)throw new PlatformError('Zugangsdatenablage voll. Die sichere Bereinigung unter Sicherheit prüfen; die bisherige Konfiguration bleibt erhalten.',413);}
export async function lockSecrets(client:PoolClient,provider:SecretProvider){await client.query('SELECT pg_advisory_xact_lock($1)',[({bmacloud:741963321,copilot:741963322,pds:741963324,graph:741963325,sharepoint:741963326})[provider]]);}
export async function archiveSecret(client:PoolClient,provider:SecretProvider,id:string|null){
 if(id)await client.query("INSERT INTO platform.secret_archives(provider,config_id) VALUES($1,$2) ON CONFLICT(provider,config_id) DO UPDATE SET archived_at=now(),protected_until=now()+interval '7 days'",[provider,id]);
 // These changes commit together with the new active reference. A rolled-back
 // configuration write cannot retire a previously protected archive.
 await client.query("DELETE FROM platform.secret_archives WHERE provider=$1 AND (protected_until<=now() OR config_id NOT IN(SELECT config_id FROM platform.secret_archives WHERE provider=$1 ORDER BY archived_at DESC,config_id DESC LIMIT 2))",[provider]);
}
async function transaction<T>(pool:Pool,actor:string,provider:SecretProvider,work:(client:PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('BEGIN');const row=(await client.query('SELECT enabled,role FROM platform.users WHERE id=$1 FOR SHARE',[actor])).rows[0];if(!row?.enabled||row.role!=='admin')throw new PlatformError('Administratorrechte erforderlich.',403);await lockSecrets(client,provider);const value=await work(client);await client.query('COMMIT');return value;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
export async function maintainSecrets(pool:Pool,actor:string,provider:SecretProvider,now=new Date()){
 if(!Object.hasOwn(tables,provider))throw new PlatformError('Unbekannte Zugangsdatenablage.');
 // First commit archive expiry. Files are only deleted in a separate transaction
 // against the resulting authoritative references, never ahead of a commit.
 await transaction(pool,actor,provider,client=>client.query('DELETE FROM platform.secret_archives WHERE provider=$1 AND protected_until<=$2',[provider,now]));
 return transaction(pool,actor,provider,async client=>{
  const row=(await client.query(`SELECT * FROM platform.${tables[provider]} WHERE id='central'`)).rows[0];if(!row)throw new PlatformError('Zugangsdatenverwaltung nicht eingerichtet.',503);
  const archives=(await client.query('SELECT config_id,archived_at FROM platform.secret_archives WHERE provider=$1 ORDER BY archived_at DESC',[provider])).rows;
  const protectedIds=new Set<string>([row.config_id,...archives.map(a=>a.config_id)].filter(Boolean));
  const root=secretRoot(),pattern=new RegExp('^\\.env\\.'+provider+'\\.([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\\.local$','i');
  let removed=0,quarantined=0,skipped=0,scanned=0;
  for(const name of await readdir(/* turbopackIgnore: true */ root)){
   const match=name.match(pattern);if(!match)continue;const id=match[1].toLowerCase();if(protectedIds.has(id)){await client.query('DELETE FROM platform.secret_orphans WHERE provider=$1 AND config_id=$2',[provider,id]);continue;}
   if(++scanned>1000)break;
   const path=resolve(root,name),info=await lstat(/* turbopackIgnore: true */ path);if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||(info.mode&0o077)){skipped++;continue;}
   const fingerprint=[info.dev,info.ino,info.size,info.mtimeMs,info.ctimeMs].join(':');
   const previous=(await client.query('SELECT * FROM platform.secret_orphans WHERE provider=$1 AND config_id=$2',[provider,id])).rows[0];
   if(!previous||previous.fingerprint!==fingerprint){await client.query('INSERT INTO platform.secret_orphans(provider,config_id,fingerprint,first_seen) VALUES($1,$2,$3,$4) ON CONFLICT(provider,config_id) DO UPDATE SET fingerprint=$3,first_seen=$4,observations=1',[provider,id,fingerprint,now]);quarantined++;continue;}
   if(now.getTime()-new Date(previous.first_seen).getTime()<86400000){await client.query('UPDATE platform.secret_orphans SET observations=observations+1 WHERE provider=$1 AND config_id=$2',[provider,id]);quarantined++;continue;}
   const again=await lstat(/* turbopackIgnore: true */ path);if(!again.isFile()||again.isSymbolicLink()||[again.dev,again.ino,again.size,again.mtimeMs,again.ctimeMs].join(':')!==fingerprint){skipped++;continue;}
   // The provider lock also protects every configuration file publication.
   await unlink(path);removed++;await client.query('DELETE FROM platform.secret_orphans WHERE provider=$1 AND config_id=$2',[provider,id]);
  }
  if(removed)await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,'secrets.cleaned',$2,$3::jsonb)",[actor,provider,JSON.stringify([{field:'orphanFiles',label:'Verwaiste Geheimnisdateien entfernt',before:removed,after:0}])]);
  return {provider,version:row.version,configured:!!row.config_id||provider==='pds'&&existsSync(/* turbopackIgnore: true */ resolve(root,'.env.pds.ui.local'))||provider==='graph'&&existsSync(/* turbopackIgnore: true */ resolve(root,'.env.microsoft365.ui.local')),enabled:provider==='pds'?row.active_source==='pds-readonly':row.enabled,archives:archives.length,latestArchive:archives[0]?.archived_at??null,removed,quarantined,skipped};
 });
}
const recent=new Map<string,number>();
export async function scheduledMaintenance(pool:Pool,actor:string,provider:SecretProvider){const key=secretRoot()+':'+provider;if(Date.now()-(recent.get(key)??0)<3600000)return;recent.set(key,Date.now());try{await maintainSecrets(pool,actor,provider);}catch{recent.delete(key);/* Explicit maintenance remains available and reports the failure. */}}
export async function restoreSecret(pool:Pool,actor:string,provider:SecretProvider,version:unknown){
 if(!Object.hasOwn(tables,provider))throw new PlatformError('Unbekannte Zugangsdatenablage.');
 return transaction(pool,actor,provider,async client=>{
  const row=(await client.query(`SELECT * FROM platform.${tables[provider]} WHERE id='central' FOR UPDATE`)).rows[0];if(!row||row.version!==version)throw new PlatformError('Einrichtung wurde geändert. Bitte erneut öffnen.',409);
  const candidate=(await client.query('SELECT config_id FROM platform.secret_archives WHERE provider=$1 AND config_id IS DISTINCT FROM $2::uuid AND protected_until>now() ORDER BY archived_at DESC,config_id DESC LIMIT 1',[provider,row.config_id])).rows[0];if(!candidate)throw new PlatformError('Keine geschützte vorherige Konfiguration vorhanden.',409);
  let workspaceId:string|undefined;
  if(provider==='bmacloud')(await import('../bmacloud/configuration.ts')).readConfig(candidate.config_id);
  else if(provider==='copilot')(await import('../../apps/askelli/copilot/configuration.ts')).readConfig(candidate.config_id);
  else if(provider==='sharepoint')(await import('../sharepoint/configuration.ts')).readConfig(candidate.config_id);
  else if(provider==='graph')(await import('../mail/configuration.ts')).requireMicrosoft365Configuration(candidate.config_id);
  else {workspaceId=(await import('../pds/connection/configuration.ts')).readPdsConfiguration(candidate.config_id)?.workspaceId;if(!workspaceId)throw new PlatformError('Vorherige PDS-Konfiguration enthält keinen sicheren Quellenbereich.',409);}
  await archiveSecret(client,provider,row.config_id);
  if(provider==='pds')await client.query("UPDATE platform.pds_connection SET config_id=$1,workspace_id=$2,active_source='simulator',views='{}'::jsonb,configured=true,version=version+1,checked_at=NULL,checked_version=NULL,checks='[]'::jsonb,calendar_checked_at=NULL,calendar_checked_version=NULL,calendar_check=NULL WHERE id='central'",[candidate.config_id,workspaceId]);
  else if(provider==='graph')await client.query("UPDATE platform.mail_settings SET config_id=$1,enabled=false,test_mode=true,connection_ok=false,checked_at=NULL,checked_sender=NULL,version=version+1 WHERE id='central'",[candidate.config_id]);
  else await client.query(`UPDATE platform.${tables[provider]} SET config_id=$1,enabled=false,version=version+1,tested_at=NULL,tested_version=NULL,updated_at=now() WHERE id='central'`,[candidate.config_id]);
  await client.query('DELETE FROM platform.secret_archives WHERE provider=$1 AND config_id=$2',[provider,candidate.config_id]);
  if(provider==='copilot')await client.query("UPDATE platform.assistant_actions SET state='cancelled',result='Copilot-Konfiguration wiederhergestellt. Bitte neuen Vorschlag anfordern.' WHERE state='pending'");
  await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,'secrets.restored',$2,$3::jsonb)",[actor,provider,JSON.stringify([{field:'enabled',label:'Integration aktiv',before:provider==='pds'?row.active_source==='pds-readonly':row.enabled,after:false}])]);return {ok:true};
 });
}
