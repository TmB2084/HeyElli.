export const alarmLabels={database:'Datenbank nicht erreichbar',web:'Webdienst nicht erreichbar',worker:'E-Mail-Dienst ohne aktuelles Lebenszeichen',queue:'E-Mail wartet länger als 15 Minuten',mailUnknown:'Unklarer Versandstatus',mailFailed:'E-Mail-Versand fehlgeschlagen',actionUncertain:'Unklare Elli-Aktion',httpErrors:'Erhöhte API-Fehlerrate',httpSlow:'Erhöhte API-Antwortzeiten',storage:'Wenig freier Speicherplatz',secrets:'Geschützte Zugangsdaten nicht lesbar',monitor:'Überwachung ohne aktuelles Lebenszeichen'} as const;
export type AlarmCode=keyof typeof alarmLabels;
export type Sample={database:boolean;web:boolean;workerAge:number|null;workerHealthy:boolean;queueAge:number;unknown:number;failed:number;uncertain:number;requests:number;failures:number;slow:number;meanMs:number;freeBytes:number;freeRatio:number;secrets:boolean};
export function evaluate(s:Sample):AlarmCode[]{
 const codes:AlarmCode[]=[];
 if(!s.database)codes.push('database');if(!s.web)codes.push('web');
 if(s.workerAge===null||s.workerAge>120||!s.workerHealthy)codes.push('worker');
 if(s.queueAge>900)codes.push('queue');if(s.unknown>0)codes.push('mailUnknown');if(s.failed>0)codes.push('mailFailed');if(s.uncertain>0)codes.push('actionUncertain');
 if(s.requests>=20&&s.failures/s.requests>=.1)codes.push('httpErrors');
 if(s.requests>=20&&s.slow/s.requests>=.2)codes.push('httpSlow');
 if(s.freeBytes<100*1024*1024||s.freeRatio<.05)codes.push('storage');if(!s.secrets)codes.push('secrets');
 return codes;
}
export function metricArea(path:string){return path.startsWith('/api/verwaltung')?'settings':path.startsWith('/api/ressourcenkalender')?'calendar':path.startsWith('/api/pds')?'pds':path.startsWith('/api/assistent')?'assistant':path.startsWith('/api/bereitschaft')?'duty':path.startsWith('/api/service')?'service':'platform';}
// Caller strings/errors are deliberately not accepted by this serialization boundary.
export function diagnostic(code:AlarmCode,incidentId:string,event:'raised'|'recovered'){
 if(!Object.hasOwn(alarmLabels,code)||! /^[a-f0-9-]{36}$/i.test(incidentId))throw Error('Invalid diagnostic');
 return JSON.stringify({kind:'heyelli.operation',at:new Date().toISOString(),code,incidentId,event});
}
