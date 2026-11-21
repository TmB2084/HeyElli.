'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Notice,PopUpButton} from '@/platform/shell';
import type {TaskLink} from './model';
import styles from './workspace.module.css';
// „Aufgabe anlegen“: Kern wird in PDS gespeichert (CRM-Aufgabe), Checkliste und Verknüpfungen in heyelli.
// Wiederverwendet in Aufgaben, MailDesk (aus einer Mail) und Kunde 360.
export type TaskCreateDefaults={subject?:string;description?:string;customerId?:string;objectId?:string;links?:TaskLink[];checklist?:string[];origin?:string};
type Options={types:{id:string;name:string;standard:boolean}[];people:{id:string;name:string}[];me:string|null;customers:{id:string;name:string;number:string}[];objects:{id:string;customerId:string;parentId:string;name:string;address:string}[];canCreate:boolean;reason:string};
const local=(date:Date)=>{const pad=(value:number)=>String(value).padStart(2,'0');return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;};
export function TaskCreateDialog({defaults={},onClose,onCreated}:{defaults?:TaskCreateDefaults;onClose:()=>void;onCreated:(taskId:string)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),requestId=useRef(crypto.randomUUID());
 const [options,setOptions]=useState<Options|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [subject,setSubject]=useState(defaults.subject??''),[typeId,setTypeId]=useState(''),[due,setDue]=useState(()=>{const date=new Date(Date.now()+86400000);date.setHours(16,0,0,0);return local(date);});
 const [assignees,setAssignees]=useState<string[]>([]),[customerId,setCustomerId]=useState(defaults.customerId??''),[objectId,setObjectId]=useState(defaults.objectId??''),[term,setTerm]=useState('');
 const [description,setDescription]=useState(defaults.description??''),[checklist,setChecklist]=useState((defaults.checklist??[]).join('\n'));
 useEffect(()=>{dialog.current?.showModal();},[]);
 useEffect(()=>{void(async()=>{try{const response=await fetch('/api/aufgaben/vorlage',{cache:'no-store',signal:AbortSignal.timeout(60000)}),value=await response.json();if(!response.ok)throw Error(value.error);setOptions(value);setTypeId(value.types.find((type:Options['types'][number])=>type.standard)?.id??'');if(value.me)setAssignees([value.me]);}catch(problem){setError(problem instanceof Error&&problem.name!=='TimeoutError'?problem.message:'Auswahllisten nicht erreichbar.');}})();},[]);
 const customer=options?.customers.find(item=>item.id===customerId),own=useMemo(()=>(options?.objects??[]).filter(item=>item.customerId===customerId),[options,customerId]);
 const found=(options?.customers??[]).filter(item=>term.trim()&&(item.name+' '+item.number).toLocaleLowerCase('de').includes(term.trim().toLocaleLowerCase('de'))).slice(0,8);
 async function submit(event:React.FormEvent){event.preventDefault();setBusy(true);setError('');
  try{const response=await fetch('/api/aufgaben/neu',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:requestId.current,subject,typeId:typeId||undefined,due:due?new Date(due).toISOString():undefined,customerId:customerId||undefined,objectId:objectId||undefined,description:description||undefined,assigneeIds:assignees,checklist:checklist.split('\n').map(line=>line.trim()).filter(Boolean),links:defaults.links??[]}),signal:AbortSignal.timeout(60000)});const value=await response.json();if(!response.ok)throw Error(value.error);dialog.current?.close();onCreated(value.task.id);}
  catch(problem){setError(problem instanceof Error&&problem.name!=='TimeoutError'&&problem.name!=='TypeError'?problem.message:'Anlegen nicht bestätigt. Erneut senden ist sicher – es entsteht keine doppelte Aufgabe.');}
  finally{setBusy(false);}}
 const toggle=(id:string)=>setAssignees(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id].slice(0,10));
 return <dialog ref={dialog} className={styles.picker} style={{width:'min(620px,calc(100vw - 32px))'}} aria-labelledby="task-create-title" onClose={onClose} onCancel={onClose}>
  <div className={styles.pickerHead}><h2 id="task-create-title">Aufgabe anlegen{defaults.origin?<small className={styles.hint} style={{display:'block',fontWeight:400}}>{defaults.origin}</small>:null}</h2><button type="button" className="heyelli-close" aria-label="Schließen" onClick={()=>dialog.current?.close()}/></div>
  <form className={styles.form} style={{padding:'4px 18px 18px'}} onSubmit={submit}>
   {!options&&!error&&<p role="status" className={styles.hint}>Auswahllisten werden geladen …</p>}
   {options&&!options.canCreate&&<Notice tone="neutral">{options.reason||'Anlegen ist derzeit nicht möglich.'}</Notice>}
   <label>Betreff<input value={subject} maxLength={200} required autoFocus onChange={event=>setSubject(event.target.value)}/></label>
   <div className={styles.two}>
    <label>Typ <span className={styles.hint}>aus PDS</span><PopUpButton label="Typ" value={typeId} options={[{value:'',label:'Ohne Typ'},...(options?.types??[]).map(type=>({value:type.id,label:type.name}))]} onChange={setTypeId} disabled={!options}/></label>
    <label>Fällig am<input type="datetime-local" value={due} onChange={event=>setDue(event.target.value)}/></label>
   </div>
   <fieldset><legend>Zuweisen an <span className={styles.hint}>PDS-Benutzer</span></legend>
    <div className={styles.people}>{(options?.people??[]).map(person=><label key={person.id}><input type="checkbox" checked={assignees.includes(person.id)} onChange={()=>toggle(person.id)}/>{person.id===options?.me?`${person.name} (ich)`:person.name}</label>)}</div>
   </fieldset>
   <div className={styles.two}>
    <div className={styles.field}><span>Kunde</span>{customer?<span className={styles.chosen}>{customer.name}<button type="button" className={styles.linkButton} onClick={()=>{setCustomerId('');setObjectId('');}}>ändern</button></span>:<><input type="search" aria-label="Kunde suchen" placeholder="Name oder Kundennummer" value={term} onChange={event=>setTerm(event.target.value)}/>{found.length>0&&<ul className={styles.pickList} role="listbox" aria-label="Kunden">{found.map(item=><li key={item.id} role="option" aria-selected={false}><button type="button" onClick={()=>{setCustomerId(item.id);setTerm('');}}><b>{item.name}</b><small>{item.number}</small></button></li>)}</ul>}</>}</div>
    <label>Objekt oder Einheit <span className={styles.hint}>PDS erlaubt Objekt oder Projektakte</span><PopUpButton label="Objekt oder Einheit" value={objectId} disabled={!customerId} options={[{value:'',label:'Kein bestimmtes Objekt'},...own.map(item=>({value:item.id,label:(item.parentId?'– ':'')+item.name}))]} onChange={setObjectId}/></label>
   </div>
   <label>Beschreibung<textarea rows={4} maxLength={4000} value={description} onChange={event=>setDescription(event.target.value)}/></label>
   <label>Checkliste <span className={styles.hint}>eine Zeile je Schritt · nur in heyelli</span><textarea rows={3} value={checklist} onChange={event=>setChecklist(event.target.value)}/></label>
   {(defaults.links??[]).length>0&&<p className={styles.hint}>Verknüpft (nur in heyelli): {(defaults.links??[]).map(link=>link.label).join(', ')}</p>}
   {error&&<Notice tone="error" role="alert">{error}</Notice>}
   <div className={styles.pickerActions} style={{padding:0,alignItems:'center'}}><span className={styles.stored}>Wird in PDS gespeichert</span><span className={styles.spacer}/><button type="button" onClick={()=>dialog.current?.close()}>Abbrechen</button><button type="submit" className={styles.primary} disabled={busy||!options?.canCreate||!subject.trim()}>{busy?'Wird angelegt …':'Anlegen'}</button></div>
  </form>
 </dialog>;
}
