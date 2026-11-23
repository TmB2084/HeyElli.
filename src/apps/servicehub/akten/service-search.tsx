'use client';

import {useId,useRef,useState,type ComponentProps,type KeyboardEvent,type Ref} from 'react';
import {Button,Input,Popover,PopoverAnchor,PopoverContent,PopoverItem} from '@/platform/ui';
import {FileActionIcon} from './file-action-icon';
import styles from './workspace.module.css';

type Suggestion={id:string;title:string;description?:string;icon:ComponentProps<typeof FileActionIcon>['icon']};
type Props<T extends Suggestion>={
 value:string;
 label?:string;
 selectFirstOnEnter?:boolean;
 suggestions:T[];
 rootRef:Ref<HTMLDivElement>;
 onChange:(value:string)=>void;
 onSelect:(suggestion:T)=>void;
};

function SearchIcon(){
 return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></svg>;
}

export function ServiceSearch<T extends Suggestion>({value,label="Suche",selectFirstOnEnter=false,suggestions,rootRef,onChange,onSelect}:Props<T>){
 const input=useRef<HTMLInputElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const listId=useId();
 const [open,setOpen]=useState<boolean|null>(null);
 const [showSuggestions,setShowSuggestions]=useState(false);
 const [choice,setChoice]=useState(-1);
 const expanded=open??Boolean(value);
 const showList=expanded&&showSuggestions&&suggestions.length>0;
 const active=choice<suggestions.length?choice:-1;

 function choose(suggestion:T){
  setShowSuggestions(false);
  setChoice(-1);
  onSelect(suggestion);
 }

 function handleKeys(event:KeyboardEvent<HTMLInputElement>){
  if(event.nativeEvent.isComposing)return;
  if(event.key==='Escape'){
   event.preventDefault();
   event.stopPropagation();
   if(showList){setShowSuggestions(false);setChoice(-1);}
   else{setOpen(false);requestAnimationFrame(()=>trigger.current?.focus());}
  }else if(suggestions.length&&(event.key==='ArrowDown'||event.key==='ArrowUp')){
   event.preventDefault();
   setShowSuggestions(true);
   const step=event.key==='ArrowDown'?1:-1;
   setChoice(active===-1?(step===1?0:suggestions.length-1):(active+step+suggestions.length)%suggestions.length);
  }else if(event.key==='Enter'&&showList&&(active>=0||selectFirstOnEnter)){
   event.preventDefault();
   choose(suggestions[Math.max(0,active)]);
  }
 }

 return <Popover open={showList} onOpenChange={visible=>{setShowSuggestions(visible);if(!visible)setChoice(-1);}}><PopoverAnchor asChild><div className={styles.toolbarSearch} ref={rootRef} data-expanded={expanded||undefined} onBlur={event=>{
  if(!event.currentTarget.contains(event.relatedTarget)){setShowSuggestions(false);setChoice(-1);}
 }}>
  {!expanded?<Button ref={trigger} variant="outline" size="icon" shape="capsule" className={styles.sideTool}
   aria-label="Suche öffnen" title={value?`Aktive Suche: ${value}`:'Suche öffnen'} aria-expanded={false}
   data-query={value?true:undefined} onClick={()=>{setOpen(true);requestAnimationFrame(()=>input.current?.focus());}}><SearchIcon/></Button>:
   <div className={`${styles.toolbarSearchField} heyelli-field`}>
    <SearchIcon/>
    <Input ref={input} type="search" role="combobox" aria-label={label} placeholder={label==='Suche'?'Suchen':label}
     aria-autocomplete="list" aria-expanded={showList} aria-controls={showList?listId:undefined}
     aria-activedescendant={showList&&active>=0?`${listId}-${active}`:undefined} value={value}
     onFocus={()=>{setOpen(true);setShowSuggestions(true);}} onKeyDown={handleKeys}
     onChange={event=>{setChoice(-1);setShowSuggestions(true);onChange(event.target.value);}}/>
    {value&&<Button variant="ghost" size="icon" shape="capsule" title="Suche leeren" aria-label="Suche leeren"
     onClick={()=>{onChange('');setChoice(-1);input.current?.focus();}}>×</Button>}
   </div>}
  <PopoverContent id={listId} role="listbox" aria-label="Suchvorschläge" align="end" scroll className={styles.toolbarSearchList}
   onOpenAutoFocus={event=>event.preventDefault()} onCloseAutoFocus={event=>event.preventDefault()}
   onEscapeKeyDown={event=>{if(event.target===input.current)event.preventDefault();}}
   onInteractOutside={event=>{if(event.target===input.current)event.preventDefault();}}>
   {suggestions.map((suggestion,index)=><PopoverItem key={`${suggestion.icon}:${suggestion.id}`} id={`${listId}-${index}`}
    role="option" tabIndex={-1} aria-selected={index===active}
    onPointerDown={event=>event.preventDefault()} onClick={()=>choose(suggestion)}>
     <FileActionIcon icon={suggestion.icon}/><span><strong>{suggestion.title}</strong>{suggestion.description&&<small>{suggestion.description}</small>}</span>
   </PopoverItem>)}
  </PopoverContent>
 </div></PopoverAnchor></Popover>;
}
