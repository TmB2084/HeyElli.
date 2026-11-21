'use client';
import {useEffect,useState} from 'react';
// Older calendar responses did not carry serviceRead. Resolve only that unknown
// state from the session's server-checked app inventory; an explicit denial wins.
export function useServiceRead(available:boolean,permission:boolean|undefined){
 const [verified,setVerified]=useState(false);
 useEffect(()=>{
  if(!available||typeof permission==='boolean')return;
  let active=true,controller:AbortController|undefined;
  async function check(){if(!active)return;controller?.abort();const current=new AbortController();controller=current;try{const response=await fetch('/api/simulator-session',{cache:'no-store',signal:AbortSignal.any([current.signal,AbortSignal.timeout(15000)])}),value=await response.json();if(!active||current.signal.aborted)return;if(response.ok&&typeof value.authenticated==='boolean'&&Array.isArray(value.allowedApps))setVerified(value.authenticated&&value.allowedApps.includes('/servicehub'));else if(response.status===401||response.status===403)setVerified(false);}catch{/* Temporary outages preserve the last verified right; target routes still enforce access. */}}
  const refresh=()=>void check(),invalidate=()=>{active=false;controller?.abort();setVerified(false);};
  refresh();const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);window.addEventListener('heyelli:session-invalid',invalidate);
  return()=>{active=false;controller?.abort();clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);window.removeEventListener('heyelli:session-invalid',invalidate);};
 },[available,permission]);
 return permission??(available&&verified);
}
