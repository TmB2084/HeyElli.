'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {Notice} from '../../platform/shell/notice';
import {SettingsGroup,SettingsIdentity,SettingsRow} from '../../platform/shell/settings-controls';
import type {AccountProfile} from './account-profile';
import styles from './account-profile-card.module.css';
const roles={admin:'Administrator',dispatcher:'Disposition',reader:'Lesezugriff'};
const employeeStates={none:'Kein PDS-Benutzer zugeordnet',missing:'Zugeordneter PDS-Benutzer nicht mehr im Verzeichnis',unavailable:'PDS-Daten derzeit nicht erreichbar',linked:''};
export function useAccountProfile(){
 const [profile,setProfile]=useState<AccountProfile|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{
  let active=true,controller:AbortController|undefined;
  async function load(){
   if(document.visibilityState==='hidden')return;controller?.abort();const current=new AbortController();controller=current;
   try{const response=await fetch('/api/benutzerkonto',{cache:'no-store',signal:AbortSignal.any([current.signal,AbortSignal.timeout(20000)])}),value=await response.json();
    if(!active||current.signal.aborted)return;
    if(!response.ok){if(response.status===401||response.status===403)setProfile(null);throw new Error(value.error??'Kontoinformationen konnten nicht geladen werden.');}
    setProfile(value);setError('');
   }catch(problem){if(active&&!current.signal.aborted)setError(problem instanceof Error&&!['TypeError','SyntaxError','AbortError','TimeoutError'].includes(problem.name)?problem.message:'Kontoinformationen konnten nicht geladen werden. Bitte erneut versuchen.');}
  }
  void load();const timer=window.setInterval(()=>void load(),30000),refresh=()=>void load();window.addEventListener('focus',refresh);window.addEventListener('heyelli:session-change',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{active=false;controller?.abort();clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('heyelli:session-change',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[revision]);
 return {profile,error,reload:()=>setRevision(value=>value+1)};
}
export function AccountProfileCard(){
 const {profile,error,reload}=useAccountProfile();
 return <section aria-label="Angemeldeter Benutzer">
  {error&&<><Notice tone="error" role="alert">{error}</Notice><button type="button" className="settings-secondary-action" onClick={reload}>Erneut laden</button></>}
  {!profile&&!error&&<Notice tone="neutral">Kontoinformationen werden geladen …</Notice>}
  {profile&&<>
   <SettingsIdentity name={profile.displayName} detail={profile.username?`Benutzername ${profile.username}`:"Angemeldet als"}/>
   <SettingsGroup title="Kontodaten">
    <SettingsRow title="Rolle"><span className={styles.value}>{profile.roleName||roles[profile.role]}</span></SettingsRow>
    {profile.roleName&&profile.roleName!==roles[profile.role]&&<SettingsRow title="Grundberechtigung"><span className={styles.value}>{roles[profile.role]}</span></SettingsRow>}
    <SettingsRow title="PDS-Benutzer"><span className={`${styles.value} ${profile.employee?'':styles.muted}`}>{profile.employee?`${profile.employee.name}${profile.employee.number?` · ${profile.employee.number}`:''}`:employeeStates[profile.employeeState]}</span></SettingsRow>
    <SettingsRow title="Angemeldet mit"><span className={styles.value}>{profile.loginMode==='microsoft'?'Microsoft-Konto':'heyelli-Passwort'}</span></SettingsRow>
   </SettingsGroup>
  </>}
 </section>;
}

// Anmeldung: eigenes heyelli-Passwort ändern und Microsoft-Konto verknüpfen (Passwort gilt bis zur Aktivierung der Microsoft-Anmeldung).
export function AccountLoginCard({passwordForm}:{passwordForm:ReactNode}){
 const {profile,error}=useAccountProfile();
 const linked=typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('microsoft')==='verknuepft';
 return <section aria-label="Anmeldung">
  {error&&<Notice tone="error" role="alert">{error}</Notice>}
  {linked&&<Notice tone="success">Microsoft-Konto verknüpft.</Notice>}
  {profile&&<>
   <SettingsGroup title="Microsoft-Konto" description="Nach Aktivierung der Microsoft-Anmeldung meldest du dich nur noch mit dem verknüpften Microsoft-Konto an.">
    <SettingsRow title="Status"><span className={styles.value}>{profile.microsoftLinked?'Verknüpft':'Nicht verknüpft'}</span></SettingsRow>
    {profile.microsoftLinkAvailable&&<SettingsRow title="Jetzt verknüpfen" description="Du wirst zur Microsoft-Anmeldung weitergeleitet und kehrst danach hierher zurück."><form action="/api/auth/microsoft/start?purpose=link" method="post"><button type="submit" className="settings-secondary-action">Mit Microsoft verknüpfen</button></form></SettingsRow>}
   </SettingsGroup>
   {profile.loginMode==='local'&&<SettingsGroup title="heyelli-Passwort" description="Mindestens 12 Zeichen. Andere angemeldete Geräte werden dabei abgemeldet.">{passwordForm}</SettingsGroup>}
  </>}
 </section>;
}
