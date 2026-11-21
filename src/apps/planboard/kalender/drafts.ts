import {berlinWall} from "./model.ts";
import {fieldValue} from "./change-provenance.ts";
import {mergeLabels,type MergeField as DraftField} from "./merge.ts";
import type {MergeField} from './merge.ts';
import type {CalendarEvent} from './model.ts';
export type CalendarDraft={displayName?:string;failure?:import("./background-saving.ts").SaveFailure;draftId?:string;writerId?:string;updatedAt?:string;sourceDraftId?:string;sourceDraftIds?:string[];original:CalendarEvent;changed:CalendarEvent;companions?:string[];operationId:string;choice?:'single'|'split';hash?:string;auto?:boolean;editedAt?:Partial<Record<MergeField,string>>;form?:{start:string;end:string}};
export function readDrafts(storage:Pick<Storage,'getItem'>,owner:string):Record<string,CalendarDraft>{
 try{const value=JSON.parse(storage.getItem('heyelli:calendar-drafts:'+owner)??'{}');return Object.fromEntries(Object.entries(value).filter(([id,draft])=>{const d=draft as CalendarDraft;return d?.original?.id===id&&d?.changed?.id===id&&typeof d.operationId==='string';})) as Record<string,CalendarDraft>;}catch{return {};}
}
export function writeDrafts(storage:Pick<Storage,'setItem'>,owner:string,drafts:Record<string,CalendarDraft>){if(owner)storage.setItem('heyelli:calendar-drafts:'+owner,JSON.stringify(drafts));}

export type DraftStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'|'key'|'length'>;
export function draftPrefix(owner:string){return 'heyelli:calendar-draft:v2:'+encodeURIComponent(owner)+':';}
export function saveDraft(storage:DraftStorage,owner:string,draft:CalendarDraft){
 if(!owner||!draft.draftId)throw new Error('Entwurfskennung fehlt.');
 const key=draftPrefix(owner)+encodeURIComponent(draft.draftId),serialized=JSON.stringify(draft),existing=storage.getItem(key);
 if(existing!==null&&existing!==serialized)throw new Error('Ein bestehender Entwurfsstand darf nicht überschrieben werden.');
 storage.setItem(key,serialized);
}
export function deleteDraft(storage:DraftStorage,owner:string,draftId:string){storage.removeItem(draftPrefix(owner)+encodeURIComponent(draftId));}
export function listDrafts(storage:DraftStorage,owner:string):Record<string,CalendarDraft>{
 if(!owner)return {};
 // Copy old entries before removing the old aggregate. Deterministic keys make
 // concurrent imports idempotent. Never rewrite an existing independent record.
 const legacyKey='heyelli:calendar-drafts:'+owner;
 if(storage.getItem(legacyKey)!==null){
  for(const draft of Object.values(readDrafts(storage,owner))){
   const draftId='legacy:'+draft.original.id+':'+draft.operationId;
   if(storage.getItem(draftPrefix(owner)+encodeURIComponent(draftId))===null)saveDraft(storage,owner,{...draft,draftId,writerId:'legacy',updatedAt:new Date().toISOString()});
  }
  // Retain any unrecognized legacy bytes instead of silently discarding them.
  try{const raw=JSON.parse(storage.getItem(legacyKey)??'null');if(raw&&typeof raw==='object'&&!Array.isArray(raw)&&Object.keys(raw).length===Object.keys(readDrafts(storage,owner)).length)storage.removeItem(legacyKey);}catch{/* Damaged source is retained. */}
 }
 const result:Record<string,CalendarDraft>={},prefix=draftPrefix(owner);
 for(let index=0;index<storage.length;index++){
  const key=storage.key(index);if(!key?.startsWith(prefix))continue;
  try{const draft=JSON.parse(storage.getItem(key)??'null') as CalendarDraft;if(draft?.draftId&&key===prefix+encodeURIComponent(draft.draftId)&&draft.original?.id===draft.changed?.id&&typeof draft.original?.id==='string'&&typeof draft.operationId==='string')result[draft.draftId]=draft;}catch{/* Preserve malformed records for recovery; never erase other entries. */}
 }
 return result;
}

// Immutable revisions: a delayed response may delete only its exact snapshot,
// never a later revision written by another document after a timeout.
export function replaceDraft(storage:DraftStorage,owner:string,previousId:string|undefined,next:CalendarDraft){
 if(previousId===next.draftId)throw new Error('Ein neuer Entwurfsstand benötigt eine neue Kennung.');
 saveDraft(storage,owner,next);
 if(previousId)deleteDraft(storage,owner,previousId);
}

export function draftIsSaved(draft:CalendarDraft,current:CalendarEvent){
 if(draft.original.id!==current.id)return false;
 if(draft.form&&(draft.form.start!==berlinWall(draft.changed.start)||draft.form.end!==berlinWall(draft.changed.end)))return false;
 return (Object.keys(mergeLabels) as DraftField[]).every(field=>fieldValue(draft.original,field)===fieldValue(draft.changed,field)||fieldValue(draft.changed,field)===fieldValue(current,field));
}
// Delete only immutable snapshots captured before a verified read. New revisions
// created during that read have different keys and cannot be removed here.
export function removeSavedDrafts(storage:DraftStorage,owner:string,candidates:CalendarDraft[],confirmed:CalendarEvent[]){
 for(const draft of candidates){const current=confirmed.find(event=>event.id===draft.original.id);if(draft.draftId&&current&&draftIsSaved(draft,current))deleteDraft(storage,owner,draft.draftId);}
}
export function completeDraft(storage:DraftStorage,owner:string,draft:CalendarDraft){
 const all=listDrafts(storage,owner),queue=[draft.draftId,draft.sourceDraftId,...(draft.sourceDraftIds??[])],seen=new Set<string>();
 while(queue.length){const id=queue.pop();if(!id||seen.has(id))continue;seen.add(id);const item=all[id];if(!item||item.original.id!==draft.original.id)continue;
  queue.push(item.sourceDraftId,...(item.sourceDraftIds??[]));deleteDraft(storage,owner,id);
 }
}
