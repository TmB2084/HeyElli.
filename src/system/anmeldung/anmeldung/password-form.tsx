'use client';
import {useState,type FormEvent} from 'react';
import {Notice} from '@/platform/shell';
// Eigenes heyelli-Passwort ändern. Mindestlänge wie serverseitig (src/platform/accounts/password.ts).
export const MIN_PASSWORD_LENGTH=12;
export function PasswordChangeForm({onDone,submitLabel='Passwort ändern'}:{onDone?:()=>void;submitLabel?:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=event.currentTarget,values=new FormData(form);setError('');setDone(false);
  const currentPassword=String(values.get('currentPassword')??''),newPassword=String(values.get('newPassword')??''),repeat=String(values.get('repeatPassword')??'');
  if(newPassword.length<MIN_PASSWORD_LENGTH){setError(`Das neue Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`);return;}
  if(newPassword!==repeat){setError('Die beiden neuen Passwörter stimmen nicht überein.');return;}
  setBusy(true);
  try{
   const response=await fetch('/api/benutzerkonto/passwort',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(20000),body:JSON.stringify({currentPassword,newPassword})});
   const value=await response.json().catch(()=>({}));if(!response.ok)throw Error(value.error??'Passwort konnte nicht geändert werden.');
   form.reset();setDone(true);window.dispatchEvent(new Event('heyelli:session-change'));onDone?.();
  }catch(caught){setError(caught instanceof Error&&caught.message?caught.message:'Passwort konnte nicht geändert werden.');}
  finally{setBusy(false);}
 }
 return <form onSubmit={submit} className="password-form">
  <Notice tone="error">{error}</Notice>{done&&<Notice tone="success">Passwort geändert. Andere Sitzungen deines Kontos wurden beendet.</Notice>}
  <fieldset disabled={busy}><legend className="sr-only">Passwort ändern</legend>
   <label>Bisheriges Passwort<input name="currentPassword" type="password" required autoComplete="current-password"/></label>
   <label>Neues Passwort<input name="newPassword" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" aria-describedby="password-rule"/></label>
   <label>Neues Passwort wiederholen<input name="repeatPassword" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password"/></label>
   <small id="password-rule">Mindestens {MIN_PASSWORD_LENGTH} Zeichen.</small>
   <button type="submit">{busy?'Wird gespeichert …':submitLabel}</button>
  </fieldset>
 </form>;
}
