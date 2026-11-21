'use client';
import {Notice,useNoticeState} from "@/platform/shell";
import {useEffect,useState} from 'react';
import {auditAction,auditMarkdown,auditValue,type AuditEntry} from './audit-format';
import {auditFilterParams,emptyAuditFilters} from './audit-filter';
const time=(value:string|Date)=>new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'}).format(new Date(value));
export function AuditPanel({users}:{users:{id:string;displayName:string}[]}){
 const {message,noticeTone,showError,showSuccess}=useNoticeState();
 const [page,setPage]=useState<{nextCursor:string|null;snapshot:string;actors:string[];actions:string[]}|null>(null),[position,setPosition]=useState<{cursor:string;snapshot:string;back:string[]}>({cursor:'',snapshot:'',back:[]});
 const [entries,setEntries]=useState<AuditEntry[]|null>(null),[filters,setFilters]=useState(emptyAuditFilters),[error,setError]=useState('');
 useEffect(()=>{
  const invalid=!!(filters.from&&filters.to&&filters.from>filters.to);if(invalid)return;
  let active=true;let controller:AbortController|null=null;
  async function load(){
   if(document.visibilityState==='hidden'||controller)return;
   controller=new AbortController();
   try{const response=await fetch('/api/verwaltung/protokoll?'+new URLSearchParams({...Object.fromEntries(auditFilterParams(filters)),format:'json',...(position.cursor?{cursor:position.cursor,snapshot:position.snapshot}:{})}),{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])}),result=await response.json();if(!response.ok){if(active&&(response.status===401||response.status===403))setEntries(null);throw new Error(result.error??'Protokoll konnte nicht geladen werden.');}if(active){setEntries(result.entries);setPage(result);setError('');}}
   catch(problem){if(active)setError(problem instanceof Error?problem.message:'Protokoll konnte nicht geladen werden.');}
   finally{controller=null;}
  }
  const initial=window.setTimeout(()=>void load(),250);const interval=window.setInterval(()=>void load(),15000);
  const resume=()=>void load();window.addEventListener('focus',resume);window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);
  return()=>{active=false;controller?.abort();window.clearTimeout(initial);window.clearInterval(interval);window.removeEventListener('focus',resume);window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume);};
 },[filters,position]);
 const invalidRange=!!(filters.from&&filters.to&&filters.from>filters.to),filtered=invalidRange?[]:entries??[];
 const actors=[...(page?.actors??[])].sort((a,b)=>a.localeCompare(b,'de'));
 const actions=[...(page?.actions??[])].sort((a,b)=>auditAction(a).localeCompare(auditAction(b),'de'));
 const resetPage=()=>{setPosition({cursor:'',snapshot:'',back:[]});setEntries(null);};
 const patch=(key:keyof typeof filters,value:string)=>{resetPage();setFilters(previous=>({...previous,[key]:value}));};
 return <section><h2 className="sr-only">Verwaltungsänderungen</h2>
  <div className="admin-audit-filters">
   <label>Suche<input type="search" placeholder="Änderung oder Wert suchen …" value={filters.search} maxLength={500} onChange={event=>patch('search',event.target.value)}/></label>
   <button type="button" onClick={()=>{resetPage();setFilters(emptyAuditFilters);}}>Zurücksetzen</button>
   <label>Benutzer<select value={filters.actor} onChange={event=>patch('actor',event.target.value)}><option value="">Alle Benutzer</option>{actors.map(id=><option key={id} value={id}>{users.find(user=>user.id===id)?.displayName??id}</option>)}</select></label>
   <label>Von<input type="date" value={filters.from} onChange={event=>patch('from',event.target.value)}/></label>
   <label>Bis<input type="date" value={filters.to} min={filters.from||undefined} onChange={event=>patch('to',event.target.value)}/></label>
   <label>Änderungsart<select value={filters.action} onChange={event=>patch('action',event.target.value)}><option value="">Alle Änderungen</option>{actions.map(action=><option key={action} value={action}>{auditAction(action)}</option>)}</select></label>
  </div>
  <div className="admin-audit-toolbar"><small>{entries===null?'Protokoll wird geladen …':`${filtered.length} Einträge auf dieser Seite`}</small><div className="admin-audit-downloads"><a className="admin-audit-download" href="/api/verwaltung/protokoll" download>Alle als Markdown</a><a className="admin-audit-download" aria-disabled={invalidRange} href={invalidRange?undefined:`/api/verwaltung/protokoll?${auditFilterParams(filters)}`} download>Gefilterte als Markdown</a></div></div>
  {invalidRange&&<Notice tone="error" role="alert">Das Enddatum muss nach dem Anfangsdatum liegen.</Notice>}{error&&<Notice tone="error" role="alert">{error} Die Aktualisierung wird automatisch wiederholt.</Notice>}<Notice tone={noticeTone} aria-live="polite">{message}</Notice>
  <ul className="admin-events admin-audit-list">{filtered.map((item)=><li key={(item as AuditEntry&{id:string}).id}><div><strong>{auditAction(item.action)}</strong><time dateTime={new Date(item.createdAt).toISOString()}>{time(item.createdAt)}</time><small>{item.actorId} → {item.targetId}</small>{item.changes?.length?<dl className="admin-audit-changes">{item.changes.map(change=><div key={change.field}><dt>{change.label}</dt><dd><span>{auditValue(change.before)}</span><span aria-label="geändert in"> → </span><strong>{auditValue(change.after)}</strong></dd></div>)}</dl>:<small>{item.changes?'Keine Feldänderungen.':'Alte und neue Werte wurden nicht erfasst.'}</small>}</div><button className="admin-audit-copy" type="button" title="Eintrag kopieren" aria-label={`${auditAction(item.action)} vom ${time(item.createdAt)} kopieren`} onClick={()=>void navigator.clipboard.writeText(auditMarkdown(item)).then(()=>showSuccess('Protokolleintrag kopiert.')).catch(()=>showError('Kopieren nicht möglich. Bitte den Eintrag markieren oder als Markdown herunterladen.'))}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg></button></li>)}</ul>
  <div className="admin-audit-toolbar"><button type="button" disabled={!position.back.length||entries===null} onClick={()=>{setEntries(null);setPosition(previous=>({...previous,cursor:previous.back.at(-1)!,back:previous.back.slice(0,-1)}));}}>Zurück</button><button type="button" disabled={!page?.nextCursor||entries===null||invalidRange} onClick={()=>{if(page?.nextCursor){setEntries(null);setPosition(previous=>({cursor:page.nextCursor!,snapshot:page.snapshot,back:[...previous.back,previous.cursor]}));}}}>Weitere Einträge</button></div>
  {entries!==null&&!filtered.length&&!invalidRange&&<p>Keine passenden Einträge.</p>}
 </section>;
}
