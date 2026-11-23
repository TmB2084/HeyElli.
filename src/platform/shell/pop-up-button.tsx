'use client';
import {useId,useRef,useState} from 'react';
import {Button,Popover,PopoverContent,PopoverItem,PopoverSeparator,PopoverTrigger} from '@/platform/ui';
import styles from './pop-up-button.module.css';
// Popup-Knopf wie in macOS (NSPopUpButton): Kapsel mit Wert und ⌃⌄-Symbol, Menü auf der gemeinsamen
// Menüoberfläche mit Häkchen am gewählten Eintrag. Ersetzt native <select> in Werkzeug- und Listenköpfen.
export type PopUpOption={value:string;label:string;detail?:string;separatorBefore?:boolean};
export function PopUpButton({label,value,options,onChange,placeholder,iconOnly,disabled=false,icon,active,align='left',className=''}:{label:string;value:string;options:PopUpOption[];onChange:(value:string)=>void;placeholder?:string;iconOnly?:boolean;disabled?:boolean;icon?:React.ReactNode;active?:boolean;align?:'left'|'right';className?:string}){
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),list=useId();
 const current=options.find(option=>option.value===value),text=current?.label??placeholder??label;
 function choose(next:string){setOpen(false);if(next!==value)onChange(next);}
 function keys(event:React.KeyboardEvent){
  if(!open){if(['ArrowDown','ArrowUp'].includes(event.key)&&document.activeElement===trigger.current){event.preventDefault();setOpen(true);}return;}
  const items=Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role=option]')??[]);if(!items.length)return;
  const index=items.indexOf(document.activeElement as HTMLButtonElement);
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowUp'?-1:1)+items.length)%items.length;items[next]?.focus({preventScroll:true});}
  else if(event.key==='Tab')setOpen(false);
  else if(event.key.length===1&&/\S/.test(event.key)){const found=items.find((_,position)=>position>index&&options[position]?.label.toLocaleLowerCase('de').startsWith(event.key.toLocaleLowerCase('de')))??items.find((_,position)=>options[position]?.label.toLocaleLowerCase('de').startsWith(event.key.toLocaleLowerCase('de')));found?.focus({preventScroll:true});}
 }
 return <Popover open={open} onOpenChange={setOpen}><div ref={root} className={`${styles.root} ${className}`} onKeyDown={keys}>
  <PopoverTrigger asChild><Button ref={trigger} variant="outline" shape="capsule" className={styles.trigger} data-active={active||undefined} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?list:undefined} aria-label={`${label}: ${text}`} title={iconOnly?label:undefined} disabled={disabled}>
   {icon&&<span className={styles.icon} aria-hidden="true">{icon}</span>}{!iconOnly&&<span className={styles.value}>{text}</span>}
   <svg className={styles.chevrons} aria-hidden="true" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 9 4-4 4 4M8 15l4 4 4-4"/></svg>
  </Button></PopoverTrigger>
  <PopoverContent id={list} className={styles.menu} align={align==='right'?'end':'start'} scroll role="listbox" aria-label={label}
   onOpenAutoFocus={event=>{
    event.preventDefault();
    const first=root.current?.querySelector<HTMLButtonElement>('[role=option][aria-selected=true]')??root.current?.querySelector<HTMLButtonElement>('[role=option]');
    first?.focus({preventScroll:true});
   }}>
   {options.map(option=><div key={option.value} className={styles.entry}>{option.separatorBefore&&<PopoverSeparator/>}<PopoverItem role="option" aria-selected={option.value===value} onClick={()=>choose(option.value)}><span className={styles.check} aria-hidden="true">{option.value===value?'✓':''}</span>{option.detail?<span className={styles.optionLabel}>{option.label}<small data-option-detail>{option.detail}</small></span>:option.label}</PopoverItem></div>)}
  </PopoverContent>
 </div></Popover>;
}
