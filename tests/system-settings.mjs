import {createHash} from 'node:crypto';
import {platformRepository} from '../src/platform/store/repository.ts';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {systemSettingsRepository} from '../src/platform/store/setup.ts';
import {postgresSettings,settingsOwner} from '../src/apps/planboard/kalender/setup.ts';
export async function checkSystemSettings(t,pool) {
 const root=await mkdtemp(join(tmpdir(),'heyelli-defaults-test-')),system=systemSettingsRepository(pool),prefs=postgresSettings(pool,root);
 const admin=(await pool.query("SELECT id FROM platform.users WHERE role='admin' AND enabled ORDER BY id LIMIT 1")).rows[0].id;
 const dispatcher='local-service-user';
 try {
  const previous=await prefs.selectionStore.readSettings('previous-profile');
  await t.test('only administrators can change central defaults; invalid and stale writes fail',async()=>{
   const current=await system.read();
   await assert.rejects(system.save(dispatcher,{...current,defaultAppearance:'light'}),error=>error.status===403);
   await assert.rejects(system.save(admin,{...current,defaultAppearance:'invalid'}));
   const saved=await system.save(admin,{...current,defaultAppearance:'light',showTechnicianBadges:false,limitWorkingHours:true,showTentative:false});assert.equal(saved.version,current.version+1);
   await assert.rejects(system.save(admin,current),error=>error.status===409);
   assert.deepEqual(await prefs.selectionStore.readSettings('previous-profile'),previous);
  });
  await t.test('session duration validates bounds, applies to new logins and preserves existing expiries',async()=>{
   const current=await system.read(),sessions=platformRepository(pool),identity={id:admin,role:'admin',mode:'local'};
   for(const minutes of [0,4,1441,10.5,'60'])await assert.rejects(system.save(admin,{...current,sessionDurationMinutes:minutes}));
   const old=await sessions.issueSession(identity),before=old.expiresAt.toISOString();
   const saved=await system.save(admin,{...current,sessionDurationMinutes:90});const fresh=await sessions.issueSession(identity);
   const row=(await pool.query("SELECT extract(epoch FROM (expires_at-created_at))/60 AS minutes FROM platform.sessions WHERE token_hash=$1",[createHash('sha256').update(fresh.token).digest('hex')])).rows[0];assert.equal(Number(row.minutes),90);assert.ok(await sessions.read(old.token));assert.equal((await pool.query('SELECT expires_at FROM platform.sessions WHERE token_hash=$1',[createHash('sha256').update(old.token).digest('hex')])).rows[0].expires_at.toISOString(),before);
   await system.save(admin,{...saved,sessionDurationMinutes:current.sessionDurationMinutes});
  });
  await t.test('new profiles inherit system defaults while legacy profiles keep their values',async()=>{
   const fresh=await prefs.selectionStore.readSettings('fresh-profile');assert.equal(fresh.showTentative,false);assert.equal(fresh.limitWorkingHours,true);assert.equal(fresh.showTechnicianBadges,false);
   await mkdir(join(root,'resource-selections'));
   await writeFile(join(root,'resource-selections',settingsOwner('legacy-profile')+'.json'),JSON.stringify({selection:[]}));
   const legacy=await prefs.selectionStore.readSettings('legacy-profile');assert.equal(legacy.showTentative,true);assert.equal(legacy.showTechnicianBadges,true);assert.equal(legacy.limitWorkingHours,false);assert.deepEqual(legacy.selection,[]);
   const events=await pool.query("SELECT action FROM platform.audit_events WHERE action='settings.updated'");assert.ok(events.rowCount>0);
  });
  const expected=await system.read();return async reopenedPool=>assert.deepEqual(await systemSettingsRepository(reopenedPool).read(),expected);
 }finally{await rm(root,{recursive:true,force:true});}
}
