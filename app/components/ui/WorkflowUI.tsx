"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type WorkflowIconName =
  | "plus"
  | "arrow-left"
  | "refresh"
  | "dashboard"
  | "request"
  | "edit"
  | "approval"
  | "shield"
  | "attachment"
  | "money"
  | "timeline";

export function WorkflowIcon({ name, className = "h-5 w-5" }: { name: WorkflowIconName; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<WorkflowIconName, ReactNode> = {
    plus: <><path d="M12 5v14M5 12h14" /></>,
    "arrow-left": <><path d="m15 18-6-6 6-6" /><path d="M9 12h10" /></>,
    refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>,
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    request: <><path d="M7 3h8l4 4v14H7z" /><path d="M15 3v5h5" /><path d="M10 13h6M10 17h6" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
    approval: <><path d="M9 11l2 2 4-4" /><path d="M12 22c5-2 8-6 8-11V5l-8-3-8 3v6c0 5 3 9 8 11Z" /></>,
    shield: <><path d="M12 22c5-2 8-6 8-11V5l-8-3-8 3v6c0 5 3 9 8 11Z" /><path d="M9 12l2 2 4-4" /></>,
    attachment: <><path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.4-9.4a4 4 0 0 1 5.7 5.7L9.7 17.7a2 2 0 0 1-2.8-2.8l8.7-8.7" /></>,
    money: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h.01M17 14h.01" /><circle cx="12" cy="12" r="2" /></>,
    timeline: <><path d="M6 3v18" /><circle cx="6" cy="6" r="2" /><circle cx="6" cy="12" r="2" /><circle cx="6" cy="18" r="2" /><path d="M10 6h8M10 12h8M10 18h8" /></>,
  };

  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...common}>{paths[name]}</svg>;
}

export function WorkflowHero({
  eyebrow,
  title,
  description,
  icon,
  actions,
  meta,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: WorkflowIconName;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <section className="workflow-hero relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 px-6 py-8 text-white shadow-[0_24px_70px_-35px_rgba(15,23,42,.9)] sm:px-8 lg:px-10 lg:py-10">
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl workflow-float" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-60 w-60 rounded-full bg-blue-500/25 blur-3xl workflow-float workflow-delay" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[.22em] text-cyan-100 backdrop-blur">
            <WorkflowIcon name={icon} className="h-4 w-4" />
            {eyebrow}
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">{description}</p>
          {meta ? <div className="mt-3 text-xs font-semibold text-cyan-100/90">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-3 lg:justify-end">{actions}</div> : null}
      </div>
    </section>
  );
}

export function WorkflowAction({
  children,
  icon,
  tone = "blue",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: WorkflowIconName;
  tone?: "blue" | "cyan" | "violet" | "emerald" | "rose" | "white";
}) {
  const tones = {
    blue: "bg-blue-600 text-white hover:bg-blue-500 focus:ring-blue-300/40",
    cyan: "bg-cyan-400 text-white hover:bg-cyan-300 focus:ring-cyan-200/50",
    violet: "bg-violet-600 text-white hover:bg-violet-500 focus:ring-violet-300/40",
    emerald: "bg-emerald-500 text-white hover:bg-emerald-400 focus:ring-emerald-300/40",
    rose: "bg-rose-500 text-white hover:bg-rose-400 focus:ring-rose-300/40",
    white: "border border-white/20 bg-white/10 text-white hover:bg-white/20 focus:ring-white/30",
  };
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black shadow-sm transition duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${tones[tone]} ${props.className || ""}`}
    >
      <WorkflowIcon name={icon} className="h-4 w-4" />
      {children}
    </button>
  );
}

export function WorkflowLoading({ title = "Loading workspace..." }: { title?: string }) {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-5 animate-pulse">
        <div className="h-64 rounded-[2rem] bg-gradient-to-br from-slate-900 via-blue-950 to-blue-700 blur-[1px]" />
        <div className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 rounded-2xl border border-slate-200 bg-white/80 blur-[.4px]" />)}
        </div>
        <div className="h-72 rounded-3xl border border-slate-200 bg-white/80 p-6 text-sm font-semibold text-slate-500 blur-[.35px]">{title}</div>
      </div>
    </main>
  );
}

export function WorkflowPageStyles() {
  return (
    <style jsx global>{`
      @keyframes workflowRise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes workflowFloat { 0%,100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(0,-10px,0); } }
      .workflow-shell > * { animation: workflowRise .5s ease both; }
      .workflow-shell > *:nth-child(2) { animation-delay: .05s; }
      .workflow-shell > *:nth-child(3) { animation-delay: .1s; }
      .workflow-float { animation: workflowFloat 7s ease-in-out infinite; }
      .workflow-delay { animation-delay: -2.5s; }
      .workflow-shell input:not([type='checkbox']):not([type='radio']),
      .workflow-shell select,
      .workflow-shell textarea { min-height: 46px; border-radius: 14px !important; border-color: rgb(203 213 225) !important; background: rgba(255,255,255,.98) !important; box-shadow: 0 1px 2px rgba(15,23,42,.04); transition: border-color .2s, box-shadow .2s, transform .2s; }
      .workflow-shell input:focus,
      .workflow-shell select:focus,
      .workflow-shell textarea:focus { border-color: rgb(37 99 235) !important; box-shadow: 0 0 0 4px rgba(59,130,246,.12) !important; }
      .workflow-shell button { transition: transform .2s, box-shadow .2s, background-color .2s, border-color .2s; }
      .workflow-shell button:hover:not(:disabled) { transform: translateY(-1px); }
      .workflow-shell .shadow-sm { box-shadow: 0 12px 35px -25px rgba(15,23,42,.45); }
      .workflow-shell .bg-white { background-color: rgba(255,255,255,.97); }
      @media (prefers-reduced-motion: reduce) { .workflow-shell > *, .workflow-float { animation: none !important; } }
    `}</style>
  );
}
