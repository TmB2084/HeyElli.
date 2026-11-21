"use client";
import {AlertDialog} from "@/platform/shell";
import {Notice} from "@/platform/shell";
import {useEffect,useRef} from "react";
import type {ContinuationPlan} from "./domain";
export function ContinuationDialog({plan,title,onCancel,onSingle,onSplit}:{plan:ContinuationPlan;title:string;onCancel:()=>void;onSingle:()=>void;onSplit:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{dialog.current?.showModal();dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();},[]);
 const date=(instant:string)=>new Intl.DateTimeFormat("de-DE",{timeZone:"Europe/Berlin",dateStyle:"short",timeStyle:"short"}).format(new Date(instant));
 return <AlertDialog dialogRef={dialog} title="Termin auf Arbeitstage verteilen?" tone="info" onCancel={event=>{event.preventDefault();onCancel();}} actions={<><button type="button"  onClick={onCancel}>Weiter bearbeiten</button><button type="button"  onClick={onSingle}>Zusammenhängend speichern</button><button type="button" disabled={!!plan.reason} data-primary="true" onClick={onSplit}>Auf Arbeitstage verteilen</button></>}>
<p><strong>{title}</strong></p>{plan.resourceNames&&<p>Ressourcen: {plan.resourceNames.join(", ")}</p>}<p>Die Restdauer wird auf die nächsten gemeinsamen Arbeitszeitfenster verteilt. Pausen, Feiertage und bestätigte Abwesenheiten werden berücksichtigt.</p>
  <ol className="calendar-continuation-list">{plan.segments.map((segment,index)=><li key={index}>{date(segment.start)} – {date(segment.end)} · {segment.minutes} Min.</li>)}</ol>
  <p>Es entstehen nur Kalendereinträge. Vorhandene Aufträge und Auftragsebenen werden weiterverwendet.</p>
  {plan.serviceCopy&&<p>Service-Fortsetzungen werden als freie PDS-Termine mit einer HeyElli-Referenz zur bestehenden Serviceauftragsebene angelegt. Eine native PDS-Verknüpfung zusätzlicher Störungstermine ist noch nicht dokumentiert.</p>}
  {plan.reason&&<Notice tone="error" role="alert">{plan.reason}</Notice>}
 </AlertDialog>;
}
