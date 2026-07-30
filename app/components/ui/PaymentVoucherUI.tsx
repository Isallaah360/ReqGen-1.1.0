"use client";

import type { ReactNode } from "react";

export function PVHero({
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
    <section className="relative overflow-hidden rounded-[2rem] border border-blue-400/20 bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-6 text-white shadow-[0_24px_70px_-35px_rgba(15,23,42,.9)] sm:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-300/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-60 w-60 rounded-full bg-violet-400/15 blur-3xl" />
      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100 backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,.9)]" />
            {eyebrow}
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

export function PVActionButton({
  children,
  onClick,
  disabled,
  tone = "blue",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "blue" | "cyan" | "violet" | "emerald" | "orange" | "slate" | "danger";
  type?: "button" | "submit";
}) {
  const tones = {
    blue: "border-blue-700 bg-blue-700 text-white hover:bg-blue-800 focus:ring-blue-200",
    cyan: "border-cyan-700 bg-cyan-700 text-white hover:bg-cyan-800 focus:ring-cyan-200",
    violet: "border-violet-700 bg-violet-700 text-white hover:bg-violet-800 focus:ring-violet-200",
    emerald: "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 focus:ring-emerald-200",
    orange: "border-orange-600 bg-orange-600 text-white hover:bg-orange-700 focus:ring-orange-200",
    slate: "border-slate-700 bg-slate-700 text-white hover:bg-slate-800 focus:ring-slate-200",
    danger: "border-rose-700 bg-rose-700 text-white hover:bg-rose-800 focus:ring-rose-200",
  } as const;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-12 min-w-[150px] items-center justify-center rounded-xl border px-5 py-3 text-sm font-black tracking-[0.01em] shadow-md backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

export function PVSectionHeader({
  title,
  description,
  badge,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div>
        <h2 className="text-base font-black uppercase tracking-[0.08em] text-slate-900 sm:text-lg">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
      {badge}
    </div>
  );
}
