'use client';
import {Button} from '@/platform/ui';
import {Fragment,useId,useState,type KeyboardEventHandler,type Ref} from 'react';
import type {customerWorkCounts,WorkCounts} from './customer-work-counts';
import type {ServiceObject} from './model';
import {type customerObjectGroups,objectRoots} from './customer-hierarchy';
import {FileActionIcon,objectActionIcon} from './file-action-icon';
import {ServiceEmptyState} from './empty-state';
import {matchingCosts,costKindLabel} from './cost-matches';
import styles from './workspace.module.css';
const PinGlyph=()=><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 4h6l-1 5 3 3v2H7v-2l3-3z"/><path d="M12 14v6"/></svg>;
const initials=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'?';
export type CustomerScope='all'|'pinned'|'open';
type CustomerGroups=ReturnType<typeof customerObjectGroups>;

const scopes=[
 ['all','Alle','customer'],
 ['pinned','Angeheftet','pin'],
 ['open','Mit offenen Aufträgen','order'],
] as const;

export function CustomerCategories({scope,onChange}:{scope:CustomerScope;onChange:(scope:CustomerScope)=>void}){
 return <div className={`${styles.filterChips} ${styles.listCategories}`} role="group" aria-label="Kunden filtern">
  {scopes.map(([value,label,icon])=><Button key={value} variant="filter" shape="capsule"
   size={scope===value?'default':'icon'} className={styles.scopeChip}
   aria-label={label} title={scope===value?undefined:label} aria-pressed={scope===value} onClick={()=>onChange(value)}>
   {icon==='pin'?<PinGlyph/>:<FileActionIcon icon={icon}/>}{scope===value&&label}
  </Button>)}
 </div>;
}


function WorkBadges({counts,id}:{counts?:WorkCounts;id:string}){
 if(!counts?.orders&&!counts?.maintenance)return null;
 const orders=counts.orders===1?'1 offener Auftrag':`${counts.orders} offene Aufträge`;
 const maintenance=counts.maintenance===1?'1 fällige Wartung':`${counts.maintenance} fällige Wartungen`;
 return <span className={styles.workBadges}>
  {!!counts.orders&&<span data-work-badge="orders" title={orders} aria-hidden="true">
   <FileActionIcon icon="order"/>{counts.orders}
  </span>}
  {!!counts.maintenance&&<span data-work-badge="maintenance" title={maintenance} aria-hidden="true">
   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4m6-4v4m-3 6v2m0 2h.01"/>
   </svg>{counts.maintenance}
  </span>}
  <span id={id} className="sr-only">{[counts.orders&&orders,counts.maintenance&&maintenance].filter(Boolean).join(', ')}</span>
 </span>;
}

// Kundenliste nach Anfangsbuchstaben mit aufklappbarer Objektstruktur.
export function CustomerFiles({groups,query,selectedKey,onOpen,searching=false,workCounts,listRef,onKeyDown,keyboardHelp}:{
 groups:CustomerGroups;query:string;selectedKey:string;onOpen:(kind:string,id:string)=>void;
 searching?:boolean;workCounts?:ReturnType<typeof customerWorkCounts>;
 listRef:Ref<HTMLDivElement>;onKeyDown:KeyboardEventHandler<HTMLDivElement>;keyboardHelp:string;
}){
 const customerCount=groups.filter(group=>group.customer).length;
 const letters=groups.map(({customer})=>customer?.name.trim().charAt(0).toLocaleUpperCase('de')||'#');

 return <>
  <p className="sr-only" role="status">{customerCount} {customerCount===1?'Kunde':'Kunden'}</p>
  {!groups.length&&!searching&&<ServiceEmptyState icon={<FileActionIcon icon="object"/>} title="Keine passenden Kunden oder technischen Einheiten."/>}
  <div className={styles.customerGroups} ref={listRef} onKeyDown={onKeyDown}>
   {groups.map((group,index)=>{
    const heading=index===0||letters[index-1]!==letters[index]?letters[index]:'';
    return <Fragment key={group.customer?.id??'unassigned'}>
     {heading&&<p className={styles.letter} aria-hidden="true">{heading}</p>}
     <CustomerRow group={group} query={query} selectedKey={selectedKey} keyboardHelp={keyboardHelp} onOpen={onOpen}
      counts={group.customer?workCounts?.customers.get(group.customer.id):undefined} siteCounts={workCounts?.sites}/>
    </Fragment>;
   })}
  </div>
 </>;
}

function CustomerRow({group,query,selectedKey,keyboardHelp,onOpen,counts,siteCounts}:{
 group:CustomerGroups[number];query:string;selectedKey:string;keyboardHelp:string;
 onOpen:(kind:string,id:string)=>void;counts?:WorkCounts;siteCounts?:Map<string,WorkCounts>;
}){
 const {customer,objects}=group;
 const panelId=useId();
 const search=query.trim();
 const selectedObject=objects.find(item=>`object:${item.id}`===selectedKey)?.id??'';
 const [disclosure,setDisclosure]=useState({search,selectedObject,open:Boolean(search||selectedObject)});
 const changedSearch=search!==disclosure.search;
 const changedObject=selectedObject!==disclosure.selectedObject;
 const expanded=changedSearch?Boolean(search||selectedObject):disclosure.open||Boolean(changedObject&&selectedObject);
 if(changedSearch||changedObject)setDisclosure({search,selectedObject,open:expanded});
 const name=customer?.name??'Ohne Kundenzuordnung';
 const summary=customer
  ?`${customer.number||'Kundennummer nicht hinterlegt'} · ${objects.length} ${objects.length===1?'Objekt':'Objekte'}`
  :'Objekte ohne zugeordneten Kunden';
 const customerInfo=<>
  <span className={styles.avatar} aria-hidden="true">{customer?initials(name):'?'}</span>
  <span className={styles.customerName}><strong>{name}</strong><small id={panelId+'-summary'}>{summary}</small></span>
  <WorkBadges counts={counts} id={panelId+'-counts'}/>
 </>;

 return <div className={styles.customerRow}>
  <div className={styles.customerGroup} data-expanded={expanded||undefined}>
   <div className={styles.customerLine}>
    {customer?<Button variant="ghost" className={styles.customerFileButton}
     aria-label={`Kundenakte ${name} öffnen`} aria-describedby={`${panelId}-summary ${keyboardHelp}${counts?` ${panelId}-counts`:''}`}
     data-file-row={`customer:${customer.id}`} aria-pressed={`customer:${customer.id}`===selectedKey} onClick={()=>onOpen('customer',customer.id)}>{customerInfo}</Button>
     :<div className={styles.customerFileButton}>{customerInfo}</div>}
    <Button variant="ghost" size="icon" shape="capsule" className={styles.customerDisclosure}
     aria-expanded={expanded} aria-controls={panelId}
     aria-label={`Objekte und Einheiten ${expanded?'einklappen':'aufklappen'} · ${name}`}
     title={expanded?'Objekte und Einheiten einklappen':'Objekte und Einheiten aufklappen'}
     onClick={()=>setDisclosure({search,selectedObject,open:!expanded})}>
     <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </Button>
   </div>
   <div id={panelId} className={styles.customerContents} hidden={!expanded}>
    {expanded&&(objects.length?<ObjectFiles objects={objects} query={query} selectedId={selectedObject} onOpen={onOpen} keyboardHelp={keyboardHelp} siteCounts={siteCounts}/>:
     <p className={styles.muted}>Keine Objekte oder technischen Einheiten hinterlegt.</p>)}
   </div>
  </div>
 </div>;
}

export function ObjectFiles({objects,selectedId,onOpen,query='',keyboardHelp,siteCounts}:{objects:ServiceObject[];query?:string;selectedId:string;keyboardHelp?:string;siteCounts?:Map<string,WorkCounts>;onOpen:(kind:string,id:string)=>void}){
 const listId=useId();
 function tree(rows:ServiceObject[],parent:string|null=null,seen=new Set<string>()){
  const roots=parent===null?objectRoots(rows):rows.filter(item=>item.parentId===parent&&!seen.has(item.id));
  return <ul className={styles.objectTree}>{roots.map(item=>{const visited=new Set([...seen,item.id]),costs=matchingCosts(item.searchCosts??[],query),counts=siteCounts?.get(item.id),countsId=`${listId}-${encodeURIComponent(item.id)}`;return <li key={item.id}><Button variant="ghost" className={styles.objectLink} data-file-row={keyboardHelp?`object:${item.id}`:undefined} aria-describedby={[keyboardHelp,counts&&countsId].filter(Boolean).join(' ')||undefined} aria-pressed={selectedId===item.id} onClick={()=>onOpen('object',item.id)}><span className={styles.objectSymbol} aria-hidden="true"><FileActionIcon icon={objectActionIcon(item.type)}/></span><span><strong>{item.name}</strong><small>{item.type==='TECHNISCHE_EINHEIT'?'Technische Einheit':'Objekt'}{item.address?' · '+item.address:''}</small>{costs.length>0&&<span className={styles.costMatches}>{costs.map((cost,index)=><span className={styles.costMatch} key={index}><span className={styles.costKind}>{costKindLabel(cost.kind)}</span><span><span className={styles.costNumber}>{cost.number}</span>{cost.number&&cost.name?' · ':''}{cost.name}</span></span>)}</span>}</span><WorkBadges counts={counts} id={countsId}/><span aria-hidden="true">›</span></Button>{rows.some(child=>child.parentId===item.id&&!visited.has(child.id))&&tree(rows,item.id,visited)}</li>;})}</ul>;
 }
 return tree(objects);
}
