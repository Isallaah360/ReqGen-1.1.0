"use client";

import type { ReactNode } from "react";
import StrictActiveRoleBoundary from "@/app/components/security/StrictActiveRoleBoundary";

/** v4.6: Administration is for the Super Admin and the Developer (both act as "admin"). Pages draw themselves with the v4 kit. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <StrictActiveRoleBoundary allowedRoles={["admin"]} label="Administration">{children}</StrictActiveRoleBoundary>;
}
