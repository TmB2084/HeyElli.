import type {ReactNode} from 'react';
import styles from './duty-workspace.module.css';

export function DutyWorkspace({children}:{children:ReactNode}) {
 return <main className={`admin-page calendar-page duty-page ${styles.workspace}`}>
  <h1 className="sr-only">DutyBoard</h1>
  {children}
 </main>;
}
