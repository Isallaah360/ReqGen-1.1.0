"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, BarChart3, BellRing, CalendarDays, ClipboardList, FileBarChart,
  Landmark, LayoutDashboard, Scale, ShieldCheck, UsersRound,
} from "lucide-react";

const items = [
  ["01", "Command Centre", "/executive", LayoutDashboard],
  ["02", "Requests", "/executive/requests", ClipboardList],
  ["03", "Finance", "/executive/finance", Landmark],
  ["04", "Human Resources", "/executive/hr", UsersRound],
  ["05", "Registry", "/executive/registry", FileBarChart],
  ["06", "Audit", "/executive/audit", ShieldCheck],
  ["07", "Analytics", "/executive/analytics", BarChart3],
  ["08", "Calendar", "/executive/calendar", CalendarDays],
  ["09", "Meetings", "/executive/meetings", Scale],
  ["10", "Notifications", "/executive/notifications", BellRing],
  ["11", "Reports", "/executive/reports", Activity],
] as const;

export default function ExecutiveNavigation() {
  const pathname = usePathname();
  return (
    <nav className="mx-auto w-full max-w-7xl px-4 py-4 lg:px-8" aria-label="Executive Command Centre">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {items.map(([number, label, href, Icon]) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`group flex min-h-14 items-center gap-3 rounded-2xl border px-3 py-2.5 transition ${active
                ? "border-cyan-300 bg-gradient-to-r from-blue-800 to-cyan-700 text-white shadow-lg"
                : "border-slate-200 bg-white/90 text-slate-800 shadow-sm hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"
              }`}
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-black ${active ? "bg-white/15 text-white" : "bg-slate-900 text-white"}`}>{number}</span>
              <span className="min-w-0">
                <span className={`block text-[11px] font-black uppercase tracking-wide ${active ? "text-cyan-100" : "text-slate-400"}`}><Icon className="mr-1 inline h-3.5 w-3.5" /> Executive</span>
                <span className="block truncate text-sm font-black">{label}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
