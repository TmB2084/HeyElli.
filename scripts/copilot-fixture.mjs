// Only a named disposable browser fixture; never patches the development source.
import {readFile,writeFile,cp} from 'node:fs/promises';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {join,resolve} from 'node:path';
const fixture=JSON.parse(await readFile('/private/tmp/heyelli-chat-browser.json','utf8'));
if(!fixture.project?.startsWith('heyelli-chat-browser-')||!fixture.directory?.includes('heyelli-chat-browser-')||!new URL(fixture.base).hostname.match(/^(127\.0\.0\.1|localhost)$/))throw Error('Named isolated fixture required');
await cp(resolve('src'),join(fixture.directory,'src'),{recursive:true});
const localFile=join(fixture.directory,'src/apps/askelli/elli/ollama.ts');await writeFile(localFile,(await readFile(localFile,'utf8')).replace('http://127.0.0.1:11434/api/chat',fixture.model+'/api/chat'));
const conversations=new Map();
const server=createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');let raw='';for await(const part of req)raw+=part;const body=raw?JSON.parse(raw):{};
if(req.url==='/v3/directline/tokens/generate'){res.end(JSON.stringify({token:'fictional-short-lived-token'}));return;}
if(req.url==='/v3/directline/conversations'){const id=randomUUID();conversations.set(id,{});res.end(JSON.stringify({conversationId:id}));return;}
const id=req.url.split('/')[4],conversation=conversations.get(id);if(!conversation){res.writeHead(404);res.end('{}');return;}
if(req.method==='POST'){
 const request=JSON.parse(body.text.replace(/^HEYELLI_REQUEST\n/,'')),question=request.question??'',context=request.context??{events:[],resources:[]};let answer={answer:'Öffne Service und wähle die Auftragsakte. Dort findest du Termin vergeben.',action:null};
 if(request.protocolTest)answer={answer:'HEYELLI_COPILOT_READY',action:null};
 else if(request.greeting)answer={answer:'Hallo, ich bin Elli! Was möchtest du heute in HeyElli erledigen?',action:null};
 else if(/^Lege /i.test(question))answer={answer:'Ein Vorschlag ist bereit.',action:{kind:'create',title:'Fiktiver Copilot-Prüftermin',resourceId:context.resources[0]?.id,start:'2026-11-16T09:00:00Z',end:'2026-11-16T10:00:00Z'}};
 else if(/^Verschiebe /i.test(question)){const event=context.events.find(e=>question.includes(e.id));answer={answer:'Ein Vorschlag ist bereit.',action:{kind:'move',eventId:event?.id,start:'2026-11-17T09:00:00Z'}};}
 else if(/^Gib /i.test(question)){const event=context.events.find(e=>question.includes(e.id));answer={answer:'Ein Vorschlag ist bereit.',action:{kind:'mobile',eventId:event?.id}};}
 conversation.reply={type:'message',from:{id:'fixture-bot',role:'bot'},replyToId:'request-id',text:JSON.stringify(answer)};res.end('{"id":"request-id"}');return;
}
res.end(JSON.stringify({activities:conversation.reply?[conversation.reply]:[],watermark:'1'}));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const file=join(fixture.directory,'src/apps/askelli/copilot/transport.ts');await writeFile(file,(await readFile(file,'utf8')).replace("https://directline.botframework.com/v3/directline",`http://127.0.0.1:${server.address().port}/v3/directline`));
console.log('Isolierter Copilot-Dienst bereit; keine Microsoft-Verbindung.');
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
