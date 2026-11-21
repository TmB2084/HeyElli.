'use client';
import {useEffect,useRef,useState} from 'react';
import {fileRefresh,FileFetchError} from './file-refresh';
import type {ServiceCore,ServiceFileExtras} from './model';
type FileState={key:string;core?:ServiceCore;extras?:ServiceFileExtras;error:string;extraError:string;loadingExtras:boolean};
export function useServiceFile(kind:string,id:string,refresh:number){
 const key=kind+':'+id,[state,setState]=useState<FileState>({key:'',error:'',extraError:'',loadingExtras:false});
 const heading=useRef<HTMLHeadingElement>(null),focusedKey=useRef('');
 useEffect(()=>{
  if(!kind||!id)return;
  function failed(error:FileFetchError,extra=false){
   const forbidden=error.status===401||error.status===403;
   if(forbidden)window.dispatchEvent(new Event('heyelli:session-change'));
   setState(previous=>({...(previous.key===key?previous:{key,error:'',extraError:'',loadingExtras:false}),...(forbidden||error.status===404?{core:undefined,extras:undefined}:{}),[extra?'extraError':'error']:error.message}));
  }
  const loader=fileRefresh(kind,id,{
   base:core=>{setState(previous=>{const same=previous.key===key&&previous.core?.revision===core.revision;return {key,core,extras:same?previous.extras:undefined,error:'',extraError:same?previous.extraError:'',loadingExtras:same?previous.loadingExtras:core.kind!=='customer'};});
    if(focusedKey.current!==key){focusedKey.current=key;requestAnimationFrame(()=>{if(!document.querySelector('dialog[open]'))heading.current?.focus({preventScroll:true});});}},
   extras:value=>setState(previous=>previous.key===key&&previous.core?.revision===value.revision?{...previous,extras:value.extras,extraError:''}:previous),
   error:error=>failed(error),extraError:error=>failed(error,true),
   loadingExtras:value=>setState(previous=>previous.key===key?{...previous,loadingExtras:value}:previous)
  });
  const load=()=>{if(document.visibilityState!=='hidden')void loader.refresh();};load();
  const timer=window.setInterval(load,15000);window.addEventListener('focus',load);window.addEventListener('online',load);window.addEventListener('heyelli:service-change',load);document.addEventListener('visibilitychange',load);
  return()=>{loader.dispose();window.clearInterval(timer);window.removeEventListener('focus',load);window.removeEventListener('online',load);window.removeEventListener('heyelli:service-change',load);document.removeEventListener('visibilitychange',load);};
 },[kind,id,key,refresh]);
 const current=state.key===key?state:null;
 return {current:current?.core?{...current.core,...current.extras}:null,error:current?.error??'',extraError:current?.extraError??'',extrasLoading:current?.loadingExtras??false,hasExtras:!!current?.extras,heading};
}
