import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import ExecutiveGuard from "@/app/components/executive/ExecutiveGuard";
import ExecutiveNavigation from "@/app/components/executive/ExecutiveNavigation";

export default function ExecutiveLayout({children}:{children:ReactNode}){
  return <ExecutiveGuard><div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.08),_transparent_30%),linear-gradient(to_bottom,_#f8fafc,_#eef6ff)] text-slate-900"><div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 pt-5 sm:flex-row sm:items-center sm:justify-between lg:px-8"><Link href="/staff" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white shadow-md"><ArrowLeft className="h-4 w-4"/>Staff Homepage</Link><div className="inline-flex w-fit items-center gap-2 rounded-xl border border-cyan-200 bg-white/90 px-4 py-2.5 text-xs font-black text-cyan-900 shadow-sm"><ShieldCheck className="h-4 w-4"/>Active role + verified 2FA</div></div><ExecutiveNavigation/><main className="mx-auto w-full max-w-7xl px-4 pb-12 lg:px-8">{children}</main></div></ExecutiveGuard>;
}
