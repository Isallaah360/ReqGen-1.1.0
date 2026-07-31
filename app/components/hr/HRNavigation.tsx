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
      aria-label="HR workspace menu"
      className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-700">
            HR Workspace Menu
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Select an HR workspace.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
          10 centres
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {items.map(([href, label], index) => {
          const active = href === "/hr" ? pathname === href : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`group flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-black transition focus:outline-none focus:ring-4 focus:ring-blue-100 ${
                active
                  ? "border-blue-700 bg-blue-700 text-white shadow-md"
                  : "border-slate-200 bg-slate-50 text-slate-800 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
              }`}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-black ${
                  active
                    ? "bg-white/20 text-white"
                    : "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200 group-hover:ring-blue-200"
                }`}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
