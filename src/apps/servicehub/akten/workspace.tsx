'use client';
import {Button} from '@/platform/ui';
import {EntitySummary} from './entity-summary';
import {CustomerOverview} from '@/apps/servicehub/kunde360/client';
import entityStyles from './entity-record.module.css';
import maintenanceStyles from './maintenance.module.css';
import {Chronicle} from './chronicle';
import {ServiceCockpit,orderWorklists} from './cockpit';
import {CockpitSearchResults} from './cockpit-search';
import {cockpitSearch,compareCockpitHits,matchesOrderSearch,serviceSearchTerms,type CockpitHit} from './cockpit-search-model';

import {OrderIncidentActions} from './order-incident';
import {AppointmentConfirmationDialog} from './confirmation-dialog';
import {DispatchPack} from './dispatch-pack';
import {maintenanceContext} from './maintenance-model';
import {MaintenanceAction,MaintenanceDetails,MaintenanceList,filterMaintenanceRows,maintenanceFilter} from './maintenance-workspace';
import {useMaintenance} from './use-maintenance';
import {customerWorkCounts} from './customer-work-counts';
import {SharePointDocuments} from '../../../platform/sharepoint/ui';
import {useEffect,useId,useRef,useState,useSyncExternalStore,type KeyboardEvent} from 'react';
import {useSearchParams} from 'next/navigation';
import {PlannerGlyph,GuardedLink,Notice,serviceFileTitle} from '@/platform/shell';
import type {Service} from '@/apps/servicehub/katalog';
import {berlinDay,belongsToObject,isOpenServiceOrder,matchesOrder,orderObjects,orderPreview,type ServiceOverview,type ServiceOrder} from './model';
import {useServiceFile} from './use-service-file';
import {FileToolbar,ServiceToolbar} from './file-toolbar';
import {SideGlyph} from './side-glyph';
import {ListCategories,ServiceListHeader} from './list-controls';
import {ServiceSearch} from './service-search';
import {FileActionIcon,objectActionIcon} from './file-action-icon';
import {ServiceEmptyState} from './empty-state';
import {CustomerCategories,CustomerFiles,ObjectFiles,type CustomerScope} from './customer-files';
import {customerObjectGroups,orderNavigationTargets,serviceFileNavigation} from './customer-hierarchy';
import {ExistingPlanningDialog} from './planning-dialog';
import type {ServiceIncident} from './model';
import {useCostSearch} from './use-cost-search';
import {useServiceVisibility} from './use-visibility';
import {useServiceFlags,useServicePins} from './use-pins';
import {OrderFilters,OrderFlagIcon,orderPlanningOptions} from './order-filters';
import {visibleServiceEntries} from './visibility-model';
import styles from './workspace.module.css';
const views=[['cockpit','Cockpit'],['orders','Aufträge'],['maintenance','Wartungen'],['files','Kunden & Objekte']] as const;
// Gewerk aus Anlagenname und Beschreibung (nur Darstellung, wie im Mockup farbige Symbole je Gewerk).
const disciplines:[RegExp,string,string,string,string][]=[[/heiz|kessel|warmwasser|therme|wärme/i,'heat','#ff7a59','#e2552f','M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3-1-3 0-6 1-8z'],[/brand|melde|bmz|rauch/i,'fire','#ff5e6c','#c8283a','M5 18h14M7 18V9a5 5 0 0 1 10 0v9M12 4V2M4 9H2M22 9h-2'],[/lüft|klima|kälte|filter/i,'air','#5ac8fa','#2b8fd6','M3 9h12a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h9'],[/beleucht|licht|notleucht/i,'light','#ffd060','#e0a100','M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 0 0-4-10z'],[/elektr|zähler|strom|schalt/i,'power','#b48cff','#7a4fe0','M13 2 4 14h7l-1 8 9-12h-7z'],[/hebe|pumpe|abwasser|wasser/i,'water','#64d2ff','#1f8fc4','M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z']];
function DisciplineIcon({name}:{name:string}){const found=disciplines.find(([pattern])=>pattern.test(name));const [,kind,from,to,path]=found??[/./,'unit','#8e9099','#5d5f68','M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 8h6M9 12h6M9 16h3'];return <span className={styles.rowIcon} data-discipline={kind} style={{background:`linear-gradient(${from},${to})`}} aria-hidden="true"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={path}/></svg></span>;}
// Kurzvorschau der Auftragsbeschreibung für die Listenzeile (wie Mail-Vorschau).
function workPreview(work:string){const marker='Störung/Auftragsbeschreibung:',start=work.indexOf(marker);return (start>=0?work.slice(start+marker.length).split('Ihre Auftragsnummer:')[0]:work).replace(/\s+/g,' ').trim();}
function date(value:string){return value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'Ohne Termin';}
const serviceQueryEvent='heyelli:service-query';
function readServiceQuery(){return new URLSearchParams(window.location.search).get('q')??'';}
function subscribeServiceQuery(change:()=>void){window.addEventListener('popstate',change);window.addEventListener(serviceQueryEvent,change);return()=>{window.removeEventListener('popstate',change);window.removeEventListener(serviceQueryEvent,change);};}
function narrowServiceWorkspace(){return window.matchMedia('(max-width: 900px)').matches;}
function findOrderRow(list:HTMLUListElement|null,id:string){
 return list?.querySelector<HTMLButtonElement>(`[data-order-row="${CSS.escape(id)}"]`);
}
function findFileRow(list:HTMLDivElement|null,key:string){
 return list?.querySelector<HTMLButtonElement>(`[data-file-row="${CSS.escape(key)}"]`);
}
function adjacentRow(list:HTMLElement|null,selector:string,row:HTMLButtonElement,key:'ArrowUp'|'ArrowDown'){
 const rows=Array.from(list?.querySelectorAll<HTMLButtonElement>(selector)??[]);
 return rows[rows.indexOf(row)+(key==='ArrowUp'?-1:1)];
}
function fileRowTarget(row:HTMLButtonElement){
 const key=row.dataset.fileRow??'';
 const separator=key.indexOf(':');
 return {key,kind:key.slice(0,separator),id:key.slice(separator+1)};
}
export function ServiceWorkspace({services}:{services:readonly Service[]}){
 const params=useSearchParams(),view=views.some(([id])=>id===params.get('ansicht'))?params.get('ansicht')!:'cockpit',kind=params.get('akte')??'',id=params.get('id')??'',key=kind+':'+id,filterOption=params.get('filter')??'all',statusOption=params.get('status')??'';
 const originOrderId=params.get('auftrag')??'';
 const filterPaused=params.get('filterPause')==='1',markedOption=params.get('markiert')==='1';
 const cockpitView=view==='cockpit',maintenanceView=view==='maintenance',fileListView=view==='files'||maintenanceView;
 const dueFilter=maintenanceFilter(params.get('faelligkeit'));
 const filter=filterPaused?'all':filterOption,status=filterPaused?'':statusOption,marked=markedOption&&!filterPaused;
 const query=useSyncExternalStore(subscribeServiceQuery,readServiceQuery,()=>params.get('q')??'');
 const visibility=useServiceVisibility(),showHidden=params.get('ausgeblendet')==='1',pins=useServicePins(),flags=useServiceFlags(),customerFilter=params.get('kunde')??'';
 const [collapsed,setCollapsed]=useState(()=>{try{return typeof window!=='undefined'&&localStorage.getItem('heyelli:service-seitenleiste')==='eingeklappt';}catch{return false;}}),[allOpen,setAllOpen]=useState(false);
 function toggleSidebar(){setCollapsed(value=>{const next=!value;try{localStorage.setItem('heyelli:service-seitenleiste',next?'eingeklappt':'offen');}catch{}return next;});}
 const [data,setData]=useState<ServiceOverview|null>(null),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
 const [planning,setPlanning]=useState<ServiceIncident|null>(null),[planningMessage,setPlanningMessage]=useState(''),[confirmation,setConfirmation]=useState<{orderId:string;incidentId:string;trigger:HTMLButtonElement}|null>(null);
 const orderRows=useRef<HTMLUListElement>(null),fileRows=useRef<HTMLDivElement>(null),toolbarSearch=useRef<HTMLDivElement>(null);
 const previewing=useRef(false),returnRow=useRef<string|null>(null);
 const detail=useRef<HTMLHeadingElement>(null),orderListHeading=useRef<HTMLParagraphElement>(null);
 const [customerScope,setCustomerScope]=useState<CustomerScope>('all');
 const [narrowSelection,setNarrowSelection]=useState('');
 const [narrowFileSelection,setNarrowFileSelection]=useState('');
 const orderKeyboardHelp=useId(),fileKeyboardHelp=useId();
 const maintenance=useMaintenance(data,fileListView||cockpitView);
 const selectedMaintenance=maintenanceView&&kind==='maintenance'?maintenance.rows.find(row=>row.id===id):undefined;
 const {current,error:currentError,extraError,extrasLoading,hasExtras}=useServiceFile(kind==='maintenance'?'':kind,id,refresh);
 const fileReady=Boolean(data&&(current||selectedMaintenance));
 const listPreview=fileListView||view==='orders'&&kind==='order';
 useEffect(()=>{
  if(!fileReady)return;
  const frame=requestAnimationFrame(()=>{
   if(listPreview&&previewing.current)return;
   const heading=detail.current;
   if(heading?.closest('main')?.querySelector('[data-slot="popover-content"][data-state="open"]'))return;
   if(!document.querySelector('dialog[open]'))heading?.focus({preventScroll:true});
  });
  return()=>cancelAnimationFrame(frame);
 },[key,fileReady,listPreview]);
 useEffect(()=>{
  if(kind||returnRow.current===null)return;
  const row=fileListView?findFileRow(fileRows.current,returnRow.current):findOrderRow(orderRows.current,returnRow.current);
  returnRow.current=null;
  (row??toolbarSearch.current?.querySelector<HTMLElement>('input, button'))?.focus();
 },[kind,fileListView]);
 useEffect(()=>{
  let active=true,controller:AbortController|undefined;
  async function load(){if(document.visibilityState==='hidden')return;controller?.abort();const current=new AbortController();controller=current;try{const response=await fetch('/api/service',{cache:'no-store',signal:AbortSignal.any([current.signal,AbortSignal.timeout(20000)])}),value=await response.json();if(!active||current.signal.aborted)return;if(!response.ok){if(response.status===401||response.status===403)setData(null);throw new Error(value.error);}setData(value);setError('');}catch(problem){if(active&&!current.signal.aborted)setError(problem instanceof Error&&!['TypeError','TimeoutError','AbortError'].includes(problem.name)?problem.message:'Service-Daten sind derzeit nicht erreichbar.');}}
  void load();const timer=setInterval(()=>void load(),60000),focus=()=>void load();window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);return()=>{active=false;controller?.abort();clearInterval(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};
 },[refresh]);
 function navigate(values:Record<string,string|null>,replace=false){const url=new URL(window.location.href);if('ansicht' in values){url.searchParams.delete('markiert');url.searchParams.delete('filterPause');url.searchParams.delete('faelligkeit');}if('akte' in values)url.searchParams.delete('auftrag');for(const [name,value]of Object.entries(values))if(value)url.searchParams.set(name,value);else url.searchParams.delete(name);window.history[replace?'replaceState':'pushState'](null,'',url.pathname+url.search);window.dispatchEvent(new Event(serviceQueryEvent));}
 function open(kind:string,id:string,originOrderId?:string){
  previewing.current=false;
  setNarrowSelection('');
  setNarrowFileSelection('');
  navigate({akte:kind,id,auftrag:originOrderId||null});
 }
 function closeFile(){
  returnRow.current=fileListView?key:view==='orders'&&kind==='order'?id:'';
  if(fileListView)setNarrowFileSelection(narrowServiceWorkspace()?key:'');
  if(view==='orders'&&kind==='order'){
   setNarrowSelection(narrowServiceWorkspace()?id:'');
  }
  navigate({akte:null,id:null});
 }
 function activateOrder(orderId:string){
  if(kind==='order'&&id===orderId){
   previewing.current=false;
   detail.current?.focus({preventScroll:true});
  }else open('order',orderId);
 }
 function previewOrder(row:HTMLButtonElement,browsing=false){
  const orderId=row.dataset.orderRow;
  if(!orderId)return;
  previewing.current=true;
  row.focus();
  const params=new URLSearchParams(window.location.search);
  const hasOrder=params.get('akte')==='order';
  if(!hasOrder||params.get('id')!==orderId)navigate({akte:'order',id:orderId},browsing&&hasOrder);
 }
 function moveOrder(row:HTMLButtonElement,key:'ArrowUp'|'ArrowDown',fromFile=false){
  const next=adjacentRow(orderRows.current,'[data-order-row]',row,key);
  const nextId=next?.dataset.orderRow;
  if(!nextId)return;
  if(!narrowServiceWorkspace()){
   previewOrder(next,true);
  }else if(fromFile){
   previewing.current=false;
   navigate({akte:'order',id:nextId},true);
  }else{
   next.focus();
   setNarrowSelection(nextId);
  }
 }
 function handleOrderKeys(event:KeyboardEvent<HTMLUListElement>){
  if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
  const target=event.target;
  if(!(target instanceof HTMLButtonElement)||!target.dataset.orderRow)return;
  if(event.key==='Enter'){
   event.preventDefault();
   activateOrder(target.dataset.orderRow);
   return;
  }
  if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;
  event.preventDefault();
  moveOrder(target,event.key);
 }
 function previewFileRow(row:HTMLButtonElement,browsing=false){
  const target=fileRowTarget(row);
  previewing.current=true;
  row.focus();
  const currentParams=new URLSearchParams(window.location.search);
  const currentKind=currentParams.get('akte'),currentId=currentParams.get('id');
  if(target.kind!==currentKind||target.id!==currentId){
   navigate({akte:target.kind,id:target.id},browsing&&Boolean(currentKind&&currentId));
  }
 }
 function openFileRow(targetKind:string,targetId:string){
  const row=findFileRow(fileRows.current,`${targetKind}:${targetId}`);
  if(row&&!narrowServiceWorkspace())previewFileRow(row);
  else open(targetKind,targetId);
 }
 function moveFileRow(row:HTMLButtonElement,direction:'ArrowUp'|'ArrowDown',fromFile=false){
  const next=adjacentRow(fileRows.current,'[data-file-row]',row,direction);
  if(!next)return;
  const target=fileRowTarget(next);
  if(!narrowServiceWorkspace())previewFileRow(next,true);
  else if(fromFile){
   previewing.current=false;
   navigate({akte:target.kind,id:target.id},true);
  }else{
   next.focus();
   setNarrowFileSelection(target.key);
  }
 }
 function handleFileListKeys(event:KeyboardEvent<HTMLDivElement>){
  if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
  const row=event.target;
  if(!(row instanceof HTMLButtonElement)||!row.dataset.fileRow)return;
  if(event.key==='Enter'){
   event.preventDefault();
   const target=fileRowTarget(row);
   if(target.key===key){
    previewing.current=false;
    detail.current?.focus({preventScroll:true});
   }else open(target.kind,target.id);
  }else if(event.key==='ArrowUp'||event.key==='ArrowDown'){
   event.preventDefault();
   moveFileRow(row,event.key);
  }
 }
 function handleFileKeys(event:KeyboardEvent<HTMLElement>){
  if(event.defaultPrevented||(view!=='orders'&&!fileListView))return;
  const target=event.target;
  if(!(target instanceof Element)||target.closest('dialog,[role="menu"],[role="listbox"],[role="combobox"],[aria-haspopup][aria-expanded="true"],input,textarea,select,[contenteditable="true"]')||document.querySelector('dialog[open]'))return;
  if(event.key==='ArrowUp'||event.key==='ArrowDown'){
   if(target!==detail.current||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
   if(fileListView){
    const row=findFileRow(fileRows.current,key);
    if(row){event.preventDefault();moveFileRow(row,event.key,true);}
   }else if(kind==='order'){
    const row=findOrderRow(orderRows.current,id);
    if(row){event.preventDefault();moveOrder(row,event.key,true);}
   }
   return;
  }
  if(event.key!=='Escape')return;
  event.preventDefault();
  previewing.current=true;
  const row=fileListView?findFileRow(fileRows.current,key):findOrderRow(orderRows.current,id);
  if(narrowServiceWorkspace()||(!row&&kind!=='order'))closeFile();
  else (row??toolbarSearch.current?.querySelector<HTMLElement>('input, button'))?.focus();
 }
 const terms=serviceSearchTerms(query),searchingService=cockpitView&&terms.length>0;
 const costSearch=useCostSearch(data,terms.length>0&&(cockpitView||view==='files'||view==='orders'));
 const customers=new Map(data?.customers.map(item=>[item.id,item])??[]),objects=(data?.objects??[]).map(object=>({...object,costSearch:costSearch.text[object.id]??'',searchCosts:costSearch.costs[object.id]??[]})),orders=data?.orders??[],today=berlinDay(new Date().toISOString());
 const objectsById=new Map(objects.map(item=>[item.id,item]));
 const flaggedOrders=new Set(flags.flagged),flaggedCount=orders.filter(order=>flaggedOrders.has(order.id)).length;
 const filtered=view==='orders'?orders.filter(order=>(!marked||flaggedOrders.has(order.id))&&matchesOrder(order,filter,today)&&
  (!status||order.status===status)&&(!customerFilter||order.customerId===customerFilter)&&matchesOrderSearch(order,objectsById,customers.get(order.customerId),terms)):[];

 // Kunden mit offenen Aufträgen (Seitenleiste „Offene Aufträge“), sortiert nach Anzahl, dann Name.
 const openOrders=orders.filter(isOpenServiceOrder);
 const maintenanceRows=maintenanceView&&data?filterMaintenanceRows(maintenance.rows,data,filterPaused?'all':dueFilter,today,query):[];
 const selectedMaintenancePlace=selectedMaintenance&&data?maintenanceContext(selectedMaintenance,data.objects,data.customers):undefined;
 const workCounts=view==='files'?customerWorkCounts(openOrders,maintenance.rows,objects,today):undefined;
 const openCounts=new Map<string,number>();for(const order of openOrders)if(order.customerId)openCounts.set(order.customerId,(openCounts.get(order.customerId)??0)+1);
 const openCustomers=[...openCounts.entries()].map(([customerId,count])=>({customer:customers.get(customerId),count})).filter(item=>item.customer).sort((a,b)=>b.count-a.count||a.customer!.name.localeCompare(b.customer!.name,'de'));
 const pinnedCustomers=pins.pinned.map(customerId=>customers.get(customerId)).filter(Boolean) as NonNullable<ReturnType<typeof customers.get>>[];
 const orderListEmpty=view==='orders'&&!filtered.length&&!costSearch.loading&&!costSearch.error&&(!marked||flags.ready);
 const noMarkedOrders=marked&&flaggedCount===0;
 const orderCriteria=Boolean(terms.length||customerFilter||filter!=='all'||status);
 const emptyOrderAction=noMarkedOrders||orderCriteria?{
  label:noMarkedOrders?'Alle Aufträge anzeigen':terms.length?'Suche und Filter zurücksetzen':'Filter zurücksetzen',
  onClick:()=>{
   navigate({filter:null,status:null,kunde:null,q:null,filterPause:null,...(noMarkedOrders?{markiert:null}:{})},true);
   orderListHeading.current?.focus({preventScroll:true});
  },
 }:undefined;
 const listTitle=customerFilter?customers.get(customerFilter)?.name||'Kunde':marked?'Markierte Aufträge':orderWorklists.find(list=>list.value===filter)?.label??'Alle Aufträge';
 const visible=visibleServiceEntries(data?.customers??[],objects,visibility.hidden);
 const cockpitGroups=searchingService&&data?cockpitSearch(query,orders,maintenance.rows,objectsById,customers,visibility.ready?visible:{customers:[],objects:[]}):[];
 const cockpitSuggestions=cockpitGroups.flatMap(group=>group.hits.slice(0,1)).sort(compareCockpitHits);
 const splitView=view==='orders'||fileListView;
 const customerGroups=view==='files'&&visibility.ready&&!showHidden
  ?customerObjectGroups(visible.customers,visible.objects,query)
    .filter(({customer})=>customerScope==='all'||customer&&(customerScope==='pinned'?pins.pinned.includes(customer.id):(openCounts.get(customer.id)??0)>0))
    .sort((left,right)=>left.customer&&right.customer?left.customer.name.localeCompare(right.customer.name,'de'):left.customer?-1:1)
  :[];
 const customerCount=customerGroups.filter(group=>group.customer).length;
 const fileSuggestions=terms.length?customerGroups.flatMap(({customer,objects})=>[
  ...(customer?[{id:customer.id,kind:'customer' as const,title:customer.name,description:customer.number,icon:'customer' as const}]:[]),
  ...objects.map(object=>({id:object.id,kind:'object' as const,title:object.name,
   description:serviceFileTitle('object',object.type),icon:objectActionIcon(object.type)})),
 ]).sort((left,right)=>Number(terms.every(term=>right.title.toLocaleLowerCase('de').includes(term)))-
   Number(terms.every(term=>left.title.toLocaleLowerCase('de').includes(term)))).slice(0,5):[];
 const selectedHidden=visibility.hidden.some(item=>item.kind===kind&&item.id===id);
 const selectedOrder=kind==='order'?orders.find(order=>order.id===id):undefined;
 const orderObjectIds=kind==='order'?[...new Set([...(selectedOrder?.incidents??[]),...(current?.incidents??[])].map(incident=>incident.objectId).filter(Boolean))]:[];
 const navigation=kind&&id?serviceFileNavigation(
  visible.customers,visible.objects,
  kind==='customer'?id:current?.customerId||selectedOrder?.customerId||selectedMaintenancePlace?.customer?.id||'',
  kind==='object'?[id]:selectedMaintenance?[selectedMaintenance.objectId]:orderObjectIds,
  kind==='object',
  orderObjectIds.length?orderNavigationTargets(objects,orderObjectIds):undefined,
 ):null;
 const hasDetail=Boolean(kind&&id&&(kind!=='maintenance'||maintenanceView));
 function setDueFilter(value:string){navigate({faelligkeit:value==='due'?null:value,filterPause:null},true);}
 const childObjects=visible.objects.filter(object=>object.parentId===id);
 const linkedOrders=current?orders.filter(order=>current.kind==='customer'?order.customerId===id:current.kind==='object'?belongsToObject(order,id,objects):order.id===id):[];
 function openCockpitEntry(kind:CockpitHit['kind'],entryId:string,listFilter?:string){
  previewing.current=false;
  setNarrowSelection('');
  setNarrowFileSelection('');
  const target=kind==='order'?'orders':kind==='maintenance'?'maintenance':'files';
  navigate({ansicht:target,filter:kind==='order'?listFilter??null:null,status:null,kunde:null,q:null,ausgeblendet:null,
   faelligkeit:kind==='maintenance'?listFilter??null:null,akte:kind,id:entryId});
 }
 function openCockpitHit(hit:CockpitHit){
  if(hit.kind==='customer'||hit.kind==='object')setCustomerScope('all');
  openCockpitEntry(hit.kind,hit.id,hit.kind==='maintenance'?'all':undefined);
 }
 function orderList(rows:ServiceOrder[],limit?:number,planning=filter){
  const navigable=view==='orders';
  return <ul ref={navigable?orderRows:undefined} className={`${styles.orderList} ${styles.browseOrders}`} aria-describedby={navigable?orderKeyboardHelp:undefined} onKeyDown={navigable?handleOrderKeys:undefined}>{rows.slice(0,limit).map(order=>{
  const preview=orderPreview(order,objects,planning,today),incident=preview.incident;
  const end=incident?.end&&Number.isFinite(Date.parse(incident.end))?(berlinDay(incident.start)===berlinDay(incident.end)?new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}).format(new Date(incident.end)):date(incident.end)):'';
  const selected=kind==='order'?id===order.id:navigable&&narrowSelection===order.id;
  return <li key={order.id}><Button variant="ghost" data-order-row={navigable?order.id:undefined} aria-pressed={selected} onClick={event=>{
   if(navigable&&!narrowServiceWorkspace())previewOrder(event.currentTarget);
   else if(cockpitView)openCockpitEntry('order',order.id,planning);
   else activateOrder(order.id);
  }}>
   <span className={styles.mailDot} data-on={!incident?.start||!incident?.technician||undefined} title={!incident?.start||!incident?.technician?'Braucht Planung':undefined}/>
   <DisciplineIcon name={[orderObjects(order,objects).map(item=>item.name).join(' '),order.title,incident?.work??''].join(' ')}/>
   <span className={styles.orderMain}>
    <span className={styles.rowTop}><strong>{pins.pinned.includes(order.customerId)&&<span className={styles.rowPin} title="Angeheftet"><SideGlyph name="pin"/></span>}{customers.get(order.customerId)?.name||'Kunde nicht verfügbar'}</strong><span title="Termin" data-missing={!incident?.start||undefined}>{date(incident?.start??'')}{incident?.start&&end?' – '+end:''}</span></span>
    <span className={styles.orderHeading}><strong>{order.number}</strong><span className={styles.orderDescription}>{preview.description}</span>{order.incidents.length>1&&<small className={styles.moreIncidents}>{order.incidents.length} Störungen</small>}</span>
    <span className={styles.rowPreview}>{(()=>{const text=workPreview(incident?.work??'');return text&&text!==preview.description?text:`${incident?.technician||'Kein Haupttechniker'} · ${preview.address||'Adresse nicht hinterlegt'}`;})()}</span>
   </span>{flaggedOrders.has(order.id)?<span className={styles.rowFlag} title="Markiert"><OrderFlagIcon/><span className="sr-only">Markiert</span></span>:<span className={styles.chevron} aria-hidden="true">›</span>}
  </Button></li>;
 })}</ul>;}

 const notices=<>
  {flags.error&&<Notice tone="error">{flags.error} <Button variant="outline" disabled={flags.busy} onClick={()=>void flags.reload()}>Erneut laden</Button></Notice>}
  {visibility.error&&<Notice tone="error">{visibility.error} <Button variant="outline" disabled={visibility.busy} onClick={()=>void visibility.reload()}>Erneut laden</Button></Notice>}
  {costSearch.loading&&<Notice tone="neutral">Kostenträger werden durchsucht · {costSearch.done} / {costSearch.total}</Notice>}
  {costSearch.error&&<Notice tone="error">{costSearch.error} <Button variant="outline" onClick={costSearch.retry}>Erneut versuchen</Button></Notice>}
  {planningMessage&&<Notice tone="neutral">{planningMessage}</Notice>}
  {error&&<Notice tone="error">{error} <Button variant="outline" onClick={()=>setRefresh(value=>value+1)}>Erneut versuchen</Button></Notice>}
 </>;
 const newOrder=<Button asChild variant="outline" size="icon" shape="capsule" className={`${styles.sideTool} ${styles.newOrderTool}`}>
  <GuardedLink href="/casedesk" aria-label="Neuer Auftrag im CaseDesk" title="Neuer Auftrag (CaseDesk)"><SideGlyph name="new"/></GuardedLink>
 </Button>;
 const linkedOrderRows=<>{linkedOrders.map(order=><Button variant="ghost" className={`${styles.related} ${styles.relatedOrder}`} key={order.id} onClick={()=>open('order',order.id)}><span className={styles.linkedOrder}><strong>{order.number}</strong><span>{orderPreview(order,objects,'all',today).description||order.status}</span></span><span aria-hidden="true">›</span></Button>)}{!linkedOrders.length&&<p className={styles.muted}>Keine Aufträge mit Störungen in der Übersicht.</p>}</>;
 return <main className={styles.workspace}>
  {/* Keine doppelten Überschriften: App-Name steht in der Menüleiste, der Bereich in der Seitenleiste. */}
  <h1 className="sr-only">Service · {views.find(([value])=>value===view)?.[1]}</h1>
  <aside className={`${styles.sidebar} ${collapsed?styles.collapsed:''}`}>
   <div className={styles.sideHead}><Button variant="outline" size="icon" className={styles.sideTool} aria-label={collapsed?'Seitenleiste einblenden':'Seitenleiste ausblenden'} title={collapsed?'Seitenleiste einblenden':'Seitenleiste ausblenden'} aria-expanded={!collapsed} onClick={toggleSidebar}><SideGlyph name="side"/></Button></div>
   <nav className={styles.tabs} aria-label="Serviceansichten">
    <h2 className={styles.sideHeading}>Arbeitslisten</h2>
    {([['cockpit','Cockpit','dash',null,null],['orders','Alle Aufträge','inbox','all',orders.length],['orders','Ohne Termin','alert','unplanned',orders.filter(order=>matchesOrder(order,'unplanned',today)).length],['orders','Ohne Haupttechniker','user','unassigned',orders.filter(order=>matchesOrder(order,'unassigned',today)).length],['orders','Heute geplant','cal','today',orders.filter(order=>matchesOrder(order,'today',today)).length],['maintenance','Fällige Wartungen','tool',null,null]] as const).map(([target,label,icon,list,count])=>{const active=view===target&&(target!=='orders'||(filter===list&&!customerFilter&&!marked));return <Button variant="ghost" key={label} aria-current={active?'page':undefined} title={label} onClick={()=>navigate({ansicht:target,filter:list&&list!=='all'?list:null,status:null,kunde:null,akte:null,id:null,ausgeblendet:null,...(target==='maintenance'||view==='maintenance'||cockpitView?{q:null}:{})})}><SideGlyph name={icon}/><span>{label}</span>{data&&count!==null&&count>0&&<small className={styles.count} aria-hidden="true">{count}</small>}</Button>;})}
    <Button variant="ghost" title="Markiert" aria-current={view==='orders'&&marked&&!customerFilter?'page':undefined} onClick={()=>navigate({ansicht:'orders',markiert:'1',filter:null,status:null,kunde:null,q:null,akte:null,id:null})}><OrderFlagIcon/><span>Markiert</span>{flags.ready&&flaggedCount>0&&<small className={styles.count} aria-hidden="true">{flaggedCount}</small>}</Button>
    {pinnedCustomers.length>0&&<><h2 className={styles.sideHeading}>Angeheftet <small>persönlich</small></h2>{pinnedCustomers.map(customer=><Button variant="ghost" key={customer.id} className={styles.customerItem} aria-current={view==='orders'&&customerFilter===customer.id?'page':undefined} title={customer.name} onClick={()=>navigate({ansicht:'orders',kunde:customer.id,filter:null,status:null,akte:null,id:null})}><span className={styles.pinMark}><SideGlyph name="pin"/></span><span className={styles.itemName}>{customer.name}</span>{(openCounts.get(customer.id)??0)>0&&<small className={styles.count} aria-hidden="true">{openCounts.get(customer.id)}</small>}</Button>)}</>}
    {openCustomers.length>0&&<><h2 className={styles.sideHeading}>Offene Aufträge <small>{openCustomers.length} {openCustomers.length===1?'Kunde':'Kunden'}</small></h2>{(allOpen?openCustomers:openCustomers.slice(0,5)).map(({customer,count})=><Button variant="ghost" key={customer!.id} className={styles.customerItem} aria-current={view==='orders'&&customerFilter===customer!.id?'page':undefined} title={customer!.name} onClick={()=>navigate({ansicht:'orders',kunde:customer!.id,filter:null,status:null,akte:null,id:null})}>{pins.pinned.includes(customer!.id)?<span className={styles.pinMark} title="Angeheftet"><SideGlyph name="pin"/></span>:<SideGlyph name="house"/>}<span className={styles.itemName}>{customer!.name}</span><small className={styles.count} aria-hidden="true">{count}</small></Button>)}{openCustomers.length>5&&<Button variant="ghost" className={styles.moreItem} aria-expanded={allOpen} onClick={()=>setAllOpen(value=>!value)}>{allOpen?'Weniger anzeigen':`${openCustomers.length-5} weitere …`}</Button>}</>}
    <Button variant="ghost" className={styles.allItem} aria-current={view==='files'?'page':undefined} title="Alle Kunden" onClick={()=>navigate({ansicht:'files',kunde:null,akte:null,id:null,ausgeblendet:null,q:null})}><SideGlyph name="people"/><span>Alle Kunden …</span>{data&&data.customers.length>0&&<small className={styles.count} aria-hidden="true">{data.customers.length}</small>}</Button>
   </nav>
   <nav className={styles.planners} aria-label="Verwandte Apps"><h2 className={styles.sideHeading}>Verwandte Apps</h2>{services.map(service=><GuardedLink key={service.id} href={service.href??'/servicehub'} className={styles.planner} aria-label={`${service.name} öffnen`}><span data-app={service.slug} aria-hidden="true"><PlannerGlyph icon={service.slug==='stoerungsaufnahme'?'incident':service.slug==='ressourcenkalender'?'resource':'duty'}/></span><span className={styles.fullName}>{service.name}</span><span className={styles.shortName}>{service.slug==='stoerungsaufnahme'?'Störung':service.slug==='ressourcenkalender'?'Ressourcen':'Bereitschaft'}</span></GuardedLink>)}</nav>
  </aside>
  <div className={`${styles.content} ${cockpitView?styles.cockpitContent:''}`}>
  {cockpitView&&<ServiceToolbar label="Cockpit-Werkzeugleiste" className={styles.cockpitToolbar} newOrder={newOrder}
   search={<ServiceSearch rootRef={toolbarSearch} label="Service durchsuchen" selectFirstOnEnter value={query}
    suggestions={cockpitSuggestions} onChange={value=>navigate({q:value},true)} onSelect={openCockpitHit}/>}/>}
  {cockpitView?<div className={styles.cockpitNotices}>{notices}</div>:(!data||!splitView)&&notices}
  {planning&&<ExistingPlanningDialog orderId={id} incident={planning} onClose={()=>setPlanning(null)} onSaved={warning=>{setPlanning(null);setRefresh(value=>value+1);setPlanningMessage(warning||'Termin gespeichert.');}}/>}
  {!cockpitView&&(!data||(!splitView&&!navigation))&&<div className={styles.standaloneFileToolbar}>{newOrder}</div>}
  {data&&<div className={`${styles.layout} ${splitView?styles.split:''} ${view==='files'?styles.customerLayout:''} ${hasDetail?styles.hasDetail:''}`}>
   <section className={styles.primary} aria-label="Serviceübersicht">
    {cockpitView?searchingService?<CockpitSearchResults query={query} groups={cockpitGroups}
     pending={costSearch.loading||maintenance.loading||!visibility.ready&&!visibility.error}
     incomplete={Boolean(error||costSearch.error||maintenance.error||visibility.error)}
     maintenanceLoading={maintenance.loading} maintenanceError={Boolean(maintenance.error)}
     onRetry={maintenance.reload} onOpen={openCockpitHit}/>:
     <ServiceCockpit data={data} objects={objects} maintenance={maintenance} today={today}
      renderOrderRows={(rows,planning)=>orderList(rows,6,planning)} onOpenMaintenance={id=>openCockpitEntry('maintenance',id)}/>:
    view==='orders'?<>
     <ServiceListHeader title={listTitle} titleRef={orderListHeading} summary={`${filtered.length} ${filtered.length===1?'Auftrag':'Aufträge'}${filtered.length?' · '+filtered.filter(order=>matchesOrder(order,'unplanned',today)).length+' ohne Termin':''}${status?' · '+status:''}${filterPaused?' · Filter pausiert':''}`}
      tools={<OrderFilters filter={filterOption} status={statusOption} marked={markedOption} paused={filterPaused} statuses={[...new Set(orders.map(order=>order.status).filter(Boolean))].sort()}
       onChange={values=>navigate({...values,filterPause:null},true)} onToggle={paused=>navigate({filterPause:paused?'1':null},true)}/>}>
      <ListCategories label="Auftragskategorien" options={orderPlanningOptions} value={filter}
       onChange={value=>navigate({filter:value==='all'?null:value,filterPause:null})}/>
     </ServiceListHeader>
     <p id={orderKeyboardHelp} className="sr-only">Mit Pfeil nach oben oder unten den Auftrag wechseln. Enter öffnet die Akte, Escape kehrt zur Liste zurück.</p>
     {orderList(filtered)}
     {marked&&!flags.ready?<p className={styles.empty} role="status">{flags.error?'Markierungen derzeit nicht verfügbar.':'Markierungen werden geladen …'}</p>:
      orderListEmpty&&<ServiceEmptyState icon={marked?<OrderFlagIcon/>:<SideGlyph name="inbox"/>}
       title={noMarkedOrders?'Keine markierten Aufträge':marked?'Keine passenden markierten Aufträge.':'Keine passenden Aufträge.'}
       detail={noMarkedOrders?'Markiere Aufträge über die Fahne in der Auftragsakte.':undefined} action={emptyOrderAction}/>}
    </>:
    maintenanceView?<MaintenanceList data={data} maintenance={maintenance} rows={maintenanceRows} today={today} filter={dueFilter} paused={filterPaused}
     selectedKey={kind&&id?key:narrowFileSelection} listRef={fileRows} keyboardHelp={fileKeyboardHelp}
     onKeyDown={handleFileListKeys} onOpen={openFileRow} onFilter={setDueFilter} onToggle={paused=>navigate({filterPause:paused?'1':null},true)}/>:<>
     <header className={styles.splitListHeader}>
      <div className={styles.listHead}>
       <div className={styles.orderListTitle}>
        <p className={styles.listTitle}>{showHidden?'Ausgeblendete Einträge':'Alle Kunden'}</p>
        <small>{showHidden?`${visibility.hidden.length} ausgeblendet`:
         `${customerCount} ${customerCount===1?'Kunde':'Kunden'} · ${pins.pinned.length} angeheftet`}</small>
       </div>
       <Button variant="outline" size="icon" shape="capsule" className={styles.visibilityToggle}
        aria-label={'Ausgeblendete Einträge'+(visibility.hidden.length?' · '+visibility.hidden.length:'')}
        title={showHidden?'Zur normalen Übersicht':'Ausgeblendete Einträge anzeigen'} aria-pressed={showHidden}
        onClick={()=>navigate({ausgeblendet:showHidden?null:'1',akte:null,id:null})}><FileActionIcon icon="show"/></Button>
      </div>
      {!showHidden&&<CustomerCategories scope={customerScope} onChange={setCustomerScope}/>}
     </header>
     {!visibility.ready?<p role="status">{visibility.error?'Gespeicherte Ansicht nicht verfügbar.':'Gespeicherte Ansicht wird geladen …'}</p>:showHidden?<><ul className={styles.hiddenEntries}>{visibility.hidden.filter(item=>{const entry=item.kind==='customer'?data.customers.find(row=>row.id===item.id):objects.find(row=>row.id===item.id);return !query.trim()||[entry?.name,item.id,item.kind==='object'?objects.find(row=>row.id===item.id)?.costSearch:''].join(' ').toLocaleLowerCase('de').includes(query.trim().toLocaleLowerCase('de'));}).map(item=>{const entry=item.kind==='customer'?data.customers.find(row=>row.id===item.id):objects.find(row=>row.id===item.id);return <li key={item.kind+':'+item.id}><span><strong>{entry?.name||'Eintrag derzeit nicht verfügbar'}</strong><small>{serviceFileTitle(item.kind,item.kind==='object'?objects.find(row=>row.id===item.id)?.type:undefined)}{!entry?' · '+item.id:''}</small></span><Button variant="outline" disabled={visibility.busy} aria-label={`${entry?.name||item.id} wieder einblenden`} onClick={()=>void visibility.change(item.kind,item.id,false)}>Einblenden</Button></li>;})}</ul>{!visibility.hidden.length&&<ServiceEmptyState icon={<FileActionIcon icon="hide"/>} title="Keine ausgeblendeten Einträge."/>}<p className={styles.footnote}>Persönliche Ansicht. Bei ausgeblendeten Kunden und Objekten werden auch die untergeordneten Einträge verborgen. Aufträge bleiben sichtbar.</p></>:<>
      <p id={fileKeyboardHelp} className="sr-only">Mit Pfeil nach oben oder unten die Zeile wechseln. Enter öffnet die Akte, Escape führt zur gewählten Zeile zurück.</p>
      <CustomerFiles groups={customerGroups} searching={costSearch.loading||!!costSearch.error} query={query}
       selectedKey={kind&&id?key:narrowFileSelection} onOpen={openFileRow} workCounts={workCounts}
       listRef={fileRows} onKeyDown={handleFileListKeys} keyboardHelp={fileKeyboardHelp}/>
     </>}
    </>}
   </section>
   {(navigation||splitView)&&<aside className={`${styles.detail} ${selectedMaintenance||current&&current.kind!=='order'?entityStyles.entity:''}`}
    data-awaiting-selection={splitView&&!kind||undefined}
    aria-label={kind==='maintenance'&&maintenanceView?'Wartungsakte':navigation?'Akte':maintenanceView?'Wartungswerkzeuge':view==='files'?'Kunden und Objekte':'Auftragssuche'} onKeyDown={handleFileKeys}>
    <FileToolbar file={current} navigation={navigation} newOrder={cockpitView?undefined:newOrder} kind={kind} id={id} originOrderId={originOrderId}
     search={view==='orders'?<ServiceSearch key={view} rootRef={toolbarSearch} value={query}
      suggestions={query.trim()?filtered.slice(0,5).map(order=>({id:order.id,title:order.number||'Serviceauftrag',
       description:order.title||customers.get(order.customerId)?.name||'',icon:'order' as const})):[]}
      onChange={value=>navigate({q:value},true)} onSelect={order=>activateOrder(order.id)}/>:
      view==='files'?<ServiceSearch key={view} rootRef={toolbarSearch} value={query} suggestions={fileSuggestions}
       onChange={value=>navigate({q:value},true)} onSelect={entry=>open(entry.kind,entry.id)}/>:
      maintenanceView?<ServiceSearch key={view} rootRef={toolbarSearch} value={query}
       suggestions={query.trim()?maintenanceRows.slice(0,5).map(row=>{
        const place=maintenanceContext(row,data.objects,data.customers);
        return {id:row.id,title:row.title,description:[place.unit?.name,place.customer?.name].filter(Boolean).join(' · '),icon:'unit' as const};
       }):[]} onChange={value=>navigate({q:value},true)} onSelect={row=>open('maintenance',row.id)}/>:undefined}
     maintenanceLink={selectedMaintenance?.webLink}
     maintenanceActions={selectedMaintenance&&<MaintenanceAction key={id} row={selectedMaintenance} data={data} today={today}
      onSaved={orderId=>{maintenance.reload();open('order',orderId);}}/>}
     flagged={flaggedOrders.has(id)} flagBusy={!flags.ready||flags.busy} onFlag={()=>void flags.change(id,!flaggedOrders.has(id))}
     orderActions={current?.incidents?.map(incident=><OrderIncidentActions key={incident.id} orderId={id} incident={incident} data={data}
      onPlan={setPlanning} onConfirm={(incidentId,trigger)=>setConfirmation({orderId:id,incidentId,trigger})}/>)}
     hidden={selectedHidden} busy={!visibility.ready||visibility.busy} onVisibility={()=>void visibility.change(kind==='customer'?'customer':'object',id,!selectedHidden)}
     onOpen={(nextKind,nextId)=>open(nextKind,nextId,nextKind==='order'?undefined:kind==='order'?id:originOrderId)} onChanged={()=>setRefresh(value=>value+1)} pinned={pins.pinned.includes(id)} pinBusy={!pins.ready||pins.busy} onPin={()=>void pins.change(id,!pins.pinned.includes(id))}/>
    {splitView&&notices}
    {view==='files'&&!showHidden&&maintenance.error&&<Notice tone="error">Wartungsmarkierungen sind unvollständig. <Button variant="outline" onClick={maintenance.reload}>Erneut laden</Button></Notice>}
    {view==='files'&&!showHidden&&maintenance.loading&&<p role="status" className="sr-only">Wartungsmarkierungen werden geladen · {maintenance.done} / {maintenance.total}</p>}
    {maintenanceView&&hasDetail&&<Button variant="outline" shape="capsule" className={maintenanceStyles.back}
     data-mobile={kind!=='maintenance'||selectedMaintenance?true:undefined} onClick={closeFile}>‹ Zurück zu Wartungen</Button>}
    {maintenanceView&&kind==='maintenance'?(selectedMaintenance?<MaintenanceDetails row={selectedMaintenance} data={data} today={today}
     refresh={refresh} headingRef={detail}/>:<p role="status">{maintenance.error?'Wartung konnte nicht geladen werden.':maintenance.loading?'Wartung wird geladen …':'Wartung nicht mehr verfügbar.'}</p>):!navigation?<div className={styles.panePlaceholder}>
      <ServiceEmptyState appearance="detail" icon={maintenanceView?<SideGlyph name="cal"/>:<FileActionIcon icon={view==='files'?'object':'order'}/>}
       title={maintenanceView?'Wartung auswählen':view==='files'?'Kunde oder Objekt auswählen':orderListEmpty?'Keine Auftragsakte geöffnet':'Auftrag auswählen'}
       detail={orderListEmpty?undefined:'Mit den Pfeiltasten wählen und mit Enter öffnen.'}/>
     </div>:currentError&&!current?<Notice tone="error">{currentError} <Button variant="outline" onClick={()=>setRefresh(value=>value+1)}>Erneut versuchen</Button></Notice>:!current?<p role="status">Akte wird geladen …</p>:<>{current.kind==='order'&&confirmation?.orderId===id&&<AppointmentConfirmationDialog key={key+confirmation.incidentId} orderId={id} incidentId={confirmation.incidentId} sourceRevision={current.sourceRevision??''} trigger={confirmation.trigger} onClose={()=>setConfirmation(null)}/>}{currentError&&<Notice tone="error">{currentError} Der letzte geladene Stand bleibt sichtbar.</Notice>}{extraError&&<Notice tone="error">{extraError} <Button variant="outline" onClick={()=>setRefresh(value=>value+1)}>Erneut versuchen</Button></Notice>}{extrasLoading&&!hasExtras&&<Notice tone="neutral">Zusatzdaten werden im Hintergrund geladen …</Notice>}{current.extraNotice&&<Notice tone="neutral">{current.extraNotice}</Notice>}{current.kind==='order'?(()=>{const first=current.incidents?.[0],place=maintenanceContext({objectId:first?.objectId??''},data.objects,data.customers),customerName=customers.get(current.customerId??'')?.name||'Kunde nicht verfügbar',units=[...new Set((current.incidents??[]).map(item=>data.objects.find(object=>object.id===item.objectId)?.name).filter(Boolean))],count=current.incidents?.length??0;
  // Mailkopf nach Mockup d1: Kunde fett, darunter Nummer · Titel, Objekt und Techniker mit Status.
  return <><p className={styles.orderMetaLine}>{count} {count===1?'Einsatz':'Einsätze'}{units.length?' · '+units.join(', '):''}</p><header className={styles.mailHead}><span className={styles.mailAvatar} aria-hidden="true">{customerName.replace(/[^\p{L}\s]/gu,' ').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()}</span><div className={styles.mailHeadText}><strong className={styles.mailCustomer}>{customerName}</strong><div className={styles.mailSubject}><h2 ref={detail} tabIndex={-1}>{current.number||'Serviceauftrag'}</h2>{current.name&&current.name!==current.number&&<span> · {current.name}</span>}</div><p className={styles.mailLine}><span>Objekt:</span> {place.address||'Adresse nicht hinterlegt'}{place.unit?' · '+place.unit.name:place.object?' · '+place.object.name:''}</p><p className={styles.mailLine}><span>Techniker:</span> <b data-missing={!first?.technician||undefined}>{first?.technician||'nicht zugeordnet'}</b>{current.status&&<span className={styles.mailStatus}>{current.status}</span>}</p></div></header></>;})():<header className={styles.mailHead}><span className={styles.mailAvatar} data-kind={current.kind} aria-hidden="true">{current.kind==='customer'?current.name.replace(/[^\p{L}\s]/gu,' ').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase():<FileActionIcon icon={objectActionIcon(current.objectType)}/>}</span><div className={styles.mailHeadText}><h2 ref={detail} tabIndex={-1} className={styles.mailTitle}>{current.name}</h2><p className={styles.mailLine}><span className={styles.mailKind}>{serviceFileTitle(current.kind,current.objectType)}</span>{current.number?' · '+current.number:''}{current.status&&<span className={styles.mailStatus}>{current.status}</span>}</p></div></header>}{current.kind!=='order'&&<EntitySummary file={current} objects={objects} customers={data.customers} extrasLoading={extrasLoading} hasExtras={hasExtras} extraError={extraError}/>}{current.kind==='customer'&&<CustomerOverview key={'360:'+id} customerId={id}/>} {current.kind==='object'&&current.objectType==='TECHNISCHE_EINHEIT'&&<Chronicle key={'chronicle:'+id+':'+current.sourceRevision} id={id} revision={current.sourceRevision??''} onOpen={open}/>} {current.kind==='order'&&<DispatchPack key={'pack:'+key+':'+current.sourceRevision} file={current} orderId={id} data={data}/>}{current.kind==='order'&&<>{current.contacts&&<><h3>Ansprechpartner</h3>{current.contacts.length?current.contacts.map((contact,index)=><div className={styles.info} key={index}><strong>{contact.name}</strong>{contact.phones.map(phone=><a key={phone} href={'tel:'+phone.replace(/[^+\d]/g,'')}>{phone}</a>)}</div>):<p className={styles.muted}>Keine Ansprechpartner hinterlegt.</p>}</>}{!!current.fields?.length&&<dl className={styles.fileFacts}>{current.fields.map((field,index)=><div key={index}><dt>{field.name}</dt><dd>{field.value}</dd></div>)}</dl>}</>}{current.kind!=='order'&&current.incidents?.map(incident=><section className={styles.incident} key={incident.id}><h3>{objects.find(object=>object.id===incident.objectId)?.name||'Störung'}</h3><p>{incident.work||'Keine Beschreibung hinterlegt.'}</p><dl>{incident.status&&incident.status!==current.status&&<div><dt>Status der Störung</dt><dd>{incident.status}</dd></div>}<div><dt>Beginn</dt><dd>{date(incident.start)}</dd></div><div><dt>Ende</dt><dd>{incident.end?date(incident.end):'Nicht hinterlegt'}</dd></div><div><dt>Haupttechniker</dt><dd>{incident.technician||'Nicht zugeordnet'}</dd></div>{incident.companions.length>0&&<div><dt>Begleiter</dt><dd>{incident.companions.join(', ')}</dd></div>}</dl>{data.canPlan&&(!incident.start||!incident.technician)&&<Button className={`${styles.related} ${styles.planAction}`} onClick={()=>setPlanning(incident)}>Termin vergeben ›</Button>}</section>)}{current.kind==='customer'&&<details className={styles.fileGroup}><summary>Objekte & technische Einheiten</summary><ObjectFiles objects={customerObjectGroups(visible.customers,visible.objects).find(group=>group.customer?.id===id)?.objects??[]} selectedId={id} onOpen={open} siteCounts={workCounts?.sites}/></details>}{current.kind==='object'&&<>{current.bmaNotice&&<Notice tone="neutral">{current.bmaNotice}</Notice>}<section className={entityStyles.group} aria-label="Wartungsverträge"><h3>Wartungsverträge</h3>{extrasLoading&&!hasExtras?<p className={styles.muted}>Verträge werden geladen …</p>:extraError&&!hasExtras?<p className={styles.muted}>Verträge derzeit nicht verfügbar.</p>:current.contractError?<Notice tone="error">{current.contractError}</Notice>:current.contracts?.length?current.contracts.map(contract=><div className={`${styles.contract} ${entityStyles.contract}`} key={contract.id}><strong>{contract.name}</strong>{contract.description&&contract.description!==contract.name&&<span>{contract.description}</span>}<dl><div><dt>Kostenträger Wartung</dt><dd>{contract.maintenanceCostCarrier?[contract.maintenanceCostCarrier.number,contract.maintenanceCostCarrier.name].filter(Boolean).join(' · '):'Nicht zugeordnet'}</dd></div><div><dt>Kostenträger Rechnung</dt><dd>{contract.billingCostCarrier?[contract.billingCostCarrier.number,contract.billingCostCarrier.name].filter(Boolean).join(' · '):'Nicht zugeordnet'}</dd></div></dl><SharePointDocuments key={'sp-contract:'+contract.id} kind="object" id={id} contractId={contract.id} canWrite={data.canUploadDocuments??false} collapsible/>{contract.bma&&<div className={styles.bmaLinks}>{contract.bma.error?<Notice tone="error">{contract.bma.error}</Notice>:!contract.bma.links.length?<small>Keine BMACloud-Anlage zur Wartungskostenträgernummer gefunden.</small>:<>{contract.bma.links.length>1&&<small>Mehrere BMACloud-Anlagen mit dieser Nummer. Bitte das passende BMACloud-Symbol oben wählen.</small>}</>}</div>}</div>):<p className={styles.muted}>Keine Wartungsverträge hinterlegt.</p>}</section><>{childObjects.length>0&&<details className={styles.fileGroup}><summary>Technische Einheiten · {childObjects.length}</summary>{childObjects.map(object=><Button variant="ghost" className={styles.related} key={object.id} onClick={()=>open('object',object.id)}><span className={styles.relatedTarget}><FileActionIcon icon={objectActionIcon(object.type)}/>{object.name}<span aria-hidden="true">›</span></span></Button>)}</details>}</></>}<SharePointDocuments key={'sp:'+key} kind={current.kind} id={id} canWrite={data.canUploadDocuments??false} collapsible={current.kind==='order'||current.objectType==='TECHNISCHE_EINHEIT'}/>{current.kind!=='order'&&<>{current.objectType==='TECHNISCHE_EINHEIT'?<details className={styles.fileGroup}><summary>Zugehörige Aufträge · {linkedOrders.length}</summary>{linkedOrderRows}</details>:<section className={entityStyles.group} aria-label="Zugehörige Aufträge"><h3>Zugehörige Aufträge · {linkedOrders.length}</h3><div className={entityStyles.orders}>{linkedOrderRows}</div></section>}</>}</> }</aside>}
  </div>}
  </div>
 </main>;
}
