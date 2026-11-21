import type {Pool} from 'pg';
import {PlatformError} from './model.ts';
export type SavedTurn={hasAction?:boolean;knowledgeVersion?:string;id:string;question:string;answer:string;sources:{title:string;href:string}[]};
export type Draft={text:string;revision:number;updatedAt:string};
export type PendingQuestion={id:string;question:string;draft?:{id:string;revision:number}};
export type SavedChat={epoch:string;turns:SavedTurn[];drafts:Record<string,Draft>;pending:PendingQuestion[]};
export function assistantChats(pool:Pool){
 async function read(userId:string):Promise<SavedChat>{
  await pool.query('INSERT INTO platform.assistant_chats(user_id) VALUES($1) ON CONFLICT DO NOTHING',[userId]);
  const {rows}=await pool.query('SELECT epoch,turns,drafts,pending FROM platform.assistant_chats WHERE user_id=$1',[userId]);return rows[0];
 }
 async function mutate(userId:string,epoch:string,change:(chat:SavedChat,client:import('pg').PoolClient)=>void|Promise<void>):Promise<SavedChat>{
  const client=await pool.connect();try{await client.query('BEGIN');
   const {rows}=await client.query('SELECT epoch,turns,drafts,pending FROM platform.assistant_chats WHERE user_id=$1 FOR UPDATE',[userId]);const chat=rows[0] as SavedChat|undefined;
   if(!chat||chat.epoch!==epoch)throw new PlatformError('Der Chat wurde in einem anderen Fenster neu begonnen. Bitte den gespeicherten Chat erneut laden.',409);
   await change(chat,client);
   const result=await client.query('UPDATE platform.assistant_chats SET epoch=$2,turns=$3::jsonb,drafts=$4::jsonb,pending=$5::jsonb,updated_at=now() WHERE user_id=$1 RETURNING epoch,turns,drafts,pending',[userId,chat.epoch,JSON.stringify(chat.turns),JSON.stringify(chat.drafts),JSON.stringify(chat.pending)]);
   await client.query('COMMIT');return result.rows[0];
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
 return {read,
  draft(userId:string,epoch:string,id:string,text:string,revision:number){
   if(!/^[0-9a-f-]{36}$/i.test(id)||typeof text!=='string'||text.length>1500||!Number.isSafeInteger(revision)||revision<1)throw new PlatformError('Ungültige Fragesicherung.');
   return mutate(userId,epoch,chat=>{if(chat.drafts[id]&&chat.drafts[id].revision>=revision)return;if(Object.keys(chat.drafts).length>=100&&!chat.drafts[id])throw new PlatformError('Zu viele gesicherte Fragen. Bitte einen neuen Chat beginnen.',409);chat.drafts[id]={text,revision,updatedAt:new Date().toISOString()};});
  },
  enqueue(userId:string,epoch:string,question:PendingQuestion){return mutate(userId,epoch,async(chat,client)=>{
   if((await client.query('SELECT 1 FROM platform.removed_chat_turns WHERE user_id=$1 AND epoch=$2 AND turn_id=$3',[userId,epoch,question.id])).rowCount)throw new PlatformError('Diese abgeschlossene Antwort wurde bewusst entfernt. Für eine neue Frage eine neue Anfrage verwenden.',409);
   const existing=chat.turns.find(item=>item.id===question.id)??chat.pending.find(item=>item.id===question.id);if(existing){if(existing.question!==question.question)throw new PlatformError('Diese Anfragekennung wurde bereits verwendet.',409);return;}
   if(chat.pending.length>=50)throw new PlatformError('Zu viele offene Fragen. Bitte vorhandene Anfragen abschließen.',429);chat.pending.push(question);if(question.draft){const old=chat.drafts[question.draft.id];if(!old||old.revision<=question.draft.revision)chat.drafts[question.draft.id]={text:'',revision:question.draft.revision,updatedAt:new Date().toISOString()};}
  });},
  change(userId:string,epoch:string,turn?:SavedTurn){return mutate(userId,epoch,async(chat,client)=>{
   if(!turn){chat.epoch=crypto.randomUUID();chat.turns=[];chat.drafts={};chat.pending=[];return;}
   if((await client.query('SELECT 1 FROM platform.removed_chat_turns WHERE user_id=$1 AND epoch=$2 AND turn_id=$3',[userId,epoch,turn.id])).rowCount)throw new PlatformError('Diese abgeschlossene Antwort wurde bewusst entfernt.',409);
   const existing=chat.turns.find(item=>item.id===turn.id);if(existing&&existing.question!==turn.question)throw new PlatformError('Diese Anfragekennung wurde bereits verwendet.',409);
   if(!existing){if(chat.turns.length>=500)throw new PlatformError('Der Chat enthält bereits 500 Antworten. Bitte einen neuen Chat beginnen.',409);chat.turns.push(turn);}
   chat.pending=chat.pending.filter(item=>item.id!==turn.id);
  });}
 };
}
