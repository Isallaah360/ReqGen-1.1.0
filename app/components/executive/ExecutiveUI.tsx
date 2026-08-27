"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type ExecutiveTone = "slate" | "blue" | "cyan" | "emerald" | "violet" | "amber" | "rose";

const gradients: Record<ExecutiveTone, string> = {
  slate: "from-slate-950 to-slate-700",
  blue: "from-blue-800 to-blue-600",
  cyan: "from-cyan-700 to-sky-600",
  emerald: "from-emerald-700 to-teal-600",
  violet: "from-violet-800 to-purple-600",
  amber: "from-amber-600 to-orange-500",
  rose: "from-rose-700 to-red-600",
};

export function ExecutiveShell({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe_0,_#f8fafc_34%,_#eef2ff_100%)] px-3 py-6 sm:px-6 lg:px-8">{children}</main>;
}

export function ExecutiveHero({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-800 px-5 py-8 text-white shadow-2xl sm:px-8 lg:px-10">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-blue-100 sm:text-base">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}

export function ExecutiveActionLink({ href, children, tone = "blue" }: { href: string; children: ReactNode; tone?: ExecutiveTone }) {
  return <Link href={href} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${gradients[tone]} px-4 py-2.5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-200`}>{children}</Link>;
}

export function ExecutiveActionButton({ children, onClick, tone = "blue", disabled = false }: { children: ReactNode; onClick?: () => void; tone?: ExecutiveTone; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${gradients[tone]} px-4 py-2.5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50`}>{children}</button>;
}

export function ExecutiveStatCard({ label, value, note, icon: Icon, tone = "blue" }: { label: string; value: ReactNode; note?: string; icon?: LucideIcon; tone?: ExecutiveTone }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
      <div className={`h-1.5 bg-gradient-to-r ${gradients[tone]}`} />
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">{label}</p>
          <div className="mt-2 text-3xl font-black text-slate-950">{value}</div>
          {note ? <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{note}</p> : null}
        </div>
        {Icon ? <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${gradients[tone]} text-white shadow-md`}><Icon className="h-5 w-5" /></div> : null}
      </div>
    </article>
  );
}

export function ExecutivePanel({ eyebrow, title, description, action, children }: { eyebrow?: string; title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-5 shadow-sm backdrop-blur sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {eyebrow ? <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">{eyebrow}</p> : null}
          <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">{title}</h2>
          {description ? <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ExecutiveBadge({ children, tone = "slate" }: { children: ReactNode; tone?: ExecutiveTone }) {
  const classes: Record<ExecutiveTone, string> = {
    slate: "border-slate-200 bg-slate-100 text-slate-700",
    blue: "border-blue-200 bg-blue-100 text-blue-800",
    cyan: "border-cyan-200 bg-cyan-100 text-cyan-800",
    emerald: "border-emerald-200 bg-emerald-100 text-emerald-800",
    violet: "border-violet-200 bg-violet-100 text-violet-800",
    amber: "border-amber-200 bg-amber-100 text-amber-800",
    rose: "border-rose-200 bg-rose-100 text-rose-800",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${classes[tone]}`}>{children}</span>;
}

export function ExecutiveEmpty({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center"><div className="text-base font-black text-slate-900">{title}</div><p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-slate-500">{description}</p></div>;
}

export function ExecutiveLoading() {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-200" />)}</div>;
}
