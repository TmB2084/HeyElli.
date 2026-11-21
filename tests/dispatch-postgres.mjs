import assert from 'node:assert/strict';
import {dispatchRepository,dispatchRefKey} from '../src/apps/servicehub/akten/dispatch-repository.ts';
export async function checkDispatch(pool){
 const actor=(await pool.query('SELECT id FROM platform.users ORDER BY id LIMIT 1')).rows[0].id,scope='d'.repeat(64),store=dispatchRepository(pool),ref={provider:'pds',target:'pds',id:'fictitious-document',library:''},other={...ref,id:'another-document'};
 try{
  const first=await store.change(scope,'simulator','fictitious-order',actor,ref,true,0);assert.equal(first.version,1);
  assert.equal((await store.change(scope,'simulator','fictitious-order',actor,ref,true,0)).version,1);
  await Promise.all([store.change(scope,'simulator','fictitious-order',actor,ref,false,1),store.change(scope,'simulator','fictitious-order',actor,other,true,0)]);
  await assert.rejects(store.change(scope,'simulator','fictitious-order',actor,ref,true,1),e=>e.status===409);
  const saved=await dispatchRepository(pool).read(scope);assert.equal(saved.length,2);assert.equal(saved.find(row=>row.key===dispatchRefKey(ref)).selected,false);assert.equal(saved.find(row=>row.key===dispatchRefKey(other)).selected,true);assert.equal((await store.read('e'.repeat(64))).length,0);
  const audited=(await pool.query("SELECT changes FROM platform.audit_events WHERE target_id=$1 AND action='service.dispatch.selection' ORDER BY id",[scope])).rows;assert.equal(audited.length,3);const removal=audited.find(row=>row.changes[0].before.selected===true);assert.equal(removal.changes[0].after.selected,false);
  assert.ok(saved.every(row=>Object.keys(row.reference).sort().join(',')==='id,library,provider,target'));
  const results=await Promise.allSettled([store.change(scope,'simulator','fictitious-order',actor,ref,true,2),store.change(scope,'simulator','fictitious-order',actor,ref,true,2)]);assert.ok(results.every(row=>row.status==='fulfilled'));assert.equal((await store.read(scope)).find(row=>row.key===first.key).version,3);
 }finally{await pool.query('DELETE FROM platform.audit_events WHERE target_id=$1',[scope]);await pool.query('DELETE FROM platform.dispatch_pack_refs WHERE scope_key=$1',[scope]);await pool.query('DELETE FROM platform.dispatch_packs WHERE scope_key=$1',[scope]);}
}
