'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
type View='grid'|'list';
export function useLauncherView(){
 const [view,setView]=useState<View>('grid'),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const state=useRef<{owner:string;version:number}|null>(null),epoch=useRef(0),saving=useRef(false);
 const invalidate=useCallback(()=>{epoch.current++;},[]);
 const reload=useCallback(async()=>{
  if(saving.current)return;
  const turn=++epoch.current;setReady(false);
  try{const response=await fetch('/api/benutzerkonto/navigation',{cache:'no-store',signal:AbortSignal.timeout(10000)}),data=await response.json();if(!response.ok)throw new Error(data.error);
   if(turn!==epoch.current)return;state.current={owner:data.owner,version:data.version};setView(data.view);setReady(true);setError('');
  }catch{if(turn===epoch.current){state.current=null;setError('Die gespeicherte Menüansicht ist nicht erreichbar. Bitte das Menü erneut öffnen.');}}
 },[]);
 useEffect(()=>{const frame=requestAnimationFrame(()=>void reload());const refresh=()=>void reload();const sessionChange=()=>{epoch.current++;saving.current=false;state.current=null;setView('grid');setBusy(false);void reload();};window.addEventListener('focus',refresh);window.addEventListener('heyelli:session-change',sessionChange);return()=>{cancelAnimationFrame(frame);invalidate();window.removeEventListener('focus',refresh);window.removeEventListener('heyelli:session-change',sessionChange);};},[reload,invalidate]);
 async function change(next:View){
  if(!ready||saving.current||!state.current||next===view)return;
  const previous=view,current=state.current,turn=++epoch.current;saving.current=true;setBusy(true);setView(next);setError('');
  try{const response=await fetch('/api/benutzerkonto/navigation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...current,view:next}),signal:AbortSignal.timeout(10000)}),data=await response.json();if(!response.ok)throw new Error(data.error);
   if(turn===epoch.current){state.current={owner:data.owner,version:data.version};setView(data.view);}
  }catch(cause){if(turn===epoch.current){setView(previous);setError(cause instanceof Error?cause.message+' Bitte das Menü erneut öffnen.':'Die Menüansicht konnte nicht gespeichert werden. Bitte das Menü erneut öffnen.');setReady(false);}}
  finally{if(turn===epoch.current){saving.current=false;setBusy(false);}}
 }
 return {view,ready,busy,error,reload,change};
}
