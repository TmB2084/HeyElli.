import { PlannerGlyph, GuardedLink as Link } from "@/platform/shell";
import type { Service } from "./model";
import styles from "./service-menu.module.css";

function PlannerIcon({slug}:{slug:string}) {
 return <PlannerGlyph icon={slug==='stoerungsaufnahme'?'incident':slug==='ressourcenkalender'?'resource':'duty'}/>;
}

export function ServiceMenu({services}:{services:readonly Service[]}) {
  return <main className={styles.workspace}>
    <div className={styles.window}>
      <header className={styles.toolbar}>
        <div className={styles.workspaceIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="4" y="6" width="16" height="14" rx="3"/><path d="M9 6V4h6v2M4 12h16M10 12v3h4v-3"/></svg></div>
        <div><h1>ServiceHub</h1><p>Aufträge, Kunden, Objekte und Akten</p></div>
      </header>
      <nav className={styles.launcher} aria-label="Serviceplaner">
        <ul className={styles.apps}>
          {services.map(service=><li key={service.id}>
            {service.href ? <Link className={styles.app} href={service.href} aria-label={`${service.name} öffnen`}>
              <span className={styles.icon} data-planner={service.slug}><PlannerIcon slug={service.slug}/></span>
              <span className={styles.appName}>{service.name}</span>
              <span className={styles.appDescription}>{service.description}</span>
              <span className={styles.open}>Öffnen <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg></span>
            </Link> : <div className={styles.app}>
              <span className={styles.icon} data-planner={service.slug}><PlannerIcon slug={service.slug}/></span>
              <span className={styles.appName}>{service.name}</span><span className={styles.appDescription}>{service.description}</span>
              <span className={styles.unavailable}>In Vorbereitung</span>
            </div>}
          </li>)}
        </ul>
      </nav>
    </div>
  </main>;
}
