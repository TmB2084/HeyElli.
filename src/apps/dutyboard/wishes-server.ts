import {appPermission} from '@/platform/app-access';
import 'server-only';
import type {PoolClient} from 'pg';
import {platformDatabase,permitted} from '@/platform/store';
import {readDutyYear} from '@/apps/planboard/kalender/duty-server';
import {CalendarError,type CalendarEvent} from '@/apps/planboard/kalender/domain';
import {pdsApi} from "@/platform/pds/connection/api";
import {readDutyExclusions} from './server';
import {checkSwap,exclusionDay,swapFingerprint} from './wish-domain';
import {activeWorkspaceSql} from '@/platform/accounts/core';
type Actor={id:string};
type Swap={id:string;year:number;requester_id:string;partner_id:string;first_event:CalendarEvent;second_event:CalendarEvent;status:string;progress:number;version:number;approved_by:string|null};
const db=()=>platformDatabase();
async function actor(client:PoolClient,id:string){const {rows}=await client.query('SELECT id,role,enabled FROM platform.users WHERE id=$1',[id]);if(!rows[0]?.enabled)throw new CalendarError('Benutzer nicht freigeschaltet.',403);return rows[0];}
async function history(client:PoolClient,user:string,target:string,action:string){await client.query('INSERT INTO platform.duty_wish_history(target_id,actor_id,action) VALUES($1,$2,$3)',[target,user,action]);}
async function transaction<T>(client:PoolClient,work:()=>Promise<T>){await client.query('BEGIN');try{const result=await work();await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}}
function uuid(value:unknown){if(typeof value!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value))throw new CalendarError('Ungültige Vorgangskennung.');return value;}
function category(data:Awaited<ReturnType<typeof readDutyYear>>){const categories=data.categories.filter(item=>item.name.trim().toLocaleLowerCase('de')==='bereitschaft');if(categories.length!==1)throw new CalendarError('Bereitschaftskategorie fehlt oder ist nicht eindeutig.');return categories[0].id;}
export async function dutyWishes(user:Actor,year:number){
 const client=await db().connect();try{const current=await actor(client,user.id),planner=(await appPermission(current,'/dutyboard')),admin=permitted(current,'admin'),data=await readDutyYear(year),exclusions=await readDutyExclusions(year,client);
  const swaps=await client.query(`SELECT s.*,a.display_name AS requester_name,b.display_name AS partner_name,p.display_name AS approver_name FROM platform.duty_swaps s JOIN platform.users a ON a.id=s.requester_id JOIN platform.users b ON b.id=s.partner_id LEFT JOIN platform.users p ON p.id=s.approved_by WHERE s.year=$1 AND ($2::boolean OR s.requester_id=$3 OR s.partner_id=$3) ORDER BY s.created_at DESC`,[year,planner,user.id]);
  const links=await client.query(`SELECT user_id,pds_user_uuid AS resource_id FROM platform.pds_user_mappings WHERE workspace_id=${activeWorkspaceSql} AND user_id=$1`,[user.id]);
  const events=await client.query(`SELECT h.target_id,h.actor_id,u.display_name AS actor_name,h.action,h.at FROM platform.duty_wish_history h JOIN platform.users u ON u.id=h.actor_id WHERE h.target_id=ANY($1::text[]) ORDER BY h.id`,[swaps.rows.map(item=>item.id)]);
  return {owner:user.id,planner,admin,resourceId:links.rows.find(item=>item.user_id===user.id)?.resource_id??null,resources:data.resources,events:data.events.filter(item=>item.categories.includes(category(data))),exclusions:exclusions.filter(item=>planner||item.user_id===user.id),swaps:swaps.rows.map(item=>({...item,history:events.rows.filter(event=>event.target_id===item.id)}))};
 }finally{client.release();}
}
export async function changeDutyWish(user:Actor,year:number,body:Record<string,unknown>){
 const client=await db().connect();let globalLocked=false,yearLocked=false;
 try{await client.query('SELECT pg_advisory_lock(94107,0)');globalLocked=true;await client.query('SELECT pg_advisory_lock(94106,$1)',[year]);yearLocked=true;const current=await actor(client,user.id),planner=(await appPermission(current,'/dutyboard'));const data=await readDutyYear(year),cat=category(data);
  const link=(await client.query(`SELECT pds_user_uuid AS resource_id FROM platform.pds_user_mappings WHERE workspace_id=${activeWorkspaceSql} AND user_id=$1`,[user.id])).rows[0]?.resource_id as string|undefined;
  if(body.action==='exclude'){
   if(!link)throw new CalendarError('Die Verwaltung muss Ihrem Konto zuerst einen PDS-Benutzer zuordnen.',403);const week=exclusionDay(year,body.day);
   if(data.events.some(event=>event.categories.includes(cat)&&event.resourceIds.includes(link)&&Date.parse(event.start)<Date.parse(week.end)&&Date.parse(event.end)>Date.parse(week.start)))throw new CalendarError('Für diese Woche besteht bereits eine Bereitschaft. Bitte einen Tausch vorschlagen.',409);
   if((await client.query("SELECT id FROM platform.duty_swaps WHERE year=$1 AND status='executing'",[year])).rows.length)throw new CalendarError('Ein Tausch wird ausgeführt. Bitte danach erneut versuchen.',409);
   const id=uuid(body.id);return await transaction(client,async()=>{const old=(await client.query("SELECT *,to_char(week_day,'YYYY-MM-DD') AS day FROM platform.duty_exclusions WHERE id=$1",[id])).rows[0];if(old){if(old.user_id!==user.id||old.resource_id!==link||old.day!==week.day)throw new CalendarError('Sperrkennung wird bereits verwendet.',409);return {ok:true};}await client.query('INSERT INTO platform.duty_exclusions(id,user_id,resource_id,week_day) VALUES($1,$2,$3,$4::date) ON CONFLICT(resource_id,week_day) DO NOTHING',[id,user.id,link,week.day]);await history(client,user.id,id,'week.excluded');return {ok:true};});
  }
  if(body.action==='unexclude'){
   const id=uuid(body.id),old=(await client.query("SELECT *,to_char(week_day,'YYYY-MM-DD') AS day FROM platform.duty_exclusions WHERE id=$1",[id])).rows[0];if(!old)return {ok:true};if(old.user_id!==user.id&&!planner)throw new CalendarError('Nur eigene Sperrwochen dürfen geändert werden.',403);exclusionDay(year,old.day);
   return await transaction(client,async()=>{await client.query('DELETE FROM platform.duty_exclusions WHERE id=$1',[id]);await history(client,user.id,id,'week.released');return {ok:true};});
  }
  if(body.action==='propose'){
   if(!link)throw new CalendarError('Bitte zuerst einen Mitarbeiter durch die Verwaltung zuordnen lassen.',403);const id=uuid(body.id),old=(await client.query('SELECT * FROM platform.duty_swaps WHERE id=$1',[id])).rows[0];if(old){if(old.requester_id!==user.id||old.first_event.id!==body.firstId||old.second_event.id!==body.secondId)throw new CalendarError('Tauschkennung wird bereits verwendet.',409);return {ok:true,id};}
   if((await client.query('SELECT id FROM platform.duty_plans WHERE year=$1 AND NOT complete',[year])).rows.length)throw new CalendarError('Bitte die laufende Jahresplanung zuerst abschließen.',409);
   const first=data.events.find(item=>item.id===body.firstId),second=data.events.find(item=>item.id===body.secondId);if(!first||!second||first.resourceIds.length!==1||first.resourceIds[0]!==link)throw new CalendarError('Bitte eine eigene Bereitschaft auswählen.',403);
   checkSwap(year,first,second,data.events,data.resources,cat,await readDutyExclusions(year,client));const partner=(await client.query(`SELECT l.user_id FROM platform.pds_user_mappings l JOIN platform.users u ON u.id=l.user_id WHERE l.workspace_id=${activeWorkspaceSql} AND l.pds_user_uuid=$1 AND u.enabled`,[second.resourceIds[0]])).rows[0]?.user_id;if(!partner||partner===user.id)throw new CalendarError('Für den Tauschpartner fehlt eine eindeutige aktive Benutzerzuordnung.');
   if((await client.query("SELECT id FROM platform.duty_swaps WHERE status IN ('pending','accepted','executing') AND (first_event->>'id'=ANY($1::text[]) OR second_event->>'id'=ANY($1::text[]))",[[first.id,second.id]])).rows.length)throw new CalendarError('Für einen dieser Termine besteht bereits ein offener Tauschwunsch.',409);
   return await transaction(client,async()=>{await client.query('INSERT INTO platform.duty_swaps(id,year,requester_id,partner_id,first_event,second_event) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)',[id,year,user.id,partner,JSON.stringify(first),JSON.stringify(second)]);await history(client,user.id,id,'swap.proposed-and-agreed');return {ok:true,id};});
  }
  const id=uuid(body.id),swap=(await client.query<Swap>('SELECT * FROM platform.duty_swaps WHERE id=$1 AND year=$2',[id,year])).rows[0];if(!swap)throw new CalendarError('Tauschwunsch nicht gefunden.',404);
  if(!planner&&![swap.requester_id,swap.partner_id].includes(user.id))throw new CalendarError('Kein Zugriff auf diesen Tauschwunsch.',403);
  if(body.action==='agree'||body.action==='reject'||body.action==='cancel'){
   if(swap.version!==body.version)throw new CalendarError('Tauschwunsch wurde geändert. Bitte neu laden.',409);
   if(body.action==='agree'&&(swap.partner_id!==user.id||swap.status!=='pending'))throw new CalendarError('Nur der Tauschpartner darf einen offenen Wunsch bestätigen.',403);
   if(body.action==='cancel'&&swap.requester_id!==user.id)throw new CalendarError('Nur der Antragsteller darf zurückziehen.',403);
   if(body.action==='reject'&&swap.partner_id!==user.id&&!planner)throw new CalendarError('Keine Berechtigung zum Ablehnen.',403);
   if(!['pending','accepted'].includes(swap.status))throw new CalendarError('Dieser Tausch kann nicht mehr geändert werden.',409);
   if(body.action==='agree'&&(await client.query(`SELECT u.id FROM platform.users u JOIN platform.pds_user_mappings l ON l.user_id=u.id AND l.workspace_id=${activeWorkspaceSql} WHERE u.enabled AND ((u.id=$1 AND l.pds_user_uuid=$2) OR (u.id=$3 AND l.pds_user_uuid=$4))`,[swap.requester_id,swap.first_event.resourceIds[0],swap.partner_id,swap.second_event.resourceIds[0]])).rows.length!==2)throw new CalendarError('Benutzerzuordnung oder Freischaltung wurde geändert.',409);
   if(body.action==='agree')checkSwap(year,swap.first_event,swap.second_event,data.events,data.resources,cat,await readDutyExclusions(year,client));
   const status=body.action==='agree'?'accepted':body.action==='reject'?'rejected':'cancelled';return await transaction(client,async()=>{await client.query("UPDATE platform.duty_swaps SET status=$2,partner_agreed_at=CASE WHEN $2='accepted' THEN now() ELSE partner_agreed_at END,version=version+1 WHERE id=$1",[id,status]);await history(client,user.id,id,'swap.'+status);return {ok:true};});
  }
  if(!['approve','resume'].includes(String(body.action))||!planner)throw new CalendarError('Nur die Planung darf den Tausch freigeben oder fortsetzen.',403);
  if(swap.status==='complete')return {ok:true,complete:true};if((await client.query('SELECT id FROM platform.duty_plans WHERE year=$1 AND NOT complete',[year])).rows.length)throw new CalendarError('Zuerst die laufende Jahresplanung beenden.',409);
  if(body.action==='approve'){
   if(swap.status!=='accepted'||swap.version!==body.version)throw new CalendarError('Beide Mitarbeiter müssen zuerst zustimmen. Bitte aktuellen Stand laden.',409);
   if((await client.query(`SELECT u.id FROM platform.users u JOIN platform.pds_user_mappings l ON l.user_id=u.id AND l.workspace_id=${activeWorkspaceSql} WHERE u.enabled AND ((u.id=$1 AND l.pds_user_uuid=$2) OR (u.id=$3 AND l.pds_user_uuid=$4))`,[swap.requester_id,swap.first_event.resourceIds[0],swap.partner_id,swap.second_event.resourceIds[0]])).rows.length!==2)throw new CalendarError('Beide Mitarbeiter müssen weiterhin freigeschaltet und zugeordnet sein.',409);
   checkSwap(year,swap.first_event,swap.second_event,data.events,data.resources,cat,await readDutyExclusions(year,client));
   await transaction(client,async()=>{await client.query("UPDATE platform.duty_swaps SET status='executing',approved_by=$2,approved_at=now(),version=version+1 WHERE id=$1",[id,user.id]);await history(client,user.id,id,'swap.approved');});swap.status='executing';swap.approved_by=user.id;
  }else if(swap.status!=='executing')throw new CalendarError('Dieser Tausch wartet nicht auf eine Fortsetzung.',409);
  const targets=checkSwap(year,swap.first_event,swap.second_event,data.events,data.resources,cat,await readDutyExclusions(year,client),true),api=await pdsApi('duty-swap:'+id);
  try{for(const [index,before] of [swap.first_event,swap.second_event].entries()){
    const fresh=await readDutyYear(year);checkSwap(year,swap.first_event,swap.second_event,fresh.events,fresh.resources,cat,await readDutyExclusions(year,client),true);
    const latest=await api.calendar.details(before.id),target=targets[index];if(swapFingerprint(latest)!==swapFingerprint(target)){
     if(swapFingerprint(latest)!==swapFingerprint(before))throw new CalendarError('Termin wurde während des Tauschs geändert. Bitte prüfen.',409);
     await api.calendar.update({id:before.id,start:before.start,end:before.end,resourceIds:target.resourceIds,options:{status:'FREI'},expected:{start:before.start,end:before.end,resourceIds:before.resourceIds,options:{status:before.status}}});
    }
    const actual=await api.calendar.details(before.id);if(swapFingerprint(actual)!==swapFingerprint(target))throw new CalendarError('Tausch konnte nicht vollständig bestätigt werden. Bitte fortsetzen.',409);
    await transaction(client,async()=>{await client.query('UPDATE platform.duty_swaps SET progress=GREATEST(progress,$2),version=version+1 WHERE id=$1',[id,index+1]);await client.query(`INSERT INTO platform.calendar_history(event_id,actor_id,actor_name,changes) SELECT $1,$2,COALESCE((SELECT display_name FROM platform.users WHERE id=$2),'Unbekannt'),$3::jsonb WHERE NOT EXISTS(SELECT 1 FROM platform.calendar_history WHERE event_id=$1 AND changes=$3::jsonb)`,[before.id,swap.approved_by,JSON.stringify([{field:'dutySwap',label:'Bereitschaftstausch',before:before.resourceIds,after:target.resourceIds,requestId:id}])]);});
   }
   const final=await readDutyYear(year);checkSwap(year,swap.first_event,swap.second_event,final.events,final.resources,cat,await readDutyExclusions(year,client),true);for(const target of targets)if(swapFingerprint(final.events.find(event=>event.id===target.id)!)!==swapFingerprint(target))throw new CalendarError('Ein Termin wurde während des Tauschs geändert. Bitte fortsetzen.',409);
   await transaction(client,async()=>{await client.query("UPDATE platform.duty_swaps SET status='complete',completed_at=now(),version=version+1 WHERE id=$1",[id]);await history(client,user.id,id,'swap.completed');});return {ok:true,complete:true};
  }finally{api.close();}
 }finally{try{if(yearLocked)await client.query('SELECT pg_advisory_unlock(94106,$1)',[year]);if(globalLocked)await client.query('SELECT pg_advisory_unlock(94107,0)');}finally{client.release();}}
}

// Mitarbeiter der aktiven PDS-Quelle (Auswahl für die Zuordnung von Konten zu PDS-Benutzern).
export async function employeeDirectory(){const api=await pdsApi();try{const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date());return await api.calendar.resources(day,day,undefined,true);}finally{api.close();}}

