"use client";
import {AppGlyph} from './app-glyph';
import {Notice} from "./notice";
import {useNoticeState} from "./notice-state";
import {useRouter} from "next/navigation";
import {useEffect,useState,type FormEvent} from "react";
import {GuardedLink} from "./navigation-guard";
import {Dropdown} from "./dropdown";
export function UserMenu() {
 const {message,noticeTone,setMessage,showError,showSuccess}=useNoticeState();
  const router=useRouter();
  const [roleName,setRoleName]=useState(""),[role,setRole]=useState(""),[loggedIn,setLoggedIn]=useState(false),[displayName,setDisplayName]=useState("");
  const [microsoftAvailable,setMicrosoftAvailable]=useState(false);
  const [ready,setReady]=useState(false),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false);
  useEffect(()=>{
    let active=true;
    async function refresh(){
      try {
        const response=await fetch("/api/simulator-session",{cache:"no-store"});if(!response.ok)throw new Error();const result=await response.json();
        if(!active)return;
        setRole(result.user?.role??"");setRoleName(result.user?.roleName??"");setLoggedIn(result.authenticated);setDisplayName(result.user?.displayName ?? "");setReady(result.configured);setMicrosoftAvailable(!!result.microsoftAvailable);setLoaded(true);
        if(!result.configured&&!result.microsoftAvailable)showError("Die Anmeldung ist noch nicht vollständig eingerichtet.");
      }catch{if(active){setLoggedIn(false);setRole("");setRoleName("");setLoaded(true);setReady(false);showError("Anmeldung nicht erreichbar.");}}
    }
    void refresh();window.addEventListener("focus",refresh);window.addEventListener("heyelli:session-change",refresh);
    return ()=>{active=false;window.removeEventListener("focus",refresh);window.removeEventListener("heyelli:session-change",refresh);};
  },[setMessage,showError]);
  async function login(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setMessage("");const form=event.currentTarget,data=new FormData(form);
    try {
      const response=await fetch("/api/simulator-session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:String(data.get("username")??""),password:String(data.get("password")??"")})});
      const result=await response.json();if(!response.ok)throw new Error(result.error);
      if(result.mustChangePassword){window.location.replace("/passwort-aendern");return;}
      window.dispatchEvent(new Event("heyelli:session-change"));setRole(result.user?.role??"");setRoleName(result.user?.roleName??"");setLoggedIn(true);setDisplayName(result.user?.displayName ?? "Benutzer");form.reset();router.refresh();
      const details=form.closest("details");if(details){details.open=false;details.querySelector("summary")?.focus();}
    }catch(error){showError(error instanceof Error ? error.message : "Anmeldung nicht erreichbar.");}
    finally{const field=form.elements.namedItem("password");if(field instanceof HTMLInputElement)field.value="";setBusy(false);}
  }
  async function logout(){
    setBusy(true);setMessage("");
    try{const response=await fetch("/api/simulator-session",{method:"DELETE"});if(!response.ok)throw new Error();try{localStorage.setItem('heyelli:session-ended',crypto.randomUUID());}catch{/* The server session is still revoked. */}window.dispatchEvent(new Event('heyelli:session-invalid'));window.dispatchEvent(new Event("heyelli:session-change"));setRole("");setRoleName("");setLoggedIn(false);setDisplayName("");showSuccess("Abgemeldet.");window.location.replace("/anmeldung");}
    catch{showError("Abmeldung fehlgeschlagen. Bitte erneut versuchen.");}finally{setBusy(false);}
  }
  return <Dropdown className="platform-account" ariaLabel={loggedIn?`Benutzermenü für ${displayName}`:"Anmeldung"} label={<><AppGlyph icon="account"/><span className="account-name">{loggedIn?displayName:loaded?"Anmelden":"Anmeldung …"}</span><span aria-hidden="true" className="dropdown-chevron">⌄</span></>}>
    <div className="platform-popover account-popover heyelli-command-menu">
      {loggedIn?<><p className="popover-title">{displayName}</p><small>Angemeldet · {roleName||(role==="admin"?"Administrator":role==="reader"?"Lesezugriff":"Disposition")}</small><hr className="heyelli-menu-separator"/><p><GuardedLink href="/benutzerkonto">Benutzerkonto</GuardedLink></p>{role==="admin"&&<p><GuardedLink href="/einstellungen">Einstellungen öffnen</GuardedLink></p>}<hr className="heyelli-menu-separator"/><button type="button" disabled={busy} onClick={logout}>Abmelden</button></>:<>
        {microsoftAvailable&&<form action="/api/auth/microsoft/start" method="post"><button type="submit">Mit Microsoft anmelden</button></form>}
        {ready&&<><p className="popover-title">Anmeldung mit heyelli-Konto</p>
        <form onSubmit={login}>
          <label>Benutzername<input name="username" required autoComplete="username"/></label>
          <label>Passwort<input name="password" type="password" required autoComplete="current-password"/></label>
          <button disabled={busy||!ready}>{busy?"Wird angemeldet …":"Anmelden"}</button>
        </form>
        </>}
      </>}
      <Notice tone={noticeTone} className="account-status">{message}</Notice>
    </div>
  </Dropdown>;
}
