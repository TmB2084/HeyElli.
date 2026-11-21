'use client';
import {useEffect,useState} from 'react';
import {SettingsGroup,SettingsRow,Notice} from '@/platform/shell';
type Report={day:string;app:string;directive:string;blocked_kind:string;disposition:string;occurrences:string;last_seen:string};
const kinds:Record<string,string>={inline:'Inline-Skript','same-origin':'Eigene Quelle',external:'Externe Quelle',eval:'Dynamische Auswertung','wasm-eval':'WebAssembly',blob:'Lokale Datei',data:'Eingebettete Daten',other:'Sonstige Quelle'};
export function BrowserReportsPanel(){
 const [reports,setReports]=useState<Report[]>([]),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();void fetch('/api/verwaltung/browser-schutz',{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('Browsermeldungen konnten nicht geladen werden.');const value=await r.json();setReports(value.reports);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[]);
 return <SettingsGroup title="Browser-Schutz" description="Quellen und Skripte werden eingeschränkt. Meldungen angemeldeter Browser werden ohne vollständige URLs oder Inhalte zusammengefasst. Browsermeldungen sind ungeprüfte Hinweise, kein Nachweis eines Angriffs. Entwicklungswerkzeuge benötigen zusätzliche Freigaben; Inline-Stile bleiben für die Oberfläche erlaubt.">
  <SettingsRow title="Schutzrichtlinie" description="Skripte nur mit Freigabe pro Seitenaufruf, keine Inline-Ereignisse, fremden Rahmen oder Objekte."><span>Aktiv</span></SettingsRow>
  <Notice tone="error">{error}</Notice>
  {reports.length?reports.map(r=><SettingsRow key={[r.day,r.app,r.directive,r.blocked_kind,r.disposition].join(':')} title={r.directive+' · '+(kinds[r.blocked_kind]??'Quelle')} description={`${r.app==='other'?'Andere Seite':r.app} · ${new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'}).format(new Date(r.last_seen))} · ${r.disposition==='enforce'?'Durchsetzung':'Beobachtung'}`}><span>{r.occurrences} Meldungen</span></SettingsRow>):!error&&<SettingsRow title="Keine gespeicherten Meldungen" description="Anonyme Anmeldeaufrufe werden nicht zentral erfasst. Fehlende Meldungen garantieren keine Fehlerfreiheit."><span>—</span></SettingsRow>}
 </SettingsGroup>;
}
