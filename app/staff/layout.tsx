import type { ReactNode } from "react";
import StaffNavigation from "@/app/components/staff/StaffNavigation";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      {children}
    </div>
  );
}

export function StaffWorkspaceNavigation() {
  return <StaffNavigation />;
}
