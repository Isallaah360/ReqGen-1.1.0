"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  ClipboardCheck,
  FileOutput,
  FolderKanban,
  Gauge,
  GraduationCap,
  Settings2,
  ShieldCheck,
  UsersRound,
  UserRoundCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type RegistrarModule = {
  href: string;
  label: string;
  note: string;
  icon: LucideIcon;
};

const modules: RegistrarModule[] = [
  { href: "/hr/registrar", label: "Registrar Centre", note: "Personnel files and custody", icon: FolderKanban },
  { href: "/hr/registrar/settings", label: "HR Settings", note: "Policy and configuration", icon: Settings2 },
  { href: "/hr/registrar/officer-performance", label: "Officer Performance", note: "Workload and productivity", icon: UserRoundCheck },
  { href: "/hr/registrar/analytics", label: "HR Analytics", note: "Trends and intelligence", icon: BarChart3 },
  { href: "/hr/registrar/reports", label: "HR Reports", note: "Management reporting", icon: ClipboardCheck },
  { href: "/hr/registrar/compliance", label: "HR Compliance", note: "Control and exceptions", icon: ShieldCheck },
  { href: "/hr/registrar/output", label: "Print & Output", note: "Official reports and export", icon: FileOutput },
  { href: "/hr/registrar/weekly-seminar", label: "Weekly Seminar", note: "Attendance and participation", icon: BookOpenCheck },
  { href: "/hr/registrar/capacity-building/staff", label: "Staff Capacity", note: "Staff learning programmes", icon: GraduationCap },
  { href: "/hr/registrar/capacity-building/departments", label: "Department Capacity", note: "Institutional development", icon: UsersRound },
  { href: "/hr/registrar/department-kpi", label: "Department KPI", note: "Targets and evidence", icon: Gauge },
  { href: "/hr/registrar/assessments/annual-360", label: "Annual 360°", note: "Assessment governance", icon: Activity },
];

export default function RegistrarGovernanceNavigation() {
  const pathname = usePathname();

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-6 lg:px-8">
      <div className="rounded-[1.75rem] border border-white/70 bg-white/95 p-4 shadow-xl backdrop-blur-xl">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-700">Secured Registrar Governance</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Strategic HR administration and institutional development</h2>
          </div>
          <span className="inline-flex w-fit items-center rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-800 ring-1 ring-cyan-200">Admin · HR Boss · Registrar · 2FA</span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {modules.map((item, index) => {
            const active = item.href === "/hr/registrar" ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex min-h-16 items-center gap-3 rounded-xl border px-3 py-2.5 transition focus:outline-none focus:ring-4 focus:ring-cyan-100 ${
                  active
                    ? "border-blue-700 bg-gradient-to-r from-blue-900 to-cyan-700 text-white shadow-lg"
                    : "border-slate-200 bg-slate-50 text-slate-900 hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-cyan-50 hover:shadow-md"
                }`}
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[11px] font-black ${active ? "bg-white/15 text-white ring-1 ring-white/25" : "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"}`}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Icon className={`h-5 w-5 shrink-0 ${active ? "text-cyan-100" : "text-cyan-700"}`} />
                <span className="min-w-0">
                  <span className={`block text-sm font-black leading-tight ${active ? "text-white" : "text-slate-950"}`}>{item.label}</span>
                  <span className={`mt-1 block text-[11px] font-semibold leading-tight ${active ? "text-blue-100" : "text-slate-500"}`}>{item.note}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
