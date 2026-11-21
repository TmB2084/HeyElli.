import {auditAction,auditKind,auditValue,type AuditEntry} from './audit-format.ts';
export type AuditFilters={search:string;actor:string;action:string;from:string;to:string};
export const emptyAuditFilters:AuditFilters={search:'',actor:'',action:'',from:'',to:''};
export function auditDay(value:string|Date){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
export function filterAudit(entries:AuditEntry[],filters:AuditFilters){
 const search=filters.search.trim().toLocaleLowerCase('de');
 return entries.filter(entry=>{
  const day=auditDay(entry.createdAt);
  return (!filters.actor||entry.actorId===filters.actor)&&(!filters.action||auditKind(entry.action)===filters.action)&&(!filters.from||day>=filters.from)&&(!filters.to||day<=filters.to)&&(!search||[entry.actorId,entry.targetId,entry.action,auditAction(entry.action),...(entry.changes??[]).flatMap(change=>[change.label,auditValue(change.before),auditValue(change.after)])].join(' ').toLocaleLowerCase('de').includes(search));
 });
}
export function auditFilterParams(filters:AuditFilters){return new URLSearchParams(Object.entries(filters).filter(([,value])=>value));}
