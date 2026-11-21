"use client";
import {useEffect} from 'react';
// The mobile app itself is unchanged. Only shell-level close/restart actions
// are bridged; messages never carry data or grant business permissions.
export function ToolFrameBoundary(){
 useEffect(()=>{
  if(window.parent===window)return;
  // A tool has no second menu bar/theme controller. Follow its host's display.
  const host=window.parent.document.documentElement;
  const theme=()=>{document.documentElement.dataset.theme=host.dataset.theme==='light'?'light':'dark';};
  theme();const observer=new MutationObserver(theme);observer.observe(host,{attributes:true,attributeFilter:['data-theme']});
  const close=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.defaultPrevented&&!document.querySelector('dialog[open]'))window.parent.postMessage({type:'heyelli:tool-close'},location.origin);};
  const restart=(event:MouseEvent)=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||!(event.target instanceof Element))return;const anchor=event.target.closest<HTMLAnchorElement>('a[href]');if(anchor&&new URL(anchor.href).origin===location.origin&&new URL(anchor.href).pathname==='/casedesk'){event.preventDefault();const target=new URL('/werkzeuge/casedesk',location.origin);location.replace(target.href);}};
  window.addEventListener('keydown',close);document.addEventListener('click',restart);
  return()=>{observer.disconnect();window.removeEventListener('keydown',close);document.removeEventListener('click',restart);};
 },[]);return null;
}
