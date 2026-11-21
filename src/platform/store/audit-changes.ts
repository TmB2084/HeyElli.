export function auditChanges(before:Record<string,unknown>|null,after:Record<string,unknown>,fields:Record<string,string>){
 return Object.entries(fields).filter(([field])=>JSON.stringify(before?.[field]??null)!==JSON.stringify(after[field]??null)).map(([field,label])=>({field,label,before:before?.[field]??null,after:after[field]??null}));
}
