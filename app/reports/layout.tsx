import type { ReactNode } from "react";
import styles from "./approved-mockup.module.css";
export default function ReportsLayout({ children }: { children: ReactNode }) { return <div className={styles.family}>{children}</div>; }
