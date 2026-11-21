import assert from 'node:assert/strict';
import {serviceVisibility} from '../src/apps/servicehub/akten/visibility-store.ts';
export async function checkServiceVisibility(pool){
 const users=(await pool.query('SELECT id FROM platform.users ORDER BY id LIMIT 2')).rows.map(row=>row.id),store=serviceVisibility(pool);
 assert.equal(users.length,2);
 try{
  await Promise.all([store.change(users[0],'simulator','customer','fake-c',true),store.change(users[0],'simulator','object','fake-o',true)]);
  assert.equal((await store.read(users[0],'simulator')).length,2);assert.equal((await store.read(users[1],'simulator')).length,0);assert.equal((await store.read(users[0],'pds:other')).length,0);
  await store.change(users[0],'simulator','customer','fake-c',true);assert.equal((await serviceVisibility(pool).read(users[0],'simulator')).length,2);
  await store.change(users[0],'simulator','customer','fake-c',false);await store.change(users[0],'simulator','customer','fake-c',false);assert.deepEqual(await store.read(users[0],'simulator'),[{kind:'object',id:'fake-o'}]);
  for(const input of [[['customer'],'x',true],['order','x',true],['object','',true],['object','x'.repeat(201),true],['object','x','true']])await assert.rejects(store.change(users[0],'simulator',...input),/Ungültige/);
 }finally{await pool.query('DELETE FROM platform.service_hidden_entries WHERE user_id=ANY($1::text[])',[users]);}
}
