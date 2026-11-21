"use client";
import {AlertDialog} from "@/platform/shell";
import {useEffect,useRef} from "react";
import type {CalendarEvent,PlanningWarning} from "./domain";
export function PlanningWarningDialog({warnings,appointment,split=false,onCancel,onConfirm}:{split?:boolean;warnings:PlanningWarning[];appointment:Pick<CalendarEvent,"title"|"start"|"end">;onCancel:()=>void;onConfirm:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();return ()=>{if(previous?.isConnected)previous.focus();};},[]);
 const format=(value:string)=>new Intl.DateTimeFormat("de-DE",{timeZone:"Europe/Berlin",dateStyle:"short",timeStyle:"short"}).format(new Date(value));
 return <AlertDialog dialogRef={dialog} title="Planungshinweise" tone="warning" onCancel={event=>{event.preventDefault();onCancel();}} actions={<><button type="button"  onClick={onCancel}>Weiter bearbeiten</button><button type="button" data-primary="true" onClick={onConfirm}>Trotzdem speichern</button></>}>
<p><strong>{appointment.title}</strong>{!split&&<><br/>{format(appointment.start)} – {format(appointment.end)}</>}</p><p>{split?"Die Hinweise gelten für die zuvor bestätigte Aufteilung. Die Fortsetzungstermine können trotzdem gespeichert werden.":"Der Termin kann trotzdem gespeichert werden."}</p>
  <ul>{warnings.map((warning,index)=><li key={`${warning.resourceId}-${warning.kind}-${index}`}>{warning.message}</li>)}</ul>
 </AlertDialog>;
}
