"use client";

import {Button,Input,Popover,PopoverAnchor,PopoverContent,PopoverItem} from "@/platform/ui";
import {Notice,RecordGlyph} from "@/platform/shell";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./search-picker.module.css";
import {NewPerson} from "./new-person";
import type { LookupItem } from "./model";

export type SearchItem = LookupItem & { address?: string;name?:string;customerNumber?:string;customerNumbers?:string[]; function?:string; phones?: {label:string; number:string}[] };
type SearchState = { key: string; items: SearchItem[]; total: number; error?: string };

const searchPageSize=10;
const unitPageSize=8;

function SearchPages({offset,total,size,onChange,onBeforeChange}:{offset:number;total:number;size:number;onChange:(offset:number)=>void;onBeforeChange?:()=>void}){
  if(total<=size&&!offset)return null;
  return <div className={styles.pages}>
    <Button type="button" variant="ghost" shape="capsule" disabled={!offset} onClick={()=>{onBeforeChange?.();onChange(offset-size);}}>Zurück</Button>
    <small>{offset+1}–{Math.min(offset+size,total)} von {total}</small>
    <Button type="button" variant="ghost" shape="capsule" disabled={offset+size>=total} onClick={()=>{onBeforeChange?.();onChange(offset+size);}}>Weitere Treffer</Button>
  </div>;
}

function useSearch(resource: string, query: string, objectId?: string, disabled = false, attempt = 0, offset = 0, personScope = "customer", limit=searchPageSize) {
  const key = new URLSearchParams({ resource, q: query, ...(objectId ? { objectId } : {}), limit: String(limit), offset:String(offset),personScope }).toString();
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
  const [offset,setOffset]=useState(0);
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const canSearch = !disabled && !selected && query.trim().length >= 3;
  const result = useSearch(resource, query, objectId, !canSearch, attempt, offset, personScope);
  const items = (result?.items ?? []).filter(item => !excludeIds.includes(item.id));
  function choose(item: SearchItem) { onChange(item); setQuery("");onQueryChange?.("");setOffset(0); setOpen(false); setActive(-1); }
  return <><div className="search-picker" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActive(-1); }
  }}>
    <label htmlFor={id}>{label}{required && <span className="required-label"> * · Pflichtfeld</span>}</label>
    <Popover open={open&&canSearch} onOpenChange={visible=>{setOpen(visible);if(!visible)setActive(-1);}}>
    <PopoverAnchor asChild><div className="selection-control heyelli-field">
      {[...(selected ? [selected] : []),...selections].map(item=><span className="selection-pill" key={item.id}>{recordIcon&&<RecordGlyph icon={recordIcon}/>}<span>{item.label}</span><Button type="button" variant="ghost" shape="capsule" disabled={disabled} aria-label={`${item.label} entfernen`} onClick={()=>{
        if(selected?.id===item.id)onChange(null);else onRemove?.(item.id);
        setQuery("");onQueryChange?.("");setOffset(0);setActive(-1);setOpen(true);requestAnimationFrame(()=>input.current?.focus());
      }}>×</Button></span>)}
    <Input ref={input} hidden={!!selected} id={id} role="combobox" aria-required={required} autoComplete="off" aria-autocomplete="list" aria-expanded={open && canSearch}
      aria-controls={open && canSearch ? `${id}-list` : undefined} aria-activedescendant={open && canSearch && active >= 0 && items[active] ? `${id}-${items[active].id}` : undefined}
      value={query} disabled={disabled} placeholder="Suchen und auswählen …"
      onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
      onChange={event => { onChange(null);setOffset(0); setQuery(event.target.value.slice(0,100));onQueryChange?.(event.target.value.slice(0,100)); setOpen(true); setActive(-1); }}
      onKeyDown={event => {
        if (event.key === "Escape" && open) {event.preventDefault();event.stopPropagation();setOpen(false);setActive(-1);}
        if (canSearch && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
          event.preventDefault();setOpen(true);
          setActive(previous => event.key === "ArrowDown" ? Math.min(previous+1,items.length-1) : Math.max(previous-1,0));
        }
        if (event.key === "Enter" && open) {event.preventDefault();if (items[active]) choose(items[active]);}
      }} />
    </div></PopoverAnchor>
    <small className="search-hint">{!disabled && !selected && !canSearch ? "Mindestens 3 Zeichen eingeben." : "\u00a0"}</small>
    <PopoverContent className={styles.resultsPanel} scroll role="group" aria-label={label+' – Auswahl'}
      onOpenAutoFocus={event=>event.preventDefault()} onCloseAutoFocus={event=>event.preventDefault()}
      onInteractOutside={event=>{if(event.target===input.current)event.preventDefault();}}>
      <ul id={`${id}-list`} role="listbox" aria-label={`${label} – Treffer`} className={styles.results}>
        {items.map((item,index) => <li key={item.id} role="presentation"><PopoverItem id={`${id}-${item.id}`} role="option"
          aria-selected={active===index} tabIndex={-1} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(item)}>
          <span className={styles.itemLabel}>{recordIcon&&<RecordGlyph icon={recordIcon}/>}<span>{item.label}</span></span>
        </PopoverItem></li>)}
      </ul>
      {result?.error?<Notice as="small" tone="error">{result.error}</Notice>:<small className={styles.resultCount} role="status">
        {!result?"Wird gesucht …":result.total?items.length?`${result.total} Treffer`:"Auf dieser Seite sind alle Treffer bereits zugeordnet.":"Keine Treffer. Suchbegriff ändern."}
      </small>}
      {result?.error?<Button variant="outline" shape="capsule" onClick={()=>setAttempt(value=>value+1)}>Erneut suchen</Button>:
        result&&<SearchPages offset={offset} total={result.total} size={searchPageSize} onBeforeChange={()=>input.current?.focus()}
         onChange={value=>{setOffset(value);setActive(-1);}}/>}
    </PopoverContent></Popover>

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
  const [query,setQuery]=useState("");
  const [canFilter,setCanFilter]=useState(false);
  const title=useId();
  const initialSelectionHandled=useRef(false);
  const result=useSearch("units",query,objectId,!objectId,attempt,offset,"customer",unitPageSize);
  if(!canFilter&&!query&&result&&result.total>unitPageSize)setCanFilter(true);
  useEffect(()=>{
    if(!result || result.error || initialSelectionHandled.current)return;
    initialSelectionHandled.current=true;
    if(result.total===1 && result.items.length===1 && !selected)onChange(result.items[0]);
    onReady();
  },[result,selected,onChange,onReady]);
  return <div className="technical-units" role="group" aria-labelledby={title}>
    <p id={title} className="technical-units-title">Technische Einheit</p>
    {selected && <div className="selection-control"><span className="selection-pill"><RecordGlyph icon="unit"/><span>{selected.label}</span><Button type="button" variant="ghost" shape="capsule" aria-label={`${selected.label} entfernen`} onClick={()=>onChange(null)}>×</Button></span></div>}
    {canFilter&&<Input type="search" aria-label="Technische Einheiten filtern" value={query} placeholder="Technische Einheiten filtern …" maxLength={100} onChange={event=>{
      event.stopPropagation();
      setQuery(event.currentTarget.value);
      setOffset(0);
    }}/>}
    {!objectId ? <small>Zuerst ein Objekt auswählen.</small> : !result ? <Notice tone="neutral" role="status">Technische Einheiten werden geladen …</Notice> : result.error ? <><Notice tone="error" role="alert">{result.error}</Notice><Button type="button" variant="ghost" shape="capsule" onClick={()=>setAttempt(value=>value+1)}>Erneut laden</Button></> : !result.total ? <Notice tone="neutral" role="status">{query.trim()?"Keine passenden technischen Einheiten.":"Für dieses Objekt sind keine technischen Einheiten hinterlegt."}</Notice> : <>
      {result.total===1 && selected ? <small>Einzige technische Einheit ausgewählt.</small> : <ul className="technical-unit-list">
        {result.items.map(item=><li key={item.id}><Button type="button" variant="ghost" shape="capsule" aria-pressed={selected?.id===item.id} onClick={()=>onChange(item)}><span className={styles.itemLabel}><RecordGlyph icon="unit"/><span>{item.label}</span><span aria-hidden="true">{selected?.id===item.id ? "✓" : ""}</span></span></Button></li>)}
      </ul>}
      <SearchPages offset={offset} total={result.total} size={unitPageSize} onChange={setOffset}/>
    </>}
  </div>;
}
