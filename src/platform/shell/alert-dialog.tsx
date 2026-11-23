'use client';
import {useEffect,useId,useRef,type ReactNode,type RefObject,type SyntheticEvent} from 'react';
import {Button,Dialog} from '@/platform/ui';
import styles from './alert-dialog.module.css';
/** Presentation only: callers retain their existing confirmation and save rules. */
export function AlertDialog({dialogRef,title,description,children,actions,onCancel,tone='warning'}:{dialogRef:RefObject<HTMLDialogElement|null>;title:string;description?:ReactNode;children?:ReactNode;actions:ReactNode;onCancel:(event:SyntheticEvent<HTMLDialogElement>)=>void;tone?:'warning'|'info'}){
 const id=useId();
 return <Dialog ref={dialogRef} className={styles.dialog} data-heyelli-alert="true" role="alertdialog" aria-labelledby={id} aria-describedby={description?`${id}-description`:undefined} onCancel={onCancel}>
  <div className={styles.content}><div className={styles.symbol} data-tone={tone} aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{tone==='warning'?<><path d="M14 5 3 24a2 2 0 0 0 2 3h22a2 2 0 0 0 2-3L18 5a2.3 2.3 0 0 0-4 0Z"/><path d="M16 12v7m0 4h.01"/></>:<><circle cx="16" cy="16" r="12"/><path d="M16 15v8m0-14h.01"/></>}</svg></div>
  <h2 className={styles.title} id={id}>{title}</h2>{description&&<p className={styles.description} id={`${id}-description`}>{description}</p>}{children&&<div className={styles.body}>{children}</div>}</div>
  <div className={styles.actions}>{actions}</div>
 </Dialog>;
}
export function ConfirmationDialog({open,title,description,confirmLabel,onCancel,onConfirm,busy=false}:{open:boolean;title:string;description:string;confirmLabel:string;onCancel:()=>void;onConfirm:()=>void;busy?:boolean}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const node=dialog.current;if(!open){node?.close();return;}const previous=document.activeElement as HTMLElement|null;node?.showModal();return ()=>{node?.close();if(previous?.isConnected)previous.focus({preventScroll:true});};},[open]);
 return <AlertDialog dialogRef={dialog} title={title} description={description} onCancel={event=>{event.preventDefault();if(!busy)onCancel();}} actions={<><Button variant="outline" autoFocus disabled={busy} onClick={onCancel}>Abbrechen</Button><Button disabled={busy} onClick={onConfirm}>{confirmLabel}</Button></>}/>;
}
