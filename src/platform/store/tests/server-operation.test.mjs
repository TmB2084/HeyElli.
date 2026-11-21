import {test} from 'node:test';
import assert from 'node:assert/strict';
import {databaseConfig} from '../config.ts';
import {serverOperation,settingsDirectory,ollamaBaseUrl,elliAvailable,instanceNotice,mailPlan,mailForDelivery,externalWritesBlocked,guardExternalWrites} from '../../server-operation/index.ts';
import {checksum,migrationFiles,migrate} from '../../../../scripts/migrate-db.mjs';

const db={POSTGRES_USER:'u',POSTGRES_PASSWORD:'p',POSTGRES_DB:'d'};

test('Datenbank: Standardverhalten unverändert (127.0.0.1, im Produktionsmodus gesperrt)',()=>{
 assert.equal(databaseConfig({...db}).host,'127.0.0.1');
 assert.throws(()=>databaseConfig({...db,NODE_ENV:'production'}),/noch kein Datenbankbetrieb/);
 assert.throws(()=>databaseConfig({...db,NODE_ENV:'production',HEYELLI_SERVER_BETRIEB:'true'}),/noch kein Datenbankbetrieb/);
});
test('Datenbank: Serverbetrieb nur mit HEYELLI_SERVER_BETRIEB=1, Host konfigurierbar',()=>{
 const env={...db,NODE_ENV:'production',HEYELLI_SERVER_BETRIEB:'1',POSTGRES_HOST:'db',APP_ENV:'server'};
 assert.equal(serverOperation(env),true);
 const config=databaseConfig(env);assert.equal(config.host,'db');assert.equal(config.port,5432);
 assert.equal(serverOperation({NODE_ENV:'development',HEYELLI_SERVER_BETRIEB:'1'}),false);
 assert.throws(()=>databaseConfig({...db,APP_ENV:'server'}),/Unbekannte Anwendungsumgebung/);
 assert.throws(()=>databaseConfig({...db,POSTGRES_HOST:'a b'}),/Ungültiger Datenbankhost/);
 assert.equal(databaseConfig({...db,POSTGRES_HOST:'  '}).host,'127.0.0.1');
});
test('Ollama-Adresse: Standard wie bisher, konfigurierbar, ungültige Werte abgelehnt',()=>{
 assert.equal(ollamaBaseUrl({}),'http://127.0.0.1:11434');
 assert.equal(ollamaBaseUrl({OLLAMA_BASE_URL:'http://ollama:11434/'}),'http://ollama:11434');
 for(const bad of ['ollama:11434','ftp://x','http://u:p@x','http://x/api','http://x?a=1'])assert.throws(()=>ollamaBaseUrl({OLLAMA_BASE_URL:bad}),/Ungültige OLLAMA_BASE_URL/);
});
test('Elli: Entwicklung wie bisher, Serverbetrieb nur mit HEYELLI_ELLI_AKTIV=1',()=>{
 assert.equal(elliAvailable({NODE_ENV:'development'}),true);
 assert.equal(elliAvailable({NODE_ENV:'production'}),false);
 assert.equal(elliAvailable({NODE_ENV:'production',HEYELLI_SERVER_BETRIEB:'1'}),false);
 assert.equal(elliAvailable({NODE_ENV:'production',HEYELLI_SERVER_BETRIEB:'1',HEYELLI_ELLI_AKTIV:'1'}),true);
});
const mail={sender:'a@x.de',recipient:'echt@x.de',subject:'Betreff',body:'Text'};
test('Mail: ohne Variablen unverändert',()=>{
 assert.deepEqual(mailPlan({}),{mode:'normal'});assert.equal(mailForDelivery(mail,{}),mail);assert.equal(mailPlan({HEYELLI_MAIL_MODUS:'normal'}).mode,'normal');
});
test('Mail: Umleitung ändert Empfänger, Betreff und Text; Original steht im Text',()=>{
 const out=mailForDelivery(mail,{HEYELLI_MAIL_MODUS:'umleiten',HEYELLI_MAIL_UMLEITUNG:'test@x.de'});
 assert.equal(out.recipient,'test@x.de');assert.match(out.subject,/echt@x\.de/);assert.match(out.body,/echt@x\.de/);assert.equal(out.sender,'a@x.de');
});
test('Mail: abgeschaltet oder fehlerhaft konfiguriert sendet nie (sicherer Ausfall)',()=>{
 for(const env of [{HEYELLI_MAIL_MODUS:'aus'},{HEYELLI_MAIL_MODUS:'umleiten'},{HEYELLI_MAIL_MODUS:'umleiten',HEYELLI_MAIL_UMLEITUNG:'kaputt'},{HEYELLI_MAIL_MODUS:'irgendwas'},{HEYELLI_MAIL_MODUS:'umleiten',HEYELLI_MAIL_UMLEITUNG:'a@b.de,c@d.de'}])assert.equal(mailForDelivery(mail,env),null,JSON.stringify(env));
});
test('Hinweisbalken: nur mit Variable, gekürzt',()=>{
 assert.equal(instanceNotice({}),'');assert.equal(instanceNotice({HEYELLI_INSTANZ_HINWEIS:' TESTINSTANZ '}),'TESTINSTANZ');assert.equal(instanceNotice({HEYELLI_INSTANZ_HINWEIS:'x'.repeat(100)}).length,40);
});
test('Externe Schreibzugriffe: ohne Variable durchgereicht, mit =aus nur Lesen und Anmeldung',async()=>{
 const calls=[];const base=async(url,init)=>{calls.push([String(url),init?.method??'GET']);return new Response('ok');};
 assert.equal(guardExternalWrites(base,{}),base);assert.equal(externalWritesBlocked({}),false);
 const guarded=guardExternalWrites(base,{HEYELLI_EXTERN_SCHREIBEN:'aus'});
 await guarded('https://graph.microsoft.com/v1.0/x',{method:'GET'});
 await guarded('https://login.microsoftonline.com/t/oauth2/v2.0/token',{method:'POST'});
 for(const method of ['POST','PUT','PATCH','DELETE'])await assert.rejects(()=>guarded('https://graph.microsoft.com/v1.0/x',{method}),/abgeschaltet/);
 assert.equal(calls.length,2);
});
test('Migration: Dateiauswahl und Prüfsumme wie in scripts/database.mjs',()=>{
 const files=migrationFiles(new URL('../../../../database/migrations/',import.meta.url));
 assert.ok(files.length>=40&&files[0]==='001_service_catalog.sql'&&[...files].sort().join()===files.join());
 assert.match(checksum('x'),/^[0-9a-f]{64}$/);
});
test('Migration: bereits angewendete, veränderte Datei bricht ab und rollt zurück',async()=>{
 const log=[];const client={async query(sql){log.push(String(sql).split(' ')[0]);if(/SELECT checksum/.test(sql))return {rows:[{checksum:'anders'}]};return {rows:[]};}};
 await assert.rejects(()=>migrate(client,new URL('../../../../database/migrations/',import.meta.url)),/Migration verändert/);
 assert.equal(log[0],'BEGIN');assert.equal(log.at(-1),'ROLLBACK');
});
test('Einstellungsverzeichnis: Standard Arbeitsverzeichnis, im Serverbetrieb konfigurierbar und geprüft',()=>{
 const cwd=()=>'/arbeit';
 assert.equal(settingsDirectory({},cwd),'/arbeit');
 assert.equal(settingsDirectory({HEYELLI_SETTINGS_DIR:'/app/state'},cwd),'/arbeit');
 const env={NODE_ENV:'production',HEYELLI_SERVER_BETRIEB:'1',HEYELLI_SETTINGS_DIR:'/app/state'};
 assert.equal(settingsDirectory(env,cwd),'/app/state');
 for(const bad of ['relativ','/app/../etc'])assert.throws(()=>settingsDirectory({...env,HEYELLI_SETTINGS_DIR:bad},cwd),/Ungültiges HEYELLI_SETTINGS_DIR/);
});

