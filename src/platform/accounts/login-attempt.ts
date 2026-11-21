import {isIP} from 'node:net';
export type LoginAttempt={source:string|null;account:string;channel:'password'|'microsoft'};
// Next's forwarded headers are client-influenced. Trust only an explicitly
// configured single-IP header overwritten by an isolated reverse proxy.
export function loginAttempt(request:Request,channel:LoginAttempt['channel'],account:string,env:NodeJS.ProcessEnv=process.env):LoginAttempt{
 const header=env.AUTH_LOGIN_SOURCE_HEADER;
 let source:string|null=null;
 if(header){
  if(!/^x-[a-z0-9-]{1,80}$/.test(header))throw new Error('Ungültiger Header für die Anmeldequelle.');
  const value=request.headers.get(header)?.trim()??'';
  if(!isIP(value))throw new Error('Vertrauenswürdige Anmeldequelle fehlt.');
  source=isIP(value)===6?new URL(`http://[${value}]/`).hostname.slice(1,-1):value;
  const mapped=/^::ffff:([0-9a-f]+):([0-9a-f]+)$/.exec(source);if(mapped){const high=parseInt(mapped[1],16),low=parseInt(mapped[2],16);source=[high>>8,high&255,low>>8,low&255].join('.');}
 }
 return {source,account:account.normalize('NFKC').trim().toLocaleLowerCase('en-US'),channel};
}
