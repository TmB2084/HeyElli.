'use client';
import {useEffect,useRef,useState} from 'react';
import {Notice} from '@/platform/shell';
import type {MaintenanceRow} from './maintenance-model';
import type {ServiceIncident} from './model';
import {loadMaintenancePlanning,type MaintenanceCreation} from './maintenance-planning';
import {ExistingPlanningDialog} from './planning-dialog';
import styles from './planning-dialog.module.css';
function Pending({error,onRetry,onClose}:{error:string;onRetry:()=>void;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close();},[]);
 return <dialog ref={dialog} className={styles.dialog} aria-label="Terminvergabe vorbereiten" onCancel={event=>{event.preventDefault();onClose();}}><form onSubmit={event=>event.preventDefault()}><header className={styles.heading}><h2>Terminvergabe vorbereiten</h2><button type="button" className={`${styles.close} heyelli-close`} aria-label="Dialog schließen" onClick={onClose}>×</button></header><div className={styles.body}><p>Der Auftrag wurde angelegt. Sein aktueller Planungsstand wird gelesen.</p>{error?<Notice tone="error">{error} Der Auftrag wird nicht erneut angelegt.</Notice>:<p role="status">Terminvergabe wird geladen …</p>}</div><footer className={styles.footer}><button type="button" onClick={onClose}>Später planen</button>{error&&<button type="button" onClick={onRetry}>Erneut lesen</button>}</footer></form></dialog>;
}
export function MaintenancePlanningDialog({created,row,sourceRevision,onClose,onSaved}:{sourceRevision:string;created:MaintenanceCreation;row:MaintenanceRow;onClose:()=>void;onSaved:(warning:string)=>void}){
 const [target]=useState(()=>({created,row,sourceRevision}));
 const [incident,setIncident]=useState<ServiceIncident|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{const controller=new AbortController();void loadMaintenancePlanning(target.created,target.row,target.sourceRevision,fetch,AbortSignal.any([controller.signal,AbortSignal.timeout(25000)])).then(value=>{if(!controller.signal.aborted){setIncident(value);setError('');}},()=>{if(!controller.signal.aborted)setError('Die Terminvergabe ist derzeit nicht erreichbar. Bitte den bestehenden Auftrag erneut lesen.');});return()=>controller.abort();},[target,retry]);
 return incident?<ExistingPlanningDialog orderId={created.orderId} incident={incident} onClose={onClose} onSaved={onSaved}/>:<Pending error={error} onRetry={()=>setRetry(value=>value+1)} onClose={onClose}/>;
}
