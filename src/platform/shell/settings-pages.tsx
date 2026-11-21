'use client';
import {useSearchParams} from 'next/navigation';
import {useGuardedNavigation} from './navigation-guard';
import styles from './settings-workspace.module.css';
import {settingsPages,parseSettingsPath,type SettingsPageKey} from './settings-page-model';
export {settingsLeafTitle} from './settings-page-model';
export function useSettingsPage(namespace:SettingsPageKey,root:string,enabled=true){
 const params=useSearchParams(),parts=parseSettingsPath(root,params.get('seite')),index=parts.findIndex(part=>part.startsWith(namespace+':'));
 const raw=index<0?'':parts[index].slice(namespace.length+1);
 const value=enabled&&settingsPages[namespace].some(([id])=>id===raw)?raw:'';
 function select(next:string){
  const url=new URL(window.location.href),tokens=parseSettingsPath(root,url.searchParams.get('seite')),position=tokens.findIndex(part=>part.startsWith(namespace+':'));
  const prefix=position<0?tokens:tokens.slice(0,position);
  const path=[...prefix,...(next?[`${namespace}:${next}`]:[])].join('/');
  url.searchParams.delete('benutzer');url.searchParams.set('bereich',root);if(path)url.searchParams.set('seite',path);else url.searchParams.delete('seite');
  if(url.href!==window.location.href)window.history.pushState(null,'',url.pathname+url.search+url.hash);
 }
 return {value,select,leaf:index===parts.length-1};
}
export function SettingsPages({namespace,value,onChange,parent,disabled=false,items,counts={}}:{namespace:SettingsPageKey;value:string;onChange:(value:string)=>void;parent:string;disabled?:boolean;items?:string[][];counts?:Record<string,number>}){
 const navigate=useGuardedNavigation();
 if(value)return null;
 return <nav className={styles.pageList} aria-label={`${parent} – Unterbereiche`}>{(items??settingsPages[namespace]).map(([id,label])=><button type="button" key={id} disabled={disabled} onClick={()=>navigate(()=>onChange(id))}><span>{label}</span>{counts[id]!==undefined&&<small>{counts[id]}</small>}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg></button>)}</nav>;
}
