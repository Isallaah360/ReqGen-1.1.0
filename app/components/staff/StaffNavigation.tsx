"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["01", "Overview", "/staff"],
  ["02", "My Requests", "/staff/requests"],
  ["03", "My Leave", "/staff/leave"],
  ["04", "Attendance", "/staff/attendance"],
  ["05", "My Profile", "/profile"],
  ["06", "Training", "/staff/training"],
  ["07", "Performance", "/staff/performance"],
  ["08", "Notifications", "/staff/notifications"],
  ["09", "Downloads", "/staff/downloads"],
  ["10", "Security", "/profile/security"],
] as const;

export default function StaffNavigation() {
  const pathname = usePathname();

  return (
    <nav
      className="mx-auto grid max-w-[1180px] grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5"
      aria-label="Staff workspace navigation"
    >
      {items.map(([number, label, href]) => {
        const active = href === "/staff" ? pathname === "/staff" : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            className={`group flex min-h-14 items-center gap-3 rounded-2xl border px-3.5 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              active
                ? "border-blue-300 bg-gradient-to-r from-blue-800 to-cyan-600 text-white ring-4 ring-blue-100"
                : "border-slate-200 bg-white/90 text-slate-800 hover:border-blue-200 hover:bg-blue-50"
            }`}
          >
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-black ${
                active ? "bg-white/20 text-white" : "bg-slate-900 text-white"
              }`}
            >
              {number}
            </span>
            <span className={`text-sm font-black ${active ? "text-white" : "text-slate-900"}`}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
