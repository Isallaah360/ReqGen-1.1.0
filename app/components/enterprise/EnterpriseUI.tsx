"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type Tone = "slate" | "blue" | "cyan" | "emerald" | "violet" | "amber" | "rose";

const toneMap: Record<Tone, string> = {
  slate: "from-slate-950 to-slate-700",
  blue: "from-blue-800 to-blue-600",
  cyan: "from-cyan-700 to-sky-600",
  emerald: "from-emerald-700 to-teal-600",
  violet: "from-violet-800 to-purple-600",
  amber: "from-amber-600 to-orange-500",
  rose: "from-rose-700 to-red-600",
};

export function EnterpriseShell({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-slate-50 px-3 py-6 sm:px-6 lg:px-8">{children}</main>;
}

export function EnterpriseHero({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <section className="relative mx-auto max-w-[1500px] overflow-hidden rounded-[2rem] border border-blue-300/20 bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 px-5 py-8 text-white shadow-2xl sm:px-8 lg:px-10">
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-blue-100 sm:text-base">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}

export function ActionButton({ children, tone = "blue", onClick, disabled = false, type = "button" }: { children: ReactNode; tone?: Tone; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${toneMap[tone]} px-4 py-2.5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50`}>
      {children}
    </button>
  );
}

export function ActionLink({ href, children, tone = "blue" }: { href: string; children: ReactNode; tone?: Tone }) {
  return <Link href={href} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${toneMap[tone]} px-4 py-2.5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-200`}>{children}</Link>;
}

export function StatCard({ label, value, note, tone = "blue" }: { label: string; value: ReactNode; note?: string; tone?: Tone }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={`h-1.5 bg-gradient-to-r ${toneMap[tone]}`} />
      <div className="p-5">
        <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">{label}</p>
        <div className="mt-2 text-3xl font-black text-slate-950">{value}</div>
        {note ? <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{note}</p> : null}
      </div>
    </article>
  );
}

export function SectionCard({ title, eyebrow, children, action }: { title: string; eyebrow?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {eyebrow ? <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">{eyebrow}</p> : null}
          <h2 className="mt-1 text-xl font-black text-slate-950">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatusBadge({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  const classes: Record<Tone, string> = {
    slate: "border-slate-200 bg-slate-100 text-slate-700",
    blue: "border-blue-200 bg-blue-100 text-blue-800",
    cyan: "border-cyan-200 bg-cyan-100 text-cyan-800",
    emerald: "border-emerald-200 bg-emerald-100 text-emerald-800",
    violet: "border-violet-200 bg-violet-100 text-violet-800",
    amber: "border-amber-200 bg-amber-100 text-amber-800",
    rose: "border-rose-200 bg-rose-100 text-rose-800",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${classes[tone]}`}>{children}</span>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center"><div className="text-base font-black text-slate-900">{title}</div><p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-slate-500">{description}</p></div>;
}

export function LoadingGrid() {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />)}</div>;
}
