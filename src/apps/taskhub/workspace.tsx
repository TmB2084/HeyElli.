'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {AppGlyph,appIconBackground,GuardedLink,Notice,PlannerGlyph,PopUpButton} from '@/platform/shell';
import type {PdsTask,TaskStatus,Visit} from '@/platform/pds/api/index.ts';
import {TaskCreateDialog} from './create-dialog';
import {dueGroup,inView,sourceLabels,statusLabels,viewLabels,type TaskExtras,type TaskItem,type TaskSource,type TaskView} from './model';
import styles from './workspace.module.css';
type Item=TaskItem&{checklist:{total:number;done:number}|null};
type Overview={items:Item[];people:{id:string;name:string}[];me:string|null;source:'simulator'|'pds-readonly';canWrite:boolean;canWritePds:boolean;truncated:boolean;mailError:string;loadedAt:string};
type Detail={task:PdsTask;typeName:string|null;customer:{id:string;name:string;number:string}|null;object:{id:string;name:string;address:string}|null;assignments:{id:string;employeeId:string|null;name:string;assignedAt:string|null}[];
 visits:(Visit&{employees:string[]})[];extras:TaskExtras;people:{id:string;name:string}[];canWrite:boolean;canWritePds:boolean};
const P:Record<string,React.ReactNode>={task:<><rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8 12 3 3 5-6"/></>,alert:<><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/></>,cal:<><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></>,clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,pause:<><circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/></>,
 pds:<><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 10h4M7 14h10"/></>,mail:<><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></>,doc:<><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/></>,user:<><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-5.5 7-5.5s6 1.5 7 5.5"/></>,people:<><circle cx="9" cy="8" r="3"/><path d="M3 19a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M18 19a6 6 0 0 0-2-4"/></>,
 side:<><rect x="3" y="4" width="21" height="16" rx="3"/><path d="M9 4v16"/></>,reload:<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>,new:<><path d="M4 20h4l10-10-4-4L4 16z"/><path d="m13 7 4 4"/></>,search:<><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></>,back:<path d="m15 6-6 6 6 6"/>,ok:<path d="m5 12 4 4 10-10"/>,ext:<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>,house:<path d="M4 20V9l8-5 8 5v11M9 20v-6h6v6"/>,link:<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>,x:<path d="M6 6l12 12M18 6 6 18"/>};
function Glyph({name,size=16}:{name:string;size?:number}){return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[name]}</svg>;}
const berlin=(value:string,options:Intl.DateTimeFormatOptions)=>Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',...options}).format(new Date(value)):'';
const dayKey=(value:string|Date)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date(value));
function dueText(due:string|null,now:Date){if(!due)return '';const group=dueGroup(due,now);if(group==='overdue'){const days=Math.round((Date.parse(dayKey(now))-Date.parse(dayKey(due)))/864e5);return days<=0?'seit '+berlin(due,{hour:'2-digit',minute:'2-digit'}):days===1?'seit gestern':`seit ${days} Tagen`;}if(group==='today')return 'heute '+berlin(due,{hour:'2-digit',minute:'2-digit'});if(group==='week')return berlin(due,{weekday:'short'});return berlin(due,{day:'2-digit',month:'2-digit'});}
const sourceIcon:Record<TaskSource,string>={pds:'pds',mail:'mail',order:'doc'};
const sourceTag:Record<TaskSource,string>={pds:'pds',mail:'mail',order:'source-order'};
const viewIcon:Record<TaskView,string>={all:'task',overdue:'alert',today:'cal',week:'clock',waiting:'pause'};
const groupLabel={overdue:'Überfällig',today:'Heute',week:'Diese Woche',later:'Später',none:'Ohne Datum'} as const;
const initials=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'?';

export function TasksWorkspace(){
 const params=useSearchParams(),router=useRouter();
 const view=(params.get('ansicht')??'all') as TaskView,sourceFilter=(params.get('quelle')??'') as TaskSource|'',person=params.get('person')??'',key=params.get('id')??'',query=params.get('q')??'',scope=params.get('alle')==='1'?'team':'mine';
 const [data,setData]=useState<Overview|null>(null),[error,setError]=useState(''),[,setLoading]=useState(false),[draft,setDraft]=useState(query),[creating,setCreating]=useState(false);
 const [collapsed,setCollapsed]=useState(()=>{try{return typeof window!=='undefined'&&localStorage.getItem('heyelli:aufgaben-seitenleiste')==='eingeklappt';}catch{return false;}});
 const latest=useRef(params.toString());useEffect(()=>{latest.current=params.toString();},[params]);
 const navigate=useCallback((changes:Record<string,string|null>,replace=false)=>{const next=new URLSearchParams(latest.current);for(const [name,value] of Object.entries(changes)){if(value)next.set(name,value);else next.delete(name);}latest.current=next.toString();const url='/taskhub'+(next.size?'?'+next:'');if(replace)router.replace(url,{scroll:false});else router.push(url,{scroll:false});},[router]);
 const controller=useRef<AbortController|null>(null);
 const load=useCallback(async(fresh=false)=>{controller.current?.abort();const next=new AbortController();controller.current=next;setLoading(true);
  try{const response=await fetch('/api/aufgaben'+(fresh?'?neu=1':''),{cache:'no-store',signal:AbortSignal.any([next.signal,AbortSignal.timeout(90000)])});const value=await response.json();if(next.signal.aborted)return;if(!response.ok)throw Error(value.error);setData(value);setError('');}
  catch(problem){if(!next.signal.aborted)setError(problem instanceof Error&&problem.name!=='TimeoutError'&&problem.name!=='TypeError'?problem.message:'Aufgaben sind derzeit nicht erreichbar. Bitte erneut versuchen.');}
  finally{if(!next.signal.aborted)setLoading(false);}},[]);
 const loadRef=useRef(load);useEffect(()=>{loadRef.current=load;},[load]);
 useEffect(()=>{const start=setTimeout(()=>void load(),0),timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},120000);return()=>{clearTimeout(start);clearInterval(timer);controller.current?.abort();};},[load]);
 useEffect(()=>{const timer=setTimeout(()=>{if(draft!==query)navigate({q:draft.trim()||null},true);},250);return()=>clearTimeout(timer);},[draft,query,navigate]);
 function toggleSidebar(){setCollapsed(value=>{const next=!value;try{localStorage.setItem('heyelli:aufgaben-seitenleiste',next?'eingeklappt':'offen');}catch{}return next;});}
 const now=useMemo(()=>data?new Date(data.loadedAt):new Date(0),[data]);
 const mine=useCallback((item:Item)=>!!data?.me&&item.assigneeIds.includes(data.me),[data]);
 const base=useMemo(()=>(data?.items??[]).filter(item=>person?(person==='-'?!item.assigneeIds.length:item.assigneeIds.includes(person)):scope==='team'||mine(item)),[data,person,scope,mine]);
 const rows=useMemo(()=>{const terms=query.toLocaleLowerCase('de').split(/\s+/).filter(Boolean);const order={overdue:0,today:1,week:2,later:3,none:4};
  return base.filter(item=>inView(item,view,now)&&(!sourceFilter||item.sources.includes(sourceFilter))&&terms.every(term=>(item.title+' '+item.subtitle).toLocaleLowerCase('de').includes(term))).sort((a,b)=>order[dueGroup(a.due,now)]-order[dueGroup(b.due,now)]||(a.due??'9').localeCompare(b.due??'9')||a.title.localeCompare(b.title,'de'));},[base,view,sourceFilter,query,now]);
 const count=(predicate:(item:Item)=>boolean)=>base.filter(predicate).length;
 const title=person?(person==='-'?'Nicht zugewiesen':data?.people.find(item=>item.id===person)?.name??'Person'):sourceFilter?sourceLabels[sourceFilter]:viewLabels[view];
 const selected=data?.items.find(item=>item.key===key);
 const sideButton=(label:string,icon:string,active:boolean,value:number,changes:Record<string,string|null>,badge=false)=><button type="button" key={label} aria-current={active?'page':undefined} title={label} onClick={()=>navigate(changes)}><Glyph name={icon}/><span>{label}</span>{value>0&&(badge?<small className={styles.badge}>{value}<span className="sr-only"> überfällig</span></small>:<small className={styles.count} aria-hidden="true">{value}</small>)}</button>;
 return <div className={`${styles.workspace} ${collapsed?styles.collapsedShell:''}`} data-detail={key?'':undefined}>
  <h1 className="sr-only">TaskHub</h1>
  <aside className={`${styles.sidebar} ${collapsed?styles.collapsed:''}`}>
   <div className={styles.sideHead}><button type="button" className={styles.round} aria-label={collapsed?'Seitenleiste einblenden':'Seitenleiste ausblenden'} title={collapsed?'Seitenleiste einblenden':'Seitenleiste ausblenden'} aria-expanded={!collapsed} onClick={toggleSidebar}><Glyph name="side"/></button><button type="button" className={styles.round} aria-label="Neue Aufgabe" title="Neue Aufgabe" disabled={!data?.canWrite||!data.canWritePds} onClick={()=>setCreating(true)}><Glyph name="new"/></button></div>
   <nav className={styles.nav} aria-label="Aufgabenansichten">
    <h2 className={styles.sideHeading}>{scope==='team'?'Alle Aufgaben':'Meine Aufgaben'} <small><button type="button" className={styles.linkButton} onClick={()=>navigate({alle:scope==='team'?null:'1',person:null,id:null})}>{scope==='team'?'nur meine':'alle'}</button></small></h2>
    {(Object.keys(viewLabels) as TaskView[]).map(name=>sideButton(viewLabels[name],viewIcon[name],!person&&!sourceFilter&&view===name,count(item=>inView(item,name,now)),{ansicht:name==='all'?null:name,quelle:null,person:null,id:null},name==='overdue'))}
    <h2 className={styles.sideHeading}>Quellen</h2>
    {(['pds','mail','order'] as TaskSource[]).map(name=>sideButton(name==='mail'?'Zugewiesene Mails':name==='order'?'Aufträge ohne Termin':'PDS-Aufgaben',sourceIcon[name],!person&&sourceFilter===name,count(item=>item.sources.includes(name)&&inView(item,'all',now)),{quelle:name,ansicht:null,person:null,id:null}))}
    {data&&data.people.length>0&&<><h2 className={styles.sideHeading}>Team</h2>
     {data.people.filter(item=>(data.items.some(task=>task.assigneeIds.includes(item.id)))).map(item=>sideButton(item.id===data.me?`${item.name} (ich)`:item.name,'user',person===item.id,(data.items.filter(task=>task.assigneeIds.includes(item.id)&&inView(task,'all',now))).length,{person:item.id,quelle:null,ansicht:null,id:null}))}
     {sideButton('Nicht zugewiesen','people',person==='-',data.items.filter(task=>!task.assigneeIds.length&&inView(task,'all',now)).length,{person:'-',quelle:null,ansicht:null,id:null})}</>}
   </nav>
   <nav className={styles.nav} aria-label="Verwandte Apps"><h2 className={styles.sideHeading}>Verwandte Apps</h2>
    <GuardedLink href="/servicehub" className={styles.appLink}><span className={styles.appIcon} data-app="service" aria-hidden="true"><PlannerGlyph icon="resource"/></span><span>ServiceHub</span></GuardedLink>
    <GuardedLink href="/maildesk" className={styles.appLink}><span className={styles.appIcon} style={{background:appIconBackground.maildesk}} aria-hidden="true"><AppGlyph icon="maildesk"/></span><span>MailDesk</span></GuardedLink>
   </nav>
  </aside>
  <section className={styles.list} aria-label="Aufgaben">
   <div className={styles.listHead}><div><p className={styles.listTitle}>{title}</p><small role="status">{rows.length} {rows.length===1?'Aufgabe':'Aufgaben'}{view==='all'&&!person&&!sourceFilter?` · ${count(item=>inView(item,'overdue',now))} überfällig`:''}</small></div></div>
   <label className={`${styles.search} heyelli-field`}><Glyph name="search"/><span className="sr-only">Suche</span><input type="search" aria-label="Suche" placeholder="Aufgaben, Kunde, Objekt" value={draft} onChange={event=>setDraft(event.target.value)}/></label>
   {error&&<Notice tone="error" role="alert">{error} <button type="button" onClick={()=>void load(true)}>Erneut versuchen</button></Notice>}
   {data?.mailError&&<Notice tone="neutral">{data.mailError}</Notice>}
   {data?.truncated&&<Notice tone="neutral">Es werden die ersten 300 offenen PDS-Aufgaben berücksichtigt.</Notice>}
   {!data&&!error&&<p className={styles.empty} role="status">Aufgaben werden geladen …</p>}
   {data&&<ul className={styles.rows}>{rows.map((item,index)=>{const group=dueGroup(item.due,now),heading=index===0||dueGroup(rows[index-1].due,now)!==group;return <li key={item.key}>{heading&&<p className={styles.day} aria-hidden="true">{groupLabel[group]}</p>}<button type="button" data-task-key={item.key} aria-pressed={key===item.key} onClick={()=>navigate({id:item.key})}>
     <span className={styles.ring} data-status={item.status} title={statusLabels[item.status]}/>
     <span className={styles.rowMain}><span className={styles.rowTop}><strong>{item.title}</strong><span className={styles.due} data-group={group}>{dueText(item.due,now)}</span></span><span className={styles.rowPreview}>{item.subtitle||'Ohne Kundenbezug'}</span>
      <span className={styles.tags}>{item.sources.map(name=><span key={name} className={styles.tag} data-kind={sourceTag[name]}><Glyph name={sourceIcon[name]} size={11}/>{sourceLabels[name]}</span>)}{item.status==='WARTEN'&&<span className={styles.tag} data-kind="flag">Warten</span>}{item.checklist&&item.checklist.total>0&&<span className={styles.tag} data-kind="plain"><Glyph name="ok" size={11}/>{item.checklist.done}/{item.checklist.total}</span>}{scope==='team'&&item.assigneeIds.map(id=>data.people.find(entry=>entry.id===id)?.name).filter(Boolean).slice(0,2).map(name=><span key={name} className={styles.tag} data-kind="plain"><Glyph name="user" size={11}/>{name}</span>)}</span></span></button></li>;})}
    {!rows.length&&<li className={styles.empty}>{query?'Keine passenden Aufgaben.':scope==='mine'&&!person?'Keine offenen Aufgaben für Sie in dieser Ansicht.':'Keine Aufgaben in dieser Ansicht.'}</li>}</ul>}
  </section>
  {selected?selected.source==='pds'?<TaskDetail key={selected.id} id={selected.id} onChanged={()=>void loadRef.current(true)} onClose={()=>navigate({id:null})}/>
   :<section className={styles.detail} aria-label="Aufgabe"><div className={styles.toolbar}><button type="button" className={`${styles.round} ${styles.backButton}`} aria-label="Zur Liste" onClick={()=>navigate({id:null})}><Glyph name="back"/></button></div><div className={styles.detailBody}><div className={styles.taskTop}><span className={styles.tag} data-kind={sourceTag[selected.source]}><Glyph name={sourceIcon[selected.source]} size={11}/>{sourceLabels[selected.source]}</span></div><header className={styles.mailHead}><span className={styles.avatar} aria-hidden="true"><Glyph name={sourceIcon[selected.source]} size={20}/></span><div><h2 tabIndex={-1}>{selected.title}</h2><p className={styles.subject}>{selected.subtitle}</p></div></header>
    <p className={styles.description}>{selected.source==='mail'?'Diese Mail ist im MailDesk zugewiesen. Bearbeitet und erledigt wird sie dort (archivieren oder Zuständigkeit ändern).':'Dieser Serviceauftrag hat noch keinen Termin. Geplant wird er im Service.'}</p>
    {selected.href&&<GuardedLink className={styles.primary} href={selected.href}><Glyph name="ext"/>{selected.source==='mail'?'In MailDesk öffnen':'Im Service öffnen'}</GuardedLink>}</div></section>
  :key&&data?<section className={styles.detail} aria-label="Aufgabe"><p className={styles.empty}>Diese Aufgabe ist nicht mehr offen oder nicht sichtbar.</p></section>
  :<div className={styles.placeholder} role="status"><Glyph name="task" size={30}/><span>Aufgabe auswählen</span></div>}
  {creating&&<TaskCreateDialog onClose={()=>setCreating(false)} onCreated={id=>{setCreating(false);void load(true).then(()=>navigate({id:'pds:'+id,ansicht:null,quelle:null,person:null}));}}/>}
 </div>;
}

function TaskDetail({id,onChanged,onClose}:{id:string;onChanged:()=>void;onClose:()=>void}){
 const [detail,setDetail]=useState<Detail|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[step,setStep]=useState('');
 const heading=useRef<HTMLHeadingElement>(null);
 const load=useCallback(async()=>{try{const response=await fetch('/api/aufgaben/aufgabe?'+new URLSearchParams({id}),{cache:'no-store',signal:AbortSignal.timeout(60000)});const value=await response.json();if(!response.ok)throw Error(value.error);setDetail(value);setError('');}catch(problem){setError(problem instanceof Error&&problem.name!=='TimeoutError'&&problem.name!=='TypeError'?problem.message:'Die Aufgabe konnte nicht geladen werden.');}},[id]);
 useEffect(()=>{const start=setTimeout(()=>void load(),0);return()=>clearTimeout(start);},[load]);
 useEffect(()=>{if(detail)heading.current?.focus({preventScroll:true});},[detail?.task.id]); // eslint-disable-line react-hooks/exhaustive-deps
 async function act(body:Record<string,unknown>,done:string,pds=true){if(!detail)return;setBusy(true);setNotice('');
  try{const response=await fetch('/api/aufgaben/aktion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,...(pds?{requestId:crypto.randomUUID()}:{version:detail.extras.version}),...body}),signal:AbortSignal.timeout(60000)});const value=await response.json();if(!response.ok)throw Error(value.error);setNotice(done);await load();if(pds)onChanged();else onChanged();}
  catch(problem){setNotice(problem instanceof Error&&problem.name!=='TimeoutError'&&problem.name!=='TypeError'?problem.message:'Die Änderung konnte nicht bestätigt werden. Bitte erneut versuchen.');await load();}
  finally{setBusy(false);}}
 if(error)return <section className={styles.detail} aria-label="Aufgabe"><Notice tone="error" role="alert">{error} <button type="button" onClick={()=>void load()}>Erneut versuchen</button></Notice></section>;
 if(!detail)return <section className={styles.detail} aria-label="Aufgabe"><p className={styles.empty} role="status">Aufgabe wird geladen …</p></section>;
 const {task,extras}=detail,canPds=detail.canWrite&&detail.canWritePds,canExtras=detail.canWrite,now=new Date(),group=dueGroup(task.due??null,now);
 const assigned=new Set(detail.assignments.map(item=>item.employeeId).filter(Boolean));
 return <section className={styles.detail} aria-label="Aufgabe">
  <div className={styles.toolbar} role="toolbar" aria-label="Aufgabenaktionen">
   <button type="button" className={`${styles.round} ${styles.backButton}`} aria-label="Zur Liste" onClick={onClose}><Glyph name="back"/></button>
   <div className={styles.capsules}><button type="button" disabled={!canPds||busy||task.status==='ERLEDIGT'} onClick={()=>void act({action:'status',status:'ERLEDIGT'},'Als erledigt in PDS gespeichert.')}><Glyph name="ok"/><span className={styles.label}>Erledigt</span></button></div>
   <PopUpButton label="Status" value={task.status} disabled={!canPds||busy} options={(['OFFEN','IN_BEARBEITUNG','WARTEN','ERLEDIGT','ABGELEHNT'] as TaskStatus[]).map(value=>({value,label:statusLabels[value]}))} onChange={value=>void act({action:'status',status:value},'Status in PDS gespeichert.')}/>
   <PopUpButton label="Zuweisen" value="" placeholder="Zuweisen …" icon={<Glyph name="user"/>} disabled={!canPds||busy} options={detail.people.filter(item=>!assigned.has(item.id)).map(item=>({value:item.id,label:item.name}))} onChange={value=>void act({action:'assign',employeeId:value},'Zuweisung in PDS gespeichert.')}/>
   <span className={styles.spacer}/>
  </div>
  <div className={styles.detailBody}>
   {notice&&<p className={styles.notice} role="status">{notice}</p>}
   {!detail.canWritePds&&<Notice tone="neutral">Echtes PDS ist nur lesend freigegeben. Status und Zuweisung bitte in PDS ändern; Checkliste und Verknüpfungen funktionieren hier.</Notice>}
   <div className={styles.taskTop}><span className={styles.stored}><Glyph name="pds" size={12}/>In PDS gespeichert · CRM-Aufgabe{task.number?` ${task.number}`:''}</span>{task.due&&<span className={styles.due} data-group={group}>fällig {berlin(task.due,{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span>}</div>
   <header className={styles.mailHead}><span className={styles.avatar} aria-hidden="true">{initials(detail.customer?.name??task.subject)}</span><div><h2 ref={heading} tabIndex={-1}>{task.subject}</h2><p className={styles.subject}>{[detail.typeName&&'Typ: '+detail.typeName,statusLabels[task.status]].filter(Boolean).join(' · ')}</p></div></header>
   <dl className={styles.facts}>
    <dt>Kunde</dt><dd>{detail.customer?<GuardedLink href={'/servicehub?'+new URLSearchParams({ansicht:'files',akte:'customer',id:detail.customer.id})}>{detail.customer.name}</GuardedLink>:'–'}{detail.customer?.number?<span className={styles.muted}> · {detail.customer.number}</span>:null}</dd>
    <dt>Objekt</dt><dd>{detail.object?<>{detail.object.name}{detail.object.address?<span className={styles.muted}> · {detail.object.address}</span>:null}</>:task.projectId?'Projektakte':'–'}</dd>
    <dt>Zugewiesen</dt><dd>{detail.assignments.length?detail.assignments.map((item,index)=><span key={item.id}>{index>0?', ':''}{item.name}{canPds&&<button type="button" className={styles.iconButton} aria-label={`Zuweisung ${item.name} lösen`} title="Zuweisung lösen" disabled={busy} onClick={()=>void act({action:'unassign',assignmentId:item.id},'Zuweisung in PDS gelöst.')}><Glyph name="x" size={11}/></button>}</span>):'niemand'}</dd>
    <dt>Fällig</dt><dd>{task.due?berlin(task.due,{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'ohne Fälligkeit'}</dd>
    {detail.visits[0]&&<><dt>Nächster Termin vor Ort</dt><dd><b>{berlin(detail.visits[0].start,{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric',...(detail.visits[0].allDay?{}:{hour:'2-digit',minute:'2-digit'})})}</b> <span className={styles.visitStatus} data-status={detail.visits[0].status}>{detail.visits[0].status==='GEPLANT'?'Geplant':'Vorgemerkt'}</span><small className={styles.muted} style={{display:'block'}}>{detail.visits[0].title} · {detail.visits[0].employees.join(', ')}</small></dd></>}
   </dl>
   {task.description&&<p className={styles.description}>{task.description}</p>}
   <section className={styles.card} aria-label="Checkliste"><h3>Checkliste <span>nur in heyelli</span></h3>
    {extras.checklist.map(entry=><div key={entry.id} className={styles.check} data-done={entry.done||undefined}><input type="checkbox" aria-label={entry.text} checked={entry.done} disabled={!canExtras||busy} onChange={()=>void act({action:'check-toggle',entryId:entry.id},entry.done?'Schritt wieder offen.':'Schritt erledigt.',false)}/><span>{entry.text}</span>{canExtras&&<button type="button" className={`${styles.iconButton} ${styles.remove}`} aria-label={`Schritt ${entry.text} entfernen`} disabled={busy} onClick={()=>void act({action:'check-remove',entryId:entry.id},'Schritt entfernt.',false)}><Glyph name="x" size={11}/></button>}</div>)}
    {!extras.checklist.length&&<p className={styles.check}><span className={styles.muted}>Noch keine Schritte.</span></p>}
    {canExtras&&<form className={styles.addCheck} onSubmit={event=>{event.preventDefault();if(step.trim())void act({action:'check-add',text:step},'Schritt hinzugefügt.',false).then(()=>setStep(''));}}><input aria-label="Neuer Schritt" placeholder="Schritt hinzufügen" maxLength={200} value={step} onChange={event=>setStep(event.target.value)}/><button type="submit" disabled={busy||!step.trim()}>Hinzufügen</button></form>}
   </section>
   {extras.links.length>0&&<section className={styles.card} aria-label="Verknüpfungen"><h3>Verknüpft <span>nur in heyelli</span></h3>{extras.links.map(link=><div className={styles.contextRow} key={link.kind+link.id} style={{padding:'8px 14px'}}><Glyph name={link.kind==='mail'?'mail':'doc'}/><div><b>{link.label}</b>{link.detail&&<small>{link.detail}</small>}</div>{link.href&&<GuardedLink href={link.href}>Öffnen</GuardedLink>}{canExtras&&<button type="button" className={styles.iconButton} aria-label={`Verknüpfung ${link.label} lösen`} disabled={busy} onClick={()=>void act({action:'link-remove',linkId:link.kind+':'+link.id},'Verknüpfung gelöst.',false)}><Glyph name="x" size={11}/></button>}</div>)}</section>}
   {detail.visits.length>0&&<section className={styles.card} aria-label="Termine vor Ort"><h3>Termine vor Ort am Objekt <span>aus PDS</span></h3>{detail.visits.map(visit=><div className={styles.visit} key={visit.id}><span className={styles.cal} aria-hidden="true"><small>{berlin(visit.start,{weekday:'short'}).replace('.','').toUpperCase()}</small><b>{berlin(visit.start,{day:'numeric'})}</b></span><div><b>{berlin(visit.start,{day:'2-digit',month:'2-digit',year:'numeric'})}{visit.allDay?' · ganztägig':' · '+berlin(visit.start,{hour:'2-digit',minute:'2-digit'})+'–'+berlin(visit.end,{hour:'2-digit',minute:'2-digit'})}</b><small>{visit.title} · {visit.employees.join(', ')}</small></div><span className={styles.visitStatus} data-status={visit.status}>{visit.status==='GEPLANT'?'Geplant':'Vorgemerkt'}</span></div>)}</section>}
   {extras.history.length>0&&<section className={styles.card} aria-label="Verlauf"><h3>Verlauf in heyelli</h3><ul className={styles.history}>{extras.history.slice(0,12).map((entry,index)=><li key={index}><b>{entry.actor}</b> · {berlin(entry.at,{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} · {entry.text}</li>)}</ul></section>}
  </div>
 </section>;
}
