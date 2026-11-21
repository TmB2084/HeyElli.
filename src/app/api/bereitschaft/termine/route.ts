import {withRouteAccess} from '@/platform/app-access/route-access';
import {appPermission} from '@/platform/app-access';
import {createHash} from 'node:crypto';
import {session,sameOrigin} from '@/platform/session';
import {requireSimulatorWrites} from '@/platform/pds/connection';
import {pdsApi} from '@/platform/pds/connection/api';
import {platformDatabase} from '@/platform/store';
import {calendarAuditStore} from '@/apps/planboard/kalender/server';
import {dutyFingerprint} from '@/apps/planboard/kalender/planning';
import {CalendarError,berlinWall,eventOptions,type CalendarEvent} from '@/apps/planboard/kalender/domain';
import {guardDutyExclusions,dutySplit} from '@/apps/dutyboard/server';
const headers={'Cache-Control':'no-store'};
type Payload={action:'split'|'delete';original:CalendarEvent;split?:string;resourceId?:string;createdId?:string};
async function scopedPOST(request:Request){
 const user=await session();if(!user||!(await appPermission(user,'/dutyboard')))return Response.json({error:'Keine Schreibberechtigung.'},{status:user?403:401,headers});
 if(!sameOrigin(request))return Response.json({error:'Unzulässiger Ursprung.'},{status:403,headers});
 try{await requireSimulatorWrites();}catch{return Response.json({error:'Diese Funktion ist im echten PDS-Lesebetrieb gesperrt.'},{status:409,headers});}
 const db=await platformDatabase().connect();let api:Awaited<ReturnType<typeof pdsApi>>|undefined;let prepared=false;
 try{
  const reader=request.body?.getReader();if(!reader)throw new Error('Anfrage fehlt.');let size=0;const chunks:Uint8Array[]=[];while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>16000){await reader.cancel();throw new Error('Anfrage zu groß.');}chunks.push(part.value);}
  const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!['split','delete'].includes(body.action)||typeof body.id!=='string'||body.id.length>100||typeof body.expected!=='string'||body.expected.length>12000||typeof body.operationId!=='string'||!/^[a-f0-9-]{36}$/.test(body.operationId))throw new Error('Ungültige Bereitschaftsaktion.');
  const hash=createHash('sha256').update(JSON.stringify([body.action,body.id,body.expected,body.splitAt??null,body.resourceId??null])).digest('hex');
  // The year-wide planner uses the same lock. Lock all relevant years in order.
  await db.query('SELECT pg_advisory_lock(94107,hashtext($1))',[body.id]);
  let row=(await db.query('SELECT * FROM platform.duty_event_operations WHERE id=$1 OR (event_id=$2 AND NOT complete) ORDER BY created_at LIMIT 1',[body.operationId,body.id])).rows[0];
  if(row&&(row.actor_id!==user.id||row.request_hash!==hash))throw new Error('Ein anderer oder abweichender Vorgang bearbeitet diese Bereitschaft. Bitte ursprünglichen Vorgang fortsetzen.');
  prepared=!!row;
  if(row?.complete)return Response.json({ok:true},{headers});
  api=await pdsApi(`duty-event:${row?.id??body.operationId}`,(before,after)=>calendarAuditStore().record(user.id,before,after),guardDutyExclusions);
  let original:CalendarEvent=row?.payload.original??await api.calendar.details(body.id);
  const years=[...new Set([Number(berlinWall(original.start).slice(0,4))-1,Number(berlinWall(original.start).slice(0,4)),Number(berlinWall(original.end).slice(0,4))])].sort();
  for(const year of years)await db.query('SELECT pg_advisory_lock(94106,$1)',[year]);
  if((await db.query("SELECT id FROM platform.duty_plans WHERE year=ANY($1::int[]) AND NOT complete UNION ALL SELECT id FROM platform.duty_swaps WHERE year=ANY($1::int[]) AND status='executing'",[years])).rows.length)throw new Error('Eine Planung oder ein Tausch läuft. Bitte zuerst abschließen.');
  const categories=await api.calendar.categories();if(!categories.some(item=>item.name.trim().toLocaleLowerCase('de')==='bereitschaft'&&original.categories.includes(item.id)))throw new Error('Kein Bereitschaftstermin.');
  if(!row){
   if(dutyFingerprint(original)!==body.expected)throw new Error('Bereitschaft wurde zwischenzeitlich geändert. Bitte Übersicht neu laden.');
   if(original.fixed)throw new Error('Fixierte Bereitschaften können nicht geändert werden.');
   const payload:Payload={action:body.action,original};
   if(body.action==='split'){const current=await api.calendar.list(berlinWall(original.start).slice(0,10),berlinWall(original.end).slice(0,10));const plan=dutySplit(original,body.splitAt,body.resourceId,current.resources,current.events);payload.split=plan.split;payload.resourceId=plan.resourceId;}
   await db.query('INSERT INTO platform.duty_event_operations(id,actor_id,event_id,request_hash,payload) VALUES($1,$2,$3,$4,$5::jsonb)',[body.operationId,user.id,body.id,hash,JSON.stringify(payload)]);
   row={id:body.operationId,payload};prepared=true;
  }
  const payload=row.payload as Payload;original=payload.original;
  const persist=()=>db.query('UPDATE platform.duty_event_operations SET payload=$2::jsonb,updated_at=now() WHERE id=$1',[row.id,JSON.stringify(payload)]);
  if(payload.action==='delete'){
   let latest:CalendarEvent|undefined;try{latest=await api.calendar.details(original.id);}catch(error){if(!(error instanceof CalendarError&&error.status===404))throw error;}
   if(latest){if(dutyFingerprint(latest)!==dutyFingerprint(original))throw new Error('Bereitschaft wurde zwischenzeitlich geändert. Löschen angehalten.');await api.calendar.remove({id:original.id,expected:original});}
  }else{
   const latest=await api.calendar.details(original.id);
   const shortened:CalendarEvent={...original,end:payload.split!,status:'FREI'};
   if(dutyFingerprint(latest)!==dutyFingerprint(original)&&dutyFingerprint(latest)!==dutyFingerprint(shortened))throw new Error('Bereitschaft wurde zwischenzeitlich geändert. Teilung angehalten.');
   const marker=`HeyElli Bereitschaftsteilung ${row.id}`;
   const current=await api.calendar.list(berlinWall(original.start).slice(0,10),berlinWall(original.end).slice(0,10));
   if(!payload.createdId){const found=current.events.filter(item=>item.notes?.endsWith(marker));if(found.length>1)throw new Error('Mehrere Teilungstermine gefunden. Bitte prüfen.');if(found.length){payload.createdId=found[0].id;await persist();}}
   dutySplit(original,berlinWall(payload.split!),payload.resourceId,current.resources,current.events.filter(item=>item.id!==payload.createdId));
   if(!payload.createdId){const saved=await api.calendar.create({title:original.title,notes:[original.notes,marker].filter(Boolean).join('\n'),start:payload.split,end:original.end,resourceIds:[payload.resourceId],type:'FREIER',options:{...eventOptions(original),status:'FREI',fixed:false}});payload.createdId=saved.id;await persist();}
   const second=await api.calendar.details(payload.createdId!);
   if(second.start!==payload.split||second.end!==original.end||second.resourceIds.length!==1||second.resourceIds[0]!==payload.resourceId||!second.notes?.endsWith(marker)||second.fixed||JSON.stringify(second.categories)!==JSON.stringify(original.categories))throw new Error('Zweiter Teil wurde inzwischen geändert. Teilung angehalten.');
   await api.calendar.update({id:original.id,start:original.start,end:payload.split,resourceIds:original.resourceIds,expected:{start:original.start,end:original.end,resourceIds:original.resourceIds}});
  }
  const changes=JSON.stringify([{field:'dutyOperation',label:payload.action==='split'?'Bereitschaft geteilt':'Bereitschaft gelöscht',before:original,after:payload.action==='split'?{first:{...original,end:payload.split},secondId:payload.createdId,resourceId:payload.resourceId}:null,operationId:row.id}]);
  await db.query('BEGIN');try{
   for(const id of [original.id,...(payload.createdId?[payload.createdId]:[])])await db.query('INSERT INTO platform.calendar_history(event_id,actor_id,actor_name,changes) SELECT $1,$2,$3,$4::jsonb WHERE NOT EXISTS(SELECT 1 FROM platform.calendar_history WHERE event_id=$1 AND changes=$4::jsonb)',[id,user.id,user.displayName,changes]);
   await db.query('UPDATE platform.duty_event_operations SET complete=true,updated_at=now() WHERE id=$1',[row.id]);await db.query('COMMIT');
  }catch(error){await db.query('ROLLBACK');throw error;}
  return Response.json({ok:true},{headers});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Aktion fehlgeschlagen. Bitte denselben Vorgang erneut versuchen.',retryOnly:prepared},{status:409,headers});}
 finally{api?.close();await db.query('SELECT pg_advisory_unlock_all()');db.release();}
}

export const POST=withRouteAccess('/api/bereitschaft/termine','POST',scopedPOST);
