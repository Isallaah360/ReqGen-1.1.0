"use client";

import type { ReactNode } from "react";

type Tone = "blue" | "cyan" | "emerald" | "violet" | "amber" | "rose" | "slate" | "fuchsia";

const toneMap: Record<Tone, string> = {
  blue: "from-blue-600 to-blue-800",
  cyan: "from-cyan-500 to-sky-700",
  emerald: "from-emerald-600 to-green-800",
  violet: "from-violet-600 to-purple-800",
  amber: "from-amber-500 to-orange-700",
  rose: "from-rose-600 to-red-800",
  slate: "from-slate-700 to-slate-950",
  fuchsia: "from-fuchsia-600 to-purple-900",
};

export function AdminHero({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-blue-900/20 bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 px-6 py-8 text-white shadow-2xl sm:px-9 sm:py-10">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-100 backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,.95)]" />
            {eyebrow}
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-blue-100 sm:text-base">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}

export function AdminKpiCard({
  label,
  value,
  note,
  tone = "blue",
  icon,
}: {
  label: string;
  value: ReactNode;
  note?: string;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl">
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${toneMap[tone]}`} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.17em] text-slate-500">{label}</p>
          <div className="mt-3 text-2xl font-black tracking-tight text-slate-950">{value}</div>
          {note ? <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{note}</p> : null}
        </div>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${toneMap[tone]} text-white shadow-lg`}>
          {icon ?? <span className="text-lg font-black">•</span>}
        </div>
      </div>
    </div>
  );
}

export function AdminSection({
  eyebrow,
  title,
  description,
  children,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          {eyebrow ? <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">{eyebrow}</p> : null}
          <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">{title}</h2>
          {description ? <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function AdminPrimaryButton({ children, onClick, tone = "blue", disabled, type = "button" }: { children: ReactNode; onClick?: () => void; tone?: Tone; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`min-h-11 rounded-xl bg-gradient-to-r ${toneMap[tone]} px-5 py-3 text-sm font-black text-white shadow-md transition duration-200 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50`}>
      {children}
    </button>
  );
}
