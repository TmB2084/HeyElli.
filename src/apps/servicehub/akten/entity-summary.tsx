'use client';
import {Notice} from '@/platform/shell';
import type {ReactNode} from 'react';
import type {ServiceFile,ServiceObject,ServiceCustomer} from './model';
import {FileActionIcon} from './file-action-icon';
import {maintenanceContext} from './maintenance-model';
import styles from './entity-record.module.css';
function FocusField({label,children,detail,icon='object'}:{label:string;children:ReactNode;detail?:string;icon?:'object'|'unit'|'customer'}){return <div className={styles.field}><dt><FileActionIcon icon={icon}/>{label}</dt><dd>{typeof children==='string'?<span>{children}</span>:children}{detail&&<small>{detail}</small>}</dd></div>;}
export function EntitySummary({file,objects,customers,extrasLoading,hasExtras,extraError}:{file:ServiceFile;objects:ServiceObject[];customers:ServiceCustomer[];extrasLoading:boolean;hasExtras:boolean;extraError:string}){
 const customer=file.kind==='customer',unit=file.objectType==='TECHNISCHE_EINHEIT',fields=file.fields??[],used=new Set<number>();
 function take(name:string){const index=fields.findIndex(field=>field.name.trim().toLocaleLowerCase('de')===name);if(index<0)return '';used.add(index);return fields[index].value;}
 const number=customer?file.number:take('nummer'),manufacturer=unit?take('hersteller'):'',equipmentType=unit?take('typ'):'',location=unit?take('standort'):'',place=maintenanceContext({objectId:file.objectId??''},objects,customers),address=file.address||place.address,owner=customers.find(item=>item.id===file.customerId)?.name||place.customer?.name,extraFields=fields.filter((_,index)=>!used.has(index));
 const cost=extrasLoading&&!hasExtras?'Wird geladen …':extraError&&!hasExtras?'Nicht verfügbar':file.costCarrier?.number||file.costCarrier?.name||'Nicht zugeordnet',costName=file.costCarrier?.number?file.costCarrier.name:'';
 return <div className={styles.summary}>
  <dl className={styles.focus} aria-label={customer?'Kundeninformationen':unit?'Anlageninformationen':'Objektinformationen'}>
   {!customer&&<FocusField label="Kunde" icon="customer">{owner||'Nicht zugeordnet'}</FocusField>}
   <FocusField label={customer?'Anschrift':unit?'Standort':'Objektadresse'} detail={[!file.address&&address?'Standort des übergeordneten Objekts':'',location].filter(Boolean).join(' · ')}>{address||'Nicht hinterlegt'}</FocusField>
   <FocusField label={customer?'Kundennummer':unit?'TE-Nummer':'Objektnummer'} icon={customer?'customer':unit?'unit':'object'}>{number||'Nicht hinterlegt'}</FocusField>
   {unit&&(manufacturer||equipmentType)&&<FocusField label="Hersteller / Typ" icon="unit" detail={manufacturer&&equipmentType?equipmentType:undefined}>{manufacturer||equipmentType}</FocusField>}
   {!customer&&!unit&&<FocusField label="Kostenträger" detail={costName}>{file.costCarrierError?<Notice tone="error">{file.costCarrierError}</Notice>:cost}</FocusField>}
  </dl>
  {file.contacts&&<section className={styles.group} aria-label="Ansprechpartner"><h3>Ansprechpartner</h3><div className={styles.contacts}>{file.contacts.length?file.contacts.map((contact,index)=><div className={styles.contact} key={index}><span className={styles.avatar}><FileActionIcon icon="customer"/></span><div><strong>{contact.name}</strong>{contact.phones.map(phone=><a key={phone} href={'tel:'+phone.replace(/[^+\d]/g,'')}>{phone}</a>)}</div></div>):<p className={styles.empty}>Keine Ansprechpartner hinterlegt.</p>}</div></section>}
  {!customer&&unit&&<section className={styles.group} aria-label="Kostenträger der technischen Einheit"><h3>Kostenträger der technischen Einheit</h3><div className={styles.carrier}>{file.costCarrierError?<Notice tone="error">{file.costCarrierError}</Notice>:<><strong>{cost}</strong>{costName&&<small>{costName}</small>}</>}</div></section>}
  {!!extraFields.length&&<section className={styles.group} aria-label="Weitere Angaben"><h3>Weitere Angaben</h3><dl className={styles.metadata}>{extraFields.map((field,index)=><div key={index}><dt>{field.name}</dt><dd>{field.value}</dd></div>)}</dl></section>}
 </div>;
}
