import {microsoft365Environment} from './configuration.ts';
import type {Pool} from 'pg';
import {sendMicrosoft365,type DeliveryResult} from './microsoft365.ts';
import {mailForDelivery} from '../server-operation/index.ts';
type Mail={id:string;sender:string;recipient:string;subject:string;body:string;test_mode:boolean;attempts:number};
export async function processMailQueue(pool:Pool,deliver?:((mail:Mail)=>Promise<DeliveryResult>)){
 const client=await pool.connect();let locked=false;
 try{
  locked=(await client.query('SELECT pg_try_advisory_lock(94108,0) AS locked')).rows[0].locked;if(!locked)return;
  const interrupted=await client.query("UPDATE platform.mail_queue SET status='unknown',error='Verarbeitung unterbrochen. Vor erneutem Versand in Exchange prüfen.' WHERE status='sending' RETURNING id");
  for(const row of interrupted.rows)await client.query("INSERT INTO platform.mail_log(mail_id,actor_id,action) VALUES($1,'mail-worker','unknown')",[row.id]);
  for(let n=0;n<20;n++){
   await client.query("UPDATE platform.mail_worker_health SET last_seen=now() WHERE id='central'");
   await client.query('BEGIN');
   const settings=(await client.query("SELECT config_id,test_mode,enabled FROM platform.mail_settings WHERE id='central' FOR SHARE")).rows[0];
   if(!settings.enabled){await client.query('COMMIT');break;}
   const mail=(await client.query<Mail>("SELECT * FROM platform.mail_queue WHERE status IN ('queued','retry') AND next_attempt_at<=now() AND (test_mode OR NOT $1::boolean) ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED",[settings.test_mode])).rows[0];
   if(!mail){await client.query('COMMIT');break;}
   // Testinstanz: HEYELLI_MAIL_MODUS=aus simuliert jede Mail, =umleiten sendet nur an die Umleitungsadresse.
   const delivery=mailForDelivery(mail);
   if(mail.test_mode||!delivery){await client.query("UPDATE platform.mail_queue SET status='simulated',processed_at=now() WHERE id=$1",[mail.id]);await client.query("INSERT INTO platform.mail_log(mail_id,actor_id,action) VALUES($1,'mail-worker','simulated')",[mail.id]);await client.query('COMMIT');continue;}
   // Persist intent before any remote call. A crash cannot cause blind resending.
   await client.query("UPDATE platform.mail_queue SET status='sending',attempts=attempts+1,error=NULL WHERE id=$1",[mail.id]);await client.query('COMMIT');
   await client.query('BEGIN');
   const current=(await client.query("SELECT config_id,test_mode,enabled FROM platform.mail_settings WHERE id='central' FOR SHARE")).rows[0];
   if(current.test_mode||!current.enabled){await client.query("UPDATE platform.mail_queue SET status='queued',attempts=attempts-1 WHERE id=$1",[mail.id]);await client.query('COMMIT');continue;}
   // Hold settings lock through the request: enabling test mode waits for in-flight work.
   let result:DeliveryResult;try{result=await (deliver?deliver(delivery):sendMicrosoft365(delivery,microsoft365Environment(current.config_id)));}catch{result={status:'unknown',error:'Unerwarteter Abbruch. Versandstatus in Exchange prüfen.'};}
   if(result.status==='retry'&&mail.attempts+1>=5)result={status:'failed',error:'Maximale Anzahl sicherer Wiederholungen erreicht.'};
   const delay=Math.max(result.delay??0,Math.min(3600,60*2**mail.attempts));
   await client.query('UPDATE platform.mail_queue SET status=$2,error=$3,processed_at=CASE WHEN $2 IN (\'accepted\',\'failed\',\'unknown\') THEN now() ELSE NULL END,next_attempt_at=now()+($4::double precision * interval \'1 second\') WHERE id=$1',[mail.id,result.status,result.error,delay]);
   await client.query("INSERT INTO platform.mail_log(mail_id,actor_id,action) VALUES($1,'mail-worker',$2)",[mail.id,result.status]);await client.query('COMMIT');
  }
 }catch(error){await client.query('ROLLBACK');throw error;}finally{if(locked)await client.query('SELECT pg_advisory_unlock(94108,0)');client.release();}
}
