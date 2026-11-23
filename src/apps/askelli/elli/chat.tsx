'use client';
import {useEffect,useRef,useState,type ReactNode,type FormEvent} from 'react';
import {Notice,GuardedLink,AppGlyph,appIconBackground} from '@/platform/shell';
import {Button} from '@/platform/ui';
import {Conversation,Message,PromptInput,Sources,Suggestion} from '@/platform/ui/ai-elements';
import styles from './chat.module.css';
import {greetingFallback,greetingStyleVersion} from './greeting';
import {ElliIntroduction} from './introduction';
import {ActionConfirmation} from './action-confirmation';
import {AnswerFeedbackControl} from './answer-feedback';
import type {AnswerFeedback} from './feedback-model';
type Turn={hasAction?:boolean;id:string;question:string;answer:string;sources:{title:string;href:string}[]};
type Job={id:string;question:string;draft?:{id:string;revision:number}};
type Draft={text:string;revision:number;updatedAt:string};
type Chat={owner:string;epoch:string;turns:Turn[];pending:Job[];drafts:Record<string,Draft>;canRate?:boolean;feedback?:AnswerFeedback[]};
const suggestions=[['Termin vergeben','Wie vergebe ich einen Termin für einen bestehenden Auftrag, ohne einen neuen Auftrag anzulegen?'],['Termin bearbeiten','Wie öffne ich einen Termin zur vollständigen Bearbeitung?'],['Bereitschaft zuweisen','Wie weise ich einem Mitarbeiter eine Bereitschaft zu?'],['Darstellung ändern','Wie schalte ich auf helle oder dunkle Darstellung um?']];
function prefix(owner:string,epoch:string){return 'heyelli-chat:'+owner+':'+epoch+':';}
function localEntries(owner:string,epoch:string){const entries:Record<string,{draft?:Draft;job?:Job}>={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(prefix(owner,epoch))){try{entries[key]=JSON.parse(localStorage.getItem(key)??'{}');}catch{/* Keep an unreadable backup intact. */}}}return entries;}
export function LocalAssistant({shortcuts,footer}:{shortcuts?:ReactNode;footer?:ReactNode}){
 const [providerName,setProviderName]=useState('');
 const [providerEnabled,setProviderEnabled]=useState(false),[providerWrite,setProviderWrite]=useState(false),[providerLoaded,setProviderLoaded]=useState(false),[actionBusy,setActionBusy]=useState(false);
 useEffect(()=>{let active=true;const controller=new AbortController();async function load(){try{const r=await fetch('/api/assistent/status',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])}),v=await r.json();if(active){setProviderName(r.ok?v.provider:'unavailable');setProviderEnabled(r.ok&&v.enabled===true);setProviderWrite(r.ok&&v.canWrite===true);setProviderLoaded(true);}}catch{if(active){setProviderName('unavailable');setProviderEnabled(false);setProviderLoaded(true);}}}void load();const timer=setInterval(()=>void load(),15000);window.addEventListener('heyelli:copilot-change',load);window.addEventListener('online',load);return()=>{active=false;controller.abort();clearInterval(timer);window.removeEventListener('heyelli:copilot-change',load);window.removeEventListener('online',load);};},[]);
 const [canRate,setCanRate]=useState(false),[feedback,setFeedback]=useState<AnswerFeedback[]>([]);
 const [greeting,setGreeting]=useState({epoch:'',text:'',error:false});
 const [started,setStarted]=useState(false),[ready,setReady]=useState(false),[owner,setOwner]=useState(''),[epoch,setEpoch]=useState(''),[loadRevision,setLoadRevision]=useState(0),[resetting,setResetting]=useState(false);
 const [question,setQuestion]=useState(''),[turns,setTurns]=useState<Turn[]>([]),[queue,setQueue]=useState<Job[]>([]),[recoveries,setRecoveries]=useState<string[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
 const input=useRef<HTMLTextAreaElement>(null),conversation=useRef<HTMLDivElement>(null),controller=useRef<AbortController|null>(null),editor=useRef(''),epochRef=useRef(''),revision=useRef(0),draftTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{const abort=new AbortController();let active=true;void(async()=>{try{
  const response=await fetch('/api/assistent/verlauf',{cache:'no-store',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(15000)])}),value:Chat=await response.json();if(!response.ok)throw Error();
  const drafts={...value.drafts},pending=new Map(value.pending.map(job=>[job.id,job]));
  for(const [key,backup]of Object.entries(localEntries(value.owner,value.epoch))){if(backup.draft){const id=key.split(':').at(-1)!;if(!drafts[id]||drafts[id].revision<backup.draft.revision)drafts[id]=backup.draft;}if(backup.job&&!value.turns.some(turn=>turn.id===backup.job!.id))pending.set(backup.job.id,backup.job);}
  const saved=Object.values(drafts).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt));
  if(active){editor.current=crypto.randomUUID();revision.current=0;setCanRate(value.canRate===true);setFeedback(value.feedback??[]);setOwner(value.owner);epochRef.current=value.epoch;setEpoch(value.epoch);setTurns(value.turns);setQueue([...pending.values()]);setQuestion(saved[0]?.text??'');setRecoveries([...new Set(saved.map(draft=>draft.text).filter(Boolean))]);setStarted(value.turns.length>0||pending.size>0);setBusy(pending.size>0);setError('');setReady(true);}
 }catch{if(active)setError('Der gesicherte Chat konnte nicht geladen werden. Bitte erneut laden.');}})();return()=>{active=false;abort.abort();};},[loadRevision]);
 useEffect(()=>{
  if(!epoch||!owner||!providerName||providerName==='unavailable')return;const abort=new AbortController();let active=true;
  void(async()=>{try{
   const key='heyelli-introduction:'+owner;let cached;try{cached=JSON.parse(localStorage.getItem(key)??'null');}catch{}
   if(cached?.style===greetingStyleVersion&&cached?.provider===providerName&&cached?.epoch===epoch&&typeof cached.text==='string'&&cached.text.length<=360){if(active)setGreeting({epoch,text:cached.text,error:false});return;}
   const signal=AbortSignal.any([abort.signal,AbortSignal.timeout(25000)]);let response:Response;
   for(let attempt=0;;attempt++){response=await fetch('/api/assistent/begruessung',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({epoch}),signal});if(response.status!==429||attempt>=12)break;await new Promise(resolve=>setTimeout(resolve,1000));if(signal.aborted)throw Error();}
   const value=await response.json();if(!response.ok||value.epoch!==epoch||typeof value.greeting!=='string')throw Error();
   if(active){setGreeting({epoch,text:value.greeting,error:false});try{localStorage.setItem(key,JSON.stringify({epoch,text:value.greeting,style:greetingStyleVersion,provider:providerName}));}catch{}}
  }catch{if(active)setGreeting({epoch,text:greetingFallback,error:true});}})();
  return()=>{active=false;abort.abort();};
 },[epoch,owner,providerName]);
 useEffect(()=>{if(conversation.current)conversation.current.scrollTop=conversation.current.scrollHeight;},[turns,queue,busy]);
 useEffect(()=>()=>{controller.current?.abort();if(draftTimer.current)clearTimeout(draftTimer.current);},[]);
 useEffect(()=>{
  if(!ready||resetting||!queue.length||!providerEnabled)return;
  const job=queue[0],abort=new AbortController();controller.current=abort;let timer:ReturnType<typeof setTimeout>|undefined;
  void(async()=>{await Promise.resolve();if(abort.signal.aborted)return;setBusy(true);try{const response=await fetch('/api/assistent',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.any([abort.signal,AbortSignal.timeout(95000)]),body:JSON.stringify({question:job.question,epoch,id:job.id,draft:job.draft})}),result=await response.json();if(abort.signal.aborted)return;if(!response.ok){if(response.status===409&&/Chat wurde|anderen Fenster/.test(result.error??''))setReady(false);throw Error(result.error);}
   const saved=result.chat as Chat;setTurns(saved.turns);setQueue(previous=>{const next=new Map([...previous,...saved.pending].filter(item=>!saved.turns.some(turn=>turn.id===item.id)).map(item=>[item.id,item]));return [...next.values()];});
   for(const [key,entry]of Object.entries(localEntries(owner,epoch)))if(entry.job?.id===job.id||(job.draft&&key.endsWith('draft:'+job.draft.id)&&entry.draft&&entry.draft.revision<=job.draft.revision))localStorage.removeItem(key);
   setRecoveries(previous=>previous.filter(text=>text.trim()!==job.question.trim()));setError('');
  }catch(problem){if(!abort.signal.aborted){setError((problem instanceof Error?problem.message:'Die Antwort konnte nicht geladen werden.')+' Die Frage bleibt gesichert. Erneuter Versuch bei Verbindung oder automatisch in 30 Sekunden.');timer=setTimeout(()=>setRetry(value=>value+1),30000);}}
  finally{if(controller.current===abort&&!abort.signal.aborted){controller.current=null;setBusy(false);}}})();
  return()=>{abort.abort();if(timer)clearTimeout(timer);};
 },[ready,resetting,queue,retry,epoch,owner,providerEnabled]);
 useEffect(()=>{function online(){setRetry(value=>value+1);}window.addEventListener('online',online);return()=>window.removeEventListener('online',online);},[]);
 useEffect(()=>{
  if(!ready||resetting)return;const abort=new AbortController();let active=true;
  async function sync(){for(const [key,entry]of Object.entries(localEntries(owner,epoch))){if(!entry.draft)continue;try{const response=await fetch('/api/assistent/verlauf',{method:'PATCH',headers:{'Content-Type':'application/json'},signal:abort.signal,body:JSON.stringify({epoch,id:key.split(':').at(-1),text:entry.draft.text,revision:entry.draft.revision})});if(!response.ok&&response.status!==409&&active)setError('Die Frage bleibt auf diesem Gerät gesichert. Datenbanksicherung wird erneut versucht.');}catch{if(active)setError('Die Frage bleibt auf diesem Gerät gesichert. Datenbanksicherung wird erneut versucht.');}}}
  void sync();const timer=setInterval(()=>void sync(),15000);window.addEventListener('online',sync);return()=>{active=false;abort.abort();clearInterval(timer);window.removeEventListener('online',sync);};
 },[ready,resetting,owner,epoch]);
 async function syncDraft(id:string,text:string,version:number){try{const response=await fetch('/api/assistent/verlauf',{method:'PATCH',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({epoch,id,text,revision:version})});if(!response.ok&&epochRef.current===epoch&&!resetting)setError('Die Frage ist auf diesem Gerät gesichert; die Datenbanksicherung ist noch nicht erreichbar.');}catch{if(epochRef.current===epoch)setError('Die Frage ist auf diesem Gerät gesichert; die Datenbanksicherung ist noch nicht erreichbar.');}}
 function edit(text:string){setQuestion(text);if(!ready||resetting)return;const id=editor.current,version=++revision.current,draft={text,revision:version,updatedAt:new Date().toISOString()};try{localStorage.setItem(prefix(owner,epoch)+'draft:'+id,JSON.stringify({draft}));}catch{setError('Die lokale Sicherung ist nicht verfügbar. Bitte die Datenbanksicherung abwarten.');}if(draftTimer.current)clearTimeout(draftTimer.current);draftTimer.current=setTimeout(()=>void syncDraft(id,text,version),250);}
 function ask(value:string){if(!providerEnabled||!ready||resetting||busy||actionBusy||!value.trim())return;const existing=queue.find(job=>job.question===value.trim());if(existing){setRetry(item=>item+1);return;}const job={id:crypto.randomUUID(),question:value.trim(),draft:{id:editor.current,revision:revision.current+1}};try{localStorage.setItem(prefix(owner,epoch)+'pending:'+job.id,JSON.stringify({job}));}catch{setError('Die Frage konnte nicht sicher auf diesem Gerät vorgemerkt werden. Bitte erneut versuchen.');return;}setStarted(true);setBusy(true);setError('');setQueue(previous=>[...previous,job]);edit('');}
 async function newChat(){if(!ready||resetting||actionBusy)return;controller.current?.abort();controller.current=null;if(draftTimer.current)clearTimeout(draftTimer.current);setBusy(false);setResetting(true);setError('');try{const response=await fetch('/api/assistent/verlauf',{method:'DELETE',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),body:JSON.stringify({epoch})}),value=await response.json();if(!response.ok)throw Error(value.error);for(const key of Object.keys(localEntries(owner,epoch)))localStorage.removeItem(key);epochRef.current=value.epoch;setEpoch(value.epoch);setTurns([]);setFeedback([]);setQueue([]);setQuestion('');setRecoveries([]);setStarted(false);editor.current=crypto.randomUUID();revision.current=0;requestAnimationFrame(()=>input.current?.focus({preventScroll:true}));}catch(problem){setError(problem instanceof Error?problem.message:'Der Chat konnte nicht zurückgesetzt werden.');setReady(false);}finally{setResetting(false);}}
 function submit(event:FormEvent){event.preventDefault();ask(question);}
 return (
  <>
   {!started&&shortcuts}
   <section className={styles.card} aria-labelledby="assistant-title">
    <header className={styles.header}>
     <span className={styles.symbol} style={{background:appIconBackground.elli}} aria-hidden="true"><AppGlyph icon="elli"/></span>
     <div>
      <h2 id="assistant-title" className="sr-only">AskElli</h2>
      <p>Bedienhilfe im Gespräch{providerName==='copilot'?' · mit Copilot':providerName==='ollama'?' · lokal mit Ollama':''}</p>
     </div>
     <Button variant="outline" disabled={!ready||resetting||actionBusy} onClick={()=>void newChat()}>
      {resetting?'Wird zurückgesetzt …':'Neuer Chat'}
     </Button>
    </header>
    <Conversation ref={conversation} aria-label="Gespräch mit Elli">
     {epoch&&(greeting.epoch===epoch
      ? <><ElliIntroduction key={epoch} text={greeting.text}/>{greeting.error&&<p className={styles.status} role="status">Persönliche Begrüßung gerade nicht verfügbar. Du kannst Elli trotzdem ausprobieren.</p>}</>
      : <p className={styles.status} role="status">Elli formuliert deine Begrüßung …</p>)}
     {turns.map(turn=>(
      <div key={turn.id} className={styles.turn}>
       <Message from="user">{turn.question}</Message>
       <Message from="assistant">
        <strong className={styles.author}>Elli</strong>
        <p className={styles.answer}>{turn.answer}</p>
        {turn.sources.length>0&&<Sources aria-label="Verwendete Anleitung">
         {turn.sources.map(source=>(
          <Button asChild variant="link" key={source.href}><GuardedLink href={source.href}>{source.title} ›</GuardedLink></Button>
         ))}
        </Sources>}
        {turn.hasAction&&<ActionConfirmation epoch={epoch} turnId={turn.id} enabled={providerEnabled&&providerWrite} locked={actionBusy} onBusy={setActionBusy}/>}
        {canRate&&<AnswerFeedbackControl key={epoch+turn.id+JSON.stringify(feedback.find(item=>item.turnId===turn.id))} epoch={epoch} turnId={turn.id} initial={feedback.find(item=>item.turnId===turn.id)}/>}
       </Message>
      </div>
     ))}
     {queue.map(job=>(
      <div key={job.id} className={styles.turn}>
       <Message from="user">{job.question}</Message>
       <p className={styles.status} role="status">{!providerEnabled?'Frage gesichert · wartet auf den KI-Anbieter':error?'Frage gesichert · Antwort wird erneut versucht':'Elli antwortet …'}</p>
      </div>
     ))}
    </Conversation>
    {providerLoaded&&!providerEnabled&&<Notice tone="neutral" role="status">Ellis Anbieterstatus ist gerade nicht verfügbar. Deine Eingaben bleiben gesichert.</Notice>}
    {!ready&&!error&&<p role="status">Gesicherter Chat wird geladen …</p>}
    {error&&<Notice tone="error">{error}{!ready&&<Button variant="outline" onClick={()=>{setError('');setLoadRevision(value=>value+1);}}>Chat erneut laden</Button>}</Notice>}
    <PromptInput
     ref={input}
     id="assistant-question"
     label="Wie kann ich dir helfen?"
     sendLabel="Frage senden"
     sendDisabled={!providerEnabled||busy||actionBusy||!ready||resetting||!question.trim()}
     maxLength={1500}
     rows={1}
     placeholder="Frage stellen oder eine Änderung vorbereiten …"
     value={question}
     disabled={!ready||resetting||(busy&&providerEnabled)||actionBusy}
     onChange={event=>edit(event.target.value)}
     onSubmit={submit}
    />
    <div className={styles.suggestions} role="group" aria-label="Häufige Bedienungsfragen">
     {suggestions.map(([label,text])=><Suggestion key={label} disabled={!providerEnabled||busy||actionBusy||!ready||resetting} onClick={()=>ask(text)}>{label}<span aria-hidden="true">↗</span></Suggestion>)}
    </div>
    {recoveries.some(text=>text!==question)&&<details className={styles.recoveries}>
     <summary>Weitere gesicherte Fragen</summary>
     {recoveries.filter(text=>text!==question).map(text=>(
      <Button key={text} title={text} variant="outline" disabled={busy||!ready||resetting} onClick={()=>{
       setRecoveries(previous=>[...new Set([...previous,question].filter(Boolean))]);
       editor.current=crypto.randomUUID();
       revision.current=0;
       edit(text);
      }}>{text}</Button>
     ))}
    </details>}
    <small className={styles.note}>{providerName==='copilot'?'Copilot verarbeitet Fragen und ausgewählte Kontexte bei Microsoft. Änderungen erst nach Bestätigung. Keine Zugangsdaten eingeben.':providerName==='ollama'?'Lokale Bedienungshilfe mit Ollama. Keine aktuellen Fachdaten oder Schreibaktionen. Keine Zugangsdaten eingeben.':'Anbieterstatus nicht verfügbar. Deine Eingaben bleiben gesichert.'}</small>
   </section>
   {footer}
  </>
 );
}
