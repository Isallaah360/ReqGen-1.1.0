"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

type IconName = "home" | "assign" | "work" | "review" | "filing" | "staff" | "leave" | "archive" | "registrar" | "audit";

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  tone: string;
};

const items: NavItem[] = [
  { href: "/hr", label: "HR Dashboard", icon: "home", tone: "from-slate-800 to-slate-950" },
  { href: "/hr/assignments", label: "Officer Assignments", icon: "assign", tone: "from-violet-600 to-indigo-700" },
  { href: "/hr/my-work", label: "My HR Work", icon: "work", tone: "from-cyan-500 to-blue-600" },
  { href: "/hr/review", label: "HR Boss Review", icon: "review", tone: "from-orange-500 to-rose-600" },
  { href: "/hr/filing", label: "HR Filing", icon: "filing", tone: "from-emerald-500 to-teal-700" },
  { href: "/hr/staff", label: "Staff Files", icon: "staff", tone: "from-blue-600 to-indigo-700" },
  { href: "/hr/leave", label: "Leave Records", icon: "leave", tone: "from-emerald-600 to-green-700" },
  { href: "/hr/archive", label: "HR Archive", icon: "archive", tone: "from-violet-600 to-purple-700" },
  { href: "/hr/registrar", label: "Registrar Centre", icon: "registrar", tone: "from-sky-600 to-cyan-700" },
  { href: "/hr/audit", label: "Audit Trail", icon: "audit", tone: "from-amber-500 to-orange-700" },
];

function NavIcon({ name }: { name: IconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></>,
    assign: <><circle cx="9" cy="7" r="4"/><path d="M2.5 21v-2a6.5 6.5 0 0 1 13 0v2"/><path d="M17 8h5M19.5 5.5v5"/></>,
    work: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6V4h8v2M3 11h18M9 15h6"/></>,
    review: <><path d="M4 4h12v16H4z"/><path d="M8 8h4M8 12h4M8 16h3"/><path d="m17 15 2 2 4-5"/></>,
    filing: <><path d="M4 3h11l5 5v13H4z"/><path d="M15 3v6h6M8 13h8M8 17h6"/></>,
    staff: <><circle cx="8" cy="8" r="3.5"/><path d="M2 21v-2a6 6 0 0 1 12 0v2"/><circle cx="17.5" cy="9" r="2.5"/><path d="M15 21v-1.5a4.5 4.5 0 0 1 7 0V21"/></>,
    leave: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></>,
    archive: <><path d="M3 7h18v14H3z"/><path d="M1 3h22v4H1zM9 12h6"/></>,
    registrar: <><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    audit: <><path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></>,
  };
  return <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true" {...common}>{paths[name]}</svg>;
}

export default function HRNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="HR Directorate navigation" className="rounded-[1.75rem] border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
      <div className="flex gap-3 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible">
        {items.map((item) => {
          const active = item.href === "/hr" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`group inline-flex min-h-12 shrink-0 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r px-4 py-3 text-sm font-black text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-cyan-200 ${item.tone} ${active ? "ring-4 ring-cyan-200 shadow-xl" : ""}`}
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 ring-1 ring-white/20 transition group-hover:bg-white/25">
                <NavIcon name={item.icon} />
              </span>
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
