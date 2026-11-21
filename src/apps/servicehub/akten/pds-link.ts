/** Accept only absolute web URLs supplied by PDS, without constructing record addresses. */
export function pdsWebLink(value:unknown):string|undefined{
 if(typeof value!=='string'||!value||/[\\\x00-\x20\x7f]/.test(value))return;
 try{const url=new URL(value);if(!['https:','http:'].includes(url.protocol)||!url.hostname||url.username||url.password)return;return value;}catch{return;}
}
