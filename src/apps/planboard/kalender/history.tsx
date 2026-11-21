'use client';
import {Notice} from "@/platform/shell";
import {useEffect,useRef,useState} from 'react';
type Entry={id:string;actorName:string;at:string;changes:{field:string;label:string;before:unknown;after:unknown}[]};
function display(value:unknown,field:string,names:Record<string,string>):string{
 if(value===null||value===undefined||value==='')return '—';
 if(typeof value==='boolean')return value?'Ja':'Nein';
 if(Array.isArray(value))return value.length?value.map(item=>names[String(item)]??String(item)).join(', '):'—';
 if((field==='start'||field==='end')&&typeof value==='string')return new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'}).format(new Date(value));
 if(typeof value==='object')return Object.values(value).filter(Boolean).join(', ');
 return names[String(value)]??String(value);
}
export function CalendarHistory({eventId,version,names}:{eventId:string;version:string;names:Record<string,string>}){
 const [open,setOpen]=useState(false),[entries,setEntries]=useState<Entry[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(false),[retry,setRetry]=useState(0);
 const sequence=useRef(0);
 useEffect(()=>{
  if(!open)return;
  const controller=new AbortController(),request=++sequence.current;
  async function read(){setLoading(true);setError('');try{const response=await fetch(`/api/ressourcenkalender/historie?id=${encodeURIComponent(eventId)}`,{cache:'no-store',signal:controller.signal});const result=await response.json();if(!response.ok)throw new Error(result.error);if(request===sequence.current)setEntries(result.entries);}catch(problem){if(!controller.signal.aborted&&request===sequence.current)setError(problem instanceof Error?problem.message:'Historie nicht verfügbar.');}finally{if(!controller.signal.aborted&&request===sequence.current)setLoading(false);}}
  void read();return()=>controller.abort();
 },[open,eventId,version,retry]);
 return <details className="calendar-section calendar-history" onToggle={event=>setOpen(event.currentTarget.open)}><summary>Terminhistorie</summary><p><small>Bestätigte Änderungen aus HeyElli seit Einführung der Historie. Direkte Änderungen in PDS sind nicht enthalten. Die letzten 200 Einträge werden angezeigt.</small></p>{loading?<Notice tone="neutral" role="status">Historie wird geladen …</Notice>:error?<Notice tone="error" role="alert">{error} <button type="button" onClick={()=>setRetry(value=>value+1)}>Erneut laden</button></Notice>:!entries.length?<p>Noch keine Änderungen protokolliert.</p>:entries.map(entry=><article key={entry.id}><p><strong>{entry.actorName}</strong> · <time dateTime={entry.at}>{new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'medium',timeStyle:'medium'}).format(new Date(entry.at))}</time></p><dl>{entry.changes.map(change=><div key={change.field}><dt>{change.label}</dt><dd><span>Vorher: {display(change.before,change.field,names)}</span><span>Nachher: {display(change.after,change.field,names)}</span></dd></div>)}</dl></article>)}</details>;
}
