import {readFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {parseEnv} from 'node:util';
import {createDecipheriv} from 'node:crypto';
import {decryptDraft} from '../src/apps/planboard/entwuerfe/crypto.ts';
export async function verifyProtectedData(pool,state){
 const providers={sharepoint:{table:'sharepoint_settings',key:'sharepoint-secrets',variable:'SHAREPOINT_ENCRYPTED_CONFIG'},bmacloud:{table:'bmacloud_settings',key:'bmacloud-secrets',variable:'BMACLOUD_ENCRYPTED_CONFIG'},copilot:{table:'copilot_settings',key:'copilot-secrets',variable:'COPILOT_ENCRYPTED_CONFIG'},pds:{table:'pds_connection',key:'pds-secrets',variable:'PDS_ENCRYPTED_CONFIG',legacy:'.env.pds.ui.local'},graph:{table:'mail_settings',key:'mail-secrets',variable:'M365_ENCRYPTED_CONFIG',legacy:'.env.microsoft365.ui.local'}};
 const exists=async path=>{try{await access(path);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
 async function unseal(file,keyPath,variable){const key=await readFile(keyPath),raw=parseEnv(await readFile(file,'utf8'))[variable];if(key.length!==32||!raw)throw Error('Geschützter Bestand unvollständig');const parts=raw.split('.').map(v=>Buffer.from(v,'base64'));if(parts.length!==3)throw Error('Geschützter Bestand beschädigt');const decipher=createDecipheriv('aes-256-gcm',key,parts[0]);decipher.setAuthTag(parts[1]);return JSON.parse(Buffer.concat([decipher.update(parts[2]),decipher.final()]).toString('utf8'));}
 let configurations=0,archives=0;for(const [name,p]of Object.entries(providers)){
  if(name==='sharepoint'&&!(await pool.query("SELECT to_regclass('platform.sharepoint_settings') IS NOT NULL AS present")).rows[0].present)continue;
  const current=(await pool.query(`SELECT * FROM platform.${p.table} WHERE id='central'`)).rows[0];
  const ids=(await pool.query('SELECT config_id FROM platform.secret_archives WHERE provider=$1',[name])).rows.map(r=>r.config_id);archives+=ids.length;
  if(current?.config_id)ids.push(current.config_id);const files=[...new Set(ids)].map(id=>join(state,`.env.${name}.${id}.local`));
  if(p.legacy&&await exists(join(state,p.legacy)))files.push(join(state,p.legacy));
  for(const file of files){const value=await unseal(file,join(state,'.local',p.key,'master.key'),p.variable);if(name==='pds'&&current?.config_id&&file.endsWith(current.config_id+'.local')&&value.workspaceId!==current.workspace_id)throw Error('PDS-Quellenreferenz passt nicht');if(name==='pds'&&value.workspaceId){const present=(await pool.query('SELECT 1 FROM platform.pds_workspaces WHERE id=$1',[value.workspaceId])).rowCount;if(!present)throw Error('PDS-Archivbereich fehlt');}configurations++;}
 }
 for(const name of ['.env.microsoft-auth.ui.local','.env.microsoft-auth.pending.local','.env.microsoft-auth.previous.local'])if(await exists(join(state,name))){await unseal(join(state,name),join(state,'.local/microsoft-auth-secrets/master.key'),'MS_AUTH_ENCRYPTED_CONFIG');configurations++;}
 const keys=(await pool.query('SELECT user_id,key_id,wrapped_key FROM platform.private_draft_keys ORDER BY user_id')).rows;let drafts=0;
 for(const row of keys){const master=await readFile(join(state,'.local/private-drafts/master.key')),[nonce,tag,data]=row.wrapped_key.split('.').map(v=>Buffer.from(v,'hex')),cipher=createDecipheriv('aes-256-gcm',master,nonce);cipher.setAAD(Buffer.from(row.user_id));cipher.setAuthTag(tag);const key=Buffer.concat([cipher.update(data),cipher.final()]).toString('hex');if(key.length!==64)throw Error('Entwurfsschlüssel ungültig');
  for(const draft of (await pool.query("SELECT storage_key,envelope FROM platform.private_draft_copies WHERE user_id=$1 AND state='pending'",[row.user_id])).rows){JSON.parse(decryptDraft({keyId:row.key_id,key},draft.storage_key,draft.envelope));drafts++;}
 }
 return {configurations,archives,draftKeys:keys.length,drafts};
}
export async function sanitizeRestoredDatabase(pool){
 // Only call after exact data comparison and only on the dedicated empty restore
 // database. No original credentials are needed for the subsequent HTTP smoke.
 const db=(await pool.query('SELECT current_database() AS name,current_user AS actor')).rows[0];if(db.name!=='heyelli_test'||db.actor!=='heyelli_test')throw Error('Getrennte Wiederherstellungsdatenbank erforderlich');
 await pool.query('BEGIN');try{
  await pool.query('UPDATE platform.sessions SET revoked_at=now() WHERE revoked_at IS NULL');await pool.query('DELETE FROM platform.microsoft_auth_flows');
  await pool.query("UPDATE platform.pds_connection SET active_source='simulator',version=version+1,checked_at=NULL,checked_version=NULL,calendar_checked_at=NULL,calendar_checked_version=NULL");
  await pool.query('UPDATE platform.mail_settings SET enabled=false,test_mode=true,connection_ok=false,checked_at=NULL,version=version+1');
  for(const table of ['bmacloud_settings','copilot_settings','sharepoint_settings']){if(table==='sharepoint_settings'&&!(await pool.query("SELECT to_regclass('platform.sharepoint_settings') IS NOT NULL AS present")).rows[0].present)continue;await pool.query(`UPDATE platform.${table} SET enabled=false,tested_at=NULL,tested_version=NULL,version=version+1`);}
  await pool.query('UPDATE platform.microsoft_auth SET enabled=false,tested_at=NULL,tested_version=NULL,version=version+1');
  await pool.query("UPDATE platform.mail_queue SET status='cancelled',error='Isolierte Wiederherstellung; kein Versand.' WHERE status IN ('queued','retry','sending')");
  await pool.query("UPDATE platform.assistant_actions SET state='cancelled',result='Isolierte Wiederherstellung; keine Ausführung.' WHERE state IN ('pending','executing')");await pool.query('COMMIT');
 }catch(error){await pool.query('ROLLBACK');throw error;}
}
