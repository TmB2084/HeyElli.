'use client';
import {useEffect,useId,useRef,type ReactNode} from 'react';
import {Notice} from '@/platform/shell';
import styles from './duty-workspace.module.css';

export function AssignmentDialog({children,busy,error,onClose,opener,heading="Bereitschaft zuweisen"}:{children:ReactNode;busy:boolean;error:string;onClose:()=>void;opener:HTMLElement|null;heading?:string}) {
 const dialog=useRef<HTMLDialogElement>(null),title=useId();
 useEffect(()=>{
  const element=dialog.current;
  element?.showModal();
  return ()=>{
   element?.close();
   if(opener instanceof HTMLElement&&opener.isConnected)opener.focus({preventScroll:true});
  };
 },[opener]);
 return <dialog ref={dialog} className={styles.assignmentDialog} aria-labelledby={title} aria-busy={busy} onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
  <div className={styles.assignmentHeading}><h2 id={title}>{heading}</h2><button className="heyelli-close" type="button" aria-label="Dialog schließen" disabled={busy} onClick={onClose}>×</button></div>
  <div className={styles.assignmentBody}>
   {error&&<Notice tone="error" role="alert">{error}</Notice>}
   {children}
  </div>
 </dialog>;
}
