'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {sessionResult} from './session-check';
import styles from './session-boundary.module.css';
function CheckedSession({children}:{children:ReactNode}){
 const pathname=usePathname(),view=useRef<HTMLDivElement>(null);
 const [readyPath,setReadyPath]=useState<string|null>(null);
 const [status,setStatus]=useState<'checking'|'ready'|'unavailable'>('checking'),retry=useRef<()=>void>(()=>{});
 useEffect(()=>{
  let active=true,controller:AbortController|undefined,expiry:ReturnType<typeof setTimeout>|undefined;
  let subject:string|undefined;let suspended:HTMLDialogElement[]=[],focused:HTMLElement|null=null;
  function hide(next:'checking'|'unavailable'='checking'){
   if(view.current&&!view.current.hidden)focused=document.activeElement instanceof HTMLElement?document.activeElement:null;
   // Top-layer dialogs can outlive an ancestor's hidden state. Suspend them too,
   // without unmounting forms or firing cancel/discard handlers.
   for(const node of document.querySelectorAll<HTMLDialogElement>('dialog[open]')){if(!suspended.includes(node)){suspended.push(node);node.close();}}
   if(view.current){view.current.hidden=true;view.current.inert=true;}setStatus(next);
  }
  function redirect(path:string){active=false;controller?.abort();clearTimeout(expiry);hide();window.dispatchEvent(new Event('heyelli:session-invalid'));window.location.replace(path);}
  async function check(mask=false){
   if(!active||document.visibilityState==='hidden')return;if(mask)hide();
   controller?.abort();const current=new AbortController();controller=current;const started=performance.now();let identityEpoch:string|null=null;try{identityEpoch=localStorage.getItem('heyelli:session-subject');}catch{/* Storage is optional for session validation. */}
   try{
    const response=await fetch('/api/simulator-session',{cache:'no-store',signal:AbortSignal.any([current.signal,AbortSignal.timeout(15000)])}),value=await response.json().catch(()=>null);
    if(!active||current.signal.aborted)return;
    const result=sessionResult(response.status,value,pathname,performance.now()-started);
    if(result.kind==='redirect'){redirect(result.path);return;}
    if(result.kind==='unavailable'){hide('unavailable');return;}
    const nextSubject=typeof value?.sessionSubject==='string'?value.sessionSubject:undefined;if(subject&&nextSubject&&subject!==nextSubject){redirect(pathname);return;}try{const currentIdentity=localStorage.getItem('heyelli:session-subject');if(currentIdentity!==identityEpoch&&currentIdentity&&currentIdentity!==nextSubject){redirect(pathname);return;}if(nextSubject&&currentIdentity!==nextSubject)localStorage.setItem('heyelli:session-subject',nextSubject);}catch{/* The verified session still guards this tab. */}subject=nextSubject;
    clearTimeout(expiry);expiry=setTimeout(()=>redirect('/anmeldung'),Math.min(result.remaining,2147483647));
    if(view.current){view.current.hidden=false;view.current.inert=false;}setReadyPath(pathname);setStatus('ready');
    for(const node of suspended)if(node.isConnected&&!node.open)node.showModal();suspended=[];
    if(focused?.isConnected)focused.focus({preventScroll:true});focused=null;
   }catch{if(active&&!current.signal.aborted)hide('unavailable');}
  }
  const restore=()=>void check(true),background=()=>void check(),focusedWindow=(event:Event)=>{if(event.target===window)void check();},pageHide=()=>hide(),offline=()=>{controller?.abort();hide('unavailable');};
  const accountEnded=(event:StorageEvent)=>{if(event.key==='heyelli:session-ended')redirect('/anmeldung');else if(event.key==='heyelli:session-subject'&&event.newValue&&event.newValue!==subject)redirect(pathname);};
  retry.current=background;void check();const interval=window.setInterval(background,15000);
  window.addEventListener('storage',accountEnded);window.addEventListener('focus',focusedWindow);window.addEventListener('pageshow',restore);window.addEventListener('popstate',restore);window.addEventListener('pagehide',pageHide);window.addEventListener('offline',offline);window.addEventListener('online',background);window.addEventListener('heyelli:session-change',restore);document.addEventListener('visibilitychange',restore);
  return()=>{active=false;retry.current=()=>{};controller?.abort();clearTimeout(expiry);window.clearInterval(interval);window.removeEventListener('storage',accountEnded);window.removeEventListener('focus',focusedWindow);window.removeEventListener('pageshow',restore);window.removeEventListener('popstate',restore);window.removeEventListener('pagehide',pageHide);window.removeEventListener('offline',offline);window.removeEventListener('online',background);window.removeEventListener('heyelli:session-change',restore);document.removeEventListener('visibilitychange',restore);};
 },[pathname]);
 return <><div ref={view} data-session-view="protected" hidden={(status!=='ready'||readyPath!==pathname)} inert={(status!=='ready'||readyPath!==pathname)}>{children}</div>{(status!=='ready'||readyPath!==pathname)&&<main className="login-page">{status==='unavailable'?<section className={styles.card} aria-label="Verbindung unterbrochen"><h1>Verbindung unterbrochen</h1><p role="status">Die Sitzung kann gerade nicht geprüft werden. Deine geöffneten Eingaben bleiben erhalten. Sobald die Verbindung zurück ist, geht es nach erfolgreicher Prüfung weiter.</p><button type="button" onClick={()=>retry.current()}>Erneut prüfen</button></section>:<p role="status">Sitzung wird geprüft …</p>}</main>}</>;
}
// Keep the mounted workspace during temporary outages, but never reveal it
// before a successful session/app check or after the known expiry deadline.
export function SessionBoundary({children}:{children:ReactNode}){return <CheckedSession>{children}</CheckedSession>;}
