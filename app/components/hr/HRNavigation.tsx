"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["/hr", "HR Dashboard"],
  ["/hr/assignments", "Officer Assignments"],
  ["/hr/my-work", "My HR Work"],
  ["/hr/review", "HR Boss Review"],
  ["/hr/filing", "HR Filing"],
  ["/hr/staff", "Staff Files"],
  ["/hr/leave", "Leave Records"],
  ["/hr/archive", "HR Archive"],
  ["/hr/registrar", "Registrar Centre"],
  ["/hr/audit", "Audit Trail"],
] as const;

export default function HRNavigation() {
  const pathname = usePathname();

  return (
    <nav
      className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm"
      aria-label="HR Directorate navigation"
    >
      <div className="flex flex-wrap gap-3">
        {items.map(([href, label]) => {
          const active = href === "/hr" ? pathname === href : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`inline-flex min-h-12 items-center justify-center rounded-2xl px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-cyan-200 ${
                active
                  ? "bg-slate-950 ring-4 ring-slate-200"
                  : "bg-cyan-600 hover:bg-cyan-700"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
