'use client';
import {useEffect,useState} from 'react';
import {SettingsGroup,SettingsRow,Notice} from '@/platform/shell';
import {platformRelease} from '../../platform/shell/app-releases';
type Module={name:string;version?:string;description:string};
export function PlatformInfo(){
 const [modules,setModules]=useState<Module[]>([]),[error,setError]=useState('');
 useEffect(()=>{const abort=new AbortController();void fetch('/api/verwaltung/info',{cache:'no-store',signal:abort.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw Error();setModules(data.modules);}).catch(()=>{if(!abort.signal.aborted)setError('Technische Informationen konnten nicht geladen werden.');});return()=>abort.abort();},[]);
 return <section><SettingsGroup title="HeyElli"><SettingsRow title="Version"><span>{platformRelease.year}.{platformRelease.publication}</span></SettingsRow><SettingsRow title="Veröffentlichung"><time dateTime={platformRelease.publishedOn}>{platformRelease.publishedOn.split('-').reverse().join('.')}</time></SettingsRow><SettingsRow title="Ersteller"><span>{platformRelease.creator}</span></SettingsRow></SettingsGroup><Notice tone="error">{error}</Notice><SettingsGroup title="Technische Module" description="Paketversionen laut Lockdatei; Node.js zeigt die laufende Version. Externe Dienste werden nicht auf ihre Laufzeitversion geprüft.">{modules.map(module=><SettingsRow key={module.name} title={module.name} description={module.description}>{module.version&&<span>{module.version}</span>}</SettingsRow>)}</SettingsGroup></section>;
}
