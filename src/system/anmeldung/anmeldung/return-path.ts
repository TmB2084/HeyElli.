export function returnPath(value:unknown){
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\x00-\x20]/.test(value))return '/';
 try{const decoded=decodeURIComponent(value),url=new URL(value,'https://heyelli.invalid');if(decoded.startsWith('//')||/[\\\x00-\x1f]/.test(decoded)||url.origin!=='https://heyelli.invalid'||/^\/(?:anmeldung|api)(?:[/?#]|$)/i.test(decoded))return '/';return value;}catch{return '/';}
}
