"use client";
import {useHistoryNavigation} from "./navigation-guard";
import {usePathname} from "next/navigation";
import {useEffect,useState} from "react";
import {AppLauncher} from "./app-launcher";
import {AppearanceSettings} from "../../system/benutzerkonto/appearance-settings";
import {MenuTools} from './menu-tools';
import {UserMenu} from "./user-menu";
import {CurrentAppMenu} from "./current-app-menu";
function Clock(){
  const [now,setNow]=useState<Date|null>(null);
  useEffect(()=>{const update=()=>setNow(new Date());update();const timer=setInterval(update,1000);return ()=>clearInterval(timer);},[]);
  return <time className="platform-clock" dateTime={now?.toISOString()} aria-label="Aktuelles Datum und Uhrzeit in Deutschland" title="Deutsche Ortszeit · Europe/Berlin">
    <span>{now?new Intl.DateTimeFormat("de-DE",{timeZone:"Europe/Berlin",weekday:"short",day:"2-digit",month:"2-digit",year:"numeric"}).format(now):"Datum wird geladen"}</span>
    <span className="clock-time">{now?new Intl.DateTimeFormat("de-DE",{timeZone:"Europe/Berlin",hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(now):"--:--:--"}</span>
  </time>;
}
export function PlatformBar(){
  const pathname=usePathname();
  const {canGoBack,canGoForward,back,forward}=useHistoryNavigation();
  return <header className="platform-bar">
    <a className="skip-navigation" href="#platform-content">Zum Inhalt</a>
    <div className="platform-bar-inner">
      <div className="platform-bar-left">
        <AppLauncher/>
        <div className="platform-history" role="group" aria-label="Navigationsverlauf"><button className="platform-icon-button" type="button" aria-label="Zurück" title="Zurück" disabled={!canGoBack} onClick={back}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg></button><button className="platform-icon-button" type="button" aria-label="Vorwärts" title="Vorwärts" disabled={!canGoForward} onClick={forward}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 5 7 7-7 7"/></svg></button></div>
        <CurrentAppMenu key={pathname} pathname={pathname}/>
      </div>
      <Clock/>
      <div className="platform-bar-settings"><AppearanceSettings/><MenuTools/><UserMenu/></div>
    </div>
  </header>;
}
