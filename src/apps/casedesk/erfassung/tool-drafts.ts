import {maxOrderRemarkLength} from "../../../platform/pds/simulator/reporting.ts";
// Immutable, user-encrypted snapshots. No authority or credentials are stored here.
export type ToolDraft={kind:'incident-tool';version:1;draftId:string;branchId:string;sequence:number;updatedAt:string;state:Record<string,unknown>};
export function incidentDraftPrefix(owner:string){return 'heyelli:incident-draft:v1:'+encodeURIComponent(owner)+':';}
export function isToolDraft(value:unknown):value is ToolDraft{
 const v=value as ToolDraft;return !!v&&v.kind==='incident-tool'&&v.version===1&&typeof v.draftId==='string'&&/^[a-f0-9-]{36}$/.test(v.draftId)&&typeof v.branchId==='string'&&/^[a-f0-9-]{36}$/.test(v.branchId)&&Number.isSafeInteger(v.sequence)&&v.sequence>=0&&typeof v.updatedAt==='string'&&Number.isFinite(Date.parse(v.updatedAt))&&isIncidentState(v.state);
}
export function latestToolDrafts(records:ToolDraft[]){const branches=new Map<string,ToolDraft>();for(const record of records){const previous=branches.get(record.branchId);if(!previous||record.sequence>previous.sequence)branches.set(record.branchId,record);}return [...branches.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}

export type IncidentState={
 object:import('./search-picker').SearchItem|null;personScope:'customer'|'all';person:import('./search-picker').SearchItem|null;channel:string;contact:string;
 upload:{name:string;mime:string;uploadId:string}|null;pendingFile?:{id:string;name:string}|null;bauleiter:import('./search-picker').SearchItem|null;unit:import('./search-picker').SearchItem|null;
 technician:import('./search-picker').SearchItem|null;companions:import('./search-picker').SearchItem[];mobileIssue:boolean;planning:boolean;
 activeStep:number;completed:string[];requestKey:string|null;pending:{payload:Record<string,unknown>;key:string}|null;attempted:boolean;
 fields:{problem:string;externalOrderNumber:string;appointmentDuration:string;remark?:string};dates:Record<string,{date:string;time:string}>;queries:Record<string,string>;
};
export function isIncidentState(value:unknown):value is IncidentState{
 const s=value as IncidentState;if(!s||typeof s!=='object')return false;
 const item=(v:unknown)=>v===null||!!v&&typeof v==='object'&&typeof (v as {id:unknown}).id==='string'&&typeof (v as {label:unknown}).label==='string';
 return ['object','person','bauleiter','unit','technician'].every(name=>item((s as unknown as Record<string,unknown>)[name]))&&['customer','all'].includes(s.personScope)&&typeof s.channel==='string'&&typeof s.contact==='string'&&Array.isArray(s.companions)&&s.companions.every(item)&&typeof s.mobileIssue==='boolean'&&typeof s.planning==='boolean'&&typeof s.attempted==='boolean'&&Number.isInteger(s.activeStep)&&s.activeStep>=0&&s.activeStep<=3&&Array.isArray(s.completed)&&s.completed.length===3&&s.completed.every(v=>typeof v==='string')&&!!s.fields&&['problem','externalOrderNumber','appointmentDuration'].every(name=>typeof (s.fields as Record<string,unknown>)[name]==='string')&&(s.fields.remark===undefined||typeof s.fields.remark==='string'&&s.fields.remark.length<=maxOrderRemarkLength)&&!!s.dates&&typeof s.dates==='object'&&Object.values(s.dates).every(v=>!!v&&typeof v.date==='string'&&typeof v.time==='string')&&!!s.queries&&typeof s.queries==='object'&&Object.values(s.queries).every(v=>typeof v==='string'&&v.length<=100)&&(s.requestKey===null||typeof s.requestKey==='string'&&/^[a-f0-9-]{36}$/.test(s.requestKey))&&(s.pending===null||!!s.pending&&s.pending.key===s.requestKey&&typeof s.pending.payload==='object'&&!!s.pending.payload)&&(!s.attempted||!!s.pending)&&(s.upload===null||!!s.upload&&typeof s.upload.uploadId==='string'&&typeof s.upload.name==='string'&&typeof s.upload.mime==='string');
}
