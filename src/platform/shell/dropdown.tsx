"use client";
import {useEffect,useRef,type ReactNode} from "react";
export function Dropdown({label,children,className="",ariaLabel}:{label:ReactNode;children:ReactNode;className?:string;ariaLabel?:string}) {
  const ref=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{
    function outside(event:PointerEvent){if(event.target instanceof Node && !ref.current?.contains(event.target) && ref.current)ref.current.open=false;}
    function escape(event:KeyboardEvent){if(event.key==="Escape" && ref.current?.open){ref.current.open=false;ref.current.querySelector("summary")?.focus();}}
    document.addEventListener("pointerdown",outside);document.addEventListener("keydown",escape);
    return ()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape);};
  },[]);
  return <details ref={ref} className={`platform-dropdown ${className}`} onToggle={event=>{
    if(!event.currentTarget.open)return;
    for(const other of document.querySelectorAll<HTMLDetailsElement>(".platform-dropdown[open]"))if(other!==event.currentTarget)other.open=false;
    event.currentTarget.querySelector<HTMLInputElement>("input")?.focus();
  }} onKeyDown={event=>{const node=ref.current;if(!node)return;const summary=node.querySelector('summary');if(event.key==='ArrowDown'||event.key==='ArrowUp'){const items=Array.from(node.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled)'));if(!items.length)return;event.preventDefault();node.open=true;const index=items.indexOf(document.activeElement as HTMLElement);const next=index<0?(event.key==='ArrowDown'?0:items.length-1):(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus({preventScroll:true});}else if(event.key==='Tab'&&event.shiftKey&&event.target===summary)node.open=false;}} onBlur={event=>{if(event.relatedTarget instanceof Node&&!event.currentTarget.contains(event.relatedTarget))event.currentTarget.open=false;}}><summary aria-label={ariaLabel}>{label}</summary>{children}</details>;
}
