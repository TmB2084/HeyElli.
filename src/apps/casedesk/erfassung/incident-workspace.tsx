import type { ReactNode } from "react";
import styles from "./incident-workspace.module.css";

export function IncidentWorkspace({children}:{children:ReactNode}) {
  return <main className={styles.workspace}>
    <h1 className="sr-only">CaseDesk</h1>
    {children}
  </main>;
}
