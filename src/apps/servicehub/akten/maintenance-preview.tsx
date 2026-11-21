'use client';
import {useEffect,useRef,useState} from 'react';
import {MaintenancePlanningDialog} from './maintenance-planning-dialog';
import type {MaintenanceCreation} from './maintenance-planning';
import {Notice} from '@/platform/shell';
import type {MaintenanceRow} from './maintenance-model';
import type {ServiceOverview} from './model';
import {maintenanceContext} from './maintenance-model';
import styles from './planning-dialog.module.css';
import maintenanceStyles from './maintenance.module.css';
type Props={row:MaintenanceRow;data:ServiceOverview;returnFocus:HTMLElement;onClose:()=>void;onSaved?:(orderId:string,warning:string)=>void};
/** Adapter intentionally absent in the released UI until the native PDS workflow is approved. */
export function MaintenancePreview(props:Props&{createOrder?:(row:MaintenanceRow)=>Promise<MaintenanceCreation>}){
 const started=useRef(false);
 const [created,setCreated]=useState<MaintenanceCreation|null>(null),[attempted,setAttempted]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function create(){if(!props.createOrder||started.current)return;started.current=true;setAttempted(true);setBusy(true);try{const result=await props.createOrder(props.row);if(!result?.orderId||!result.incidentId)throw Error();setCreated(result);}catch{setError('Die Anlage konnte nicht eindeutig bestätigt werden. Bitte zuerst den Auftragsbestand prüfen; es wird nicht automatisch erneut angelegt.');}finally{setBusy(false);}}
 return created?<MaintenancePlanningDialog key={created.orderId+':'+created.incidentId} sourceRevision={props.data.costRevision??''} created={created} row={props.row} onClose={props.onClose} onSaved={warning=>{props.onSaved?.(created.orderId,warning);props.onClose();}}/>:<PreviewDialog {...props} busy={busy} error={error} onCreate={props.createOrder&&!attempted?create:undefined}/>;
}
function PreviewDialog({row,data,onClose,returnFocus,onCreate,busy,error}:Props&{onCreate?:()=>void;busy:boolean;error:string}){
 const dialog=useRef<HTMLDialogElement>(null),context=maintenanceContext(row,data.objects,data.customers);
 useEffect(()=>{const node=dialog.current,previous=returnFocus;node?.showModal();node?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});return()=>{node?.close();if(previous?.isConnected)previous.focus({preventScroll:true});};},[returnFocus]);
 return <dialog ref={dialog} className={styles.dialog} aria-labelledby="maintenance-preview-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}><form onSubmit={event=>{event.preventDefault();onCreate?.();}} aria-busy={busy}><header className={styles.heading}><h2 id="maintenance-preview-title">Auftrag vorbereiten</h2><button type="button" className={`${styles.close} heyelli-close`} aria-label="Vorschau schließen" disabled={busy} onClick={onClose}>×</button></header><div className={styles.body}><dl className={maintenanceStyles.previewFacts}>{[['Kunde',context.customer?.name||'Nicht zugeordnet'],['Objekt',context.object?.name||'Nicht zugeordnet'],['Technische Einheit',context.unit?.name||'Keine technische Einheit zugeordnet'],['Fälligkeit',row.due?new Intl.DateTimeFormat('de-DE',{timeZone:'UTC',dateStyle:'medium'}).format(new Date(row.due+'T12:00:00Z')):'Nicht hinterlegt'],...(row.contract!==row.title?[['Wartungsvertrag',row.contract]]:[]),['Wartung',row.title]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{row.description&&<p>{row.description}</p>}{error&&<Notice tone="error">{error}</Notice>}{!onCreate&&!busy&&!error&&<><Notice tone="neutral">Vorschau: Es wird kein Auftrag angelegt und keine Fälligkeit verändert.</Notice><p>Die Auftragserzeugung ist noch nicht freigegeben.</p></>}<p>Nach bestätigter Anlage öffnet die Terminvergabe für Haupttechniker, Begleiter und Termin.</p></div><footer className={styles.footer}><button type="button" disabled={busy} onClick={onClose}>Fertig</button><button type="submit" className={styles.save} disabled={!onCreate||busy} title={onCreate?'Auftrag anlegen und anschließend Techniker und Termin zuordnen.':'PDS-Ablauf und Schreibfreigabe stehen noch aus.'}>{busy?'Wird angelegt …':'Auftrag erzeugen'}</button></footer></form></dialog>;
}
