import type {Pool,PoolClient} from 'pg';
import {PlatformError} from '../../platform/store/model.ts';
// Zentrale MailDesk-Einstellung (nur Administratoren): Quelle und geteiltes Postfach, versioniert und protokolliert.
// Microsoft 365 wird erst aktiv, wenn die Lesezugriffsprüfung für genau dieses Postfach in den letzten 24 h gelang.
export type MaildeskSettings={source:'simulator'|'graph';mailbox:string|null;version:number;checkedMailbox:string|null;checkedAt:string|null;connectionOk:boolean;connectionReady:boolean;checkFresh:boolean};
const email=(value:unknown)=>typeof value==='string'&&value.length>=3&&value.length<=320&&/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(value);
const select="SELECT source,mailbox,version,checked_mailbox,checked_at,connection_ok,(connection_ok AND checked_mailbox=mailbox AND checked_at>now()-interval '24 hours') AS ready,(connection_ok AND checked_at>now()-interval '24 hours') AS fresh FROM platform.maildesk_settings WHERE id='central'";
function map(row:Record<string,unknown>|undefined):MaildeskSettings{if(!row)return {source:'simulator',mailbox:null,version:0,checkedMailbox:null,checkedAt:null,connectionOk:false,connectionReady:false,checkFresh:false};return {source:row.source as MaildeskSettings['source'],mailbox:row.mailbox as string|null,version:row.version as number,checkedMailbox:row.checked_mailbox as string|null,checkedAt:row.checked_at?(row.checked_at as Date).toISOString():null,connectionOk:row.connection_ok as boolean,connectionReady:!!row.ready,checkFresh:!!row.fresh};}
export function maildeskSettings(pool:Pool){
 async function admin<T>(actor:string,work:(client:PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('BEGIN');const user=(await client.query('SELECT role,enabled FROM platform.users WHERE id=$1 FOR SHARE',[actor])).rows[0];if(!user?.enabled||user.role!=='admin')throw new PlatformError('Administratorrechte erforderlich.',403);const result=await work(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
 return {
  async read(){return map((await pool.query(select)).rows[0]);},
  save:(actor:string,input:{version?:unknown;source?:unknown;mailbox?:unknown})=>admin(actor,async client=>{
   const before=map((await client.query(select+' FOR UPDATE')).rows[0]);
   if(input.version!==before.version)throw new PlatformError('Die Einstellung wurde zwischenzeitlich geändert. Bitte neu laden.',409);
   if(input.source!=='simulator'&&input.source!=='graph')throw new PlatformError('Ungültige Postfachquelle.');
   const mailbox=input.mailbox===null||input.mailbox===''?null:typeof input.mailbox==='string'?input.mailbox.trim().toLowerCase():undefined;
   if(mailbox===undefined||mailbox!==null&&!email(mailbox))throw new PlatformError('Bitte eine gültige Postfachadresse eingeben.');
   if(input.source==='graph'){if(!mailbox)throw new PlatformError('Für Microsoft 365 ist ein geteiltes Postfach nötig.');
    const ready=(await client.query("SELECT connection_ok AND checked_mailbox=$1 AND checked_at>now()-interval '24 hours' AS ready FROM platform.maildesk_settings WHERE id='central'",[mailbox])).rows[0]?.ready;
    if(!ready)throw new PlatformError('Bitte zuerst „Verbindung prüfen“ für dieses Postfach ausführen.',409);}
   const row=(await client.query("UPDATE platform.maildesk_settings SET source=$1,mailbox=$2,version=version+1,updated_by=$3,updated_at=now() WHERE id='central' RETURNING *",[input.source,mailbox,actor])).rows[0];
   await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,'maildesk.settings.updated','central',$2::jsonb)",[actor,JSON.stringify([{field:'source',label:'MailDesk-Quelle',before:before.source,after:row.source},{field:'mailbox',label:'MailDesk-Postfach',before:before.mailbox,after:row.mailbox}].filter(change=>change.before!==change.after))]);
   return map((await client.query(select)).rows[0]);
  }),
  recordCheck:(actor:string,mailbox:string,ok:boolean)=>admin(actor,async client=>{
   await client.query("UPDATE platform.maildesk_settings SET checked_mailbox=$1,checked_at=now(),connection_ok=$2 WHERE id='central'",[mailbox,ok]);
   await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,'maildesk.connection.checked','central',$2::jsonb)",[actor,JSON.stringify([{field:'connection',label:'MailDesk-Verbindung',before:null,after:{mailbox,ok}}])]);
   return map((await client.query(select)).rows[0]);
  }),
 };
}
export const validMailbox=email;
