import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createWorkspace,calendarSourcePool,workspaceSchema} from '../src/platform/pds/connection/source.ts';
import {postgresSettings} from '../src/apps/planboard/kalender/postgres-settings.ts';
export async function checkSourceIsolation(pool){
 const root=await mkdtemp(join(tmpdir(),'pds-source-settings-')),id=randomUUID(),other=randomUUID(),client=await pool.connect();
 try{await client.query('BEGIN');await createWorkspace(client,id);await createWorkspace(client,other);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 try{
  const identity='source-isolation-user',simulator=postgresSettings(pool,root),real=postgresSettings(calendarSourcePool(pool,id),root),second=postgresSettings(calendarSourcePool(pool,other),root);
  const original=await simulator.selectionStore.readSettings(identity);await simulator.selectionStore.update(identity,{selection:['simulated-resource']},original.version);
  const fresh=await real.selectionStore.readSettings(identity);assert.equal(fresh.selection,null);await real.selectionStore.update(identity,{selection:['real-resource']},fresh.version);
  assert.deepEqual((await simulator.selectionStore.readSettings(identity)).selection,['simulated-resource']);assert.deepEqual((await real.selectionStore.readSettings(identity)).selection,['real-resource']);assert.equal((await second.selectionStore.readSettings(identity)).selection,null);
  const colors=await simulator.colorStore.readWithCatalogs([]),freshColors=await real.colorStore.readWithCatalogs([]);await real.colorStore.write([...freshColors.rules.filter(rule=>rule.typ!=='FREIER'),{typ:'FREIER',farbe:'#123456'}],freshColors.version,freshColors.colorLayouts);
  assert.deepEqual((await simulator.colorStore.readWithCatalogs([])).rules,colors.rules);assert.equal((await real.colorStore.readWithCatalogs([])).rules.find(rule=>rule.typ==='FREIER').farbe,'#123456');
  assert.throws(()=>workspaceSchema('invalid;DROP SCHEMA platform'));
 }finally{await rm(root,{recursive:true,force:true});}
}
