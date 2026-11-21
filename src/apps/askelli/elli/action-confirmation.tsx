'use client';
import {useCallback,useEffect,useState} from 'react';
import {Notice} from '@/platform/shell';
import styles from './chat.module.css';
type Action={id:string;state:string;expired:boolean;preview:{title:string;rows:[string,string][]};result:string|null};
export function ActionConfirmation({epoch,turnId,enabled,locked,onBusy}:{epoch:string;turnId:string;enabled:boolean;locked:boolean;onBusy:(busy:boolean)=>void}){
 const [action,setAction]=useState<Action|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=useCallback(async()=>{const r=await fetch('/api/assistent/aktionen?'+new URLSearchParams({epoch,turn:turnId}),{cache:'no-store',signal:AbortSignal.timeout(15000)}),v=await r.json();if(!r.ok)throw Error(v.error);setAction(v.action);},[epoch,turnId]);
 useEffect(()=>{let active=true;void(async()=>{try{await load();}catch{if(active)setError('Vorschlag konnte nicht geladen werden. Bitte Chat erneut öffnen.');}})();return()=>{active=false;};},[load]);
 async function confirm(value:boolean){if(!action||busy||locked)return;setBusy(true);onBusy(true);setError('');try{const r=await fetch('/api/assistent/aktionen',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:action.id,confirm:value}),signal:AbortSignal.timeout(45000)}),v=await r.json();if(!r.ok)throw Error(v.error);await load();}catch(error){setError(error instanceof Error&&!['TypeError','AbortError','TimeoutError'].includes(error.name)?error.message:'Verbindung unterbrochen. Ergebnis noch nicht bestätigt. Status prüfen; nicht erneut auslösen.');try{await load();}catch{/* Keep proposal and error; never automatically repeat a confirmation. */}}finally{setBusy(false);onBusy(false);}}
 return <div className={styles.actionCard}>
  {error&&<Notice tone="error" role="alert">{error}</Notice>}
  {action&&<><strong>{action.preview.title}</strong><dl>{action.preview.rows.map(([label,value],i)=><div key={i}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
   {action.state==='pending'&&!action.expired?<><small>Erst mit deiner Bestätigung wird diese Aktion ausgeführt.</small><div className={styles.actionButtons}><button type="button" disabled={busy||locked||!enabled} onClick={()=>void confirm(false)}>Verwerfen</button><button type="button" disabled={busy||locked||!enabled||!!error} onClick={()=>void confirm(true)}>{busy?'Wird geprüft …':'Bestätigen und ausführen'}</button></div>{!enabled&&<small>Für diese Aktion ist eine aktuelle Copilot-Freigabe und Schreibberechtigung erforderlich.</small>}</>:<Notice tone={['failed','uncertain','executing'].includes(action.state)?'error':action.state==='done'?'success':'neutral'} role="status">{action.expired&&action.state==='pending'?'Vorschlag abgelaufen. Bitte neu anfordern.':action.result??'Vorschlag beendet.'}</Notice>}
  </>}
 </div>;
}
