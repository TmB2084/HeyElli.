'use client';
import {Button} from '@/platform/ui';
import {useState} from 'react';
import {pdsWebLink} from './pds-link';
import {FileActionIcon} from './file-action-icon';
import styles from './workspace.module.css';
export function PdsLinkActions({webLink,onNotice}:{webLink?:string;onNotice:(message:string,tone:'success'|'error')=>void}){
 const href=pdsWebLink(webLink),[busy,setBusy]=useState(false);
 if(!href)return null;
 async function copy(){if(busy)return;setBusy(true);try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(href!);onNotice('PDS-Link kopiert.','success');}catch{onNotice('PDS-Link konnte nicht kopiert werden. Bitte die Zwischenablage-Berechtigung im Browser prüfen.','error');}finally{setBusy(false);}}
 return <><a className={styles.iconAction} href={href} aria-label="In PDS öffnen" title="In PDS öffnen" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><FileActionIcon icon="external"/></a><Button variant="outline" size="icon" className={styles.iconAction} aria-label={busy?'Wird kopiert …':'PDS-Link kopieren'} title="PDS-Link kopieren" disabled={busy} onClick={()=>void copy()}><FileActionIcon icon="copy"/></Button></>;
}
