import {type CalendarEvent} from './model.ts';
import {type MergeField} from './merge.ts';
export type ChangeAuthor={displayName:string;at:string|null;source:'saved'|'draft'|'received'|'unknown'};
export type ConflictProvenance={current:Partial<Record<MergeField,ChangeAuthor>>;mine:Partial<Record<MergeField,ChangeAuthor>>};
export function draftAuthors(fields:MergeField[],displayName:string,editedAt:unknown,receivedAt:string):ConflictProvenance['mine']{
 const times=editedAt&&typeof editedAt==='object'?editedAt as Record<string,unknown>:{};
 return Object.fromEntries(fields.map(field=>{const time=times[field],valid=typeof time==='string'&&time.length<=40&&Number.isFinite(Date.parse(time))&&Date.parse(time)<=Date.parse(receivedAt)+300000;return [field,{displayName,at:valid?new Date(Date.parse(time as string)).toISOString():receivedAt,source:valid?'draft':'received'}];}));
}
export function provenanceText(author?:ChangeAuthor){
 if(!author||author.source==='unknown')return 'Benutzer und Änderungszeit nicht nachgewiesen';
 const when=author.at?new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'medium',timeStyle:'medium'}).format(new Date(author.at)):'Zeitpunkt unbekannt';
 return `${author.displayName} · ${when} (Europe/Berlin) · ${author.source==='saved'?'Speicherung bestätigt':author.source==='draft'?'Entwurf, Gerätezeit':'Anfrage eingegangen'}`;
}
// Canonical, field-specific representation for matching the current API value.
export function fieldValue(event:CalendarEvent,field:MergeField):string{
 let value:unknown=event[field];
 if(field==='start'||field==='end')value=Date.parse(String(value));
 if(field==='notes'||field==='objectId')value=value??'';
 if(field==='pimSync')value=value??false;
 if(field==='companionTechnicianIds')value=value??[];
 if(Array.isArray(value))value=[...value].sort();
 else if(value&&typeof value==='object')value=Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
 return JSON.stringify(value)??'null';
}
