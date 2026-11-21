'use client';
import {ToolsPreferences} from './tools-preferences';
import {DataPanel} from '../../platform/data-lifecycle/ui';
import {DeviceDraftPanel} from '../../apps/planboard/entwuerfe/ui';

import {useEffect,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {SettingsWorkspace} from '../../platform/shell/settings-workspace';
import {SettingsPages,useSettingsPage} from '../../platform/shell/settings-pages';
import {AccountProfileCard,AccountLoginCard} from './account-profile-card';
import {PasswordChangeForm} from '@/system/anmeldung/anmeldung/password-form';
import {AppearanceSettings} from './appearance-settings';
const areas=[
 {id:'account',label:'Benutzerkonto',group:'Persönlich',icon:'profile',color:'#7d8999',keywords:'Profil Benutzer Name Rolle Mitarbeiter Zuordnung'},
 {id:'tools',label:'Werkzeuge',group:'Persönlich',icon:'settings',color:'#bf5966',keywords:'Tools Menüleiste Notizen CaseDesk einblenden ausblenden'},
 {id:'display',label:'Anzeige',group:'Persönlich',icon:'display',color:'#5885d8',keywords:'Darstellung Hell Dunkel Gerät Erscheinungsbild'},
];
export function PersonalSettingsWorkspace(){
 const [area,setArea]=useState('account'),page=useSettingsPage('account','account');
 const params=useSearchParams(),legacy=params.get('bereich'),path=params.get('seite');
 useEffect(()=>{
  if(legacy!=='profile'&&!(legacy==='account'&&path==='account:display'))return;
  const frame=requestAnimationFrame(()=>{const url=new URL(window.location.href);url.searchParams.set('bereich',legacy==='profile'?'account':'display');if(legacy==='profile')url.searchParams.set('seite','account:profile');else url.searchParams.delete('seite');window.history.replaceState(null,'',url.pathname+url.search+url.hash);});
  return()=>cancelAnimationFrame(frame);
 },[legacy,path]);
 return <SettingsWorkspace title="Benutzerkonto" areas={areas} groups={['Persönlich']} area={area} onAreaChange={setArea}>
  <div hidden={area!=='account'}><SettingsPages namespace="account" value={page.value} onChange={page.select} parent="Benutzerkonto" items={[['profile','Profil'],['device','Gerät & Entwürfe'],['data','Daten & Export']]}/></div>
  <div hidden={area!=='account'||page.value!=='profile'}><AccountProfileCard/></div>
  {area==='account'&&page.value==='login'&&<AccountLoginCard passwordForm={<PasswordChangeForm/>}/>}
  {area==='account'&&page.value==='device'&&<DeviceDraftPanel/>}
  {area==='account'&&page.value==='data'&&<DataPanel/>}
  {area==='tools'&&<ToolsPreferences/>}
  <div hidden={area!=='display'}><AppearanceSettings controls/></div>
 </SettingsWorkspace>;
}
