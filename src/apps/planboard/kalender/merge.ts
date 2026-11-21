import {CalendarError,type CalendarEvent} from './model.ts';
const fields=['start','end','resourceIds','title','notes','status','allDay','fixed','pimSync','categories','objectId','address','mainTechnicianId','companionTechnicianIds'] as const;
export type MergeField=typeof fields[number];
export const mergeLabels:Record<MergeField,string>={start:'Beginn',end:'Ende',resourceIds:'Ressourcen',title:'Titel',notes:'Beschreibung',status:'Status',allDay:'Ganzer Tag',fixed:'Fixierung',pimSync:'PIM-Synchronisation',categories:'Kategorien',objectId:'Einsatzort',address:'Anschrift',mainTechnicianId:'Haupttechniker',companionTechnicianIds:'Begleiter'};
function normalized(value:unknown,key:string):unknown{
 if(key==='start'||key==='end')return Date.parse(String(value));
 if(key==='notes'||key==='objectId')return value??'';
 if(key==='pimSync')return value??false;
 if(key==='companionTechnicianIds')value=value??[];
 if(Array.isArray(value))return [...value].sort();
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
 return value;
}
export function mergeCalendarEvents(base:CalendarEvent,desired:CalendarEvent,current:CalendarEvent,choices:Partial<Record<MergeField,'mine'|'current'>>={}){
 const merged={...current},conflicts:MergeField[]=[];let changed=false;
 for(const key of fields){
  const equal=(a:unknown,b:unknown)=>JSON.stringify(normalized(a,key))===JSON.stringify(normalized(b,key));
  if(equal(base[key],desired[key]))continue;changed=true;
  if(!equal(base[key],current[key])&&!equal(desired[key],current[key])&&!choices[key]){conflicts.push(key);continue;}
  if(choices[key]!=='current')Object.assign(merged,{[key]:desired[key]});
 }
 return {merged,conflicts,changed};
}
export class CalendarConflictError extends CalendarError{
 current:CalendarEvent;conflicts:MergeField[];
 constructor(current:CalendarEvent,conflicts:MergeField[]){super('Bitte widersprüchliche Änderungen auswählen: '+conflicts.map(key=>mergeLabels[key]).join(', '),409);this.current=current;this.conflicts=conflicts;}
}
