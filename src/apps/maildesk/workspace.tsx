'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {GuardedLink,Notice,PlannerGlyph,PopUpButton} from '@/platform/shell';
import {TaskCreateDialog} from '@/apps/taskhub/client';
import {categoryLabels,folderLabels,type MailFolder,type MailMessage,type MailState,type MailSummary} from './model';
import styles from './workspace.module.css';
type Overview={mailbox:{address:string;mode:'simulator'|'graph'};folder:MailFolder;counts:Record<MailFolder,number>;unread:number;messages:MailSummary[];
 sent:{id:string;messageId:string;createdAt:string;testMode:boolean;recipient:string;subject:string;status:string;actorName:string|null}[];
 customers:{id:string;name:string;count:number}[];people:{id:string;name:string}[];me:string;canWrite:boolean;canCreateOrder:boolean;loadedAt:string};
type Detail={message:MailMessage;summary:MailSummary;customer:null|{id:string;name:string;number:string;orders:{id:string;number:string;title:string;status:string;objectId:string}[];objects:{id:string;name:string;address:string;parentId?:string}[]};
 related:MailSummary[];replies:Overview['sent'];customers:{id:string;name:string;number:string}[];objects:{id:string;customerId:string;parentId?:string;name:string;address:string}[];canWrite:boolean;canCreateOrder:boolean;canCreateTask?:boolean};
const P:Record<string,React.ReactNode>={inbox:<path d="M3 13h5l1 3h6l1-3h5M5 5h14l2 8v6H3v-6z"/>,q:<><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5M12 17h.01"/></>,spark:<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>,link:<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>,
 ok:<path d="m5 12 4 4 10-10"/>,send:<path d="m4 12 16-8-6 16-2-7z"/>,arch:<path d="M4 8h16v11H4zM3 4h18v4H3zM10 12h4"/>,user:<><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-5.5 7-5.5s6 1.5 7 5.5"/></>,flag:<path d="M5 21V4h11l-1.5 4L16 12H5"/>,att:<path d="m20 12-8 8a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7"/>,
 house:<path d="M4 20V9l8-5 8 5v11M9 20v-6h6v6"/>,reply:<path d="M10 8 4 13l6 5M4 13h10a6 6 0 0 1 6 6"/>,plan:<><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M12 13v4M10 15h4"/></>,search:<><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></>,reload:<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>,side:<><rect x="3" y="4" width="21" height="16" rx="3"/><path d="M9 4v16"/></>,doc:<><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/></>,mail:<><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></>,back:<path d="m15 6-6 6 6 6"/>};
function Glyph({name,size=16}:{name:string;size?:number}){return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[name]}</svg>;}
const folderIcons:Record<MailFolder,string>={inbox:'inbox',unassigned:'q',suggested:'spark',assigned:'link',order:'ok',sent:'send',archive:'arch',mine:'user',flagged:'flag',attachments:'att'};
const berlin=(value:string,options:Intl.DateTimeFormatOptions)=>Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',...options}).format(new Date(value)):'';
function when(value:string){const day=berlin(value,{year:'numeric',month:'2-digit',day:'2-digit'}),today=berlin(new Date().toISOString(),{year:'numeric',month:'2-digit',day:'2-digit'}),yesterday=berlin(new Date(Date.now()-864e5).toISOString(),{year:'numeric',month:'2-digit',day:'2-digit'});return day===today?berlin(value,{hour:'2-digit',minute:'2-digit'}):day===yesterday?'Gestern':berlin(value,{day:'2-digit',month:'2-digit',year:'2-digit'});}
function dayGroup(value:string){const t=when(value);return /^\d\d:\d\d$/.test(t)?'Heute':t==='Gestern'?'Gestern':'Älter';}
const initials=(name:string)=>name.replace(/[^\p{L}\s]/gu,' ').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'@';
function highlight(text:string,needle?:string):React.ReactNode{if(!needle)return text;const index=text.toLocaleLowerCase('de').indexOf(needle.toLocaleLowerCase('de'));if(index<0)return text;return <>{text.slice(0,index)}<mark>{text.slice(index,index+needle.length)}</mark>{highlight(text.slice(index+needle.length),needle)}</>;}
function requestId(){return crypto.randomUUID();}

export function MailDeskWorkspace(){
 const params=useSearchParams(),router=useRouter();
 const folder=(params.get('ordner')??'inbox') as MailFolder,id=params.get('id')??'',query=params.get('q')??'',customerFilter=params.get('kunde')??'';
 const [data,setData]=useState<Overview|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[draft,setDraft]=useState(query);
 const [collapsed,setCollapsed]=useState(()=>{try{return typeof window!=='undefined'&&localStorage.getItem('heyelli:maildesk-seitenleiste')==='eingeklappt';}catch{return false;}});
 // Vom zuletzt beabsichtigten Adressstand ausgehen: schnelle Klicks schreiben keinen veralteten Ordner zurück,
 // auch wenn der Router die vorige Navigation noch nicht übernommen hat.
 const latest=useRef(params.toString());
 useEffect(()=>{latest.current=params.toString();},[params]);
 const navigate=useCallback((changes:Record<string,string|null>,replace=false)=>{const next=new URLSearchParams(latest.current);for(const [key,value] of Object.entries(changes)){if(value)next.set(key,value);else next.delete(key);}latest.current=next.toString();const url='/maildesk'+(next.size?'?'+next:'');if(replace)router.replace(url,{scroll:false});else router.push(url,{scroll:false});},[router]);
 const controller=useRef<AbortController|null>(null);
 const load=useCallback(async(fresh=false)=>{controller.current?.abort();const next=new AbortController();controller.current=next;setLoading(true);
  try{const response=await fetch('/api/maildesk?'+new URLSearchParams({ordner:customerFilter?'inbox':folder,...(query?{q:query}:{}),...(fresh?{neu:'1'}:{})}),{cache:'no-store',signal:AbortSignal.any([next.signal,AbortSignal.timeout(60000)])});const value=await response.json();if(next.signal.aborted)return;if(!response.ok)throw Error(value.error);setData(value);setError('');}
  catch(problem){if(!next.signal.aborted)setError(problem instanceof Error&&problem.name!=='TimeoutError'&&problem.name!=='TypeError'?problem.message:'Das Postfach ist derzeit nicht erreichbar. Bitte erneut versuchen.');}
  finally{if(!next.signal.aborted)setLoading(false);}},[folder,query,customerFilter]);
 // Aktionen in der Mail laden immer mit dem aktuellen Ordner nach, nie mit einem veralteten Stand.
 const loadRef=useRef(load);useEffect(()=>{loadRef.current=load;},[load]);
 useEffect(()=>{const start=setTimeout(()=>void load(),0),timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},60000),focus=()=>void load();window.addEventListener('focus',focus);return()=>{clearTimeout(start);clearInterval(timer);window.removeEventListener('focus',focus);controller.current?.abort();};},[load]);
 useEffect(()=>{const timer=setTimeout(()=>{if(draft!==query)navigate({q:draft.trim()||null},true);},250);return()=>clearTimeout(timer);},[draft,query,navigate]);
 // Gewählte Mail in der Liste sichtbar halten (z. B. nach Direktlink), ohne die Seite zu verschieben.
 useEffect(()=>{if(!id||!data)return;const row=document.querySelector<HTMLElement>(`[data-mail-id="${CSS.escape(id)}"]`);row?.scrollIntoView({block:'nearest'});},[id,data]);
 function toggleSidebar(){setCollapsed(value=>{const next=!value;try{localStorage.setItem('heyelli:maildesk-seitenleiste',next?'eingeklappt':'offen');}catch{}return next;});}
 const rows=useMemo(()=>(data?.messages??[]).filter(item=>!customerFilter||item.assignment?.customerId===customerFilter),[data,customerFilter]);
 const customerName=customerFilter?data?.customers.find(item=>item.id===customerFilter)?.name??'Kunde':'';
 const title=customerFilter?customerName:query?'Suche':folderLabels[folder]??'Eingang';
 const counts=data?.counts;
 const folderButton=(name:MailFolder,badge=false)=>{const count=counts?.[name]??0;return <button type="button" key={name} aria-current={!customerFilter&&folder===name?'page':undefined} title={folderLabels[name]} onClick={()=>navigate({ordner:name==='inbox'?null:name,id:null,kunde:null,q:null})}><Glyph name={folderIcons[name]}/><span>{folderLabels[name]}</span>{count>0&&(badge?<small className={styles.badge}>{count}<span className="sr-only"> offen</span></small>:<small className={styles.count} aria-hidden="true">{count}</small>)}</button>;};
 return <div className={`${styles.workspace} ${collapsed?styles.collapsedShell:''}`} data-detail={id?'':undefined}>
  <h1 className="sr-only">MailDesk</h1>
  <aside className={`${styles.sidebar} ${collapsed?styles.collapsed:''}`}>
   <div className={styles.sideHead}><button type="button" className={styles.round} aria-label={collapsed?'Seitenleiste einblenden':'Seitenleiste ausblenden'} title={collapsed?'Seitenleiste einblenden':'Seitenleiste ausblenden'} aria-expanded={!collapsed} onClick={toggleSidebar}><Glyph name="side"/></button><button type="button" className={styles.round} aria-label="Postfach neu laden" title="Neu laden" disabled={loading} onClick={()=>void load(true)}><Glyph name="reload"/></button></div>
   <div className={styles.box}><span className={styles.boxIcon} aria-hidden="true"><Glyph name="mail" size={17}/></span><div><b title={data?.mailbox.address}>{data?.mailbox.address??'Postfach'}</b><small>{data?.mailbox.mode==='graph'?'Geteiltes Postfach · Microsoft 365':'Beispielpostfach'}</small></div></div>
   <nav className={styles.nav} aria-label="Postfachordner">
    <h2 className={styles.sideHeading}>Postfach</h2>
    {folderButton('inbox')}{folderButton('unassigned',true)}{folderButton('suggested')}{folderButton('assigned')}{folderButton('order')}{folderButton('sent')}{folderButton('archive')}
    <h2 className={styles.sideHeading}>Meine Ansichten</h2>
    {folderButton('mine')}{folderButton('flagged')}{folderButton('attachments')}
    {(data?.customers.length??0)>0&&<><h2 className={styles.sideHeading}>Kunden <small>mit Mails</small></h2>{data!.customers.slice(0,6).map(item=><button type="button" key={item.id} className={styles.customerItem} aria-current={customerFilter===item.id?'page':undefined} title={item.name} onClick={()=>navigate({kunde:item.id,ordner:null,id:null,q:null})}><Glyph name="house"/><span>{item.name}</span><small className={styles.count} aria-hidden="true">{item.count}</small></button>)}</>}
   </nav>
   <nav className={styles.nav} aria-label="Verwandte Apps"><h2 className={styles.sideHeading}>Verwandte Apps</h2>
    <GuardedLink href="/servicehub" className={styles.appLink}><span className={styles.appIcon} data-app="service" aria-hidden="true"><PlannerGlyph icon="resource"/></span><span>ServiceHub</span></GuardedLink>
    <GuardedLink href="/casedesk" className={styles.appLink}><span className={styles.appIcon} data-app="incident" aria-hidden="true"><PlannerGlyph icon="incident"/></span><span>CaseDesk</span></GuardedLink>
    <GuardedLink href="/planboard" className={styles.appLink}><span className={styles.appIcon} data-app="resource" aria-hidden="true"><PlannerGlyph icon="resource"/></span><span>PlanBoard</span></GuardedLink>
   </nav>
  </aside>
  <section className={styles.list} aria-label="Nachrichten">
   <div className={styles.listHead}><div><p className={styles.listTitle}>{title}</p><small role="status">{folder==='sent'&&!customerFilter?`${data?.sent.length??0} gesendet`:`${rows.length} ${rows.length===1?'Mail':'Mails'}${data&&!customerFilter&&folder==='inbox'?` · ${counts?.unassigned??0} nicht zugeordnet`:''}`}</small></div></div>
   <label className={`${styles.search} heyelli-field`}><Glyph name="search"/><span className="sr-only">Suche</span><input type="search" aria-label="Suche" placeholder="Mails, Kunde, Kostenträger, Auftragsnummer" value={draft} onChange={event=>setDraft(event.target.value)}/></label>
   {error&&<Notice tone="error" role="alert">{error} <button type="button" onClick={()=>void load(true)}>Erneut versuchen</button></Notice>}
   {!data&&!error&&<p className={styles.empty} role="status">Postfach wird geladen …</p>}
   {data&&folder==='sent'&&!customerFilter?<ul className={styles.rows}>{data.sent.map(item=><li key={item.id}><button type="button" onClick={()=>navigate({id:item.messageId,ordner:null})}><span className={styles.dot}/><span className={styles.rowMain}><span className={styles.rowTop}><strong>An {item.recipient}</strong><span>{when(item.createdAt)}</span></span><span className={styles.rowSubject}>{item.subject}</span><span className={styles.rowPreview}>{item.actorName??'Unbekannt'} · {item.testMode?'Testbetrieb – nicht zugestellt':item.status==='simulated'?'simuliert':'in Zustellung'}</span></span></button></li>)}{!data.sent.length&&<li className={styles.empty}>Noch keine Antworten aus MailDesk.</li>}</ul>
   :data&&<ul className={styles.rows}>{rows.map((item,index)=>{const group=dayGroup(item.receivedAt),heading=index===0||dayGroup(rows[index-1].receivedAt)!==group;return <li key={item.id}>{heading&&<p className={styles.day} aria-hidden="true">{group}</p>}<button type="button" data-mail-id={item.id} aria-pressed={id===item.id} onClick={()=>navigate({id:item.id})}>
     <span className={styles.dot} data-on={item.unread||undefined} title={item.unread?'Ungelesen':undefined}/>
     <span className={styles.rowMain}><span className={styles.rowTop}><strong>{item.from.name||item.from.address}</strong><span>{when(item.receivedAt)}</span></span><span className={styles.rowSubject}>{item.subject}</span><span className={styles.rowPreview}>{item.preview}</span>
      <span className={styles.tags}>{item.assignment?<span className={styles.tag} data-kind="customer"><Glyph name="link" size={11}/>{item.customerName}</span>:item.suggestion?<span className={styles.tag} data-kind="suggestion"><Glyph name="spark" size={11}/>Vorschlag: {data.customers.find(entry=>entry.id===item.suggestion!.customerId)?.name??'Kunde'} · {item.suggestion.score} %</span>:<span className={styles.tag} data-kind="none"><Glyph name="q" size={11}/>Nicht zugeordnet</span>}
       {item.state.orderNumber&&<span className={styles.tag} data-kind="order"><Glyph name="doc" size={11}/>{item.state.orderNumber}</span>}
       {item.assignment&&!item.state.orderNumber&&item.assignment.orderNumber&&<span className={styles.tag} data-kind="order"><Glyph name="doc" size={11}/>{item.assignment.orderNumber}</span>}
       {item.category!=='other'&&<span className={styles.tag} data-kind="category">{categoryLabels[item.category]}</span>}
       {item.attachmentCount>0&&<span className={styles.tag} data-kind="plain"><Glyph name="att" size={11}/>{item.attachmentCount}</span>}
       {item.state.flagged&&<span className={styles.tag} data-kind="flag"><Glyph name="flag" size={11}/>Markiert</span>}
       {item.assigneeName&&<span className={styles.tag} data-kind="plain"><Glyph name="user" size={11}/>{item.assigneeName}</span>}</span></span></button></li>;})}{!rows.length&&<li className={styles.empty}>{query?'Keine passenden Mails.':'Keine Mails in dieser Ansicht.'}</li>}</ul>}
  </section>
  {id?<MailDetail key={id} id={id} people={data?.people??[]} me={data?.me??''} onChanged={()=>void loadRef.current()} onClose={()=>navigate({id:null})} onCustomer={customerId=>navigate({kunde:customerId,ordner:null,id:null,q:null})}/>:<div className={styles.placeholder} role="status"><Glyph name="mail" size={30}/><span>Mail auswählen</span></div>}
 </div>;
}

function MailDetail({id,people,me,onChanged,onClose,onCustomer}:{id:string;people:{id:string;name:string}[];me:string;onChanged:()=>void;onClose:()=>void;onCustomer:(id:string)=>void}){
 const [detail,setDetail]=useState<Detail|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[picking,setPicking]=useState(false),[replying,setReplying]=useState(false),[tasking,setTasking]=useState(false);
 const heading=useRef<HTMLHeadingElement>(null);
 const load=useCallback(async()=>{try{const response=await fetch('/api/maildesk/nachricht?'+new URLSearchParams({id}),{cache:'no-store',signal:AbortSignal.timeout(30000)});const value=await response.json();if(!response.ok)throw Error(value.error);setDetail(value);setError('');}catch(problem){setError(problem instanceof Error&&problem.name!=='TimeoutError'&&problem.name!=='TypeError'?problem.message:'Die Mail konnte nicht geladen werden.');}},[id]);
 useEffect(()=>{const start=setTimeout(()=>void load(),0);return()=>clearTimeout(start);},[load]);
 useEffect(()=>{if(detail)heading.current?.focus({preventScroll:true});},[detail?.message.id]); // eslint-disable-line react-hooks/exhaustive-deps
 async function act(body:Record<string,unknown>,done:string){if(!detail)return;setBusy(true);setNotice('');
  try{const response=await fetch('/api/maildesk/aktion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,version:detail.summary.state.version,...body}),signal:AbortSignal.timeout(30000)});const value=await response.json();if(!response.ok)throw Error(value.error);setNotice(done);await load();onChanged();}
  catch(problem){setNotice(problem instanceof Error&&problem.name!=='TimeoutError'&&problem.name!=='TypeError'?problem.message:'Die Änderung konnte nicht bestätigt werden. Bitte erneut versuchen.');await load();}
  finally{setBusy(false);}}
 if(error)return <section className={styles.detail} aria-label="Mail"><Notice tone="error" role="alert">{error} <button type="button" onClick={()=>void load()}>Erneut versuchen</button></Notice></section>;
 if(!detail)return <section className={styles.detail} aria-label="Mail"><p className={styles.empty} role="status">Mail wird geladen …</p></section>;
 const {message,summary}=detail,state:MailState=summary.state,assignment=summary.assignment,suggestion=summary.suggestion,customers=new Map(detail.customers.map(item=>[item.id,item]));
 const evidence=(assignment??suggestion)?.evidence,canWrite=detail.canWrite;
 return <section className={styles.detail} aria-label="Mail">
  <div className={styles.toolbar} role="toolbar" aria-label="Mailaktionen">
   <button type="button" className={`${styles.round} ${styles.backButton}`} aria-label="Zur Liste" onClick={onClose}><Glyph name="back"/></button>
   <div className={styles.capsules}><button type="button" aria-label={state.archived?'Aus dem Archiv holen':'Archivieren'} title={state.archived?'Aus dem Archiv holen':'Archivieren'} aria-pressed={state.archived} disabled={!canWrite||busy} onClick={()=>void act({action:'archive',value:!state.archived},state.archived?'Wieder im Eingang.':'Archiviert.')}><Glyph name="arch"/></button><span aria-hidden="true"/><button type="button" aria-label={state.flagged?'Markierung entfernen':'Markieren'} title={state.flagged?'Markierung entfernen':'Markieren'} aria-pressed={state.flagged} disabled={!canWrite||busy} onClick={()=>void act({action:'flag',value:!state.flagged},state.flagged?'Markierung entfernt.':'Markiert.')}><Glyph name="flag"/></button></div>
   <div className={styles.capsules}><button type="button" disabled={!canWrite} aria-expanded={replying} aria-label="Antworten" title="Antworten" onClick={()=>setReplying(value=>!value)}><Glyph name="reply"/><span className={styles.label}>Antworten</span></button></div>
   <PopUpButton label="Zuständig" value={state.assigneeId??''} disabled={!canWrite||busy} icon={<Glyph name="user"/>} options={[{value:'',label:'Niemand'},...(me?[{value:me,label:'Ich'}]:[]),...people.filter(item=>item.id!==me).map((item,index)=>({value:item.id,label:item.name,separatorBefore:index===0}))]} onChange={value=>void act({action:'assignee',assigneeId:value||null},value?'Zuständigkeit gesetzt.':'Zuständigkeit entfernt.')}/>
   {detail.canCreateTask&&<div className={styles.capsules}><button type="button" aria-label="Aufgabe anlegen" title="Aufgabe anlegen (in PDS)" onClick={()=>setTasking(true)}><Glyph name="ok"/><span className={styles.label}>Aufgabe</span></button></div>}
   <span className={styles.spacer}/>
   {detail.canCreateOrder&&(assignment||suggestion)&&!state.orderNumber&&<GuardedLink className={styles.primary} href={'/casedesk?'+new URLSearchParams({ausMail:id})}><Glyph name="plan"/>Serviceauftrag anlegen</GuardedLink>}
  </div>
  <div className={styles.detailBody}>
   {notice&&<p className={styles.notice} role="status">{notice}</p>}
   {assignment?<div className={styles.assign} data-kind="assigned"><span className={styles.assignIcon} aria-hidden="true"><Glyph name="link"/></span><div><b>{customers.get(assignment.customerId)?.name??'Kunde'}</b><small>{state.decision==='manual'?'Manuell zugeordnet':state.decision==='confirmed'?'Bestätigt':'Automatisch zugeordnet über '+assignment.reason}{assignment.objectId?' · '+(detail.objects.find(item=>item.id===assignment.objectId)?.name??''):''}{state.orderNumber?' · Auftrag '+state.orderNumber:''}</small></div>
     <div className={styles.assignActions}>{state.decision==='auto'&&canWrite&&<button type="button" disabled={busy} onClick={()=>void act({action:'confirm',customerId:assignment.customerId,objectId:assignment.objectId??null},'Zuordnung bestätigt. Der Absender wird künftig automatisch erkannt.')}><Glyph name="ok" size={13}/>Bestätigen</button>}{canWrite&&<button type="button" disabled={busy} onClick={()=>setPicking(true)}>Ändern</button>}<button type="button" onClick={()=>onCustomer(assignment.customerId)}>Alle Mails</button><GuardedLink href={'/servicehub?'+new URLSearchParams({ansicht:'files',akte:'customer',id:assignment.customerId})}>Kundenakte</GuardedLink></div></div>
   :suggestion?<div className={styles.assign} data-kind="suggestion"><span className={styles.assignIcon} aria-hidden="true"><Glyph name="spark"/></span><div><b>Vorschlag: {customers.get(suggestion.customerId)?.name??'Kunde'}</b><small>{suggestion.reason} · {suggestion.score} %</small></div>
     <div className={styles.assignActions}>{canWrite&&<><button type="button" className={styles.accept} disabled={busy} onClick={()=>void act({action:'confirm',customerId:suggestion.customerId,objectId:suggestion.objectId??null},'Vorschlag übernommen.')}><Glyph name="ok" size={13}/>Übernehmen</button><button type="button" disabled={busy} onClick={()=>setPicking(true)}>Anderer Kunde …</button></>}</div></div>
   :<div className={styles.assign} data-kind="none"><span className={styles.assignIcon} aria-hidden="true"><Glyph name="q"/></span><div><b>Nicht zugeordnet</b><small>{state.decision==='cleared'?'Zuordnung wurde entfernt.':'Kein Kostenträger, keine Auftrags- oder Kundennummer und kein bekannter Absender gefunden.'}</small></div><div className={styles.assignActions}>{canWrite&&<button type="button" disabled={busy} onClick={()=>setPicking(true)}>Kunde zuordnen …</button>}</div></div>}
   <header className={styles.mailHead}><span className={styles.avatar} aria-hidden="true">{initials(message.from.name||message.from.address)}</span><div><h2 ref={heading} tabIndex={-1}>{message.from.name||message.from.address}</h2><p className={styles.subject}>{highlight(message.subject,evidence)}</p><p className={styles.meta}><span>Von:</span> {message.from.address}</p><p className={styles.meta}><span>An:</span> {message.to.map(item=>item.address).join(', ')}</p><p className={styles.meta}><span>Zuständig:</span> {summary.assigneeName??'niemand'}</p></div><time dateTime={message.receivedAt}>{berlin(message.receivedAt,{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</time></header>
   {replying&&<ReplyForm key={id} id={id} message={message} onDone={text=>{setReplying(false);setNotice(text);void load();onChanged();}}/>}
   <div className={styles.mailBody}>{highlight(message.body,evidence)}</div>
   {message.attachments.length>0&&<ul className={styles.attachments} aria-label="Anhänge">{message.attachments.map(item=><li key={item.id}><Glyph name="att"/><span>{item.name}<small>{item.size>=1e6?(item.size/1e6).toLocaleString('de-DE',{maximumFractionDigits:1})+' MB':Math.max(1,Math.round(item.size/1e3))+' KB'}</small></span></li>)}</ul>}
   {detail.customer&&<section className={styles.context} aria-label="Beim Kunden"><h3>Beim Kunden <small>aus PDS</small></h3>
    {detail.customer.orders.map(order=><div className={styles.contextRow} key={order.id}><Glyph name="doc"/><div><b>{order.number}</b> · {order.title||'Serviceauftrag'}<small>{order.status||'Ohne Status'}{order.objectId?' · '+(detail.objects.find(item=>item.id===order.objectId)?.name??''):''}</small></div>{state.orderNumber===order.number?<span className={styles.linked}><Glyph name="ok" size={13}/>verknüpft</span>:canWrite&&<button type="button" disabled={busy} onClick={()=>void act({action:'order',orderNumber:order.number},'Mail an Auftrag '+order.number+' gehängt.')}>Mail anhängen</button>}</div>)}
    {!detail.customer.orders.length&&<p className={styles.muted}>Keine offenen Serviceaufträge.</p>}
    <div className={styles.contextRow}><Glyph name="mail"/><div><b>{detail.related.length} weitere {detail.related.length===1?'Mail':'Mails'}</b><small>{detail.related[0]?'zuletzt: '+detail.related[0].subject:'keine weiteren im Postfach'}</small></div>{detail.related.length>0&&<button type="button" onClick={()=>onCustomer(detail.customer!.id)}>Anzeigen</button>}</div>
   </section>}
   {detail.replies.length>0&&<section className={styles.context} aria-label="Antworten"><h3>Antworten aus MailDesk</h3>{detail.replies.map(item=><div className={styles.contextRow} key={item.id}><Glyph name="send"/><div><b>{item.subject}</b><small>{item.actorName??'Unbekannt'} · {berlin(item.createdAt,{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} · {item.testMode?'Testbetrieb – nicht zugestellt':'an '+item.recipient}</small></div></div>)}</section>}
   {canWrite&&assignment&&<p className={styles.clear}><button type="button" disabled={busy} onClick={()=>void act({action:'clear'},'Zuordnung entfernt.')}>Zuordnung entfernen</button></p>}
  </div>
  {tasking&&<TaskCreateDialog defaults={{subject:message.subject.replace(/^(aw|wg|re|fw):\s*/i,'').slice(0,200),description:`Aus Mail von ${message.from.name||message.from.address} (${berlin(message.receivedAt,{day:'2-digit',month:'2-digit',year:'numeric'})}):\n${message.body.slice(0,1200)}`.slice(0,4000),customerId:(assignment??suggestion)?.customerId,objectId:(assignment??suggestion)?.objectId,links:[{kind:'mail',id:message.id,label:message.subject||'(ohne Betreff)',detail:message.from.address,href:'/maildesk?id='+encodeURIComponent(message.id)}],origin:`aus Mail „${message.subject}“`}} onClose={()=>setTasking(false)} onCreated={taskId=>{setTasking(false);setNotice('Aufgabe in PDS angelegt und mit dieser Mail verknüpft.');void taskId;}}/>}
  {picking&&<CustomerPicker customers={detail.customers} objects={detail.objects} initial={assignment?.customerId??suggestion?.customerId??''} onClose={()=>setPicking(false)} onPick={(customerId,objectId)=>{setPicking(false);void act({action:'assign',customerId,objectId},'Zugeordnet. Der Absender wird künftig automatisch erkannt.');}}/>}
 </section>;
}

function ReplyForm({id,message,onDone}:{id:string;message:MailMessage;onDone:(text:string)=>void}){
 const [subject,setSubject]=useState(/^aw:/i.test(message.subject)?message.subject:'AW: '+message.subject),[body,setBody]=useState(`Guten Tag,\n\n\n\nFreundliche Grüße\nIhr Serviceteam\n\n--- Ursprüngliche Nachricht von ${message.from.address} ---\n${message.body.split('\n').map(line=>'> '+line).join('\n')}`.slice(0,20000));
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),key=useRef(requestId());
 async function send(event:React.FormEvent){event.preventDefault();setBusy(true);setError('');
  try{const response=await fetch('/api/maildesk/antwort',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,requestId:key.current,recipient:message.from.address,subject,body}),signal:AbortSignal.timeout(30000)});const value=await response.json();if(!response.ok)throw Error(value.error);onDone(value.testMode?'Antwort eingereiht – Testbetrieb, es wird nichts zugestellt.':'Antwort wird versendet.');}
  catch(problem){setError(problem instanceof Error&&problem.name!=='TimeoutError'&&problem.name!=='TypeError'?problem.message:'Senden nicht bestätigt. Erneut senden ist sicher – es entsteht kein Duplikat.');}
  finally{setBusy(false);}}
 return <form className={styles.reply} onSubmit={send} aria-label="Antwort"><p className={styles.meta}><span>An:</span> {message.from.address}</p><label>Betreff<input value={subject} maxLength={300} onChange={event=>setSubject(event.target.value)} required/></label><label>Text<textarea value={body} rows={9} maxLength={20000} onChange={event=>setBody(event.target.value)} required/></label>{error&&<p className={styles.error} role="alert">{error}</p>}<div className={styles.replyActions}><button type="submit" className={styles.primary} disabled={busy}><Glyph name="send"/>{busy?'Wird gesendet …':'Senden'}</button></div></form>;
}

function CustomerPicker({customers,objects,initial,onClose,onPick}:{customers:{id:string;name:string;number:string}[];objects:{id:string;customerId:string;parentId?:string;name:string;address:string}[];initial:string;onClose:()=>void;onPick:(customerId:string,objectId:string|null)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),[term,setTerm]=useState(''),[customer,setCustomer]=useState(initial),[object,setObject]=useState('');
 useEffect(()=>{dialog.current?.showModal();},[]);
 const found=customers.filter(item=>!term.trim()||(item.name+' '+item.number).toLocaleLowerCase('de').includes(term.trim().toLocaleLowerCase('de'))).slice(0,50);
 const own=objects.filter(item=>item.customerId===customer);
 return <dialog ref={dialog} className={styles.picker} aria-labelledby="maildesk-picker-title" onClose={onClose} onCancel={onClose}>
  <div className={styles.pickerHead}><h2 id="maildesk-picker-title">Kunde zuordnen</h2><button type="button" className="heyelli-close" aria-label="Schließen" onClick={()=>dialog.current?.close()}/></div>
  <label className={`${styles.search} heyelli-field`}><Glyph name="search"/><input type="search" aria-label="Kunde suchen" placeholder="Name oder Kundennummer" value={term} autoFocus onChange={event=>setTerm(event.target.value)}/></label>
  <ul className={styles.pickList} role="listbox" aria-label="Kunden">{found.map(item=><li key={item.id} role="option" aria-selected={customer===item.id}><button type="button" onClick={()=>{setCustomer(item.id);setObject('');}}><b>{item.name}</b><small>{item.number||'ohne Kundennummer'}</small></button></li>)}{!found.length&&<li className={styles.empty}>Kein Kunde gefunden.</li>}</ul>
  {customer&&own.length>0&&<div className={styles.objectSelect}><span>Objekt oder Einheit (optional)</span><PopUpButton label="Objekt oder Einheit" value={object} options={[{value:'',label:'Kein bestimmtes Objekt'},...own.map((item,index)=>({value:item.id,label:(item.parentId?'– ':'')+item.name+(item.address?' · '+item.address:''),separatorBefore:index===0}))]} onChange={setObject}/></div>}
  <div className={styles.pickerActions}><button type="button" onClick={()=>dialog.current?.close()}>Abbrechen</button><button type="button" className={styles.primary} disabled={!customer} onClick={()=>onPick(customer,object||null)}>Zuordnen</button></div>
 </dialog>;
}
