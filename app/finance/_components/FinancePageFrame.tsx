"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type FinanceTone = "blue" | "cyan" | "emerald" | "amber" | "violet" | "rose";

const toneMap: Record<FinanceTone, { icon: string; pill: string; button: string }> = {
  blue: { icon: "bg-blue-100 text-blue-800", pill: "border-blue-200 bg-blue-50 text-blue-800", button: "bg-blue-700 hover:bg-blue-800" },
  cyan: { icon: "bg-cyan-100 text-cyan-800", pill: "border-cyan-200 bg-cyan-50 text-cyan-800", button: "bg-cyan-700 hover:bg-cyan-800" },
  emerald: { icon: "bg-emerald-100 text-emerald-800", pill: "border-emerald-200 bg-emerald-50 text-emerald-800", button: "bg-emerald-700 hover:bg-emerald-800" },
  amber: { icon: "bg-amber-100 text-amber-800", pill: "border-amber-200 bg-amber-50 text-amber-800", button: "bg-amber-600 hover:bg-amber-700" },
  violet: { icon: "bg-violet-100 text-violet-800", pill: "border-violet-200 bg-violet-50 text-violet-800", button: "bg-violet-700 hover:bg-violet-800" },
  rose: { icon: "bg-rose-100 text-rose-800", pill: "border-rose-200 bg-rose-50 text-rose-800", button: "bg-rose-700 hover:bg-rose-800" },
};

export function FinancePageFrame({
  eyebrow,
  title,
  description,
  icon,
  tone = "blue",
  badge,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
  tone?: FinanceTone;
  badge?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const toneStyle = toneMap[tone];

  return (
    <main className="min-h-screen bg-slate-50 pb-14 text-white">
      <section className="relative isolate overflow-hidden border-b border-blue-900/20 bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 text-white">
        <div className="pointer-events-none absolute -left-16 top-10 h-56 w-56 animate-pulse rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-14 -top-14 h-72 w-72 rounded-full bg-blue-300/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-24 w-72 rounded-full bg-violet-400/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl animate-[fadeUp_.55s_ease-out_both]">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] backdrop-blur">
                  <span aria-hidden="true">{icon}</span>
                  {eyebrow}
                </span>
                {badge ? <span className="rounded-full border border-cyan-200/30 bg-cyan-300/15 px-3 py-1 text-xs font-black text-cyan-100">{badge}</span> : null}
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">{title}</h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-blue-100 sm:text-base">{description}</p>
            </div>

            <div className="flex flex-wrap gap-2 animate-[fadeUp_.7s_ease-out_both]">
              <Link href="/finance" className="inline-flex items-center gap-2 border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white backdrop-blur hover:bg-white/20 font-black rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
                <span aria-hidden="true">←</span> Finance Centre
              </Link>
              {actions}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="animate-[fadeUp_.7s_ease-out_both]">{children}</div>
      </section>

      <style jsx global>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); filter: blur(4px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes softPulse {
          0%, 100% { opacity: .55; }
          50% { opacity: 1; }
        }
      `}</style>
    </main>
  );
}

export function FinanceCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6 ${className}`}>{children}</section>;
}

export function MetricCard({ label, value, icon, tone = "blue", helper }: { label: string; value: string; icon: string; tone?: FinanceTone; helper?: string }) {
  const t = toneMap[tone];
  return (
    <article className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-white">{value}</p>
          {helper ? <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p> : null}
        </div>
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xl transition group-hover:scale-110 ${t.icon}`}>{icon}</span>
      </div>
    </article>
  );
}

export function LoadingPanel({ label = "Loading finance records..." }: { label?: string }) {
  return (
    <div className="rounded-3xl border border-blue-200 bg-white/80 p-8 shadow-sm backdrop-blur">
      <div className="flex items-center gap-4">
        <div className="h-11 w-11 animate-spin rounded-full border-4 border-blue-100 border-t-blue-700" />
        <div>
          <p className="font-black text-slate-900">{label}</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">Please wait while the secure workspace is prepared.</p>
        </div>
      </div>
    </div>
  );
}

export function StatusPill({ children, tone = "blue" }: { children: ReactNode; tone?: FinanceTone }) {
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${toneMap[tone].pill}`}>{children}</span>;
}

export function PrimaryButton({ children, tone = "blue", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: FinanceTone }) {
  return <button {...props} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${toneMap[tone].button} ${props.className || ""}`}>{children}</button>;
}
