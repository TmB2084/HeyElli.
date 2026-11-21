'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Notice,PopUpButton} from '@/platform/shell';
import {ReviewKpis,useReview,weekNumber} from './review-view';
import styles from './workspace.module.css';
// Ziele: Karten mit Wert, Fortschritt, Verlauf und Status; Kennzahlen kommen automatisch aus PDS/Service oder werden gepflegt.
type Goal={id:string;title:string;metric:'unplanned_orders'|'overdue_tasks'|'open_offers'|'manual';direction:'max'|'min';target:number;startValue:number|null;manualValue:number|null;offerStatuses:string[];offerMinAgeDays:number|null;ownerName:string|null;periodFrom:string;periodTo:string;version:number;
 value:number|null;error:string|null;partial:boolean;progress:number|null;status:'reached'|'on_track'|'behind'|'missed'|'unknown';history:{day:string;value:number}[];focusWeek:number;linked:number};
type Data={today:string;goals:Goal[];offerStatuses:{id:string;name:string}[];errors:string[];canWrite:boolean;loadedAt:string};
export const metricLabels:Record<Goal['metric'],string>={unplanned_orders:'Aufträge ohne Termin · aus Service',overdue_tasks:'Überfällige PDS-Aufgaben · aus PDS',open_offers:'Offene Angebote · aus PDS',manual:'Manuell gepflegter Wert'};
const statusLabels:Record<Goal['status'],string>={reached:'erreicht',on_track:'im Plan',behind:'hinter Plan',missed:'verfehlt',unknown:'kein Wert'};
const statusTone:Record<Goal['status'],string>={reached:'ok',on_track:'ok',behind:'warn',missed:'bad',unknown:'plain'};
const colors=['#d82b3c','#0a84ff','#30d158','#ff9f0a','#bf5af2','#64d2ff'];
const date=(day:string)=>new Intl.DateTimeFormat('de-DE',{timeZone:'UTC',day:'2-digit',month:'2-digit',year:'2-digit'}).format(new Date(day+'T12:00:00Z'));
async function change(body:Record<string,unknown>){const response=await fetch('/api/missioncontrol/ziele',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)}),value=await response.json();if(!response.ok)throw Error(value.error);return value;}
const message=(problem:unknown,fallback:string)=>problem instanceof Error&&problem.name!=='TimeoutError'&&problem.name!=='TypeError'?problem.message:fallback;
export function GoalsView({onChanged}:{onChanged:()=>void}){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[editing,setEditing]=useState<Goal|'new'|null>(null),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{try{const response=await fetch('/api/missioncontrol/ziele',{cache:'no-store',signal:AbortSignal.timeout(90000)}),value=await response.json();if(!response.ok)throw Error(value.error);setData(value);setError('');}catch(problem){setError(message(problem,'Ziele sind derzeit nicht erreichbar.'));}},[]);
 useEffect(()=>{const start=setTimeout(()=>void load(),0);return()=>clearTimeout(start);},[load]);
 async function act(body:Record<string,unknown>,done:string){setBusy(true);setNotice('');try{await change(body);setNotice(done);await load();onChanged();}catch(problem){setNotice(message(problem,'Änderung nicht gespeichert.'));}finally{setBusy(false);}}
 const review=useReview(),stand=data?new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}).format(new Date(data.loadedAt)):'';
 return <>
  <div className={styles.head}><div><h2>Ziele</h2><small>Team Innendienst · Fortschritt aus PDS und Service</small></div>{data?.canWrite&&<div className={styles.capsule}><button type="button" onClick={()=>setEditing('new')}><span aria-hidden="true">＋</span>Ziel</button></div>}</div>
  {error&&<Notice tone="error" role="alert">{error} <button type="button" onClick={()=>void load()}>Erneut versuchen</button></Notice>}
  {notice&&<p role="status" className="sr-only">{notice}</p>}
  {data?.errors.map(text=><Notice key={text} tone="neutral">{text}</Notice>)}
  {!data&&!error&&<p role="status" className={styles.hint}>Ziele werden geladen …</p>}
  {data&&!data.goals.length&&<div className={styles.slot} style={{minHeight:140}}>Noch keine Ziele. {data.canWrite?'Mit „＋ Ziel“ das erste Teamziel anlegen.':''}</div>}
  <div className={styles.goals}>{data?.goals.map((goal,index)=>{const color=colors[index%colors.length],week=goal.history.slice(-7),max=Math.max(1,...week.map(point=>point.value),goal.value??0);
   return <article key={goal.id} className={styles.goal}>
    <div className={styles.goalTop}><div><b>{goal.title}</b><small>{metricLabels[goal.metric]}{goal.metric==='open_offers'&&goal.offerMinAgeDays?` · älter als ${goal.offerMinAgeDays} Tage`:''}</small></div><span className={styles.goalTools}><span className={styles.status} data-tone={statusTone[goal.status]}>{statusLabels[goal.status]}</span>{data.canWrite&&<button type="button" className={styles.icon} aria-label={`${goal.title} bearbeiten`} title="Bearbeiten" onClick={()=>setEditing(goal)}>✎</button>}</span></div>
    <div className={styles.goalValue}><b>{goal.startValue!=null&&goal.value!=null?<>{goal.startValue} <span aria-hidden="true">→</span> {goal.value}</>:goal.value??'–'} <span className={styles.goalTarget}>Ziel {goal.direction==='max'?'≤':'≥'} {goal.target}</span></b>
     {goal.metric==='manual'?<span className={styles.goalSource}>{data.canWrite&&<><button type="button" className={styles.icon} disabled={busy||(goal.value??0)<=0} aria-label={`${goal.title}: Wert verringern`} onClick={()=>void act({action:'manual',id:goal.id,value:Math.max(0,(goal.value??0)-1)},'Wert gespeichert.')}>−</button><button type="button" className={styles.icon} disabled={busy} aria-label={`${goal.title}: Wert erhöhen`} onClick={()=>void act({action:'manual',id:goal.id,value:(goal.value??0)+1},'Wert gespeichert.')}>+</button></>}manuell gepflegt</span>
     :<span className={styles.goalSource}>{goal.error?goal.error:`automatisch · Stand ${stand}`}</span>}</div>
    <div className={styles.progress} style={{height:8}}><i style={{width:`${goal.progress??0}%`,background:color}}/></div>
    <div className={styles.goalFoot}><div className={styles.spark} aria-label={`Verlauf der letzten Tage: ${week.map(point=>point.value).join(', ')||'noch keine Werte'}`}>{Array.from({length:7},(_,slot)=>{const point=week[week.length-7+slot];return <i key={slot} title={point?`${date(point.day)}: ${point.value}`:undefined} style={{height:point?`${Math.max(10,point.value/max*100)}%`:'3px',background:point?color:undefined}}/>;})}</div>
     <small>{[goal.ownerName&&'Verantwortlich: '+goal.ownerName,goal.linked?`${goal.linked} ${goal.linked===1?'Aufgabe':'Aufgaben'}`:'',`bis ${date(goal.periodTo)}`,goal.partial?'erste 300 Angebote':''].filter(Boolean).join(' · ')}</small></div>
   </article>;})}</div>
  {review.data&&<><p className={styles.section}>Wochenrückblick KW {weekNumber(review.data.today)} <span>Montag bis heute</span></p><ReviewKpis data={review.data}/></>}
  {editing&&data&&<GoalDialog goal={editing==='new'?null:editing} today={data.today} statuses={data.offerStatuses} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);setNotice('Ziel gespeichert.');void load();onChanged();}}/>}
 </>;
}
function GoalDialog({goal,today,statuses,onClose,onSaved}:{goal:Goal|null;today:string;statuses:{id:string;name:string}[];onClose:()=>void;onSaved:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),quarterEnd=(()=>{const [y,m]=today.split('-').map(Number),end=Math.ceil(m/3)*3;return new Date(Date.UTC(y,end,0)).toISOString().slice(0,10);})();
 const [title,setTitle]=useState(goal?.title??''),[metric,setMetric]=useState<Goal['metric']>(goal?.metric??'unplanned_orders'),[direction,setDirection]=useState<Goal['direction']>(goal?.direction??'max'),[target,setTarget]=useState(String(goal?.target??5)),[start,setStart]=useState(goal?.startValue==null?'':String(goal.startValue));
 const [chosen,setChosen]=useState<string[]>(goal?.offerStatuses??statuses.filter(item=>/offen/i.test(item.name)).map(item=>item.id)),[age,setAge]=useState(goal?.offerMinAgeDays==null?'':String(goal.offerMinAgeDays)),[owner,setOwner]=useState(goal?.ownerName??''),[from,setFrom]=useState(goal?.periodFrom??today),[to,setTo]=useState(goal?.periodTo??quarterEnd),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{dialog.current?.showModal();},[]);
 async function submit(event:React.FormEvent){event.preventDefault();setBusy(true);setError('');try{await change({action:'save',...(goal?{id:goal.id,version:goal.version}:{}),title,metric,direction,target:Number(target),startValue:start===''?null:Number(start),offerStatuses:chosen,offerMinAgeDays:age===''?null:Number(age),ownerName:owner,periodFrom:from,periodTo:to});dialog.current?.close();onSaved();}catch(problem){setError(message(problem,'Ziel nicht gespeichert.'));}finally{setBusy(false);}}
 return <dialog ref={dialog} className={styles.dialog} aria-labelledby="goal-title" onClose={onClose} onCancel={onClose}>
  <div className={styles.dialogHead}><h2 id="goal-title">{goal?'Ziel bearbeiten':'Neues Ziel'}</h2><button type="button" className="heyelli-close" aria-label="Schließen" onClick={()=>dialog.current?.close()}/></div>
  <form className={styles.form} onSubmit={submit}>
   <label>Titel<input value={title} maxLength={160} required autoFocus placeholder="z. B. Aufträge ohne Termin unter 5" onChange={event=>setTitle(event.target.value)}/></label>
   <label>Kennzahl<PopUpButton label="Kennzahl" value={metric} options={(Object.keys(metricLabels) as Goal['metric'][]).map(value=>({value,label:metricLabels[value]}))} onChange={value=>{setMetric(value as Goal['metric']);if(value==='manual')setDirection('min');}}/></label>
   {metric==='open_offers'&&<fieldset><legend>Als offen zählen (Angebotsstatus aus PDS)</legend><div className={styles.choices}>{statuses.map(item=><label key={item.id}><input type="checkbox" checked={chosen.includes(item.id)} onChange={()=>setChosen(current=>current.includes(item.id)?current.filter(value=>value!==item.id):[...current,item.id])}/>{item.name}</label>)}{!statuses.length&&<span className={styles.hint}>Status nicht abrufbar.</span>}</div></fieldset>}
   {metric==='open_offers'&&<label>Nur Angebote älter als (Tage, optional)<input type="number" min={1} max={365} value={age} onChange={event=>setAge(event.target.value)}/></label>}
   <div className={styles.two}><label>Richtung<PopUpButton label="Richtung" value={direction} options={[{value:'max',label:'höchstens (abbauen)'},{value:'min',label:'mindestens (aufbauen)'}]} onChange={value=>setDirection(value as Goal['direction'])}/></label><label>Zielwert<input type="number" min={0} required value={target} onChange={event=>setTarget(event.target.value)}/></label></div>
   <div className={styles.two}><label>Ausgangswert (optional)<input type="number" min={0} value={start} onChange={event=>setStart(event.target.value)}/></label><label>Verantwortlich (optional)<input value={owner} maxLength={120} onChange={event=>setOwner(event.target.value)}/></label></div>
   <div className={styles.two}><label>Beginn<input type="date" required value={from} onChange={event=>setFrom(event.target.value)}/></label><label>Ende<input type="date" required value={to} onChange={event=>setTo(event.target.value)}/></label></div>
   {error&&<Notice tone="error" role="alert">{error}</Notice>}
   <div className={styles.actions} style={{justifyContent:'flex-end'}}>{goal&&<button type="button" className={styles.pill} style={{marginRight:'auto'}} disabled={busy} onClick={()=>void(async()=>{setBusy(true);try{await change({action:'archive',id:goal.id});dialog.current?.close();onSaved();}catch(problem){setError(message(problem,'Archivieren nicht möglich.'));}finally{setBusy(false);}})()}>Archivieren</button>}<button type="button" className={styles.pill} onClick={()=>dialog.current?.close()}>Abbrechen</button><button type="submit" className={styles.pill} data-primary="" disabled={busy||!title.trim()}>{busy?'Wird gespeichert …':'Speichern'}</button></div>
  </form>
 </dialog>;
}
