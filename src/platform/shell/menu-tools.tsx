"use client";
import {useEffect,useRef,useState} from 'react';
import {AppGlyph} from './app-glyph';
import {useRouter} from 'next/navigation';
import {useGuardedNavigation} from './navigation-guard';
import {AlertDialog} from './alert-dialog';
import {Notice} from './notice';
import {useTools,type ToolState} from './use-tools';
import {NotesTool} from '@/apps/notizen/ui';
import styles from './menu-tools.module.css';
export function MenuTools(){const {data}=useTools();return <><IncidentTool data={data}/>{data?.tools.some(tool=>tool.id==='notes')&&<NotesTool key={data.owner} visible={!data.hidden.includes('notes')}/>}</>;}
function IncidentTool({data}:{data:ToolState|null}){
 const router=useRouter(),navigate=useGuardedNavigation();
 const [open,setOpen]=useState(false),[started,setStarted]=useState(false),box=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null),frame=useRef<HTMLIFrameElement>(null);
 const [dirty,setDirty]=useState(false),[reloadSafe,setReloadSafe]=useState(false),[reloadHint,setReloadHint]=useState(false),reloadDialog=useRef<HTMLDialogElement>(null);
 const tool=data?.tools.find(tool=>tool.id==='incident'),visible=!!tool&&!data?.hidden.includes(tool.id),shown=open&&(visible||dirty&&reloadHint);
 function close(){setOpen(false);button.current?.focus({preventScroll:true});}
 useEffect(()=>{
  const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!box.current?.contains(event.target))setOpen(false);};
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&shown&&!reloadDialog.current?.open&&!event.defaultPrevented){event.preventDefault();setOpen(false);button.current?.focus({preventScroll:true});}};
  const message=(event:MessageEvent)=>{if(event.origin!==location.origin||event.source!==frame.current?.contentWindow)return;if(event.data?.type==='heyelli:tool-draft'&&typeof event.data.dirty==='boolean'){setDirty(event.data.dirty);setReloadSafe(event.data.reloadSafe===true);if(!event.data.dirty)setReloadHint(false);}if(event.data?.type==='heyelli:tool-reload-request'&&dirty&&!reloadSafe){setReloadHint(true);setOpen(true);button.current?.focus({preventScroll:true});reloadDialog.current?.showModal();}if(event.data?.type==='heyelli:tool-navigate'&&typeof event.data.href==='string'&&event.data.href.length<=2000){try{const url=new URL(event.data.href,location.origin);if(url.origin===location.origin&&['/servicehub','/planboard'].includes(url.pathname))navigate(()=>{setOpen(false);router.push(url.pathname+url.search);});}catch{/* Ignore invalid navigation from a retired tool frame. */}}if(event.data?.type==='heyelli:tool-close'){setOpen(false);button.current?.focus({preventScroll:true});}};
  const another=(event:Event)=>{if((event as CustomEvent).detail!=='incident')setOpen(false);};window.addEventListener('heyelli:tool-open',another);document.addEventListener('pointerdown',outside);window.addEventListener('keydown',key);window.addEventListener('message',message);return()=>{window.removeEventListener('heyelli:tool-open',another);document.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',key);window.removeEventListener('message',message);};
 },[shown,dirty,reloadSafe,navigate,router]);
 useEffect(()=>{
  if(!dirty||reloadSafe)return;
  let sessionInvalid=false;
  const invalidate=()=>{sessionInvalid=true;try{frame.current?.contentWindow?.dispatchEvent(new Event('heyelli:session-invalid'));}catch{/* A retired frame cannot hold up the protected host redirect. */}};
  function warn(){setReloadHint(true);setOpen(true);}
  const unload=(event:BeforeUnloadEvent)=>{if(sessionInvalid)return;warn();event.preventDefault();event.returnValue='';};
  const reload=(event:KeyboardEvent)=>{if(!sessionInvalid&&(((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='r')||event.key==='F5')){event.preventDefault();warn();button.current?.focus({preventScroll:true});reloadDialog.current?.showModal();}};
  window.addEventListener('heyelli:session-invalid',invalidate);window.addEventListener('beforeunload',unload);window.addEventListener('keydown',reload,true);
  return()=>{window.removeEventListener('heyelli:session-invalid',invalidate);window.removeEventListener('beforeunload',unload);window.removeEventListener('keydown',reload,true);};
 },[dirty,reloadSafe]);
 // Hiding a tool is only a presentation preference. Its mounted mobile form
 // survives closing, preference changes and navigation in the surrounding app.
 return <><div ref={box} data-reload-hint={reloadHint} className={styles.tools}>
  {visible&&<button ref={button} type="button" className="platform-icon-button" aria-label="CaseDesk als Werkzeug öffnen" title={dirty?"CaseDesk · Ungesicherte Eingaben":"CaseDesk"} aria-describedby={dirty?"incident-tool-draft":undefined} aria-expanded={shown} aria-controls="incident-tool" onClick={()=>{setStarted(true);if(!open)window.dispatchEvent(new CustomEvent('heyelli:tool-open',{detail:'incident'}));setOpen(value=>!value);}}><AppGlyph icon="incident"/>{dirty&&<span className={styles.draftDot} aria-hidden="true"/>}</button>}
  {dirty&&<span id="incident-tool-draft" className="sr-only">Ungesicherte Eingaben im CaseDesk</span>}
  {started&&tool&&<section id="incident-tool" className={styles.panel} aria-label="Werkzeug CaseDesk" hidden={!shown} inert={!shown}>
   <div className={styles.heading}><span><AppGlyph icon="incident"/>CaseDesk</span><button className="heyelli-close" type="button" aria-label="Werkzeug schließen" title="Schließen" onClick={close}>×</button></div>
   {reloadHint&&<Notice tone="neutral" role="status">Im CaseDesk ist ein Auftrag angefangen. Bitte vor dem Neuladen fertigstellen oder dort ausdrücklich verwerfen. Beim Abbrechen des Neuladens bleiben deine Eingaben geöffnet.</Notice>}
   <iframe onLoad={()=>{setDirty(false);setReloadSafe(false);setReloadHint(false);frame.current?.contentWindow?.postMessage({type:'heyelli:tool-state-request'},location.origin);}} key={data?.owner} ref={frame} src={tool.path} title="CaseDesk – mobile Ansicht" className={styles.frame}/>
  </section>}
 </div><AlertDialog dialogRef={reloadDialog} title="Auftrag im Werkzeug noch offen" description="Im CaseDesk gibt es ungesicherte Eingaben. Stelle den Auftrag fertig oder verwirf ihn dort ausdrücklich, bevor du HeyElli neu lädst. Der PlanBoard bleibt bedienbar." onCancel={event=>{event.preventDefault();reloadDialog.current?.close();button.current?.focus();}} actions={<button type="button" autoFocus data-primary="true" onClick={()=>{reloadDialog.current?.close();setOpen(true);button.current?.focus();}}>Zum angefangenen Auftrag</button>}/>
 </>;
}
