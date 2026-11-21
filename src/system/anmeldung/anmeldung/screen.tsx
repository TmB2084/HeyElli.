'use client';
import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {Notice} from '@/platform/shell';
import {appLandingPath} from '../../../platform/app-access/landing';
import {LockScreen,lockStyles as styles} from './lock-screen';
type State={authenticated:boolean;allowedApps:string[];configured:boolean;mode:string;microsoftAvailable:boolean;mustChangePassword?:boolean};
const Arrow=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
const MicrosoftLogo=()=><span className={styles.microsoft} aria-hidden="true"><i style={{background:'#f25022'}}/><i style={{background:'#7fba00'}}/><i style={{background:'#00a4ef'}}/><i style={{background:'#ffb900'}}/></span>;
export function SignInScreen({initialError='',destination='/'}:{initialError?:string;destination?:string}){
 const router=useRouter(),[status,setStatus]=useState<State|null>(null),[error,setError]=useState(initialError),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{try{const response=await fetch('/api/simulator-session',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error();setStatus(await response.json());}catch{setError('Anmeldung derzeit nicht erreichbar. Bitte erneut versuchen.');}},[]);
 useEffect(()=>{void(async()=>{await load();})();},[load]);
 async function login(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget,values=new FormData(form);setBusy(true);setError('');try{const response=await fetch('/api/simulator-session',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(20000),body:JSON.stringify({username:String(values.get('username')??''),password:String(values.get('password')??'')})}),value=await response.json();if(!response.ok)throw Error(value.error??'Anmeldung fehlgeschlagen.');form.reset();window.dispatchEvent(new Event('heyelli:session-change'));window.location.replace(value.mustChangePassword?'/passwort-aendern':appLandingPath(value.allowedApps??[],destination));}catch(error){setError(error instanceof Error&&!['TypeError','SyntaxError','TimeoutError','AbortError'].includes(error.name)?error.message:'Verbindung unterbrochen. Bitte erneut anmelden.');}finally{const password=form.elements.namedItem('password');if(password instanceof HTMLInputElement)password.value='';setBusy(false);}}
 const signedOut=!!status&&!status.authenticated;
 return <LockScreen title="Anmelden">
  {error&&<Notice tone="error" className={styles.notice}>{error}</Notice>}
  {!status&&!error&&<p className={styles.status} role="status">Anmeldung wird vorbereitet …</p>}
  {status?.authenticated&&<button type="button" className={styles.secondary} onClick={()=>router.replace(status.mustChangePassword?'/passwort-aendern':appLandingPath(status.allowedApps??[],destination))}>Zur Anwendung</button>}
  {signedOut&&status.configured&&<form className={styles.form} onSubmit={login}><fieldset disabled={busy}><legend className="sr-only">Anmeldung mit heyelli-Konto</legend>
   <div className={styles.field}><label htmlFor="login-username" className="sr-only">Benutzername</label><input id="login-username" name="username" required autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Benutzername"/></div>
   <div className={styles.field}><label htmlFor="login-password" className="sr-only">Passwort</label><input id="login-password" name="password" type="password" required autoComplete="current-password" placeholder="Passwort"/><button type="submit" className={styles.submit} aria-label={busy?'Wird angemeldet …':'Anmelden'} title="Anmelden"><Arrow/></button></div>
  </fieldset><p className={styles.hint}>Bei der ersten Anmeldung neues Passwort vergeben</p></form>}
  {signedOut&&status.microsoftAvailable&&<form action="/api/auth/microsoft/start" method="post"><button className={styles.secondary} type="submit"><MicrosoftLogo/>Mit Microsoft anmelden</button></form>}
  {signedOut&&!status.configured&&!status.microsoftAvailable&&<p className={styles.status}>Die Anmeldung ist noch nicht eingerichtet. Bitte die Administration kontaktieren.</p>}
 </LockScreen>;
}
