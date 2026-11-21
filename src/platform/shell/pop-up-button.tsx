'use client';
import {useEffect,useId,useRef,useState} from 'react';
import styles from './pop-up-button.module.css';
// Popup-Knopf wie in macOS (NSPopUpButton): Kapsel mit Wert und ⌃⌄-Symbol, Menü auf der gemeinsamen
// Menüoberfläche mit Häkchen am gewählten Eintrag. Ersetzt native <select> in Werkzeug- und Listenköpfen.
export type PopUpOption={value:string;label:string;separatorBefore?:boolean};
export function PopUpButton({label,value,options,onChange,placeholder,disabled=false,icon,active,align='left',className=''}:{label:string;value:string;options:PopUpOption[];onChange:(value:string)=>void;placeholder?:string;disabled?:boolean;icon?:React.ReactNode;active?:boolean;align?:'left'|'right';className?:string}){
 const [open,setOpen]=useState(false),[flip,setFlip]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),list=useId();
 const current=options.find(option=>option.value===value),text=current?.label??placeholder??label;
 useEffect(()=>{if(!open)return;const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target))setOpen(false);};document.addEventListener('pointerdown',outside);
  // Menü bleibt im Fenster: ragt es rechts hinaus, richtet es sich am rechten Rand des Knopfs aus.
  const menu=root.current?.querySelector<HTMLElement>('[role=listbox]');if(menu&&align==='left'){const box=menu.getBoundingClientRect();setFlip(box.right>window.innerWidth-8);}
  const first=root.current?.querySelector<HTMLButtonElement>('[role=option][aria-selected=true]')??root.current?.querySelector<HTMLButtonElement>('[role=option]');first?.focus({preventScroll:true});
  return()=>document.removeEventListener('pointerdown',outside);},[open,align]);
 function choose(next:string){setOpen(false);trigger.current?.focus({preventScroll:true});if(next!==value)onChange(next);}
 function keys(event:React.KeyboardEvent){
  if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();setOpen(false);trigger.current?.focus({preventScroll:true});return;}
  if(!open){if(['ArrowDown','ArrowUp'].includes(event.key)&&document.activeElement===trigger.current){event.preventDefault();setOpen(true);}return;}
  const items=Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role=option]')??[]);if(!items.length)return;
  const index=items.indexOf(document.activeElement as HTMLButtonElement);
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowUp'?-1:1)+items.length)%items.length;items[next]?.focus({preventScroll:true});}
  else if(event.key==='Tab')setOpen(false);
  else if(event.key.length===1&&/\S/.test(event.key)){const found=items.find((item,position)=>position>index&&item.textContent?.trim().toLocaleLowerCase('de').startsWith(event.key.toLocaleLowerCase('de')))??items.find(item=>item.textContent?.trim().toLocaleLowerCase('de').startsWith(event.key.toLocaleLowerCase('de')));found?.focus({preventScroll:true});}
 }
 return <div ref={root} className={`${styles.root} ${className}`} onKeyDown={keys}>
  <button ref={trigger} type="button" className={styles.trigger} data-active={active||undefined} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?list:undefined} aria-label={`${label}: ${text}`} disabled={disabled} onClick={()=>setOpen(state=>!state)}>
   {icon&&<span className={styles.icon} aria-hidden="true">{icon}</span>}<span className={styles.value}>{text}</span>
   <svg className={styles.chevrons} aria-hidden="true" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 9 4-4 4 4M8 15l4 4 4-4"/></svg>
  </button>
  {open&&<div id={list} className={`${styles.menu} heyelli-command-menu heyelli-menu-surface`} data-align={flip?'right':align} role="listbox" aria-label={label}>
   {options.map(option=><div key={option.value} className={styles.entry}>{option.separatorBefore&&<div role="separator" className="heyelli-menu-separator"/>}<button type="button" role="option" aria-selected={option.value===value} onClick={()=>choose(option.value)}><span className={styles.check} aria-hidden="true">{option.value===value?'✓':''}</span>{option.label}</button></div>)}
  </div>}
 </div>;
}
