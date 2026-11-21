import type {Pool} from 'pg';
import {PlatformError} from '../../../platform/store/model.ts';
// Persönlich angeheftete Kunden (Seitenleiste „Angeheftet“). Muster wie das persönliche Ausblenden (visibility-store).
export const MAX_PINNED_CUSTOMERS=200;
export function servicePins(pool:Pool){
 async function read(userId:string,source:string):Promise<string[]>{return (await pool.query('SELECT customer_id FROM platform.service_pinned_customers WHERE user_id=$1 AND source=$2 ORDER BY pinned_at,customer_id LIMIT $3',[userId,source,MAX_PINNED_CUSTOMERS])).rows.map(row=>row.customer_id);}
 return {read,async change(userId:string,source:string,id:unknown,pinned:unknown){
  if(typeof id!=='string'||!id||id.length>200||/[\x00-\x1f]/.test(id)||typeof pinned!=='boolean')throw new PlatformError('Ungültige Auswahl.');
  const client=await pool.connect();try{await client.query('BEGIN');await client.query('SELECT id FROM platform.users WHERE id=$1 FOR UPDATE',[userId]);
   if(pinned){const count=await client.query('SELECT count(*)::integer AS n FROM platform.service_pinned_customers WHERE user_id=$1 AND source=$2',[userId,source]);const exists=await client.query('SELECT 1 FROM platform.service_pinned_customers WHERE user_id=$1 AND source=$2 AND customer_id=$3',[userId,source,id]);if(count.rows[0].n>=MAX_PINNED_CUSTOMERS&&!exists.rowCount)throw new PlatformError(`Maximal ${MAX_PINNED_CUSTOMERS} angeheftete Kunden.`,409);
    await client.query('INSERT INTO platform.service_pinned_customers(user_id,source,customer_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[userId,source,id]);
   }else await client.query('DELETE FROM platform.service_pinned_customers WHERE user_id=$1 AND source=$2 AND customer_id=$3',[userId,source,id]);
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  return read(userId,source);
 }};
}
