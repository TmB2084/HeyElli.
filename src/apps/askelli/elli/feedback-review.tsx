'use client';
import {useEffect,useState} from 'react';
import {Notice} from '@/platform/shell';
import {feedbackReasons,type FeedbackReviewItem} from './feedback-model';
import styles from './feedback.module.css';
type Review={items:FeedbackReviewItem[];total:number;page:number;pageSize:number;ownUserId:string};
const time=(value:string)=>new Intl.DateTimeFormat('de-DE',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Berlin'}).format(new Date(value));
export function AssistantFeedbackReview(){
 const [page,setPage]=useState(0),[revision,setRevision]=useState(0),[data,setData]=useState<Review|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[deleting,setDeleting]=useState(false);
 useEffect(()=>{const abort=new AbortController();void(async()=>{setLoading(true);setError('');try{const response=await fetch('/api/assistent/bewertungen?review=1&page='+page,{cache:'no-store',signal:abort.signal}),value=await response.json();if(!response.ok){setData(null);throw Error(value.error);}if(!abort.signal.aborted)setData(value);}catch(problem){if(!abort.signal.aborted)setError(problem instanceof Error?problem.message:'Rückmeldungen nicht erreichbar.');}finally{if(!abort.signal.aborted)setLoading(false);}})();return()=>abort.abort();},[page,revision]);
 async function remove(item:FeedbackReviewItem){setDeleting(true);setError('');try{const response=await fetch('/api/assistent/bewertungen',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({epoch:item.epoch,turnId:item.turnId}),signal:AbortSignal.timeout(15000)});const value=await response.json();if(!response.ok)throw Error(value.error);if(data?.items.length===1&&page>0)setPage(value=>value-1);else setRevision(value=>value+1);}catch(problem){setError(problem instanceof Error?problem.message:'Entfernen fehlgeschlagen.');}finally{setDeleting(false);}}
 return <section className={styles.review} aria-label="AskElli – Rückmeldungen">
  <p>Nur ausdrücklich bewertete eigene Antworten von Administratoren. Frage und Antwort bleiben nach „Neuer Chat“ zur Wissenspflege gespeichert. Keine automatische Übernahme ins Wissen oder Modelltraining.</p>
  <Notice tone="error">{error}</Notice>{loading&&<p role="status">Rückmeldungen werden geladen …</p>}
  {data&&<><nav aria-label="Rückmeldungsseiten"><button type="button" disabled={page===0||loading||deleting} onClick={()=>setPage(value=>value-1)}>Zurück</button><span>Seite {page+1} · {data.total} Rückmeldungen</span><button type="button" disabled={(page+1)*data.pageSize>=data.total||loading||deleting} onClick={()=>setPage(value=>value+1)}>Weiter</button><button type="button" disabled={loading||deleting} onClick={()=>setRevision(value=>value+1)}>Aktualisieren</button></nav>
   {!data.items.length&&!loading&&<p>Noch keine Rückmeldungen.</p>}
   {data.items.map(item=><article key={item.userId+item.epoch+item.turnId}>
    <header><strong>{item.rating==='up'?'Hilfreich':'Nicht hilfreich'}</strong><small>{item.displayName} · {time(item.updatedAt)}</small></header>
    {item.reason&&<p>{feedbackReasons[item.reason]}</p>}{item.comment&&<p>{item.comment}</p>}
    <details><summary>Bewertete Frage und Antwort</summary><p><strong>Frage</strong><br/>{item.question}</p><p><strong>Antwort</strong><br/>{item.answer}</p><small>Wissensstand: {item.knowledgeVersion==='legacy'?'Ältere Antwort ohne Versionsangabe':item.knowledgeVersion.slice(0,12)} · Erfasst {time(item.createdAt)}</small><p>{item.sources.map(source=>source.title).join(' · ')}</p></details>
    {item.userId===data.ownUserId&&<button type="button" disabled={deleting||loading} onClick={()=>void remove(item)}>Eigene Bewertung entfernen</button>}
   </article>)}
  </>}
 </section>;
}
