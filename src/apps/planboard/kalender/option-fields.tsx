"use client";
import {Notice} from "@/platform/shell";
import {useId,useState,type CSSProperties} from "react";
import {addDays,berlinWall,wallInstant,statusLabels,type CalendarColor,type CalendarOptions,type CalendarCategory} from "./domain";
import {ReferencePicker} from "./reference-picker";
export function CalendarOptionFields({value,onChange,start,end,onStart,onEnd,categories,colors=[],disabled=false,fixedDisabled=disabled,onFixedChange,location}:{value:CalendarOptions;onChange:(value:CalendarOptions)=>void;start:string;end:string;onStart:(value:string)=>void;onEnd:(value:string)=>void;categories:CalendarCategory[];colors?:CalendarColor[];disabled?:boolean;fixedDisabled?:boolean;onFixedChange?:(fixed:boolean)=>void;location?:string}){
 const pimHint=useId();
 const [error,setError]=useState("");const [objectLabel,setObjectLabel]=useState(location??value.objectId??"");
 const duty=categories.some(category=>category.name.trim().toLocaleLowerCase('de')==='bereitschaft'&&value.categories?.includes(category.id));
 const duration=(()=>{try{return Math.round((Date.parse(wallInstant(end))-Date.parse(wallInstant(start)))/60000);}catch{return 0;}})();
 function wholeDay(checked:boolean){onChange({...value,allDay:checked});if(checked){const day=start.slice(0,10),until=end.slice(0,10);onStart(day+"T00:00");onEnd((until>day?until:addDays(day,1))+"T00:00");}}
 return <>
  <fieldset className="calendar-edit-group"><legend>Zeit &amp; Status</legend>
  <div className="calendar-option-grid">
   <label>Anzeigen als<select disabled={disabled||duty} value={duty?"FREI":value.status??"GEPLANT"} onChange={event=>onChange({...value,status:event.target.value as CalendarOptions["status"]})}>{Object.entries(statusLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   <label className="calendar-checkbox"><input type="checkbox" className="heyelli-switch" role="switch" checked={value.allDay??false} disabled={disabled} onChange={event=>wholeDay(event.target.checked)}/>Ganzer Tag</label>
   <label className="calendar-checkbox"><input type="checkbox" className="heyelli-switch" role="switch" checked={value.fixed??false} disabled={fixedDisabled} onChange={event=>onFixedChange?onFixedChange(event.target.checked):onChange({...value,fixed:event.target.checked})}/>Fixiert</label>
   <label className="calendar-checkbox"><input type="checkbox" className="heyelli-switch" role="switch" aria-label="PIM-Synchronisation" aria-describedby={pimHint} checked={value.pimSync??false} disabled={disabled} onChange={event=>onChange({...value,pimSync:event.target.checked})}/>PIM-Synchronisation<span id={pimHint} className="sr-only">Erfordert eine eingerichtete PDS-Synchronisation.</span></label>
  </div>
  <div className="calendar-option-grid calendar-time-fields">
   <label>Beginn<input type={value.allDay?"date":"datetime-local"} required disabled={disabled} value={value.allDay?start.slice(0,10):start} onChange={event=>onStart(value.allDay?event.target.value+"T00:00":event.target.value)}/></label>
   <label>{value.allDay?"Enddatum (ausschließlich)":"Ende"}<input type={value.allDay?"date":"datetime-local"} required disabled={disabled} value={value.allDay?end.slice(0,10):end} onChange={event=>onEnd(value.allDay?event.target.value+"T00:00":event.target.value)}/></label>
  {value.allDay?<small>Der Termin endet um 00:00 Uhr am gewählten Enddatum.</small>:<label>Dauer (Minuten)<input type="number" min={15} max={89280} step={1} value={duration||""} disabled={disabled} onChange={event=>{try{const minutes=Number(event.target.value);if(!Number.isInteger(minutes)||minutes<15||minutes>89280){setError("Mindestens 15 Minuten, maximal 62 Tage.");return;}onEnd(berlinWall(new Date(Date.parse(wallInstant(start))+minutes*60000).toISOString()));setError("");}catch(problem){setError(problem instanceof Error?problem.message:"Datum prüfen.");}}}/></label>}
  </div>
  {error&&<Notice as="small" tone="error" role="alert">{error}</Notice>}
  </fieldset>
  <fieldset className="calendar-edit-group calendar-category-group"><legend>Kategorien</legend><div className="calendar-category-choices">{categories.length?categories.map(category=><label key={category.id} className="calendar-category-choice" data-colored={colors.some(rule=>rule.category===category.id&&!rule.orderType)} style={{"--category-color":colors.find(rule=>rule.category===category.id&&!rule.orderType)?.farbe} as CSSProperties}><input type="checkbox" className="heyelli-switch" role="switch" disabled={disabled} checked={value.categories?.includes(category.id)??false} onChange={event=>onChange({...value,categories:event.target.checked?[...new Set([...(value.categories??[]),category.id])]:(value.categories??[]).filter(id=>id!==category.id),...(event.target.checked&&category.name.trim().toLocaleLowerCase("de")==="bereitschaft"?{status:"FREI" as const}:{})})}/><span className="calendar-category-dot" aria-hidden="true"/><span>{category.name}</span>{category.allDay&&<small>Ganztags</small>}</label>):<small>Keine Kategorien verfügbar.</small>}</div></fieldset>
  <details className="calendar-section"><summary>Einsatzort und Anschrift</summary>
   <ReferencePicker label="Objekt / technische Einheit" kind="OBJEKT" disabled={disabled} selected={value.objectId?{id:value.objectId,label:objectLabel||value.objectId}:null} onChange={reference=>{setObjectLabel(reference?.label??"");onChange({...value,objectId:reference?.id??""});}}/>
   <ReferencePicker label="PDS-Anschrift" kind="ANSCHRIFT" disabled={disabled} selected={value.address?{id:value.address.urPostkommunikationswegUUID,label:[value.address.name,value.address.strasse,value.address.plz,value.address.ort].filter(Boolean).join(" · ")||value.address.urPostkommunikationswegUUID}:null} onChange={reference=>onChange({...value,address:reference?.address})}/>
   {value.address&&<div className="calendar-option-grid">{([['name','Name'],['strasse','Straße'],['plz','PLZ'],['ort','Ort'],['land','Land'],['zusatz','Zusatz']] as const).map(([key,label])=><label key={key}>{label}<input maxLength={300} value={value.address?.[key]??""} disabled={disabled} onChange={event=>onChange({...value,address:{...value.address!,[key]:event.target.value}})}/></label>)}</div>}
   <small>Änderungen gelten für die Terminanschrift. Kunden-/Objektstammdaten bleiben erhalten.{value.objectId?" Das verknüpfte Serviceobjekt wird dadurch nicht umgeschrieben.":""}</small>
  </details>
 </>;
}
