import type {Pool} from 'pg';
import {PlatformError} from '../../../platform/store/model.ts';
export type HiddenEntry={kind:'customer'|'object';id:string};
export function serviceVisibility(pool:Pool){
 async function read(userId:string,source:string):Promise<HiddenEntry[]>{return (await pool.query('SELECT kind,entity_id AS id FROM platform.service_hidden_entries WHERE user_id=$1 AND source=$2 ORDER BY hidden_at,kind,entity_id LIMIT 2000',[userId,source])).rows;}
 return {read,async change(userId:string,source:string,kind:unknown,id:unknown,hidden:unknown){
  if((kind!=='customer'&&kind!=='object')||typeof id!=='string'||!id||id.length>200||/[\x00-\x1f]/.test(id)||typeof hidden!=='boolean')throw new PlatformError('Ungültige Auswahl.');
  const client=await pool.connect();try{await client.query('BEGIN');await client.query('SELECT id FROM platform.users WHERE id=$1 FOR UPDATE',[userId]);
   if(hidden){const count=await client.query('SELECT count(*)::integer AS n FROM platform.service_hidden_entries WHERE user_id=$1',[userId]);const exists=await client.query('SELECT 1 FROM platform.service_hidden_entries WHERE user_id=$1 AND source=$2 AND kind=$3 AND entity_id=$4',[userId,source,kind,id]);if(count.rows[0].n>=2000&&!exists.rowCount)throw new PlatformError('Maximal 2.000 ausgeblendete Einträge. Bitte zuerst Einträge wieder einblenden.',409);
    await client.query('INSERT INTO platform.service_hidden_entries(user_id,source,kind,entity_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[userId,source,kind,id]);
   }else await client.query('DELETE FROM platform.service_hidden_entries WHERE user_id=$1 AND source=$2 AND kind=$3 AND entity_id=$4',[userId,source,kind,id]);
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  return read(userId,source);
 }};
}
