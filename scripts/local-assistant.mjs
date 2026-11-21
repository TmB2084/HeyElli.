// Development-only child process; no login service or external network listener.
import {spawn} from 'node:child_process';
try{const response=await fetch((process.env.OLLAMA_BASE_URL||'http://127.0.0.1:11434').replace(/\/$/,'')+'/api/tags',{signal:AbortSignal.timeout(1200)});if(response.ok){console.log('Lokales Ollama ist bereits erreichbar.');process.exit(0);}}catch{}
const server=spawn('ollama',['serve'],{env:{...process.env,OLLAMA_HOST:'127.0.0.1:11434',OLLAMA_NO_CLOUD:'1',OLLAMA_NUM_PARALLEL:'1',OLLAMA_MAX_LOADED_MODELS:'1'},stdio:['ignore','ignore','ignore']});
server.on('error',()=>{console.error('Lokaler Assistent: Ollama nicht installiert. npm run assistant:setup ausführen.');process.exitCode=1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.kill('SIGTERM'));
server.on('exit',code=>{process.exitCode=code??0;});
