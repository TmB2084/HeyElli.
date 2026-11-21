"use client";
import {SettingsGroup,SettingsRow} from '../../platform/shell/settings-controls';
import {Notice} from '../../platform/shell/notice';
import {useTools} from '../../platform/shell/use-tools';
export function ToolsPreferences(){
 const {data,error,busy,change,retry}=useTools();
 return <><Notice tone={error?'error':'neutral'}>{error||(!data?'Werkzeuge werden geladen …':'')}</Notice>{error&&<button type="button" onClick={()=>void retry()}>Erneut laden</button>}{data&&<SettingsGroup title="In der Menüleiste" description="Freigegebene Werkzeuge links neben deinem Benutzermenü anzeigen.">{data.tools.length?data.tools.map(tool=><SettingsRow key={tool.id} title={tool.name} controlId={'visible-tool-'+tool.id}><input id={'visible-tool-'+tool.id} type="checkbox" className="heyelli-switch" role="switch" checked={!data.hidden.includes(tool.id)} disabled={busy} onChange={event=>void change(tool.id,event.target.checked)}/></SettingsRow>):<SettingsRow title="Keine Werkzeuge freigegeben" description="Die Freigabe erfolgt über deine Rolle.">{null}</SettingsRow>}</SettingsGroup>}</>;
}
