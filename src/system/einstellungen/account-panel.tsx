"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import {SettingsGroup,SettingsRow,SettingsIdentity,Notice,useDraftNavigationGuard} from "@/platform/shell";
import type {Role} from "../../platform/store/index";

// heyelli-Konten: Anmeldung (Benutzername, Startpasswort), Microsoft-Verknüpfung, PDS-Benutzer der aktiven Quelle, Zugriff.
export type AppRole={id:string;name:string;baseRole:Role};
export type Account={id:string;displayName:string;role:Role;appRoleId?:string|null;enabled:boolean;version:number;username:string|null;microsoftUpn:string|null;microsoftLinked:boolean;microsoftLinkedAt:string|null;hasPassword:boolean;passwordMustChange:boolean;pdsUserUUID:string|null};
type Person={id:string;name:string;number:string;group:string;assignedTo?:string|null};
type Mutate=(path:string,body:unknown)=>Promise<boolean>;
export const roleNames:Record<Role,string>={admin:"Administrator",dispatcher:"Disposition",reader:"Lesezugriff"};
const time=(value:string)=>new Intl.DateTimeFormat("de-DE",{timeZone:"Europe/Berlin",dateStyle:"short",timeStyle:"short"}).format(new Date(value));
export function roleChoice<T extends {role:Role;appRoleId?:string|null}>(user:T,options:AppRole[],id:string):T{const role=options.find(item=>item.id===id);return {...user,role:id==="admin"?"admin":role!.baseRole,appRoleId:id==="admin"||id==="reader"||id==="dispatcher"?null:id};}
export function accountStatus(account:Account){
 if(!account.enabled)return "Deaktiviert";
 if(!account.pdsUserUUID&&account.role!=="admin")return "PDS-Benutzer fehlt";
 if(!account.hasPassword&&!account.microsoftLinked)return "Keine Anmeldung möglich";
 return "Aktiv";
}

// PDS-Benutzer der aktiven Quelle (Simulator oder echtes PDS); einmal je Ansicht geladen.
function usePdsDirectory(){
 const [people,setPeople]=useState<Person[]|null>(null),[error,setError]=useState("");
 const load=useCallback(async()=>{try{const response=await fetch("/api/verwaltung/benutzer",{cache:"no-store",signal:AbortSignal.timeout(20000)}),result=await response.json();if(!response.ok)throw Error(result.error);setPeople(result.directory);setError("");}catch(caught){setError(caught instanceof Error&&caught.message?caught.message:"PDS-Benutzer nicht abrufbar.");}},[]);
 useEffect(()=>{void(async()=>{await load();})();},[load]);
 return {people,error};
}

// Startpasswort: einmalig sichtbar, mit Kopierknopf. Wird nirgends gespeichert oder protokolliert.
function InitialPassword({username,password}:{username:string;password:string}){
 const [copied,setCopied]=useState(false);
 async function copy(){try{await navigator.clipboard.writeText(password);setCopied(true);}catch{setCopied(false);}}
 return <Notice tone="success" className="initial-password">Startpasswort für <strong>{username}</strong>: <code>{password}</code> <button type="button" className="settings-secondary-action" onClick={()=>void copy()}>{copied?"Kopiert":"Kopieren"}</button><br/>Nur jetzt sichtbar. Sicher übergeben (z. B. persönlich oder telefonisch, nicht per Mail). Bei der ersten Anmeldung muss es geändert werden.</Notice>;
}
type Draft={displayName:string;username:string;microsoftUpn:string;role:string;enabled:boolean;pdsUserUUID:string};
const draftOf=(account:Account):Draft=>({displayName:account.displayName,username:account.username??"",microsoftUpn:account.microsoftUpn??"",role:account.appRoleId??account.role,enabled:account.enabled,pdsUserUUID:account.pdsUserUUID??""});
function roleFields(role:string,options:AppRole[]){return {role:role==="admin"?"admin" as Role:options.find(item=>item.id===role)?.baseRole??role as Role,appRoleId:["admin","reader","dispatcher"].includes(role)?null:role};}
function PdsChoice({id,people,error,value,onChange,disabled,label,accountId}:{id:string;people:Person[]|null;error:string;value:string;onChange:(value:string)=>void;disabled:boolean;label:string;accountId?:string}){
 if(!people)return <span>{error||"PDS-Benutzer werden geladen …"}</span>;
 return <select id={id} aria-label={label} value={value} disabled={disabled} onChange={event=>onChange(event.target.value)}><option value="">Keine Zuordnung</option>{people.map(item=>{const taken=!!item.assignedTo&&item.assignedTo!==accountId;return <option key={item.id} value={item.id} disabled={taken}>{item.name}{item.number?` · ${item.number}`:""}{item.group?` (${item.group})`:""}{taken?" – bereits zugeordnet":""}</option>;})}</select>;
}

// Ein Formular, ein Speichern: alle Kontofelder gemeinsam; Warnung beim Verlassen mit ungespeicherten Änderungen.
// Das Startpasswort liegt beim Aufrufer (revealed), damit es das Neuladen des Kontos (neue Version → neuer Schlüssel) übersteht.
export function AccountDetail({account,options,busy,mutate,pdsSource,revealed,onRevealed}:{account:Account;options:AppRole[];busy:boolean;mutate:Mutate;pdsSource:string;revealed?:string;onRevealed?:(password:string)=>void}){
 const {people,error}=usePdsDirectory();
 const [draft,setDraft]=useState<Draft>(()=>draftOf(account)),[passwordError,setPasswordError]=useState("");const initialPassword=revealed??"";
 const original=draftOf(account),dirty=JSON.stringify(draft)!==JSON.stringify(original);
 const discard=useCallback(()=>setDraft(draftOf(account)),[account]);
 useDraftNavigationGuard(dirty,busy,discard);
 const set=(patch:Partial<Draft>)=>setDraft(value=>({...value,...patch}));
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!dirty)return;
  const body={action:"update",id:account.id,version:account.version,displayName:draft.displayName.trim(),username:draft.username.trim()||null,microsoftUpn:draft.microsoftUpn.trim()||null,enabled:draft.enabled,...roleFields(draft.role,options),...(draft.pdsUserUUID!==original.pdsUserUUID?{pdsUserUUID:draft.pdsUserUUID||null}:{})};
  await mutate("/api/verwaltung/benutzer",body);
 }
 async function resetPassword(){
  setPasswordError("");
  try{const response=await fetch("/api/verwaltung/benutzer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"reset-password",userId:account.id})}),result=await response.json();if(!response.ok)throw Error(result.error);onRevealed?.(result.initialPassword);window.dispatchEvent(new Event("heyelli:session-change"));}
  catch(caught){setPasswordError(caught instanceof Error&&caught.message?caught.message:"Startpasswort konnte nicht erzeugt werden.");}
 }
 const person=people?.find(item=>item.id===account.pdsUserUUID);
 const passwordState=account.passwordMustChange?"Startpasswort vergeben, Änderung bei der nächsten Anmeldung erforderlich":account.hasPassword?"Eigenes Passwort gesetzt":"Kein Passwort";
 return <form onSubmit={save} className="account-form">
  <SettingsIdentity name={account.displayName} detail={account.username?`Benutzername ${account.username}`:"Benutzername fehlt"}/>
  <fieldset disabled={busy} className="account-fieldset">
  <SettingsGroup title="Anmeldung" description="Gilt, solange die Microsoft-Anmeldung nicht aktiv ist. Änderungen beenden bestehende Sitzungen des Kontos.">
   <SettingsRow title="Anzeigename" controlId={`name-${account.id}`}><input id={`name-${account.id}`} value={draft.displayName} onChange={event=>set({displayName:event.target.value})} required maxLength={100}/></SettingsRow>
   <SettingsRow title="Benutzername" controlId={`username-${account.id}`}><input id={`username-${account.id}`} value={draft.username} onChange={event=>set({username:event.target.value.toLowerCase()})} required pattern="[a-z0-9][a-z0-9._\-]{2,79}" maxLength={80} autoComplete="off" title="3 bis 80 Zeichen: Kleinbuchstaben, Ziffern, Punkt, Bindestrich, Unterstrich"/></SettingsRow>
   <SettingsRow title="Passwort" description={passwordState}><button type="button" className="settings-secondary-action" disabled={busy||!account.username||dirty} title={dirty?"Zuerst die Änderungen speichern":undefined} onClick={()=>void resetPassword()}>{account.hasPassword?"Startpasswort neu vergeben":"Startpasswort erzeugen"}</button></SettingsRow>
   <Notice tone="error">{passwordError}</Notice>
   {initialPassword&&account.username&&<InitialPassword username={account.username} password={initialPassword}/>}
  </SettingsGroup>
  <SettingsGroup title="Microsoft-Konto" description="Nach Aktivierung der Microsoft-Anmeldung meldet sich das Konto nur noch mit dem verknüpften Microsoft-Konto an.">
   <SettingsRow title="Status" description={account.microsoftLinked?`Verknüpft${account.microsoftLinkedAt?` seit ${time(account.microsoftLinkedAt)}`:""}`:account.microsoftUpn?"Noch nicht verknüpft – verknüpft sich bei der ersten Microsoft-Anmeldung mit dieser Adresse":"Nicht verknüpft"}>{account.microsoftLinked&&<button type="button" className="settings-secondary-action" disabled={busy||dirty} onClick={()=>void mutate("/api/verwaltung/benutzer",{action:"unlink-microsoft",userId:account.id})}>Verknüpfung lösen</button>}</SettingsRow>
   <SettingsRow title="Microsoft-Anmeldeadresse" description="Optional. Die erste Microsoft-Anmeldung mit genau dieser Adresse (UPN) verknüpft das Konto. Alternativ verknüpft der Benutzer selbst im Benutzerkonto." controlId={`upn-${account.id}`}><input id={`upn-${account.id}`} type="email" value={draft.microsoftUpn} onChange={event=>set({microsoftUpn:event.target.value})} maxLength={254} autoComplete="off"/></SettingsRow>
  </SettingsGroup>
  <SettingsGroup title="PDS-Benutzer" description={`Pflicht für die Anmeldung (Administratoren ausgenommen). Gilt für die aktive Quelle: ${pdsSource==="pds-readonly"?"echtes PDS":"PDS-Simulator"}.`}>
   <SettingsRow title="Zugeordnet" controlId={`pds-${account.id}`} description={account.pdsUserUUID?(person?`${person.name}${person.number?` · ${person.number}`:""}`:`Kennung ${account.pdsUserUUID}`):"Kein PDS-Benutzer zugeordnet"}><PdsChoice id={`pds-${account.id}`} label={`PDS-Benutzer für ${account.displayName}`} people={people} error={error} value={draft.pdsUserUUID} disabled={busy} accountId={account.id} onChange={value=>set({pdsUserUUID:value})}/></SettingsRow>
  </SettingsGroup>
  <SettingsGroup title="Zugriff" description="Rollenänderungen und Sperrungen beenden bestehende Sitzungen.">
   <SettingsRow title="Rolle" controlId={`role-${account.id}`}><select id={`role-${account.id}`} aria-label={`Rolle für ${account.displayName}`} value={draft.role} onChange={event=>set({role:event.target.value})}><option value="admin">Administrator</option>{options.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></SettingsRow>
   <SettingsRow title="Konto aktiv" controlId={`enabled-${account.id}`}><input id={`enabled-${account.id}`} type="checkbox" className="heyelli-switch" role="switch" checked={draft.enabled} onChange={event=>set({enabled:event.target.checked})}/></SettingsRow>
  </SettingsGroup>
  </fieldset>
  <div className="account-save-bar" role="group" aria-label="Änderungen"><span role="status">{dirty?"Ungespeicherte Änderungen":"Alle Änderungen gespeichert"}</span><button type="button" className="settings-secondary-action" disabled={busy||!dirty} onClick={discard}>Verwerfen</button><button type="submit" disabled={busy||!dirty}>Änderungen speichern</button></div>
 </form>;
}

// Neues Konto in einem Schritt: Angaben, PDS-Benutzer und Startpasswort; Passwort danach einmalig sichtbar.
export function CreateAccountForm({options,busy,onCreated}:{options:AppRole[];busy:boolean;onCreated:()=>Promise<void>|void}){
 const {people,error:pdsError}=usePdsDirectory();
 const empty={displayName:"",username:"",microsoftUpn:"",role:"reader",enabled:true,pdsUserUUID:"",initialPassword:true};
 const [draft,setDraft]=useState(empty),[saving,setSaving]=useState(false),[error,setError]=useState(""),[created,setCreated]=useState<{username:string;password:string|null;name:string}|null>(null);
 const dirty=!created&&JSON.stringify(draft)!==JSON.stringify(empty);
 const discard=useCallback(()=>setDraft(empty),[]);// eslint-disable-line react-hooks/exhaustive-deps
 useDraftNavigationGuard(dirty,saving,discard);
 const set=(patch:Partial<typeof empty>)=>setDraft(value=>({...value,...patch}));
 async function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setSaving(true);setError("");
  try{
   const response=await fetch("/api/verwaltung/benutzer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"create",version:0,displayName:draft.displayName.trim(),username:draft.username.trim(),microsoftUpn:draft.microsoftUpn.trim()||null,enabled:draft.enabled,...roleFields(draft.role,options),pdsUserUUID:draft.pdsUserUUID||null,initialPassword:draft.initialPassword})}),result=await response.json();
   if(!response.ok)throw Error(result.error);
   setCreated({username:draft.username.trim(),password:result.initialPassword,name:draft.displayName.trim()});setDraft(empty);window.dispatchEvent(new Event("heyelli:session-change"));await onCreated();
  }catch(caught){setError(caught instanceof Error&&caught.message?caught.message:"Konto konnte nicht angelegt werden. Eingaben bleiben erhalten.");}
  finally{setSaving(false);}
 }
 if(created)return <div className="admin-new-assignment"><Notice tone="success" role="status">Konto „{created.name}“ angelegt.</Notice>{created.password?<InitialPassword username={created.username} password={created.password}/>:<p className="settings-hint">Ohne Startpasswort angelegt. Ein Startpasswort lässt sich im Konto jederzeit erzeugen.</p>}<div className="admin-new-assignment-actions"><button type="button" onClick={()=>setCreated(null)}>Weiteres Konto anlegen</button></div></div>;
 return <form className="admin-new-assignment" onSubmit={create}><fieldset disabled={busy||saving}><legend>Neues heyelli-Konto</legend><div className="incident-grid">
  <label>Anzeigename<input name="displayName" value={draft.displayName} onChange={event=>set({displayName:event.target.value})} required maxLength={100}/></label>
  <label>Benutzername<input name="username" value={draft.username} onChange={event=>set({username:event.target.value.toLowerCase()})} required pattern="[a-z0-9][a-z0-9._\-]{2,79}" maxLength={80} autoComplete="off" title="3 bis 80 Zeichen: Kleinbuchstaben, Ziffern, Punkt, Bindestrich, Unterstrich"/></label>
  <label>Microsoft-Anmeldeadresse (optional)<input name="microsoftUpn" type="email" value={draft.microsoftUpn} onChange={event=>set({microsoftUpn:event.target.value})} maxLength={254} autoComplete="off"/></label>
  <label>heyelli-Rolle<select value={draft.role} onChange={event=>set({role:event.target.value})}><option value="admin">Administrator</option>{options.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
  <label>PDS-Benutzer{draft.role!=="admin"?" (für die Anmeldung nötig)":" (optional)"}<PdsChoice id="new-account-pds" label="PDS-Benutzer" people={people} error={pdsError} value={draft.pdsUserUUID} disabled={busy||saving} onChange={value=>set({pdsUserUUID:value})}/></label>
 </div>
 <Notice tone="error" role="alert">{error}</Notice>
 <div className="admin-new-assignment-actions"><label className="check-label"><input type="checkbox" className="heyelli-switch" role="switch" checked={draft.initialPassword} onChange={event=>set({initialPassword:event.target.checked})}/>Startpasswort erzeugen</label><label className="check-label"><input name="enabled" type="checkbox" className="heyelli-switch" role="switch" checked={draft.enabled} onChange={event=>set({enabled:event.target.checked})}/>Konto aktivieren</label><button disabled={saving}>{saving?"Wird angelegt …":"Konto anlegen"}</button></div></fieldset></form>;
}
