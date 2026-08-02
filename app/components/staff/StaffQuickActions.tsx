import Link from "next/link";
import type { ReactNode } from "react";

type ActionTone = "blue" | "cyan" | "emerald" | "violet" | "amber" | "rose" | "slate";

const tones: Record<ActionTone, string> = {
  blue: "from-blue-800 to-blue-600",
  cyan: "from-cyan-700 to-sky-500",
  emerald: "from-emerald-700 to-teal-500",
  violet: "from-violet-800 to-purple-600",
  amber: "from-amber-600 to-orange-500",
  rose: "from-rose-700 to-red-500",
  slate: "from-slate-950 to-slate-700",
};

type ActionItem = {
  title: string;
  description: string;
  href: string;
  tone?: ActionTone;
  icon?: ReactNode;
};

export default function StaffQuickActions({ items }: { items: ActionItem[] }) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-sm backdrop-blur sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Quick Access</p>
        <h2 className="mt-1 text-xl font-black text-slate-950">Staff Actions</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`group rounded-2xl bg-gradient-to-r ${tones[item.tone || "blue"]} p-4 text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg`}
          >
            <div className="flex items-start gap-3">
              {item.icon ? (
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15">
                  {item.icon}
                </div>
              ) : null}
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide text-white">{item.title}</h3>
                <p className="mt-1 text-xs font-semibold leading-5 text-white/85">{item.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
