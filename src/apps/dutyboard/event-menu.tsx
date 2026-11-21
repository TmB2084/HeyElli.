'use client';
import {useEffect,useRef,useState} from 'react';
import {berlinWall,wallInstant,type CalendarEvent,type Resource} from '@/apps/planboard/kalender/domain';
import {dutyFingerprint} from '@/apps/planboard/kalender/planning';
import {Notice} from '@/platform/shell';
import {AssignmentDialog} from './assignment-dialog';
import styles from './duty-workspace.module.css';
export function DutyEventMenu({events,resources,x,y,opener,write,onClose,onSaved}:{events:CalendarEvent[];resources:Resource[];x:number;y:number;opener:HTMLElement|null;write:boolean;onClose:()=>void;onSaved:()=>void}){
 const menu=useRef<HTMLDivElement>(null),[eventId,setEventId]=useState(events[0].id),[mode,setMode]=useState<'menu'|'split'|'delete'>('menu');
 const event=events.find(item=>item.id===eventId)!;
 const [splitAt,setSplitAt]=useState(()=>berlinWall(new Date((Date.parse(event.start)+Date.parse(event.end))/2).toISOString())),[person,setPerson]=useState('');
 const [openedAt]=useState(()=>Date.now());
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[attempted,setAttempted]=useState(false),[operationId]=useState(()=>crypto.randomUUID());
 useEffect(()=>{const element=menu.current;if(!element)return;element.showPopover();const rect=element.getBoundingClientRect();element.style.left=`${Math.max(8,Math.min(x,window.innerWidth-rect.width-8))}px`;element.style.top=`${Math.max(8,Math.min(y,window.innerHeight-rect.height-8))}px`;element.querySelector('button')?.focus();},[x,y]);
 function choose(next:'split'|'delete'){menu.current?.hidePopover();setMode(next);setSplitAt(berlinWall(new Date((Date.parse(event.start)+Date.parse(event.end))/2).toISOString()));}
 async function save(){setBusy(true);setError('');setAttempted(true);try{
  const response=await fetch('/api/bereitschaft/termine',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:mode,id:event.id,expected:dutyFingerprint(event),operationId,...(mode==='split'?{splitAt,resourceId:person}:{})})});const result=await response.json();if(!response.ok){setAttempted(result.retryOnly===true);throw new Error(result.error);}onSaved();
 }catch(problem){setError((problem instanceof Error?problem.message:'Aktion fehlgeschlagen.')+' Bei einem Verbindungsabbruch denselben Vorgang erneut versuchen.');}finally{setBusy(false);}}
 const names=new Map(resources.map(item=>[item.id,item.name]));
 if(mode==='menu')return <div ref={menu} popover="auto" className={`${styles.eventMenu} heyelli-menu-surface heyelli-command-menu`} aria-label="Bereitschaftsaktionen">
  {events.length>1?<label>Bereitschaft<select value={eventId} onChange={e=>setEventId(e.target.value)}>{events.map(item=><option key={item.id} value={item.id}>{item.title} · {berlinWall(item.start).replace('T',' ')}</option>)}</select></label>:<strong>{event.resourceIds.map(id=>names.get(id)??id).join(', ')}</strong>}
  <hr className="heyelli-menu-separator"/>
  <button type="button" disabled={!write||event.fixed} onClick={()=>choose('split')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8 8 13 13M8 16 21 3"/></svg>Splitten</button>
  <a href={`/planboard?datum=${berlinWall(event.start).slice(0,10)}&mitarbeiter=${encodeURIComponent(event.resourceIds[0])}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 11h18M8 11v10M15 11v10"/></svg>Zum PlanBoard</a>
  <hr className="heyelli-menu-separator"/>
  <button type="button" disabled={!write||event.fixed} onClick={()=>choose('delete')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg>Löschen</button>
 </div>;
 let valid=false;try{const time=Date.parse(wallInstant(splitAt));valid=!!person&&time>Date.parse(event.start)&&time<Date.parse(event.end)&&time>openedAt;}catch{/* Invalid input remains editable. */}
 return <AssignmentDialog heading={mode==='split'?'Bereitschaft splitten':'Bereitschaft löschen'} opener={opener} busy={busy} error="" onClose={onClose}>
  <div className="duty-plan-panel duty-event-form">
   <strong>{event.resourceIds.map(id=>names.get(id)??id).join(', ')}</strong>
   <p>{berlinWall(event.start).replace('T',' ')} – {berlinWall(event.end).replace('T',' ')}</p>
   {error&&<Notice tone="error" role="alert">{error}</Notice>}
   {mode==='split'?<fieldset disabled={busy||attempted}><label>Übergabe am<input type="datetime-local" value={splitAt} onChange={e=>setSplitAt(e.target.value)}/></label><label>Zweiter Teil an<select value={person} onChange={e=>setPerson(e.target.value)}><option value="">Mitarbeiter auswählen</option>{resources.filter(item=>!event.resourceIds.includes(item.id)).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></fieldset>:<p>Diese Bereitschaft wirklich löschen?</p>}
   <button type="button" className="duty-plan-confirm" disabled={busy||mode==='split'&&!valid} onClick={()=>void save()}>{busy?'Wird gespeichert …':mode==='split'?'Teilung speichern':'Ja, löschen'}</button> <button type="button" disabled={busy} onClick={onClose}>Abbrechen</button>
  </div>
 </AssignmentDialog>;
}
