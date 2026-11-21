import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {postgresSettings,settingsOwner} from '../src/apps/planboard/kalender/setup.ts';
import {defaultColorLayouts} from '../src/apps/planboard/kalender/color-layout.ts';
const alex='demo-ad:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',kim='demo-ad:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export async function checkPostgresSettings(t,pool) {
 const root=await mkdtemp(join(tmpdir(),'heyelli-settings-test-'));
 const directory=join(root,'resource-selections');await mkdir(directory);
 const colorFile=join(root,'calendar-colors.json'),layout=defaultColorLayouts();layout.SERVICEAUFTRAGEBENE={main:'status',secondary:'category'};
 const raw={rules:[{typ:'FREIER',farbe:'#123456'},{orderStatusName:'Offen',farbe:'#abcdef'}],colorLayouts:layout};
 const alexPrefs={selection:[],showTechnicianBadges:false,limitWorkingHours:true,showTentative:false};
 const kimPrefs={selection:['missing-resource','uuid-2'],showTechnicianBadges:true,limitWorkingHours:false,showTentative:true};
 const catalogs=[{type:'SERVICE',statuses:[{id:'status-open',name:'Offen'}]}];
 const store=postgresSettings(pool,root);
 try {
  await writeFile(colorFile,JSON.stringify(raw));await writeFile(join(directory,settingsOwner(alex)+'.json'),JSON.stringify(alexPrefs));
  await writeFile(join(directory,settingsOwner(kim)+'.json'),JSON.stringify(kimPrefs));
  const orphan=settingsOwner('unprovisioned-legacy-user');await writeFile(join(directory,orphan+'.json'),JSON.stringify({selection:null}));
  await t.test('legacy import is complete, repeatable, preserves files and unprovisioned owners',async()=>{
   const original=await readFile(colorFile,'utf8');assert.equal((await store.importLegacy()).importedUsers,3);assert.equal((await store.importLegacy()).importedUsers,0);
   assert.equal(await readFile(colorFile,'utf8'),original);assert.equal((await pool.query('SELECT count(*)::int AS n FROM platform.user_preferences WHERE owner_hash=$1',[orphan])).rows[0].n,1);
   assert.deepEqual(await store.selectionStore.readSettings(alex),{...alexPrefs,version:1});assert.deepEqual(await store.selectionStore.readSettings(kim),{...kimPrefs,version:1});
   const colors=await store.colorStore.readWithCatalogs(catalogs);assert.deepEqual(colors.colorLayouts,layout);assert.equal(colors.rules.find(rule=>rule.typ==='FREIER').farbe,'#123456');assert.equal(colors.rules.find(rule=>rule.orderStatus==='status-open').farbe,'#abcdef');
  });
  await t.test('PostgreSQL settings win over changed or broken legacy files after import',async()=>{
   await writeFile(colorFile,'broken');await writeFile(join(directory,settingsOwner(alex)+'.json'),'broken');
   const current=await store.colorStore.readWithCatalogs(catalogs),saved=await store.colorStore.write([{typ:'FREIER',farbe:'#654321'}],current.version,layout);
   assert.equal((await store.colorStore.readWithCatalogs(catalogs)).version,saved.version);
   const selection=await store.selectionStore.update(alex,{showTechnicianBadges:true},1);assert.deepEqual(selection,{...alexPrefs,showTechnicianBadges:true,version:2});
   await store.importLegacy();assert.equal((await store.selectionStore.readSettings(alex)).version,2);assert.equal(await readFile(colorFile,'utf8'),'broken');
  });
  await t.test('concurrent color writers reject stale versions instead of overwriting each other',async()=>{
   const current=await store.colorStore.readWithCatalogs(catalogs);
   const results=await Promise.allSettled([store.colorStore.write([{typ:'FREIER',farbe:'#223344'}],current.version,layout),postgresSettings(pool,root).colorStore.write([{typ:'FREIER',farbe:'#334455'}],current.version,layout)]);
   assert.equal(results.filter(item=>item.status==='fulfilled').length,1);assert.equal(results.find(item=>item.status==='rejected').reason.status,409);
  });
  await t.test('calendar preferences are isolated and stale concurrent updates are rejected',async()=>{
   const current=await store.selectionStore.readSettings(alex),other=await store.selectionStore.readSettings(kim);
   const results=await Promise.allSettled([store.selectionStore.update(alex,{showTentative:true},current.version),store.selectionStore.update(alex,{limitWorkingHours:false},current.version)]);
   assert.equal(results.filter(item=>item.status==='fulfilled').length,1);assert.equal(results.find(item=>item.status==='rejected').reason.status,409);assert.deepEqual(await store.selectionStore.readSettings(kim),other);
   await assert.rejects(store.selectionStore.update(kim,{selection:'all'},other.version));await assert.rejects(store.selectionStore.update(kim,{showTentative:'yes'},other.version));
  });
  await t.test('appearance is imported once; existing profiles win and versions are independent',async()=>{
   const current=await store.appearanceStore.read(alex);assert.equal(current.appearance,null);
   const imported=await store.appearanceStore.write(alex,'light',current.version,true);assert.equal(imported.appearance,'light');
   assert.deepEqual(await store.appearanceStore.write(alex,'dark',current.version,true),imported);
   const calendarBefore=await store.selectionStore.readSettings(alex);await store.appearanceStore.write(alex,'system',imported.version);assert.deepEqual(await store.selectionStore.readSettings(alex),calendarBefore);
   await assert.rejects(store.appearanceStore.write(alex,'dark',imported.version),error=>error.status===409);await assert.rejects(store.appearanceStore.write(alex,'unknown',3));assert.equal((await store.appearanceStore.read(kim)).appearance,null);
  });
  await t.test('a malformed unimported file aborts the complete import transaction',async()=>{
   const valid=settingsOwner('new-valid-profile'),invalid=settingsOwner('new-invalid-profile');
   const validFile=join(directory,valid+'.json'),invalidFile=join(directory,invalid+'.json');
   await writeFile(validFile,JSON.stringify({selection:[]}));await writeFile(invalidFile,'broken');
   const count=(await pool.query('SELECT count(*)::int AS n FROM platform.user_preferences')).rows[0].n;
   await assert.rejects(store.importLegacy());assert.equal((await pool.query('SELECT count(*)::int AS n FROM platform.user_preferences')).rows[0].n,count);assert.equal(await readFile(invalidFile,'utf8'),'broken');
   await rm(invalidFile);await rm(validFile);
  });
  await t.test('fresh users get defaults, and empty and dynamic selections remain distinct',async()=>{
   const id='brand-new-user',initial=await store.selectionStore.readSettings(id);assert.equal(initial.selection,null);assert.equal(initial.showTentative,true);
   const empty=await store.selectionStore.update(id,{selection:[]},initial.version);assert.deepEqual(empty.selection,[]);
   assert.equal((await store.selectionStore.update(id,{selection:null},empty.version)).selection,null);
  });
  let weekendPrefs;
  await t.test('weekend visibility persists per user without changing existing preferences',async()=>{
   const identity='weekend-visibility-test',initial=await store.selectionStore.readSettings(identity),other=await store.selectionStore.readSettings(kim);
   const hidden=await store.selectionStore.update(identity,{showWeekends:false},initial.version);assert.equal(hidden.showWeekends,false);assert.deepEqual(hidden.selection,initial.selection);
   weekendPrefs=await store.selectionStore.update(identity,{showTentative:false},hidden.version);assert.equal(weekendPrefs.showWeekends,false);assert.deepEqual(await store.selectionStore.readSettings(kim),other);
   await assert.rejects(store.selectionStore.update(identity,{showWeekends:'false'},weekendPrefs.version));await assert.rejects(store.selectionStore.update(identity,{showWeekends:true},initial.version),error=>error.status===409);
  });
  const colors=await store.colorStore.readWithCatalogs(catalogs),prefs=await store.selectionStore.readSettings(alex),appearance=await store.appearanceStore.read(alex);
  return async reopenedPool=>{
   const reopened=postgresSettings(reopenedPool,root);
   assert.deepEqual(await reopened.selectionStore.readSettings('weekend-visibility-test'),weekendPrefs);
   assert.deepEqual(await reopened.colorStore.readWithCatalogs(catalogs),colors);assert.deepEqual(await reopened.selectionStore.readSettings(alex),prefs);assert.deepEqual(await reopened.appearanceStore.read(alex),appearance);
  };
 }finally {await rm(root,{recursive:true,force:true});}
}
