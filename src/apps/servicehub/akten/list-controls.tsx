'use client';

import {useId,useRef,useState,type ReactNode,type Ref} from 'react';
import {Button,Popover,PopoverAnchor,PopoverContent,PopoverTrigger} from '@/platform/ui';
import {SideGlyph} from './side-glyph';
import styles from './workspace.module.css';

export function ServiceListHeader({title,titleRef,summary,tools,children}:{title:string;titleRef?:Ref<HTMLParagraphElement>;summary:ReactNode;tools:ReactNode;children:ReactNode}){
 return <header className={styles.splitListHeader}>
  <div className={styles.listHead}>
   <div className={styles.orderListTitle}><p className={styles.listTitle} ref={titleRef} tabIndex={titleRef?-1:undefined}>{title}</p><small>{summary}</small></div>
   {tools}
  </div>
  {children}
 </header>;
}

export function ListCategories({label,options,value,onChange}:{
 label:string;options:readonly {value:string;label:string;icon:string}[];value:string;onChange:(value:string)=>void;
}){
 return <div className={`${styles.filterChips} ${styles.listCategories}`} role="group" aria-label={label}>
  {options.map(option=>{
   const active=option.value===value;
   return <Button key={option.value} variant="filter" shape="capsule" size={active?'default':'icon'} className={styles.scopeChip}
    aria-label={option.label} title={active?undefined:option.label} aria-pressed={active} onClick={()=>onChange(option.value)}>
    <SideGlyph name={option.icon}/>{active&&option.label}
   </Button>;
  })}
 </div>;
}

export function FilterCapsule({label,configured,paused,onToggle,children}:{
 label:string;configured:boolean;paused:boolean;onToggle:(paused:boolean)=>void;children:(close:()=>void)=>ReactNode;
}){
 const [open,setOpen]=useState(false);
 const trigger=useRef<HTMLButtonElement>(null),toggle=useRef<HTMLButtonElement>(null);
 const id=useId(),active=configured&&!paused;
 return <Popover open={open} onOpenChange={setOpen}>
  <PopoverAnchor asChild><div className={styles.orderFilters} role="group" aria-label={label+'-Werkzeuge'}>
   <PopoverTrigger asChild><Button ref={trigger} className={styles.orderFilterButton} variant="ghost" size="icon" aria-label="Filteroptionen" title="Filteroptionen"
    aria-haspopup={false} aria-expanded={open} aria-controls={open?id:undefined}>
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
   </Button></PopoverTrigger>
   <Button ref={toggle} variant="ghost" size="icon" className={styles.orderFilterButton} aria-label={label} aria-pressed={active}
    title={active?label+' ausschalten':configured?label+' einschalten':'Filteroptionen öffnen'} onClick={()=>{
     if(configured){setOpen(false);onToggle(active);}
     else{setOpen(true);trigger.current?.focus();}
    }}>
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h18M6 12h12m-9 6h6"/></svg>
   </Button>
   <PopoverContent id={id} className={styles.orderFilterPanel} align="end" role="group" aria-label="Filteroptionen" onOpenAutoFocus={event=>event.preventDefault()}
    onInteractOutside={event=>{if(event.target instanceof Node&&toggle.current?.contains(event.target))event.preventDefault();}}>
    {children(()=>setOpen(false))}
   </PopoverContent>
  </div></PopoverAnchor>
 </Popover>;
}
