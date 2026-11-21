"use client";
import {AlertDialog} from "./alert-dialog";
import {Notice} from "./notice";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ComponentProps,type ReactNode} from "react";
import {flushSync} from "react-dom";
type DraftGuard={busy:boolean;discard:()=>void;safeToReload?:()=>boolean};
type GuardContext={register:(guard:DraftGuard)=>()=>void;request:(navigate:()=>void)=>void;canGoBack:boolean;canGoForward:boolean;back:()=>void;forward:()=>void};
const Context=createContext<GuardContext|null>(null);
function useGuard(){const context=useContext(Context);if(!context)throw new Error("Navigationsschutz fehlt.");return context;}
export function useDraftNavigationGuard(active:boolean,busy:boolean,discard:()=>void,safeToReload?:()=>boolean){
  const {register}=useGuard();
  useEffect(()=>{if(active)return register({busy,discard,safeToReload});},[active,busy,discard,register,safeToReload]);
}
export function useGuardedNavigation(){return useGuard().request;}
export function useHistoryNavigation(){const {canGoBack,canGoForward,back,forward}=useGuard();return {canGoBack,canGoForward,back,forward};}
type GuardedLinkProps=Omit<ComponentProps<typeof Link>,"href">&{href:string};
export function GuardedLink({onNavigate,...props}:GuardedLinkProps){
  const request=useGuardedNavigation();const router=useRouter();
  return <Link {...props} data-navigation-guard="true" onNavigate={event=>{
    let cancelled=false;onNavigate?.({preventDefault:()=>{cancelled=true;event.preventDefault();}});
    if(cancelled)return;
    const target=new URL(props.href,window.location.href);
    if(target.pathname===window.location.pathname&&target.search===window.location.search)return;
    event.preventDefault();request(()=>router.push(target.pathname+target.search+target.hash));
  }}/>;
}
export function NavigationGuardProvider({children}:{children:ReactNode}){
  const guard=useRef<DraftGuard|null>(null),pending=useRef<(()=>void)|null>(null);
  const trigger=useRef<HTMLElement|null>(null),dialog=useRef<HTMLDialogElement>(null);
  const [busy,setBusy]=useState(false);
  const [historyAvailability,setHistoryAvailability]=useState({back:false,forward:false});
  const traverse=useRef<(direction:number)=>void>(()=>{});
  function notifyTool(active:boolean){if(window.parent!==window&&location.pathname==='/werkzeuge/casedesk')window.parent.postMessage({type:'heyelli:tool-draft',dirty:active,reloadSafe:active&&!!guard.current?.safeToReload?.()},location.origin);}
  const register=useCallback((value:DraftGuard)=>{guard.current=value;notifyTool(true);if(dialog.current?.open)setBusy(value.busy);return ()=>{if(guard.current===value){guard.current=null;queueMicrotask(()=>{if(!guard.current)notifyTool(false);});if(dialog.current?.open)setBusy(false);}};},[]);
  const request=useCallback((navigate:()=>void)=>{
    if(!guard.current){navigate();return;}
    if(dialog.current?.open)return;
    trigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    pending.current=navigate;setBusy(guard.current.busy);dialog.current?.showModal();
  },[]);
  const keep=()=>{
    dialog.current?.close();pending.current=null;
    const element=trigger.current,details=element?.closest("details");
    if(details&&!details.open)details.querySelector("summary")?.focus();else element?.focus();
  };
  function discardAndLeave(){
    const current=guard.current;if(current?.busy)return;
    const navigate=pending.current;pending.current=null;guard.current=null;dialog.current?.close();
    // Reset before navigating so the router cannot restore an abandoned draft from its cache.
    if(current)flushSync(()=>current.discard());
    navigate?.();
  }
  useEffect(()=>{
    let sessionInvalid=false;
    // A revoked/expired session must reach login even with an unsaved form.
    function invalidateSession(){sessionInvalid=true;}
    function toolReload(event:KeyboardEvent){if(guard.current&&!guard.current.safeToReload?.()&&window.parent!==window&&location.pathname==='/werkzeuge/casedesk'&&(((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='r')||event.key==='F5')){event.preventDefault();window.parent.postMessage({type:'heyelli:tool-reload-request'},location.origin);}}
    window.addEventListener('keydown',toolReload,true);
    function toolState(event:MessageEvent){if(event.origin===location.origin&&event.source===window.parent&&event.data?.type==='heyelli:tool-state-request')notifyTool(!!guard.current);}
    const draftState=()=>notifyTool(!!guard.current);window.addEventListener('heyelli:tool-draft-state',draftState);window.addEventListener('message',toolState);
    function beforeUnload(event:BeforeUnloadEvent){if(guard.current&&!guard.current.safeToReload?.()&&!sessionInvalid){event.preventDefault();event.returnValue="";}}
    function plainLink(event:MouseEvent){
      if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||!(event.target instanceof Element))return;
      const anchor=event.target.closest<HTMLAnchorElement>("a[href]");
      if(!anchor||anchor.dataset.navigationGuard||anchor.hasAttribute("download")||(anchor.target&&anchor.target!=="_self"))return;
      const url=new URL(anchor.href,location.href);if(!["http:","https:"].includes(url.protocol))return;
      if(url.origin===location.origin&&url.pathname===location.pathname&&url.search===location.search)return;
      if(!guard.current)return;
      event.preventDefault();event.stopImmediatePropagation();request(()=>location.assign(url.href));
    }
    window.addEventListener("heyelli:session-invalid",invalidateSession);window.addEventListener("beforeunload",beforeUnload);document.addEventListener("click",plainLink,true);
    return ()=>{window.removeEventListener("heyelli:tool-draft-state",draftState);window.removeEventListener("keydown",toolReload,true);window.removeEventListener("message",toolState);window.removeEventListener("heyelli:session-invalid",invalidateSession);window.removeEventListener("beforeunload",beforeUnload);document.removeEventListener("click",plainLink,true);};
  },[request]);
  useEffect(()=>{
    // Keep an index alongside Next's state, preserving all framework-owned fields.
    // A blocked browser Back/Forward is restored before Next processes popstate.
    const key="__heyElliHistoryIndex",rangeKey=window.parent===window?"heyelli:history-range":`heyelli:history-range:embedded:${location.pathname}`;
    const tracked=Number.isSafeInteger(history.state?.[key]);
    let index=tracked?history.state[key]:0,minimum=index,maximum=index;
    try{const saved=JSON.parse(sessionStorage.getItem(rangeKey)??'null');if(tracked&&Number.isSafeInteger(saved?.minimum)&&Number.isSafeInteger(saved?.maximum)&&saved.minimum<=index&&saved.maximum>=index){minimum=saved.minimum;maximum=saved.maximum;}}catch{/* Memory-only navigation still works when browser storage is unavailable. */}
    let currentURL=location.href,restoring=false,moving=false,active=true;
    let retry:(()=>void)|null=null;
    let settle:ReturnType<typeof setTimeout>|undefined,paint:number|undefined;
    function notify(){if(!active)return;try{sessionStorage.setItem(rangeKey,JSON.stringify({minimum,maximum}));}catch{/* Optional persistence. */}cancelAnimationFrame(paint??0);paint=requestAnimationFrame(()=>{if(active)setHistoryAvailability({back:!moving&&index>minimum,forward:!moving&&index<maximum});});}
    const originalPush=history.pushState,originalReplace=history.replaceState;
    const state=(data:unknown,value:number)=>({...((data&&typeof data==="object")?data:{}),[key]:value});
    originalReplace.call(history,state(history.state,index),"",location.href);
    const initial=requestAnimationFrame(notify);
    // Next may retain a wrapper across effect cleanup; retired wrappers must pass state through unchanged.
    const push:History["pushState"]=(data,unused,url)=>{if(!active){originalPush.call(history,data,unused,url);return;}originalPush.call(history,state(data,index+1),unused,url);index++;maximum=index;moving=false;clearTimeout(settle);currentURL=location.href;notify();};
    const replace:History["replaceState"]=(data,unused,url)=>{if(!active){originalReplace.call(history,data,unused,url);return;}originalReplace.call(history,state(data,index),unused,url);currentURL=location.href;notify();};
    history.pushState=push;history.replaceState=replace;
    traverse.current=direction=>{if(moving||direction<0&&index<=minimum||direction>0&&index>=maximum)return;request(()=>{moving=true;notify();history.go(direction);settle=setTimeout(()=>{moving=false;notify();},1500);});};
    function pop(event:PopStateEvent){
      moving=false;clearTimeout(settle);
      if(restoring){event.stopImmediatePropagation();restoring=false;notify();const navigate=retry;retry=null;if(navigate)request(navigate);return;}
      const destination=Number.isSafeInteger(event.state?.[key])?Number(event.state[key]):index-1;
      const from=new URL(currentURL),to=new URL(location.href);
      // Settings sections use the query string, so they receive the same draft protection.
      if(window.parent===window&&guard.current&&(from.pathname!==to.pathname||from.search!==to.search)){
        const delta=destination-index;
        if(delta){event.stopImmediatePropagation();restoring=true;retry=()=>history.go(delta);history.go(-delta);return;}
      }
      index=destination;minimum=Math.min(minimum,index);maximum=Math.max(maximum,index);currentURL=location.href;notify();
    }
    window.addEventListener("popstate",pop,true);
    return ()=>{active=false;cancelAnimationFrame(initial);cancelAnimationFrame(paint??0);clearTimeout(settle);traverse.current=()=>{};window.removeEventListener("popstate",pop,true);if(history.pushState===push)history.pushState=originalPush;if(history.replaceState===replace)history.replaceState=originalReplace;};
  },[request]);
  const value=useMemo(()=>({register,request,canGoBack:historyAvailability.back,canGoForward:historyAvailability.forward,back:()=>traverse.current(-1),forward:()=>traverse.current(1)}),[register,request,historyAvailability]);
  return <Context.Provider value={value}>{children}<AlertDialog dialogRef={dialog} title="Eingaben verwerfen?" description="Ungespeicherte Eingaben werden zurückgesetzt und der gewählte Bereich geöffnet. Bereits gespeicherte Daten bleiben erhalten." onCancel={event=>{event.preventDefault();keep();}} actions={<><button type="button" autoFocus onClick={keep}>Weiter bearbeiten</button><button type="button" data-primary="true" disabled={busy} onClick={discardAndLeave}>Eingaben verwerfen</button></>}>
    {busy&&<Notice tone="neutral" role="status">Bitte warten, bis der Upload oder Speichervorgang abgeschlossen ist.</Notice>}
  </AlertDialog></Context.Provider>;
}
