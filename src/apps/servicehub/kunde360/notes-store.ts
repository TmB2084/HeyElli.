import type {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {PlatformError} from '../../../platform/store/model.ts';
// Kundennotizen (Kunde 360): anlegen und eigene löschen, Audit je Änderung. Keine Bearbeitung – Notizen sind Vermerke.
export type CustomerNote={id:string;body:string;authorId:string|null;authorName:string;createdAt:string};
export function customerNotesStore(pool:Pool){
 return {
  async list(source:string,customerId:string,limit=50):Promise<CustomerNote[]>{return (await pool.query('SELECT id,body,author_id AS "authorId",author_name AS "authorName",created_at AS "createdAt" FROM platform.customer_notes WHERE source=$1 AND customer_id=$2 ORDER BY created_at DESC,id LIMIT $3',[source,customerId,Math.min(Math.max(limit,1),200)])).rows.map(row=>({...row,createdAt:new Date(row.createdAt).toISOString()}));},
  async add(actor:string,actorName:string,source:string,customerId:string,body:unknown){
   const text=typeof body==='string'?body.trim():'';
   if(!text||text.length>2000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text))throw new PlatformError('Bitte eine Notiz mit höchstens 2000 Zeichen eingeben.');
   if(!customerId||customerId.length>200)throw new PlatformError('Ungültiger Kunde.');
   const client=await pool.connect();
   try{await client.query('BEGIN');const user=(await client.query('SELECT enabled FROM platform.users WHERE id=$1 FOR SHARE',[actor])).rows[0];if(!user?.enabled)throw new PlatformError('Benutzerkonto ist nicht aktiv.',403);
    const id=randomUUID(),row=(await client.query('INSERT INTO platform.customer_notes(id,source,customer_id,body,author_id,author_name) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,body,author_id AS "authorId",author_name AS "authorName",created_at AS "createdAt"',[id,source,customerId,text,actor,actorName.slice(0,120)||actor.slice(0,120)])).rows[0];
    await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,'crm.note-add',$2,$3::jsonb)",[actor,customerId.slice(0,200),JSON.stringify([{field:'note',label:'Kundennotiz',before:null,after:{id,length:text.length}}])]);
    await client.query('COMMIT');return {...row,createdAt:new Date(row.createdAt).toISOString()} as CustomerNote;
   }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  },
  async remove(actor:string,source:string,customerId:string,id:unknown){
   if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))throw new PlatformError('Ungültige Notiz.');
   const client=await pool.connect();
   try{await client.query('BEGIN');
    const row=(await client.query('SELECT author_id FROM platform.customer_notes WHERE id=$1 AND source=$2 AND customer_id=$3 FOR UPDATE',[id,source,customerId])).rows[0];
    if(!row)throw new PlatformError('Notiz nicht gefunden.',404);
    if(row.author_id!==actor)throw new PlatformError('Nur eigene Notizen können gelöscht werden.',403);
    await client.query('DELETE FROM platform.customer_notes WHERE id=$1',[id]);
    await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,'crm.note-remove',$2,$3::jsonb)",[actor,customerId.slice(0,200),JSON.stringify([{field:'note',label:'Kundennotiz',before:{id},after:null}])]);
    await client.query('COMMIT');
   }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  },
 };
}
