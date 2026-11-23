'use client';

import {useId,useState} from 'react';
import {Button,Card} from '@/platform/ui';
import {Notice} from '@/platform/shell';
import type {CockpitHit,CockpitSearchGroup} from './cockpit-search-model';
import {FileActionIcon} from './file-action-icon';
import styles from './cockpit.module.css';

const pageSize=12;

function ResultGroup({group,onOpen}:{group:CockpitSearchGroup;onOpen:(hit:CockpitHit)=>void}){
 const heading=useId(),[shown,setShown]=useState(pageSize);
 return <section aria-labelledby={heading}>
  <Card className={styles.searchGroup}>
   <h3 id={heading}>{group.label} <span>{group.hits.length}</span></h3>
   <ul>
    {group.hits.slice(0,shown).map(hit=><li key={hit.id}>
     <Button variant="ghost" className={styles.searchResult} onClick={()=>onOpen(hit)}>
      <FileActionIcon icon={hit.icon}/>
      <span><strong>{hit.title}</strong><small>{hit.description}</small></span>
      <span aria-hidden="true">›</span>
     </Button>
    </li>)}
   </ul>
   {group.hits.length>shown&&<Button variant="outline" shape="capsule" className={styles.moreResults}
    onClick={()=>setShown(count=>count+pageSize)}>Mehr anzeigen</Button>}
  </Card>
 </section>;
}

export function CockpitSearchResults({query,groups,pending,incomplete,maintenanceLoading,maintenanceError,onRetry,onOpen}:{
 query:string;groups:CockpitSearchGroup[];pending:boolean;incomplete:boolean;maintenanceLoading:boolean;maintenanceError:boolean;
 onRetry:()=>void;onOpen:(hit:CockpitHit)=>void;
}){
 const count=groups.reduce((total,group)=>total+group.hits.length,0);
 return <div className={styles.searchResults}>
  <div className={styles.searchHeading}>
   <h2>Suchergebnisse</h2>
   <p role="status">{count?count+' Treffer':pending?'Suche läuft …':incomplete?'Keine Treffer in den verfügbaren Daten.':'Keine passenden Treffer.'}</p>
  </div>
  {maintenanceLoading&&<Notice>Wartungen werden durchsucht …</Notice>}
  {maintenanceError&&<Notice tone="error">Die Suche in Wartungen ist unvollständig. <Button variant="outline" shape="capsule" onClick={onRetry}>Erneut laden</Button></Notice>}
  {groups.filter(group=>group.hits.length>0).map(group=><ResultGroup key={query+':'+group.key} group={group} onOpen={onOpen}/>)}
 </div>;
}
