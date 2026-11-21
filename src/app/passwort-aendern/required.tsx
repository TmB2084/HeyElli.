'use client';
import {PasswordChangeForm} from '@/system/anmeldung/anmeldung';
import {lockStyles as styles} from '@/system/anmeldung/anmeldung/lock-screen';
export function RequiredPasswordChange(){return <><p className={styles.status}>Bitte vergib vor der ersten Nutzung ein eigenes Passwort.</p><PasswordChangeForm submitLabel="Passwort speichern und fortfahren" onDone={()=>window.location.replace('/')}/></>;}
