'use client';
import {Button,Dialog} from '@/platform/ui';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {PlanningFields,type PlanningPerson} from '@/apps/casedesk/erfassung';
import {ConfirmationDialog,Notice,useDraftNavigationGuard} from '@/platform/shell';
import {berlinWall} from '@/apps/planboard/kalender/domain';
import type {ServiceIncident} from './model';
import styles from './planning-dialog.module.css';
export function ExistingPlanningDialog({orderId,incident,onClose,onSaved}:{orderId:string;incident:ServiceIncident;onClose:()=>void;onSaved:(warning:string)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[dirty,setDirty]=useState(false),[discardOpen,setDiscardOpen]=useState(false);
 const [technician,setTechnician]=useState<PlanningPerson|null>(incident.technicianId?{id:incident.technicianId,label:incident.technician}:null),[companions,setCompanions]=useState<PlanningPerson[]>((incident.companionIds??[]).map((id,index)=>({id,label:incident.companions[index]||'Techniker'})));
 useEffect(()=>{dialog.current?.showModal();},[]);useDraftNavigationGuard(dirty||busy,busy,()=>setDirty(false));
 async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;if(!technician){setError('Bitte einen Haupttechniker auswählen.');return;}const values=new FormData(event.currentTarget);setBusy(true);setError('');try{const response=await fetch('/api/service/planung',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(25000),body:JSON.stringify({orderId,incidentId:incident.id,expected:incident.planningVersion,appointment:values.get('appointment'),duration:Number(values.get('appointmentDuration')),technicianId:technician.id,companionIds:companions.map(item=>item.id)})}),result=await response.json();if(!response.ok)throw Error(result.error);setDirty(false);onSaved(result.warning||'');}catch(problem){setError(problem instanceof Error&&!['TypeError','AbortError','TimeoutError'].includes(problem.name)?problem.message:'Verbindung unterbrochen. Eingaben bleiben erhalten. Erneut speichern ist möglich.');}finally{setBusy(false);}}
 function close(){if(busy)return;if(dirty)setDiscardOpen(true);else onClose();}
 return <><Dialog ref={dialog} className={styles.dialog} aria-labelledby="existing-planning-title" onCancel={event=>{event.preventDefault();close();}}>
  <form onSubmit={save} onChange={()=>setDirty(true)} aria-busy={busy}>
   <header className={styles.heading}>
    <h2 id="existing-planning-title">Termin vergeben</h2>
    <Button variant="close" aria-label="Dialog schließen" disabled={busy} onClick={close}></Button>
   </header>
   <div className={styles.body}>
    {incident.work&&<p className={styles.context} title={incident.work}>{incident.work.length>160?incident.work.slice(0,157)+'…':incident.work}</p>}
    <fieldset disabled={busy} aria-label="Techniker und Termin">
     <PlanningFields existingIncidentId={incident.id} onPlanningChange={()=>setDirty(true)} technician={technician} companions={companions} onTechnician={value=>{setTechnician(value);setDirty(true);}} onCompanions={value=>{setCompanions(value);setDirty(true);}} start={incident.start?berlinWall(incident.start).slice(0,16):''} duration={incident.end&&incident.start?Math.max(15,Math.round((Date.parse(incident.end)-Date.parse(incident.start))/60000)):60}/>
    </fieldset>
    {error&&<Notice tone="error" role="alert">{error}</Notice>}
   </div>
   <footer className={styles.footer}>
    <Button variant="outline" disabled={busy} onClick={close}>Abbrechen</Button>
    <Button type="submit" disabled={busy}>{busy?'Wird gespeichert …':'Termin vergeben'}</Button>
   </footer>
  </form>
 </Dialog><ConfirmationDialog open={discardOpen} title="Planung verwerfen?" description="Die ungespeicherten Angaben zu Techniker und Termin werden verworfen. Der bestehende Auftrag bleibt erhalten." confirmLabel="Planung verwerfen" busy={busy} onCancel={()=>setDiscardOpen(false)} onConfirm={()=>{setDiscardOpen(false);onClose();}}/></>;
}
