"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, Banknote, Archive, ShieldCheck, BarChart3, CalendarDays, Bell, FileText, BriefcaseBusiness } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const items: { href: string; label: string; description: string; icon: LucideIcon }[] = [
  { href: "/executive", label: "Overview", description: "Command centre", icon: LayoutDashboard },
  { href: "/executive/requests", label: "Requests", description: "Workflow intelligence", icon: ClipboardList },
  { href: "/executive/finance", label: "Finance", description: "Authorized snapshot", icon: Banknote },
  { href: "/executive/registry", label: "Registry", description: "Records movement", icon: Archive },
  { href: "/executive/audit", label: "Audit", description: "Evidence and risk", icon: ShieldCheck },
  { href: "/executive/analytics", label: "Analytics", description: "Institutional KPIs", icon: BarChart3 },
  { href: "/executive/calendar", label: "Calendar", description: "Institutional schedule", icon: CalendarDays },
  { href: "/executive/meetings", label: "Meetings", description: "Governance activities", icon: BriefcaseBusiness },
  { href: "/executive/notifications", label: "Notifications", description: "Priority alerts", icon: Bell },
  { href: "/executive/reports", label: "Reports", description: "Executive printout", icon: FileText },
];

export default function ExecutiveNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Command Centre" className="mx-auto grid max-w-[1240px] grid-cols-1 gap-2 rounded-[1.75rem] border border-slate-200 bg-white/95 p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      {items.map((item, index) => {
        const active = pathname === item.href || (item.href !== "/executive" && pathname.startsWith(`${item.href}/`));
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} className={`group flex min-h-[72px] items-center gap-3 rounded-2xl border px-3 py-3 transition ${active ? "border-blue-600 bg-gradient-to-br from-blue-700 to-cyan-600 text-white shadow-lg" : "border-slate-200 bg-slate-50 text-slate-900 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-white hover:shadow-md"}`}>
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-black ${active ? "bg-white/15 text-white ring-1 ring-white/25" : "bg-white text-blue-700 shadow-sm"}`}>
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className={`block text-[10px] font-black uppercase tracking-[0.14em] ${active ? "text-cyan-100" : "text-slate-400"}`}>{String(index + 1).padStart(2, "0")}</span>
              <span className="block truncate text-sm font-black">{item.label}</span>
              <span className={`block truncate text-[11px] font-semibold ${active ? "text-blue-100" : "text-slate-500"}`}>{item.description}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
