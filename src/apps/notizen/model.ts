export type Note={body:string;version:number;updatedAt:string|null};
export type NoteBuffer={base:string;version:number;text:string;updatedAt:string};
export function validNoteText(value:unknown):value is string{return typeof value==='string'&&value.length<=20000&&!value.includes('\u0000');}
export function validNoteBuffer(value:unknown):value is NoteBuffer{const v=value as NoteBuffer;return !!v&&validNoteText(v.base)&&validNoteText(v.text)&&Number.isSafeInteger(v.version)&&v.version>=0&&typeof v.updatedAt==='string'&&Number.isFinite(Date.parse(v.updatedAt));}
// Merge disjoint text edits; never guess the winner of overlapping changes.
export function mergeNotes(base:string,local:string,remote:string):string|null{
 if(local===remote||local===base)return remote;if(remote===base)return local;
 function edit(text:string){let start=0,end=base.length,tail=text.length;while(start<base.length&&start<text.length&&base[start]===text[start])start++;while(end>start&&tail>start&&base[end-1]===text[tail-1]){end--;tail--;}return {start,end,text:text.slice(start,tail)};}
 const a=edit(local),b=edit(remote);if(a.start===b.start&&a.end===a.start&&b.end===b.start)return null;
 if(a.end>b.start&&b.end>a.start||a.start===b.start)return null;
 const edits=[a,b].sort((x,y)=>y.start-x.start);let result=base;for(const change of edits)result=result.slice(0,change.start)+change.text+result.slice(change.end);return validNoteText(result)?result:null;
}

export function isNote(value:unknown):value is Note{const v=value as Note;return !!v&&validNoteText(v.body)&&Number.isSafeInteger(v.version)&&v.version>=0&&(v.updatedAt===null||typeof v.updatedAt==='string'&&Number.isFinite(Date.parse(v.updatedAt)));}
