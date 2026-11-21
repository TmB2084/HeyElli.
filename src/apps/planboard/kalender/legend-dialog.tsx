"use client";
import {useEffect,useRef} from "react";
import {calendarLegend,completeCategoryLegend,legendGroups} from "./legend.ts";
import type {CalendarData,CalendarEvent} from "./model.ts";
export function TechnicianRoleKey({badgesVisible=true}:{badgesVisible?:boolean}) {
 return <div className="calendar-role-key" aria-label="Legende der Technikerrollen"><span><b className="calendar-role-symbol is-main" aria-hidden="true">H</b> Haupttechniker</span><span><b className="calendar-role-symbol is-companion" aria-hidden="true">B</b> Begleiter</span>{!badgesVisible&&<small>Badges sind ausgeblendet.</small>}</div>;
}
export function CalendarLegendDialog({data,events,badgesVisible,onClose}:{data:CalendarData;events:CalendarEvent[];badgesVisible:boolean;onClose:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null),entries=completeCategoryLegend(calendarLegend(events,data),data);
 useEffect(()=>{dialog.current?.showModal();},[]);
 return <dialog ref={dialog} className="calendar-legend-dialog" aria-labelledby="calendar-legend-title" onCancel={onClose}>
  <div className="dialog-heading"><h2 id="calendar-legend-title">Legende</h2><button className="heyelli-close" type="button" aria-label="Legende schließen" onClick={onClose}>×</button></div>
  <p className="calendar-legend-intro">Farben der aktuellen Kalenderauswahl und alle verfügbaren Kategorien.</p>
  <div className="calendar-legend-keys"><span><i className="calendar-legend-shape" aria-hidden="true"/> Hauptfarbe · Balken</span><span><i className="calendar-legend-shape is-secondary" aria-hidden="true"/> Nebenfarbe · Streifen</span></div>
  <TechnicianRoleKey badgesVisible={badgesVisible}/>
  {entries.length?<div className="calendar-legend-groups">{legendGroups.map(group=>{
   const values=entries.filter(entry=>entry.group===group.id);
   return values.length>0&&<section key={group.id} className="calendar-legend-group" aria-label={group.label}><h3>{group.label}</h3><ul className="calendar-legend-list">{values.map(entry=><li key={entry.key}>
    <span aria-hidden="true" title={entry.color} className={`calendar-legend-swatch ${entry.position==="Nebenfarbe"?"is-secondary":""}`} style={{background:entry.color}}/>
    <div><span className="calendar-legend-label">{entry.label}</span><div className="calendar-legend-meta"><span className={`calendar-legend-position ${entry.position==="Nebenfarbe"?"is-secondary":""}`}>{entry.position}</span></div></div>
   </li>)}</ul></section>;
  })}</div>:<p>Für diese Auswahl werden keine Termine angezeigt.</p>}
  <details className="calendar-legend-help"><summary>Hinweise zur Darstellung</summary><p>Neutral bedeutet: keine passende Hauptfarbe. Ohne passende Nebenfarbe bleibt der Streifen leer. Ein Schloss und Schraffur kennzeichnen fixierte Termine. Mehrfach zugeordnete Termine zählen einmal. Farben werden ausschließlich in den Einstellungen bearbeitet.</p></details>
  <div className="dialog-footer"><button type="button" onClick={onClose}>Schließen</button></div>
 </dialog>;
}
