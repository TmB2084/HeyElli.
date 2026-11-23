'use client';
import {useCallback,useEffect,useId,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {useGuardedNavigation} from './navigation-guard';
import styles from './app-launcher.module.css';
import {PlannerGlyph} from './planner-glyph';
import {AppGlyph,appIconBackground} from './app-glyph';
import {useAppUsage} from './use-app-usage';
import {usageScore} from './app-usage-model';
import {useLauncherView} from './use-launcher-view';
import {helpMenuResults} from '@/system/hilfe/help-menu';
import {Notice} from './notice';
type Category='Service'|'System & Konto';
type Entry={category:Category;href:string;label:string;detail:string;icon:string;color:string;keywords:string};
const apps:Entry[]=[
 {category:'System & Konto',href:'/hilfe',label:'Hilfe',detail:'HeyElli verstehen',icon:'help',color:appIconBackground.help,keywords:'Anleitung Bedienung Handbuch Unterstützung'},
 {category:'Service',href:'/casedesk',label:'CaseDesk',detail:'Meldung in vier Schritten zum Auftrag',icon:'incident',color:appIconBackground.incident,keywords:'StörungsMeister Planer Störung Auftrag Kunde Serviceaufnahme'},
 {category:'Service',href:'/planboard',label:'PlanBoard',detail:'Termine und Teams disponieren',icon:'resource',color:appIconBackground.resource,keywords:'RessourcenMeister Planer Kalender Ressourcen Techniker Einsatzplanung'},
 {category:'Service',href:'/maildesk',label:'MailDesk',detail:'Geteiltes Postfach zuordnen',icon:'maildesk',color:appIconBackground.maildesk,keywords:'Mail E-Mail Postfach Posteingang Kundenpost Kostenträger zuordnen Outlook'},
 {category:'Service',href:'/taskhub',label:'TaskHub',detail:'Gemeinsame Aufgabenliste des Teams',icon:'tasks',color:appIconBackground.tasks,keywords:'Aufgaben Aufgaben To-do Erinnerungen Wiedervorlage CRM Rückruf zuweisen fällig überfällig Checkliste'},
 {category:'Service',href:'/missioncontrol',label:'MissionControl',detail:'Mein Tag, Fokus und Ziele',icon:'mission',color:appIconBackground.mission,keywords:'MissionControl Tag planen Woche planen Fokus Timer Wichtig heute Innendienst Notizen'},
 {category:'Service',href:'/dutyboard',label:'DutyBoard',detail:'Bereitschaft fair verteilen und tauschen',icon:'duty',color:appIconBackground.duty,keywords:'BereitschaftsMeister Planer Bereitschaft Feiertage Fairness Wochen'},
 {category:'Service',href:'/servicehub',label:'ServiceHub',detail:'Aufträge, Kunden, Objekte und Akten',icon:'service',color:appIconBackground.service,keywords:'Service Apps Module Übersicht Wartungen Fälligkeiten Verträge'},
 {category:'System & Konto',href:'/',label:'AskElli',detail:'Bedienhilfe im Gespräch',icon:'elli',color:appIconBackground.elli,keywords:'Frag Elli Home Anfang Start'},
 {category:'System & Konto',href:'/benutzerkonto',label:'Benutzerkonto',detail:'Profil und Anzeige',icon:'account',color:appIconBackground.account,keywords:'Persönlich Benutzer Rolle Mitarbeiter Darstellung Hell Dunkel'},
];
const settings:Entry={category:'System & Konto',href:'/einstellungen',label:'Einstellungen',detail:'HeyElli verwalten',icon:'settings',color:appIconBackground.settings,keywords:'Verwaltung System Administration'};
const subareas:Entry[]=[
 {category:'System & Konto',href:'/benutzerkonto?bereich=tools',label:'Werkzeuge',detail:'Benutzerkonto',icon:'settings',color:appIconBackground.settings,keywords:'Tools Menüleiste CaseDesk einblenden ausblenden'},
 {category:'System & Konto',href:'/benutzerkonto?bereich=account&seite=account:profile',label:'Mein Profil',detail:'Benutzerkonto',icon:'account',color:appIconBackground.account,keywords:'Benutzer Rolle Mitarbeiter Zuordnung'},
 {category:'System & Konto',href:'/benutzerkonto?bereich=account&seite=account:display',label:'Anzeige',detail:'Benutzerkonto',icon:'display',color:'#558cd7',keywords:'Hell Dunkel Darstellung Erscheinungsbild Gerät'},
];
const adminAreas:Entry[]=[
 {category:'System & Konto',href:'/einstellungen?bereich=sharepoint',label:'SharePoint',detail:'Einstellungen · Integrationen',icon:'plug',color:'#198b8f',keywords:'Microsoft Dokumente Bibliothek Dateien Upload Ablage'},
 {category:'System & Konto',href:'/einstellungen?bereich=users&seite=users:roles',label:'Rollen & App-Zugriffe',detail:'Einstellungen · Benutzer & Zugriff',icon:'user',color:appIconBackground.account,keywords:'Rolleneditor eigene Rollen Berechtigungen Apps Zugriff Zuordnung'},
 {category:'System & Konto',href:'/einstellungen?bereich=elli',label:'AskElli',detail:'Einstellungen · Rückmeldungen',icon:'elli',color:appIconBackground.elli,keywords:'Apps Bewertungen Daumen Rückmeldungen'},
 {category:'System & Konto',href:'/einstellungen?bereich=system&seite=system:info',label:'Info',detail:'Einstellungen · Allgemein',icon:'settings',color:appIconBackground.settings,keywords:'HeyElli Version Veröffentlichung Techstack Module'},
 {category:'System & Konto',href:'/einstellungen?bereich=users',label:'Benutzer & Zugriff',detail:'Einstellungen',icon:'user',color:'#558cd7',keywords:'Rollen Mitarbeiter Sitzungen Protokoll Zuordnung'},
 {category:'System & Konto',href:'/einstellungen?bereich=colors&seite=resources:colors',label:'Kalenderfarben',detail:'Einstellungen · PlanBoard',icon:'calendar',color:appIconBackground.resource,keywords:'Kategorie Status Farben Farbreihenfolge Anzeigevorgaben'},
 {category:'System & Konto',href:'/einstellungen?bereich=system',label:'Allgemein',detail:'Einstellungen · System',icon:'settings',color:appIconBackground.settings,keywords:'System Darstellung Info Version'},
 {category:'System & Konto',href:'/einstellungen?bereich=security',label:'Sicherheit',detail:'Einstellungen · System',icon:'lock',color:'#cc565b',keywords:'Sitzungsdauer Zugangsdaten Geheimnisse Browser Schutz Datenschutz Aufbewahrung Betriebsstatus Alarme Überwachung'},
 {category:'System & Konto',href:'/einstellungen?bereich=email',label:'E-Mail',detail:'Einstellungen · Organisation',icon:'mail',color:'#448fce',keywords:'Outlook Microsoft Graph MS365 Postfach Versand Warteschlange'},
 {category:'System & Konto',href:'/einstellungen?bereich=pds',label:'PDS-Anbindung',detail:'Einstellungen',icon:'plug',color:'#df9250',keywords:'Verbindung API Simulator Datenansichten Bearbeiter'},
 {category:'System & Konto',href:'/einstellungen?bereich=microsoft-auth',label:'Microsoft-Anmeldung',detail:'Einstellungen',icon:'lock',color:'#5baf9c',keywords:'Entra OAuth Anmeldung Freigabe'},
];
const normalize=(text:string)=>text.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('de');
function Icon({name}:{name:string}){
 if(name==='user')return <AppGlyph icon="account"/>;
 if(name==='incident'||name==='resource'||name==='duty'||name==='elli'||name==='account'||name==='settings'||name==='help'||name==='service'||name==='maildesk'||name==='tasks'||name==='mission')return <AppGlyph icon={name}/>;
 if(name==='clipboard'||name==='calendar'||name==='moon')return <PlannerGlyph icon={name==='clipboard'?'incident':name==='calendar'?'resource':'duty'}/>;
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  {name==='briefcase'?<><rect x="3" y="6" width="18" height="15" rx="3"/><path d="M8 6V3h8v3M3 12h18M10 12v3h4v-3"/></>:name==='home'?<><path d="m3 10 9-7 9 7M5 9v12h14V9M10 21v-7h4v7"/></>:name==='user'?<><circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/></>:name==='mail'?<><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></>:name==='plug'?<><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><path d="M14 6h4v8M6 10v8h8"/></>:name==='lock'?<><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>:name==='display'?<><rect x="2" y="3" width="20" height="15" rx="3"/><path d="M8 22h8M12 18v4"/></>:<><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></>}
 </svg>;
}
export function AppLauncher(){
 const {usage,reload:reloadUsage}=useAppUsage();
 const {view,ready,busy,error,reload,change}=useLauncherView();
 const [allowedApps,setAllowedApps]=useState<string[]>([]);
 const [copilotActive,setCopilotActive]=useState(false);
 const [category,setCategory]=useState<Category|'Alle'>('Alle');
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0),[admin,setAdmin]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null),trigger=useRef<HTMLButtonElement>(null),request=useRef<AbortController|null>(null);
 const id=useId(),router=useRouter(),navigate=useGuardedNavigation();
 const close=useCallback(()=>{request.current?.abort();dialog.current?.close();setOpen(false);trigger.current?.focus({preventScroll:true});},[]);
 const launch=useCallback(()=>{
  if(document.querySelector('dialog[open]')||trigger.current?.closest<HTMLElement>('[data-session-view]')?.hidden)return;
  void reload();void reloadUsage();setQuery('');setCategory('Alle');setActive(0);setAdmin(false);setAllowedApps([]);setOpen(true);request.current?.abort();const controller=new AbortController();request.current=controller;setCopilotActive(false);
  void fetch('/api/assistent/status',{cache:'no-store',signal:controller.signal}).then(async response=>{const value=await response.json();if(!controller.signal.aborted)setCopilotActive(response.ok&&value.provider==='copilot'&&value.enabled===true);}).catch(()=>{});
  void fetch('/api/simulator-session',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])}).then(async response=>{if(!response.ok)return;const value=await response.json();if(!controller.signal.aborted){setAdmin(value.authenticated&&value.user?.role==='admin');setAllowedApps(value.allowedApps??[]);}}).catch(()=>{/* Server checks remain authoritative; only common destinations are shown. */});
 },[reload,reloadUsage]);
 useEffect(()=>{
  if(!open)return;
  const panel=dialog.current,logo=trigger.current;if(!panel||!logo)return;
  panel.showModal();
  const position=()=>{
   const anchor=logo.getBoundingClientRect(),width=panel.getBoundingClientRect().width;
   const top=anchor.bottom+6,left=Math.max(10,Math.min(anchor.left,window.innerWidth-width-10));
   panel.style.left=`${left}px`;panel.style.top=`${top}px`;
   panel.style.maxHeight=`${Math.max(0,window.innerHeight-top-10)}px`;
  };
  position();input.current?.focus();window.addEventListener('resize',position);
  return()=>window.removeEventListener('resize',position);
 },[open]);
 useEffect(()=>{const shortcut=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&!event.altKey&&event.key.toLowerCase()==='k'){event.preventDefault();if(dialog.current?.open)close();else launch();}};const dismiss=()=>{if(dialog.current?.open)close();};window.addEventListener('keydown',shortcut);window.addEventListener('heyelli:session-change',dismiss);window.addEventListener('popstate',dismiss);document.addEventListener('visibilitychange',dismiss);return()=>{window.removeEventListener('keydown',shortcut);window.removeEventListener('heyelli:session-change',dismiss);window.removeEventListener('popstate',dismiss);document.removeEventListener('visibilitychange',dismiss);request.current?.abort();};},[close,launch]);
 const available=[...apps,...(admin?[settings]:[])].filter(item=>allowedApps.includes(item.href)),terms=normalize(query).trim().split(/\s+/).filter(Boolean);
 const score=(item:Entry)=>{const title=normalize(item.label),text=terms.join(' ');return title===text?3:title.startsWith(text)?2:terms.every(term=>title.includes(term))?1:0;};
 const matches=terms.length?[...available,...subareas,...(admin?adminAreas:[])].filter(item=>terms.every(term=>normalize(`${item.label} ${item.detail} ${item.category} ${item.keywords}`).includes(term))).sort((a,b)=>score(b)-score(a)||usageScore(b.href,usage)-usageScore(a.href,usage)):[...available].sort((a,b)=>usageScore(b.href,usage)-usageScore(a.href,usage));
 const helpMatches:Entry[]=terms.length?helpMenuResults(query,copilotActive,admin).map(item=>({...item,category:['service','stoerung','ressourcen','bereitschaft'].includes(item.topicId)?'Service':'System & Konto',icon:'help',color:appIconBackground.help,keywords:''})):[];
 const categories:('Alle'|Category)[]=['Alle',...new Set(available.map(item=>item.category))];
 const results=[...matches,...helpMatches].filter(item=>allowedApps.includes(item.href.split(/[?#]/)[0])).filter(item=>category==='Alle'||item.category===category);
 const selected=Math.min(active,Math.max(0,results.length-1));
 useEffect(()=>{if(open)document.getElementById(`${id}-result-${selected}`)?.scrollIntoView({block:'nearest'});},[id,open,selected]);
 function choose(item:Entry){const target=new URL(item.href,window.location.href),same=target.href===window.location.href;close();if(!same)navigate(()=>router.push(item.href));}
 return <>
  <button ref={trigger} type="button" className={`${styles.logo} platform-wordmark`} aria-label="HeyElli – Apps und Navigation öffnen" aria-haspopup="dialog" aria-expanded={open} title="Apps und Bereiche suchen (⌘/Strg K)" onClick={launch}>Hey<span>Elli</span><span className="brand-dot" aria-hidden="true">.</span></button>
  <dialog ref={dialog} className={`${styles.dialog} heyelli-menu-surface`} aria-label="HeyElli Apps und Suche" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===dialog.current){const rect=dialog.current.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();}}}>
   <div className={`${styles.search} heyelli-field`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg><input ref={input} type="search" role="combobox" aria-label="Apps und Bereiche suchen" aria-expanded={open} aria-controls={`${id}-results`} aria-autocomplete="list" aria-activedescendant={results.length?`${id}-result-${selected}`:undefined} placeholder="Apps und Bereiche suchen" value={query} onChange={event=>{setQuery(event.target.value);setActive(0);}} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setActive(value=>results.length?(value+(event.key==='ArrowDown'?1:-1)+results.length)%results.length:0);}else if(event.key==='Enter'){event.preventDefault();if(results[selected])choose(results[selected]);}}}/><div className={styles.viewSwitch} role="group" aria-label="Menüansicht">
    <button type="button" aria-label="Rasteransicht" title="Rasteransicht" aria-pressed={view==='grid'} disabled={!ready||busy} onClick={()=>void change('grid')}><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="12" y="3" width="5" height="5" rx="1"/><rect x="3" y="12" width="5" height="5" rx="1"/><rect x="12" y="12" width="5" height="5" rx="1"/></svg></button>
    <button type="button" aria-label="Listenansicht" title="Listenansicht" aria-pressed={view==='list'} disabled={!ready||busy} onClick={()=>void change('list')}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5h10M7 10h10M7 15h10M3 5h.1M3 10h.1M3 15h.1"/></svg></button>
   </div><button type="button" aria-label="Navigation schließen" onClick={close}>×</button></div>
   <fieldset className={styles.categories}><legend className="sr-only">App-Kategorie</legend>{categories.map(value=><label key={value}><input type="radio" className="sr-only" name={`${id}-category`} value={value} checked={category===value} aria-controls={`${id}-results`} onChange={()=>{setCategory(value);setActive(0);}}/><span>{value}</span></label>)}</fieldset>
   <div className={styles.body}><Notice tone="error">{error}</Notice><div id={`${id}-results`} role="listbox" aria-label="Navigationsziele" className={view==='list'?styles.results:styles.apps}>
    {results.map((item,index)=><button type="button" role="option" aria-selected={selected===index} id={`${id}-result-${index}`} key={item.href} tabIndex={-1} onPointerMove={event=>{if(event.pointerType==='mouse'&&(event.movementX||event.movementY))setActive(index);}} onClick={()=>choose(item)}><span className={styles.icon} style={{background:item.color}}><Icon name={item.icon}/></span><span className={styles.itemText}><strong>{item.label}</strong><small>{item.detail}</small></span>{query&&view==='list'&&<span className={styles.enter} aria-hidden="true">↵</span>}</button>)}
   </div>{!results.length&&<p className={styles.empty} role="status">Keine passenden Apps oder Bereiche{category==='Alle'?'.':' in dieser Kategorie.'}</p>}</div>
   <footer className={styles.footer}><span><kbd>↑↓</kbd> auswählen</span><span><kbd>↵</kbd> öffnen</span><span><kbd>⌘K</kbd> Spotlight</span><span><kbd>esc</kbd> schließen</span></footer>
  </dialog>
 </>;
}
