import 'server-only';
import {appPermission} from '../../platform/app-access';
import {requireAppRead} from '../../platform/app-access/route-access';
import {PdsProtocolError,PdsTasks,openTaskStatuses,type PdsTransport} from '../../platform/pds/api';
import {pdsSource} from '../../platform/pds/connection';
import {pdsApi} from '../../platform/pds/connection/api';
import {platformDatabase,PlatformError} from '../../platform/store';
import {serviceMatchContext} from '../servicehub/akten';
import {goalsStore,type Goal,type GoalInput} from './goals-store';
import {missionStore} from './store';
// Ziele mit Fortschritt aus PDS und Service (Kennzahlen gegen die OpenAPI geprüft, siehe docs/missioncontrol.md) und Wochenrückblick.
const goals=()=>goalsStore(platformDatabase());
const closedOrder=/erledigt|abgeschlossen|storniert|abgerechnet/i;
const berlinDay=(date:Date)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(date);
const shift=(day:string,days:number)=>new Date(Date.parse(day+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
async function sourceKey(){const source=await pdsSource();return source.mode==='simulator'?'simulator':'pds:'+source.workspaceId;}
async function reader(){const user=await requireAppRead('/missioncontrol');return user;}
async function writer(){const user=await reader();if(!await appPermission(user,'/missioncontrol'))throw new PlatformError('Schreibrecht für MissionControl erforderlich.',403);return user;}
type Row=Record<string,unknown>;
// Angebote in den gewählten Status (POST /vorgang/listangebote, statusUUIDs); Alter über belegDatum aus /vorgang/details.
async function openOffers(transport:PdsTransport,statuses:string[],minAge:number|null,today:string){
 const rows:Row[]=[];
 for(let page=0;page<20;page++){const result=await transport.request('POST','/vorgang/listangebote',{page,entriesPerPage:500,statusUUIDs:statuses}) as {totalHitCount?:number;resultList?:Row[]};if(!Array.isArray(result?.resultList))throw new PdsProtocolError('Ungültige Angebotsliste.');rows.push(...result.resultList);if(rows.length>=(result.totalHitCount??0)||!result.resultList.length)break;}
 if(!minAge)return {value:rows.length,partial:false};
 const limit=today&&shift(today,-minAge),candidates=rows.slice(0,300);let count=0;
 for(let i=0;i<candidates.length;i+=6)for(const detail of await Promise.all(candidates.slice(i,i+6).map(row=>transport.request('POST','/vorgang/details',{uuid:row.uuid,vorgangstyp:'ANGEBOT'}) as Promise<Row>)))if(typeof detail?.belegDatum==='string'&&detail.belegDatum.slice(0,10)<=limit)count++;
 return {value:count,partial:rows.length>300};
}
function progress(goal:Goal,value:number){
 if(goal.direction==='min')return goal.target===0?100:Math.max(0,Math.min(100,Math.round(value/goal.target*100)));
 if(value<=goal.target)return 100;
 if(goal.startValue!=null&&goal.startValue>goal.target)return Math.max(0,Math.min(100,Math.round((goal.startValue-value)/(goal.startValue-goal.target)*100)));
 return goal.target===0?0:Math.max(0,Math.min(99,Math.round(goal.target/value*100)));
}
function status(goal:Goal,share:number,today:string){
 if(share>=100)return 'reached';if(today>goal.periodTo)return 'missed';
 const total=Math.max(1,(Date.parse(goal.periodTo)-Date.parse(goal.periodFrom))/864e5),elapsed=Math.max(0,Math.min(total,(Date.parse(today)-Date.parse(goal.periodFrom))/864e5));
 return share>=elapsed/total*100-10?'on_track':'behind';
}
export async function missionGoals(){
 const user=await reader(),source=await sourceKey(),today=berlinDay(new Date()),weekStart=shift(today,-((new Date(today+'T12:00:00Z').getUTCDay()+6)%7));
 const list=await goals().list(source),api=await pdsApi();
 try{
  const needs=new Set(list.map(goal=>goal.metric)),values=new Map<string,{value:number|null;error?:string;partial?:boolean}>();
  let unplanned:number|null=null,overdue:number|null=null;const errors:string[]=[];
  if(needs.has('unplanned_orders'))try{const context=await serviceMatchContext();unplanned=context.orders.filter(order=>order.unplanned&&!closedOrder.test(order.status)).length;}catch{errors.push('Serviceaufträge derzeit nicht abrufbar.');}
  if(needs.has('overdue_tasks'))try{overdue=(await new PdsTasks(api.transport).list({status:openTaskStatuses,dueBefore:new Date().toISOString()})).items.length;}catch{errors.push('PDS-Aufgaben derzeit nicht abrufbar.');}
  for(const goal of list){
   if(goal.metric==='manual'){values.set(goal.id,{value:goal.manualValue});continue;}
   if(goal.metric==='unplanned_orders'){values.set(goal.id,{value:unplanned,...(unplanned===null?{error:'nicht abrufbar'}:{})});continue;}
   if(goal.metric==='overdue_tasks'){values.set(goal.id,{value:overdue,...(overdue===null?{error:'nicht abrufbar'}:{})});continue;}
   try{const offers=await openOffers(api.transport,goal.offerStatuses,goal.offerMinAgeDays,today);values.set(goal.id,{value:offers.value,partial:offers.partial});}catch{values.set(goal.id,{value:null,error:'Angebote derzeit nicht abrufbar'});}
  }
  for(const goal of list){const entry=values.get(goal.id);if(entry?.value!=null&&today>=goal.periodFrom&&today<=goal.periodTo)await goals().record(goal.id,today,entry.value);}
  const history=await goals().history(list.map(goal=>goal.id),shift(today,-41)),focus=await goals().focusByGoal(source,weekStart,today),links=await goals().links(source);
  let statuses:{id:string;name:string}[]=[];
  try{const rows=await api.transport.request('POST','/vorgang/liststatus',{vorgangstyp:'ANGEBOT'});if(Array.isArray(rows))statuses=(rows as Row[]).map(row=>({id:String(row.uuid),name:String(row.bezeichnung??row.uuid)}));}catch{/* Auswahl nur beim Anlegen nötig */}
  return {today,goals:list.map(goal=>{const entry=values.get(goal.id)!,share=entry.value==null?null:progress(goal,entry.value);
    return {...goal,value:entry.value,error:entry.error??null,partial:!!entry.partial,progress:share,status:share==null?'unknown':status(goal,share,today),history:history.get(goal.id)??[],focusWeek:focus.get(goal.id)??0,linked:[...links.values()].filter(id=>id===goal.id).length};}),
   offerStatuses:statuses,errors,canWrite:await appPermission(user,'/missioncontrol'),loadedAt:new Date().toISOString()};
 }finally{api.close();}
}
export async function missionGoalChange(input:unknown){
 const user=await writer(),source=await sourceKey();if(!input||typeof input!=='object'||Array.isArray(input))throw new PlatformError('Ungültige Eingabe.',400);
 const body=input as GoalInput&{action?:unknown;value?:unknown;itemKey?:unknown;goalId?:unknown};
 switch(body.action){
  case 'save':return {goal:await goals().save(user.id,source,body)};
  case 'archive':return {goal:await goals().archive(user.id,source,body.id,true)};
  case 'restore':return {goal:await goals().archive(user.id,source,body.id,false)};
  case 'manual':return {goal:await goals().manual(user.id,source,body.id,body.value)};
  case 'link':return {goalId:await goals().link(user.id,source,body.itemKey,body.goalId)};
  default:throw new PlatformError('Unbekannte Aktion.',400);
 }
}
export async function missionGoalLinks(){await reader();return goals().links(await sourceKey());}
export async function missionDone(userId:string,itemKey:string,title:string){await goals().done(userId,await sourceKey(),itemKey,title);}
// Wochenrückblick: Montag bis heute im Vergleich zur Vorwoche (gleicher Wochentag).
export async function missionReview(){
 const user=await reader(),source=await sourceKey(),today=berlinDay(new Date()),offset=(new Date(today+'T12:00:00Z').getUTCDay()+6)%7,from=shift(today,-offset),prevFrom=shift(from,-7),prevTo=shift(today,-7);
 const mission=missionStore(platformDatabase()),[mine,prevMine,done,prevDone,team,byGoal,list,links]=await Promise.all([mission.seconds(user.id,source,from,today),mission.seconds(user.id,source,prevFrom,prevTo),goals().doneBetween(user.id,source,from,today),goals().doneBetween(user.id,source,prevFrom,prevTo),goals().teamFocus(source,from,today),goals().focusByGoal(source,from,today),goals().list(source),goals().links(source)]);
 const days=Array.from({length:offset+1},(_,index)=>shift(from,index)).filter(day=>{const d=new Date(day+'T12:00:00Z').getUTCDay();return (d!==0&&d!==6)||day===today;});
 const total=mine.reduce((sum,row)=>sum+row.seconds,0),onGoals=mine.filter(row=>links.has(row.itemKey)).reduce((sum,row)=>sum+row.seconds,0);
 return {from,today,days:days.map(day=>({day,seconds:mine.filter(row=>row.day===day).reduce((sum,row)=>sum+row.seconds,0)})),focus:total,previousFocus:prevMine.reduce((sum,row)=>sum+row.seconds,0),goalShare:total?Math.round(onGoals/total*100):0,
  done,previousDone:prevDone.length,teamFocus:team,goals:list.map(goal=>({id:goal.id,title:goal.title,seconds:byGoal.get(goal.id)??0})).filter(goal=>goal.seconds>0).sort((a,b)=>b.seconds-a.seconds)};
}
