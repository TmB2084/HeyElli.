'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Notice} from '@/platform/shell';
import type {ServiceFile,ServiceOverview,ServiceIncident} from './model';
import type {DispatchCatalog,DispatchContext,DispatchDocument,DispatchSelection,DispatchTarget} from './dispatch-model';
import {OrderIncident} from './order-incident';
import styles from './dispatch.module.css';
import {ReturnControl} from './return-control';
import {MaterialList} from './material-list';

type Selection={scope:string;sourceRevision:string;canWrite:boolean;selection:DispatchSelection[]};
type Bma={links:{aid:number;number:string;name:string;url:string;object:string}[];notices:string[]};
function date(value:string){return value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'Noch nicht geplant';}
export function DispatchPack({file,orderId,data,onPlan,onConfirm}:{file:ServiceFile&{sourceRevision?:string};orderId:string;data:ServiceOverview;onPlan:(incident:ServiceIncident)=>void;onConfirm:(id:string)=>void}){
 // Aufbau nach Mockup V1: Einsätze mit Fokusfeldern zuerst, dann Kunde, dann aufklappbare Zeilen
 // Einsatzmappe (Dokumente, Ansprechpartner, BMACloud – lädt erst beim Öffnen), Rücklauf und Material.
 // Zugeklappt wie im Mockup; einmal geöffnet bleibt die Einsatzmappe in dieser Sitzung offen (auch nach Neuladen).
 // Die Akte wird erst im Browser nach dem Datenabruf gerendert; sessionStorage ist dann verfügbar.
 const [open,setOpen]=useState(()=>{try{return typeof window!=='undefined'&&sessionStorage.getItem('heyelli:einsatzmappe-offen')==='1';}catch{return false;}});
 function toggle(next:boolean){setOpen(next);try{sessionStorage.setItem('heyelli:einsatzmappe-offen',next?'1':'0');}catch{}}
 return <>
  {file.incidents?.map((incident,index)=><OrderIncident orderId={orderId} key={incident.id} incident={incident} index={index} count={file.incidents?.length} data={data} orderStatus={file.status} onPlan={onPlan} onConfirm={onConfirm}/>)}
  <div className={styles.packGroup}><details className={styles.pack} open={open} onToggle={event=>{if(event.currentTarget.open!==open)toggle(event.currentTarget.open);}}><summary>Einsatzmappe</summary>{open&&<PackContent file={file} orderId={orderId}/>}</details>
  <ReturnControl key={orderId+file.sourceRevision} orderId={orderId} revision={file.sourceRevision??''} objects={data.objects}/><MaterialList orderId={orderId} revision={file.sourceRevision??''} objects={data.objects}/></div>
 </>;
}
function PackContent({file,orderId}:{file:ServiceFile&{sourceRevision?:string};orderId:string}){
 const endpoint='/api/service/einsatzmappe?'+new URLSearchParams({order:orderId,revision:file.sourceRevision??''}),[selection,setSelection]=useState<Selection|null>(null),[context,setContext]=useState<DispatchContext|null>(null),[bma,setBma]=useState<Bma|null>(null),[catalogs,setCatalogs]=useState<Record<string,DispatchCatalog>>({}),[edit,setEdit]=useState(false),[error,setError]=useState(''),[contextError,setContextError]=useState(''),[bmaError,setBmaError]=useState(''),[busy,setBusy]=useState<Set<string>>(new Set()),[retry,setRetry]=useState(0);
 const state=useRef({pending:new Set<string>(),loading:new Set<string>(),catalogs:{} as Record<string,DispatchCatalog>,generation:0,alive:false});
 const request=useCallback(async(section:string,target='',signal?:AbortSignal)=>{const response=await fetch(endpoint+'&'+new URLSearchParams({section,target}),{cache:'no-store',signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(30000)])});const value=await response.json();if(!response.ok){if(response.status===401||response.status===403)window.dispatchEvent(new Event('heyelli:session-change'));throw Error(value.error||'Einsatzmappe derzeit nicht verfügbar.');}return value;},[endpoint]);
 const loadCatalog=useCallback(async(target:string,signal?:AbortSignal,force=false)=>{
  if(state.current.loading.has(target)||!force&&state.current.catalogs[target])return;state.current.loading.add(target);
  try{const value:DispatchCatalog=await request(target==='pds'?'pds':'sharepoint',target,signal);if(signal?.aborted||!state.current.alive)return;state.current.catalogs[target]=value;setCatalogs(old=>({...old,[target]:value}));}
  catch{if(!signal?.aborted&&state.current.alive){const value={items:[],errors:['Diese Dokumentquelle konnte nicht geladen werden. Die gespeicherte Auswahl bleibt erhalten.']};state.current.catalogs[target]=value;setCatalogs(old=>({...old,[target]:value}));}}
  finally{state.current.loading.delete(target);}
 },[request]);
 useEffect(()=>{const controller=new AbortController(),lifecycle=state.current;lifecycle.alive=true;let running=false;
  async function load(){if(running||document.visibilityState==='hidden'||state.current.pending.size)return;running=true;const generation=state.current.generation;
   try{const value:Selection=await request('selection','',controller.signal);if(!controller.signal.aborted&&state.current.alive&&generation===state.current.generation){setSelection(value);setError('');const targets=[...new Set(['pds',...value.selection.filter(item=>item.selected).map(item=>item.reference.target),...Object.keys(state.current.catalogs)])];for(const target of targets)await loadCatalog(target,controller.signal,true);}}
   catch{if(!controller.signal.aborted&&state.current.alive)setError('Die Dokumentauswahl konnte nicht aktualisiert werden. Bitte erneut laden.');}finally{running=false;}}
  let auxiliaryRunning=false;
  async function auxiliary(){if(auxiliaryRunning||document.visibilityState==='hidden')return;auxiliaryRunning=true;await Promise.allSettled([
   request('context','',controller.signal).then(value=>{if(!controller.signal.aborted){setContext(value);setContextError('');}},()=>{if(!controller.signal.aborted)setContextError('Weitere Aktenordner und Ansprechpartner konnten nicht geladen werden.');}),
   request('bma','',controller.signal).then(value=>{if(!controller.signal.aborted){setBma(value);setBmaError('');}},()=>{if(!controller.signal.aborted){setBma(null);setBmaError('BMACloud-Verknüpfungen sind derzeit nicht erreichbar.');}})
  ]);auxiliaryRunning=false;}
  const refresh=()=>{void load();void auxiliary();};refresh();
  const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);return()=>{lifecycle.alive=false;controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);};
 },[request,loadCatalog,retry]);
 async function choose(document:DispatchDocument|DispatchSelection,selected:boolean){if(!selection?.canWrite||state.current.pending.has(document.key))return;const before=selection.selection.find(item=>item.key===document.key);state.current.pending.add(document.key);state.current.generation++;setBusy(new Set(state.current.pending));setError('');let failed=false;
  try{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scope:selection.scope,key:document.key,target:document.reference.target,selected,version:before?.version??0}),signal:AbortSignal.timeout(30000)}),value=await response.json();if(!response.ok)throw Error(value.error);if(state.current.alive)setSelection(old=>old?{...old,selection:[...old.selection.filter(item=>item.key!==value.key),value]}:old);}
  catch(problem){failed=true;if(state.current.alive)setError(problem instanceof Error&&!['TypeError','AbortError','TimeoutError'].includes(problem.name)?problem.message:'Die Auswahl konnte nicht bestätigt werden. Erneut auswählen ist möglich; es werden keine Dokumentdateien kopiert.');}
  finally{state.current.pending.delete(document.key);if(state.current.alive)setBusy(new Set(state.current.pending));if(failed&&!state.current.pending.size){const generation=state.current.generation;try{const latest:Selection=await request('selection');if(state.current.alive&&!state.current.pending.size&&generation===state.current.generation){setSelection(latest);if(latest.selection.find(item=>item.key===document.key)?.selected===selected)setError('');}}catch{}}}
 }
 const chosen=selection?.selection.filter(item=>item.selected)??[],byKey=new Map(Object.values(catalogs).flatMap(value=>value.items).map(item=>[item.key,item]));
 function documentRow(item:DispatchDocument|DispatchSelection){const document='name'in item?item:byKey.get(item.key),checked=selection?.selection.find(row=>row.key===item.key)?.selected??false,name=document?.name||'Dokumentverweis derzeit nicht prüfbar';return <li key={item.key}><span>{document?.url?<a href={document.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{name} ↗</a>:<span>{name}</span>}<small>{document?.origin??(item.reference.provider==='pds'?'PDS':'SharePoint')}{document?.modified&&Number.isFinite(Date.parse(document.modified))?' · '+date(document.modified):''}</small></span><input className="heyelli-switch" type="checkbox" role="switch" aria-label={'Für Einsatz auswählen · '+name} title={selection?.canWrite?'Dokumentverweis für diesen Auftrag auswählen':'Service-Schreibrecht erforderlich'} checked={checked} disabled={!selection?.canWrite||busy.has(item.key)} onChange={event=>void choose(item,event.target.checked)}/></li>;}
 const targets:DispatchTarget[]=context?.targets??[{id:'order',kind:'order',label:'Auftrag',recordId:orderId}];
 return <div className={styles.body}>
 <Notice tone="error">{contextError}</Notice>{context?.contacts.length? <div className={`${styles.contacts} ${styles.secondaryGroup}`}><h4>Ansprechpartner</h4>{context.contacts.map((contact,index)=><p key={index}>{contact.name}{contact.phones.map(phone=><a key={phone} href={'tel:'+phone.replace(/[^+\d]/g,'')}>{phone}</a>)}</p>)}</div>:null}
 <section className={styles.secondaryGroup} aria-label="Dokumente der Einsatzmappe"><div className={styles.sectionHead}><h4>Dokumente <small>{chosen.length} ausgewählt</small></h4><button type="button" aria-pressed={edit} onClick={()=>{setEdit(value=>!value);if(!edit)void loadCatalog('order');}}>{edit?'Auswahl anzeigen':selection?.canWrite?'Dokumente auswählen':'Verfügbare Dokumente'}</button></div>
 <Notice tone="error">{error}</Notice>{!edit&&Object.entries(catalogs).filter(([,value])=>value.errors.length).map(([key,value])=><Notice key={key} tone="error">{value.errors.join(' ')}</Notice>)}{(error||contextError||bmaError||Object.values(catalogs).some(value=>value.errors.length))&&<button type="button" disabled={busy.size>0} onClick={()=>setRetry(value=>value+1)}>Mappe erneut laden</button>}
 {!selection&&!error&&<p role="status">Dokumentauswahl wird geladen …</p>}
 {!edit&&selection&&<>{!chosen.length?<p className={styles.hint}>Noch keine Dokumente für diesen Einsatz ausgewählt.</p>:<ul className={styles.documents}>{chosen.map(documentRow)}</ul>}</>}
 {edit&&<><details open className={styles.folder}><summary>PDS · Auftragsdokumente</summary>{catalogs.pds?<><Notice tone="error">{catalogs.pds.errors.join(' ')}</Notice><ul className={styles.documents}>{catalogs.pds.items.map(documentRow)}</ul>{!catalogs.pds.items.length&&!catalogs.pds.errors.length&&<p className={styles.hint}>Keine PDS-Dokumente hinterlegt.</p>}</>:<p role="status">PDS-Dokumente werden geladen …</p>}</details>{targets.map(target=><details className={styles.folder} key={target.id} onToggle={event=>{if(event.currentTarget.open)void loadCatalog(target.id);}}><summary>SharePoint · {target.label}</summary>{catalogs[target.id]?<><Notice tone="error">{catalogs[target.id].errors.join(' ')}</Notice>{catalogs[target.id].notice&&<p className={styles.hint}>{catalogs[target.id].notice}</p>}<ul className={styles.documents}>{catalogs[target.id].items.map(documentRow)}</ul>{!catalogs[target.id].items.length&&!catalogs[target.id].notice&&!catalogs[target.id].errors.length&&<p className={styles.hint}>Keine Dokumente in diesem Aktenordner.</p>}{catalogs[target.id].truncated&&<Notice tone="neutral">Die ersten 100 Dateien dieses Ordners sind sichtbar. Weitere Dateien direkt in SharePoint prüfen.</Notice>}</>:<p role="status">Dokumente werden geladen …</p>}</details>)}</>}
 </section>
 <section className={`${styles.bma} ${styles.secondaryGroup}`}><h4>BMACloud</h4><Notice tone="error">{bmaError}</Notice>{bma?.links.map(link=><a key={link.object+':'+link.aid} href={link.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{link.object} · {link.name||link.number} ↗</a>)}{bma?.notices.map(notice=><p key={notice} className={styles.hint}>{notice}</p>)}{bma&&!bma.links.length&&!bma.notices.length&&<p className={styles.hint}>Keine freigegebene BMACloud-Verknüpfung verfügbar.</p>}</section>
 <p className={styles.hint}>Die Mappe speichert gemeinsam genutzte Verweise am Auftrag. Dateien bleiben in PDS oder SharePoint.</p>
 </div>;
}
