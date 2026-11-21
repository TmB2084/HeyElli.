import {lockSecrets,archiveSecret} from '../secret-retention/server.ts';
import {saveMicrosoft365Configuration,microsoft365Environment,requireMicrosoft365Configuration,archiveMicrosoft365Legacy} from './configuration.ts';
import {randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import {microsoft365Configuration} from './microsoft365.ts';
import {PlatformError} from '../store/model.ts';
const email=(value:unknown)=>typeof value==='string'&&value.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
export function mailRepository(pool:Pool){
 async function transaction<T>(actor:string,work:(client:PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('BEGIN');const {rows}=await client.query('SELECT role,enabled FROM platform.users WHERE id=$1 FOR SHARE',[actor]);if(!rows[0]?.enabled||rows[0].role!=='admin')throw new PlatformError('Administratorrechte erforderlich.',403);const result=await work(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
 return {
  environment:(actor:string)=>transaction(actor,async client=>microsoft365Environment((await client.query("SELECT config_id FROM platform.mail_settings WHERE id='central'")).rows[0].config_id)),
  publishConfiguration:(actor:string,version:number,input:unknown)=>transaction(actor,async client=>{
   await lockSecrets(client,'graph');const before=(await client.query("SELECT version,config_id FROM platform.mail_settings WHERE id='central' FOR UPDATE")).rows[0];if(before.version!==version)throw new PlatformError('Konfiguration wurde zwischenzeitlich geändert. Bitte erneut versuchen.',409);
   requireMicrosoft365Configuration(before.config_id);const archived=before.config_id??archiveMicrosoft365Legacy();const configId=saveMicrosoft365Configuration(input,!!before.config_id);await archiveSecret(client,'graph',archived);await client.query("UPDATE platform.mail_settings SET config_id=$1,test_mode=true,connection_ok=false,checked_at=NULL,checked_sender=NULL,version=version+1 WHERE id='central'",[configId]);await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id) VALUES($1,'mail.credentials.updated','central')",[actor]);
  }),
  recordConnection:(actor:string,result:{sender:string;authentication:boolean;mailbox:boolean},version:number)=>transaction(actor,async client=>{const updated=await client.query("UPDATE platform.mail_settings SET checked_sender=$1,checked_at=now(),connection_ok=$2 WHERE id='central' AND sender=$1 AND version=$3",[result.sender,result.authentication&&result.mailbox,version]);if(!updated.rowCount)throw new PlatformError('Einrichtung wurde während der Prüfung geändert. Bitte erneut prüfen.',409);await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,'mail.connection.tested' ,$2,$3::jsonb)",[actor,result.sender,JSON.stringify([{field:'authentication',label:'Microsoft-365-Anmeldung',before:null,after:result.authentication},{field:'mailbox',label:'Postfachzugriff',before:null,after:result.mailbox}])]);}),
  read:(actor:string)=>transaction(actor,async client=>{const settings=(await client.query("SELECT config_id,sender,version,test_mode,enabled,checked_at,checked_sender,connection_ok,(connection_ok AND checked_sender=sender AND checked_at>now()-interval '24 hours') AS connection_ready FROM platform.mail_settings WHERE id='central'")).rows[0];const worker=(await client.query("SELECT last_seen,last_success,healthy,(healthy AND last_seen>now()-interval '90 seconds') AS ready FROM platform.mail_worker_health WHERE id='central'")).rows[0]??{ready:false};return {connection:microsoft365Configuration(microsoft365Environment(settings.config_id)),worker,mode:settings.test_mode?'test':'live',settings,queue:(await client.query('SELECT * FROM platform.mail_queue ORDER BY created_at DESC LIMIT 200')).rows,log:(await client.query('SELECT * FROM platform.mail_log ORDER BY id DESC LIMIT 200')).rows};}),
  change:(actor:string,input:unknown)=>transaction(actor,async client=>{
   if(!input||typeof input!=='object'||Array.isArray(input))throw new PlatformError('Eingabe fehlt.');const value=input as Record<string,unknown>;
   const mailModule=(await client.query("SELECT enabled FROM platform.mail_settings WHERE id='central' FOR UPDATE")).rows[0];
   if(value.action==='module'){
    if(typeof value.enabled!=='boolean'||!Number.isSafeInteger(value.version))throw new PlatformError('Modulstatus fehlt.');
    const before=(await client.query("SELECT * FROM platform.mail_settings WHERE id='central' FOR UPDATE")).rows[0];
    if(before.version!==value.version)throw new PlatformError('Einstellungen wurden zwischenzeitlich geändert.',409);
    await client.query("UPDATE platform.mail_settings SET enabled=$1,test_mode=true,version=version+1 WHERE id='central'",[value.enabled]);
    await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,'mail.settings.updated','central',$2::jsonb)",[actor,JSON.stringify([{field:'enabled',label:'Mail-Modul · MS365-Graph',before:before.enabled,after:value.enabled},...(before.test_mode?[]:[{field:'testMode',label:'MS365-Graph Testbetrieb',before:false,after:true}])])]);
    return {ok:true};
   }
   if(!mailModule.enabled)throw new PlatformError('Mail-Modul ist deaktiviert.',409);
   if(value.action==='credentials.prepare'){
    if(!Number.isSafeInteger(value.version))throw new PlatformError('Version fehlt.');
    const before=(await client.query("SELECT version FROM platform.mail_settings WHERE id='central' FOR UPDATE")).rows[0];if(before.version!==value.version)throw new PlatformError('Einstellungen wurden zwischenzeitlich geändert.',409);
    await client.query("UPDATE platform.mail_settings SET test_mode=true,connection_ok=false,version=version+1 WHERE id='central'");
    await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id) VALUES($1,'mail.credentials.prepared','central')",[actor]);
   }else if(value.action==='settings'){
    if(!email(value.sender)||!Number.isSafeInteger(value.version))throw new PlatformError('Gültiges Absenderpostfach erforderlich.');
    const before=(await client.query("SELECT config_id,sender,version,test_mode,enabled,checked_at,checked_sender,connection_ok,(connection_ok AND checked_sender=sender AND checked_at>now()-interval '24 hours') AS connection_ready FROM platform.mail_settings WHERE id='central' FOR UPDATE")).rows[0];
    if(before.version!==value.version)throw new PlatformError('Absender wurde zwischenzeitlich geändert.',409);
    await client.query("UPDATE platform.mail_settings SET sender=$1,version=version+1,test_mode=CASE WHEN sender<>$1 THEN true ELSE test_mode END,connection_ok=CASE WHEN sender<>$1 THEN false ELSE connection_ok END WHERE id='central'",[value.sender]);
    if(before.sender!==value.sender)await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,'mail.settings.updated','central',$2::jsonb)",[actor,JSON.stringify([{field:'sender',label:'Absenderpostfach',before:before.sender,after:value.sender},...(!before.test_mode?[{field:'testMode',label:'MS365-Graph Testbetrieb',before:false,after:true}]:[])])]);
   }else if(value.action==='mode'){
    if(typeof value.testMode!=='boolean'||!Number.isSafeInteger(value.version))throw new PlatformError('Betriebsart fehlt.');
    if(!value.testMode&&value.confirmLive!==true)throw new PlatformError('Echter Versand erfordert ausdrückliche Freigabe und Microsoft-Konfiguration.');
    const before=(await client.query("SELECT * FROM platform.mail_settings WHERE id='central' FOR UPDATE")).rows[0];
    if(before.version!==value.version)throw new PlatformError('Einstellungen wurden zwischenzeitlich geändert.',409);
    if(!value.testMode&&!microsoft365Configuration(microsoft365Environment(before.config_id)).configured)throw new PlatformError('Microsoft-Konfiguration nicht sicher lesbar.',409);
    if(!value.testMode&&before.sender.endsWith('.invalid'))throw new PlatformError('Gültiges Microsoft-Absenderpostfach erforderlich.');
    if(!value.testMode){
     const health=(await client.query("SELECT healthy AND last_seen>now()-interval '90 seconds' AS ready FROM platform.mail_worker_health WHERE id='central'")).rows[0];
     if(!health?.ready)throw new PlatformError('Mail-Hintergrunddienst ist noch nicht bereit.',409);
     if(!before.connection_ok||before.checked_sender!==before.sender||!before.checked_at||Date.now()-new Date(before.checked_at).getTime()>24*3600000)throw new PlatformError('Bitte zuerst das aktuelle Absenderpostfach erfolgreich prüfen (gültig für 24 Stunden).',409);
    }
    await client.query("UPDATE platform.mail_settings SET test_mode=$1,version=version+1 WHERE id='central'",[value.testMode]);
    await client.query("INSERT INTO platform.audit_events(actor_id,action,target_id,changes) VALUES($1,'mail.settings.updated','central',$2::jsonb)",[actor,JSON.stringify([{field:'testMode',label:'MS365-Graph Testbetrieb',before:before.test_mode,after:value.testMode}])]);
   }else if(value.action==='enqueue'){
    if(!email(value.recipient)||typeof value.subject!=='string'||!value.subject.trim()||value.subject.length>200||/[\r\n]/.test(value.subject)||typeof value.body!=='string'||!value.body.trim()||value.body.length>4000||typeof value.requestId!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value.requestId))throw new PlatformError('Empfänger, Betreff und Nachricht prüfen.');
    const settings=(await client.query("SELECT sender,test_mode,enabled FROM platform.mail_settings WHERE id='central' FOR SHARE")).rows[0];
    const result=await client.query('INSERT INTO platform.mail_queue(id,request_id,sender,recipient,subject,body,actor_id,test_mode) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(request_id) DO NOTHING RETURNING id',[randomUUID(),value.requestId,settings.sender,value.recipient,value.subject,value.body,actor,settings.test_mode]);
    if(result.rowCount)await client.query("INSERT INTO platform.mail_log(mail_id,actor_id,action) VALUES($1,$2,'queued')",[result.rows[0].id,actor]);
    else {const previous=(await client.query('SELECT recipient,subject,body,actor_id FROM platform.mail_queue WHERE request_id=$1',[value.requestId])).rows[0];if(previous.actor_id!==actor||previous.recipient!==value.recipient||previous.subject!==value.subject||previous.body!==value.body)throw new PlatformError('Anfragekennung bereits für eine andere Nachricht verwendet.',409);}
   }else if(value.action==='retry'||value.action==='cancel'){
    if(typeof value.id!=='string'||!/^[a-f0-9-]{36}$/i.test(value.id))throw new PlatformError('Nachricht fehlt.');
    const mail=(await client.query('SELECT * FROM platform.mail_queue WHERE id=$1 FOR UPDATE',[value.id])).rows[0];
    if(!mail)throw new PlatformError('Nachricht nicht gefunden.',404);
    if(value.action==='retry'){
     if(mail.content_cleared_at)throw new PlatformError('Der Nachrichteninhalt wurde bewusst entfernt. Keine erneute Ausgabe möglich.',409);
     if(mail.status!=='failed')throw new PlatformError('Nur eindeutig fehlgeschlagene Nachrichten dürfen erneut versucht werden. Unklare Ergebnisse zuerst in Exchange prüfen.',409);
     await client.query("UPDATE platform.mail_queue SET status='queued',attempts=0,error=NULL,processed_at=NULL,next_attempt_at=now() WHERE id=$1",[mail.id]);
    }else{
     if(!['queued','retry','failed'].includes(mail.status))throw new PlatformError('Diese Nachricht kann nicht mehr abgebrochen werden.',409);
     await client.query("UPDATE platform.mail_queue SET status='cancelled',processed_at=now() WHERE id=$1",[mail.id]);
    }
    await client.query('INSERT INTO platform.mail_log(mail_id,actor_id,action) VALUES($1,$2,$3)',[mail.id,actor,value.action==='retry'?'requeued':'cancelled']);
   }else if(value.action==='process'){
    // Manual processing remains simulation-only. Live delivery is worker-only.
    const result=await client.query("UPDATE platform.mail_queue SET status='simulated',processed_at=now() WHERE status='queued' AND test_mode RETURNING id");
    for(const row of result.rows)await client.query("INSERT INTO platform.mail_log(mail_id,actor_id,action) VALUES($1,$2,'simulated')",[row.id,actor]);
   }else throw new PlatformError('Unbekannte E-Mail-Aktion.');
   return {ok:true};
  })
 };
}
