import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,writeFile,symlink,readFile,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {bmaRepository} from '../src/platform/bmacloud/repository.ts';
import {readConfig} from '../src/platform/bmacloud/configuration.ts';
import {maintainSecrets,restoreSecret,lockSecrets} from '../src/platform/secret-retention/lifecycle.ts';
export async function checkSecretRetention(pool){
 const folder=await mkdtemp(join(tmpdir(),'heyelli-secret-life-')),before={APP_ENV:process.env.APP_ENV,HEYELLI_TEST_SETTINGS_DIR:process.env.HEYELLI_TEST_SETTINGS_DIR};process.env.APP_ENV='test';process.env.HEYELLI_TEST_SETTINGS_DIR=folder;
 const admin=(await pool.query("SELECT id FROM platform.users WHERE enabled AND role='admin' LIMIT 1")).rows[0].id,reader=(await pool.query("SELECT id FROM platform.users WHERE enabled AND role<>'admin' LIMIT 1")).rows[0].id;
 const original=(await pool.query("SELECT * FROM platform.bmacloud_settings WHERE id='central'")).rows[0];let trigger=false;
 try{
  const store=bmaRepository(pool);for(let i=0;i<4;i++){const row=(await pool.query("SELECT version FROM platform.bmacloud_settings WHERE id='central'")).rows[0];await store.save(admin,{version:row.version,baseUrl:'https://fictional-bma.invalid/',token:'fictional-rotation-'+i});}
  const row=(await pool.query("SELECT * FROM platform.bmacloud_settings WHERE id='central'")).rows[0],active=row.config_id,master=await readFile(join(folder,'.local/bmacloud-secrets/master.key'));
  assert.equal((await pool.query("SELECT count(*)::int n FROM platform.secret_archives WHERE provider='bmacloud'")).rows[0].n,2);
  const masterPath=join(folder,'.local/bmacloud-secrets/master.key');await rename(masterPath,masterPath+'.protected-backup');
  const priorFiles=await readdir(folder);await assert.rejects(store.save(admin,{version:row.version,baseUrl:'https://fictional-bma.invalid/',token:'fictional-missing-key'}),error=>error.status===503);assert.deepEqual(await readdir(folder),priorFiles);await rename(masterPath+'.protected-backup',masterPath);assert.deepEqual(await readFile(masterPath),master);
  await pool.query("CREATE FUNCTION public.reject_secret_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Fictitious transaction failure'; END $$");await pool.query('CREATE TRIGGER reject_secret_test BEFORE UPDATE ON platform.bmacloud_settings FOR EACH ROW EXECUTE FUNCTION public.reject_secret_test()');trigger=true;
  await assert.rejects(store.save(admin,{version:row.version,baseUrl:'https://fictional-bma.invalid/',token:'fictional-failed-rotation'}));
  await pool.query('DROP TRIGGER reject_secret_test ON platform.bmacloud_settings');await pool.query('DROP FUNCTION public.reject_secret_test()');trigger=false;
  assert.equal((await pool.query("SELECT config_id FROM platform.bmacloud_settings WHERE id='central'")).rows[0].config_id,active);assert.equal(readConfig(active).token,'fictional-rotation-3');
  const unsafe='.env.bmacloud.'+randomUUID()+'.local',foreign='.env.graph.'+randomUUID()+'.local',link='.env.bmacloud.'+randomUUID()+'.local';await writeFile(join(folder,unsafe),'fictional unsafe file',{mode:0o644});await writeFile(join(folder,foreign),'unrelated',{mode:0o600});await symlink(join(folder,foreign),join(folder,link));
  const start=new Date(),first=await maintainSecrets(pool,admin,'bmacloud',start);assert.equal(first.removed,0);assert.equal(first.quarantined,2);assert.equal(first.skipped,2);
  await assert.rejects(maintainSecrets(pool,reader,'bmacloud'),e=>e.status===403);
  const second=await maintainSecrets(pool,admin,'bmacloud',new Date(start.getTime()+25*3600000));assert.equal(second.removed,2);assert.equal(readConfig(active).token,'fictional-rotation-3');assert.deepEqual(await readFile(join(folder,'.local/bmacloud-secrets/master.key')),master);assert.equal(await readFile(join(folder,foreign),'utf8'),'unrelated');assert.ok((await readdir(folder)).includes(link));
  await restoreSecret(pool,admin,'bmacloud',row.version);const restored=(await pool.query("SELECT * FROM platform.bmacloud_settings WHERE id='central'")).rows[0];assert.equal(restored.enabled,false);assert.equal(restored.tested_version,null);assert.equal(readConfig(restored.config_id).token,'fictional-rotation-2');assert.ok(!JSON.stringify(second).includes('fictional-rotation'));
  // Cleanup waits for a file-publication transaction, rather than scanning a
  // half-written configuration from another process.
  const client=await pool.connect();await client.query('BEGIN');await lockSecrets(client,'bmacloud');let finished=false;const waiting=maintainSecrets(pool,admin,'bmacloud').then(()=>{finished=true;});await new Promise(r=>setTimeout(r,20));assert.equal(finished,false);await client.query('ROLLBACK');client.release();await waiting;
  const owned=(await readdir(folder)).filter(name=>/^\.env\.bmacloud\.[a-f0-9-]{36}\.local$/.test(name));for(let i=owned.length;i<1000;i++)await writeFile(join(folder,'.env.bmacloud.'+randomUUID()+'.local'),'fictitious unreachable orphan',{mode:0o600});
  await assert.rejects(store.save(admin,{version:restored.version,baseUrl:'https://fictional-bma.invalid/',token:'fictional-full-capacity'}),e=>e.status===413);assert.equal((await pool.query("SELECT config_id FROM platform.bmacloud_settings WHERE id='central'")).rows[0].config_id,restored.config_id);
 }finally{
  if(trigger){await pool.query('DROP TRIGGER IF EXISTS reject_secret_test ON platform.bmacloud_settings');await pool.query('DROP FUNCTION IF EXISTS public.reject_secret_test()');}
  await pool.query("UPDATE platform.bmacloud_settings SET config_id=$1,version=$2,enabled=$3,tested_at=$4,tested_version=$5 WHERE id='central'",[original.config_id,original.version,original.enabled,original.tested_at,original.tested_version]);await pool.query("DELETE FROM platform.secret_archives WHERE provider='bmacloud'");await pool.query("DELETE FROM platform.secret_orphans WHERE provider='bmacloud'");for(const [name,value]of Object.entries(before)){if(value===undefined)delete process.env[name];else process.env[name]=value;}await rm(folder,{recursive:true,force:true});
 }
}
