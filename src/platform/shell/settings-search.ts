import {settingsPages,rootNamespace,parseSettingsPath,type SettingsPageKey} from './settings-page-model.ts';
// Static function names only. Never index loaded values, people, audit records or credentials.
export type SearchArea={id:string;label:string;group:string;icon:string;color:string;keywords:string};
export type SettingsSearchEntry={id:string;area:string;path:string|null;label:string;breadcrumb:string;terms:string;icon:string;color:string};
type FunctionPage={root:string;path:string|null;functions:string[][]};
const functions:FunctionPage[]=[
 {root:'system',path:'system:appearance',functions:[['Standarddarstellung','Hell Dunkel Gerät Erscheinungsbild Theme neue Benutzerprofile']]},
 {root:'system',path:'system:info',functions:[['HeyElli-Version','Veröffentlichung Ersteller Tim Braun Techstack technische Module Infrastruktur Menüleiste Node Next React TypeScript PostgreSQL SQLite Docker Ollama']]},
 {root:'security',path:'security:sessions',functions:[['Sitzungsdauer','Sitzungszeitraum Minuten Anmeldung Ablauf Gültigkeit']]},
 {root:'security',path:'security:secrets',functions:[['Ablage prüfen','Zugangsdaten Geheimnisse verwaiste Dateien bereinigen'],['Zugangsdaten wiederherstellen','Archiv vorherige Konfiguration geschützte Sicherung']]},
 {root:'security',path:'security:browser',functions:[['Verletzungsmeldungen','Browser Schutz CSP Sicherheitsmeldungen Diagnose'],['Schutzrichtlinie','Skripte Nonce Quellen Sicherheit']]},
 {root:'security',path:'security:data',functions:[['Datenexport','Kontodaten JSONL Download'],['Aufbewahrungsfristen','Prüfhinweise Datenschutz'],['Bereinigung sperren','Aufbewahrungssperre Löschsperre'],['Datenbereinigung','Vorschau abgeschlossene Chatantworten eigene Elli-Bewertungen erledigte E-Mail-Inhalte beendete Sitzungen kontrolliert löschen']]},
 {root:'security',path:'security:operations',functions:[['Überwachung','Lebenszeichen Datenbank Webdienst E-Mail-Dienst Ablage API freier Speicher'],['Alarme bestätigen','Alarmierung Betriebsdiagnose Fehler']]},
 {root:'users',path:'users:accounts',functions:[['PDS-Benutzer zuordnen','PDS Mitarbeiter Mitarbeiterzuordnung Bearbeiter Zuordnung aufheben Pflicht Anmeldung'],['Startpasswort','Passwort zurücksetzen neues Passwort vergeben Kennwort Erstanmeldung'],['Microsoft-Konto','Entra verknüpfen Verknüpfung lösen Anmeldeadresse UPN'],['Rolle zuordnen','Benutzer Rollen eigene Rolle auswählen'],['Konto aktivieren','Benutzer Konto sperren deaktivieren Aktivierung Benutzername']]},
 {root:'users',path:'users:create',functions:[['Konto anlegen','heyelli-Konto Benutzer anlegen Anzeigename Benutzername Rolle aktivieren'],['Microsoft-Anmeldeadresse','Entra UPN E-Mail Verknüpfung vorbereiten']]},
 {root:'users',path:'users:sessions',functions:[['Sitzungen widerrufen','Abmelden Geräte aktive Sitzungen Ablauf']]},
 {root:'users',path:'users:events',functions:[['Protokoll durchsuchen','Änderungsprotokoll Benutzer Zeitraum Änderungsart alte neue Werte Filter'],['Protokoll kopieren','Zwischenablage Markdown Download alle gefilterte Einträge']]},
 {root:'users',path:'users:roles',functions:[['Rolle bearbeiten','Disposition Lesezugriff Rollen auswählen ändern löschen'],['App-Rechte','Lesen Schreiben Berechtigungen App-Zugriffe Rolleneditor'],['Werkzeuge freigeben','Menüleiste Rollen Notizen CaseDesk']]},
 {root:'users',path:'users:roles/roles:create',functions:[['Neue Rolle anlegen','Eigene Rolle Name speichern App-Zugriffe']]},
 {root:'incident',path:'incident:positions',functions:[['Standardposition hinzufügen','PDS Katalogartikel Name Positionsnummer Menge Störungsauftrag'],['Standardposition entfernen','Vorlage Artikel löschen Zeile']]},
 {root:'colors',path:'resources:defaults',functions:[['Techniker-Badges','Haupttechniker Begleiter kennzeichnen'],['Arbeitszeiten begrenzen','Anzeigevorgaben Kalender'],['Vorgemerkte Termine','Anzeigevorgaben einblenden ausblenden']]},
 {root:'colors',path:'resources:colors/palette:0',functions:[['Farbreihenfolge','Hauptfarbe Nebenfarbe erste zweite Farbe Priorität Termintyp']]},
 {root:'colors',path:'resources:colors/palette:1',functions:[['Kategoriefarben','Termin-Kategorien Farbe Reihenfolge']]},
 {root:'colors',path:'resources:colors/palette:2',functions:[['Statusfarben','Statusfarbe Vorgangsstatus Kalenderfarbe']]},
 {root:'graph',path:'graph:maildesk',functions:[['MailDesk-Postfachquelle','Beispielpostfach Microsoft 365 geteiltes Postfach Adresse'],['MailDesk-Verbindung prüfen','Graph Mail.Read Lesezugriff Zugriffsrichtlinie']]},
 {root:'elli',path:null,functions:[['Antwortbewertungen','Daumen hoch runter Grund Rückmeldungen Wissensbasis AskElli'],['Rückmeldung entfernen','Bewertung löschen'],['Bewertete Frage und Antwort','Bewertungsgrund Kommentar Quellen Wissensstand']]},
 {root:'email',path:'mail:compose',functions:[['In Outlook öffnen','Empfänger Betreff Nachricht selbst versenden Mailprogramm'],['E-Mail versenden','Versandweg Microsoft Graph zentrales Absenderpostfach']]},
 {root:'email',path:'mail:queue',functions:[['Versand wiederholen oder abbrechen','Warteschlange Fehler Versuche automatische Verarbeitung Microsoft Graph erforderlich']]},
 {root:'graph',path:'graph:connection',functions:[['Tenant-ID und Client-ID','Microsoft 365 App Registrierung Anmeldung'],['Client-Secret','Wert Zugangsdaten geschützt speichern'],['Zentrales Absenderpostfach','Absender E-Mail-Adresse Postfach prüfen Verbindungstest']]},
 {root:'graph',path:'graph:release',functions:[['Microsoft Graph aktivieren','Integration Modul Freigabe'],['MS365-Graph Testbetrieb','Echten Versand ausdrücklich freigeben ein ausschalten']]},
 {root:'pds',path:'pds:connection',functions:[['HTTPS-API-Basisadresse','PDS Adresse URL'],['Bearer-Token','PDS Zugangsdaten Verbindung geschützt speichern']]},
 {root:'pds',path:'pds:checks',functions:[['API und Kalender prüfen','Verbindungstest PDS Zugriff']]},
 {root:'pds',path:'pds:views',functions:[['Arbeitszeitmodelle','Datenansichten Arbeitszeiten'],['Urlaubsfreigaben','Genehmigungen Datenansichten'],['Rücklaufzuordnung','Rückläufe serviceauftragebeneUUID Datenansichten'],['Kalenderfarben aus PDS','Datenansichten colorView']]},
 {root:'pds',path:'pds:source',functions:[['Datenquelle wechseln','Simulator echter PDS Lesezugriff ausdrücklich freigeben']]},
 {root:'microsoft-auth',path:'microsoft:connection',functions:[['Microsoft-Zugangsdaten','Entra OAuth Tenant-ID Client-ID Client-Secret Weiterleitungsadresse Redirect URI Metadaten']]},
 {root:'microsoft-auth',path:'microsoft:release',functions:[['Anmeldung testen','Microsoft Verbindungstest'],['Microsoft-Anmeldung freigeben','Anmeldung aktivieren deaktivieren']]},
 {root:'copilot',path:'copilot:connection',functions:[['Bot-ID','Copilot Studio Agent-ID'],['Direct-Line-Region','Token-Endpunkt Regionsermittlung'],['Direct-Line-Secret','Copilot Zugangsdaten geschützt speichern']]},
 {root:'copilot',path:'copilot:release',functions:[['Copilot-Verbindungstest','Agent Protokoll Credits'],['Copilot aktivieren','Ollama lokale KI ersetzen Freigabe']]},
 {root:'sharepoint',path:'sharepoint:connection',functions:[['SharePoint-Zugangsdaten','Tenant-ID Client-ID Client-Secret'],['Dokumentbibliothek','Site-ID Drive-ID Bibliotheks-ID Stammordner-ID Ablage Website']]},
 {root:'sharepoint',path:'sharepoint:storage',functions:[['SharePoint-Ablagetypen','Ordnerstruktur Unterordner Mails Berichte Rückläufe Fotos Verträge Angebote Sonstiges'],['Bisherige SharePoint-Ablage übernehmen','Hash-Ordner heyelli verschieben Übernahme Vorschau']]},
 {root:'sharepoint',path:'sharepoint:release',functions:[['SharePoint freigeben','Verbindung prüfen Dokumente Upload aktivieren']]},
 {root:'bmacloud',path:'bmacloud:connection',functions:[['Installationsadresse','BMACloud URL'],['API-Token','BMACloud Zugang geschützt speichern']]},
 {root:'bmacloud',path:'bmacloud:release',functions:[['BMACloud aktivieren','Verbindung prüfen Anlagenlinks AID Wartungskostenträger']]},
 {root:'account',path:'account:profile',functions:[['Angemeldeter Benutzer','Kontodaten Name Identität'],['Meine Rolle','Grundberechtigung App-Zugriffe'],['Zugeordneter Mitarbeiter','Meine Mitarbeiterzuordnung']]},
 {root:'account',path:'account:login',functions:[['Passwort ändern','heyelli-Passwort Kennwort neues Passwort ändern Sicherheit'],['Microsoft-Konto verknüpfen','Entra Microsoft Anmeldung verknüpfen Konto']]},
 {root:'account',path:'account:device',functions:[['Lokale Kopien entfernen','Kalenderentwürfe Gerät sichern entfernen abmelden wiederherstellen verschlüsselt']]},
 {root:'account',path:'account:data',functions:[['Meine Daten exportieren','JSONL Download eigene Entwürfe Datenschutz'],['Eigene Daten bereinigen','Vorschau Löschung abgeschlossene Chatantworten eigene Elli-Bewertungen erledigte E-Mail-Inhalte beendete Sitzungen']]},
 {root:'display',path:null,functions:[['Erscheinungsbild','Hell Dunkel Wie Gerät persönliche Darstellung Anzeige']]},
 {root:'tools',path:null,functions:[['Menüleisten-Werkzeuge anzeigen','Notizen CaseDesk persönlich einblenden ausblenden Tools']]},
];
export function settingsSearchIndex(areas:SearchArea[]):SettingsSearchEntry[]{
 const index:SettingsSearchEntry[]=[];
 for(const area of areas){
  const add=(path:string|null,label:string,terms='')=>{const existing=index.find(entry=>entry.area===area.id&&entry.path===path&&entry.label===label);if(existing){existing.terms+=' '+terms;return;}const parts=path?.split('/')??[],names=parts.map(part=>{const [namespace,id]=part.split(':');return settingsPages[namespace as SettingsPageKey]?.find(([key])=>key===id)?.[1];}).filter(Boolean);index.push({id:area.id+':'+index.length,area:area.id,path,label,breadcrumb:[area.group,area.label,...names.filter(name=>name!==label),...(area.id==='email'&&['mail:queue','mail:log'].includes(path??'')?['Microsoft Graph erforderlich']:[])].join(' › '),terms:[terms,area.label,...names].join(' '),icon:area.icon,color:area.color});};
  add(null,area.label,area.keywords);
  const namespace=rootNamespace[area.id];
  for(const [page,label]of namespace?settingsPages[namespace]:[]){if(area.id==='account'&&page==='display')continue;add(namespace+':'+page,label);}
  if(area.id==='colors')for(const [page,label]of settingsPages.palette)add('resources:colors/palette:'+page,label);
  for(const page of functions.filter(page=>page.root===area.id))for(const [label,terms]of page.functions)add(page.path,label,terms);
 }
 return index;
}
export const normalizeSettingsQuery=(value:string)=>value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('de').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();
export function searchSettings(index:SettingsSearchEntry[],query:string){
 const tokens=normalizeSettingsQuery(query).split(' ').filter(Boolean);if(!tokens.length)return [];
 return index.map((entry,order)=>{const label=normalizeSettingsQuery(entry.label),path=normalizeSettingsQuery(entry.breadcrumb),terms=normalizeSettingsQuery(entry.terms);return {entry,order,score:tokens.every(token=>`${label} ${path} ${terms}`.includes(token))?tokens.reduce((score,token)=>score+(label===token?100:label.startsWith(token)?40:label.includes(token)?25:path.includes(token)?8:1),0):-1};}).filter(item=>item.score>=0).sort((a,b)=>b.score-a.score||a.order-b.order).map(item=>item.entry);
}
export function settingsSearchPath(entry:SettingsSearchEntry){if(entry.path&&parseSettingsPath(entry.area,entry.path).join('/')!==entry.path)throw Error('Ungültiger Einstellungsweg.');return entry.path;}
