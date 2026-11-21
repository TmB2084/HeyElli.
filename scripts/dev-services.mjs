// Own only processes created here; never signal a PID discovered by a scan.
export function stopChild(child,graceMs=30000){
 if(!child||child.exitCode!==null||child.signalCode!==null)return Promise.resolve();
 return new Promise(resolve=>{let timer;const done=()=>{clearTimeout(timer);resolve();};child.once('close',done);child.kill('SIGTERM');if(Number.isFinite(graceMs))timer=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},graceMs);});
}
export function superviseService(start,{message,alreadyRunningCode,retryMs=3000,graceMs=30000,log=console.error}){
 let child,timer,stopping=false,ended;
 function again(){if(stopping)return;log(message);timer=setTimeout(launch,retryMs);}
 function launch(){if(stopping)return;try{child=start();child.on('error',()=>{});child.once('close',code=>{if(!stopping&&code!==alreadyRunningCode)again();});}catch{again();}}
 launch();
 return {stop(){if(ended)return ended;stopping=true;clearTimeout(timer);ended=stopChild(child,graceMs);return ended;}};
}
