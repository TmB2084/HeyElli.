'use client';
import {useCallback,useEffect,useState} from 'react';
import {Notice} from '@/platform/shell';
import styles from './workspace.module.css';
// Wochenrückblick: Montag bis heute im Vergleich zur Vorwoche (gleicher Wochentag); Fokuszeit, Erledigtes, Zeit je Ziel.
export type Review={from:string;today:string;days:{day:string;seconds:number}[];focus:number;previousFocus:number;goalShare:number;done:{itemKey:string;title:string;doneAt:string}[];previousDone:number;teamFocus:number;goals:{id:string;title:string;seconds:number}[]};
const hours=(seconds:number)=>{const m=Math.round(seconds/60);return m<60?`${m} Min.`:`${Math.floor(m/60)}:${String(m%60).padStart(2,'0')} h`;};
const label=(day:string,options:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('de-DE',{timeZone:'UTC',...options}).format(new Date(day+'T12:00:00Z'));
const delta=(now:number,before:number,unit=(value:number)=>String(value))=>now===before?'wie Vorwoche':`${now>before?'+':'−'}${unit(Math.abs(now-before))} zur Vorwoche`;
const colors=['#d82b3c','#0a84ff','#8e9099','#30d158','#ff9f0a'];
export function weekNumber(day:string){const date=new Date(day+'T12:00:00Z'),weekday=(date.getUTCDay()+6)%7;date.setUTCDate(date.getUTCDate()-weekday+3);const first=new Date(Date.UTC(date.getUTCFullYear(),0,4));return 1+Math.round(((date.getTime()-first.getTime())/864e5-3+((first.getUTCDay()+6)%7))/7);}
export function useReview(){
 const [data,setData]=useState<Review|null>(null),[error,setError]=useState('');
 const load=useCallback(async()=>{try{const response=await fetch('/api/missioncontrol/rueckblick',{cache:'no-store',signal:AbortSignal.timeout(60000)}),value=await response.json();if(!response.ok)throw Error(value.error);setData(value);setError('');}catch(problem){setError(problem instanceof Error&&problem.name!=='TimeoutError'&&problem.name!=='TypeError'?problem.message:'Rückblick nicht erreichbar.');}},[]);
 useEffect(()=>{const start=setTimeout(()=>void load(),0);return()=>clearTimeout(start);},[load]);
 return {data,error,load};
}
export function ReviewKpis({data}:{data:Review}){
 return <div className={styles.kpis}>
  <div><b>{data.done.length}</b><small>Aufgaben erledigt · {delta(data.done.length,data.previousDone)}</small></div>
  <div><b>{hours(data.teamFocus)}</b><small>Fokuszeit im Team</small></div>
  <div><b>{data.goalShare} %</b><small>Fokus auf Ziele</small></div>
  <div><b>{hours(data.focus)}</b><small>meine Fokuszeit · {delta(data.focus,data.previousFocus,hours)}</small></div>
 </div>;
}
// Rechte Spalte (Ziele, Rückblick): Fokuszeit je Tag, Wohin ging die Zeit, Hinweis zur Zeiterfassung.
export function ReviewAside(){
 const {data,error}=useReview(),max=Math.max(1,...(data?.days??[]).map(day=>day.seconds)),goalMax=Math.max(1,...(data?.goals??[]).map(goal=>goal.seconds));
 return <>
  {error&&<Notice tone="error" role="alert">{error}</Notice>}
  <section className={styles.panel} aria-label="Fokuszeit je Tag"><h3>Fokuszeit je Tag <span>{data?`KW ${weekNumber(data.today)}`:''}</span></h3>
   <div className={styles.bars}>{(data?.days??[]).map(day=><div key={day.day}><i style={{height:`${Math.max(4,day.seconds/max*100)}%`}} data-today={day.day===data!.today||undefined} title={hours(day.seconds)}/><small>{label(day.day,{weekday:'short'})}</small></div>)}</div></section>
  <section className={styles.panel} aria-label="Wohin ging die Zeit"><h3>Wohin ging die Zeit <span>Team</span></h3>
   {data?.goals.length?data.goals.map((goal,index)=><div key={goal.id} className={styles.goalRow}><div className={styles.split}><span>{goal.title}</span><b>{hours(goal.seconds)}</b></div><div className={styles.progress}><i style={{width:`${goal.seconds/goalMax*100}%`,background:colors[index%colors.length]}}/></div></div>):<p className={styles.hint}>Noch keine Fokuszeit auf Aufgaben mit Ziel.</p>}</section>
  <section className={styles.panel} aria-label="Hinweis"><p className={styles.hint}>Fokuszeiten bleiben in heyelli. PDS übernimmt Zeiten nur gesammelt je Mitarbeiter (Stundenerfassung) – keine Einzelbuchung.</p></section>
 </>;
}
export function ReviewView(){
 const {data,error}=useReview();
 return <>
  <div className={styles.head}><div><h2>Wochenrückblick{data?` KW ${weekNumber(data.today)}`:''}</h2><small>{data?`${label(data.from,{day:'2-digit',month:'2-digit'})} bis ${label(data.today,{weekday:'long',day:'2-digit',month:'2-digit'})} · Vergleich zur Vorwoche bis zum selben Wochentag`:''}</small></div></div>
  {error&&<Notice tone="error" role="alert">{error}</Notice>}
  {!data&&!error&&<p role="status" className={styles.hint}>Rückblick wird geladen …</p>}
  {data&&<>
   <ReviewKpis data={data}/>
   <section className={styles.panel} aria-label="Erledigt"><h3>Erledigt in dieser Woche <span>über MissionControl</span></h3>{data.done.length?<ul className={styles.doneList}>{data.done.map(item=><li key={item.itemKey+item.doneAt}><span>{item.title}</span><small>{label(item.doneAt.slice(0,10),{weekday:'short'})}</small></li>)}</ul>:<p className={styles.hint}>Noch nichts über MissionControl erledigt.</p>}</section>
  </>}
 </>;
}
