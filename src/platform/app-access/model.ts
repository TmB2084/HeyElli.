export const appCatalog=[['/','AskElli'],['/servicehub','ServiceHub'],['/casedesk','CaseDesk'],['/planboard','PlanBoard'],['/dutyboard','DutyBoard'],['/maildesk','MailDesk'],['/taskhub','TaskHub'],['/missioncontrol','MissionControl'],['/benutzerkonto','Benutzerkonto'],['/hilfe','Hilfe'],['/einstellungen','Einstellungen']] as const;
export function appForPath(path:string){if(path==='/werkzeuge/casedesk')return '/casedesk';return appCatalog.find(([root])=>path===root||root!=='/'&&path.startsWith(root+'/'))?.[0];}
export function requiredApps(path:string):string[]{
 try{path=decodeURIComponent(path).replace(/\/+$/,'')||'/';}catch{return ['/einstellungen'];}
 const aliases:Record<string,string>={'/verwaltung':'/einstellungen','/bereitschaft':'/dutyboard','/ressourcenkalender':'/planboard','/stoerungen':'/casedesk'};
 if(aliases[path])return [aliases[path]];
 const page=appForPath(path);if(page)return [page];
 // BMACloud settings and guide inherit the administrator-only settings app.
 if(path.startsWith('/api/verwaltung'))return ['/einstellungen'];
 if(['/api/benutzerkonto/daten','/api/benutzerkonto/daten/export'].includes(path))return []; // Explicit own-account privacy scope, never another user's records.
 if(path==='/api/benutzerkonto/notizen')return []; // Own personal notes, additionally guarded by the notes tool grant.
 if(path==='/api/benutzerkonto/auftragsentwuerfe')return []; // Own encrypted tool drafts only; no business write permission is granted.
 if(path==='/api/sicherheit/csp')return []; // Session-bound own diagnostics, no anonymous ingestion.
 if(path==='/api/benutzerkonto')return ['/benutzerkonto'];
 if(path.startsWith('/api/assistent'))return ['/'];
 if(path==='/api/planung/verfuegbarkeit')return ['/casedesk','/servicehub'];
 if(path.startsWith('/api/service'))return ['/servicehub'];
 if(path.startsWith('/api/bereitschaft'))return ['/dutyboard'];
 if(path==='/api/maildesk'||path.startsWith('/api/maildesk/'))return ['/maildesk'];
 if(path==='/api/aufgaben'||path.startsWith('/api/aufgaben/'))return ['/taskhub'];
 if(path==='/api/missioncontrol'||path.startsWith('/api/missioncontrol/'))return ['/missioncontrol'];
 if(path.startsWith('/api/ressourcenkalender/referenzen'))return ['/casedesk','/planboard','/dutyboard','/servicehub'];
 if(path.startsWith('/api/ressourcenkalender'))return ['/planboard'];
 if(path.startsWith('/api/pds-simulator/orders')||path.startsWith('/api/pds-simulator/uploads')||path.startsWith('/api/pds-simulator/person'))return ['/casedesk','/servicehub'];
 if(path.startsWith('/api/pds'))return ['/servicehub','/casedesk','/planboard','/dutyboard'];
 return [];
}
export const writableApps=['/','/servicehub','/casedesk','/planboard','/dutyboard','/maildesk','/taskhub','/missioncontrol'] as const;
// Raw source writes never borrow permission from an unrelated app. POST list/details remain reads.
export function writeAppsForRequest(path:string,method:string):string[]{
 if(['GET','HEAD','OPTIONS'].includes(method))return [];
 path=decodeURIComponent(path).replace(/\/+$/,'');
 if(path.startsWith('/api/pds/rest/api/')){const api=path.slice('/api/pds/rest/api'.length);if(/^\/[^/]+\/(?:list[a-z]*|details(?:batch)?|findstoerungtermin)$/i.test(api))return [];if(api.startsWith('/termin/'))return ['/planboard'];if(api.startsWith('/service/'))return ['/casedesk','/servicehub','/planboard'];return ['/casedesk'];}
 if(path.startsWith('/api/pds-simulator/')&&!path.endsWith('/document'))return ['/casedesk'];
 if(path==='/api/service/terminbestaetigung')return ['/servicehub'];
 if(path==='/api/service/einsatzmappe')return ['/servicehub'];
 if(path==='/api/service/dokumente')return ['/servicehub'];
 if(path==='/api/service/status')return ['/servicehub'];
 if(path==='/api/service/planung')return ['/servicehub'];
 if(path==='/api/service/kunde360/notiz')return ['/servicehub'];
 if(path==='/api/maildesk/aktion'||path==='/api/maildesk/antwort')return ['/maildesk'];
 if(path==='/api/aufgaben/aktion'||path==='/api/aufgaben/neu')return ['/taskhub'];
 if(['/api/missioncontrol/plan','/api/missioncontrol/fokus','/api/missioncontrol/notizen','/api/missioncontrol/erledigt','/api/missioncontrol/kalender','/api/missioncontrol/ziele'].includes(path))return ['/missioncontrol'];
 if(path.startsWith('/api/ressourcenkalender')&&!['/api/ressourcenkalender/ressourcenauswahl','/api/ressourcenkalender/farben','/api/ressourcenkalender/entwuerfe'].includes(path))return ['/planboard'];
 if(['/api/bereitschaft','/api/bereitschaft/termine'].includes(path))return ['/dutyboard'];
 return [];
}
