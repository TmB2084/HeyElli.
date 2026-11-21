'use client';
import type {ReactNode} from 'react';
import {SettingsWorkspace,appIconBackground} from '@/platform/shell';
const areas=[
 {id:'sharepoint',label:'SharePoint',group:'Integrationen',icon:'pds',color:'#198b8f',keywords:'Microsoft 365 Dokumente Dateien Bibliothek Ablage Upload Website Sites'},
 {id:'bmacloud',label:'BMACloud',group:'Integrationen',icon:'pds',color:'#5baf9c',keywords:'Anlage AID Wartung Kostenträger API Verbindung'},
 {id:'copilot',label:'Copilot',group:'Integrationen',icon:'elli',color:appIconBackground.elli,keywords:'Elli KI Microsoft Agent Verbindung Secret Freigabe Anleitung'},
 {id:'elli',label:'AskElli',group:'Apps',icon:'elli',color:appIconBackground.elli,keywords:'Elli Chat Bewertungen Daumen Wissen Rückmeldung'},
 {id:'users',label:'Benutzer & Zugriff',group:'Organisation',icon:'users',color:'#5885d8',keywords:'Rollen Mitarbeiter Zuordnung Sitzungen Protokoll'},
 {id:'incident',label:'CaseDesk',group:'Apps',icon:'incident',color:appIconBackground.incident,keywords:'Störung Standardpositionen Artikel Katalog Positionsnummer Menge'},
 {id:'colors',label:'PlanBoard',group:'Apps',icon:'resource',color:appIconBackground.resource,keywords:'Kalender Farben Kategorien Anzeige Vorgaben'},
 {id:'system',label:'Allgemein',group:'System',icon:'settings',color:'#7d8999',keywords:'Systemeinstellungen Darstellung Hell Dunkel Info Version Techstack'},
 {id:'security',label:'Sicherheit',group:'System',icon:'lock',color:'#cc565b',keywords:'Sitzungsdauer Zugangsdaten Geheimnisse Schlüssel Browser Schutz Datenschutz Aufbewahrung Betriebsstatus Alarme Überwachung'},
 {id:'email',label:'E-Mail',group:'Organisation',icon:'mail',color:'#448fce',keywords:'Outlook Nachricht Versand Warteschlange'},
 {id:'graph',label:'Microsoft Graph',group:'Integrationen',icon:'mail',color:'#448fce',keywords:'Microsoft 365 Tenant Client Secret Absender Postfach Testbetrieb Versand Anleitung MailDesk geteiltes Postfach Mail.Read'},
 {id:'pds',label:'PDS-Anbindung',group:'Integrationen',icon:'pds',color:'#df9250',keywords:'API Verbindung Simulator Datenansichten Bearbeiter Anleitung'},
 {id:'microsoft-auth',label:'Microsoft-Anmeldung',group:'Integrationen',icon:'lock',color:'#5baf9c',keywords:'Entra OAuth Zugang Anmeldung Freigabe Anleitung'},
];
export function AdminWorkspace({area,onAreaChange,children,accountName}:{accountName:string;area:string;onAreaChange:(area:string)=>void;children:ReactNode}){
 return <SettingsWorkspace title="Einstellungen" account={{name:accountName,href:"/benutzerkonto",detail:"Benutzerkonto"}} areas={areas} groups={['System','Organisation','Apps','Integrationen']} area={area} onAreaChange={onAreaChange}>{children}</SettingsWorkspace>;
}
