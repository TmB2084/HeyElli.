// Aufgaben-App: eine Liste über alle Quellen. PDS-Aufgaben sind führend; weitere Quellen werden nur gelesen.
import type {TaskStatus} from '../../platform/pds/api/crm.ts';
export type TaskSource='pds'|'mail'|'order';
export type TaskView='all'|'overdue'|'today'|'week'|'waiting';
export type TaskScope='mine'|'team';
export type TaskItem={key:string;source:TaskSource;id:string;title:string;subtitle:string;due:string|null;status:TaskStatus;assigneeIds:string[];customerId:string|null;objectId:string|null;href:string|null;sources:TaskSource[]};
export type ChecklistEntry={id:string;text:string;done:boolean};
export type TaskLink={kind:'mail'|'order'|'document';id:string;label:string;detail?:string;href?:string};
export type HistoryEntry={at:string;actor:string;text:string};
export type TaskExtras={checklist:ChecklistEntry[];links:TaskLink[];history:HistoryEntry[];version:number};
export const emptyExtras:TaskExtras={checklist:[],links:[],history:[],version:0};
export const statusLabels:Record<TaskStatus,string>={OFFEN:'Offen',IN_BEARBEITUNG:'In Bearbeitung',WARTEN:'Warten',ERLEDIGT:'Erledigt',ABGELEHNT:'Abgelehnt'};
export const sourceLabels:Record<TaskSource,string>={pds:'PDS-Aufgabe',mail:'Mail',order:'Auftrag'};
export const viewLabels:Record<TaskView,string>={all:'Alle',overdue:'Überfällig',today:'Heute',week:'Diese Woche',waiting:'Warten'};
const berlin=(value:string|Date)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(typeof value==='string'?new Date(value):value);
// Fälligkeit in Gruppen (Berliner Kalendertag): überfällig, heute, diese Woche (bis Sonntag), später, ohne Datum.
export function dueGroup(due:string|null,now:Date):'overdue'|'today'|'week'|'later'|'none'{
 if(!due||!Number.isFinite(Date.parse(due)))return 'none';
 const day=berlin(due),today=berlin(now);if(day<today)return 'overdue';if(day===today)return Date.parse(due)<now.getTime()?'overdue':'today';
 const weekday=(new Date(today+'T12:00:00Z').getUTCDay()+6)%7,sunday=berlin(new Date(Date.parse(today+'T12:00:00Z')+(6-weekday)*86400000));
 return day<=sunday?'week':'later';
}
export function inView(item:TaskItem,view:TaskView,now:Date){
 const open=item.status==='OFFEN'||item.status==='IN_BEARBEITUNG'||item.status==='WARTEN';if(!open)return false;
 const group=dueGroup(item.due,now);
 switch(view){case 'all':return true;case 'overdue':return group==='overdue';case 'today':return group==='today'||group==='overdue';case 'week':return group==='week'||group==='today';case 'waiting':return item.status==='WARTEN';}
}
