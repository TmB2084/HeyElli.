function developmentHostname(args){let host;
 for(let index=0;index<args.length;index++){
  const arg=args[index];if(arg==='--hostname'||arg==='-H'){if(host!==undefined)throw Error('Hostname nur einmal angeben.');host=args[++index];if(!host||host.startsWith('-'))throw Error('Hostname fehlt.');}
  else if(arg.startsWith('--hostname=')||arg.startsWith('-H')){if(host!==undefined)throw Error('Hostname nur einmal angeben.');host=arg.startsWith('-H')?arg.slice(arg.startsWith('-H=')?3:2):arg.slice(arg.indexOf('=')+1);if(!host)throw Error('Hostname fehlt.');}
 }
 return host;
}
export function developmentArgs(args){
 const lan=args.includes('--lan'),forwarded=args.filter(arg=>arg!=='--lan'),host=developmentHostname(forwarded);
 if(host!==undefined&&!['127.0.0.1','localhost','::1'].includes(host)&&!lan)throw Error('Netzwerkzugriff erfordert ausdrücklich --lan. Standard ist ausschließlich lokal.');
 return {lan,args:host===undefined?['--hostname',lan?'0.0.0.0':'127.0.0.1',...forwarded]:forwarded};
}

export function developmentPort(args,env=process.env){
 let value;
 for(let index=0;index<args.length;index++){
  const arg=args[index];let next;
  if(arg==='--port'||arg==='-p')next=args[++index]??'';
  else if(arg.startsWith('--port='))next=arg.slice(7);
  else if(arg.startsWith('-p'))next=arg.slice(arg.startsWith('-p=')?3:2);
  if(next!==undefined){if(value!==undefined)throw Error('Port nur einmal angeben.');value=next;}
 }
 value=value??env.PORT??'3000';
 if(!/^\d+$/.test(String(value))||Number(value)<1||Number(value)>65535)throw Error('Ungültiger Entwicklungsport.');
 return Number(value);
}

// An explicit port disables Next's automatic fallback to a different listener.
export function developmentWebArgs(args,env=process.env){const port=developmentPort(args,env);return args.some(arg=>arg==='--port'||arg.startsWith('--port=')||arg.startsWith('-p'))?[...args]:[...args,'--port',String(port)];}

export function developmentMonitorHost(args){const host=developmentHostname(args);return host==='::1'||host==='::'?'::1':host==='localhost'?'localhost':'127.0.0.1';}
