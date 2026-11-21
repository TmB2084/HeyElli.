'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {CalendarPeriodPicker} from './period-picker';
import {parseCalendarDate,formatCalendarDate} from './date-input';
import {berlinWall,calendarWeekLabel} from './domain';
import styles from './date-time-field.module.css';
export function CalendarDateTimeField({name,label,defaultValue='',defaultNow=false,required=false,onValueChange,draftValue,onDraftChange}:{name:string;label:string;defaultValue?:string;defaultNow?:boolean;required?:boolean;onValueChange?:()=>void;draftValue?:{date:string;time:string};onDraftChange?:(value:{date:string;time:string})=>void}){
 const id=useId(),input=useRef<HTMLInputElement>(null);
 const [date,setDate]=useState(draftValue?.date??formatCalendarDate(defaultValue.slice(0,10))),[time,setTime]=useState(draftValue?.time??(defaultValue.slice(11,16)||'08:00')),[today,setToday]=useState('');
 useEffect(()=>{const frame=requestAnimationFrame(()=>{const now=berlinWall(new Date().toISOString());setToday(now.slice(0,10));if(defaultNow&&!defaultValue&&!draftValue){setDate(formatCalendarDate(now.slice(0,10)));setTime(now.slice(11,16));onDraftChange?.({date:formatCalendarDate(now.slice(0,10)),time:now.slice(11,16)});}});return()=>cancelAnimationFrame(frame);},[defaultNow,defaultValue,draftValue,onDraftChange]);
 const day=parseCalendarDate(date),anchor=day||today;
 function choose(value:string){setDate(formatCalendarDate(value));onDraftChange?.({date:formatCalendarDate(value),time});input.current?.setCustomValidity('');onValueChange?.();}
 return <div className={styles.field}>
  <label htmlFor={id}>{label}{required?' *':''}</label>
  <div className={styles.controls}>
   <input ref={input} id={id} aria-label={`${label} – Datum`} type="text" placeholder="TT.MM.JJJJ" inputMode="decimal" required={required} value={date} onChange={event=>{const value=event.target.value;setDate(value);onDraftChange?.({date:value,time});event.target.setCustomValidity(!value||parseCalendarDate(value)?'':'Bitte ein gültiges Datum als TT.MM.JJJJ eingeben.');onValueChange?.();}}/>
   <CalendarPeriodPicker anchor={anchor} weekLabel={anchor?calendarWeekLabel(anchor,anchor):''} rangeLabel={date} view="day" from={day} to={day} disabled={!anchor} compact pickerLabel={`${label}: Kalender öffnen`} onChange={choose} onPrevious={()=>{}} onNext={()=>{}} onToday={()=>choose(today)}/>
   <input aria-label={`${label} – Uhrzeit`} type="time" required={required} value={time} onInput={event=>{setTime(event.currentTarget.value);onDraftChange?.({date,time:event.currentTarget.value});onValueChange?.();}} onChange={event=>{setTime(event.target.value);onDraftChange?.({date,time:event.target.value});onValueChange?.();}}/>
  </div>
  <input type="hidden" name={name} value={day&&time?`${day}T${time}`:''}/>
 </div>;
}
