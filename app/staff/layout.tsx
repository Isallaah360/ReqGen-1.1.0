import type { ReactNode } from "react";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return <div className="module-staff min-h-0">{children}</div>;
}
