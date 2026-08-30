"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import StrictActiveRoleBoundary from "@/app/components/security/StrictActiveRoleBoundary";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const readOnlyOversight = pathname === "/admin/audit" || pathname === "/admin/security";
  return (
    <StrictActiveRoleBoundary allowedRoles={readOnlyOversight ? ["admin", "auditor"] : ["admin"]} label="the Admin Centre">
      <div className="admin-scope module-admin min-h-0">{children}</div>
    </StrictActiveRoleBoundary>
  );
}
