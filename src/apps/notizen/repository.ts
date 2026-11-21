import type {Pool} from 'pg';
import {PlatformError} from '../../platform/store/model.ts';
import {validNoteText,type Note} from './model.ts';
export function personalNotes(pool:Pool){
 async function read(user:string):Promise<Note>{const row=(await pool.query('SELECT body,version,updated_at FROM platform.personal_notes WHERE user_id=$1',[user])).rows[0];return row?{body:row.body,version:row.version,updatedAt:new Date(row.updated_at).toISOString()}:{body:'',version:0,updatedAt:null};}
 return {read,async write(user:string,body:unknown,version:unknown){if(!validNoteText(body)||!Number.isSafeInteger(version)||Number(version)<0)throw new PlatformError('Bitte höchstens 20.000 Zeichen als Notiz eingeben.');
  const client=await pool.connect();try{await client.query('BEGIN');const actor=(await client.query('SELECT enabled FROM platform.users WHERE id=$1 FOR SHARE',[user])).rows[0];if(!actor?.enabled)throw new PlatformError('Bitte zuerst anmelden.',401);await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,741963344))',[user]);
   const previous=(await client.query('SELECT body,version,updated_at FROM platform.personal_notes WHERE user_id=$1',[user])).rows[0];
   if(previous?.body===body){await client.query('COMMIT');return {note:{body:previous.body,version:previous.version,updatedAt:new Date(previous.updated_at).toISOString()}};}
   if((previous?.version??0)!==version){await client.query('COMMIT');return {conflict:true,note:previous?{body:previous.body,version:previous.version,updatedAt:new Date(previous.updated_at).toISOString()}:{body:'',version:0,updatedAt:null}};}
   const row=(await client.query('INSERT INTO platform.personal_notes(user_id,body) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET body=excluded.body,version=platform.personal_notes.version+1,updated_at=now() RETURNING body,version,updated_at',[user,body])).rows[0];await client.query('COMMIT');return {note:{body:row.body,version:row.version,updatedAt:new Date(row.updated_at).toISOString()}};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }};
}
