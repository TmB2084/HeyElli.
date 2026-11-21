import {fieldValue,type ChangeAuthor,type ConflictProvenance} from './change-provenance.ts';
import {mergeLabels,type MergeField} from './merge.ts';
import type {CalendarEvent} from './model.ts';
import type {CalendarDraft} from './drafts.ts';
export type Recovery={original:CalendarEvent;changed:CalendarEvent;authors:ConflictProvenance['current'];sources:CalendarDraft[]};
export function recoverDraft(state:Recovery,draft:CalendarDraft,choices:Partial<Record<MergeField,'mine'|'current'>>={}){
 const original={...state.original},changed={...state.changed},authors={...state.authors},conflicts:MergeField[]=[];
 for(const field of Object.keys(mergeLabels) as MergeField[]){
  const target=fieldValue(draft.changed,field),base=fieldValue(draft.original,field);if(target===base)continue;
  const existing=fieldValue(state.changed,field),hasIntent=existing!==fieldValue(state.original,field);
  const ancestors=[draft.sourceDraftId,...(draft.sourceDraftIds??[])];
  const deliberateRevision=state.sources.some(source=>source.draftId&&ancestors.includes(source.draftId)&&fieldValue(source.changed,field)===existing&&fieldValue(source.original,field)!==existing);
  if(hasIntent&&existing!==target&&base!==existing&&!deliberateRevision&&!choices[field]){conflicts.push(field);continue;}
  if(choices[field]==='current')continue;
  Object.assign(original,{[field]:draft.original[field]});Object.assign(changed,{[field]:draft.changed[field]});
  authors[field]={displayName:draft.displayName??'Angemeldeter Benutzer',at:draft.editedAt?.[field]??draft.updatedAt??null,source:'draft'} satisfies ChangeAuthor;
 }
 return {state:{original,changed,authors,sources:[...state.sources,draft]},conflicts};
}
