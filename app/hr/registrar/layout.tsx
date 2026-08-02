import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import RegistrarGovernanceNavigation from "@/app/components/hr/RegistrarGovernanceNavigation";
import RegistrarSecureGuard from "@/app/components/hr/RegistrarSecureGuard";

export default function RegistrarLayout({ children }: { children: ReactNode }) {
  return (
    <RegistrarSecureGuard>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.08),_transparent_32%),linear-gradient(to_bottom,_#f8fafc,_#eef6ff)] text-slate-900">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 pt-5 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Link
            href="/hr"
            className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" /> Back to HR Directorate
          </Link>
          <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-cyan-200 bg-white/90 px-4 py-2.5 text-xs font-black text-cyan-900 shadow-sm backdrop-blur">
            <ShieldCheck className="h-4 w-4 text-cyan-700" /> Secured by active role and verified 2FA
          </div>
        </div>
        <RegistrarGovernanceNavigation />
        {children}
      </div>
    </RegistrarSecureGuard>
  );
}
