'use client';
import {useState} from 'react';
import {Notice,ConfirmationDialog} from '@/platform/shell';
import {SettingsGroup,SettingsRow} from '@/platform/shell/settings-controls';
import {backupDeviceDrafts,removeConfirmedDeviceCopies} from './client';
export function DeviceDraftPanel(){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[backup,setBackup]=useState<Awaited<ReturnType<typeof backupDeviceDrafts>>|null>(null);
 async function prepare(){setBusy(true);setError('');try{setBackup(await backupDeviceDrafts());}catch(problem){setError((problem instanceof Error?problem.message:'Sicherung nicht erreichbar.')+' Auf diesem Gerät wurde nichts entfernt.');}finally{setBusy(false);}}
 async function remove(){if(!backup)return;setBusy(true);try{
  const response=await fetch('/api/simulator-session',{method:'DELETE',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Abmeldung nicht bestätigt. Bitte erneut versuchen.');
  removeConfirmedDeviceCopies(backup);window.location.replace('/anmeldung');
 }catch(problem){setBackup(null);setError(problem instanceof Error?problem.message:'Bereinigung nicht möglich.');}finally{setBusy(false);}}
 return <><SettingsGroup title="Kalenderentwürfe auf diesem Gerät" description="Entwürfe bleiben verschlüsselt erhalten, bis sie gespeichert oder bewusst verworfen werden. Nach erneutem Anmelden können zusätzliche Sicherungen wiederhergestellt werden."><SettingsRow title="Lokale Kopien entfernen" description="Zuerst wird eine Sicherung für dein Benutzerkonto bestätigt. Danach wirst du abgemeldet."><button type="button" className="settings-secondary-action" disabled={busy} onClick={()=>void prepare()}>Sichern und entfernen …</button></SettingsRow></SettingsGroup><Notice tone="error" role="alert">{error}</Notice><ConfirmationDialog open={!!backup} title="Lokale Kalenderkopien entfernen?" description={`${backup?.copies.length??0} gesicherte Kopien werden auf diesem Gerät entfernt. Neuere Eingaben bleiben erhalten. Beim erneuten Öffnen des PlanBoards werden Sicherungen wiederhergestellt.`} confirmLabel="Entfernen und abmelden" onCancel={()=>setBackup(null)} onConfirm={()=>void remove()} busy={busy}/></>;
}
