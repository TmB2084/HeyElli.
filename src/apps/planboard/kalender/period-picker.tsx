'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {parseCalendarDate} from './date-input';
import {addDays,calendarWeekLabel} from './domain';

const label=(day:string,options:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('de-DE',{timeZone:'UTC',...options}).format(new Date(`${day}T12:00:00Z`));
const monthStep=(month:string,step:number)=>{const date=new Date(`${month}-01T12:00:00Z`);date.setUTCMonth(date.getUTCMonth()+step);return date.toISOString().slice(0,7);};

export function CalendarPeriodPicker({anchor,weekLabel,rangeLabel,view,from,to,disabled,onChange,onPrevious,onNext,onToday,compact=false,pickerLabel}:{compact?:boolean;pickerLabel?:string;anchor:string;weekLabel:string;rangeLabel:string;view:'day'|'week'|'month';from:string;to:string;disabled:boolean;onChange:(day:string)=>void;onPrevious:()=>void;onNext:()=>void;onToday:()=>void}){
 const id=useId(),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),dateInput=useRef<HTMLInputElement>(null);
 const [open,setOpen]=useState(false),[month,setMonth]=useState(''),[date,setDate]=useState(''),[maxHeight,setMaxHeight]=useState(480);
 const [position,setPosition]=useState<{left:number;top:number}|null>(null);
 const unit=view==='day'?'Tag':view==='week'?'Woche':'Monat';
 useEffect(()=>{
  if(!open)return;
  root.current?.querySelector<HTMLButtonElement>('[role="dialog"] button[aria-pressed="true"]')?.focus();
  const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);trigger.current?.focus();}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[open]);
 function select(day:string){onChange(day);setOpen(false);trigger.current?.focus();}
 const first=month?`${month}-01`:anchor;
 const start=first?addDays(first,-((new Date(`${first}T12:00:00Z`).getUTCDay()+6)%7)):'';
 return <div ref={root} className="calendar-date-navigation" data-compact={compact||undefined} role="group" aria-label="Datum und Kalenderzeitraum">
  {!compact&&<button type="button" aria-label={`${view==='week'?'Vorherige':'Vorheriger'} ${unit}`} disabled={disabled||!anchor} onClick={onPrevious}>‹</button>}
  <button ref={trigger} type="button" className="calendar-period-trigger" aria-label={pickerLabel??`${weekLabel} · ${rangeLabel}, ${unit} auswählen`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open?id:undefined} disabled={disabled||!anchor} onClick={()=>{if(compact){const rect=trigger.current!.getBoundingClientRect(),below=window.innerHeight-rect.bottom-12,height=Math.min(400,window.innerHeight-24);setPosition({left:Math.max(12,Math.min(rect.left,window.innerWidth-332)),top:below>=height?rect.bottom+6:Math.max(12,rect.top-height-6)});setMaxHeight(height);}
    setMonth(anchor.slice(0,7));setDate(anchor.split('-').reverse().join('.'));if(!compact)setMaxHeight(Math.max(220,window.innerHeight-(root.current?.getBoundingClientRect().bottom??0)-24));setOpen(value=>!value);}}>
   <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/></svg>
   {!compact&&<><span className="calendar-period-caption"><strong>{weekLabel}</strong><span aria-hidden="true">·</span><span>{view==='month'&&anchor?label(anchor,{month:'long',year:'numeric'}):rangeLabel}</span></span><span aria-hidden="true">⌄</span></>}
  </button>
  {!compact&&<><button type="button" aria-label={`${view==='week'?'Nächste':'Nächster'} ${unit}`} disabled={disabled||!anchor} onClick={onNext}>›</button>
  <button type="button" className="calendar-period-today" disabled={disabled} onClick={()=>{onToday();setOpen(false);}}>Heute</button></>}
  {open&&!disabled&&start&&<div id={id} className="calendar-period-popover" style={{maxHeight,...(compact&&position?{position:'fixed',...position}:{})}} role="dialog" aria-label={`${unit} auswählen`}>
   <div className="calendar-picker-direct" role="group" aria-label="Datum direkt eingeben"><label>Direkt zu Datum<input ref={dateInput} type="text" inputMode="decimal" placeholder="TT.MM.JJJJ" value={date} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();const day=parseCalendarDate(date);if(day)select(day);else{event.currentTarget.setCustomValidity('Bitte ein gültiges Datum als TT.MM.JJJJ eingeben.');event.currentTarget.reportValidity();}}}} onChange={event=>{event.target.setCustomValidity('');setDate(event.target.value);}}/></label><button type="button" onClick={()=>{const day=parseCalendarDate(date);if(day)select(day);else{dateInput.current?.setCustomValidity('Bitte ein gültiges Datum als TT.MM.JJJJ eingeben.');dateInput.current?.reportValidity();}}}>Anzeigen</button></div>
   <div className="calendar-picker-month"><button type="button" aria-label="Vorheriger Monat in der Datumsauswahl" onClick={()=>setMonth(value=>monthStep(value,-1))}>‹</button><strong aria-live="polite">{label(first,{month:'long',year:'numeric'})}</strong><button type="button" aria-label="Nächster Monat in der Datumsauswahl" onClick={()=>setMonth(value=>monthStep(value,1))}>›</button></div>
   <p>{view==='week'?'Woche per Tag oder KW auswählen.':view==='month'?'Monat per Tag auswählen.':'Tag auswählen.'}</p>
   <table className="calendar-picker-grid"><thead><tr><th scope="col">KW</th>{['Mo','Di','Mi','Do','Fr','Sa','So'].map(day=><th key={day} scope="col">{day}</th>)}</tr></thead><tbody>{Array.from({length:6},(_,week)=>{const monday=addDays(start,week*7);return <tr key={monday}><td>{view==='week'?<button type="button" className="calendar-picker-week" aria-label={`${calendarWeekLabel(monday,monday)} ab ${label(monday,{day:'numeric',month:'long',year:'numeric'})} auswählen`} onClick={()=>select(monday)}>{calendarWeekLabel(monday,monday).replace('KW ','')}</button>:<span className="calendar-picker-week">{calendarWeekLabel(monday,monday).replace('KW ','')}</span>}</td>{Array.from({length:7},(_,day)=>{const value=addDays(monday,day);return <td key={value}><button type="button" className={`${value>=from&&value<=to?'in-period ':''}${value===anchor?'selected ':''}${value.slice(0,7)!==month?'outside-month':''}`} aria-label={label(value,{weekday:'long',day:'numeric',month:'long',year:'numeric'})} aria-pressed={value===anchor} onClick={()=>select(value)}>{Number(value.slice(8))}</button></td>;})}</tr>;})}</tbody></table>

  </div>}
 </div>;
}
