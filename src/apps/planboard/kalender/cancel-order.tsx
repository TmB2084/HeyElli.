'use client';
import {Notice} from "@/platform/shell";
import {useState} from 'react';
import type {CalendarEvent} from './domain';
export function CancelOrder({event,disabled,onSaved,menu=false,initialConfirm=false,onCancel}:{event:CalendarEvent;disabled:boolean;onSaved:()=>void;menu?:boolean;initialConfirm?:boolean;onCancel?:()=>void}){
 const [confirm,setConfirm]=useState(initialConfirm),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(event.link?.type!=='SERVICEAUFTRAG'||!event.orderStatus||event.continuation?.serviceCopy||/storniert/i.test(event.orderStatus.name))return null;
 const manual=event.orderStatus.name.trim().toLocaleLowerCase('de')==='mobil abgeholt',target=manual?'Manuell storniert':'Storniert';
 async function save(){if(busy||error)return;setBusy(true);try{const response=await fetch('/api/ressourcenkalender/stornieren',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:event.id,status:event.orderStatus!.id})});const result=await response.json();if(!response.ok)throw new Error(result.error);onSaved();}catch(problem){setError(problem instanceof Error?problem.message:'Status unklar. Bitte neu laden.');}finally{setBusy(false);}}
 return <div className={menu?'calendar-cancel-menu':'calendar-cancel-order'}>{!confirm?<button type="button" disabled={disabled} onClick={()=>setConfirm(true)}><span aria-hidden="true">⊘ </span>{manual?'Manuell stornieren …':'Auftrag stornieren …'}</button>:<><p>Auftragsstatus von „{event.orderStatus.name}“ auf „{target}“ setzen? Dies betrifft den gesamten Serviceauftrag; der Termin bleibt erhalten.</p>{error?<Notice tone="error" role="alert">{error}</Notice>:<><button type="button" disabled={disabled||busy} onClick={()=>void save()}>{busy?'Wird gespeichert …':'Status bestätigen'}</button> <button type="button" disabled={busy} onClick={()=>{setConfirm(false);onCancel?.();}}>Abbrechen</button></>}</>}</div>;
}
