"use client";

import {Notice,RecordGlyph} from "@/platform/shell";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./search-picker.module.css";
import {NewPerson} from "./new-person";
import type { LookupItem } from "./model";

export type SearchItem = LookupItem & { address?: string;name?:string;customerNumber?:string;customerNumbers?:string[]; function?:string; documentUrl?:string; documentName?:string;documents?:{name:string;url:string}[];number?:string;description?:string;status?:string; phones?: {label:string; number:string}[] };
type SearchState = { key: string; items: SearchItem[]; total: number; error?: string };

function useSearch(resource: string, query: string, objectId?: string, disabled = false, attempt = 0, offset = 0, personScope = "customer", unitId = "") {
  const key = new URLSearchParams({ resource, q: query, ...(objectId ? { objectId } : {}), ...(unitId?{unitId}:{}), limit: "50", offset:String(offset),personScope }).toString();
  const [state, setState] = useState<SearchState | null>(null);
  useEffect(() => {
    if (disabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/pds-simulator?${key}`, { signal: controller.signal });
        if (!response.ok) {const failure=await response.json().catch(()=>null);throw new Error(failure?.error ?? "Suche derzeit nicht verfügbar.");}
        const result = await response.json();
        if (!controller.signal.aborted) setState({ key, items: result.items, total: result.total });
      } catch(error) {
        if (!controller.signal.aborted) setState({ key, items: [], total: 0, error: error instanceof Error && error.message !== "Failed to fetch" ? error.message : "Suche derzeit nicht erreichbar. Bitte erneut versuchen." });
      }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key, disabled, attempt]);
  return !disabled && state?.key === key ? state : null;
}

export function SearchPicker({ label, resource, objectId, selected, onChange, disabled = false, excludeIds = [], selections = [], onRemove, required = false, personScope = "customer",initialQuery="",onQueryChange }: {
  label: string; resource: "objects" | "units" | "employees" | "siteManagers" | "persons" | "customers" | "functions"; objectId?: string;
  selected: SearchItem | null; onChange: (item: SearchItem | null) => void; disabled?: boolean; excludeIds?: string[]; selections?:SearchItem[]; onRemove?:(id:string)=>void; required?:boolean;personScope?:"customer" | "all";initialQuery?:string;onQueryChange?:(value:string)=>void;
}) {
  const recordIcon=resource==="objects"?"object":resource==="units"?"unit":null;
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [attempt, setAttempt] = useState(0);
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const canSearch = !disabled && !selected && query.trim().length >= 3;
  const result = useSearch(resource, query, objectId, !canSearch, attempt, 0, personScope);
  const items = (result?.items ?? []).filter(item => !excludeIds.includes(item.id));
  function choose(item: SearchItem) { onChange(item); setQuery("");onQueryChange?.(""); setOpen(false); setActive(-1); }
  return <><div className="search-picker" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActive(-1); }
  }}>
    <label htmlFor={id}>{label}{required && <span className="required-label"> * · Pflichtfeld</span>}</label>
    <div className="selection-control">
      {[...(selected ? [selected] : []),...selections].map(item=><span className="selection-pill" key={item.id}>{recordIcon&&<RecordGlyph icon={recordIcon}/>}<span>{item.label}</span><button type="button" disabled={disabled} aria-label={`${item.label} entfernen`} onClick={()=>{
        if(selected?.id===item.id)onChange(null);else onRemove?.(item.id);
        setQuery("");onQueryChange?.("");setActive(-1);setOpen(true);requestAnimationFrame(()=>input.current?.focus());
      }}>×</button></span>)}
    <input ref={input} hidden={!!selected} id={id} role="combobox" aria-required={required} autoComplete="off" aria-autocomplete="list" aria-expanded={open && canSearch}
      aria-controls={`${id}-list`} aria-activedescendant={open && canSearch && active >= 0 && items[active] ? `${id}-${items[active].id}` : undefined}
      value={query} disabled={disabled} placeholder="Suchen und auswählen …"
      onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
      onChange={event => { onChange(null); setQuery(event.target.value.slice(0,100));onQueryChange?.(event.target.value.slice(0,100)); setOpen(true); setActive(-1); }}
      onKeyDown={event => {
        if (event.key === "Escape" && open) {event.preventDefault();event.stopPropagation();setOpen(false);setActive(-1);}
        if (canSearch && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
          event.preventDefault();setOpen(true);
          setActive(previous => event.key === "ArrowDown" ? Math.min(previous+1,items.length-1) : Math.max(previous-1,0));
        }
        if (event.key === "Enter" && open) {event.preventDefault();if (items[active]) choose(items[active]);}
      }} />
    </div>
    <small className="search-hint">{!disabled && !selected && !canSearch ? "Mindestens 3 Zeichen eingeben." : "\u00a0"}</small>
    {open && canSearch && <div className="search-popover">
      <ul id={`${id}-list`} role="listbox" aria-label={`${label} – Treffer`} className="search-results">
        {items.map((item,index) => <li id={`${id}-${item.id}`} key={item.id} role="option" aria-selected={false} className={active === index ? "active" : undefined} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(item)}><span className={styles.itemLabel}>{recordIcon&&<RecordGlyph icon={recordIcon}/>}<span>{item.label}</span></span></li>)}
      </ul>
      {result?.error?<Notice as="small" tone="error">{result.error}</Notice>:<small className={styles.resultCount} role="status">{!result ? "Wird gesucht …" : result.total ? `${result.total} Treffer${result.total > 50 ? " · Suche eingrenzen" : ""}` : "Keine Treffer. Suchbegriff ändern."}</small>}
      {result?.error && <button type="button" onClick={() => setAttempt(value => value + 1)}>Erneut suchen</button>}

    </div>}

    {!selected && query && !open && <small>Bitte einen Treffer auswählen; Suchtext ist noch keine Zuordnung.</small>}
  </div>
    {resource === "persons" && objectId && canSearch && result && !result.error && result.total === 0 &&
      <NewPerson key={`${objectId}-${query.trim()}`} objectId={objectId} initialName={query.trim()} onCreated={choose} />}
  </>;
}

export function TechnicalUnitPicker({objectId,selected,onChange,onReady}:{
  objectId:string;selected:SearchItem | null;onChange:(item:SearchItem | null)=>void;onReady:()=>void;
}) {
  const [attempt,setAttempt]=useState(0);
  const [offset,setOffset]=useState(0);
  const title=useId();
  const initialSelectionHandled=useRef(false);
  const result=useSearch("units","",objectId,!objectId,attempt,offset);
  useEffect(()=>{
    if(!result || result.error || initialSelectionHandled.current)return;
    initialSelectionHandled.current=true;
    if(result.total===1 && result.items.length===1 && !selected)onChange(result.items[0]);
    onReady();
  },[result,selected,onChange,onReady]);
  return <div className="technical-units" role="group" aria-labelledby={title}>
    <p id={title} className="technical-units-title">Technische Einheit</p>
    {selected && <div className="selection-control"><span className="selection-pill"><RecordGlyph icon="unit"/><span>{selected.label}</span><button type="button" aria-label={`${selected.label} entfernen`} onClick={()=>onChange(null)}>×</button></span></div>}
    {!objectId ? <small>Zuerst ein Objekt auswählen.</small> : !result ? <Notice tone="neutral" role="status">Technische Einheiten werden geladen …</Notice> : result.error ? <><Notice tone="error" role="alert">{result.error}</Notice><button type="button" onClick={()=>setAttempt(value=>value+1)}>Erneut laden</button></> : !result.total ? <Notice tone="neutral" role="status">Für dieses Objekt sind keine technischen Einheiten hinterlegt.</Notice> : <>
      {result.total===1 && selected ? <small>Einzige technische Einheit ausgewählt.</small> : <ul className="technical-unit-list">
        {result.items.map(item=><li key={item.id}><button type="button" aria-pressed={selected?.id===item.id} onClick={()=>onChange(item)}><span className={styles.itemLabel}><RecordGlyph icon="unit"/><span>{item.label}</span><span aria-hidden="true">{selected?.id===item.id ? "✓" : ""}</span></span></button></li>)}
      </ul>}
      {result.total>50 && <div className="incident-actions"><button type="button" disabled={offset===0} onClick={()=>setOffset(value=>Math.max(0,value-50))}>Zurück</button><small>{offset+1}–{Math.min(offset+50,result.total)} von {result.total}</small><button type="button" disabled={offset+50>=result.total} onClick={()=>setOffset(value=>value+50)}>Weitere Einheiten</button></div>}
    </>}
  </div>;
}

export function ExistingOrders({objectId,unitId}:{objectId:string;unitId:string}) {
  const [attempt,setAttempt]=useState(0),[offset,setOffset]=useState(0);
  const result=useSearch("orders","",objectId,!unitId,attempt,offset,"customer",unitId);
  return <section className="existing-orders" aria-label="Serviceaufträge zur technischen Einheit">
    <h3>Serviceaufträge zur technischen Einheit</h3>
    {!unitId?<p className="existing-orders-empty">Technische Einheit auswählen, um zugehörige Serviceaufträge zu sehen.</p>:!result?<Notice tone="neutral" role="status">Serviceaufträge werden geladen …</Notice>:result.error?<><Notice tone="error" role="alert">{result.error}</Notice><button type="button" onClick={()=>setAttempt(value=>value+1)}>Erneut laden</button></>:result.total?<>
     <ul>{result.items.map(item=><li key={item.id}><div className="existing-order-heading"><strong>{item.number??item.label}</strong>{item.status&&<span>{item.status}</span>}</div>{item.description&&<p title={item.description}>{item.description}</p>}{item.documents?.map(doc=><a key={doc.url} href={doc.url}>Grunddaten: {doc.name}</a>)}</li>)}</ul>
     {result.total>50&&<div className="incident-actions"><button type="button" disabled={!offset} onClick={()=>setOffset(value=>Math.max(0,value-50))}>Zurück</button><small>{offset+1}–{Math.min(offset+50,result.total)} von {result.total}</small><button type="button" disabled={offset+50>=result.total} onClick={()=>setOffset(value=>value+50)}>Weitere Aufträge</button></div>}
    </>:<p className="existing-orders-empty">Keine Serviceaufträge für diese technische Einheit.</p>}
  </section>;
}
