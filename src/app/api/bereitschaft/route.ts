import {withRouteAccess} from '@/platform/app-access/route-access';
import {appPermission} from '@/platform/app-access';
import {requireSimulatorWrites} from "@/platform/pds/connection";
import {readDutyExclusions} from '@/apps/dutyboard/server';
import {exclusionEvents} from '@/apps/dutyboard/wish-domain';
import {checkDutyHolidays} from '@/apps/planboard/kalender/duty-holidays';
import {session,permitted,sameOrigin} from '@/platform/session';
import {platformDatabase} from '@/platform/store';
import {pdsApi} from "@/platform/pds/connection/api";
import {readDutyYear,dutyPreview} from '@/apps/planboard/kalender/duty-server';
import {dutyFingerprint,manualDutySlot,type DutySlot} from '@/apps/planboard/kalender/duty';
import {addDays,CalendarError} from '@/apps/planboard/kalender/domain';
const headers={'Cache-Control':'no-store'};
function yearValue(value:unknown){const year=Number(value);if(!Number.isInteger(year)||year<2000||year>2100)throw new Error('Jahr muss zwischen 2000 und 2100 liegen.');return year;}
async function scopedGET(request:Request){try{await requireSimulatorWrites();}catch{return Response.json({error:"Bereitschaftsplanung und Mitarbeiterzuordnungen sind für diese Quelle noch nicht freigegeben."},{status:409});}const user=await session();if(!user||!permitted(user,'read'))return Response.json({error:'Bitte anmelden.'},{status:user?403:401,headers});try{const year=yearValue(new URL(request.url).searchParams.get('year'));const data=await readDutyYear(year);const {rows}=await platformDatabase().query('SELECT id,actor_id,cursor,jsonb_array_length(payload) AS total FROM platform.duty_plans WHERE year=$1 AND NOT complete',[year]);return Response.json({...data,events:data.events.filter(event=>data.categories.some(category=>category.name.trim().toLocaleLowerCase('de')==='bereitschaft'&&event.categories.includes(category.id))),active:rows[0]??null,write:(await appPermission(user,'/dutyboard'))},{headers});}catch(error){return Response.json({error:error instanceof Error?error.message:'Bereitschaften nicht verfügbar.'},{status:400,headers});}}
async function scopedPOST(request:Request){
 try{await requireSimulatorWrites();}catch{return Response.json({error:"Diese Funktion ist im echten PDS-Lesebetrieb gesperrt."},{status:409});}

 const user=await session();if(!user||!(await appPermission(user,'/dutyboard')))return Response.json({error:'Keine Schreibberechtigung.'},{status:user?403:401,headers});if(!sameOrigin(request))return Response.json({error:'Unzulässiger Ursprung.'},{status:403,headers});
 const reader=request.body?.getReader();if(!reader)return Response.json({error:'Anfrage fehlt.'},{status:400,headers});const chunks:Uint8Array[]=[];let size=0;while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>32000){await reader.cancel();return Response.json({error:'Anfrage zu groß.'},{status:413,headers});}chunks.push(part.value);}
 let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return Response.json({error:'Ungültige Anfrage.'},{status:400,headers});}
 const db=await platformDatabase().connect();let locked:number|undefined;
 try{
  if(body.action==='preview'||body.action==='start'){
   const year=yearValue(body.year);if(!Array.isArray(body.resources)||body.resources.length>200||body.resources.some((id:unknown)=>typeof id!=='string'||id.length>200)||new Set(body.resources).size!==body.resources.length)throw new Error('Ungültige Mitarbeiterauswahl.');
   if(body.action==='start'){if(typeof body.jobId!=='string'||!/^[a-f0-9-]{36}$/.test(body.jobId))throw new Error('Planungskennung fehlt.');await db.query('SELECT pg_advisory_lock(94106,$1)',[year]);locked=year;const old=await db.query('SELECT * FROM platform.duty_plans WHERE id=$1',[body.jobId]);if(old.rows.length){if(old.rows[0].actor_id!==user.id)throw new Error('Plan gehört einem anderen Benutzer.');return Response.json({id:body.jobId,cursor:old.rows[0].cursor,total:old.rows[0].payload.length,complete:old.rows[0].complete},{headers});}if((await db.query("SELECT id FROM platform.duty_swaps WHERE year=$1 AND status='executing'",[year])).rows.length)throw new Error('Ein Bereitschaftstausch wird ausgeführt. Bitte diesen zuerst abschließen.');const active=await db.query('SELECT id FROM platform.duty_plans WHERE year=$1 AND NOT complete',[year]);if(active.rows.length)throw new Error('Für dieses Jahr läuft bereits eine Planung. Bitte diese fortsetzen.');}
   const holidays=checkDutyHolidays(body.holidays),data=await readDutyYear(year,!body.manualDay&&holidays.enabled?holidays.historyYears:0);data.events.push(...exclusionEvents(await readDutyExclusions(year,db)));const preview=dutyPreview(year,body.resources,data,body.manualDay,holidays);if(body.action==='preview')return Response.json(preview,{headers});
   if(preview.hash!==body.hash)throw new Error('Planungsgrundlage wurde geändert. Bitte Vorschlag neu berechnen.');
   const payload=preview.slots.filter(slot=>slot.resourceId&&!slot.reason);
   if(payload.some(slot=>slot.consecutiveWarning)){if(body.confirmConsecutive!==true)throw new Error('Bitte zwei aufeinanderfolgende Bereitschaftswochen ausdrücklich bestätigen.');for(const slot of payload)if(slot.consecutiveWarning)slot.consecutiveConfirmed=true;}if(!payload.length)throw new Error('Keine neu planbaren Wochen.');
   await db.query('INSERT INTO platform.duty_plans(id,actor_id,year,category_id,payload) VALUES($1,$2,$3,$4,$5::jsonb)',[body.jobId,user.id,year,preview.categoryId,JSON.stringify(payload)]);return Response.json({id:body.jobId,cursor:0,total:payload.length,complete:false},{headers});
  }
  if(!['step','stop'].includes(body.action)||typeof body.jobId!=='string'||!/^[a-f0-9-]{36}$/.test(body.jobId))throw new Error('Ungültiger Planungsschritt.');
  let result=await db.query('SELECT * FROM platform.duty_plans WHERE id=$1',[body.jobId]);if(!result.rows[0])throw new Error('Plan nicht gefunden.');const year=result.rows[0].year;await db.query('SELECT pg_advisory_lock(94106,$1)',[year]);locked=year;result=await db.query('SELECT * FROM platform.duty_plans WHERE id=$1',[body.jobId]);const job=result.rows[0];if(job.actor_id!==user.id&&!permitted(user,'admin'))throw new Error('Plan gehört einem anderen Benutzer.');if(body.action==='stop'){await db.query('UPDATE platform.duty_plans SET complete=true,updated_at=now() WHERE id=$1',[job.id]);return Response.json({ok:true},{headers});}const slots=job.payload as DutySlot[];if(job.complete)return Response.json({id:job.id,cursor:job.cursor,total:slots.length,complete:true},{headers});const slot=slots[job.cursor];
  if(Date.parse(slot.start)<=Date.now())throw new Error('Diese Woche hat inzwischen begonnen und darf nicht mehr neu geplant werden.');
  const api=await pdsApi(`duty:${job.id}:${job.cursor}`);
  const persist=()=>db.query('UPDATE platform.duty_plans SET payload=$2::jsonb,updated_at=now() WHERE id=$1',[job.id,JSON.stringify(slots)]);
  try{
   const current=await api.calendar.list(addDays(slot.day,-14),addDays(slot.day,21));current.events.push(...exclusionEvents(await readDutyExclusions(year,db)));
   const person=current.resources.find(item=>item.id===slot.resourceId);if(!person||person.planningFrom&&person.planningFrom>slot.day||person.planningTo&&person.planningTo<addDays(slot.day,7))throw new Error('Mitarbeiter ist für diese Woche nicht mehr vollständig planbar.');
   if(!current.categoryOptions?.some(item=>item.id===job.category_id&&item.name.trim().toLocaleLowerCase('de')==='bereitschaft'))throw new Error('Bereitschaftskategorie wurde geändert. Planung angehalten.');
   const marker=`HeyElli Bereitschaftsplanung ${job.id}:${job.cursor}`;
   if(!slot.createdId){const found=current.events.filter(event=>event.notes===marker&&event.start===slot.start&&event.end===slot.end&&event.resourceIds.length===1&&event.resourceIds[0]===slot.resourceId&&event.categories.includes(job.category_id));if(found.length>1)throw new Error('Mehrere Planungstermine gefunden. Bitte prüfen.');if(found.length===1){slot.createdId=found[0].id;await persist();}}
   for(const old of slot.old.filter(item=>!slot.deleted?.includes(item.id))){try{const latest=await api.calendar.details(old.id);if(dutyFingerprint(latest)!==dutyFingerprint(old))throw new Error('Ein bestehender Termin wurde zwischenzeitlich bearbeitet. Planung angehalten.');}catch(error){if(slot.createdId&&error instanceof CalendarError&&error.status===404){slot.deleted=[...(slot.deleted??[]),old.id];await persist();}else throw error;}}
   const overlaps=(event:{start:string;end:string})=>Date.parse(event.start)<Date.parse(slot.end)&&Date.parse(event.end)>Date.parse(slot.start);
   if(current.events.some(event=>event.categories.includes(job.category_id)&&overlaps(event)&&event.id!==slot.createdId&&!slot.old.some(old=>old.id===event.id)))throw new Error('Eine neue Bereitschaft überschneidet diese Woche. Planung angehalten.');
   const checked=manualDutySlot(year,slot.day,person,current.events.filter(event=>event.id!==slot.createdId),job.category_id,new Date(),slot.consecutiveConfirmed===true);
   if(JSON.stringify(checked.consecutiveNeighbors??[])!==JSON.stringify(slot.consecutiveNeighbors??[]))throw new Error('Angrenzende Bereitschaften wurden geändert. Bitte Zuordnung neu prüfen und bestätigen.');
   if(current.events.some(event=>event.resourceIds.includes(slot.resourceId!)&&event.status!=='FREI'&&['URLAUB','ABWESENHEIT','PRIVATE_ABWESENHEIT'].includes(event.type)&&overlaps(event)))throw new Error('Mitarbeiter ist inzwischen abwesend. Planung angehalten.');
   if(!slot.createdId){const saved=await api.calendar.create({title:'Bereitschaft',notes:marker,start:slot.start,end:slot.end,resourceIds:[slot.resourceId],type:'FREIER',options:{categories:[job.category_id],status:'FREI',allDay:false,fixed:false}});slot.createdId=saved.id;await persist();}
   const created=await api.calendar.details(slot.createdId);if(created.start!==slot.start||created.end!==slot.end||created.resourceIds.length!==1||created.resourceIds[0]!==slot.resourceId||!created.categories.includes(job.category_id))throw new Error('Neue Bereitschaft wurde zwischenzeitlich geändert. Planung angehalten.');
   for(const old of slot.old){if(slot.deleted?.includes(old.id))continue;await api.calendar.remove({id:old.id,expected:{start:old.start,end:old.end,resourceIds:old.resourceIds}});slot.deleted=[...(slot.deleted??[]),old.id];await persist();}
   await db.query(`INSERT INTO platform.calendar_history(event_id,actor_id,actor_name,changes) SELECT $1,$2,$3,$4::jsonb WHERE NOT EXISTS(SELECT 1 FROM platform.calendar_history WHERE event_id=$1 AND changes=$4::jsonb)`,[slot.createdId,user.id,user.displayName,JSON.stringify([{field:'duty',label:'Bereitschaftsplanung',before:slot.old.map(old=>old.resourceIds).flat(),after:slot.resourceId},...(slot.consecutiveConfirmed?[{field:'consecutiveDuty',label:'Zwei Bereitschaftswochen ausdrücklich bestätigt',before:null,after:slot.consecutiveWarning}]:[])])]);
   const cursor=job.cursor+1;await db.query('UPDATE platform.duty_plans SET cursor=$2,complete=$3,updated_at=now() WHERE id=$1',[job.id,cursor,cursor===slots.length]);return Response.json({id:job.id,cursor,total:slots.length,complete:cursor===slots.length},{headers});
  }finally{api.close();}
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Planung fehlgeschlagen. Bitte Status prüfen und fortsetzen.'},{status:409,headers});}finally{if(locked!==undefined)await db.query('SELECT pg_advisory_unlock(94106,$1)',[locked]);db.release();}
}

export const GET=withRouteAccess('/api/bereitschaft','GET',scopedGET);

export const POST=withRouteAccess('/api/bereitschaft','POST',scopedPOST);
