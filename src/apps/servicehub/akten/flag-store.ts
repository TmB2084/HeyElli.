import type {Pool} from 'pg';
import {PlatformError} from '../../../platform/store/model.ts';

const maxFlags=500;

export function serviceFlags(pool:Pool){
 async function read(userId:string,source:string):Promise<string[]>{
  const result=await pool.query('SELECT order_id FROM platform.service_order_flags WHERE user_id=$1 AND source=$2 ORDER BY order_id LIMIT $3',[userId,source,maxFlags]);
  return result.rows.map(row=>row.order_id);
 }
 async function change(userId:string,source:string,id:unknown,flagged:unknown){
  if(typeof id!=='string'||!id.trim()||id.length>200||/[\x00-\x1f]/.test(id)||typeof flagged!=='boolean')throw new PlatformError('Ungültige Auftragsmarkierung.');
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   await client.query('SELECT id FROM platform.users WHERE id=$1 FOR UPDATE',[userId]);
   if(flagged){
    const result=await client.query('SELECT count(*)::integer AS count, COALESCE(bool_or(order_id=$3),false) AS already_marked FROM platform.service_order_flags WHERE user_id=$1 AND source=$2',[userId,source,id]);
    if(result.rows[0].count>=maxFlags&&!result.rows[0].already_marked)throw new PlatformError(`Maximal ${maxFlags} markierte Aufträge.`,409);
    await client.query('INSERT INTO platform.service_order_flags(user_id,source,order_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[userId,source,id]);
   }else{
    await client.query('DELETE FROM platform.service_order_flags WHERE user_id=$1 AND source=$2 AND order_id=$3',[userId,source,id]);
   }
   await client.query('COMMIT');
  }catch(error){
   await client.query('ROLLBACK');
   throw error;
  }finally{client.release();}
  return read(userId,source);
 }
 return {read,change};
}
