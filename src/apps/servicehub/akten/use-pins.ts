'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
type Snapshot={owner:string;source:string;pinned?:string[];flagged?:string[]};
type SelectionKind='pinned'|'flagged';
const endpoints={pinned:'/api/service/angeheftet',flagged:'/api/service/markierungen'};
const labels={pinned:'Angeheftete Kunden',flagged:'Auftragsmarkierungen'};

function usePersonalServiceSelection(kind:SelectionKind){
 const endpoint=endpoints[kind];
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const controller=useRef<AbortController|null>(null),saving=useRef(false),mounted=useRef(false);
 const load=useCallback(async()=>{
  if(saving.current||document.visibilityState==='hidden')return;controller.current?.abort();const next=new AbortController();controller.current=next;
  try{const response=await fetch(endpoint,{cache:'no-store',signal:AbortSignal.any([next.signal,AbortSignal.timeout(15000)])});const value=await response.json();if(next.signal.aborted||!mounted.current)return;if(!response.ok){if(response.status===401||response.status===403){setSnapshot(null);window.dispatchEvent(new Event('heyelli:session-change'));}throw Error(value.error);}setSnapshot(value);setError('');}
  catch{if(!next.signal.aborted&&mounted.current)setError(labels[kind]+' konnten nicht geladen werden.');}
 },[endpoint,kind]);
 useEffect(()=>{mounted.current=true;const initial=setTimeout(()=>void load(),0);const timer=setInterval(()=>void load(),60000),focus=()=>void load();window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);return()=>{mounted.current=false;controller.current?.abort();clearTimeout(initial);clearInterval(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};},[load]);
 async function change(id:string,selected:boolean){
  if(!snapshot||saving.current)return;saving.current=true;setBusy(true);controller.current?.abort();
  try{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner:snapshot.owner,source:snapshot.source,id,[kind]:selected}),signal:AbortSignal.timeout(15000)}),value=await response.json();if(!response.ok){if(response.status===401||response.status===403){if(mounted.current)setSnapshot(null);window.dispatchEvent(new Event('heyelli:session-change'));}throw Error(value.error);}if(mounted.current){setSnapshot(value);setError('');}}
  catch(problem){if(mounted.current)setError(problem instanceof Error&&!['TypeError','TimeoutError','AbortError'].includes(problem.name)?problem.message:'Die Änderung konnte nicht bestätigt werden. Erneutes Ausführen ist möglich.');}
  finally{saving.current=false;if(mounted.current)setBusy(false);}
 }
 return {selected:snapshot?.[kind]??[],ready:!!snapshot,error,busy,change,reload:load};
}

export function useServicePins(){
 const {selected,...controls}=usePersonalServiceSelection('pinned');
 return {pinned:selected,...controls};
}

export function useServiceFlags(){
 const {selected,...controls}=usePersonalServiceSelection('flagged');
 return {flagged:selected,...controls};
}
