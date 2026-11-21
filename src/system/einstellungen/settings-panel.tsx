"use client";
import {SettingsGroup,SettingsRow,AppearanceChoice,Notice,useNoticeState} from "@/platform/shell";
import {useEffect,useRef,useState} from "react";
import {useDraftNavigationGuard} from "@/platform/shell";
import {CalendarColorDialog} from "@/apps/planboard/kalender/ui";
import type {SystemSettings} from "@/platform/store";
export function CalendarSettingsPanel() {
  return <section className="admin-settings-section"><CalendarColorDialog inline onClose={()=>{}} onSaved={()=>window.dispatchEvent(new Event("heyelli:calendar-colors-change"))}/></section>;
}
export function SystemSettingsPanel({area="system",section="appearance"}:{area?:string;section?:"appearance"|"security"}) {
 const {message,noticeTone,setMessage,showError,showSuccess}=useNoticeState();
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const [dirty,setDirty]=useState(false),[failed,setFailed]=useState(false);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 const [settings,setSettings]=useState<SystemSettings|null>(null),[busy,setBusy]=useState(false);
  useDraftNavigationGuard(dirty||busy,busy,()=>{clearTimeout(timer.current);setDirty(false);});
  useEffect(()=>{
    const controller=new AbortController();
    void fetch("/api/verwaltung/einstellungen",{cache:"no-store",signal:controller.signal}).then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error);if(!controller.signal.aborted)setSettings(result);}).catch(error=>{if(!controller.signal.aborted)showError(error instanceof Error?error.message:"Systemeinstellungen konnten nicht geladen werden.");});
    return ()=>controller.abort();
  },[showError]);
  async function reload() {
    clearTimeout(timer.current);setBusy(true);setMessage("");
    try{const response=await fetch("/api/verwaltung/einstellungen",{cache:"no-store"}),result=await response.json();if(!response.ok)throw new Error(result.error);setSettings(result);setDirty(false);setFailed(false);}catch(error){showError(error instanceof Error?error.message:"Laden fehlgeschlagen.");}finally{setBusy(false);}
  }
  function update(value:SystemSettings){setSettings(value);clearTimeout(timer.current);setDirty(true);setFailed(false);if(!Number.isInteger(value.sessionDurationMinutes)||value.sessionDurationMinutes<5||value.sessionDurationMinutes>1440){showError("Sitzungsdauer: Bitte eine ganze Zahl zwischen 5 und 1440 Minuten eingeben.");return;}setMessage("Änderungen werden automatisch gespeichert …");timer.current=setTimeout(()=>void save(value),650);}
  async function save(value:SystemSettings|null=settings){
    clearTimeout(timer.current);if(!value||busy)return;if(!Number.isInteger(value.sessionDurationMinutes)||value.sessionDurationMinutes<5||value.sessionDurationMinutes>1440){showError("Sitzungsdauer: Bitte eine ganze Zahl zwischen 5 und 1440 Minuten eingeben.");return;}setBusy(true);setFailed(false);setMessage("Änderungen werden gespeichert …");
    try{const response=await fetch("/api/verwaltung/einstellungen",{method:"POST",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(20000),body:JSON.stringify(value)}),result=await response.json();if(!response.ok)throw new Error(result.error);setSettings(result);setDirty(false);showSuccess(area==="colors"?"Kalendervorgaben gespeichert.":"Systemeinstellungen gespeichert.");}catch(error){setFailed(true);showError(error instanceof Error?error.message:"Speichern fehlgeschlagen. Eingaben sind noch nicht gespeichert.");}finally{setBusy(false);}
  }
  return <section className="admin-settings-section" hidden={area!=="colors"&&area!=="system"}><h2 className="sr-only">{area==="colors"?"Standardanzeige für den PlanBoard":"Zentrale Systemeinstellungen"}</h2>
    <Notice tone={noticeTone}>{message||(!settings?"Systemeinstellungen werden geladen …":"")}</Notice>
    {settings&&<form onSubmit={event=>{event.preventDefault();void save();}}><fieldset disabled={busy} className="settings-form-frame"><legend className="sr-only">{area==="system"?"Systemvorgaben":"Vorgaben für neue Profile"}</legend>
      {area==="system"?<>
       {section==="appearance"&&<SettingsGroup title="Darstellung"><SettingsRow title="Standarddarstellung" description="Vorgabe für neue Benutzerprofile." wide><AppearanceChoice value={settings.defaultAppearance} label="Standarddarstellung" disabled={busy} onChange={value=>update({...settings,defaultAppearance:value})}/></SettingsRow></SettingsGroup>}
       {section==="security"&&<SettingsGroup title="Sicherheit"><SettingsRow title="Sitzungsdauer" description="5–1440 Minuten · gilt ab der nächsten Anmeldung." controlId="system-session-duration"><input id="system-session-duration" type="number" aria-label="Sitzungsdauer (Minuten)" min={5} max={1440} step={1} required value={settings.sessionDurationMinutes} onChange={event=>update({...settings,sessionDurationMinutes:Number(event.target.value)})}/><span className="settings-unit">Min.</span></SettingsRow></SettingsGroup>}
      </>:<SettingsGroup title="Vorgaben für neue Profile">
       <SettingsRow title="Techniker-Badges" description="Haupttechniker und Begleiter kennzeichnen." controlId="default-badges"><input id="default-badges" type="checkbox" className="heyelli-switch" role="switch" checked={settings.showTechnicianBadges} onChange={event=>update({...settings,showTechnicianBadges:event.target.checked})}/></SettingsRow>
       <SettingsRow title="Arbeitszeiten" description="Kalender auf Arbeitszeiten begrenzen." controlId="default-hours"><input id="default-hours" type="checkbox" className="heyelli-switch" role="switch" checked={settings.limitWorkingHours} onChange={event=>update({...settings,limitWorkingHours:event.target.checked})}/></SettingsRow>
       <SettingsRow title="Vorgemerkte Termine" controlId="default-tentative"><input id="default-tentative" type="checkbox" className="heyelli-switch" role="switch" checked={settings.showTentative} onChange={event=>update({...settings,showTentative:event.target.checked})}/></SettingsRow>
      </SettingsGroup>}
      {failed&&<div className="incident-actions"><button type="button" onClick={()=>void save()}>Erneut versuchen</button><button type="button" className="skip-planning-button" onClick={()=>void reload()}>Gespeicherten Stand laden</button></div>}
    </fieldset></form>}
    {!settings&&<button disabled={busy} onClick={()=>void reload()}>Erneut laden</button>}
  </section>;
}
