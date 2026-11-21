export const settingsPages={
 sharepoint:[['connection','Verbindung'],['release','Prüfung & Freigabe'],['storage','Ablagestruktur'],['guide','Anleitung']],
 bmacloud:[['connection','Verbindung'],['release','Prüfung & Freigabe'],['guide','Anleitung']],
 system:[['appearance','Darstellung'],['info','Info']],
 security:[['sessions','Sitzungsdauer'],['secrets','Geschützte Zugangsdaten'],['browser','Browser-Schutz'],['data','Daten & Aufbewahrung'],['operations','Betriebsstatus']],
 copilot:[['connection','Verbindung'],['release','Prüfung & Freigabe'],['guide','Anleitung']],
 account:[['profile','Profil'],['login','Anmeldung'],['display','Anzeige'],['device','Gerät & Entwürfe'],['data','Daten & Export']],
 users:[['roles','Rollen & App-Zugriffe'],['accounts','heyelli-Konten'],['create','Konto anlegen'],['sessions','Sitzungen'],['events','Änderungsprotokoll']],
 roles:[['detail','Rolle bearbeiten'],['create','Neue Rolle']],
 incident:[['positions','Standardpositionen']],
 resources:[['colors','Kalenderfarben'],['defaults','Anzeigevorgaben']],
 palette:[['0','Termin-Konfiguration'],['1','Termin-Kategorien'],['2','Statusfarbe']],
 mail:[['compose','Nachricht'],['queue','Warteschlange'],['log','Versandprotokoll']],
 graph:[['connection','Verbindung'],['release','Prüfung & Freigabe'],['maildesk','MailDesk-Postfach'],['guide','Anleitung']],
 pds:[['connection','Verbindung'],['checks','API-Prüfung'],['views','Datenansichten'],['source','Quelle & Freigabe'],['readiness','Anleitung']],
 microsoft:[['connection','Verbindung'],['release','Prüfung & Freigabe'],['guide','Anleitung']],
} satisfies Record<string,string[][]>;
export type SettingsPageKey=keyof typeof settingsPages;
export const rootNamespace:Record<string,SettingsPageKey>={sharepoint:'sharepoint',bmacloud:'bmacloud',system:'system',security:'security',copilot:'copilot',account:'account',users:'users',colors:'resources',incident:'incident',email:'mail',graph:'graph',pds:'pds','microsoft-auth':'microsoft'};
export function parseSettingsPath(root:string,path:string|null):string[]{
 const parts=(path??'').replace(/^system:preferences(?=\/|$)/,'system:appearance').split('/').filter(Boolean),namespace=rootNamespace[root];if(!namespace||!parts.length)return [];
 function valid(token:string,key:SettingsPageKey){const [name,value,...extra]=token.split(':');return name===key&&!extra.length&&settingsPages[key].some(([id])=>id===value);}
 if(!valid(parts[0],namespace))return [];
 const result=[parts[0]];
 if(root==='colors'&&parts[0]==='resources:colors'&&parts[1]&&valid(parts[1],'palette'))result.push(parts[1]);
 if(root==='users'&&parts[0]==='users:roles'&&parts[1]&&valid(parts[1],'roles'))result.push(parts[1]);
 return result;
}
export function settingsLeafTitle(path:string|null,root:string){
 const token=parseSettingsPath(root,path).at(-1)?.split(':');
 return token?settingsPages[token[0] as SettingsPageKey]?.find(([id])=>id===token[1])?.[1]??null:null;
}

// Preserve bookmarks without adding a second entry to the app-local history.
export function resolveSettingsLocation(root:string,path:string|null):{root:string;path:string|null}{
 // MailDesk-Postfach ist Teil der Microsoft-Graph-Integration (frühere eigene Seite leitet weiter).
 if(root==='maildesk')return {root:'graph',path:'graph:maildesk'};
 if(root==='system'){
  if(path==='system:security')return {root:'security',path:null};
  if(path==='system:data'||path==='system:operations')return {root:'security',path:path.replace('system:','security:')};
 }
 return {root,path};
}
