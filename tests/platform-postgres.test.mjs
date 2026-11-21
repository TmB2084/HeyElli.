import {checkServiceHistory} from './service-history-postgres.mjs';
import {checkBackupMonitor} from './backup-monitor-postgres.mjs';
import {checkIncidentDefaults} from './incident-defaults-postgres.mjs';
import {checkPersonalNotes} from './personal-notes-postgres.mjs';
import {checkTools} from './tools-postgres.mjs';
import {checkConfirmation} from './confirmation-postgres.mjs';
import {checkDispatch} from './dispatch-postgres.mjs';
import {checkServiceVisibility} from './service-visibility-postgres.mjs';
import {checkServicePins} from './service-pins-postgres.mjs';
import {checkMaildesk,checkMaildeskSettings} from './maildesk-postgres.mjs';
import {checkTaskExtras} from './tasks-postgres.mjs';
import {checkCustomerNotes} from './crm-postgres.mjs';
import {checkMissionStore} from './mission-postgres.mjs';
import {checkMissionGoals} from './mission-goals-postgres.mjs';
import {checkSharePoint} from './sharepoint-postgres.mjs';
import {checkOperations} from './operations-postgres.mjs';
import {checkResourceBudgets} from './resource-budgets-postgres.mjs';
import {checkBrowserReports} from './browser-reports-postgres.mjs';
import {checkDataLifecycle} from './data-lifecycle-postgres.mjs';
import {checkBackupRestore} from './backup-postgres.mjs';
import {checkPdsGraphSecrets} from './pds-graph-secrets-postgres.mjs';
import {checkSecretRetention} from './secret-retention-postgres.mjs';
import {checkPrivateDrafts} from './private-drafts-postgres.mjs';
import {appRoleRepository} from '../src/platform/app-access/repository.ts';
import {appUsage} from '../src/platform/store/app-usage.ts';
import {launcherPreferences} from '../src/platform/store/launcher-preferences.ts';
import {checkMicrosoftAuth} from './microsoft-auth-postgres.mjs';
import {defaultDutyHolidays} from '../src/apps/planboard/kalender/duty-holidays.ts';
import {dutyResourcePreferences} from '../src/apps/dutyboard/resource-preferences.ts';
import {calendarChangeAudit} from "../src/apps/planboard/kalender/change-audit.ts";
import {test} from 'node:test';
import {checkSystemSettings} from './system-settings.mjs';
import {checkPostgresSettings} from './postgres-settings.mjs';
import {checkPlatformHttp} from './platform-http.mjs';
import {databaseConfig} from '../src/platform/store/config.ts';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Pool} from 'pg';
import {platformRepository} from '../src/platform/store/repository.ts';
import {permitted,userInput} from '../src/platform/store/model.ts';
import {assignPds} from './support/pds-assignment.mjs';
const alex='demo-ad:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',kim='demo-ad:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const identity={id:alex,role:'admin',mode:'local',pdsUserUUID:'11111111-1111-4111-8111-111111111111'};
test('PostgreSQL identity, permissions, revocation and persistence in an isolated database',{skip:!process.env.HEYELLI_TEST_DATABASE_URL},async t=>{
 const url=new URL(process.env.HEYELLI_TEST_DATABASE_URL??'http://invalid');
 assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/heyelli_test');assert.equal(url.username,'heyelli_test');
 let pool=new Pool({connectionString:url.href}),store=platformRepository(pool),persistentRoleId;
 async function migrate(){
  const client=await pool.connect();
  try {
   await client.query('BEGIN');
   await client.query('CREATE TABLE IF NOT EXISTS public.schema_migrations(name text PRIMARY KEY,checksum text NOT NULL)');
   for(const name of (await readdir('database/migrations')).filter(name=>/^\d+_[a-z0-9_]+\.sql$/.test(name)).sort()){
    const sql=await readFile('database/migrations/'+name,'utf8'),checksum=createHash('sha256').update(sql).digest('hex');
    const old=await client.query('SELECT checksum FROM public.schema_migrations WHERE name=$1',[name]);
    if(old.rowCount)assert.equal(old.rows[0].checksum,checksum);
    else {await client.query(sql);await client.query('INSERT INTO public.schema_migrations VALUES($1,$2)',[name,checksum]);}
   }
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
 async function seed(){for(const name of ['examples.sql','platform_examples.sql'])await pool.query(await readFile('database/seeds/'+name,'utf8'));}
 try {
  await t.test('configuration refuses production and non-isolated test databases',()=>{
   assert.throws(()=>databaseConfig({NODE_ENV:'production'}));
   assert.throws(()=>databaseConfig({APP_ENV:'test',HEYELLI_TEST_DATABASE_URL:'postgresql://heyelli_test@127.0.0.1/development'}));
   assert.throws(()=>databaseConfig({APP_ENV:'test',HEYELLI_TEST_DATABASE_URL:'postgresql://other@127.0.0.1/heyelli_test'}));
   assert.equal(permitted({role:'unknown'},'read'),false);
  });
  await t.test('migrations and fictional seeds are repeatable',async()=>{await migrate();await migrate();await seed();await seed();assert.equal((await pool.query('SELECT count(*)::int AS n FROM platform.users')).rows[0].n,3);});
  await t.test('personal notes persist, isolate owners, reject stale overwrites and export privately',()=>checkPersonalNotes(pool));
  await t.test('menu tool grants, own preferences and independent app rights persist',()=>checkTools(pool));
  await t.test('custom app roles preserve admin access, isolate users and revoke stale sessions',async()=>{
   const roles=appRoleRepository(pool);assert.deepEqual((await roles.read()).roles.find(r=>r.id==='reader').write_apps,[]);assert.ok((await roles.read()).roles.find(r=>r.id==='dispatcher').write_apps.includes('/planboard'));const id='demo-ad:cccccccc-cccc-4ccc-8ccc-cccccccccccc';
   await pool.query("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktiver Rollenprüfer','reader',true)",[id]);await assignPds(pool,id);
   try{
    const created=await roles.mutate(alex,{action:'save',name:'Fiktive Servicerolle',writeApps:['/servicehub'],apps:['/servicehub','/planboard']});
    let account=(await store.overview(alex)).users.find(user=>user.id===id);
    assert.ok((await store.overview(alex)).appRoles.some(role=>role.id===created.id));
    account=await store.saveUser(alex,{...account,appRoleId:created.id});assert.equal(account.appRoleId,created.id);assert.equal(account.role,'dispatcher');
    const beforeChange=await store.issue({id,role:'dispatcher',mode:'local',pdsUserUUID:'fictional'});
    account=await store.saveUser(alex,{...account,appRoleId:null,role:'dispatcher'});assert.equal(account.appRoleId,null);assert.equal(await store.read(beforeChange),null);
    account=await store.saveUser(alex,{...account,appRoleId:created.id});
    account=await store.saveUser(alex,{...account,enabled:false});assert.equal(account.appRoleId,created.id);
    account=await store.saveUser(alex,{...account,enabled:true});
    await assert.rejects(store.saveUser(alex,{...account,appRoleId:'00000000-0000-4000-8000-000000000000'}),e=>e.status===404);
    await assert.rejects(store.saveUser(alex,{...(await store.overview(alex)).users.find(user=>user.id===alex),appRoleId:created.id}),e=>e.status===409);
    await assert.rejects(store.saveUser(id,{...account,appRoleId:null}),e=>e.status===403);
    assert.deepEqual(await roles.allowed(id),['/servicehub','/planboard']);assert.equal(await roles.can(id,'/servicehub'),true);assert.equal(await roles.can(id,'/planboard'),false);assert.equal(await roles.can(id,'/planboard','read'),true);await assert.rejects(roles.mutate(alex,{action:'save',name:'Verbotene Rechte',apps:['/hilfe'],writeApps:['/hilfe']}),e=>e.status===400);await assert.rejects(roles.mutate(alex,{action:'save',name:'Verbotene Teilmenge',apps:['/servicehub'],writeApps:['/planboard']}),e=>e.status===400);assert.ok((await roles.allowed(alex)).includes('/einstellungen'));
    let user=(await pool.query('SELECT * FROM platform.users WHERE id=$1',[id])).rows[0];assert.equal(user.role,'dispatcher');
    await assert.rejects(roles.mutate(id,{action:'save',name:'Verboten',writeApps:[],apps:[]}),e=>e.status===403);
    const issued=await store.issue({id,role:'dispatcher',mode:'local',pdsUserUUID:'fictional'});assert.ok(await store.read(issued));
    let role=(await roles.read()).roles.find(r=>r.id===created.id);
    await assert.rejects(roles.mutate(alex,{action:'delete',id:role.id,version:role.version}),e=>e.status===409);
    await roles.mutate(alex,{action:'save',id:role.id,version:role.version,name:role.name,writeApps:[],apps:[]});
    assert.equal(await store.read(issued),null);assert.deepEqual(await roles.allowed(id),[]);assert.equal((await pool.query('SELECT role FROM platform.users WHERE id=$1',[id])).rows[0].role,'reader');
    await assert.rejects(roles.mutate(alex,{action:'save',id:role.id,version:role.version,name:role.name,writeApps:[],apps:['/servicehub']}),e=>e.status===409);
    user=(await pool.query('SELECT * FROM platform.users WHERE id=$1',[id])).rows[0];await roles.mutate(alex,{action:'assign',roleId:'reader',userId:id,version:user.version});
    role=(await roles.read()).roles.find(r=>r.id===created.id);await roles.mutate(alex,{action:'delete',id:role.id,version:role.version});
   }finally{await pool.query('DELETE FROM platform.sessions WHERE user_id=$1',[id]);await pool.query('DELETE FROM platform.users WHERE id=$1',[id]);await pool.query("DELETE FROM platform.app_roles WHERE name='Fiktive Servicerolle'");}
  });
  persistentRoleId=(await appRoleRepository(pool).mutate(alex,{action:'save',name:'Fiktive dauerhafte App-Rechte',apps:['/servicehub','/planboard'],writeApps:['/servicehub']})).id;
  await t.test('app usage is atomic, user scoped and survives repeated seeds',async()=>{
   const usage=appUsage(pool);await Promise.all(Array.from({length:8},()=>usage.record(alex,'/servicehub')));await usage.record(kim,'/hilfe');
   assert.equal((await usage.read(alex))['/servicehub'],8);assert.equal((await usage.read(kim))['/servicehub'],undefined);
   await seed();await seed();assert.equal((await usage.read(alex))['/servicehub'],8);
   const other=new Pool({connectionString:url.href});try{assert.equal((await appUsage(other).read(alex))['/servicehub'],8);}finally{await other.end();}
   await assert.rejects(usage.record(alex,'https://untrusted.invalid'));
  });
  await t.test('launcher view defaults to grid, persists per user and rejects stale or invalid writes',async()=>{
   const prefs=launcherPreferences(pool);assert.deepEqual(await prefs.read(alex),{view:'grid',version:0});
   const saved=await prefs.write(alex,'list',0);assert.equal(saved.view,'list');assert.equal(saved.version,1);
   assert.deepEqual(await prefs.read(kim),{view:'grid',version:0});
   await assert.rejects(prefs.write(alex,'grid',0),error=>error.status===409);
   await assert.rejects(prefs.write(alex,'unknown',1));await assert.rejects(prefs.write(alex,'grid',-1));
   const parallel=await Promise.allSettled([prefs.write(alex,'grid',1),prefs.write(alex,'list',1)]);assert.equal(parallel.filter(item=>item.status==='fulfilled').length,1);
   const current=await prefs.read(alex);await prefs.write(alex,'list',current.version);
   const fresh=new Pool({connectionString:url.href});try{assert.equal((await launcherPreferences(fresh).read(alex)).view,'list');}finally{await fresh.end();}
   await seed();assert.equal((await prefs.read(alex)).view,'list');
  });
  await t.test('duty selections persist per user, stay separate from calendar and reject stale writers',async()=>{
   const preferences=dutyResourcePreferences(pool),calendarBefore=await pool.query('SELECT * FROM platform.user_preferences');
   assert.deepEqual(await preferences.read(alex),{selection:null,version:0});
   const first=await preferences.write(alex,['fictional-a','fictional-a'],0);assert.deepEqual(first.selection,['fictional-a']);assert.equal(first.version,1);
   await preferences.write(kim,[],0);assert.deepEqual((await preferences.read(kim)).selection,[]);
   const parallel=await Promise.allSettled([preferences.write(alex,['fictional-b'],1),preferences.write(alex,['fictional-c'],1)]);assert.equal(parallel.filter(result=>result.status==='fulfilled').length,1);assert.equal(parallel.filter(result=>result.status==='rejected'&&result.reason.status===409).length,1);
   const current=await preferences.read(alex);await assert.rejects(preferences.write(alex,[''],current.version));await assert.rejects(preferences.write(alex,{},current.version));
   const all=await preferences.write(alex,null,current.version);assert.equal(all.selection,null);
   await preferences.write(alex,['fictional-persistent'],all.version);
   const fresh=new Pool({connectionString:url.href});try{assert.deepEqual((await dutyResourcePreferences(fresh).read(alex)).selection,['fictional-persistent']);}finally{await fresh.end();}
   assert.deepEqual((await pool.query('SELECT * FROM platform.user_preferences')).rows,calendarBefore.rows);
  });
  await t.test('holiday preferences persist per user with independent versions and stale-write protection',async()=>{
   const preferences=dutyResourcePreferences(pool),selectionBefore=await preferences.read(alex);assert.deepEqual((await preferences.readHolidays(alex)).holidays,defaultDutyHolidays);
   const options={...defaultDutyHolidays,enabled:true,state:'BY',historyYears:8,localAssumption:true,localPeace:true,weights:{...defaultDutyHolidays.weights,newYear:7,christmas:9}};
   const saved=await preferences.writeHolidays(alex,options,0);assert.deepEqual(saved.holidays,options);assert.equal(saved.version,1);
   await preferences.writeHolidays(kim,{...defaultDutyHolidays,state:'SN',localCorpus:true},0);assert.equal((await preferences.readHolidays(kim)).holidays.state,'SN');
   const results=await Promise.allSettled([preferences.writeHolidays(alex,options,1),preferences.writeHolidays(alex,{...options,historyYears:3},1)]);assert.equal(results.filter(item=>item.status==='fulfilled').length,1);assert.equal(results.filter(item=>item.status==='rejected'&&item.reason.status===409).length,1);
   const current=await preferences.readHolidays(alex);await assert.rejects(preferences.writeHolidays(alex,{...options,historyYears:99},current.version));await assert.rejects(preferences.writeHolidays(alex,undefined,current.version));await preferences.writeHolidays(alex,options,current.version);
   assert.deepEqual(await preferences.read(alex),selectionBefore);
   const fresh=new Pool({connectionString:url.href});try{assert.deepEqual((await dutyResourcePreferences(fresh).readHolidays(alex)).holidays,options);}finally{await fresh.end();}
  });
  await t.test('calendar field attribution persists and never credits an unrelated current value',async()=>{
   const audit=calendarChangeAudit(pool),before={id:'audit-example',title:'Original',notes:'Text',start:'2026-11-06T08:00:00Z',end:'2026-11-06T09:00:00Z',resourceIds:['one'],type:'FREIER',status:'GEPLANT',fixed:false,allDay:false,categories:[]},after={...before,title:'Gespeichert'};
   await audit.record(alex,before,after);const first=(await audit.read(after,['title'])).title;assert.equal(first.source,'saved');assert.ok(first.at);assert.ok(first.displayName);
   await audit.record(kim,after,after);assert.deepEqual((await audit.read(after,['title'])).title,first);
   const other={...after,title:'Neuere Version'};await audit.record(kim,after,other);assert.equal((await audit.read(after,['title'])).title.source,'unknown');assert.equal((await audit.read(other,['title'])).title.source,'saved');
   const history=await audit.history(before.id);assert.equal(history.length,2);assert.equal(history[0].changes[0].before,'Gespeichert');assert.equal(history[0].changes[0].after,'Neuere Version');assert.ok(history[0].actorName);assert.ok(history[0].at);assert.equal(history[1].changes[0].before,'Original');assert.equal(history[1].changes[0].after,'Gespeichert');assert.deepEqual(await audit.history('unrelated-event'),[]);
   const freshPool=new Pool({connectionString:url.href});try{assert.equal((await calendarChangeAudit(freshPool).read(other,['title'])).title.source,'saved');assert.equal((await calendarChangeAudit(freshPool).history(before.id)).length,2);await audit.mobile(alex,before.id,'one');const mobile=(await calendarChangeAudit(freshPool).history(before.id))[0];assert.equal(mobile.changes[0].label,'Mobil ausgegeben');assert.equal(mobile.changes[0].after,'one');assert.ok(mobile.actorName);assert.ok(mobile.at);}finally{await freshPool.end();}
  });
  await t.test('duty plan progress persists and only one active plan exists per year',async()=>{
   const id='00000000-0000-4000-8000-000000000060';
   await pool.query('INSERT INTO platform.duty_plans(id,actor_id,year,category_id,payload) VALUES($1,$2,2050,$3,$4::jsonb)',[id,alex,'fictional-duty',JSON.stringify([{day:'2050-01-03',createdId:'saved-event'}])]);
   await assert.rejects(pool.query('INSERT INTO platform.duty_plans(id,actor_id,year,category_id,payload) VALUES($1,$2,2050,$3,$4::jsonb)',['00000000-0000-4000-8000-000000000061',kim,'fictional-duty','[]']));
   const fresh=new Pool({connectionString:url.href});try{const row=(await fresh.query('SELECT payload,cursor FROM platform.duty_plans WHERE id=$1',[id])).rows[0];assert.equal(row.payload[0].createdId,'saved-event');assert.equal(row.cursor,0);}finally{await fresh.end();}
   await pool.query('UPDATE platform.duty_plans SET complete=true,cursor=1 WHERE id=$1',[id]);
  });
  await t.test('roles have bounded permissions and forged role input cannot grant access',async()=>{
   assert.equal(permitted(null,'read'),false);assert.equal(permitted({role:'reader'},'write'),false);assert.equal(permitted({role:'dispatcher'},'admin'),false);assert.equal(permitted({role:'admin'},'admin'),true);
   assert.equal((await store.authorize({...identity,id:kim,role:'admin'})).role,'dispatcher');
   await assert.rejects(store.authorize({...identity,id:'missing'}));
   assert.throws(()=>userInput({id:alex,displayName:'Test',role:'superadmin',enabled:true,version:1}));
   await assert.rejects(store.overview(kim),error=>error.status===403);
   await assert.rejects(store.saveUser(kim,{id:kim,displayName:'Kim',role:'admin',enabled:true,version:1}),error=>error.status===403);
  });
  await t.test('new directory accounts need explicit activation and valid input',async()=>{
   const id='ad:cccccccc-cccc-4ccc-8ccc-cccccccccccc';
   const created=await store.saveUser(alex,{id,displayName:'Robin Fiktiv',role:'reader',enabled:false,version:0});
   assert.equal(created.version,1);await assert.rejects(store.authorize({...identity,id}));
   await assert.rejects(store.saveUser(alex,{id,displayName:'Duplikat',role:'admin',enabled:true,version:0}),error=>error.status===409);
   await store.saveUser(alex,{...created,enabled:true});
   // Ohne PDS-Benutzer keine Anmeldung (nur Administratoren ausgenommen); mit Zuordnung gilt die gespeicherte Rolle.
   await assert.rejects(store.authorize({...identity,id}),/PDS-Zuordnung fehlt/);await assert.rejects(store.issue({...identity,id,role:'reader'}),/PDS-Zuordnung fehlt/);
   await assignPds(pool,id);assert.equal((await store.authorize({...identity,id})).role,'reader');
   await assert.rejects(store.saveUser(alex,{...created,id:"'; DROP TABLE platform.users;--"}));
  });
  await t.test('heyelli accounts: password login, forced change, PDS assignment and Microsoft linking',async()=>{
   await store.saveUser(alex,{displayName:'Fiktive Kontoprüfung',username:'Konto.Pruefung',microsoftUpn:'Pruefung@Example.Invalid',role:'reader',enabled:true,version:0});
   const account=(await store.overview(alex)).users.find(user=>user.username==='konto.pruefung');
   assert.match(account.id,/^konto:[0-9a-f-]{36}$/);assert.equal(account.microsoftUpn,'pruefung@example.invalid');assert.equal(account.hasPassword,false);
   await assert.rejects(store.saveUser(alex,{displayName:'Doppelt',username:'konto.pruefung',role:'reader',enabled:true,version:0}),error=>error.status===409);
   await assert.rejects(store.resetPassword(kim,account.id),error=>error.status===403);
   const {initialPassword}=await store.resetPassword(alex,account.id);
   assert.ok(!JSON.stringify((await pool.query('SELECT * FROM platform.users WHERE id=$1',[account.id])).rows[0]).includes(initialPassword),'kein Klartext in der Datenbank');
   await assert.rejects(store.authenticateLocal('konto.pruefung','falsch-falsch-falsch'),/fehlgeschlagen/);
   await assert.rejects(store.authenticateLocal('unbekannt',initialPassword),/fehlgeschlagen/);
   await assert.rejects(store.authenticateLocal('konto.pruefung',initialPassword),/PDS-Zuordnung fehlt/);
   await assert.rejects(store.setPdsUser(alex,account.id,'sim-employee-1'),error=>error.status===409,'ein PDS-Benutzer gehört höchstens einem Konto');
   await store.setPdsUser(alex,account.id,'sim-employee-3');
   const local=await store.authenticateLocal(' KONTO.PRUEFUNG ',initialPassword);assert.equal(local.mustChangePassword,true);assert.equal(local.pdsUserUUID,'sim-employee-3');
   const current=await store.issue(local),other=await store.issue(local);assert.equal((await store.read(current)).mustChangePassword,true);
   await assert.rejects(store.changePassword(account.id,current,'falsch-falsch-falsch','neues-passwort-123'),error=>error.status===403);
   await assert.rejects(store.changePassword(account.id,current,initialPassword,initialPassword),/unterscheiden/);
   await assert.rejects(store.changePassword(account.id,current,initialPassword,'kurz'),/mindestens 12/);
   await store.changePassword(account.id,current,initialPassword,'neues-passwort-123');
   assert.equal((await store.read(current)).mustChangePassword,undefined);assert.equal(await store.read(other),null,'andere Sitzungen enden');
   await assert.rejects(store.authenticateLocal('konto.pruefung',initialPassword),/fehlgeschlagen/);
   assert.equal((await store.authenticateLocal('konto.pruefung','neues-passwort-123')).mustChangePassword,undefined);
   await store.setPdsUser(alex,account.id,null);assert.equal(await store.read(current),null,'Zuordnungsänderung beendet die Sitzung');
   await store.setPdsUser(alex,account.id,'sim-employee-3');
   const subject='entra:11111111-1111-4111-8111-111111111111:44444444-4444-4444-8444-444444444444';
   await assert.rejects(store.authenticateMicrosoft('entra:11111111-1111-4111-8111-111111111111:55555555-5555-4555-8555-555555555555','fremd@example.invalid',1),/nicht verknüpft/);
   const viaUpn=await store.authenticateMicrosoft(subject,'PRUEFUNG@example.invalid',1);assert.equal(viaUpn.id,account.id);assert.equal(viaUpn.mode,'microsoft');assert.equal(viaUpn.pdsUserUUID,'sim-employee-3');
   assert.equal((await store.authenticateMicrosoft(subject,null,1)).id,account.id,'danach gilt die Microsoft-Kennung');
   await assert.rejects(store.linkMicrosoft(alex,subject),error=>error.status===409,'ein Microsoft-Konto gehört höchstens einem heyelli-Konto');
   await store.unlinkMicrosoft(alex,account.id);await assert.rejects(store.authenticateMicrosoft(subject,null,1),/nicht verknüpft/);
   await store.linkMicrosoft(account.id,subject);assert.equal((await store.authenticateMicrosoft(subject,null,1)).id,account.id,'Selbstverknüpfung');
   assert.ok((await pool.query("SELECT 1 FROM platform.audit_events WHERE target_id=$1 AND action IN ('user.password.reset','user.password.changed','user.pds.assigned','user.microsoft.linked','user.microsoft.unlinked')",[account.id])).rowCount>=5);
   await store.saveUser(alex,{...(await store.overview(alex)).users.find(user=>user.id===account.id),enabled:false});
   await pool.query('DELETE FROM platform.sessions WHERE user_id=$1',[account.id]);await pool.query('DELETE FROM platform.pds_user_mappings WHERE user_id=$1',[account.id]);
  });
  let token;
  await t.test('only hashed session tokens are persisted and survive fresh connection pools',async()=>{
   token=await store.issue(identity);const row=(await pool.query('SELECT token_hash FROM platform.sessions')).rows[0];assert.notEqual(row.token_hash,token);assert.equal(row.token_hash,createHash('sha256').update(token).digest('hex'));
   await pool.end();pool=new Pool({connectionString:url.href});store=platformRepository(pool);
   assert.equal((await store.read(token)).id,alex);assert.equal(await store.read('invented-cookie'),null);
  });
  await t.test('expired and logged-out sessions are rejected; replacement revokes the old token',async()=>{
   const replacement=await store.issue(identity,token);assert.equal(await store.read(token),null);
   await store.revoke(replacement);assert.equal(await store.read(replacement),null);
   const expired=await store.issue(identity);await pool.query("UPDATE platform.sessions SET expires_at=now()-interval '1 second'");assert.equal(await store.read(expired),null);
  });
  await t.test('version conflicts, role downgrades and disabled users invalidate access',async()=>{
   const dispatcher=await store.authorize({...identity,id:kim});const token=await store.issue(dispatcher);
   await store.saveUser(alex,{id:kim,displayName:'Kim Muster',role:'reader',enabled:true,version:1});
   assert.equal(await store.read(token),null);
   await assert.rejects(store.saveUser(alex,{id:kim,displayName:'Kim Muster',role:'admin',enabled:true,version:1}),error=>error.status===409);
   assert.equal((await store.authorize(dispatcher)).role,'reader');
   const readToken=await store.issue(await store.authorize(dispatcher));
   await store.saveUser(alex,{id:kim,displayName:'Kim Muster',role:'reader',enabled:false,version:2});assert.equal(await store.read(readToken),null);await assert.rejects(store.authorize(dispatcher));
   await seed();await assert.rejects(store.authorize(dispatcher));
  });
  await t.test('the last active admin cannot be disabled or demoted, including concurrent requests',async()=>{
   await assert.rejects(store.saveUser(alex,{id:alex,displayName:'Alex Beispiel',role:'reader',enabled:true,version:1}),error=>error.status===409);
   await store.saveUser(alex,{id:kim,displayName:'Kim Muster',role:'admin',enabled:true,version:3});
   const results=await Promise.allSettled([store.saveUser(alex,{id:alex,displayName:'Alex Beispiel',role:'reader',enabled:true,version:1}),store.saveUser(kim,{id:kim,displayName:'Kim Muster',role:'reader',enabled:true,version:4})]);
   assert.equal(results.filter(item=>item.status==='fulfilled').length,1);assert.equal((await pool.query("SELECT count(*)::int AS n FROM platform.users WHERE enabled AND role='admin'")).rows[0].n,1);
  });
  await t.test('admin can revoke individual sessions without exposing their token hashes',async()=>{
   const admin=(await pool.query("SELECT id FROM platform.users WHERE enabled AND role='admin'")).rows[0].id;
   const session=await store.issue(await store.authorize({...identity,id:admin}));
   const overview=await store.overview(admin);assert.ok(overview.sessions.length);assert.ok(overview.events.length);assert.ok(!JSON.stringify(overview).includes('token_hash'));
   const entry=overview.sessions.find(row=>row.userId===admin);await store.revokeSession(admin,entry.id);assert.equal(await store.read(session),null);
  });
  await t.test('login limiter is shared across repository instances',async()=>{
   const other=platformRepository(pool);await pool.query('DELETE FROM platform.login_limits');
   const allowed=await Promise.all(Array.from({length:35},(_,i)=>(i%2?store:other).allowLogin({source:'192.0.2.1',account:'demo.alex',channel:'password'})));assert.equal(allowed.filter(Boolean).length,30);
  });
  await t.test('login budgets isolate accounts and sources without spending the global guard on blocked retries',async()=>{
   await pool.query('DELETE FROM platform.login_limits');
   const attempt=(source,account)=>({source,account,channel:'password'});
   for(let i=0;i<30;i++)assert.equal(await store.allowLogin(attempt('192.0.2.1','Alice')),true);
   for(let i=0;i<10;i++)assert.equal(await store.allowLogin(attempt('192.0.2.1',' alice ')),false);
   assert.equal((await pool.query("SELECT attempts FROM platform.login_limits WHERE scope='login:v2:global'")).rows[0].attempts,30);
   assert.equal(await store.allowLogin(attempt('192.0.2.2','alice')),true);
   assert.equal(await store.allowLogin(attempt('192.0.2.1','bob')),true);
   for(let i=0;i<30;i++)assert.equal(await store.allowLogin(attempt(null,'unknown-a')),true);
   assert.equal(await store.allowLogin(attempt(null,'unknown-a')),false);
   assert.equal(await store.allowLogin(attempt(null,'unknown-b')),true);
   const scopes=(await pool.query('SELECT scope FROM platform.login_limits')).rows;assert.ok(!JSON.stringify(scopes).includes('alice'));assert.ok(!JSON.stringify(scopes).includes('192.0.2.1'));
   await pool.query('DELETE FROM platform.login_limits');
   for(let i=0;i<120;i++)assert.equal(await store.allowLogin(attempt('192.0.2.1','account-'+Math.floor(i/30))),true);
   assert.equal(await store.allowLogin(attempt('192.0.2.1','new-account')),false);
   assert.equal(await store.allowLogin(attempt('192.0.2.2','new-account')),true);
   await pool.query("UPDATE platform.login_limits SET attempts=3000 WHERE scope='login:v2:global'");
   assert.equal(await store.allowLogin(attempt('192.0.2.3','other')),false);
   await pool.query("UPDATE platform.login_limits SET window_start=now()-interval '16 minutes'");
   assert.equal(await store.allowLogin(attempt('192.0.2.1','account-0')),true);
   assert.equal((await pool.query("SELECT attempts FROM platform.login_limits WHERE scope='login:v2:global'")).rows[0].attempts,1);
   await assert.rejects(store.allowLogin(attempt('forged source','alice')));
   for(let i=0;i<35;i++)assert.equal(await store.allowLogin({source:null,account:'microsoft-login',channel:'microsoft'}),true);
   for(let i=0;i<30;i++)assert.equal(await store.allowLogin({source:'192.0.2.4',account:'microsoft-login',channel:'microsoft'}),true);
   assert.equal(await store.allowLogin({source:'192.0.2.4',account:'microsoft-login',channel:'microsoft'}),false);
   assert.equal(await store.allowLogin({source:'192.0.2.5',account:'microsoft-login',channel:'microsoft'}),true);
  });
  const assertSettingsPersist=await checkPostgresSettings(t,pool);
  const assertSystemPersist=await checkSystemSettings(t,pool);
  await t.test('database contents persist across a PostgreSQL container restart',async()=>{
   const admin=(await pool.query("SELECT id FROM platform.users WHERE enabled AND role='admin'")).rows[0].id;
   const persistent=await store.issue(await store.authorize({...identity,id:admin}));
   await pool.end();
   const project=process.env.HEYELLI_TEST_COMPOSE_PROJECT;assert.match(project,/^heyelli-test-[a-f0-9]+$/);
   for(const args of [['restart','db'],['up','-d','--wait']]) {
    const result=spawnSync('docker',['compose','--env-file','/dev/null','-f','compose.test.yaml','-p',project,...args],{stdio:'pipe'});
    assert.equal(result.status,0,'Test container restart failed');
   }
   const mapped=spawnSync('docker',['compose','--env-file','/dev/null','-f','compose.test.yaml','-p',project,'port','db','5432'],{encoding:'utf8'});
   assert.equal(mapped.status,0);url.port=mapped.stdout.trim().split(':').at(-1);
   process.env.HEYELLI_TEST_DATABASE_URL=url.href;
   pool=new Pool({connectionString:url.href});store=platformRepository(pool);
   let restored=null;
   for(let attempt=0;attempt<40;attempt++) {
    try {restored=await store.read(persistent);break;}catch {await new Promise(resolve=>setTimeout(resolve,250));}
   }
   assert.equal(restored?.id,admin);
   const persistedRole=(await appRoleRepository(pool).read()).roles.find(role=>role.id===persistentRoleId);assert.deepEqual(persistedRole.apps,['/servicehub','/planboard']);assert.deepEqual(persistedRole.write_apps,['/servicehub']);
   await assertSettingsPersist(pool);
   await assertSystemPersist(pool);
   assert.ok((await pool.query('SELECT count(*)::int AS n FROM platform.audit_events')).rows[0].n>0);
  });
  await t.test('duty selections survive database restart',async()=>{assert.deepEqual((await dutyResourcePreferences(pool).read(alex)).selection,['fictional-persistent']);assert.deepEqual((await dutyResourcePreferences(pool).read(kim)).selection,[]);});
  await t.test('holiday preferences survive database restart',async()=>{const saved=await dutyResourcePreferences(pool).readHolidays(alex);assert.equal(saved.holidays.state,'BY');assert.equal(saved.holidays.historyYears,8);assert.equal(saved.holidays.weights.newYear,7);assert.equal((await dutyResourcePreferences(pool).readHolidays(kim)).holidays.state,'SN');});
  await t.test('Microsoft sign-in requires explicit release, rejects replay and unknown accounts, and revokes sessions on configuration changes',async()=>{await checkMicrosoftAuth(pool);});
  await t.test('audit SQL filters, stable pages and bounded results retain German copy/export semantics',async()=>{
   const {filterAudit,emptyAuditFilters}=await import('../src/system/einstellungen/audit-filter.ts');
   const actor='fictitious-audit-query',admin=(await pool.query("SELECT id FROM platform.users WHERE enabled AND role='admin' LIMIT 1")).rows[0].id,nonAdmin=(await pool.query("SELECT id FROM platform.users WHERE enabled AND role<>'admin' LIMIT 1")).rows[0].id;
   await pool.query("INSERT INTO platform.audit_events(actor_id,action,target_id,created_at,changes) VALUES($1,'user.updated','literal-%-target','2025-12-31T23:30:00Z',$2::jsonb),($1,'employee.linked','different','2026-01-01T23:30:00Z',$3::jsonb)",[actor,JSON.stringify([{field:'enabled',label:'Aktiv',before:false,after:true},{field:'role',label:'Grundberechtigung',before:'reader',after:'dispatcher'}]),JSON.stringify([{field:'employee',label:'Mitarbeiter',before:'Alter Mitarbeiter',after:'Neuer Mitarbeiter'}])]);
   const all=(await store.auditPage(admin,{...emptyAuditFilters,actor})).entries;
   for(const extra of [{search:'Benutzer geändert'},{search:'Ja'},{search:'Lesezugriff'},{search:'Disposition'},{search:'%'},{search:"' OR true --"},{search:'Alter Mitarbeiter'},{from:'2026-01-01',to:'2026-01-01'}]){const filters={...emptyAuditFilters,actor,...extra};const result=await store.auditPage(admin,filters);assert.deepEqual(result.entries.map(e=>e.id),filterAudit(all,filters).map(e=>e.id));}
   await assert.rejects(store.auditPage(nonAdmin,emptyAuditFilters),e=>e.status===403);
   await assert.rejects(store.auditPage(admin,emptyAuditFilters,{cursor:'1 OR true'}),e=>e.status===400);
   await assert.rejects(store.auditPage(admin,emptyAuditFilters,{limit:201}),e=>e.status===400);
  });
  await t.test('secret files retain active and archived configurations, isolate failed saves and require safe re-observation',()=>checkSecretRetention(pool));
  await checkPdsGraphSecrets(pool,t);
  await t.test('private draft keys and encrypted copies preserve branches across accounts, retries and fresh pools',()=>checkPrivateDrafts(pool));
  await t.test('privacy export, controlled cleanup, holds, ownership, races and open drafts remain isolated',()=>checkDataLifecycle(pool));
  await t.test('service confirmations require app write, preserve test mode and deduplicate queue receipts',()=>checkConfirmation(pool));
  await t.test('dispatch references persist, merge independent choices and reject stale opposite writes',()=>checkDispatch(pool));
  await t.test('incident defaults isolate sources, enforce administration, compare revisions and audit old/new values',()=>checkIncidentDefaults(pool));
  await t.test('personal service visibility persists and isolates users and sources',()=>checkServiceVisibility(pool));
  await t.test('pinned service customers persist and isolate users and sources',()=>checkServicePins(pool));
  await t.test('maildesk stores only decisions, detects conflicts, learns senders and queues replies once',()=>checkMaildesk(pool));
  await t.test('maildesk mailbox source is admin-only and switches to microsoft 365 only after a fresh check',()=>checkMaildeskSettings(pool));
  await t.test('task extras keep checklist, links and history with conflict detection and audit',()=>checkTaskExtras(pool));
  await t.test('customer notes are validated, separated by source and only removable by their author',()=>checkCustomerNotes(pool));
  await t.test('mission control limits important tasks, keeps one running focus and protects notes',()=>checkMissionStore(pool));
  await t.test('mission control goals validate input, detect conflicts, keep daily values and link tasks',()=>checkMissionGoals(pool));
  await t.test('SharePoint release, credentials, permissions and safe upload recovery',()=>checkSharePoint(pool));
  await t.test('operational alarms, real database interruption, safe recovery and administration',()=>checkOperations(pool));
  await t.test('authenticated browser diagnostics aggregate safely, serialize budgets and deny untrusted records',()=>checkBrowserReports(pool));
  await t.test('resource admission, fairness, budgets and SQL timeouts recover without data changes',()=>checkResourceBudgets(pool));
  await t.test('durable history delivery survives failures, restarts and parallel retries',()=>checkServiceHistory(pool));
  await t.test('backup tolerates monitoring but detects acknowledgements and business changes',()=>checkBackupMonitor(pool));
  await t.test('complete encrypted backup restores all secret providers, WAL data and secured drafts without source changes',()=>checkBackupRestore(pool));
  await t.test('HTTP endpoints enforce roles, origin, size, logout and application restart persistence',()=>checkPlatformHttp(pool));
 }finally{await pool.end();}
});
