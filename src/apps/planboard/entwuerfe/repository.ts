import type {Pool,PoolClient} from 'pg';
import {isToolDraft} from '../../casedesk/erfassung/tool-drafts.ts';
import {existsSync,lstatSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {randomBytes,randomUUID,createCipheriv,createDecipheriv} from 'node:crypto';
import {PlatformError} from '../../../platform/store/model.ts';
import {secretRoot} from '../../../platform/secret-retention/server.ts';
import {decryptDraft,type DraftKey} from './crypto.ts';
function master(create=false){const path=resolve(secretRoot(),'.local/private-drafts/master.key');if(create&&!existsSync(/* turbopackIgnore: true */ path)){mkdirSync(dirname(path),{recursive:true,mode:0o700});try{writeFileSync(path,randomBytes(32),{flag:'wx',mode:0o600});}catch(error){if(!existsSync(/* turbopackIgnore: true */ path))throw error;}}if(!existsSync(/* turbopackIgnore: true */ path))throw new PlatformError('Entwurfsschlüssel fehlt. Geschützte Sicherung wiederherstellen lassen; vorhandene Entwürfe wurden nicht geändert.',503);const info=lstatSync(/* turbopackIgnore: true */ path);if(!info.isFile()||info.isSymbolicLink()||(info.mode&0o077))throw new PlatformError('Entwurfsschlüssel ist nicht sicher verfügbar.',503);const key=readFileSync(/* turbopackIgnore: true */ path);if(key.length!==32)throw new PlatformError('Entwurfsschlüssel ungültig.',503);return key;}
function wrap(key:Uint8Array,user:string){const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',master(true),nonce);cipher.setAAD(Buffer.from(user));const body=Buffer.concat([cipher.update(key),cipher.final()]);return [nonce,cipher.getAuthTag(),body].map(b=>b.toString('hex')).join('.');}
function unwrap(value:string,user:string){const [nonce,tag,data]=value.split('.').map(s=>Buffer.from(s,'hex')),cipher=createDecipheriv('aes-256-gcm',master(),nonce);cipher.setAAD(Buffer.from(user));cipher.setAuthTag(tag);return Buffer.concat([cipher.update(data),cipher.final()]).toString('hex');}
// Export data, never encryption keys. The caller must select the key/copy by the
// verified owner; an administrator exporting another account receives metadata.
export function exportOwnedDraft(actor:string,owner:string,key:{key_id:string;wrapped_key:string},storageKey:string,envelope:string){
 if(actor!==owner)throw new PlatformError('Entwurfsinhalte darf nur der Kontoinhaber exportieren.',403);
 return JSON.parse(decryptDraft({keyId:key.key_id,key:unwrap(key.wrapped_key,owner)},storageKey,envelope));
}
export function privateDrafts(pool:Pool){
 async function tx<T>(actor:string,work:(client:PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('BEGIN');const row=(await client.query('SELECT enabled FROM platform.users WHERE id=$1 FOR SHARE',[actor])).rows[0];if(!row?.enabled)throw new PlatformError('Bitte zuerst anmelden.',401);await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,741963323))',[actor]);const value=await work(client);await client.query('COMMIT');return value;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
 async function key(client:PoolClient,user:string):Promise<DraftKey>{let row=(await client.query('SELECT * FROM platform.private_draft_keys WHERE user_id=$1',[user])).rows[0];if(!row){if((await client.query('SELECT 1 FROM platform.private_draft_keys LIMIT 1')).rowCount)master();const id=randomUUID(),encrypted=wrap(randomBytes(32),user);row=(await client.query('INSERT INTO platform.private_draft_keys(user_id,key_id,wrapped_key) VALUES($1,$2,$3) RETURNING *',[user,id,encrypted])).rows[0];}return {keyId:row.key_id,key:unwrap(row.wrapped_key,user)};}
 return {
  key:(actor:string)=>tx(actor,client=>key(client,actor)),
  status:(actor:string)=>tx(actor,async client=>{const k=await key(client,actor);const count=(await client.query("SELECT count(*)::int AS n FROM platform.private_draft_copies WHERE user_id=$1 AND state='pending'",[actor])).rows[0].n;return {keyId:k.keyId,stored:count};}),
  read:(actor:string,after='')=>tx(actor,async client=>{if(after.length>600)throw new PlatformError('Ungültige Entwurfsseite.');const result=await client.query("SELECT storage_key AS key,envelope FROM platform.private_draft_copies WHERE user_id=$1 AND state='pending' AND storage_key>$2 ORDER BY storage_key LIMIT 21",[actor,after]);const rows=result.rows.slice(0,20);return {records:rows,next:result.rows.length>20?rows.at(-1)!.key:null};}),
  change:(actor:string,input:{key?:unknown;envelope?:unknown;complete?:unknown})=>tx(actor,async client=>{
   if(typeof input.key!=='string'||!/^heyelli:(?:calendar-draft:v2|incident-draft:v1):[^:]+:.{1,500}$/.test(input.key)||input.key.length>600)throw new PlatformError('Ungültige Entwurfskennung.');
   if(input.complete===true){await client.query("INSERT INTO platform.private_draft_copies(user_id,storage_key,state) VALUES($1,$2,'complete') ON CONFLICT(user_id,storage_key) DO UPDATE SET envelope=NULL,state='complete',updated_at=now()",[actor,input.key]);return {ok:true};}
   if(typeof input.envelope!=='string'||input.envelope.length>262144)throw new PlatformError('Entwurf ist für die zusätzliche Sicherung zu groß.',413);
   const k=await key(client,actor);let value;try{value=JSON.parse(decryptDraft(k,input.key,input.envelope));}catch{throw new PlatformError('Entwurf gehört nicht zu diesem Benutzer oder wurde beschädigt.',400);}
   if(!(input.key.startsWith('heyelli:incident-draft:v1:')?isToolDraft(value):value?.draftId&&value?.original?.id&&value.original.id===value.changed?.id&&typeof value.operationId==='string')||!input.key.endsWith(':'+encodeURIComponent(value.draftId)))throw new PlatformError('Ungültiger Entwurfsinhalt.');
   const existing=(await client.query('SELECT state,envelope FROM platform.private_draft_copies WHERE user_id=$1 AND storage_key=$2',[actor,input.key])).rows[0];
   if(existing?.state==='complete')return {ok:true,completed:true};
   if(existing){if(decryptDraft(k,input.key,existing.envelope)!==decryptDraft(k,input.key,input.envelope))throw new PlatformError('Dieser Entwurfsstand ist bereits anders gesichert.',409);return {ok:true};}
   const amount=(await client.query("SELECT count(*)::int AS count,coalesce(sum(octet_length(envelope)),0)::int AS bytes FROM platform.private_draft_copies WHERE user_id=$1 AND state='pending'",[actor])).rows[0];
   if(amount.count>=1000||amount.bytes+input.envelope.length>8*1024*1024)throw new PlatformError('Zusätzliche Entwurfssicherung ist voll. Die verschlüsselte Sicherung auf diesem Gerät bleibt erhalten.',413);
   await client.query("INSERT INTO platform.private_draft_copies(user_id,storage_key,envelope,state) VALUES($1,$2,$3,'pending')",[actor,input.key,input.envelope]);return {ok:true};
  })
 };
}
