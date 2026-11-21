import type {ReactNode} from "react";
import styles from "./planner-workspace.module.css";

export function PlannerWorkspace({children}:{children:ReactNode}) {
  return <main className={`calendar-page ${styles.workspace}`}>
    <h1 className="sr-only">PlanBoard</h1>
    <div className={styles.content}>{children}</div>
  </main>;
}
