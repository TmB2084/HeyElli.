"use client";
import {useEffect,useId,useRef,useState} from "react";
import type {Resource,ResourceGroup} from "./domain";
export function ResourceSelectionDialog({resources,groups,selected,onCancel,onApply}:{resources:Resource[];groups:ResourceGroup[];selected:string[]|null;onCancel:()=>void;onApply:(ids:string[]|null)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),id=useId(),[all,setAll]=useState(selected===null),[ids,setIds]=useState<string[]>(selected??resources.map(resource=>resource.id)),[query,setQuery]=useState("");
 useEffect(()=>{dialog.current?.showModal();dialog.current?.querySelector<HTMLInputElement>("input")?.focus();},[]);
 const chosen=all?resources.map(resource=>resource.id):ids,needle=query.trim().toLocaleLowerCase("de"),visible=resources.filter(resource=>needle.length<3||`${resource.name} ${resource.number} ${resource.group}`.toLocaleLowerCase("de").includes(needle));
 function toggle(values:string[],checked:boolean){const next=new Set(chosen);for(const value of values){if(checked)next.add(value);else next.delete(value);}setAll(false);setIds([...next]);}
 function groupRow(key:string,name:string,members:Resource[]){const selectedCount=members.filter(resource=>chosen.includes(resource.id)).length,checked=members.length>0&&selectedCount===members.length;return <label className="calendar-selection-item" key={key}><input type="checkbox" className="heyelli-switch" disabled={!members.length} checked={checked} ref={element=>{if(element)element.indeterminate=selectedCount>0&&!checked;}} onChange={event=>toggle(members.map(resource=>resource.id),event.target.checked)}/><span>{name}<small>{selectedCount} / {members.length} Ressourcen ausgewählt</small></span></label>;}
 const missing=ids.filter(value=>!resources.some(resource=>resource.id===value)).length;
 return <dialog ref={dialog} className="calendar-edit-dialog calendar-resource-selection" aria-labelledby={id} onCancel={event=>{event.preventDefault();onCancel();}}>
  <div className="dialog-heading"><h2 id={id}>Ressourcen auswählen</h2><button className="heyelli-close" type="button" aria-label="Dialog schließen" onClick={onCancel}>×</button></div>
  <p>Gruppen gemeinsam auswählen oder Mitarbeiter einzeln ein- und ausblenden.</p>
  <div className="calendar-selection-actions"><button type="button" className="skip-planning-button" onClick={()=>{setAll(true);setIds(resources.map(resource=>resource.id));}}>Alle Ressourcen</button><button type="button" className="skip-planning-button" onClick={()=>{setAll(false);setIds([]);}}>Keine auswählen</button><span>{resources.filter(resource=>chosen.includes(resource.id)).length} / {resources.length} ausgewählt</span></div>
  <div className="calendar-type-layout">
   <section aria-label="Ressourcengruppen"><h3>Ressourcengruppen</h3><div className="calendar-selection-list">{groups.map(group=>groupRow(group.id,group.name,resources.filter(resource=>resource.groupIds?.includes(group.id))))}{resources.some(resource=>!resource.groupIds?.length)&&groupRow("ungrouped","Ohne Gruppe",resources.filter(resource=>!resource.groupIds?.length))}</div>{!groups.length&&<p>Keine Ressourcengruppen verfügbar.</p>}</section>
   <section aria-label="Einzelne Ressourcen"><h3>Mitarbeiter</h3><label>Ressourcen suchen<input type="search" placeholder="Name, Personalnummer oder Gruppe" value={query} onChange={event=>setQuery(event.target.value.slice(0,120))}/></label>{needle.length>0&&needle.length<3&&<small>Suche ab drei Zeichen.</small>}<div className="calendar-selection-list">{visible.map(resource=><label className="calendar-selection-item" key={resource.id}><input type="checkbox" className="heyelli-switch" role="switch" checked={chosen.includes(resource.id)} onChange={event=>toggle([resource.id],event.target.checked)}/><span>{resource.name}<small>{resource.number} · {resource.group}</small></span></label>)}</div>{!visible.length&&<p>Keine passenden Ressourcen gefunden.</p>}</section>
  </div>
  {!all&&missing>0&&<p>{missing} ausgewählte Ressourcen sind im aktuellen Zeitraum nicht planbar. Die Auswahl bleibt beim Zeitraumwechsel erhalten.</p>}
  <div className="discard-dialog-actions"><button type="button" className="skip-planning-button" onClick={onCancel}>Abbrechen</button><button type="button" onClick={()=>onApply(all?null:ids)}>Auswahl übernehmen</button></div>
 </dialog>;
}
