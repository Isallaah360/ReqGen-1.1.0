import type { ReactNode } from "react";
import styles from "./approved-mockup.module.css";
export default function StaffLayout({ children }: { children: ReactNode }) { return <div className={`${styles.family} module-staff`}>{children}</div>; }
