import {createConnection} from 'node:net';
export type WebProbeHost='127.0.0.1'|'::1'|'localhost';
export function webProbeHost(value:string):WebProbeHost{
 if(value!=='127.0.0.1'&&value!=='::1'&&value!=='localhost')throw Error('Ungültige lokale Prüfadresse.');
 return value;
}
// Probe only literal loopback addresses, never resolve a configurable DNS name.
// localhost supports both address families within one 1.5-second time budget.
export async function probeWeb(port:number,host:WebProbeHost='localhost'){
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Ungültiger lokaler Prüfport.');
 webProbeHost(host);
 const addresses=host==='localhost'?['127.0.0.1','::1']:[host];
 const results=await Promise.all(addresses.map(address=>new Promise<boolean>(resolveReady=>{
  const socket=createConnection({host:address,port});let settled=false;
  const finish=(ok:boolean)=>{if(settled)return;settled=true;socket.destroy();resolveReady(ok);};
  socket.setTimeout(1500,()=>finish(false));socket.once('connect',()=>finish(true));socket.once('error',()=>finish(false));
 })));
 return results.some(Boolean);
}
