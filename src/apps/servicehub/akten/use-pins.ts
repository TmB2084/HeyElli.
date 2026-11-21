'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
type Snapshot={owner:string;source:string;pinned:string[]};
const endpoint='/api/service/angeheftet';
// Persönlich angeheftete Kunden für die Service-Seitenleiste; Muster wie useServiceVisibility.
export function useServicePins(){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const controller=useRef<AbortController|null>(null),saving=useRef(false),mounted=useRef(false);
 const load=useCallback(async()=>{
  if(saving.current||document.visibilityState==='hidden')return;controller.current?.abort();const next=new AbortController();controller.current=next;
  try{const response=await fetch(endpoint,{cache:'no-store',signal:AbortSignal.any([next.signal,AbortSignal.timeout(15000)])});const value=await response.json();if(next.signal.aborted||!mounted.current)return;if(!response.ok){if(response.status===401||response.status===403){setSnapshot(null);window.dispatchEvent(new Event('heyelli:session-change'));}throw Error(value.error);}setSnapshot(value);setError('');}
  catch{if(!next.signal.aborted&&mounted.current)setError('Angeheftete Kunden konnten nicht geladen werden.');}
 },[]);
 useEffect(()=>{mounted.current=true;const initial=setTimeout(()=>void load(),0);const timer=setInterval(()=>void load(),60000),focus=()=>void load();window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);return()=>{mounted.current=false;controller.current?.abort();clearTimeout(initial);clearInterval(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};},[load]);
 async function change(id:string,pinned:boolean){
  if(!snapshot||saving.current)return;saving.current=true;setBusy(true);controller.current?.abort();
  try{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner:snapshot.owner,source:snapshot.source,id,pinned}),signal:AbortSignal.timeout(15000)}),value=await response.json();if(!response.ok)throw Error(value.error);if(mounted.current){setSnapshot(value);setError('');}}
  catch(problem){if(mounted.current)setError(problem instanceof Error&&!['TypeError','TimeoutError','AbortError'].includes(problem.name)?problem.message:'Die Änderung konnte nicht bestätigt werden. Anheften und Lösen lassen sich gefahrlos wiederholen.');}
  finally{saving.current=false;if(mounted.current)setBusy(false);}
 }
 return {pinned:snapshot?.pinned??[],ready:!!snapshot,error,busy,change};
}
