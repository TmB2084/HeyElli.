"use client";
import {Notice} from "../../platform/shell/notice";
import {AppearanceChoice} from "./appearance-choice";
import {SettingsGroup,SettingsRow} from "../../platform/shell/settings-controls";
import {useEffect,useRef,useState} from "react";
import type {Appearance} from "@/apps/planboard/kalender/domain";
const storageKey="heyelli:appearance";
function localAppearance(fallback:Appearance="dark"):Appearance {
  try{const value=localStorage.getItem(storageKey);return value==="light"||value==="system"||value==="dark"?value:fallback;}catch{return fallback;}
}
function apply(value:Appearance) {
  document.documentElement.dataset.theme=value==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):value;
}
export function AppearanceSettings({controls=false}:{controls?:boolean}) {
  const [appearance,setAppearance]=useState<Appearance>("dark"),[notice,setNotice]=useState(""),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[personal,setPersonal]=useState(false);
  const context=useRef<{owner:string|null;version:number|null;epoch:number;appearance:Appearance}>({owner:null,version:null,epoch:0,appearance:"dark"});
  useEffect(()=>{
    let active=true;const media=window.matchMedia("(prefers-color-scheme: dark)");
    async function load() {
      const epoch=++context.current.epoch;setReady(false);setBusy(false);
      try {
        const response=await fetch("/api/einstellungen",{cache:"no-store"});
        if(!active||context.current.epoch!==epoch)return;
        if(response.status===401) {
          const value=localAppearance();context.current={owner:null,version:null,epoch,appearance:value};apply(value);setAppearance(value);setPersonal(false);setNotice("");setReady(true);return;
        }
        let result=await response.json();if(!response.ok)throw new Error(result.error);
        if(!active||context.current.epoch!==epoch)return;
        if(result.appearance===null) {
          const imported=await fetch("/api/einstellungen",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({appearance:localAppearance(result.defaultAppearance),owner:result.owner,expectedVersion:result.version,importIfUnset:true})});
          result=await imported.json();if(!imported.ok)throw new Error(result.error);
        }
        if(!active||context.current.epoch!==epoch)return;
        context.current={owner:result.owner,version:result.version,epoch,appearance:result.appearance};apply(result.appearance);setAppearance(result.appearance);setPersonal(true);setNotice("");setReady(true);
      }catch(error){if(active&&context.current.epoch===epoch){setNotice(error instanceof Error?error.message:"Darstellung konnte nicht geladen werden.");setReady(false);}}
    }
    const initial=localAppearance();apply(initial);context.current.appearance=initial;
    const frame=requestAnimationFrame(()=>void load());
    const system=()=>apply(context.current.appearance);
    const refresh=()=>void load();
    const storage=(event:StorageEvent)=>{if(event.key===storageKey&&context.current.owner===null)void load();};
    media.addEventListener("change",system);window.addEventListener("heyelli:session-change",refresh);window.addEventListener("focus",refresh);window.addEventListener("heyelli:appearance-change",refresh);window.addEventListener("storage",storage);
    return ()=>{active=false;context.current.epoch++;cancelAnimationFrame(frame);media.removeEventListener("change",system);window.removeEventListener("heyelli:session-change",refresh);window.removeEventListener("focus",refresh);window.removeEventListener("heyelli:appearance-change",refresh);window.removeEventListener("storage",storage);};
  },[]);
  async function change(value:Appearance) {
    if(!ready||busy)return;
    const current={...context.current};setBusy(true);setNotice("");
    try {
      if(current.owner!==null) {
        const response=await fetch("/api/einstellungen",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({appearance:value,owner:current.owner,expectedVersion:current.version})});
        const result=await response.json();if(!response.ok)throw new Error(result.error);
        if(context.current.epoch!==current.epoch)return;
        context.current.version=result.version;
      }else {
        try{localStorage.setItem(storageKey,value);}catch{setNotice("Die Auswahl gilt nur bis zum Neuladen; der Browser erlaubt kein Speichern.");}
      }
      if(context.current.epoch!==current.epoch)return;
      context.current.appearance=value;setAppearance(value);apply(value);window.dispatchEvent(new Event("heyelli:appearance-change"));
    }catch(error){if(context.current.epoch===current.epoch)setNotice(error instanceof Error?error.message:"Darstellung konnte nicht gespeichert werden. Bitte neu laden.");}
    finally{if(context.current.epoch===current.epoch)setBusy(false);}
  }
  if(!controls)return null;
  return <section className="personal-appearance"><h2 className="sr-only">Anzeigeeinstellungen</h2>
      <fieldset className="settings-form-frame" disabled={!ready||busy}><legend className="sr-only">Anzeigeeinstellungen</legend><SettingsGroup title="Darstellung"><SettingsRow title="Erscheinungsbild" wide><AppearanceChoice value={appearance} disabled={!ready||busy} onChange={value=>void change(value)}/></SettingsRow></SettingsGroup></fieldset>

      {ready&&!personal&&<small>Ohne Anmeldung gilt die Auswahl in diesem Browser.</small>}<Notice tone={busy?"neutral":notice?"error":"neutral"}>{busy?"Wird gespeichert …":notice}</Notice>
    </section>;
}
