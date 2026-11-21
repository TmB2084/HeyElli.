 'use client';
import {useEffect,useState} from 'react';
import {Notice} from '@/platform/shell';
import type {AvailabilityResult} from '@/apps/planboard/verfuegbarkeit';
import type {SearchItem} from './search-picker';
import styles from './planning-availability.module.css';
const dateLabel=(value:string)=>`${value.slice(0,10).split('-').reverse().join('.')} · ${value.slice(11,16)}`;
export function PlanningAvailability({start,duration,technician,companions,onTechnician,onStart,existingIncidentId}:{existingIncidentId?:string;start:string;duration:number;technician:SearchItem|null;companions:SearchItem[];onTechnician:(person:SearchItem)=>void;onStart:(start:string)=>void}){
 const valid=!!technician&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start)&&Number.isInteger(duration)&&duration>=15&&duration<=1440&&duration%15===0;
 const query=valid?new URLSearchParams({start,duration:String(duration),main:technician.id,team:JSON.stringify(companions.map(item=>item.id)),...(existingIncidentId?{existingIncidentId}:{})}).toString():'';
 const [state,setState]=useState<{query:string;data?:AvailabilityResult;error?:string}>({query:''}),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!query)return;const controller=new AbortController();
  const timer=setTimeout(async()=>{try{const response=await fetch('/api/planung/verfuegbarkeit?'+query,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(25000)])});const result=await response.json();if(controller.signal.aborted)return;if(!response.ok)throw Error(response.status===401?'Deine Sitzung ist abgelaufen. Bitte erneut anmelden.':response.status===403?'Für diese Prüfung fehlt die Berechtigung.':result.error||'Verfügbarkeit konnte nicht geprüft werden.');setState({query,data:result});}catch(problem){if(!controller.signal.aborted)setState({query,error:problem instanceof Error&&!['TypeError','AbortError','TimeoutError'].includes(problem.name)?problem.message:'Verbindung unterbrochen. Verfügbarkeit unbekannt; deine Eingaben bleiben erhalten.'});}},500);
  return()=>{clearTimeout(timer);controller.abort();};
 },[query,retry]);
 if(!query)return null;
 const current=state.query===query?state:undefined,data=current?.data;
 return <section className={styles.panel} aria-label="Verfügbarkeit"><header><strong>Verfügbarkeit</strong><button type="button" onClick={()=>{setState({query:''});setRetry(value=>value+1);}}>Erneut prüfen</button></header>
 <div role="status" aria-live="polite">{!current?'Verfügbarkeit wird geprüft …':current.error?<Notice tone="error">{current.error}</Notice>:data?.people.map(person=><div key={person.id} className={styles.person}><span>{person.name}</span><span data-state={person.status}>{person.status==='free'?'Frei':person.status==='blocked'?'Nicht durchgehend frei':'Nicht vollständig prüfbar'}</span></div>)}</div>
 {data&&<>{data.people[0]?.status!=='free'&&!data.alternatives.length&&<p className={styles.note}>{data.people.slice(1).some(person=>person.status!=='free')?'Auch die gewählten Begleiter sind nicht durchgehend verfügbar.':'Keine vollständig geprüfte freie Alternative für diesen Zeitraum gefunden.'}</p>}<div className={styles.choices}>{data.people[0]?.status!=='free'&&data.alternatives.length>0&&<><small>Andere freie Haupttechniker · gleicher Zeitraum{companions.length?' mit gewählten Begleitern':''}</small>{data.alternatives.map(person=><button type="button" key={person.id} title={person.group} onClick={()=>onTechnician({id:person.id,label:person.name})}>{person.name}{person.group&&<small>{person.group}</small>}</button>)}</>}</div>
 {data.people.some(person=>person.status!=='free')&&<div className={styles.choices}><small>Nächste zusammenhängende Zeitfenster{companions.length?' für das ganze Team':' für den Haupttechniker'} · {duration} Minuten</small>{data.slots.length?data.slots.map(slot=><button type="button" key={slot.start} onClick={()=>onStart(slot.start)}>{dateLabel(slot.start)}–{slot.end.slice(0,10)===slot.start.slice(0,10)?slot.end.slice(11,16):dateLabel(slot.end)}</button>):<span>Kein geprüftes Zeitfenster in den nächsten 14 Tagen gefunden.</span>}</div>}
 <small className={styles.note}>Arbeitszeiten, Pausen und belegende Termine berücksichtigt. Momentaufnahme, keine Reservierung. Fachliche Eignung und Anfahrt bitte prüfen.</small></>}
 </section>;
}
