"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import type {toolCatalog} from '../app-access/tools';
export type ToolState={owner:string;tools:ReadonlyArray<(typeof toolCatalog)[number]>;hidden:string[];version:number};
export function useTools(){
 const [data,setData]=useState<ToolState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),alive=useRef(false),request=useRef(0),saving=useRef(false);
 const load=useCallback(async()=>{
  if(saving.current)return;const epoch=++request.current;
  try{const r=await fetch('/api/benutzerkonto/werkzeuge',{cache:'no-store',signal:AbortSignal.timeout(15000)}),body=await r.json();if(!alive.current||epoch!==request.current)return;
   if(!r.ok){if(r.status===401||r.status===403)setData(null);throw Error('Werkzeuge konnten nicht geladen werden.');}
   setData(body);setError('');
  }catch{if(alive.current&&epoch===request.current)setError('Werkzeuge sind gerade nicht erreichbar. Bitte erneut versuchen.');}
 },[]);
 useEffect(()=>{alive.current=true;const initial=requestAnimationFrame(()=>void load());const refresh=()=>{if(document.visibilityState!=='hidden')void load();};const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);window.addEventListener('heyelli:tools-change',refresh);return()=>{alive.current=false;cancelAnimationFrame(initial);clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);window.removeEventListener('heyelli:tools-change',refresh);};},[load]);
 async function change(id:string,visible:boolean){
  if(!data||saving.current)return;saving.current=true;request.current++;setBusy(true);setError('');
  const hidden=visible?data.hidden.filter(value=>value!==id):[...new Set([...data.hidden,id])];
  setData({...data,hidden});
  let refreshed=false;
  try{const r=await fetch('/api/benutzerkonto/werkzeuge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner:data.owner,version:data.version,hidden}),signal:AbortSignal.timeout(15000)}),value=await r.json();if(!alive.current)return;
   if(!r.ok){if(r.status===409){saving.current=false;await load();refreshed=true;}throw Error(value.error||'Nicht gespeichert.');}
   setData(current=>current?.owner===value.owner?{...current,...value}:current);window.dispatchEvent(new Event('heyelli:tools-change'));try{localStorage.setItem('heyelli:tools-change',String(Date.now()));}catch{/* Background polling still synchronizes tabs. */}
  }catch(reason){if(alive.current&&!refreshed)setData(data);if(alive.current)setError(reason instanceof Error?reason.message:'Nicht gespeichert. Bitte erneut versuchen.');}finally{saving.current=false;if(alive.current)setBusy(false);}
 }
 useEffect(()=>{const refresh=(event:StorageEvent)=>{if(event.key==='heyelli:tools-change')void load();};window.addEventListener('storage',refresh);return()=>window.removeEventListener('storage',refresh);},[load]);
 return {data,error,busy,change,retry:load};
}
