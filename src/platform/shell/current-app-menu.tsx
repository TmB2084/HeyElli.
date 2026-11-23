"use client";
import {appReleases,defaultAppRelease,platformRelease} from './app-releases';
import {appHelpHref} from './app-help';
import {AppGlyph,appIconBackground} from './app-glyph';
import {useEffect,useRef,useState} from "react";
import {Dropdown} from "./dropdown";
import {GuardedLink} from "./navigation-guard";
import styles from "./current-app-menu.module.css";

type AppInfo={name:string;description:string;settings?:string;adminSettings?:boolean;icon?:"incident"|"resource"|"duty"|"elli"|"account"|"settings"|"help"|"service"|"maildesk"|"tasks"|"mission"};
const apps:Record<string,AppInfo>={
  "/start":{name:"HeyElli",description:"Deine freigegebenen Apps auf einen Blick."},
  "/":{name:"AskElli",icon:"elli",description:"Bedienhilfe im Gespräch: Fragen zu HeyElli stellen und direkt zum richtigen Bedienweg springen."},
  "/hilfe":{name:"Hilfe",icon:"help",description:"Bedienungsanleitung nach Apps und Themen durchsuchen."},
  "/servicehub":{name:"ServiceHub",icon:"service",description:"Aufträge, Kunden, Objekte und Akten: der zentrale Bestand mit Cockpit, Kundenakte und Kunde 360."},
  "/casedesk":{name:"CaseDesk",icon:"incident",description:"Meldung in vier Schritten zum Auftrag: Objekt, Meldung und Kontakt, Techniker und Termin, Abschluss.",settings:"/einstellungen?bereich=incident",adminSettings:true},
  "/planboard":{name:"PlanBoard",icon:"resource",description:"Termine und Teams disponieren: Techniker einplanen, Auslastung überblicken und Serviceaufträge mobil ausgeben.",settings:"/einstellungen?bereich=colors",adminSettings:true},
  "/maildesk":{name:"MailDesk",icon:"maildesk",description:"Geteiltes Service-Postfach: Mails automatisch Kunden zuordnen, beantworten und daraus Serviceaufträge anlegen."},
  "/taskhub":{name:"TaskHub",icon:"tasks",description:"Gemeinsame Aufgabenliste des Teams: PDS-Aufgaben, zugewiesene Mails und Aufträge ohne Termin zuweisen und abarbeiten."},
  "/missioncontrol":{name:"MissionControl",icon:"mission",description:"Mein Tag, Fokus und Ziele: Wichtiges zuerst einplanen, fokussiert arbeiten und Teamziele verfolgen."},
  "/dutyboard":{name:"DutyBoard",icon:"duty",description:"Bereitschaft fair verteilen und tauschen: Jahresüberblick, automatische Verteilung und Tauschwünsche."},
  "/benutzerkonto":{name:"Benutzerkonto",icon:"account",description:"Dein Profil und deine persönlichen Anzeigeeinstellungen.",settings:"/benutzerkonto?bereich=account&seite=account:display"},
  "/einstellungen":{name:"Einstellungen",icon:"settings",description:"Benutzer, PlanBoard, Systemvorgaben und Integrationen zentral verwalten."},
};
function PlannerIcon({icon}:{icon:NonNullable<AppInfo["icon"]>}){
 return <span className={`${styles.appIcon} ${styles[icon]??''}`} aria-hidden="true" style={{background:appIconBackground[icon]}}><AppGlyph icon={icon}/></span>;
}

export function CurrentAppMenu({pathname}:{pathname:string}){
  const app=apps[pathname]??Object.entries(apps).filter(([path])=>path!=="/"&&pathname.startsWith(path+"/")).sort(([a],[b])=>b.length-a.length)[0]?.[1]??{name:"HeyElli",description:"Deine Serviceplattform."};
  const release=pathname==='/start'?platformRelease:appReleases[pathname]??Object.entries(appReleases).filter(([path])=>path!=='/'&&pathname.startsWith(path+'/')).sort(([a],[b])=>b.length-a.length)[0]?.[1]??defaultAppRelease;
  const publishedOn=new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date(release.publishedOn+'T00:00:00Z'));
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLDivElement>(null);
  const [admin,setAdmin]=useState(false);
  useEffect(()=>{
    if(!app.adminSettings)return;
    let active=true;const controller=new AbortController();
    async function refresh(){try{const response=await fetch("/api/simulator-session",{cache:"no-store",signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});const result=response.ok?await response.json():null;if(active)setAdmin(!!result?.authenticated&&result?.user?.role==="admin");}catch{if(active)setAdmin(false);}}
    void refresh();window.addEventListener("focus",refresh);window.addEventListener("heyelli:session-change",refresh);
    return()=>{active=false;controller.abort();window.removeEventListener("focus",refresh);window.removeEventListener("heyelli:session-change",refresh);};
  },[app.adminSettings]);
  function closeMenu(){const details=trigger.current?.querySelector("details");if(details)details.open=false;}
  return <div ref={trigger} className={styles.root}>
    <Dropdown ariaLabel={`${app.name} – App-Menü`} label={<><span className={styles.menuIcon} aria-hidden="true" title={app.name}>{app.icon?<AppGlyph icon={app.icon}/>:"H"}</span><span className={styles.name}>{app.name}</span><span className={styles.chevron} aria-hidden="true">⌄</span></>}>
      <div className={`platform-popover heyelli-command-menu ${styles.menu}`}>
        <button type="button" onClick={()=>{closeMenu();dialog.current?.showModal();}}>Über {app.name} …</button>
        <hr className="heyelli-menu-separator"/>
        {app.settings&&(!app.adminSettings||admin)&&<><GuardedLink href={app.settings} onClick={closeMenu}>Einstellungen …</GuardedLink><hr className="heyelli-menu-separator"/></>}
        <GuardedLink href={appHelpHref(pathname)} onClick={closeMenu}>Hilfe</GuardedLink>
      </div>
    </Dropdown>
    <dialog ref={dialog} className={styles.about} aria-labelledby="current-app-about-title" onClick={event=>{if(event.target===event.currentTarget){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.currentTarget.close();}}} onClose={()=>trigger.current?.querySelector("summary")?.focus({preventScroll:true})}>
      <form method="dialog" className={styles.closeForm}><button className={`${styles.closeButton} heyelli-close`} aria-label="Über-Dialog schließen" title="Schließen"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button></form>
      {app.icon&&<PlannerIcon icon={app.icon}/>}
      <h2 id="current-app-about-title">{app.name}</h2>
      <p>{app.description}</p>
      <p className={styles.version}>Version {release.year}.{release.publication}</p>
      <dl className={styles.release}><div><dt>Veröffentlichung</dt><dd>{publishedOn}</dd></div><div><dt>Ersteller</dt><dd>{release.creator}</dd></div></dl>
      <span className={styles.brand} aria-label="HeyElli">Hey<span>Elli</span>.</span>
    </dialog>
  </div>;
}
