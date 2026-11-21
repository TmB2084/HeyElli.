 'use client';
import {useEffect,useId,useMemo,useRef,useState,type ReactNode} from 'react';
import {searchSettings,settingsSearchIndex,type SettingsSearchEntry,type SearchArea} from './settings-search';
import styles from './settings-workspace.module.css';
export function SettingsSearchNavigation({areas,groups,area,title,onOpen,icon,account}:{areas:SearchArea[];groups:string[];area:string;title:string;onOpen:(area:string,path?:string|null)=>void;icon:(name:string)=>ReactNode;account?:ReactNode}){
 const [query,setQuery]=useState(''),[active,setActive]=useState(0),input=useRef<HTMLInputElement>(null),highlight=useRef<HTMLButtonElement>(null),id=useId();
 const index=useMemo(()=>settingsSearchIndex(areas),[areas]),results=searchSettings(index,query),searching=!!query.trim(),selected=Math.min(active,Math.max(0,results.length-1));
 useEffect(()=>{if(searching)highlight.current?.scrollIntoView({block:'nearest'});},[selected,query,searching]);
 function clear(){setQuery('');setActive(0);input.current?.focus();}
 function choose(entry:SettingsSearchEntry){onOpen(entry.area,entry.path);}
 return <>
  <div className={styles.search} role="search" aria-label={`${title} durchsuchen`}>
   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg>
   <input ref={input} type="search" role="combobox" aria-label="Einstellungen suchen" placeholder="Einstellungen suchen" autoComplete="off" spellCheck={false} value={query} aria-expanded={searching} aria-controls={searching?`${id}-results`:undefined} aria-autocomplete="list" aria-activedescendant={searching&&results.length?`${id}-result-${selected}`:undefined} onChange={event=>{setQuery(event.target.value);setActive(0);}} onKeyDown={event=>{
    if(event.nativeEvent.isComposing)return;
    if(searching&&(event.key==='ArrowDown'||event.key==='ArrowUp')){event.preventDefault();setActive((selected+(event.key==='ArrowDown'?1:-1)+results.length)%Math.max(1,results.length));}
    else if(searching&&event.key==='Enter'){event.preventDefault();if(results[selected])choose(results[selected]);}
    else if(searching&&event.key==='Escape'){event.preventDefault();event.stopPropagation();clear();}
   }}/>
   {query&&<button className={styles.searchClear} type="button" aria-label="Suche löschen" title="Suche löschen" onClick={clear}><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m5 5 6 6m0-6-6 6"/></svg></button>}
  </div>
  {!searching&&account}
  <nav className={styles.sidebarNavigation} aria-label={`${title} – Navigation`}>
   {searching?<><p className={styles.searchCount} role="status" aria-live="polite">{results.length?`${results.length} Treffer`:'Keine passenden Einstellungen gefunden.'}</p>
   <div id={`${id}-results`} role="listbox" aria-label="Gefundene Einstellungsfunktionen" className={styles.searchResults}>{results.map((entry,index)=><button ref={index===selected?highlight:undefined} id={`${id}-result-${index}`} key={entry.id} type="button" role="option" aria-selected={index===selected} tabIndex={-1} className={styles.searchResult} onMouseEnter={()=>setActive(index)} onClick={()=>choose(entry)}>
    <span className={styles.navIcon} style={{background:entry.color}}>{icon(entry.icon)}</span><span className={styles.searchResultText}><span>{entry.label}</span><small>{entry.breadcrumb}</small></span><svg className={styles.chevron} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg>
   </button>)}</div></>:groups.map(group=>{const items=areas.filter(item=>item.group===group);return items.length>0&&<section className={styles.navGroup} key={group}><h2>{group}</h2><div>{items.map(item=><button type="button" key={item.id} aria-pressed={area===item.id} aria-controls="settings-content" onClick={()=>onOpen(item.id)}><span className={styles.navIcon} style={{background:item.color}}>{icon(item.icon)}</span><span>{item.label}</span><svg className={styles.chevron} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg></button>)}</div></section>;})}
  </nav>
 </>;
}
