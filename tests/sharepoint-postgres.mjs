import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm,rename} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sharepointRepository} from '../src/platform/sharepoint/repository.ts';
import {documentRepository,scopeKey} from '../src/platform/sharepoint/documents.ts';
import {readConfig} from '../src/platform/sharepoint/configuration.ts';
import {restoreSecret,maintainSecrets,lockSecrets} from '../src/platform/secret-retention/lifecycle.ts';
import {fakeSharePoint} from './sharepoint-fixture.mjs';
const config={tenantId:'11111111-1111-4111-8111-111111111111',clientId:'22222222-2222-4222-8222-222222222222',secret:'fictitious-sharepoint-secret',siteId:'fictional.sharepoint.com,33333333-3333-4333-8333-333333333333,44444444-4444-4444-8444-444444444444',driveId:'drive-test',rootId:'root'};
export async function checkSharePoint(pool){
 assert.match(process.env.HEYELLI_TEST_COMPOSE_PROJECT??'',/^heyelli-test-/);const original=(await pool.query("SELECT * FROM platform.sharepoint_settings WHERE id='central'")).rows[0],directory=await mkdtemp(join(tmpdir(),'heyelli-sharepoint-')),env={APP_ENV:process.env.APP_ENV,HEYELLI_TEST_SETTINGS_DIR:process.env.HEYELLI_TEST_SETTINGS_DIR},admin='sp:'+randomUUID(),reader='sp:'+randomUUID();process.env.APP_ENV='test';process.env.HEYELLI_TEST_SETTINGS_DIR=directory;
 const fake=fakeSharePoint(),store=sharepointRepository(pool,fake.transport),docs=documentRepository(pool,fake.transport),scope=scopeKey('simulator','customer','fictitious'),bytes=Buffer.from('%PDF-1.7\nFiktive Unterlage'),logs=[];let trigger=false;
 try{
  await pool.query("INSERT INTO platform.users(id,display_name,role,enabled) VALUES($1,'Fiktive SharePoint-Administration','admin',true),($2,'Fiktiver SharePoint-Leser','reader',true)",[admin,reader]);
  assert.deepEqual(await docs.list(scope),{enabled:false,items:[],truncated:false,types:[]});assert.equal(fake.state.calls,0);await assert.rejects(store.read(reader),e=>e.status===403);await assert.rejects(docs.upload(reader,scope,randomUUID(),'Fiktiv.pdf',bytes),e=>e.status===403);
  let row=await store.read(admin);await store.save(admin,{...config,version:row.version});row=await store.read(admin);assert.equal(row.enabled,false);assert.equal(JSON.stringify(row).includes(config.secret),false);await assert.rejects(store.mode(admin,{version:row.version,enabled:true,confirm:true}),e=>e.status===409);
  await store.test(admin,{version:row.version});await assert.rejects(store.mode(admin,{version:row.version,enabled:true}),e=>e.status===409);await store.mode(admin,{version:row.version,enabled:true,confirm:true});row=await store.read(admin);
  const request=randomUUID();fake.state.loseFinal=true;await assert.rejects(docs.upload(admin,scope,request,'Fiktiv.pdf',bytes),e=>e.status===503&&!e.message.includes(config.secret));assert.equal(fake.state.uploads,1);assert.equal((await pool.query('SELECT state FROM platform.sharepoint_uploads WHERE id=$1',[request])).rows[0].state,'pending');
  await docs.upload(admin,scope,request,'Fiktiv.pdf',bytes);await docs.upload(admin,scope,randomUUID(),'Fiktiv.pdf',bytes);assert.equal(fake.state.uploads,1);assert.equal((await docs.list(scope)).items[0].name,'Fiktiv.pdf');assert.equal((await docs.list(scopeKey('simulator','customer','another'))).items.length,0);
  await assert.rejects(docs.upload(admin,scope,request,'Fiktiv.pdf',Buffer.from('%PDF-1.7\nNeue Eingabe')),e=>e.status===409);
  const existing=[...fake.state.files.values()][0];existing.bytes=Buffer.from('%PDF-1.7\nNeuere externe Änderung');existing.eTag='"external-edit"';await assert.rejects(docs.upload(admin,scope,request,'Fiktiv.pdf',bytes),e=>e.status===409);assert.equal(existing.bytes.toString(),'%PDF-1.7\nNeuere externe Änderung');await docs.upload(admin,scope,randomUUID(),'Fiktiv.pdf',bytes);assert.equal(fake.state.uploads,2);
  // Neue Ablage (Vorgabe 21.11.2026): Objekte/<Stadt>/<straße_nr>/<Gewerk>/<Einheit>/<Ablagetyp>, lesbare Namen, kein Duplikat.
  const pathOf=id=>{const names=[];let folder=fake.state.folders.get(id);while(folder){names.unshift(folder.name);folder=fake.state.folders.get(folder.parent);}return names.join('/');};
  const fileNamed=name=>[...fake.state.files.values()].find(file=>file.name===name);
  const unit={kind:'unit',city:'Duisburg',street:'Hauptstraße 21',trade:'Brandmelde',unitName:'BMZ',unitId:'4711'},unitScope=scopeKey('simulator','object','fictitious-unit'),firstId=randomUUID();
  await docs.upload(admin,unitScope,firstId,'Prüfbericht.pdf',bytes,undefined,{location:unit,typeKey:'berichte'});
  assert.equal(pathOf(fileNamed('Prüfbericht.pdf').parent),'Objekte/Duisburg/hauptstraße_21/Brandmelde/BMZ_4711/Berichte');
  const repeated=await docs.upload(admin,unitScope,firstId,'Prüfbericht.pdf',bytes,undefined,{location:unit,typeKey:'berichte'});assert.equal(repeated.repeated,true);
  await docs.upload(admin,unitScope,randomUUID(),'Prüfbericht.pdf',bytes,undefined,{location:unit,typeKey:'berichte'});assert.equal([...fake.state.files.values()].filter(file=>file.name.startsWith('Prüfbericht')).length,1);
  await docs.upload(admin,unitScope,randomUUID(),'Prüfbericht.pdf',Buffer.from('%PDF-1.7\nZweiter fiktiver Bericht'),undefined,{location:unit,typeKey:'berichte'});assert.ok(fileNamed('Prüfbericht (2).pdf'));
  await assert.rejects(docs.upload(admin,unitScope,randomUUID(),'Ohne Typ.pdf',bytes,undefined,{location:unit,typeKey:'gibt-es-nicht'}),/Ablagetyp/);
  await assert.rejects(docs.upload(admin,unitScope,firstId,'Prüfbericht.pdf',bytes,undefined,{location:unit,typeKey:'fotos'}),e=>e.status===409);
  // Adressänderung in PDS: feste Zuordnung behält den Ordner, nichts verwaist.
  await docs.upload(admin,unitScope,randomUUID(),'Foto.jpg',Buffer.from([255,216,255,224,0,16]),undefined,{location:{...unit,street:'Neue Straße 1'},typeKey:'fotos'});assert.equal(pathOf(fileNamed('Foto.jpg').parent),'Objekte/Duisburg/hauptstraße_21/Brandmelde/BMZ_4711/Fotos');
  // Auftrag: bei der Einheit, Dateiname mit Auftragsnummer; Auftragsliste zeigt nur eigene Dateien, die Einheit alle.
  const orderScope=scopeKey('simulator','order','fictitious-order'),orderLocation={...unit,namePrefix:'SA-1'};
  await docs.upload(admin,orderScope,randomUUID(),'Arbeitsnachweis.pdf',Buffer.from('%PDF-1.7\nFiktiver Nachweis'),undefined,{location:orderLocation,typeKey:'ruecklaeufe'});
  assert.equal(pathOf(fileNamed('SA-1_Arbeitsnachweis.pdf').parent),'Objekte/Duisburg/hauptstraße_21/Brandmelde/BMZ_4711/Rückläufe');
  assert.deepEqual((await docs.list(orderScope,undefined,orderLocation)).items.map(item=>[item.type,item.name]),[['Rückläufe','Arbeitsnachweis.pdf']]);
  const unitList=await docs.list(unitScope,undefined,unit);assert.deepEqual([...new Set(unitList.items.map(item=>item.type))].sort(),['Berichte','Fotos','Rückläufe']);assert.ok(unitList.types.some(type=>type.key==='mails'));
  // Kunde und Vertrag
  await docs.upload(admin,scopeKey('simulator','customer','fictitious-customer'),randomUUID(),'Anfrage.txt',Buffer.from('Fiktive Anfrage'),undefined,{location:{kind:'customer',customerName:'Musterwerk West',customerNumber:'K-200'},typeKey:'mails'});assert.equal(pathOf(fileNamed('Anfrage.txt').parent),'Kunden/musterwerk_west_K-200/Mails');
  await docs.upload(admin,scopeKey('simulator','contract','fictitious-contract'),randomUUID(),'Vertrag.pdf',Buffer.from('%PDF-1.7\nFiktiver Vertrag'),undefined,{location:{kind:'contract',customerName:'Musterwerk West',customerNumber:'K-200',contractName:'Wartung BMA'},typeKey:''});assert.equal(pathOf(fileNamed('Vertrag.pdf').parent),'Kunden/musterwerk_west_K-200/Verträge/Wartung BMA');
  // Ablagetypen: nur Administratoren, gültige Namen, Umbenennen/Ergänzen, nie löschen.
  const originalTypes=await docs.storageTypes(true);
  await assert.rejects(docs.saveStorageTypes(reader,originalTypes),e=>e.status===403);await assert.rejects(docs.saveStorageTypes(admin,[{label:'A/B'}]),/Ablagetyp/);await assert.rejects(docs.saveStorageTypes(admin,[{label:'Doppelt'},{label:'doppelt'}]),/doppelt/);
  const renamed=await docs.saveStorageTypes(admin,[...originalTypes.map(type=>type.key==='mails'?{...type,label:'E-Mails'}:type),{label:'Pläne',active:true}]);assert.ok(renamed.some(type=>type.key==='mails'&&type.label==='E-Mails'));assert.ok(renamed.some(type=>type.key==='plaene'));
  const reduced=await docs.saveStorageTypes(admin,renamed.filter(type=>type.key!=='plaene'));assert.equal(reduced.find(type=>type.key==='plaene').active,false);
  await docs.saveStorageTypes(admin,originalTypes);
  // Übernahme der bisherigen Hash-Ablage: Dateien wandern nach Kunden/…/Sonstiges, nichts wird gelöscht.
  const legacy=(await docs.legacyFolders()).find(entry=>entry.scope===scope);assert.ok(legacy&&legacy.files>=1);const filesBefore=fake.state.files.size;
  const customer={kind:'customer',customerName:'Fiktiver Kunde',customerNumber:'K-1'},moved=await docs.moveLegacy(admin,scope,customer);assert.equal(moved.moved,legacy.files);assert.equal(fake.state.files.size,filesBefore);
  const afterMove=await docs.list(scope,undefined,customer);assert.ok(afterMove.items.length>=1&&afterMove.items.every(item=>item.type==='Sonstiges'));assert.equal((await docs.legacyFolders()).find(entry=>entry.scope===scope).files,0);
  await assert.rejects(docs.moveLegacy(reader,scope,customer),e=>e.status===403);
  const before=(await pool.query("SELECT * FROM platform.sharepoint_settings WHERE id='central'")).rows[0],master=join(directory,'.local/sharepoint-secrets/master.key');await rename(master,master+'.saved');assert.equal((await store.read(admin)).storageError,true);await assert.rejects(store.save(admin,{...config,version:before.version}));assert.equal(existsSync(master),false);assert.equal((await pool.query("SELECT config_id FROM platform.sharepoint_settings WHERE id='central'")).rows[0].config_id,before.config_id);await rename(master+'.saved',master);
  await pool.query("CREATE FUNCTION public.reject_sp_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Fictitious failure'; END $$");await pool.query('CREATE TRIGGER reject_sp_test BEFORE UPDATE ON platform.sharepoint_settings FOR EACH ROW EXECUTE FUNCTION public.reject_sp_test()');trigger=true;await assert.rejects(store.save(admin,{...config,version:before.version}));assert.equal(readConfig(before.config_id).secret,config.secret);await pool.query('DROP TRIGGER reject_sp_test ON platform.sharepoint_settings');await pool.query('DROP FUNCTION public.reject_sp_test()');trigger=false;
  await store.save(admin,{...config,secret:'',version:before.version});row=await store.read(admin);assert.equal(row.enabled,false);fake.state.invalidToken=true;await assert.rejects(store.test(admin,{version:row.version}),e=>!e.message.includes('fictitious'));assert.equal((await store.read(admin)).configured,true);assert.equal((await store.read(admin)).enabled,false);fake.state.invalidToken=false;
  await maintainSecrets(pool,admin,'sharepoint');await restoreSecret(pool,admin,'sharepoint',row.version);row=await store.read(admin);assert.equal(row.enabled,false);assert.equal(row.tested,false);assert.equal(readConfig((await pool.query("SELECT config_id FROM platform.sharepoint_settings WHERE id='central'")).rows[0].config_id).secret,config.secret);
  const guard=await pool.connect();try{await guard.query('BEGIN');await lockSecrets(guard,'sharepoint');await assert.rejects(docs.upload(admin,scope,randomUUID(),'Sperre.pdf',bytes),e=>e.status===429);}finally{await guard.query('ROLLBACK');guard.release();}
  const audit=JSON.stringify((await pool.query('SELECT * FROM platform.audit_events WHERE actor_id=$1',[admin])).rows);assert.ok(!audit.includes(config.secret));assert.ok(!audit.includes('fictitious-sharepoint-access-token'));logs.push('configuration, release, permissions, upload recovery, deduplication, newer edits, key loss, rollback, archive restore, folder layout, storage types, legacy move');
 }finally{
  if(trigger){await pool.query('DROP TRIGGER IF EXISTS reject_sp_test ON platform.sharepoint_settings');await pool.query('DROP FUNCTION IF EXISTS public.reject_sp_test()');}
  const keys=Object.keys(original).filter(key=>key!=='id');await pool.query(`UPDATE platform.sharepoint_settings SET ${keys.map((key,index)=>'"'+key+'"=$'+(index+1)).join(',')} WHERE id='central'`,keys.map(key=>original[key]));await pool.query("DELETE FROM platform.secret_archives WHERE provider='sharepoint'");await pool.query("DELETE FROM platform.secret_orphans WHERE provider='sharepoint'");await pool.query('DELETE FROM platform.sharepoint_uploads WHERE actor_id=$1',[admin]);await pool.query('DELETE FROM platform.sharepoint_folders');await pool.query("DELETE FROM platform.sharepoint_storage_types WHERE key='plaene'");await pool.query("UPDATE platform.sharepoint_storage_types SET updated_by=NULL WHERE updated_by=$1",[admin]);await pool.query('DELETE FROM platform.audit_events WHERE actor_id=$1',[admin]);await pool.query('DELETE FROM platform.users WHERE id=ANY($1::text[])',[[admin,reader]]);for(const [key,value]of Object.entries(env)){if(value===undefined)delete process.env[key];else process.env[key]=value;}await rm(directory,{recursive:true,force:true});
 }
 console.log('SHAREPOINT_REPORT '+JSON.stringify({status:'passed',checks:logs,realProviderContacted:false,cleanup:true}));
}
