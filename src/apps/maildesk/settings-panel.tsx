'use client';
import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {GuardedLink,Notice,PopUpButton,SettingsGroup,SettingsRow,useDraftNavigationGuard} from '@/platform/shell';
import type {MaildeskSettings} from './settings';
// Einstellungen → Microsoft Graph → MailDesk-Postfach: Postfachquelle wählen, Verbindung prüfen, einmal speichern.
type Draft={source:'simulator'|'graph';mailbox:string};
const time=(value:string)=>new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'}).format(new Date(value));
export function MaildeskSettingsPanel(){
 const [settings,setSettings]=useState<MaildeskSettings|null>(null),[draft,setDraft]=useState<Draft>({source:'simulator',mailbox:''}),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[check,setCheck]=useState<{ok:boolean;message:string}|null>(null);
 const apply=useCallback((value:MaildeskSettings)=>{setSettings(value);setDraft({source:value.source,mailbox:value.mailbox??''});},[]);
 useEffect(()=>{void(async()=>{try{const response=await fetch('/api/verwaltung/maildesk',{cache:'no-store'}),value=await response.json();if(!response.ok)throw Error(value.error);apply(value);}catch(problem){setError(problem instanceof Error&&problem.message?problem.message:'MailDesk-Einstellung nicht erreichbar.');}})();},[apply]);
 const dirty=!!settings&&(draft.source!==settings.source||draft.mailbox.trim().toLowerCase()!==(settings.mailbox??''));
 const discard=useCallback(()=>{if(settings)setDraft({source:settings.source,mailbox:settings.mailbox??''});},[settings]);
 useDraftNavigationGuard(dirty,busy,discard);
 const mailbox=draft.mailbox.trim().toLowerCase(),checkedNow=!!settings&&settings.checkFresh&&settings.checkedMailbox===mailbox;
 async function post(body:Record<string,unknown>){const response=await fetch('/api/verwaltung/maildesk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)}),value=await response.json();if(!response.ok)throw Error(value.error);return value;}
 async function runCheck(){setBusy(true);setError('');setMessage('');setCheck(null);try{const value=await post({action:'check',mailbox});setCheck({ok:value.ok,message:value.message});setSettings(value.settings);}catch(problem){setError(problem instanceof Error?problem.message:'Prüfung nicht möglich.');}finally{setBusy(false);}}
 async function save(event:FormEvent){event.preventDefault();if(!settings||!dirty)return;setBusy(true);setError('');setMessage('');try{apply(await post({action:'save',version:settings.version,source:draft.source,mailbox:mailbox||null}));setMessage(draft.source==='graph'?'Gespeichert. MailDesk liest jetzt das geteilte Postfach.':'Gespeichert. MailDesk zeigt das Beispielpostfach.');}catch(problem){setError(problem instanceof Error?problem.message:'Speichern nicht möglich.');}finally{setBusy(false);}}
 if(!settings)return error?<Notice tone="error" role="alert">{error}</Notice>:<p role="status">MailDesk-Einstellung wird geladen …</p>;
 return <form onSubmit={save} className="account-form">
  <SettingsGroup title="Postfach" description="Quelle der Mails in MailDesk. Mailinhalte werden nie in HeyElli gespeichert; MailDesk schreibt nichts in Microsoft 365.">
   <SettingsRow title="Quelle" description={draft.source==='graph'?'Geteiltes Postfach über Microsoft Graph (nur lesend, Nur-Text).':'Beispielpostfach für Erprobung und Schulung.'}><PopUpButton label="Quelle" value={draft.source} disabled={busy} options={[{value:'simulator',label:'Beispielpostfach'},{value:'graph',label:'Microsoft 365 (geteiltes Postfach)'}]} onChange={value=>setDraft(current=>({...current,source:value as Draft['source']}))}/></SettingsRow>
   <SettingsRow title="Geteiltes Postfach" controlId="maildesk-mailbox" description="Adresse des geteilten Postfachs, z. B. service@firma.de."><input id="maildesk-mailbox" type="email" value={draft.mailbox} maxLength={320} autoComplete="off" disabled={busy} onChange={event=>setDraft(current=>({...current,mailbox:event.target.value}))}/></SettingsRow>
   <SettingsRow title="Verbindung" description={settings.checkedAt?`Zuletzt geprüft ${time(settings.checkedAt)} für ${settings.checkedMailbox}: ${settings.connectionOk?'erfolgreich':'fehlgeschlagen'}`:'Noch nicht geprüft.'}><button type="button" className="settings-secondary-action" disabled={busy||!mailbox} onClick={()=>void runCheck()}>{busy?'Wird geprüft …':'Verbindung prüfen'}</button></SettingsRow>
   {check&&<Notice tone={check.ok?'success':'error'} role="status">{check.message}</Notice>}
   {draft.source==='graph'&&!checkedNow&&<Notice tone="neutral">Microsoft 365 lässt sich erst speichern, wenn „Verbindung prüfen“ für dieses Postfach in den letzten 24 Stunden erfolgreich war.</Notice>}
  </SettingsGroup>
  <SettingsGroup title="Voraussetzungen" description="Einmalig durch die IT einzurichten.">
   <SettingsRow title="Zugangsdaten" description="Dieselbe Microsoft-365-App wie für den Mailversand (Tenant, Client, Secret) – einzurichten unter „Verbindung“."><GuardedLink href="/einstellungen?bereich=graph&seite=graph%3Aconnection" className="settings-secondary-action">Zur Verbindung</GuardedLink></SettingsRow>
   <SettingsRow title="Berechtigung" description="Anwendungsberechtigung Mail.Read mit Administratorzustimmung, per Exchange-Zugriffsrichtlinie (New-ApplicationAccessPolicy … -AccessRight RestrictAccess) auf genau dieses Postfach begrenzt."><span/></SettingsRow>
  </SettingsGroup>
  <Notice tone="error" role="alert">{error}</Notice>
  <div className="account-save-bar" role="group" aria-label="Änderungen"><span role="status">{message||(dirty?'Ungespeicherte Änderungen':'Alle Änderungen gespeichert')}</span><button type="button" className="settings-secondary-action" disabled={busy||!dirty} onClick={discard}>Verwerfen</button><button type="submit" disabled={busy||!dirty||draft.source==='graph'&&!checkedNow}>Speichern</button></div>
 </form>;
}
