"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["/hr", "HR Dashboard"],
  ["/hr/assignments", "Officer Assignments"],
  ["/hr/filing", "HR Filing"],
  ["/hr/registrar", "Registrar Centre"],
];

export default function HRNavigation() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
      {items.map(([href, label]) => {
        const active = href === "/hr" ? pathname === href : pathname.startsWith(href);
        return <Link key={href} href={href} className={`rounded-2xl px-5 py-3 text-sm font-extrabold text-white shadow-sm transition ${active ? "bg-slate-950 ring-4 ring-slate-200" : "bg-cyan-600 hover:bg-cyan-700"}`}>{label}</Link>;
      })}
    </nav>
  );
}
