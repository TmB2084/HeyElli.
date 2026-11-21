'use client';
import {useEffect,useEffectEvent,type RefObject} from 'react';
/** Non-modal disclosure: Escape returns to trigger; Tab may leave without trapping. */
export function usePopoverFocus({open,busy=false,step='',panel,trigger,onClose}:{open:boolean;busy?:boolean;step?:string;panel:RefObject<HTMLElement|null>;trigger:RefObject<HTMLElement|null>;onClose:()=>void}){
 const close=useEffectEvent(onClose);
 useEffect(()=>{if(!open)return;const node=panel.current;if(!node)return;
  const frame=requestAnimationFrame(()=>{(node.querySelector<HTMLElement>('[data-popover-focus]:not(:disabled)')??node.querySelector<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href]')??node).focus({preventScroll:true});});
  return()=>cancelAnimationFrame(frame);
 },[open,step,panel]);
 useEffect(()=>{if(!open)return;
  function key(event:KeyboardEvent){if(event.key!=='Escape')return;if(!panel.current?.contains(event.target as Node)&&event.target!==trigger.current)return;event.preventDefault();event.stopPropagation();if(busy)return;close();trigger.current?.focus({preventScroll:true});}
  function outside(event:PointerEvent|FocusEvent){if(busy||panel.current?.contains(event.target as Node)||trigger.current?.contains(event.target as Node))return;close();}
  document.addEventListener('keydown',key,true);document.addEventListener('pointerdown',outside);document.addEventListener('focusin',outside);
  return()=>{document.removeEventListener('keydown',key,true);document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',outside);};
 },[open,busy,panel,trigger]);
}
