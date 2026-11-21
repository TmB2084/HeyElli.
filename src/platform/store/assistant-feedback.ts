import type {Pool,PoolClient} from 'pg';
import {PlatformError} from './model.ts';
import type {SavedTurn} from './assistant-chats.ts';
// Pure validation is repeated at the repository boundary, independent of the UI.
import {feedbackInput,feedbackKey} from './assistant-feedback-model.ts';
export function assistantFeedback(pool:Pool){
 async function admin<T>(userId:string,work:(client:PoolClient)=>Promise<T>):Promise<T>{
  const client=await pool.connect();try{await client.query('BEGIN');
   const {rows}=await client.query('SELECT role,enabled FROM platform.users WHERE id=$1 FOR SHARE',[userId]);
   if(!rows[0]?.enabled||rows[0].role!=='admin')throw new PlatformError('Bewertungen sind ausschließlich für Administratoren verfügbar.',403);
   const result=await work(client);await client.query('COMMIT');return result;
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
 return {
  own(userId:string,epoch:string){return admin(userId,async client=>(await client.query('SELECT turn_id AS "turnId",rating,reason,comment FROM platform.assistant_feedback WHERE user_id=$1 AND epoch=$2 ORDER BY created_at',[userId,epoch])).rows);},
  async save(userId:string,input:unknown){let value;try{value=feedbackInput(input);}catch(error){throw new PlatformError((error as Error).message);}
   return admin(userId,async client=>{
    const chat=(await client.query('SELECT epoch,turns FROM platform.assistant_chats WHERE user_id=$1 FOR UPDATE',[userId])).rows[0];
    if(!chat||chat.epoch!==value.epoch)throw new PlatformError('Der Chat wurde neu begonnen. Bitte erneut laden.',409);
    const turn=(chat.turns as SavedTurn[]).find(turn=>turn.id===value.turnId);
    if(!turn)throw new PlatformError('Nur eigene gespeicherte Antworten können bewertet werden.',404);
    const result=await client.query(`INSERT INTO platform.assistant_feedback(user_id,epoch,turn_id,rating,reason,comment,question,answer,sources,knowledge_version)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) ON CONFLICT(user_id,epoch,turn_id) DO UPDATE SET rating=excluded.rating,reason=excluded.reason,comment=excluded.comment,updated_at=now()
     RETURNING turn_id AS "turnId",rating,reason,comment`,[userId,value.epoch,value.turnId,value.rating,value.reason,value.comment,turn.question,turn.answer,JSON.stringify(turn.sources),turn.knowledgeVersion??'legacy']);
    return result.rows[0];
   });
  },
  remove(userId:string,input:unknown){let key;try{key=feedbackKey(input);}catch{throw new PlatformError('Ungültige Antwortkennung.');}return admin(userId,async client=>{await client.query('DELETE FROM platform.assistant_feedback WHERE user_id=$1 AND epoch=$2 AND turn_id=$3',[userId,key.epoch,key.turnId]);return {ok:true};});},
  review(userId:string,page:number){if(!Number.isSafeInteger(page)||page<0||page>10000)throw new PlatformError('Ungültige Seite.');return admin(userId,async client=>{
   const total=Number((await client.query('SELECT count(*) AS count FROM platform.assistant_feedback')).rows[0].count);
   const items=(await client.query(`SELECT f.user_id AS "userId",u.display_name AS "displayName",f.epoch,f.turn_id AS "turnId",f.rating,f.reason,f.comment,f.question,f.answer,f.sources,f.knowledge_version AS "knowledgeVersion",f.created_at AS "createdAt",f.updated_at AS "updatedAt"
    FROM platform.assistant_feedback f JOIN platform.users u ON u.id=f.user_id ORDER BY f.updated_at DESC,f.user_id,f.epoch,f.turn_id LIMIT 30 OFFSET $1`,[page*30])).rows;
   return {items,total,page,pageSize:30};
  });}
 };
}
