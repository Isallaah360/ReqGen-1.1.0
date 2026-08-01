"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import StrictActiveRoleBoundary from "@/app/components/security/StrictActiveRoleBoundary";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const readOnlyOversight = pathname === "/admin/audit" || pathname === "/admin/security";
  return (
    <StrictActiveRoleBoundary allowedRoles={readOnlyOversight ? ["admin", "auditor"] : ["admin"]} label="the System Administration Centre">
      {children}
    </StrictActiveRoleBoundary>
  );
}
