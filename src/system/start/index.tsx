import 'server-only';
import {redirect} from 'next/navigation';
import {session} from '@/platform/session';
import {appRoleStore} from '@/platform/app-access';
import {appCatalog} from '@/platform/app-access/model';
import {GuardedLink} from '@/platform/shell';
import {AppGlyph,appIconBackground,type AppGlyphName} from '@/platform/shell/app-glyph';
import styles from './start-page.module.css';
const details:Record<string,{icon:AppGlyphName;text:string}>={
 '/':{icon:'elli',text:'Bedienhilfe im Gespräch'},
 '/servicehub':{icon:'service',text:'Aufträge, Kunden, Objekte und Akten'},
 '/casedesk':{icon:'incident',text:'Meldung in drei Schritten zum Auftrag'},
 '/planboard':{icon:'resource',text:'Termine und Teams disponieren'},
 '/dutyboard':{icon:'duty',text:'Bereitschaft fair verteilen und tauschen'},
 '/maildesk':{icon:'maildesk',text:'Geteiltes Postfach zuordnen'},
 '/taskhub':{icon:'tasks',text:'Gemeinsame Aufgabenliste des Teams'},
 '/missioncontrol':{icon:'mission',text:'Mein Tag, Fokus und Ziele'},
 '/benutzerkonto':{icon:'account',text:'Profil und persönliche Anzeige'},
 '/hilfe':{icon:'help',text:'Anleitungen und Bedienwege'},
 '/einstellungen':{icon:'settings',text:'HeyElli verwalten'},
};
export async function StartPage(){
 const user=await session();if(!user)redirect('/anmeldung?next=%2Fstart');
 const allowed=await appRoleStore().allowed(user.id),apps=appCatalog.filter(([path])=>allowed.includes(path));
 return <main className={styles.page}><header className={styles.heading}><h1>Willkommen bei HeyElli.</h1><p>Deine Apps auf einen Blick.</p></header>{apps.length?<nav className={styles.apps} aria-label="Freigegebene Apps">{apps.map(([path,name])=><GuardedLink key={path} href={path} className={styles.app}><span className={styles.icon} style={{background:appIconBackground[details[path].icon]}} aria-hidden="true"><AppGlyph icon={details[path].icon}/></span><span className={styles.text}><strong>{name}</strong><small>{details[path].text}</small></span><span className={styles.chevron} aria-hidden="true">›</span></GuardedLink>)}</nav>:<p className={styles.empty}>Für dein Benutzerkonto sind noch keine Apps freigegeben. Wende dich an die Administration.</p>}</main>;
}
