'use client';
import {SettingsSearchNavigation} from './settings-search-navigation';
import {AppGlyph} from './app-glyph';
import {useEffect,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {useSearchParams} from 'next/navigation';
import {settingsLeafTitle} from './settings-pages';
import {resolveSettingsLocation} from './settings-page-model';
import {GuardedLink,useGuardedNavigation} from './navigation-guard';
import styles from './settings-workspace.module.css';
import {useAppHistory} from './use-app-history';
export type SettingsArea={id:string;label:string;group:string;icon:string;color:string;keywords:string};
const mobileQuery='(max-width: 720px)';
function subscribeMobile(change:()=>void){const media=window.matchMedia(mobileQuery);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);}
const mobileSnapshot=()=>window.matchMedia(mobileQuery).matches;
const serverMobileSnapshot=()=>false;
function SettingsIcon({name}:{name:string}){
 if(name==='elli'||name==='resource'||name==='incident'||name==='maildesk')return <AppGlyph icon={name}/>;
 if(name==='settings'||name==='user'||name==='profile')return <AppGlyph icon={name==='user'||name==='profile'?'account':'settings'}/>;
 const paths:Record<string,ReactNode>={
  profile:<><circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/></>,
  display:<><rect x="2" y="3" width="20" height="15" rx="3"/><path d="M8 22h8M12 18v4M7 7h10"/></>,
  users:<><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5"/></>,
  calendar:<><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6M17 2v6M3 11h18M8 15h2M14 15h2"/></>,
  settings:<><circle cx="12" cy="12" r="4"/><path d="m9 3 1-1h4l1 3 3 1 3 1v4l-2 2-1 3 1 3-3 2-3-1-3 1-3-1-2-3 1-3-1-3-2-2 2-3h3z"/></>,
  mail:<><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></>,
  pds:<><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><path d="M14 6h4v8M6 10v8h8"/></>,
  lock:<><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
 };
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
export function SettingsWorkspace({title,areas,groups,area,onAreaChange,children,account}:{account?:{name:string;href:string;detail:string};title:string;areas:SettingsArea[];groups:string[];area:string;onAreaChange:(area:string)=>void;children:ReactNode}){
 const [detail,setDetail]=useState(false),heading=useRef<HTMLHeadingElement>(null),content=useRef<HTMLDivElement>(null);
 const history=useAppHistory(),params=useSearchParams();
 const mobile=useSyncExternalStore(subscribeMobile,mobileSnapshot,serverMobileSnapshot);
 const initialArea=useRef(area),rawSection=params.get('bereich'),rawPage=params.get('seite'),location=resolveSettingsLocation(rawSection??area,rawPage),section=location.root,leafTitle=settingsLeafTitle(location.path,section);
 useEffect(()=>{const next=resolveSettingsLocation(rawSection??initialArea.current,rawPage);if(next.root===rawSection&&next.path===rawPage)return;if(!(rawSection==='system'&&next.root==='security'||rawSection==='maildesk'&&next.root==='graph'))return;const url=new URL(window.location.href);url.searchParams.set('bereich',next.root);if(next.path)url.searchParams.set('seite',next.path);else url.searchParams.delete('seite');window.history.replaceState(null,'',url.pathname+url.search+url.hash);},[rawSection,rawPage]);
 useEffect(()=>{const frame=requestAnimationFrame(()=>{const known=areas.some(item=>item.id===section);onAreaChange(known?section!:initialArea.current);if(known)setDetail(true);});return()=>cancelAnimationFrame(frame);},[areas,onAreaChange,section]);
 const page=location.path,person=params.get('benutzer');
 useEffect(()=>{const frame=requestAnimationFrame(()=>content.current?.scrollTo({top:0,left:0}));return()=>cancelAnimationFrame(frame);},[section,page,person]);
 const navigate=useGuardedNavigation(),selected=areas.find(item=>item.id===area)??areas[0];
 function back(){
  if(history.canGoBack){history.back();return;}
  if(mobile)navigate(()=>{setDetail(false);requestAnimationFrame(()=>document.querySelector<HTMLElement>('[data-settings-workspace] nav button[aria-pressed="true"]')?.focus({preventScroll:true}));});
 }
 function open(id:string,path:string|null=null){const url=new URL(window.location.href);url.searchParams.set('bereich',id);if(path)url.searchParams.set('seite',path);else url.searchParams.delete('seite');url.searchParams.delete('benutzer');url.searchParams.delete('rolle');url.hash='';const change=()=>{onAreaChange(id);setDetail(true);if(url.href!==window.location.href)window.history.pushState(null,'',url.pathname+url.search);requestAnimationFrame(()=>heading.current?.focus({preventScroll:true}));};if(url.href===window.location.href)change();else navigate(change);}
 return <main className={`${styles.workspace} administration-page`} data-settings-workspace data-detail={detail}>
  <aside className={styles.sidebar} aria-label={`${title} – Bereiche`}>
   <header className="sr-only"><h1>{title}</h1></header>
   <SettingsSearchNavigation title={title} areas={areas} groups={groups} area={area} onOpen={open} icon={name=><SettingsIcon name={name}/>} account={account?<GuardedLink href={account.href} className={styles.account} aria-label={`${account.name} – ${account.detail}`}><span className={styles.avatar} aria-hidden="true">{account.name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('')}</span><span className={styles.accountText}><strong>{account.name}</strong><small>{account.detail}</small></span><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg></GuardedLink>:undefined}/>
  </aside>
  <div className={styles.detail} id="settings-content" role="region" aria-label={`${selected.label} – Einstellungsbereich`}>
   <div className={styles.detailToolbar}>
   <div className={styles.detailHistory} role="group" aria-label={title==='Benutzerkonto'?'Benutzerkonto-Navigation':'Einstellungsnavigation'}><button type="button" aria-label={`In ${title} zurück`} title={mobile&&!history.canGoBack?'Zur Bereichsliste':'Zurück'} disabled={!history.canGoBack&&!mobile} onClick={back}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12 4-6 6 6 6"/></svg></button><button type="button" aria-label={`In ${title} vorwärts`} title="Vorwärts" disabled={!history.canGoForward} onClick={history.forward}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8 4 6 6-6 6"/></svg></button></div>
   <header className={styles.detailHeading}><span className={styles.detailIcon} style={{background:selected.color}}><SettingsIcon name={selected.icon}/></span><h2 ref={heading} tabIndex={-1}>{leafTitle??selected.label}</h2></header>
   </div>
   <div ref={content} className={styles.content} data-settings-scroll role="region" aria-label={`${leafTitle??selected.label} – Inhalt`} tabIndex={0}>{children}</div>
  </div>
 </main>;
}
