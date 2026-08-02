import type { ReactNode } from "react";
import RegistrarGovernanceNavigation from "@/app/components/hr/RegistrarGovernanceNavigation";
import RegistrarSecureGuard from "@/app/components/hr/RegistrarSecureGuard";

export default function RegistrarLayout({ children }: { children: ReactNode }) {
  return (
    <RegistrarSecureGuard>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <RegistrarGovernanceNavigation />
        {children}
      </div>
    </RegistrarSecureGuard>
  );
}
