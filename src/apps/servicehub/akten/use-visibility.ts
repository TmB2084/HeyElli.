'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {HiddenEntry} from './visibility-store';
type Snapshot={owner:string;source:string;hidden:HiddenEntry[]};
const endpoint='/api/service/sichtbarkeit';
export function useServiceVisibility(){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const controller=useRef<AbortController|null>(null),saving=useRef(false),mounted=useRef(false);
 const load=useCallback(async()=>{
  if(saving.current||document.visibilityState==='hidden')return;controller.current?.abort();const next=new AbortController();controller.current=next;
  try{const response=await fetch(endpoint,{cache:'no-store',signal:AbortSignal.any([next.signal,AbortSignal.timeout(15000)])});const value=await response.json();if(next.signal.aborted||!mounted.current)return;if(!response.ok){if(response.status===401||response.status===403){setSnapshot(null);window.dispatchEvent(new Event('heyelli:session-change'));}throw Error(value.error);}setSnapshot(value);setError('');}
  catch{if(!next.signal.aborted&&mounted.current)setError('Ausgeblendete Einträge konnten nicht geladen werden. Bitte erneut versuchen.');}
 },[]);
 useEffect(()=>{mounted.current=true;const initial=setTimeout(()=>void load(),0);const timer=setInterval(()=>void load(),60000),focus=()=>void load();window.addEventListener('focus',focus);window.addEventListener('online',focus);document.addEventListener('visibilitychange',focus);return()=>{mounted.current=false;controller.current?.abort();clearTimeout(initial);clearInterval(timer);window.removeEventListener('focus',focus);window.removeEventListener('online',focus);document.removeEventListener('visibilitychange',focus);};},[load]);
 async function change(kind:HiddenEntry['kind'],id:string,hidden:boolean){
  if(!snapshot||saving.current)return;saving.current=true;setBusy(true);controller.current?.abort();
  try{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner:snapshot.owner,source:snapshot.source,kind,id,hidden}),signal:AbortSignal.timeout(15000)}),value=await response.json();if(!response.ok)throw Error(value.error);if(mounted.current){setSnapshot(value);setError('');}}
  catch(problem){if(mounted.current)setError(problem instanceof Error&&!['TypeError','TimeoutError','AbortError'].includes(problem.name)?problem.message:'Die Änderung konnte nicht bestätigt werden. Bitte erneut versuchen; Ausblenden und Einblenden lassen sich gefahrlos wiederholen.');}
  finally{saving.current=false;if(mounted.current)setBusy(false);}
 }
 return {hidden:snapshot?.hidden??[],ready:!!snapshot,error,busy,change,reload:load};
}
