import type {ReactNode} from 'react';
import {Button} from '@/platform/ui';
import styles from './workspace.module.css';

export function ServiceEmptyState({icon,title,detail,appearance='list',action}:{
 icon:ReactNode;title:string;detail?:string;appearance?:'list'|'detail';action?:{label:string;onClick:()=>void};
}){
 return <div className={styles.emptyState} data-empty-state={appearance}>
  <span className={styles.emptyStateIcon} aria-hidden="true">{icon}</span>
  <div className={styles.emptyStateText} role="status">
   <p>{title}</p>
   {detail&&<p>{detail}</p>}
  </div>
  {action&&<Button variant="outline" shape="capsule" onClick={action.onClick}>{action.label}</Button>}
 </div>;
}
