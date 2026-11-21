'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import {usageApp} from './app-usage-model';
export function useAppUsage(){
 const [usage,setUsage]=useState<Record<string,number>>({});const pathname=usePathname(),previous=useRef<string|null>(null),epoch=useRef(0);
 const reload=useCallback(async()=>{const turn=++epoch.current;try{const response=await fetch('/api/benutzerkonto/app-nutzung',{cache:'no-store',signal:AbortSignal.timeout(10000)});const data=await response.json();if(turn===epoch.current)setUsage(response.ok?data.usage:{});}catch{/* Preserve a known order during transient failures. */}},[]);
 useEffect(()=>{const reset=()=>{epoch.current++;previous.current=null;setUsage({});void reload();};window.addEventListener('heyelli:session-change',reset);return()=>{window.removeEventListener('heyelli:session-change',reset);};},[reload]);
 useEffect(()=>{const app=usageApp(pathname);if(!app||previous.current===app)return;previous.current=app;void fetch('/api/benutzerkonto/app-nutzung',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:app}),signal:AbortSignal.timeout(10000)}).then(()=>reload()).catch(()=>{/* Usage must never block opening an app. No automatic duplicate retry. */});},[pathname,reload]);
 return {usage,reload};
}
