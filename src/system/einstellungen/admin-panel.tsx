"use client";
import {IncidentDefaultsPanel} from '../../apps/casedesk/standardpositionen/ui';
import {SharePointPanel} from '../../platform/sharepoint/ui';
import {OperationsPanel} from '../../platform/operations/ui';
import {BrowserReportsPanel} from '../../platform/http-safety/ui';
import {DataPanel} from '../../platform/data-lifecycle/ui';
import {SecretRetentionPanel} from '../../platform/secret-retention/ui';

import {BmaPanel} from '@/platform/bmacloud/panel';
import {RoleEditor} from '../../platform/app-access/editor';
import {PlatformInfo} from './platform-info';
import {CopilotPanel} from "@/apps/askelli/copilot/ui";
import {AssistantFeedbackReview} from '@/apps/askelli/elli/ui';
import {AdminWorkspace} from "./admin-workspace";
import {SettingsGroup,SettingsRow,SettingsDestination,useGuardedNavigation,SettingsPages,useSettingsPage,Notice,useNoticeState} from "@/platform/shell";
import {useSearchParams} from "next/navigation";
import type {AuditEntry} from "./audit-format";
import {MicrosoftAuthPanel} from "../anmeldung/microsoft/panel";
import {PdsPanel} from "./pds-panel";
import {MailPanel} from "./mail-panel";
import {AuditPanel} from "./audit-panel";
import {AccountDetail,CreateAccountForm,accountStatus,roleNames,type Account,type AppRole} from "./account-panel";
import {CalendarSettingsPanel,SystemSettingsPanel} from "./settings-panel";
import {useCallback,useEffect,useRef,useState} from "react";
type Overview={pdsSource:string;appRoles:AppRole[];users:Account[];sessions:{id:string;userId:string;displayName:string;createdAt:string;expiresAt:string}[];events:(AuditEntry&{createdAt:string})[]};
const time=(value:string)=>new Intl.DateTimeFormat("de-DE",{timeZone:"Europe/Berlin",dateStyle:"short",timeStyle:"short"}).format(new Date(value));
export function AdminPanel({accountName}:{accountName:string}) {
 const {message,noticeTone,setMessage,showError,showSuccess}=useNoticeState();
 const selectedUserId=useSearchParams().get('benutzer'),navigate=useGuardedNavigation();
 // Einmalig angezeigtes Startpasswort: bleibt sichtbar, bis ein anderes Konto geöffnet wird (nie gespeichert).
 const [revealed,setRevealed]=useState<{userId:string;password:string}|null>(null);
 function openUser(id:string){setRevealed(null);navigate(()=>{const url=new URL(window.location.href);url.searchParams.set('benutzer',id);window.history.pushState(null,'',url.pathname+url.search+url.hash);});}
  const [refreshKey,setRefreshKey]=useState(0);
 const [area,setArea]=useState("users");
 const systemPage=useSettingsPage('system','system',area==='system');
 const incidentPage=useSettingsPage('incident','incident',area==='incident');
 const securityPage=useSettingsPage('security','security',area==='security');
 const usersPage=useSettingsPage('users','users',area==='users'),resourcesPage=useSettingsPage('resources','colors',area==='colors');
 const userArea=usersPage.value,calendarArea=resourcesPage.value;
  const [data,setData]=useState<Overview|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const busyRef=useRef(false),request=useRef<AbortController|null>(null);
  const refresh=useCallback(async()=>{
    request.current?.abort();
    const controller=new AbortController();request.current=controller;
    try {
      const response=await fetch("/api/verwaltung",{cache:"no-store",signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])});
      const result=await response.json();
      if(controller.signal.aborted)return;
      if(!response.ok){if(response.status===401||response.status===403)setData(null);throw new Error(result.error??"Einstellungen nicht erreichbar.");}
      setData(result);setRefreshKey(value=>value+1);setMessage(previous=>previous==="Automatische Aktualisierung fehlgeschlagen. Wir versuchen es erneut."?"":previous);
    } finally {if(request.current===controller){request.current=null;setLoading(false);}}
  },[setMessage]);
  useEffect(()=>{
    let active=true;
    function load(){if(busyRef.current||document.visibilityState==="hidden")return;void refresh().catch(error=>{if(active&&error.name!=="AbortError")showError("Automatische Aktualisierung fehlgeschlagen. Wir versuchen es erneut.");});}
    load();const interval=window.setInterval(load,15000);
    window.addEventListener("heyelli:session-change",load);window.addEventListener("focus",load);window.addEventListener("online",load);document.addEventListener("visibilitychange",load);
    return ()=>{active=false;request.current?.abort();window.clearInterval(interval);window.removeEventListener("heyelli:session-change",load);window.removeEventListener("focus",load);window.removeEventListener("online",load);document.removeEventListener("visibilitychange",load);};
  },[refresh,showError]);
  async function mutate(path:string,body:unknown,method="POST") {
    busyRef.current=true;request.current?.abort();setBusy(true);setMessage("Änderung wird gespeichert …");
    try {
      const response=await fetch(path,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}),result=await response.json();
      if(!response.ok)throw new Error(result.error??"Änderung fehlgeschlagen.");
      window.dispatchEvent(new Event("heyelli:session-change"));
      await refresh();showSuccess("Änderung gespeichert.");return true;
    }catch(error){showError(error instanceof Error?error.message:"Änderung fehlgeschlagen.");return false;}
    finally{busyRef.current=false;setBusy(false);}
  }
  return <AdminWorkspace accountName={accountName} area={area} onAreaChange={setArea}>
    <Notice tone={loading?"neutral":noticeTone} aria-live="polite">{loading?"Einstellungen werden geladen …":message}</Notice>
    {!data&&!loading&&<p>Bitte oben rechts als Administrator anmelden und die Seite erneut öffnen.</p>}
    {data&&<>
      {area==="users"&&userArea==="roles"&&<RoleEditor/>}
      <div hidden={area!=="colors"}>{area==="colors"&&<SettingsPages namespace="resources" value={calendarArea} onChange={resourcesPage.select} parent="PlanBoard"/>}{area==="colors"&&calendarArea==="colors"&&<CalendarSettingsPanel/>}</div>
      {area==="system"&&<><SettingsPages namespace="system" value={systemPage.value} onChange={systemPage.select} parent="Allgemein"/>{systemPage.value==="info"&&<PlatformInfo/>}{systemPage.value==="appearance"&&<SystemSettingsPanel area="system" section="appearance"/>}</>}
      {area==="security"&&<><SettingsPages namespace="security" value={securityPage.value} onChange={securityPage.select} parent="Sicherheit"/>{securityPage.value==="sessions"&&<SystemSettingsPanel area="system" section="security"/>}{securityPage.value==="secrets"&&<SecretRetentionPanel/>}{securityPage.value==="browser"&&<BrowserReportsPanel/>}{securityPage.value==="data"&&<DataPanel admin users={data.users}/>}{securityPage.value==="operations"&&<OperationsPanel/>}</>}
      {area==="colors"&&calendarArea==="defaults"&&<SystemSettingsPanel area={area}/>}
      {(area==="email"||area==="graph")&&<MailPanel key={area} integration={area==="graph"}/>}
      {area==="incident"&&<><SettingsPages namespace="incident" value={incidentPage.value} onChange={incidentPage.select} parent="CaseDesk"/>{incidentPage.value==="positions"&&<IncidentDefaultsPanel/>}</>}
      {area==="elli"&&<AssistantFeedbackReview/>}
      {area==="copilot"&&<CopilotPanel/>}
      {area==="pds"&&<PdsPanel/>}
      {area==="sharepoint"&&<SharePointPanel/>}{area==="bmacloud"&&<BmaPanel/>}
      {area==="microsoft-auth"&&<MicrosoftAuthPanel/>}
      <div hidden={area!=="users"}>
      {area==="users"&&<SettingsPages namespace="users" value={userArea} onChange={usersPage.select} parent="Benutzer & Zugriff" counts={{accounts:data.users.length,sessions:data.sessions.length,events:data.events.length}}/>}
      <section hidden={userArea!=="accounts"}><h2 className="sr-only">Benutzerkonten</h2>
        {area==="users"&&userArea==="accounts"&&(selectedUserId?
         (data.users.some(user=>user.id===selectedUserId)?data.users.filter(user=>user.id===selectedUserId).map(user=><AccountDetail key={`${user.id}:${user.version}:${refreshKey}`} account={user} options={data.appRoles} busy={busy} mutate={mutate} pdsSource={data.pdsSource} revealed={revealed?.userId===user.id?revealed.password:undefined} onRevealed={password=>setRevealed({userId:user.id,password})}/>):<Notice tone="error">Dieses Konto ist nicht mehr verfügbar.</Notice>)
         :<SettingsGroup title="heyelli-Konten">{data.users.map(user=><SettingsDestination key={user.id} label={user.displayName} detail={`${user.username??"ohne Benutzername"} · ${data.appRoles.find(role=>role.id===user.appRoleId||!user.appRoleId&&role.id===user.role)?.name??roleNames[user.role]}${user.microsoftLinked?" · Microsoft verknüpft":""}`} initials={user.displayName.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('')} accessory={accountStatus(user)} onClick={()=>openUser(user.id)}/>)}</SettingsGroup>)}
      </section>
      <section hidden={userArea!=="create"}><h2 className="sr-only">Konto anlegen</h2>
        {area==="users"&&userArea==="create"&&<CreateAccountForm options={data.appRoles} busy={busy} onCreated={refresh}/>}
      </section>
      <section hidden={userArea!=="sessions"}><h2 className="sr-only">Aktive Sitzungen</h2><SettingsGroup title="Aktive Sitzungen">{data.sessions.map(item=><SettingsRow key={item.id} title={item.displayName} description={<><span>Angemeldet {time(item.createdAt)}</span><br/><span>Gültig bis {time(item.expiresAt)}</span></>}><button type="button" className="settings-secondary-action" disabled={busy} onClick={()=>void mutate("/api/verwaltung/sitzungen",{id:item.id},"DELETE")}>Sitzung beenden</button></SettingsRow>)}</SettingsGroup>{data.sessions.length===0&&<p>Keine aktiven Sitzungen.</p>}</section>
      {area==="users"&&userArea==="events"&&<AuditPanel users={data.users}/>}

    </div></>}
  </AdminWorkspace>;
}
