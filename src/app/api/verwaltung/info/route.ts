import {withRouteAccess} from '@/platform/app-access/route-access';
import {adminRequest,adminHeaders,adminFailure} from '@/system/einstellungen';
import lock from '../../../../../package-lock.json';
async function scopedGET(){try{await adminRequest();
 const versions=lock.packages as Record<string,{version?:string}>;
 const version=(name:string)=>versions['node_modules/'+name]?.version??'Nicht angegeben';
 return Response.json({modules:[
 {name:'Node.js',version:process.version,description:'Laufzeit für HeyElli und Hintergrunddienste.'},
 {name:'Next.js',version:version('next'),description:'Webanwendung, geschützte Seiten und serverseitige API.'},
 {name:'React',version:version('react'),description:'Interaktive Oberfläche und gemeinsame Bedienelemente.'},
 {name:'TypeScript',version:version('typescript'),description:'Typprüfung des Quellcodes.'},
 {name:'PostgreSQL-Anbindung (pg)',version:version('pg'),description:'Zentraler Speicher für Benutzer, Sitzungen, Einstellungen und Protokolle. Versionsangabe des Treibers, nicht des Datenbankservers.'},
 {name:'Token-Prüfung (jose)',version:version('jose'),description:'Prüfung signierter Anmeldetokens.'},
 {name:'Menüleiste & App-Navigation',description:'HeyElli-App-Auswahl, App-Menüs, Navigationsverlauf und Benutzermenü. Bestandteil der HeyElli-Version.'},
 {name:'PDS-Anbindung & Simulator',description:'Fachzugriffe über die dokumentierte PDS-API; im Simulatorbetrieb über eine lokale SQLite-Ablage. Keine eigene Modulversion vergeben.'},
 {name:'Elli',description:'Lokale Bedienungshilfe über Ollama oder nach Freigabe Microsoft Copilot Studio. Modell und externe Dienste besitzen keine hier bestätigte Laufzeitversion.'},
 {name:'Microsoft-Integrationen & E-Mail',description:'Microsoft-Anmeldung, Graph-Mailversand und Warteschlange. Einrichtung und Freigabe stehen in den jeweiligen Integrationsbereichen.'},
 ]},{headers:adminHeaders});}catch(error){return adminFailure(error);}}

export const GET=withRouteAccess('/api/verwaltung/info','GET',scopedGET);
