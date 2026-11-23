'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Notice} from '@/platform/shell';
import {Button,NativeSelect,Textarea} from '@/platform/ui';
import {feedbackReasons,type AnswerFeedback,type FeedbackReason} from './feedback-model';
import styles from './feedback.module.css';
function Thumb({down=false}:{down?:boolean}){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={down?{transform:'rotate(180deg)'}:undefined}><path d="M7 10h3l3-7c3 0 3 3 2 7h5a2 2 0 0 1 2 2l-2 8H7Z"/><path d="M3 10h4v11H3Z"/></svg>;}
export function AnswerFeedbackControl({epoch,turnId,initial}:{epoch:string;turnId:string;initial?:AnswerFeedback}){
 const [saved,setSaved]=useState(initial),[expanded,setExpanded]=useState(false),[reason,setReason]=useState<FeedbackReason|''>(initial?.reason??''),[comment,setComment]=useState(initial?.comment??''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const request=useRef<AbortController|null>(null),pending=useRef(false);
 useEffect(()=>()=>request.current?.abort(),[]);
 async function save(rating:'up'|'down'|null,details=false){
  if(pending.current)return;pending.current=true;setBusy(true);setError('');setMessage('');const abort=new AbortController();request.current=abort;
  try{const response=await fetch('/api/assistent/bewertungen',{method:rating?'POST':'DELETE',headers:{'Content-Type':'application/json'},signal:AbortSignal.any([abort.signal,AbortSignal.timeout(15000)]),body:JSON.stringify({epoch,turnId,...(rating?{rating,reason:rating==='down'?(details?reason||null:saved?.reason??null):null,comment:rating==='down'?(details?comment:saved?.comment??''):''}:{})})});const value=await response.json();if(!response.ok)throw Error(value.error);if(abort.signal.aborted)return;
   setSaved(rating?value:undefined);setReason(rating==='down'?value.reason??'':'');setComment(rating==='down'?value.comment??'':'');setExpanded(rating==='down'&&!details);setMessage(rating?'Bewertung gespeichert.':'Bewertung entfernt.');
  }catch(problem){if(!abort.signal.aborted)setError(problem instanceof TypeError||problem instanceof DOMException?'Bewertung nicht gespeichert. Bitte Verbindung prüfen und erneut versuchen.':problem instanceof Error?problem.message:'Bewertung nicht gespeichert. Bitte erneut versuchen.');}
  finally{pending.current=false;if(!abort.signal.aborted)setBusy(false);}
 }
 function submit(event:FormEvent){event.preventDefault();void save('down',true);}
 return <div className={styles.feedback}>
  <div className={styles.actions} role="group" aria-label="Antwort bewerten – nur Administratoren">
   <Button variant="ghost" size="icon" aria-label="Antwort hilfreich" title="Hilfreich" aria-pressed={saved?.rating==='up'} disabled={busy} onClick={()=>void save(saved?.rating==='up'?null:'up')}><Thumb/></Button>
   <Button variant="ghost" size="icon" aria-label="Antwort nicht hilfreich" title="Nicht hilfreich" aria-pressed={saved?.rating==='down'} disabled={busy} onClick={()=>void save(saved?.rating==='down'?null:'down')}><Thumb down/></Button>
   {saved?.rating==='down'&&<Button variant="ghost" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)} disabled={busy}>{saved.reason||saved.comment?'Grund bearbeiten':'Grund ergänzen'}</Button>}
   <small title="Nur diese bewertete Frage und Antwort werden für Administratoren zur Wissenspflege gespeichert. Die Rückmeldung bleibt nach Neuer Chat erhalten und lässt sich wieder entfernen.">Nur Admins · Speichert Frage & Antwort</small>
  </div>
  {expanded&&saved?.rating==='down'&&<form className={styles.form} onSubmit={submit}>
   <label>Grund (optional)<NativeSelect value={reason} disabled={busy} onChange={event=>setReason(event.target.value as FeedbackReason|'')}><option value="">Kein Grund ausgewählt</option>{Object.entries(feedbackReasons).map(([value,label])=><option key={value} value={value}>{label}</option>)}</NativeSelect></label>
   <label>Hinweis (optional)<Textarea rows={2} maxLength={600} value={comment} disabled={busy} onChange={event=>setComment(event.target.value)} placeholder="Was sollte Elli besser erklären?"/></label>
   <small>Keine vertraulichen Angaben. Die bewertete Frage und Antwort bleiben für Administratoren zur Wissenspflege gespeichert, auch nach „Neuer Chat“.</small>
   <Button variant="outline" type="submit" disabled={busy}>{busy?'Wird gespeichert …':'Grund speichern'}</Button>
  </form>}
  <Notice tone="error">{error}</Notice>{message&&<span className={styles.success} role="status">{message}</span>}
 </div>;
}
