'use client';

import {useId,type ReactNode} from 'react';
import {Button,Card} from '@/platform/ui';
import {GuardedLink,Notice} from '@/platform/shell';
import {MaintenanceRows,filterMaintenanceRows} from './maintenance-workspace';
import {maintenanceState} from './maintenance-model';
import {matchesOrder,orderPreview,type ServiceOrder,type ServiceObject,type ServiceOverview} from './model';
import {SideGlyph} from './side-glyph';
import type {useMaintenance} from './use-maintenance';
import styles from './cockpit.module.css';

export const orderWorklists=[
 {value:'all',label:'Alle Aufträge',icon:'inbox'},
 {value:'today',label:'Heute geplant',icon:'cal'},
 {value:'unplanned',label:'Ohne Termin',icon:'alert'},
 {value:'unassigned',label:'Ohne Haupttechniker',icon:'user'},
] as const;
const maintenanceWorklists=[
 {value:'due',label:'Fällig bis heute',icon:'cal'},
 {value:'overdue',label:'Überfällig',icon:'alert'},
 {value:'future',label:'Bevorstehend',icon:'clock'},
 {value:'unknown',label:'Fälligkeit prüfen',icon:'tool'},
] as const;

function worklistHref(view:'orders'|'maintenance',filter:string,id?:string){
 const params=new URLSearchParams({ansicht:view});
 if(view==='orders'&&filter!=='all')params.set('filter',filter);
 if(view==='maintenance'&&filter!=='due')params.set('faelligkeit',filter);
 if(id){params.set('akte',view==='orders'?'order':'maintenance');params.set('id',id);}
 return '/servicehub?'+params;
}

function CockpitMetrics({title,children}:{title:string;children:ReactNode}){
 const heading=useId();
 return <section aria-labelledby={heading}>
  <Card>
   <h2 id={heading} className={styles.metricHeading}>{title}</h2>
   <div className={styles.metrics}>{children}</div>
  </Card>
 </section>;
}

function Metric({label,icon,count,href}:{label:string;icon:string;count:number|null;href:string}){
 return <Button asChild variant="ghost" className={styles.metric}>
  <GuardedLink href={href}><SideGlyph name={icon}/><span>{label}</span><strong>{count??<><span aria-hidden="true">–</span><span className="sr-only">Anzahl nicht verfügbar</span></>}</strong></GuardedLink>
 </Button>;
}

function PreviewCard({title,href,children}:{title:string;href:string;children:ReactNode}){
 const heading=useId();
 return <section aria-labelledby={heading}>
  <Card className={styles.preview}>
   <header className={styles.previewHead}>
    <h2 id={heading}>{title}</h2>
    <Button asChild variant="outline" shape="capsule"><GuardedLink href={href} aria-label={title+' · Alle anzeigen'}>Alle anzeigen</GuardedLink></Button>
   </header>
   {children}
  </Card>
 </section>;
}

export function ServiceCockpit({data,objects,maintenance,today,renderOrderRows,onOpenMaintenance}:{
 data:ServiceOverview;objects:ServiceObject[];maintenance:ReturnType<typeof useMaintenance>;today:string;
 renderOrderRows:(rows:ServiceOrder[],filter:string)=>ReactNode;onOpenMaintenance:(id:string)=>void;
}){
 const scheduled=data.orders.filter(row=>matchesOrder(row,'today',today));
 const unplanned=data.orders.filter(row=>matchesOrder(row,'unplanned',today));
 const unassigned=data.orders.filter(row=>matchesOrder(row,'unassigned',today));
 const orderCounts={all:data.orders.length,today:scheduled.length,unplanned:unplanned.length,unassigned:unassigned.length};
 const maintenanceReady=!maintenance.loading&&!maintenance.error;
 const maintenanceCounts={due:0,overdue:0,future:0,unknown:0};
 for(const row of maintenance.rows){
  const state=maintenanceState(row,today);
  if(state==='today'||state==='overdue')maintenanceCounts.due++;
  if(state==='overdue'||state==='future'||state==='unknown')maintenanceCounts[state]++;
 }
 const due=filterMaintenanceRows(maintenance.rows,data,'due',today,'');
 const focus=unplanned.length?{rows:unplanned,filter:'unplanned',reason:'ohne Termin'}:
  unassigned.length?{rows:unassigned,filter:'unassigned',reason:'ohne Haupttechniker'}:null;
 const singleOrder=focus?.rows.length===1?focus.rows[0]:undefined;
 const attention=focus?{
  count:focus.rows.length,title:(focus.rows.length===1?'Auftrag':'Aufträge')+' '+focus.reason,
  href:worklistHref('orders',focus.filter,singleOrder?.id),action:singleOrder?'Auftrag öffnen':'Aufträge anzeigen',
  description:singleOrder?[singleOrder.number,orderPreview(singleOrder,objects,focus.filter,today).description,data.customers.find(customer=>customer.id===singleOrder.customerId)?.name].filter(Boolean).join(' · '):'',
 }:maintenanceReady&&maintenanceCounts.overdue?{
  count:maintenanceCounts.overdue,title:maintenanceCounts.overdue===1?'Überfällige Wartung':'Überfällige Wartungen',
  href:worklistHref('maintenance','overdue'),action:'Wartungen anzeigen',description:'',
 }:null;
 return <div className={styles.cockpit}>
  {attention&&<Card className={styles.attention}>
   <strong className={styles.attentionCount}>{attention.count}</strong>
   <div className={styles.attentionText}><strong>{attention.title}</strong>{attention.description&&<small>{attention.description}</small>}</div>
   <Button asChild shape="capsule" className={styles.attentionAction}><GuardedLink href={attention.href}>{attention.action}</GuardedLink></Button>
  </Card>}
  <div className={styles.bands}>
   <CockpitMetrics title="Aufträge">
    {orderWorklists.map(({value,label,icon})=><Metric key={value} label={label} icon={icon} count={orderCounts[value]} href={worklistHref('orders',value)}/>)}
   </CockpitMetrics>
   <CockpitMetrics title="Wartungen">
    {maintenanceWorklists.map(({value,label,icon})=><Metric key={value} label={label} icon={icon}
     count={maintenanceReady?maintenanceCounts[value]:null} href={worklistHref('maintenance',value)}/>)}
    {maintenance.loading&&<Notice className={styles.notice}>Wartungen werden geladen · {maintenance.done} / {maintenance.total}</Notice>}
    {maintenance.error&&<Notice tone="error" className={styles.notice}>Wartungskennzahlen sind unvollständig. <Button variant="outline" shape="capsule" onClick={maintenance.reload}>Erneut laden</Button></Notice>}
   </CockpitMetrics>
  </div>
  <div className={styles.previews}>
   <PreviewCard title="Ohne Termin" href={worklistHref('orders','unplanned')}>
    {unplanned.length?renderOrderRows(unplanned,'unplanned'):<p className={styles.empty}>Alle aufgeführten Aufträge haben einen Termin.</p>}
   </PreviewCard>
   <PreviewCard title="Heute geplant" href={worklistHref('orders','today')}>
    {scheduled.length?renderOrderRows(scheduled,'today'):<p className={styles.empty}>Heute sind keine Serviceeinsätze geplant.</p>}
   </PreviewCard>
   <PreviewCard title="Fällige Wartungen" href={worklistHref('maintenance','due')}>
    {due.length?<MaintenanceRows data={data} rows={due.slice(0,6)} today={today} onOpen={onOpenMaintenance}/>:
     maintenanceReady?<p className={styles.empty}>Keine Wartung ist bis heute fällig.</p>:<p className={styles.empty}>Die Wartungsliste wird ergänzt, sobald die Daten verfügbar sind.</p>}
   </PreviewCard>
  </div>
 </div>;
}
