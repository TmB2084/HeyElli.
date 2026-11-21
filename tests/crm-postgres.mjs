import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {customerNotesStore} from '../src/apps/servicehub/kunde360/notes-store.ts';
// Kunde 360: Notizen anlegen (geprüft, getrennt je Quelle), nur eigene löschen, Audit.
export async function checkCustomerNotes(pool){
 const users=(await pool.query('SELECT id FROM platform.users WHERE enabled ORDER BY id LIMIT 2')).rows.map(row=>row.id),store=customerNotesStore(pool),source='simulator|test-'+randomUUID();
 assert.equal(users.length,2);
 try{
  const first=await store.add(users[0],'Kim Muster',source,'K1','  Zugang über Werkschutz  ');
  assert.equal(first.body,'Zugang über Werkschutz');assert.equal(first.authorName,'Kim Muster');
  await store.add(users[1],'Robin Demo',source,'K1','Rückruf erbeten');
  await store.add(users[1],'Robin Demo',source+'-andere','K1','andere Quelle');
  const list=await store.list(source,'K1');assert.deepEqual(list.map(note=>note.body),['Rückruf erbeten','Zugang über Werkschutz']);
  await assert.rejects(store.add(users[0],'Kim Muster',source,'K1',' '),/2000 Zeichen/);
  await assert.rejects(store.add(users[0],'Kim Muster',source,'K1','x'.repeat(2001)),/2000 Zeichen/);
  await assert.rejects(store.remove(users[1],source,'K1',first.id),error=>error.status===403);
  await assert.rejects(store.remove(users[0],source,'K2',first.id),error=>error.status===404);
  await store.remove(users[0],source,'K1',first.id);
  assert.deepEqual((await store.list(source,'K1')).map(note=>note.body),['Rückruf erbeten']);
  const audit=(await pool.query("SELECT action FROM platform.audit_events WHERE target_id='K1' AND action LIKE 'crm.note-%'")).rows.map(row=>row.action);
  assert.ok(audit.includes('crm.note-add')&&audit.includes('crm.note-remove'));
 }finally{await pool.query('DELETE FROM platform.customer_notes WHERE source LIKE $1',[source+'%']);}
}
