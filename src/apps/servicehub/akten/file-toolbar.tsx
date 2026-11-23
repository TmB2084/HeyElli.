'use client';
import type {ReactNode} from 'react';
import {Button} from '@/platform/ui';
import {Notice,PopUpButton,useNoticeState} from '@/platform/shell';
import type {ServiceFile} from './model';
import type {serviceFileNavigation} from './customer-hierarchy';
import {PdsLinkActions} from './pds-link-actions';
import {FileActionIcon} from './file-action-icon';
import {OrderStatus} from './order-status';
import {OrderFlagIcon} from './order-filters';
import styles from './workspace.module.css';

type Navigation = ReturnType<typeof serviceFileNavigation>;
type Props = {
 file:ServiceFile|null;
 navigation:Navigation|null;
 search?:ReactNode;
 newOrder:ReactNode;
 kind:string;
 id:string;
 originOrderId:string;
 hidden:boolean;
 busy:boolean;
 onVisibility:()=>void;
 onOpen:(kind:string,id:string)=>void;
 onChanged:()=>void;
 orderActions?:ReactNode;
 maintenanceActions?:ReactNode;
 maintenanceLink?:string;
 pinned:boolean;
 pinBusy:boolean;
 onPin:()=>void;
 flagged:boolean;
 flagBusy:boolean;
 onFlag:()=>void;
};

function FileNavigation({navigation,kind,id,originOrderId,onOpen}:Pick<Props,'kind'|'id'|'originOrderId'|'onOpen'>&{navigation:Navigation}){
 const {customer,objects,units}=navigation;
 const object=kind==='object'&&objects.some(option=>option.value===id);
 const unit=kind==='object'&&units.some(option=>option.value===id);
 const order=kind==='order';
 const menuOptions=(options:Navigation['objects'])=>options.map((option,index)=>({
  ...option,
  detail:option.belongsToOrder?'Passend zum Auftrag':undefined,
  separatorBefore:!option.belongsToOrder&&options[index-1]?.belongsToOrder,
 }));
 return <div className={styles.fileNavigation} data-section={order?'order':kind==='customer'?'customer':object?'object':unit?'unit':undefined} role="group" aria-label="Aktennavigation">
  <Button variant="ghost" aria-label={customer?'Kundenakte '+customer.name+' öffnen':'Kunde'} aria-current={kind==='customer'?'page':undefined} title="Kunde"
   disabled={!customer} onClick={()=>{if(customer&&kind!=='customer')onOpen('customer',customer.id);}}>
   <FileActionIcon icon="customer"/>
  </Button>
  <PopUpButton label="Objekt" iconOnly icon={<FileActionIcon icon="object"/>} placeholder={objects.length?'Auswahl':'Keine Objekte'}
   active={object} value={object?id:''} options={menuOptions(objects)} disabled={!objects.length} onChange={value=>onOpen('object',value)}/>
  <PopUpButton label="Einheit" iconOnly icon={<FileActionIcon icon="unit"/>} placeholder={units.length?'Auswahl':'Keine Einheiten'}
   active={unit} value={unit?id:''} options={menuOptions(units)} disabled={!units.length} onChange={value=>onOpen('object',value)}/>
  <Button variant="ghost" aria-label="Auftrag" aria-current={order?'page':undefined} title="Auftrag"
   disabled={!order&&!originOrderId} onClick={()=>{if(!order&&originOrderId)onOpen('order',originOrderId);}}>
   <FileActionIcon icon="order"/>
  </Button>
 </div>;
}

function ExternalFileActions({file,onNotice}:{file:ServiceFile;onNotice:(text:string,tone:'success'|'error')=>void}){
 const plants=[...new Map(file.contracts?.flatMap(contract=>contract.bma?.links??[]).map(plant=>[plant.aid,plant])).values()];
 return <div className={styles.externalFileActions}>
   <PdsLinkActions webLink={file.webLink} onNotice={onNotice}/>
   {plants.map(plant=><a key={plant.aid} className={`${styles.iconAction} ${styles.cloudAction}`} href={plant.url}
    aria-label={`In BMACloud öffnen · ${plant.name||plant.number} · AID ${plant.aid}`}
    title={`BMACloud · ${plant.number}${plant.name?' · '+plant.name:''} · AID ${plant.aid}`}
    target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><FileActionIcon icon="cloud"/></a>)}
 </div>;
}

export function ServiceToolbar({label,newOrder,search,className='',children}:{
 label:string;newOrder:ReactNode;search?:ReactNode;className?:string;children?:ReactNode;
}){
 return <div className={`${styles.fileToolbar} ${className}`} data-search-toolbar={search?true:undefined} role="group" aria-label={label}>
  {newOrder}{children}{search}
 </div>;
}

export function FileToolbar({file,navigation,search,newOrder,kind,id,originOrderId,hidden,busy,onVisibility,onOpen,onChanged,orderActions,maintenanceActions,maintenanceLink,pinned,onPin,pinBusy,flagged,flagBusy,onFlag}:Props){
 const {message,noticeTone,showSuccess,showError,setMessage}=useNoticeState();
 function openFile(kind:string,id:string){setMessage('');onOpen(kind,id);}
 return <>
 <ServiceToolbar label={navigation?"Aktenaktionen":"Suchwerkzeuge"} newOrder={newOrder} search={search}>
  {navigation&&<FileNavigation navigation={navigation} kind={kind} id={id} originOrderId={originOrderId} onOpen={openFile}/>}
  <div className={styles.fileToolbarActions} role={search&&(file||maintenanceActions)?"group":undefined} aria-label={search&&(file||maintenanceActions)?"Weitere Aktenaktionen":undefined}>
  {kind==='order'&&<div className={styles.orderActions} role="group" aria-label="Vorgangsaktionen">{orderActions}</div>}
  {maintenanceActions}
  {maintenanceLink&&<div className={styles.externalFileActions}>
   <PdsLinkActions webLink={maintenanceLink} onNotice={(text,tone)=>tone==='error'?showError(text):showSuccess(text)}/>
  </div>}
  {file&&<ExternalFileActions key={kind+':'+id} file={file} onNotice={(text,tone)=>tone==='error'?showError(text):showSuccess(text)}/>}
  {file?.kind==='order'&&<div className={styles.orderStatusSlot}>
   <Button variant="outline" size="icon" shape="capsule" className={styles.orderFlagAction} aria-label="Auftrag markieren" aria-pressed={flagged}
    disabled={flagBusy} title={flagged?'Markierung entfernen':'Auftrag markieren'} onClick={onFlag}><OrderFlagIcon/></Button>
   <OrderStatus key={id} id={id} status={file.status??''} onChanged={onChanged}/>
  </div>}
  {file&&file.kind!=='order'&&<div className={styles.recordActions} role="group" aria-label="Persönlich">
   {file.kind==='customer'&&<Button variant="outline" size="icon" className={`${styles.iconAction} ${styles.pinToggle}`}
    aria-label="Kunde anheften" aria-pressed={pinned} disabled={pinBusy} title={pinned?'Angeheftet · lösen':'In der Seitenleiste anheften'} onClick={onPin}>
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4h6l-1 5 3 3v2H7v-2l3-3z"/><path d="M12 14v6"/></svg>
   </Button>}
   <Button variant="outline" size="icon" className={`${styles.iconAction} ${styles.hideAction}`} aria-label={hidden?'Wieder einblenden':'Ausblenden'}
    title={hidden?'Für dich ausgeblendet · wieder einblenden':'In deiner Übersicht ausblenden'} disabled={busy} onClick={onVisibility}><FileActionIcon icon={hidden?'hide':'show'}/></Button>
  </div>}
  </div>
 </ServiceToolbar>
 <Notice tone={noticeTone}>{message}</Notice>
 </>;
}
