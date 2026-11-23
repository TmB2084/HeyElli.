import {requiredApps,writeAppsForRequest} from './model.ts';
export type AccessIdentity={id:string;role:string;mustChangePassword?:boolean}|null;
// Solange das Startpasswort nicht geändert ist, ist nur das Ändern des Passworts erlaubt.
export const passwordChangePaths=['/api/benutzerkonto/passwort'];
export class AppAccessError extends Error {readonly status:number;constructor(message:string,status:number){super(message);this.status=status;}}
export async function requireAppRight(user:AccessIdentity,apps:string[],permission:'read'|'write',can:(id:string,app:string,permission:'read'|'write')=>Promise<boolean>){
 if(!user)throw new AppAccessError('Bitte zuerst anmelden.',401);
 if(!apps.length||!await Promise.all(apps.map(app=>can(user.id,app,permission))).then(values=>values.some(Boolean)))throw new AppAccessError(permission==='write'?'Deine Rolle erlaubt in dieser App nur das Lesen.':'Deine Rolle erlaubt diese App nicht.',403);
 return user;
}
export async function requirePolicy(user:AccessIdentity,path:string,method:string,can:(id:string,app:string,permission:'read'|'write')=>Promise<boolean>,operationPath=path){
 const policy=apiPolicy(path);
 if(!policy)throw new AppAccessError('Für diesen Endpunkt fehlt eine Zugriffszuordnung.',403);
 if(policy==='public')return;
 if(!user)throw new AppAccessError('Bitte zuerst anmelden.',401);
 if(user.mustChangePassword&&!passwordChangePaths.includes(path))throw new AppAccessError('Bitte zuerst das Passwort ändern.',403);
 if(path.startsWith('/api/verwaltung')&&user.role!=='admin')throw new AppAccessError('Administratorrechte erforderlich.',403);
 if(policy==='shared')return;
 await requireAppRight(user,requiredApps(path),'read',can);
 const writes=writeAppsForRequest(operationPath,method);if(writes.length)await requireAppRight(user,writes,'write',can);
}
// Explicit inventory: a newly added route needs a deliberate scope, even under
// an existing URL prefix. Shared endpoints expose only the session owner's data.
export function apiPolicy(path:string):'public'|'shared'|'app'|undefined{
 if(publicApiPaths.includes(path))return 'public';
 if(sharedApiPaths.includes(path))return 'shared';
 if(path==='/api/pds/rest/api/[...segments]'||path==='/api/pds-simulator/orders/[number]/document'||appApiPaths.includes(path)||/^\/api\/pds\/rest\/api\/(?:[^/]+\/)+[^/]+$/.test(path)||/^\/api\/pds-simulator\/orders\/[^/]+\/document$/.test(path))return 'app';
}
export const publicApiPaths=['/api/simulator-session','/api/auth/microsoft/start','/api/auth/microsoft/callback'];
export const sharedApiPaths=['/api/benutzerkonto/passwort','/api/benutzerkonto/notizen','/api/benutzerkonto/auftragsentwuerfe','/api/benutzerkonto/werkzeuge','/api/sicherheit/csp','/api/benutzerkonto/daten','/api/benutzerkonto/daten/export','/api/einstellungen','/api/benutzerkonto/navigation','/api/benutzerkonto/app-nutzung','/api/benutzerkonto/geraet'];
export const appApiPaths:string[]=["/api/planung/verfuegbarkeit","/api/aufgaben","/api/aufgaben/aufgabe","/api/aufgaben/aktion","/api/aufgaben/neu","/api/aufgaben/vorlage","/api/missioncontrol","/api/missioncontrol/plan","/api/missioncontrol/fokus","/api/missioncontrol/notizen","/api/missioncontrol/erledigt","/api/missioncontrol/kalender","/api/missioncontrol/ziele","/api/missioncontrol/rueckblick","/api/service/kunde360","/api/service/kunde360/notiz","/api/verwaltung/stoerungsmeister","/api/verwaltung/maildesk","/api/service/status","/api/service/chronik","/api/service/terminbestaetigung","/api/service/einsatzmappe","/api/service/einsatzmappe/dokument","/api/service/sichtbarkeit","/api/service/angeheftet","/api/service/markierungen","/api/maildesk","/api/maildesk/nachricht","/api/maildesk/aktion","/api/maildesk/antwort","/api/maildesk/vorlage","/api/service/dokumente","/api/verwaltung/sharepoint","/api/verwaltung/sharepoint/ablage","/api/verwaltung/sharepoint/anleitung","/api/verwaltung/betriebsstatus","/api/verwaltung/browser-schutz","/api/verwaltung/datenschutz","/api/verwaltung/datenschutz/export","/api/ressourcenkalender/entwuerfe","/api/verwaltung/geheimnisablage","/api/assistent", "/api/assistent/aktionen", "/api/assistent/begruessung", "/api/assistent/bewertungen", "/api/assistent/status", "/api/assistent/verlauf", "/api/benutzerkonto", "/api/bereitschaft", "/api/bereitschaft/fairness", "/api/bereitschaft/feiertage", "/api/bereitschaft/ressourcenauswahl", "/api/bereitschaft/termine", "/api/bereitschaft/wuensche", "/api/pds-simulator", "/api/pds-simulator/orders", "/api/pds-simulator/person-links", "/api/pds-simulator/persons", "/api/pds-simulator/uploads", "/api/ressourcenkalender", "/api/ressourcenkalender/farben", "/api/ressourcenkalender/historie", "/api/ressourcenkalender/mobilausgabe", "/api/ressourcenkalender/mobilausgabe/alle", "/api/ressourcenkalender/referenzen", "/api/ressourcenkalender/ressourcenauswahl", "/api/ressourcenkalender/stornieren", "/api/ressourcenkalender/termine", "/api/service", "/api/service/planung", "/api/verwaltung", "/api/verwaltung/benutzer", "/api/verwaltung/bmacloud", "/api/verwaltung/bmacloud/anleitung", "/api/verwaltung/copilot", "/api/verwaltung/copilot/anleitung", "/api/verwaltung/einstellungen", "/api/verwaltung/email", "/api/verwaltung/email/anleitung", "/api/verwaltung/info", "/api/verwaltung/microsoft-anmeldung", "/api/verwaltung/microsoft-anmeldung/anleitung",  "/api/verwaltung/pds", "/api/verwaltung/pds/anleitung", "/api/verwaltung/protokoll", "/api/verwaltung/rollen", "/api/verwaltung/sitzungen"];
