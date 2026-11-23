'use client';

import {useState,type KeyboardEvent,type Ref} from 'react';
import {Button} from '@/platform/ui';
import {Notice,PopUpButton} from '@/platform/shell';
import {ServiceEmptyState} from './empty-state';
import {SideGlyph} from './side-glyph';
import {EntitySummary} from './entity-summary';
import entityStyles from './entity-record.module.css';
import {FileActionIcon,objectActionIcon} from './file-action-icon';
import {FilterCapsule,ListCategories,ServiceListHeader} from './list-controls';
import type {ServiceOverview} from './model';
import type {useMaintenance} from './use-maintenance';
import {isDueMaintenance,maintenanceContext,maintenanceState,matchesMaintenance,type MaintenanceRow} from './maintenance-model';
import {MaintenancePreview} from './maintenance-preview';
import {useServiceFile} from './use-service-file';
import styles from './workspace.module.css';
import maintenanceStyles from './maintenance.module.css';

const states={overdue:'Überfällig',today:'Heute fällig',future:'Bevorstehend',unknown:'Fälligkeit prüfen',inactive:'Vertrag nicht aktiv'};
const categories=[
 {value:'due',label:'Fällig',icon:'cal'},
 {value:'overdue',label:'Überfällig',icon:'alert'},
 {value:'future',label:'Bevorstehend',icon:'clock'},
 {value:'unknown',label:'Prüfen',icon:'tool'},
 {value:'all',label:'Alle',icon:'inbox'},
];
const filterOptions=[
 {value:'due',label:'Fällig bis heute'},
 {value:'overdue',label:'Überfällig'},
 {value:'future',label:'Bevorstehend'},
 {value:'unknown',label:'Ohne gültige Fälligkeit'},
 {value:'all',label:'Alle Wartungen',separatorBefore:true},
];
const headings:Record<string,string>={due:'Fällige Wartungen',overdue:'Überfällige Wartungen',future:'Bevorstehende Wartungen',unknown:'Fälligkeit prüfen',all:'Alle Wartungen'};
const dateFormat=new Intl.DateTimeFormat('de-DE',{timeZone:'UTC',dateStyle:'medium'});
function date(value:string){return value?dateFormat.format(new Date(value+'T12:00:00Z')):'Nicht hinterlegt';}

export function maintenanceFilter(value:string|null){
 return filterOptions.find(option=>option.value===value)?.value??'due';
}

export function filterMaintenanceRows(rows:MaintenanceRow[],data:ServiceOverview,filter:string,today:string,query:string){
 const searching=Boolean(query.trim());
 return rows.filter(row=>(filter==='all'||(filter==='due'?isDueMaintenance(row,today):filter===maintenanceState(row,today)))&&
  (!searching||matchesMaintenance(row,data.objects,data.customers,query)))
  .sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||a.title.localeCompare(b.title,'de'));
}

export function MaintenanceList({data,maintenance,rows,today,filter,paused,selectedKey,listRef,keyboardHelp,onKeyDown,onFilter,onToggle,onOpen}:{
 data:ServiceOverview;maintenance:ReturnType<typeof useMaintenance>;rows:MaintenanceRow[];today:string;filter:string;paused:boolean;selectedKey:string;
 listRef:Ref<HTMLDivElement>;keyboardHelp:string;onKeyDown:(event:KeyboardEvent<HTMLDivElement>)=>void;
 onFilter:(value:string)=>void;onToggle:(paused:boolean)=>void;onOpen:(kind:string,id:string)=>void;
}){
 const effectiveFilter=paused?'all':filter;
 const unknown=maintenance.rows.filter(row=>maintenanceState(row,today)==='unknown').length;
 return <>
  <ServiceListHeader title={headings[effectiveFilter]} summary={<span role="status">
   {rows.length} {rows.length===1?'Wartung':'Wartungen'}{maintenance.loading||maintenance.error?' · unvollständig':''}{paused?' · Filter pausiert':''}
  </span>} tools={<FilterCapsule label="Wartungsfilter" configured={filter!=='all'} paused={paused} onToggle={onToggle}>{close=>
   <div><span>Fälligkeit</span><PopUpButton label="Fälligkeit" value={filter} options={filterOptions} align="right"
    onChange={value=>{onFilter(value);close();}}/></div>
  }</FilterCapsule>}>
   <ListCategories label="Wartungskategorien" options={categories} value={effectiveFilter} onChange={onFilter}/>
  </ServiceListHeader>
  {maintenance.loading&&<div className={maintenanceStyles.notice}><Notice tone="neutral">Wartungen werden geladen · {maintenance.done} / {maintenance.total}</Notice></div>}
  {maintenance.error&&<div className={maintenanceStyles.notice}><Notice tone="error">{maintenance.error} <Button variant="outline" onClick={maintenance.reload}>Erneut laden</Button></Notice></div>}
  {unknown>0&&effectiveFilter!=='unknown'&&<Notice as="div" tone="neutral" className={maintenanceStyles.reviewNotice}>
   <span>{unknown} ohne eindeutige Fälligkeit</span>
   <Button variant="outline" shape="capsule" onClick={()=>onFilter('unknown')}>Prüfen</Button>
  </Notice>}
  <p id={keyboardHelp} className="sr-only">Mit Pfeil nach oben oder unten die Wartung wechseln. Enter öffnet die Details, Escape führt zur gewählten Zeile zurück.</p>
  <div ref={listRef} onKeyDown={onKeyDown}>
   <MaintenanceRows data={data} rows={rows} today={today} selectedKey={selectedKey} keyboardHelp={keyboardHelp} onOpen={id=>onOpen('maintenance',id)}/>
  </div>
  {!rows.length&&!maintenance.loading&&!maintenance.error&&<ServiceEmptyState icon={<SideGlyph name="cal"/>} title="Keine passenden Wartungen."/>}
 </>;
}

export function MaintenanceRows({data,rows,today,selectedKey,keyboardHelp,onOpen}:{
 data:ServiceOverview;rows:MaintenanceRow[];today:string;selectedKey?:string;keyboardHelp?:string;onOpen:(id:string)=>void;
}){
 return <ul className={`${styles.orderList} ${styles.browseOrders}`} aria-describedby={keyboardHelp}>
    {rows.map(row=>{
     const {customer,object,unit}=maintenanceContext(row,data.objects,data.customers);
     const state=maintenanceState(row,today),attention=state==='today'||state==='overdue'||state==='unknown';
     return <li key={row.id}><Button variant="ghost" data-file-row={keyboardHelp?'maintenance:'+row.id:undefined} aria-pressed={selectedKey===undefined?undefined:selectedKey==='maintenance:'+row.id}
      onClick={()=>onOpen(row.id)}>
      <span className={styles.mailDot} data-on={attention||undefined} aria-hidden="true"/>
      <span className={`${styles.rowIcon} ${maintenanceStyles.rowIcon}`} aria-hidden="true"><FileActionIcon icon={objectActionIcon(unit?.type)}/></span>
      <span className={styles.orderMain}>
       <span className={styles.rowTop}><strong>{unit?.name||object?.name||'Nicht zugeordnet'}</strong>
        <span data-missing={attention||undefined}>{row.due?date(row.due):'Ohne Fälligkeit'}</span></span>
       <span className={styles.orderDescription}>{row.title}</span>
       <span className={styles.rowPreview}>{[states[state],customer?.name,object&&unit?object.name:''].filter(Boolean).join(' · ')}</span>
      </span>
      <span className={styles.chevron} aria-hidden="true">›</span>
     </Button></li>;
    })}
   </ul>;
}

export function MaintenanceAction({row,data,today,onSaved}:{row:MaintenanceRow;data:ServiceOverview;today:string;onSaved:(orderId:string)=>void}){
 const [trigger,setTrigger]=useState<HTMLButtonElement|null>(null);
 const {customer}=maintenanceContext(row,data.objects,data.customers);
 const inactive=maintenanceState(row,today)==='inactive';
 const disabled=!data.canPrepareMaintenance||!!row.issue||inactive||!customer;
 const title=!data.canPrepareMaintenance?'Service-Schreibrecht erforderlich.':row.issue?'Fälligkeit zuerst prüfen.':
  inactive?'Vertrag nicht aktiv.':!customer?'Kunde nicht zugeordnet.':'Auftrag vorbereiten';
 return <>
  <div className={styles.externalFileActions}>
   <Button variant="outline" size="icon" className={styles.iconAction} disabled={disabled} aria-label="Auftrag erzeugen" title={title}
    onClick={event=>setTrigger(event.currentTarget)}><FileActionIcon icon="order"/></Button>
  </div>
  {trigger&&<MaintenancePreview row={row} returnFocus={trigger} data={data} onClose={()=>setTrigger(null)} onSaved={onSaved}/>}
 </>;
}

export function MaintenanceDetails({row,data,today,refresh,headingRef}:{
 row:MaintenanceRow;data:ServiceOverview;today:string;refresh:number;headingRef:Ref<HTMLHeadingElement>;
}){
 const {customer,object,unit,address}=maintenanceContext(row,data.objects,data.customers);
 const state=maintenanceState(row,today);
 const unitFile=useServiceFile(unit?'object':'',unit?.id??'',refresh);
 return <>
  <header className={styles.mailHead}>
   <span className={`${styles.mailAvatar} ${maintenanceStyles.rowIcon}`} aria-hidden="true"><FileActionIcon icon={objectActionIcon(unit?.type)}/></span>
   <div className={styles.mailHeadText}>
    <strong className={styles.mailCustomer}>{unit?.name||object?.name||'Wartung ohne Anlagenzuordnung'}</strong>
    <h2 ref={headingRef} tabIndex={-1} className={styles.mailTitle}>{row.title}</h2>
    <p className={styles.mailLine}>{customer?.name||'Kunde nicht zugeordnet'}{object&&unit?' · '+object.name:''}</p>
   </div>
  </header>
  <section className={entityStyles.group} aria-label="Wartungsdetails">
   <h3>Wartungsdetails</h3>
   <dl className={entityStyles.metadata}>
    <div><dt>Fälligkeit</dt><dd>{date(row.due)} <span className={`${styles.mailStatus} ${maintenanceStyles.state}`} data-state={state}>{states[state]}</span></dd></div>
    <div><dt>Wartungsvertrag</dt><dd>{row.contract}</dd></div>
    <div><dt>Vertragsabschluss</dt><dd>{date(row.closed)}</dd></div>
    <div><dt>Vertragslaufzeit</dt><dd>{row.from?'Ab '+date(row.from):'Beginn nicht hinterlegt'} · {row.until?'Bis '+date(row.until):'Ende nicht hinterlegt'}</dd></div>
    <div><dt>Standort</dt><dd>{address||'Nicht hinterlegt'}</dd></div>
    {!unit&&<div><dt>Technische Einheit</dt><dd>Keine technische Einheit zugeordnet</dd></div>}
   </dl>
   {row.issue&&<div className={maintenanceStyles.detailNotice}><Notice tone="neutral">{row.issue}</Notice></div>}
  </section>
  {row.description&&<section className={entityStyles.group} aria-label="Leistungsumfang">
   <h3>Leistungsumfang</h3><p className={maintenanceStyles.description}>{row.description}</p>
  </section>}
  {unit&&<section className={maintenanceStyles.unitDetails} aria-label="Technische Einheit">
   <h3>Technische Einheit</h3>
   {unitFile.current?<EntitySummary file={unitFile.current} objects={data.objects} customers={data.customers}
    extrasLoading={unitFile.extrasLoading} hasExtras={unitFile.hasExtras} extraError={unitFile.extraError}/>:
    <Notice tone={unitFile.error?'error':'neutral'}>{unitFile.error?'Anlageninformationen derzeit nicht verfügbar.':'Anlageninformationen werden geladen …'}</Notice>}
  </section>}
 </>;
}
