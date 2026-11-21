import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {openOrderStore} from '../src/platform/pds/simulator/order-store.ts';
const root=await mkdtemp(join(tmpdir(),'heyelli-upload-load-'));let store,maximum=process.memoryUsage().rss;const started=performance.now(),block=Buffer.alloc(65536,65);let remaining=64*1024*1024;
try{store=openOrderStore(join(root,'isolated.sqlite'));const body=new ReadableStream({pull(c){maximum=Math.max(maximum,process.memoryUsage().rss);if(!remaining){c.close();return;}remaining-=block.length;c.enqueue(block);}});await store.receiveUpload(randomUUID(),'fictitious.eml','fictitious',body);maximum=Math.max(maximum,process.memoryUsage().rss);console.log(JSON.stringify({bytes:64*1024*1024,rssMax:maximum,durationMs:Math.round(performance.now()-started)}));}finally{store?.close();await rm(root,{recursive:true,force:true});}
