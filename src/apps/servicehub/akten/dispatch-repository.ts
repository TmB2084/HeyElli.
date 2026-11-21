import type {Pool} from 'pg';
import {createHash} from 'node:crypto';
import {PlatformError} from '../../../platform/store/model.ts';
import type {DispatchReference,DispatchSelection} from './dispatch-model.ts';
export const dispatchRefKey=(ref:DispatchReference)=>createHash('sha256').update(JSON.stringify([ref.provider,ref.target,ref.library,ref.id])).digest('hex');
export function dispatchRepository(pool:Pool){
 async function read(scope:string):Promise<DispatchSelection[]>{return (await pool.query('SELECT ref_key AS key,reference,selected,version FROM platform.dispatch_pack_refs WHERE scope_key=$1 ORDER BY ref_key LIMIT 500',[scope])).rows;}
 return {read,async change(scope:string,source:string,orderId:string,actor:string,reference:DispatchReference,selected:boolean,version:number){
  if(!/^[a-f0-9]{64}$/.test(scope)||!['pds','sharepoint'].includes(reference.provider)||Object.values(reference).some(value=>typeof value!=='string'||value.length>500||/[\x00-\x1f]/.test(value))||!reference.id||!reference.target||typeof selected!=='boolean'||!Number.isSafeInteger(version)||version<0)throw new PlatformError('Ungültige Dokumentauswahl.');
  const key=dispatchRefKey(reference),client=await pool.connect();try{await client.query('BEGIN');await client.query('INSERT INTO platform.dispatch_packs(scope_key,source,order_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[scope,source,orderId]);await client.query('SELECT scope_key FROM platform.dispatch_packs WHERE scope_key=$1 FOR UPDATE',[scope]);
   const previous=(await client.query('SELECT selected,version,reference FROM platform.dispatch_pack_refs WHERE scope_key=$1 AND ref_key=$2',[scope,key])).rows[0];
   if(previous&&version>previous.version)throw new PlatformError('Ungültiger Versionsstand der Dokumentauswahl.',409);
   if(previous?.selected===selected){await client.query('COMMIT');return {key,reference:previous.reference,selected,version:previous.version} as DispatchSelection;}
   if((previous?.version??0)!==version)throw new PlatformError('Die Dokumentauswahl wurde inzwischen geändert. Der aktuelle Stand wird neu geladen; bitte erneut auswählen.',409);
   const count=(await client.query('SELECT count(*)::integer AS all_refs,count(*) FILTER(WHERE selected)::integer AS selected FROM platform.dispatch_pack_refs WHERE scope_key=$1',[scope])).rows[0];
   if(!previous&&count.all_refs>=500||selected&&count.selected>=100)throw new PlatformError('Auswahlkontingent erreicht: maximal 100 ausgewählte und 500 verwaltete Dokumentverweise pro Einsatzmappe. Bestehende Auswahl bleibt erhalten.',409);
   const result=(await client.query('INSERT INTO platform.dispatch_pack_refs(scope_key,ref_key,reference,selected,actor_id) VALUES($1,$2,$3::jsonb,$4,$5) ON CONFLICT(scope_key,ref_key) DO UPDATE SET selected=EXCLUDED.selected,version=platform.dispatch_pack_refs.version+1,actor_id=EXCLUDED.actor_id,updated_at=now() RETURNING version',[scope,key,JSON.stringify(reference),selected,actor])).rows[0];
   await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,'service.dispatch.selection',$2,$3::jsonb)",[actor,scope,JSON.stringify([{field:key,label:'Dokumentauswahl der Einsatzmappe',before:{provider:reference.provider,id:reference.id,selected:previous?.selected??false},after:{provider:reference.provider,id:reference.id,selected}}])]);await client.query('COMMIT');return {key,reference,selected,version:result.version} as DispatchSelection;
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }};
}
