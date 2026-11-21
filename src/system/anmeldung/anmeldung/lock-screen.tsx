'use client';
import {useEffect,useState,type ReactNode} from 'react';
import styles from './lock-screen.module.css';

// Anmeldebildschirm im Stil des macOS-Sperrbildschirms (CI-/UI-Leitfaden, Abschnitt „Anmeldebildschirm“):
// ruhiger dunkler Hintergrund, Datum und Uhrzeit oben, große Wortmarke und Eingaben unten. Keine Menüleiste.
const dateFormat=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',weekday:'long',day:'numeric',month:'long'});
const timeFormat=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'});
function Clock(){
 // Erst im Browser setzen: Server- und Browserzeit dürfen beim Hydrieren nicht voneinander abweichen.
 const [now,setNow]=useState<Date|null>(null);
 useEffect(()=>{const tick=()=>setNow(new Date());const first=window.setTimeout(tick,0),timer=window.setInterval(tick,15000);return()=>{window.clearTimeout(first);window.clearInterval(timer);};},[]);
 return <div className={styles.clock} aria-hidden="true"><div className={styles.date}>{now?dateFormat.format(now):' '}</div><div className={styles.time}>{now?timeFormat.format(now):' '}</div></div>;
}
export function Wordmark(){return <div className={styles.symbol} role="img" aria-label="HeyElli">Hey<span>Elli</span><i aria-hidden="true">.</i></div>;}
export function LockScreen({title,children}:{title:string;children:ReactNode}){
 return <main className={styles.lock}><Clock/><section className={styles.panel} aria-labelledby="lock-title"><h1 id="lock-title" className="sr-only">{title}</h1><Wordmark/>{children}</section></main>;
}
export {styles as lockStyles};
