"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ActionTone = "primary" | "secondary" | "success" | "violet" | "danger" | "ghost";

const toneClasses: Record<ActionTone, string> = {
  primary:
    "border-blue-600 bg-blue-600 text-white shadow-blue-950/20 hover:border-blue-500 hover:bg-blue-500 focus-visible:ring-blue-300",
  secondary:
    "border-cyan-400 bg-cyan-400 text-slate-950 shadow-cyan-950/20 hover:border-cyan-300 hover:bg-cyan-300 focus-visible:ring-cyan-200",
  success:
    "border-emerald-600 bg-emerald-600 text-white shadow-emerald-950/20 hover:border-emerald-500 hover:bg-emerald-500 focus-visible:ring-emerald-200",
  violet:
    "border-violet-600 bg-violet-600 text-white shadow-violet-950/20 hover:border-violet-500 hover:bg-violet-500 focus-visible:ring-violet-200",
  danger:
    "border-rose-600 bg-rose-600 text-white shadow-rose-950/20 hover:border-rose-500 hover:bg-rose-500 focus-visible:ring-rose-200",
  ghost:
    "border-white/25 bg-white/10 text-white shadow-slate-950/15 hover:border-white/40 hover:bg-white/20 focus-visible:ring-white/30",
};

export function ActionButton({
  children,
  icon,
  tone = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  tone?: ActionTone;
}) {
  return (
    <button
      {...props}
      className={`reqgen-btn reqgen-btn-blue inline-flex h-12 min-w-[148px] items-center justify-center gap-2 rounded-xl border px-5 text-sm font-extrabold shadow-lg transition duration-200 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${toneClasses[tone]} ${className}`}
    >
      {icon ? <span className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span> : null}
      <span className="whitespace-nowrap">{children}</span>
    </button>
  );
}

export function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  icon,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-blue-700">
          {icon}
          {eyebrow}
        </div>
        <h2 className="mt-1 text-xl font-black text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function FilterControl({
  label,
  icon,
  children,
  className = "",
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`w-full ${className}`}>
      <label className="flex min-h-5 items-center gap-2 text-sm font-black text-slate-800">
        {icon}
        {label}
      </label>
      <div className="mt-2">{children}</div>
    </div>
  );
}
