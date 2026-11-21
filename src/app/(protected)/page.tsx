import type {Metadata} from 'next';
import {elliAvailable} from '@/platform/server-operation';
import {Suspense} from 'react';
import {redirect} from 'next/navigation';
import {GuardedLink as Link,PlannerGlyph} from '@/platform/shell';
import {LocalAssistant} from '@/apps/askelli/elli';
import {session,permitted} from '@/platform/session';
import styles from './home.module.css';

export const metadata:Metadata={title:"AskElli | HeyElli"};

const serviceLinks=[
 {href:'/servicehub',title:'Cockpit',description:'Service im Überblick',icon:'cockpit'},
 {href:'/servicehub?ansicht=orders',title:'Aufträge',description:'Suchen und planen',icon:'orders'},
 {href:'/servicehub?ansicht=files',title:'Kunden & Objekte',description:'Kontakte und Akten',icon:'files'}
] as const;
const planners=[
 {href:'/casedesk',title:'CaseDesk',description:'Störungen aufnehmen',icon:'incident'},
 {href:'/planboard',title:'PlanBoard',description:'Einsätze und Teams planen',icon:'resource'},
 {href:'/dutyboard',title:'DutyBoard',description:'Bereitschaften verteilen',icon:'duty'}
] as const;
function ServiceIcon({icon}:{icon:typeof serviceLinks[number]['icon']}){
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon==='cockpit'?<><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>:icon==='orders'?<><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h4"/></>:<><path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 10h18"/></>}</svg>;
}
async function Workplace(){
 const user=await session();if(!user||!permitted(user,'read'))redirect('/anmeldung');
 const shortcuts=<>
  <details open className={styles.shortcuts}><summary>Service & Planung</summary>
  <div className={styles.launchpad}>
   <section className={styles.group} aria-labelledby="home-service"><h2 id="home-service">Service</h2><nav className={styles.destinations} aria-label="Service-Bereiche">{serviceLinks.map(item=><Link key={item.href} href={item.href} className={styles.destination}><span className={styles.serviceIcon}><ServiceIcon icon={item.icon}/></span><span className={styles.text}><strong>{item.title}</strong><small>{item.description}</small></span><span className={styles.chevron} aria-hidden="true">›</span></Link>)}</nav></section>
   <section className={styles.group} aria-labelledby="home-planning"><h2 id="home-planning">Planung</h2><nav className={styles.destinations} aria-label="Planungs-Apps">{planners.map(item=><Link key={item.href} href={item.href} className={styles.destination}><span className={styles.plannerIcon} data-planner={item.icon}><PlannerGlyph icon={item.icon}/></span><span className={styles.text}><strong>{item.title}</strong><small>{item.description}</small></span><span className={styles.chevron} aria-hidden="true">›</span></Link>)}</nav></section>
  </div>
  </details>
</>;
 return <main className={styles.home}>
  <h1 className="sr-only">AskElli</h1>
  {elliAvailable()?<LocalAssistant shortcuts={shortcuts}/>:shortcuts}
 </main>;
}

export default function Home(){return <Suspense fallback={<main className={styles.home}><p role="status">Elli wird geladen …</p></main>}><Workplace/></Suspense>;}
