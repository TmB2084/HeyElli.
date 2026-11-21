import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,utimesSync,existsSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {beat,heartbeatFile,heartbeatFresh} from '../scripts/heartbeat.mjs';
import {healthy,mailWorkerHealthy,MAIL_WORKER_SQL} from '../scripts/health-check.mjs';

test('Herzschlag: fehlende Datei ist nicht gesund, frische ist gesund, alte nicht, Dienstname wird geprüft',()=>{
 const dir=mkdtempSync(join(tmpdir(),'hb-'));try{
  assert.equal(heartbeatFresh('assistant-runtime',120,{dir}),false);
  assert.equal(beat('assistant-runtime',{dir}),true);
  assert.ok(existsSync(heartbeatFile('assistant-runtime',dir)));assert.equal(statSync(heartbeatFile('assistant-runtime',dir)).mode&0o077,0);
  assert.equal(heartbeatFresh('assistant-runtime',120,{dir}),true);
  const alt=new Date(Date.now()-300000);utimesSync(heartbeatFile('assistant-runtime',dir),alt,alt);
  assert.equal(heartbeatFresh('assistant-runtime',120,{dir}),false,'älter als 120 s');
  assert.equal(heartbeatFresh('assistant-runtime',120,{dir,now:alt.getTime()+60000}),true,'Alter 60 s bei angenommener Uhrzeit');
  for(const bad of ['../x','a b','','A'])assert.throws(()=>heartbeatFile(bad,dir),/Ungültiger Dienstname/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('Herzschlag: Schreibfehler beenden den Dienst nicht',()=>{assert.equal(beat('assistant-runtime',{dir:'/nicht/vorhanden/verzeichnis'}),false);});
test('Mail-Worker: gesund nur bei healthy und frischem Herzschlag in der Datenbank',async()=>{
 assert.match(MAIL_WORKER_SQL,/healthy AND last_seen>now\(\)-interval '120 seconds'/);assert.match(MAIL_WORKER_SQL,/mail_worker_health/);
 const mit=rows=>async sql=>{assert.equal(sql,MAIL_WORKER_SQL);return {rows};};
 assert.equal(await mailWorkerHealthy(mit([{ok:true}])),true);
 assert.equal(await mailWorkerHealthy(mit([{ok:false}])),false);
 assert.equal(await mailWorkerHealthy(mit([{ok:null}])),false,'NULL (z. B. nie gelaufen) ist nicht gesund');
 assert.equal(await mailWorkerHealthy(mit([])),false,'noch keine Zeile');
 await assert.rejects(()=>mailWorkerHealthy(async()=>{throw new Error('keine Verbindung');}));
});
test('Gesundheitsprüfung: Dienstname bestimmt die Prüfung, Unbekanntes ist nie gesund',async()=>{
 assert.equal(await healthy('assistant-runtime',{fresh:(name,max)=>name==='assistant-runtime'&&max===120}),true);
 assert.equal(await healthy('assistant-runtime',{fresh:()=>false}),false);
 assert.equal(await healthy('mail-worker',{query:async()=>({rows:[{ok:true}]})}),true);
 for(const unbekannt of [undefined,'','app','monitor'])assert.equal(await healthy(unbekannt,{fresh:()=>true,query:async()=>({rows:[{ok:true}]})}),false);
});
