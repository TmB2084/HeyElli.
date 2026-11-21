'use client';
import {useCallback,useEffect,useState} from 'react';
import {ConfirmationDialog,Notice,SettingsGroup,SettingsRow,useDraftNavigationGuard} from '@/platform/shell';
import {previewPath,type StorageType} from './layout';
import styles from './documents.module.css';
// Einstellungen → SharePoint → Ablagestruktur: Ordnervorgabe sichtbar machen, Ablagetypen pflegen, bisherige Ablage übernehmen.
type Row={key?:string;label:string;active:boolean};
type Plan={items:{scope:string;kind:string;title:string;files:number;target:string}[];unmatched:number};
const example={kind:'unit' as const,city:'Duisburg',street:'Hauptstraße 21',trade:'Brandmelde',unitName:'Brandmeldeanlage',unitId:'4711'};
export function SharePointStoragePanel({enabled}:{enabled:boolean}){
 const [saved,setSaved]=useState<StorageType[]|null>(null),[rows,setRows]=useState<Row[]>([]),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[plan,setPlan]=useState<Plan|null>(null),[confirming,setConfirming]=useState(false);
 const apply=useCallback((types:StorageType[])=>{setSaved(types);setRows(types.map(type=>({key:type.key,label:type.label,active:type.active})));},[]);
 useEffect(()=>{void(async()=>{try{const response=await fetch('/api/verwaltung/sharepoint/ablage',{cache:'no-store'}),value=await response.json();if(!response.ok)throw Error(value.error);apply(value.types);}catch(problem){setError(problem instanceof Error?problem.message:'Ablagestruktur nicht erreichbar.');}})();},[apply]);
 const dirty=!!saved&&JSON.stringify(rows)!==JSON.stringify(saved.map(type=>({key:type.key,label:type.label,active:type.active})));
 const discard=useCallback(()=>{if(saved)apply(saved);},[saved,apply]);
 useDraftNavigationGuard(dirty,busy,discard);
 async function post(body:Record<string,unknown>){const response=await fetch('/api/verwaltung/sharepoint/ablage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(120000)}),value=await response.json();if(!response.ok)throw Error(value.error);return value;}
 async function save(){setBusy(true);setError('');setMessage('');try{apply((await post({action:'types',types:rows})).types);setMessage('Ablagetypen gespeichert.');}catch(problem){setError(problem instanceof Error?problem.message:'Speichern nicht möglich.');}finally{setBusy(false);}}
 async function loadPlan(){setBusy(true);setError('');setMessage('');try{setPlan(await post({action:'plan'}));}catch(problem){setError(problem instanceof Error?problem.message:'Vorschau nicht möglich.');}finally{setBusy(false);}}
 async function migrate(){setConfirming(false);if(!plan)return;setBusy(true);setError('');try{const value=await post({action:'migrate',confirm:true,scopes:plan.items.map(item=>item.scope)}),moved=value.results.reduce((sum:number,item:{moved:number})=>sum+item.moved,0),failed=value.results.filter((item:{error?:string})=>item.error);setMessage(`${moved} Dateien übernommen.${failed.length?` ${failed.length} Akten nicht übernommen: ${failed[0].error}`:''}`);setPlan(null);}catch(problem){setError(problem instanceof Error?problem.message:'Übernahme nicht möglich.');}finally{setBusy(false);}}
 const move=(index:number,delta:number)=>setRows(current=>{const next=[...current],target=index+delta;if(target<0||target>=next.length)return current;[next[index],next[target]]=[next[target],next[index]];return next;});
 return <div className="account-form">
  <SettingsGroup title="Ordnerstruktur" description="Alle Dokumente werden nach Objekt und technischer Einheit abgelegt; Kundendokumente ohne Einheit beim Kunden.">
   <SettingsRow title="Technische Einheit" description={previewPath(example,rows.find(row=>row.active)?.label??'Mails')}><span/></SettingsRow>
   <SettingsRow title="Herkunft der Angaben" description="Aus PDS: Stadt und Straße mit Hausnummer vom Objektstandort, Gewerk = Fachbereich der Anlage, Einheit = Bezeichnung und PDS-ID. Fehlende Angaben erscheinen als ohne_ort, ohne_adresse bzw. ohne_gewerk."><span/></SettingsRow>
   <SettingsRow title="Objekt ohne Einheit" description={previewPath({kind:'object',city:'Duisburg',street:'Hauptstraße 21'},'Berichte')}><span/></SettingsRow>
   <SettingsRow title="Kunde ohne Einheit" description={previewPath({kind:'customer',customerName:'Musterwerk West',customerNumber:'K-200'},'Mails')}><span/></SettingsRow>
   <SettingsRow title="Serviceauftrag" description="Beim Gewerk und der Einheit seines Einsatzes; der Dateiname beginnt mit der Auftragsnummer."><span/></SettingsRow>
   <SettingsRow title="Vertrag" description={previewPath({kind:'contract',customerName:'Musterwerk West',customerNumber:'K-200',contractName:'Wartung BMA'})}><span/></SettingsRow>
  </SettingsGroup>
  <SettingsGroup title="Ablagetypen" description="Unterordner je Akte. Umbenennen gilt für neue Ordner; vorhandene Ordner behalten ihren Namen und bleiben zugeordnet. Ausgeblendete Typen stehen beim Hochladen nicht mehr zur Wahl.">
   {!saved&&!error&&<p role="status">Ablagetypen werden geladen …</p>}
   <ul className={styles.typeList} aria-label="Ablagetypen">{rows.map((row,index)=><li key={row.key??'neu-'+index}>
    <input aria-label={`Bezeichnung ${index+1}`} value={row.label} maxLength={60} disabled={busy} onChange={event=>setRows(current=>current.map((item,position)=>position===index?{...item,label:event.target.value}:item))}/>
    <label className="check-label"><input type="checkbox" className="heyelli-switch" role="switch" checked={row.active} disabled={busy} onChange={event=>setRows(current=>current.map((item,position)=>position===index?{...item,active:event.target.checked}:item))}/>Aktiv</label>
    <button type="button" className="settings-secondary-action" aria-label={`${row.label} nach oben`} disabled={busy||index===0} onClick={()=>move(index,-1)}>↑</button>
    <button type="button" className="settings-secondary-action" aria-label={`${row.label} nach unten`} disabled={busy||index===rows.length-1} onClick={()=>move(index,1)}>↓</button>
   </li>)}</ul>
   <p><button type="button" className="settings-secondary-action" disabled={busy||rows.length>=30} onClick={()=>setRows(current=>[...current,{label:'Neuer Ablagetyp',active:true}])}>Ablagetyp hinzufügen</button></p>
  </SettingsGroup>
  <SettingsGroup title="Bisherige Ablage übernehmen" description="Dateien aus den bisherigen Ordnern „heyelli-…“ werden in die neue Struktur unter „Sonstiges“ verschoben. Nichts wird gelöscht; nicht zuordenbare Ordner bleiben unverändert.">
   <SettingsRow title="Vorschau" description={!enabled?'Erst nach Freigabe von SharePoint möglich.':plan?`${plan.items.length} Akten mit ${plan.items.reduce((sum,item)=>sum+item.files,0)} Dateien${plan.unmatched?`, ${plan.unmatched} nicht zuordenbar`:''}`:'Zeigt, welche Ordner wohin verschoben werden.'}><button type="button" className="settings-secondary-action" disabled={busy||!enabled} onClick={()=>void loadPlan()}>Vorschau erstellen</button></SettingsRow>
   {plan&&plan.items.length>0&&<><ul className={styles.planList} aria-label="Übernahme-Vorschau">{plan.items.map(item=><li key={item.scope}><b>{item.title}</b><small>{item.files} Dateien → {item.target}</small></li>)}</ul><p><button type="button" disabled={busy} onClick={()=>setConfirming(true)}>Übernahme starten</button></p></>}
   {plan&&!plan.items.length&&<p className="settings-hint">Keine bisherige Ablage zum Übernehmen gefunden.</p>}
  </SettingsGroup>
  <Notice tone="error" role="alert">{error}</Notice>
  <ConfirmationDialog open={confirming} title="Bisherige Ablage übernehmen?" description={`${plan?.items.length??0} Akten werden in die neue Ordnerstruktur verschoben. Dateien werden nicht gelöscht; Links auf die alten Ordner funktionieren danach nicht mehr.`} confirmLabel="Übernehmen" busy={busy} onCancel={()=>setConfirming(false)} onConfirm={()=>void migrate()}/>
  <div className="account-save-bar" role="group" aria-label="Änderungen"><span role="status">{message||(dirty?'Ungespeicherte Änderungen':'Alle Änderungen gespeichert')}</span><button type="button" className="settings-secondary-action" disabled={busy||!dirty} onClick={discard}>Verwerfen</button><button type="button" disabled={busy||!dirty} onClick={()=>void save()}>Speichern</button></div>
 </div>;
}
