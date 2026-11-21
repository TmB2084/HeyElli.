export class ResourceError extends Error {readonly status:number;constructor(message:string,status=429){super(message);this.status=status;}}
export const resourceLimits={active:24,userActive:8,heavyActive:2,userHeavy:1,exports:2,userExports:1,perMinute:600,globalPerMinute:6000,heavyPerMinute:60,globalHeavyPerMinute:240,bodyMs:60000,leaseMs:600000,statementMs:10000,lockMs:1500,poolWaiting:24} as const;
export function requestClass(path:string,contentType='',format=''){
 if(path==='/api/service/dokumente'||path==='/api/service/einsatzmappe/dokument')return 'heavy';
 if(path.endsWith('/export')||path==='/api/verwaltung/protokoll'&&format!=='json')return 'export';
 if(path.includes('/uploads')||path.includes('/document')||path==='/api/pds-simulator/orders'||contentType.startsWith('multipart/form-data')||path.includes('/dokument/'))return 'heavy';
 return 'normal';
}
