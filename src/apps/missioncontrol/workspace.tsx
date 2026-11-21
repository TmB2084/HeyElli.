'use client';
import {Fragment,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {AppGlyph,appIconBackground,GuardedLink,Notice,PopUpButton} from '@/platform/shell';
import {TaskCreateDialog} from '@/apps/taskhub/client';
import type {PlanEntry,FocusSession} from './store';
import {GoalsView} from './goals-view';
import {ReviewAside,ReviewView} from './review-view';
import styles from './workspace.module.css';
// MissionControl (Innendienst) nach Mockups mc1–mc3: Heute (wichtig zuerst, weitere, Woche), Fokus, Ziele und Rückblick.
type Source='pds'|'mail'|'order';
type Item={key:string;source:Source;id:string;title:string;subtitle:string;due:string|null;status:string;href:string|null;plan:PlanEntry|null;notes:number;focusToday:number;goalId:string|null};
type CalEvent={id:string;subject:string;start:string;end:string;allDay:boolean;busy:boolean};
type Goal={id:string;title:string;focusWeek:number};
type Overview={calendar:{mode:'off'|'sample'|'graph'|'error';reason:string;events:CalEvent[]};today:string;days:string[];items:Item[];goals:Goal[];doneToday:number;focus:FocusSession|null;focusByDay:{day:string;seconds:number}[];me:string|null;canWrite:boolean;canComplete:boolean;mailError:string;loadedAt:string};
type View='heute'|'woche'|'fokus'|'ziele'|'rueckblick';
const FOCUS_GOAL=5*3600;
const P:Record<string,React.ReactNode>={target:<><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/></>,chart:<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>,star:<path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8z"/>,week:<><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M8 10v10M13 10v10M18 10v10"/></>,bolt:<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>,play:<path d="M8 5v14l11-7z"/>,pause:<path d="M8 5v14M16 5v14"/>,check:<path d="m5 12 4 4 10-10"/>,
 pds:<><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 10h4M7 14h10"/></>,mail:<><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></>,order:<><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/></>,task:<><rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8 12 3 3 5-6"/></>,note:<><path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4M8 12h8M8 16h5"/></>,
 side:<><rect x="3" y="4" width="21" height="16" rx="3"/><path d="M9 4v16"/></>,new:<><path d="M4 20h4l10-10-4-4L4 16z"/><path d="m13 7 4 4"/></>,ext:<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>,back:<path d="m15 6-6 6 6 6"/>,clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,alert:<><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/></>,drag:<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>,cal:<><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="m9 15 2 2 4-4"/></>};
const Glyph=({name,size=15}:{name:string;size?:number})=><svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[name]}</svg>;
const sourceLabel:Record<Source,string>={pds:'PDS-Aufgabe',mail:'Mail',order:'Auftrag'};
const Tag=({source}:{source:Source})=><span className={styles.tag} data-kind={source}><Glyph name={source} size={11}/>{sourceLabel[source]}</span>;
const goalColors=['#d82b3c','#0a84ff','#30d158','#ff9f0a','#bf5af2'];
const dayKey=(value:string|Date)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date(value));
const dayLabel=(day:string,options:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('de-DE',{timeZone:'UTC',...options}).format(new Date(day+'T12:00:00Z'));
const clock=(seconds:number,long=false)=>{const s=Math.max(0,Math.floor(seconds)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),r=s%60;return (h||long?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(r).padStart(2,'0');};
const calName=(mode:string)=>mode==='graph'?'Outlook':'Beispiel';
const hours=(seconds:number)=>{const m=Math.round(seconds/60);return m<60?`${m} Min.`:`${Math.floor(m/60)}:${String(m%60).padStart(2,'0')} h`;};
const plus=(time:string,minutes:number)=>{const [h,m]=time.split(':').map(Number),t=h*60+m+minutes;return `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;};
function dueText(due:string|null,today:string){if(!due)return {text:'',late:false};const day=dayKey(due),late=day<today||(day===today&&Date.parse(due)<Date.now());return {text:late?(day===today?'überfällig':'seit '+dayLabel(day,{day:'2-digit',month:'2-digit'})):day===today?'heute':dayLabel(day,{weekday:'short',day:'2-digit',month:'2-digit'}),late};}
const prefs={get(name:string){try{return localStorage.getItem('heyelli:missioncontrol:'+name)==='1';}catch{return false;}},set(name:string,value:boolean){try{localStorage.setItem('heyelli:missioncontrol:'+name,value?'1':'0');}catch{}}};
async function post(path:string,body:Record<string,unknown>){const response=await fetch('/api/missioncontrol/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)}),value=await response.json();if(!response.ok)throw Error(value.error);return value;}
const message=(problem:unknown,fallback:string)=>problem instanceof Error&&problem.name!=='TimeoutError'&&problem.name!=='TypeError'?problem.message:fallback;
const AppSquare=({icon}:{icon:'tasks'|'service'|'maildesk'})=><span className={styles.appSquare} style={{background:appIconBackground[icon]}} aria-hidden="true"><AppGlyph icon={icon}/></span>;

export function MissionControlWorkspace(){
 const params=useSearchParams(),router=useRouter(),view=(params.get('ansicht')??'heute') as View,focusKey=params.get('aufgabe')??'';
 const [data,setData]=useState<Overview|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[failure,setFailure]=useState(''),[busy,setBusy]=useState(false),[creating,setCreating]=useState(false),[over,setOver]=useState(''),[now,setNow]=useState(()=>Date.now()),[collapsed,setCollapsed]=useState(()=>prefs.get('seitenleiste-eingeklappt'));
 const navigate=useCallback((changes:Record<string,string|null>)=>{const next=new URLSearchParams(params.toString());for(const [name,value] of Object.entries(changes)){if(value)next.set(name,value);else next.delete(name);}router.push('/missioncontrol'+(next.size?'?'+next:''),{scroll:false});},[params,router]);
 const load=useCallback(async(fresh=false)=>{try{const response=await fetch('/api/missioncontrol'+(fresh?'?neu=1':''),{cache:'no-store',signal:AbortSignal.timeout(90000)}),value=await response.json();if(!response.ok)throw Error(value.error);setData(value);setError('');}catch(problem){setError(message(problem,'MissionControl ist derzeit nicht erreichbar.'));}},[]);
 useEffect(()=>{const start=setTimeout(()=>void load(),0),timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},120000);return()=>{clearTimeout(start);clearInterval(timer);};},[load]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const today=data?.today??'';
 const items=useMemo(()=>(data?.items??[]).filter(item=>['OFFEN','IN_BEARBEITUNG','WARTEN'].includes(item.status)),[data]);
 const important=useMemo(()=>items.filter(item=>item.plan?.important&&item.plan.day===today).sort((a,b)=>a.plan!.position-b.plan!.position),[items,today]);
 const others=useMemo(()=>items.filter(item=>!(item.plan?.important&&item.plan.day===today)).sort((a,b)=>Number(b.plan?.day===today)-Number(a.plan?.day===today)||(a.due??'9').localeCompare(b.due??'9')||a.title.localeCompare(b.title,'de')),[items,today]);
 const running=data?.focus??null,elapsed=running?(now-Date.parse(running.startedAt))/1000:0;
 const runningItem=running?items.find(item=>item.key===running.itemKey)??null:null;
 async function act(run:()=>Promise<unknown>,done:string){setBusy(true);setNotice('');setFailure('');try{await run();setNotice(done);await load();}catch(problem){setFailure(message(problem,'Die Änderung konnte nicht gespeichert werden.'));await load();}finally{setBusy(false);}}
 const plan=(item:Item,change:Record<string,unknown>,done:string)=>act(()=>post('plan',{itemKey:item.key,title:item.title,...change}),done);
 const linkGoal=(item:Item,goalId:string)=>act(()=>post('ziele',{action:'link',itemKey:item.key,goalId:goalId||null}),goalId?'Dem Ziel zugeordnet.':'Zuordnung entfernt.');
 const startFocus=(item:Item)=>act(()=>post('fokus',{action:'start',itemKey:item.key,title:item.title,planned:item.plan?.estimate??25}),'Fokus gestartet.').then(()=>navigate({ansicht:'fokus',aufgabe:item.key}));
 const stopFocus=()=>act(()=>post('fokus',{action:'stop'}),'Fokus pausiert.');
 const complete=(item:Item,appendNotes:boolean)=>act(()=>post('erledigt',{itemKey:item.key,appendNotes,requestId:crypto.randomUUID()}),'Erledigt und in PDS gespeichert.');
 const focusTarget=running?.itemKey??important[0]?.key??null;
 useEffect(()=>{const key=(event:KeyboardEvent)=>{const target=event.target as HTMLElement;if(target.closest('input,textarea,select,[contenteditable=true],dialog'))return;if(event.metaKey||event.ctrlKey||event.altKey)return;
  if(event.key==='n'&&view!=='fokus'&&data?.canWrite){event.preventDefault();setCreating(true);}else if(event.key==='f'&&view!=='fokus'){event.preventDefault();navigate({ansicht:'fokus',aufgabe:focusTarget});}};
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[view,data,focusTarget,navigate]);
 const dayOptions=(data?.days??[]).filter(day=>day>=today).map(day=>({value:day,label:day===today?'Heute':dayLabel(day,{weekday:'short',day:'2-digit',month:'2-digit'})}));
 const drop=(day:string|null,makeImportant=false)=>(event:React.DragEvent)=>{event.preventDefault();setOver('');const key=event.dataTransfer.getData('text/plain'),item=items.find(entry=>entry.key===key);if(!item)return;void plan(item,{day,...(makeImportant?{important:true}:day!==today?{important:false}:{})},makeImportant?'Als wichtig für heute markiert.':day?'Eingeplant.':'Planung entfernt.');};
 const dragProps=(item:Item)=>data?.canWrite?{draggable:true,onDragStart:(event:React.DragEvent)=>{event.dataTransfer.setData('text/plain',item.key);event.dataTransfer.effectAllowed='move';}}:{};
 const zone=(id:string,day:string|null,makeImportant=false)=>({onDragOver:(event:React.DragEvent)=>{event.preventDefault();setOver(id);},onDragLeave:()=>setOver(value=>value===id?'':value),onDrop:drop(day,makeImportant),'data-over':over===id||undefined});
 const todaySeconds=(data?.focusByDay.find(entry=>entry.day===today)?.seconds??0)+(running?Math.max(0,elapsed):0);
 const plannedToday=items.filter(item=>item.plan?.day===today).length,doneToday=data?.doneToday??0;
 const weekTitle=(data?.days[0]??'')>today?'Kommende Woche':'Diese Woche';

 if(view==='fokus'&&data)return <div className={styles.workspace} style={{gridTemplateColumns:'1fr'}}><h1 className="sr-only">MissionControl – Fokus</h1>
  <FocusView goals={data.goals} calendar={data.calendar.mode} key={focusKey||running?.itemKey||'leer'} item={items.find(item=>item.key===(focusKey||running?.itemKey))??runningItem??important[0]??null} running={running} now={now} canWrite={data.canWrite} canComplete={data.canComplete} busy={busy} failure={failure}
   onStart={startFocus} onStop={stopFocus} onExtend={()=>act(()=>post('fokus',{action:'extend',minutes:5}),'Um 5 Minuten verlängert.')} onLeave={()=>navigate({ansicht:null,aufgabe:null})}
   onDone={(item,appendNotes)=>complete(item,appendNotes).then(()=>navigate({ansicht:null,aufgabe:null}))}/></div>;
 const rowActions=(item:Item,compact=false)=>data?.canWrite&&<span className={styles.rowActions}>
  {!compact&&<button type="button" className={styles.icon} aria-label={`${item.title} als wichtig für heute`} title="Wichtig heute" disabled={busy||important.length>=3} onClick={()=>void plan(item,{day:today,important:true},'Als wichtig für heute markiert.')}><Glyph name="star"/></button>}
  {data.goals.length>0&&<PopUpButton label={`Ziel: ${item.title}`} value={item.goalId??''} placeholder="Ziel" icon={<Glyph name="target" size={13}/>} disabled={busy} align="right" options={[{value:'',label:'Kein Ziel'},...data.goals.map((goal,index)=>({value:goal.id,label:goal.title,separatorBefore:index===0}))]} onChange={value=>void linkGoal(item,value)}/>}
  <PopUpButton label={`Einplanen: ${item.title}`} value={item.plan?.day??''} placeholder="Planen" disabled={busy} align="right" options={[{value:'',label:'Nicht eingeplant'},...dayOptions.map((option,index)=>({...option,separatorBefore:index===0}))]} onChange={value=>void plan(item,{day:value||null,...(value!==today?{important:false}:{})},value?'Eingeplant.':'Planung entfernt.')}/>
  <button type="button" className={styles.icon} aria-label={`Fokus auf ${item.title}`} title="Fokus starten" disabled={busy} onClick={()=>void startFocus(item)}><Glyph name="play"/></button></span>;
 const row=(item:Item,compact=false)=>{const due=dueText(item.due,today),planned=item.plan?.day&&item.plan.day!==today;return <div key={item.key} className={styles.row} {...dragProps(item)}>
  <span className={styles.handle} aria-hidden="true"><Glyph name="drag" size={14}/></span><span className={styles.ring} data-status={item.status} aria-hidden="true"/>
  <div className={styles.rowText}><b>{item.title}</b><small>{item.subtitle}</small></div>
  <Tag source={item.source}/><span className={styles.due} data-late={!planned&&due.late||undefined}>{planned?'geplant '+dayLabel(item.plan!.day!,{weekday:'short'}):due.text}</span>
  {rowActions(item,compact)}</div>;};
 const toggleSidebar=()=>setCollapsed(value=>{prefs.set('seitenleiste-eingeklappt',!value);return !value;});
 return <div className={`${styles.workspace} ${collapsed?styles.collapsedShell:''}`}>
  <h1 className="sr-only">MissionControl</h1>
  <aside className={`${styles.sidebar} ${collapsed?styles.collapsed:''}`}>
   <div className={styles.sideHead}><button type="button" className={styles.round} aria-label={collapsed?'Seitenleiste einblenden':'Seitenleiste ausblenden'} title={collapsed?'Seitenleiste einblenden':'Seitenleiste ausblenden'} aria-expanded={!collapsed} onClick={toggleSidebar}><Glyph name="side"/></button><button type="button" className={styles.round} aria-label="Neue Aufgabe" title="Neue Aufgabe (N)" disabled={!data?.canWrite} onClick={()=>setCreating(true)}><Glyph name="new"/></button></div>
   <nav className={styles.nav} aria-label="MissionControl">
    <h2 className={styles.sideHeading}>MissionControl</h2>
    {([['heute','Heute','star',important.length],['woche','Woche','week',items.filter(item=>item.plan?.day&&item.plan.day>=today).length],['fokus','Fokus','bolt',0],['ziele','Ziele','target',data?.goals.length??0],['rueckblick','Rückblick','chart',0]] as const).map(([name,label,icon,count])=><button type="button" key={name} aria-current={view===name?'page':undefined} onClick={()=>navigate({ansicht:name==='heute'?null:name,aufgabe:name==='fokus'?focusTarget:null})}><Glyph name={icon}/><span>{label}</span>{count>0&&<small className={styles.count}>{count}</small>}</button>)}
    <h2 className={styles.sideHeading}>Eingang <small>aus Aufgaben</small></h2>
    {([['Ungeplant','task',items.filter(item=>!item.plan?.day).length],['Überfällig','alert',items.filter(item=>dueText(item.due,today).late).length],['Zugewiesene Mails','mail',items.filter(item=>item.source==='mail').length]] as const).map(([label,icon,count])=><button type="button" key={label} onClick={()=>navigate({ansicht:'woche',aufgabe:null})}><Glyph name={icon}/><span>{label}</span>{count>0&&<small className={styles.count}>{count}</small>}</button>)}
   </nav>
   <nav className={styles.nav} aria-label="Verwandte Apps"><h2 className={styles.sideHeading}>Verwandte Apps</h2><GuardedLink href="/taskhub" className={styles.appLink}><AppSquare icon="tasks"/><span>TaskHub</span></GuardedLink><GuardedLink href="/servicehub" className={styles.appLink}><AppSquare icon="service"/><span>ServiceHub</span></GuardedLink><GuardedLink href="/maildesk" className={styles.appLink}><AppSquare icon="maildesk"/><span>MailDesk</span></GuardedLink></nav>
  </aside>
  <section className={styles.main} aria-label={view==='woche'?'Woche':view==='ziele'?'Ziele':view==='rueckblick'?'Rückblick':'Heute'}>
   {(view==='heute'||view==='woche')&&<div className={styles.head}><div><h2>{view==='woche'?'Woche planen':'Heute'}</h2><small>{today?dayLabel(today,{weekday:'long',day:'numeric',month:'long'}):''}{data?` · ${important.length} wichtig · ${others.filter(item=>item.plan?.day===today).length+others.filter(item=>!item.plan?.day).length} weitere`:''}</small></div>
    <div className={styles.capsule}><button type="button" aria-pressed={view==='woche'} onClick={()=>navigate({ansicht:view==='woche'?null:'woche',aufgabe:null})}><Glyph name="star" size={14}/>Tag planen</button><span aria-hidden="true"/><button type="button" onClick={()=>navigate({ansicht:'fokus',aufgabe:focusTarget})}><Glyph name="bolt" size={14}/>Fokus <span className={styles.kbd}>F</span></button></div></div>}
   {error&&<Notice tone="error" role="alert">{error} <button type="button" onClick={()=>void load(true)}>Erneut versuchen</button></Notice>}
   {failure&&<Notice tone="error" role="alert">{failure}</Notice>}
   {notice&&<p role="status" className="sr-only">{notice}</p>}
   {data?.mailError&&<Notice tone="neutral">{data.mailError}</Notice>}
   {!data&&!error&&<p role="status" className={styles.hint}>MissionControl wird geladen …</p>}
   {data&&view==='heute'&&<>
    <p className={styles.section}>Wichtig heute <span>das Wichtigste zuerst – vor E-Mails und Kleinkram</span></p>
    <div className={styles.important}>
     {important.map((item,index)=><article key={item.key} className={styles.card} data-running={running?.itemKey===item.key||undefined} {...dragProps(item)}><span className={styles.number}>{index+1}</span><b>{item.title}</b><small>{item.subtitle||'Ohne Kundenbezug'}</small>
      <div className={styles.foot}><Tag source={item.source}/><span className={styles.estimate}><Glyph name="clock" size={11}/>{item.plan?.estimate??30} Min.</span>{item.goalId&&<span className={styles.goalChip}><Glyph name="target" size={11}/>{data.goals.find(goal=>goal.id===item.goalId)?.title}</span>}
       {data.canWrite&&<span className={styles.cardActions}><button type="button" className={styles.icon} aria-label={`${item.title}: wichtig entfernen`} title="Nicht mehr wichtig" aria-pressed="true" disabled={busy} onClick={()=>void plan(item,{important:false},'Zurückgestuft.')}><Glyph name="star"/></button><button type="button" className={styles.icon} aria-label={`Fokus auf ${item.title}`} title="Fokus starten" disabled={busy} onClick={()=>void startFocus(item)}><Glyph name="play"/></button></span>}</div></article>)}
     {Array.from({length:Math.max(0,3-important.length)},(_,index)=><div key={'slot'+index} className={styles.slot} {...zone('slot'+index,today,true)}>{data.canWrite?'Wichtige Aufgabe hierher ziehen oder mit ★ markieren':'Noch nichts als wichtig markiert'}</div>)}
    </div>
    <p className={styles.section}>Weitere Aufgaben <span>aus PDS, MailDesk und Service · ziehen zum Sortieren</span></p>
    <div className={styles.list}>{others.slice(0,40).map(item=>row(item))}{!others.length&&<p className={styles.hint} style={{padding:12}}>Keine weiteren offenen Aufgaben.</p>}</div>
    <p className={styles.section}>{weekTitle} <span>Aufgaben auf Tage verteilen · Auslastung je Tag</span></p>
    <Week calendar={data.calendar.mode} days={data.days.slice(0,5)} today={today} items={items} zone={zone} dragProps={dragProps}/>
   </>}
   {data&&view==='woche'&&<>
    <p className={styles.section}>Ungeplant <span>{items.filter(item=>!item.plan?.day).length} Aufgaben · auf einen Tag ziehen oder über „Planen“ wählen</span></p>
    <div className={styles.list} {...zone('unplanned',null)}>{items.filter(item=>!item.plan?.day).slice(0,30).map(item=>row(item,true))}{!items.some(item=>!item.plan?.day)&&<p className={styles.hint} style={{padding:12}}>Alles eingeplant.</p>}</div>
    <p className={styles.section}>{weekTitle}</p><Week calendar={data.calendar.mode} days={data.days.slice(0,5)} today={today} items={items} zone={zone} dragProps={dragProps}/>
    <p className={styles.section}>{weekTitle==='Diese Woche'?'Nächste Woche':'Übernächste Woche'}</p><Week calendar={data.calendar.mode} days={data.days.slice(5,10)} today={today} items={items} zone={zone} dragProps={dragProps}/>
   </>}
   {view==='ziele'&&<GoalsView onChanged={()=>void load()}/>}
   {view==='rueckblick'&&<ReviewView/>}
  </section>
  <aside className={styles.right} aria-label={view==='ziele'||view==='rueckblick'?'Woche':'Fokus und Tag'}>
   {view==='ziele'||view==='rueckblick'?<ReviewAside/>:<>
   <section className={styles.panel} aria-label="Jetzt im Fokus"><h3>Jetzt im Fokus <span className={styles.kbd}>F</span></h3>
    {running?<><button type="button" className={styles.focusTitle} onClick={()=>navigate({ansicht:'fokus',aufgabe:running.itemKey})}>{running.title}</button><div className={styles.timer}>{clock(elapsed,true)}</div>
     <div className={styles.actions}><button type="button" className={styles.pill} data-primary="" disabled={busy} onClick={()=>void stopFocus()}><Glyph name="pause" size={13}/>Pause</button>{runningItem?.source==='pds'&&<button type="button" className={styles.pill} disabled={busy||!data?.canComplete} onClick={()=>void complete(runningItem,prefs.get('pds-anhaengen'))}><Glyph name="check" size={13}/>Erledigt <span className={styles.kbd}>⌘↩</span></button>}</div></>
    :<p className={styles.hint}>Kein Fokus aktiv. Eine Aufgabe mit ▶ starten oder <span className={styles.kbd}>F</span> drücken.</p>}
   </section>
   <section className={styles.panel} aria-label="Heute"><h3>Heute <span>Ziel {FOCUS_GOAL/3600} h Fokus</span></h3><div className={styles.split}><b className={styles.big}>{hours(todaySeconds)}</b><small className={styles.muted}>{doneToday} von {doneToday+plannedToday} erledigt</small></div><div className={styles.progress} style={{marginTop:8}}><i style={{width:`${Math.min(100,todaySeconds/FOCUS_GOAL*100)}%`}}/></div></section>
   <section className={styles.panel} aria-label="Woche je Ziel"><h3>Woche je Ziel</h3>{data?.goals.length?(()=>{const max=Math.max(3600,...data.goals.map(goal=>goal.focusWeek));return data.goals.slice(0,4).map((goal,index)=><div key={goal.id} className={styles.goalRow}><div className={styles.split}><span>{goal.title}</span><b>{hours(goal.focusWeek)}</b></div><div className={styles.progress}><i style={{width:`${goal.focusWeek/max*100}%`,background:goalColors[index%goalColors.length]}}/></div></div>);})():<p className={styles.hint}>Unter Ziele Teamziele anlegen und Aufgaben zuordnen.</p>}</section>
   <section className={styles.panel} aria-label="Kalender heute"><h3>Kalender heute {data&&data.calendar.mode!=='off'&&<span className={styles.olk}><Glyph name="cal" size={12}/>{data.calendar.mode==='graph'?'Outlook · synchron':data.calendar.mode==='sample'?'Beispielkalender':'nicht verbunden'}</span>}</h3>
    <label className={styles.switchRow}><span>Fokusblöcke in Outlook eintragen</span><input type="checkbox" className="heyelli-switch" role="switch" checked={!!data&&data.calendar.mode!=='off'} disabled={!data?.canWrite||busy} onChange={event=>void act(()=>post('kalender',{calendarSync:event.target.checked}),event.target.checked?'Kalenderabgleich eingeschaltet.':'Kalenderabgleich ausgeschaltet.')}/></label>
    {data&&data.calendar.mode!=='off'&&data.calendar.mode!=='graph'&&data.calendar.reason&&<p className={styles.hint} style={{marginBottom:8}}>{data.calendar.mode==='sample'?'Ohne Microsoft-365-Verbindung: nichts wird eingetragen.':data.calendar.reason}</p>}
    {data&&data.calendar.mode!=='off'&&(()=>{const start=8,end=17,px=28,top=(time:string)=>{const [h,m]=time.split(':').map(Number);return Math.max(0,(h-start)*px+m/60*px);};
     const busyToday=data.calendar.events.filter(event=>event.start.slice(0,10)===today&&!event.allDay&&event.busy),blocks=items.filter(item=>item.plan?.day===today&&item.plan.time);
     const nowTime=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(now));
     return <><div className={styles.agenda} style={{height:(end-start)*px}}>{Array.from({length:end-start},(_,index)=><Fragment key={index}><div className={styles.hour}>{start+index}:00</div><div className={styles.lane}/></Fragment>)}
      <div className={styles.events}>{busyToday.map(event=><div key={event.id} className={styles.ev} data-kind="busy" data-tall={top(event.end.slice(11,16))-top(event.start.slice(11,16))>=30||undefined} style={{top:top(event.start.slice(11,16)),height:Math.max(16,top(event.end.slice(11,16))-top(event.start.slice(11,16))-2)}}>{event.subject}<small>aus {calName(data.calendar.mode)} · belegt</small></div>)}
       {blocks.map(item=><div key={item.key} className={styles.ev} data-kind="focus" style={{top:top(item.plan!.time!),height:Math.max(16,(item.plan!.estimate??30)/60*px-2)}}>Fokus: {item.title}</div>)}
       {nowTime>='08:00'&&nowTime<'17:00'&&<div className={styles.nowLine} style={{top:top(nowTime)}} aria-hidden="true"/>}</div></div><p className={styles.hint} style={{marginTop:6}}>{calName(data.calendar.mode)}-Termine blockieren die Planung · Fokusblöcke im eigenen Kalender</p></>;})()}
   </section></>}
  </aside>
  {creating&&<TaskCreateDialog defaults={{origin:'aus MissionControl'}} onClose={()=>setCreating(false)} onCreated={id=>{setCreating(false);void post('plan',{itemKey:'pds:'+id,title:'Neue Aufgabe',day:today}).catch(()=>undefined).finally(()=>void load(true));setNotice('Aufgabe in PDS angelegt und für heute eingeplant.');}}/>}
 </div>;
}

function Week({days,today,items,zone,dragProps,calendar}:{calendar:string;days:string[];today:string;items:Item[];zone:(id:string,day:string|null)=>Record<string,unknown>;dragProps:(item:Item)=>Record<string,unknown>}){
 return <div className={styles.week}>{days.map(day=>{const own=items.filter(item=>item.plan?.day===day),minutes=own.reduce((sum,item)=>sum+(item.plan?.estimate??30),0),load=Math.min(100,minutes/(6*60)*100);
  return <div key={day} className={styles.day} data-today={day===today||undefined} {...zone('day'+day,day)}><div className={styles.dayHead}>{dayLabel(day,{weekday:'short'})}<span>{dayLabel(day,{day:'2-digit',month:'2-digit'})}</span></div>
   {own.sort((a,b)=>(a.plan?.time??'99').localeCompare(b.plan?.time??'99')).map(item=><div key={item.key} className={styles.chip} data-kind={item.source} title={item.plan?.calendarError??item.subtitle} {...dragProps(item)}>{item.plan?.important?'★ ':''}{item.title}{calendar!=='off'&&(item.plan?.calendarError?<span className={styles.calTime} data-error="">{item.plan.calendarError}</span>:item.plan?.time&&<span className={styles.calTime}>{calName(calendar)} {item.plan.time}</span>)}</div>)}
   <div className={styles.drop}>+ hierher ziehen</div><div className={styles.load} data-high={load>80||undefined} title={`Geplant etwa ${Math.round(minutes/60*10)/10} h`}><i style={{width:`${load}%`}}/></div></div>;})}</div>;
}

type Detail={task:{description?:string};extras:{checklist:{id:string;text:string;done:boolean}[];version:number}};
type Note={id:string;body:string;authorId:string|null;authorName:string;createdAt:string};
function FocusView({goals,calendar,item,running,now,canWrite,canComplete,busy,failure,onStart,onStop,onExtend,onLeave,onDone}:{goals:Goal[];calendar:string;item:Item|null;running:FocusSession|null;now:number;canWrite:boolean;canComplete:boolean;busy:boolean;failure:string;onStart:(item:Item)=>void;onStop:()=>void;onExtend:()=>void;onLeave:()=>void;onDone:(item:Item,appendNotes:boolean)=>void}){
 const [showSteps,setShowSteps]=useState(()=>prefs.get('schritte')),[showNotes,setShowNotes]=useState(()=>prefs.get('notizen')),[append,setAppend]=useState(()=>prefs.get('pds-anhaengen'));
 const [detail,setDetail]=useState<Detail|null>(null),[notes,setNotes]=useState<Note[]|null>(null),[draft,setDraft]=useState(''),[paneError,setPaneError]=useState(''),[working,setWorking]=useState(false);
 const active=!!item&&running?.itemKey===item.key,elapsed=active?(now-Date.parse(running!.startedAt))/1000:0,planned=(active?running!.plannedMinutes:item?.plan?.estimate)??25,share=Math.min(1,elapsed/60/planned);
 const noteField=useRef<HTMLTextAreaElement>(null);
 const loadSteps=useCallback(async()=>{if(!item||item.source!=='pds')return;try{const response=await fetch('/api/aufgaben/aufgabe?'+new URLSearchParams({id:item.id}),{cache:'no-store'}),value=await response.json();if(!response.ok)throw Error(value.error);setDetail(value);}catch(problem){setPaneError(message(problem,'Schritte nicht erreichbar.'));}},[item]);
 const loadNotes=useCallback(async()=>{if(!item)return;try{const response=await fetch('/api/missioncontrol/notizen?'+new URLSearchParams({aufgabe:item.key}),{cache:'no-store'}),value=await response.json();if(!response.ok)throw Error(value.error);setNotes(value.notes);}catch(problem){setPaneError(message(problem,'Notizen nicht erreichbar.'));}},[item]);
 // Zähler auf den Knöpfen gleich anzeigen (Schritte „2/4“), auch wenn die Bereiche ausgeblendet sind.
 useEffect(()=>{const start=setTimeout(()=>{void loadSteps();if(showNotes)void loadNotes();},0);return()=>clearTimeout(start);},[loadSteps,loadNotes,showNotes]);
 const toggleSteps=useCallback(()=>setShowSteps(value=>{prefs.set('schritte',!value);return !value;}),[]);
 const toggleNotes=useCallback(()=>setShowNotes(value=>{prefs.set('notizen',!value);if(!value)setTimeout(()=>noteField.current?.focus(),50);return !value;}),[]);
 useEffect(()=>{const key=(event:KeyboardEvent)=>{const target=event.target as HTMLElement,typing=!!target.closest('input,textarea,select,[contenteditable=true]');
  if(event.key==='Escape'&&!typing){event.preventDefault();onLeave();}
  else if((event.metaKey||event.ctrlKey)&&event.key==='Enter'&&item?.source==='pds'&&canComplete&&!typing){event.preventDefault();onDone(item,append);}
  else if(!typing&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&event.key==='s'&&item?.source==='pds'){event.preventDefault();toggleSteps();}
  else if(!typing&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&event.key==='m'){event.preventDefault();toggleNotes();}};
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[item,canComplete,append,onDone,onLeave,toggleSteps,toggleNotes]);
 async function toggleStep(entryId:string){if(!detail||!item)return;setWorking(true);try{const response=await fetch('/api/aufgaben/aktion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,action:'check-toggle',entryId,version:detail.extras.version})}),value=await response.json();if(!response.ok)throw Error(value.error);setDetail({...detail,extras:value.extras});}catch(problem){setPaneError(message(problem,'Schritt nicht gespeichert.'));await loadSteps();}finally{setWorking(false);}}
 async function addNote(){if(!item||!draft.trim())return;setWorking(true);try{await post('notizen',{action:'add',itemKey:item.key,text:draft});setDraft('');await loadNotes();}catch(problem){setPaneError(message(problem,'Notiz nicht gespeichert.'));}finally{setWorking(false);}}
 async function removeNote(id:string){setWorking(true);try{await post('notizen',{action:'remove',noteId:id});await loadNotes();}catch(problem){setPaneError(message(problem,'Notiz nicht gelöscht.'));}finally{setWorking(false);}}
 if(!item)return <section className={styles.focus} aria-label="Fokus"><div className={styles.focusBox}><h2>Kein Fokus gewählt</h2><p className={styles.hint}>Unter Heute eine wichtige Aufgabe markieren oder eine Aufgabe mit ▶ starten.</p><button type="button" className={styles.pill} onClick={onLeave}><Glyph name="back" size={13}/>Zu Heute</button></div></section>;
 const steps=detail?.extras.checklist??[],done=steps.filter(step=>step.done).length,panes=[showSteps&&item.source==='pds',showNotes].filter(Boolean).length,goal=goals.find(entry=>entry.id===item.goalId),due=dueText(item.due,dayKey(new Date(now)));
 return <section className={styles.focus} aria-label="Fokus"><div className={styles.focusBox}>
  <div className={styles.actions} style={{justifyContent:'center'}}><Tag source={item.source}/>{goal&&<span className={styles.goalChip}><Glyph name="target" size={11}/>Ziel: {goal.title}</span>}{item.source!=='pds'&&item.href&&<GuardedLink href={item.href} className={styles.tag} data-kind="plain"><Glyph name="ext" size={11}/>{item.source==='mail'?'In MailDesk öffnen':'Im Service öffnen'}</GuardedLink>}</div>
  <h2>{item.title}</h2>
  <small>{[item.subtitle,due.text&&'fällig '+due.text].filter(Boolean).join(' · ')}{calendar!=='off'&&item.plan?.time&&item.plan.day===dayKey(new Date(now))&&<> · <span className={styles.olk}><Glyph name="cal" size={12}/>{calName(calendar)} {item.plan.time}–{plus(item.plan.time,item.plan.estimate??30)}</span></>}</small>
  <div className={styles.dial} style={{background:`conic-gradient(var(--primary) 0 ${share*100}%, color-mix(in srgb, var(--foreground) 10%, transparent) ${share*100}% 100%)`}} role="timer" aria-label={active?`Fokus läuft seit ${clock(elapsed)}`:'Fokus nicht gestartet'}><div><div className={styles.timer}>{clock(elapsed)}</div><small>von {planned} Min. geplant</small></div></div>
  <div className={styles.actions} style={{justifyContent:'center'}}>
   {active?<button type="button" className={styles.pill} data-primary="" disabled={busy} onClick={onStop}><Glyph name="pause" size={13}/>Pause</button>:<button type="button" className={styles.pill} data-primary="" disabled={busy||!canWrite} onClick={()=>onStart(item)}><Glyph name="play" size={13}/>{elapsed>0||item.focusToday>0?'Weiter':'Fokus starten'}</button>}
   {item.source==='pds'&&<button type="button" className={styles.pill} disabled={busy||!canComplete} title={canComplete?undefined:'Erledigen in PDS ist mit dieser Anbindung nicht möglich'} onClick={()=>onDone(item,append)}><Glyph name="check" size={13}/>Erledigt <span className={styles.kbd}>⌘↩</span></button>}
   {active&&<button type="button" className={styles.pill} disabled={busy} onClick={onExtend}>+5 Min.</button>}
   <button type="button" className={styles.pill} onClick={()=>{if(active)onStop();onLeave();}}>Fokus beenden <span className={styles.kbd}>Esc</span></button>
  </div>
  <div className={styles.actions} style={{justifyContent:'center'}}>
   {item.source==='pds'&&<button type="button" className={styles.toggle} aria-pressed={showSteps} onClick={toggleSteps}><Glyph name="task" size={14}/>Schritte {detail&&steps.length>0&&<small>{done}/{steps.length}</small>}</button>}
   <button type="button" className={styles.toggle} aria-pressed={showNotes} onClick={toggleNotes}><Glyph name="note" size={14}/>Notizen {(notes?.length??item.notes)>0&&<small>{notes?.length??item.notes}</small>}</button>
  </div>
  {(failure||paneError)&&<Notice tone="error" role="alert">{failure||paneError}</Notice>}
  {panes===0?<p className={styles.hint}>Schritte und Notizen sind ausgeblendet · {item.source==='pds'&&<><span className={styles.kbd}>S</span> Schritte · </>}<span className={styles.kbd}>M</span> Notizen</p>
  :<div className={styles.panes} data-two={panes===2||undefined}>
   {showSteps&&item.source==='pds'&&<section className={styles.pane} aria-label="Schritte"><header><b><Glyph name="task" size={14}/> Schritte</b><small>nur in heyelli</small></header>{!detail?<p className={styles.step}>Wird geladen …</p>:steps.length?steps.map(step=><label key={step.id} className={styles.step} data-done={step.done||undefined}><input type="checkbox" checked={step.done} disabled={working||!canWrite} onChange={()=>void toggleStep(step.id)}/><span>{step.text}</span><small>{step.done?'erledigt':''}</small></label>):<p className={styles.step}><span className={styles.muted}>Keine Schritte. In Aufgaben ergänzen.</span></p>}</section>}
   {showNotes&&<section className={styles.pane} aria-label="Notizen zur Aufgabe"><header><b><Glyph name="note" size={14}/> Notizen zur Aufgabe</b><small>nur in heyelli · mit Zeitstempel</small></header>
    {(notes??[]).map(note=><div key={note.id} className={styles.note}><small><span>{new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}).format(new Date(note.createdAt))} · {note.authorName}</span>{canWrite&&<button type="button" disabled={working} onClick={()=>void removeNote(note.id)}>Löschen</button>}</small>{note.body}</div>)}
    {notes&&!notes.length&&<p className={styles.note}><span className={styles.muted}>Noch keine Notizen.</span></p>}
    {canWrite&&<form className={styles.noteForm} onSubmit={event=>{event.preventDefault();void addNote();}}><textarea ref={noteField} aria-label="Neue Notiz" placeholder="Notiz schreiben … (↩ speichert)" maxLength={2000} value={draft} onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();void addNote();}}}/>
     <div className={styles.noteFoot}>{item.source==='pds'?<label><input type="checkbox" className="heyelli-switch" role="switch" checked={append} onChange={event=>{setAppend(event.target.checked);prefs.set('pds-anhaengen',event.target.checked);}}/>Beim Erledigen an die PDS-Beschreibung anhängen</label>:<span/>}<span><span className={styles.kbd}>M</span> Notiz</span></div></form>}
   </section>}
  </div>}
 </div></section>;
}
