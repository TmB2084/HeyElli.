import assert from 'node:assert/strict';
import {servicePins} from '../src/apps/servicehub/akten/pin-store.ts';
// Angeheftete Kunden: getrennt je Benutzer und Datenquelle, wiederholbar, Eingaben geprüft.
export async function checkServicePins(pool){
 const users=(await pool.query('SELECT id FROM platform.users ORDER BY id LIMIT 2')).rows.map(row=>row.id),store=servicePins(pool);
 assert.equal(users.length,2);
 try{
  await Promise.all([store.change(users[0],'simulator','fake-c1',true),store.change(users[0],'simulator','fake-c2',true)]);
  assert.deepEqual((await store.read(users[0],'simulator')).sort(),['fake-c1','fake-c2']);
  assert.equal((await store.read(users[1],'simulator')).length,0);assert.equal((await store.read(users[0],'pds:other')).length,0);
  await store.change(users[0],'simulator','fake-c1',true);assert.equal((await store.read(users[0],'simulator')).length,2);
  await store.change(users[0],'simulator','fake-c1',false);await store.change(users[0],'simulator','fake-c1',false);assert.deepEqual(await store.read(users[0],'simulator'),['fake-c2']);
  for(const input of [[['x'],true],['',true],['x'.repeat(201),true],['x','true'],['a\u0001b',true]])await assert.rejects(store.change(users[0],'simulator',...input),/Ungültige Auswahl/);
 }finally{await pool.query('DELETE FROM platform.service_pinned_customers WHERE user_id=ANY($1::text[])',[users]);}
}
