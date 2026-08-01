"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["Registry Dashboard", "/registry", "slate"],
  ["Operations Centre", "/registry/operations", "blue"],
  ["Incoming", "/registry/incoming", "cyan"],
  ["Outgoing", "/registry/outgoing", "violet"],
  ["Dispatch", "/registry/dispatch", "emerald"],
  ["Archive", "/registry/archive", "amber"],
] as const;

const tones: Record<string, string> = {
  slate: "from-slate-800 to-slate-600",
  blue: "from-blue-800 to-blue-600",
  cyan: "from-cyan-700 to-sky-600",
  violet: "from-violet-800 to-purple-600",
  emerald: "from-emerald-700 to-teal-600",
  amber: "from-amber-600 to-orange-500",
};

export default function RegistryNavigation() {
  const pathname = usePathname();
  return (
    <nav className="mx-auto grid max-w-5xl gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-3" aria-label="Registry navigation">
      {items.map(([label, href, tone]) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href} className={`inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r ${tones[tone]} px-4 py-3 text-center text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg ${active ? "ring-4 ring-blue-100" : ""}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
