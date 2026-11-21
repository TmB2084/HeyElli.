import {createHash,randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import type {openOrderStore} from './order-store.ts';
type Store=ReturnType<typeof openOrderStore>;
export type HistoryActor={id:string;name:string};
type History={actor:HistoryActor;action:string;target:string;events:string[];changes:unknown[];at:string};
// Must be called inside the business transaction. No external action is retried.
export function queueServiceHistory(store:Store,value:Omit<History,'at'>){
 store.historyEnqueue(randomUUID(),JSON.stringify({...value,at:new Date().toISOString()}));
}
export async function deliverServiceHistory(store:Store,pool:Pool){
 for(const record of store.historyPending()){
  const value=JSON.parse(record.payload) as History,hash=createHash('sha256').update(record.payload).digest('hex');
  const client=await pool.connect();try{
   await client.query('BEGIN');
   const inserted=await client.query('INSERT INTO platform.service_history_deliveries(id,payload_hash) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id',[record.id,hash]);
   if(inserted.rowCount){
    await client.query('INSERT INTO platform.audit_events(actor_id,action,target_id,changes,created_at) VALUES($1,$2,$3,$4::jsonb,$5)',[value.actor.id,value.action,value.target,JSON.stringify(value.changes),value.at]);
    await client.query('INSERT INTO platform.calendar_history(event_id,actor_id,actor_name,changes,created_at) SELECT unnest($1::text[]),$2,$3,$4::jsonb,$5',[value.events,value.actor.id,value.actor.name,JSON.stringify(value.changes),value.at]);
   }else{
    const existing=await client.query('SELECT payload_hash FROM platform.service_history_deliveries WHERE id=$1',[record.id]);
    if(existing.rows[0]?.payload_hash!==hash)throw Error('Historienkennung stimmt nicht überein.');
   }
   await client.query('COMMIT');
   // A crash here is safe: the PostgreSQL receipt prevents duplicate entries.
   store.historyDelivered(record.id);
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
 }
 return store.historyPending().length===0;
}
