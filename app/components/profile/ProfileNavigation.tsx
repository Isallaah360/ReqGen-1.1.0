"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/profile", label: "My Profile", tone: "bg-slate-700 hover:bg-slate-800" },
  { href: "/profile/security", label: "Security Centre", tone: "bg-blue-700 hover:bg-blue-800" },
  { href: "/profile/access", label: "Roles & Access", tone: "bg-violet-700 hover:bg-violet-800" },
  { href: "/profile/activity", label: "My Activity", tone: "bg-emerald-700 hover:bg-emerald-800" },
  { href: "/dashboard", label: "Dashboard", tone: "bg-cyan-700 hover:bg-cyan-800" },
];

export default function ProfileNavigation() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto mt-5 grid max-w-5xl grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${item.tone} inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-center text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-200 ${active ? "ring-4 ring-slate-200" : ""}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
