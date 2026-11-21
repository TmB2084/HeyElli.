"use client";
import {useId,useRef,useState} from "react";
import type {Resource} from "./domain";
type Common={resources:Resource[];disabled:boolean;labelOverride?:string};
export function CompanionPicker({resources,mainId,selected,onChange,disabled}:Common&{mainId:string;selected:string[];onChange:(ids:string[])=>void}){
  return <TechnicianPicker resources={resources} excludedIds={[mainId]} selected={selected} onChange={onChange} disabled={disabled} kind="companions"/>;
}
export function MainTechnicianPicker({resources,companionIds,selected,onChange,disabled,labelOverride}:Common&{companionIds:string[];selected:string;onChange:(id:string)=>void}){
  return <TechnicianPicker resources={resources} excludedIds={companionIds} selected={selected?[selected]:[]} onChange={ids=>onChange(ids[0]??"")} disabled={disabled} labelOverride={labelOverride} kind="main"/>;
}
export function ResourcePicker({resources,selected,onChange,disabled}:Common&{selected:string[];onChange:(ids:string[])=>void}){
  return <TechnicianPicker resources={resources} excludedIds={[]} selected={selected} onChange={onChange} disabled={disabled} kind="resources"/>;
}
function TechnicianPicker({resources,excludedIds,selected,onChange,disabled,kind,labelOverride}:Common&{excludedIds:string[];selected:string[];onChange:(ids:string[])=>void;kind:"main"|"companions"|"resources"}){
  const single=kind==="main",required=kind!=="companions";
  const id=useId(),input=useRef<HTMLInputElement>(null);
  const [query,setQuery]=useState(""),[open,setOpen]=useState(false),[active,setActive]=useState(-1);
  const label=labelOverride??(single?"Haupttechniker · PDS-Mobilität":kind==="resources"?"Ressourcen":"Begleitende Techniker");
  const roleName=single?"Haupttechniker":kind==="resources"?"Ressource":"Begleiter";
  const searchable=query.trim().length>=3&&(!single||!selected.length);
  const choices=resources.filter(item=>!excludedIds.includes(item.id)&&!selected.includes(item.id)&&`${item.name} ${item.number} ${item.group}`.toLocaleLowerCase("de").includes(query.trim().toLocaleLowerCase("de")));
  function choose(resource:Resource){onChange(single?[resource.id]:[...selected,resource.id]);setQuery("");setActive(-1);if(single)setOpen(false);else input.current?.focus();}
  function remove(value:string){onChange(selected.filter(item=>item!==value));setQuery("");setActive(-1);setOpen(true);requestAnimationFrame(()=>input.current?.focus());}
  return <div className="search-picker" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget)){setOpen(false);setActive(-1);}}}>
    <label htmlFor={id}>{label}{required&&<span className="required-label"> * · Pflichtfeld</span>}</label>
    <div className="selection-control">
      {selected.map(value=><span className="selection-pill" key={value}><span>{resources.find(item=>item.id===value)?.name??value}</span><button type="button" disabled={disabled} aria-label={`${resources.find(item=>item.id===value)?.name??value} als ${roleName} entfernen`} onClick={()=>remove(value)}>×</button></span>)}
      <input ref={input} id={id} role="combobox" hidden={single&&selected.length>0} aria-required={required} aria-autocomplete="list" aria-expanded={open&&searchable&&!disabled} aria-controls={`${id}-results`} aria-activedescendant={open&&searchable&&choices[active]?`${id}-${choices[active].id}`:undefined} value={query} disabled={disabled} autoComplete="off" placeholder={kind==="resources"?"Ressourcen suchen …":"Techniker suchen …"} onFocus={()=>setOpen(true)} onChange={event=>{setQuery(event.target.value.slice(0,100));setActive(-1);setOpen(true);}} onKeyDown={event=>{
        if(event.key==="Escape"&&open){event.preventDefault();event.stopPropagation();setOpen(false);}
        if(searchable&&["ArrowDown","ArrowUp"].includes(event.key)){event.preventDefault();setOpen(true);setActive(value=>event.key==="ArrowDown"?Math.min(value+1,choices.length-1):Math.max(value-1,0));}
        if(event.key==="Enter"){event.preventDefault();if(open&&searchable&&choices[active])choose(choices[active]);}
      }}/>
    </div>
    <small>{single?(selected.length?"Haupttechniker gewählt. Mit × ersetzen.":"Bitte Haupttechniker wählen. Suche ab drei Zeichen."):kind==="resources"?`${selected.length?`${selected.length} ${selected.length===1?"Ressource":"Ressourcen"} ausgewählt.`:"Bitte mindestens eine Ressource wählen."} Ab drei Zeichen suchen; mit × entfernen.`:`${selected.length?`${selected.length} Begleiter ausgewählt.`:"Keine Begleiter eingeplant."} Ab drei Zeichen suchen; mit × entfernen.`}</small>
    {open&&searchable&&!disabled&&<div className="search-popover"><ul id={`${id}-results`} role="listbox" aria-label={`${label} – Treffer`} className="search-results">{choices.map((item,index)=><li key={item.id} id={`${id}-${item.id}`} role="option" aria-selected={false} className={active===index?"active":undefined} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(item)}>{item.name} · {item.number}</li>)}</ul>{!choices.length&&<small>Keine weiteren passenden Ressourcen.</small>}</div>}
  </div>;
}
