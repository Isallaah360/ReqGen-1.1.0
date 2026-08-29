"use client";

import type { ReactNode } from "react";

type Tone = "blue" | "cyan" | "emerald" | "violet" | "amber" | "rose" | "slate";

const toneMap: Record<Tone, { card: string; icon: string; bar: string }> = {
  blue: { card: "border-blue-200 bg-gradient-to-br from-white to-blue-50", icon: "bg-blue-600 text-white", bar: "bg-blue-600" },
  cyan: { card: "border-cyan-200 bg-gradient-to-br from-white to-cyan-50", icon: "bg-cyan-600 text-white", bar: "bg-cyan-600" },
  emerald: { card: "border-emerald-200 bg-gradient-to-br from-white to-emerald-50", icon: "bg-emerald-600 text-white", bar: "bg-emerald-600" },
  violet: { card: "border-violet-200 bg-gradient-to-br from-white to-violet-50", icon: "bg-violet-600 text-white", bar: "bg-violet-600" },
  amber: { card: "border-amber-200 bg-gradient-to-br from-white to-amber-50", icon: "bg-amber-500 text-white", bar: "bg-amber-500" },
  rose: { card: "border-rose-200 bg-gradient-to-br from-white to-rose-50", icon: "bg-rose-600 text-white", bar: "bg-rose-600" },
  slate: { card: "border-slate-200 bg-gradient-to-br from-white to-slate-50", icon: "bg-slate-900 text-white", bar: "bg-slate-800" },
};

export function ReportIcon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const paths: Record<string, ReactNode> = {
    report: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h7M9 11h7"/></>,
    refresh: <><path d="M20 11a8 8 0 1 0 2 5"/><path d="M20 4v7h-7"/></>,
    download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
    print: <><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></>,
    request: <><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></>,
    money: <><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9h2M16 15h2"/></>,
    building: <><path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h1M14 10h1M9 14h1M14 14h1M10 21v-3h4v3"/></>,
    check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    chart: <><path d="M3 3v18h18"/><path d="m7 16 4-5 3 3 5-7"/></>,
    filter: <><path d="M4 5h16M7 12h10M10 19h4"/></>,
    warning: <><path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></>,
    chevron: <path d="m7 10 5 5 5-5"/>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className}>{paths[name] || paths.report}</svg>;
}

export function ReportsHero({ actions }: { actions: ReactNode }) {
  return <header className="rg-module-header"><div className="rg-module-heading"><p className="rg-module-eyebrow"><ReportIcon name="report" className="h-4 w-4"/>Reports</p><h1>Reports Centre / Executive Overview</h1><p className="rg-module-description">Executive summary of key performance indicators and institutional insights from authorised ReqGen records.</p></div><div className="rg-module-actions">{actions}</div></header>;
}

export function ReportButton({ children, onClick, icon, variant = "blue", disabled = false }: { children: ReactNode; onClick?: () => void; icon: string; variant?: "light" | "blue" | "violet" | "cyan"; disabled?: boolean }) {
  const variants = {
    light: "bg-white text-slate-900 hover:bg-slate-100",
    blue: "bg-blue-600 text-white hover:bg-blue-700",
    violet: "bg-violet-600 text-white hover:bg-violet-700",
    cyan: "bg-cyan-600 text-white hover:bg-cyan-700",
  };
  return <button type="button" onClick={onClick} disabled={disabled} className={`rg-action-button ${variants[variant]}`}><ReportIcon name={icon} className="h-4 w-4"/>{children}</button>;
}

export function ReportStat({ label, value, note, icon, tone = "blue", progress }: { label: string; value: ReactNode; note: string; icon: string; tone?: Tone; progress?: number }) {
  const t = toneMap[tone];
  return <article className={`group rg-stat-card border bg-white p-4 transition duration-150 hover:-translate-y-0.5`}>
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-500">{label}</p><div className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</div><p className="mt-2 text-xs leading-5 text-slate-500">{note}</p></div><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-lg ${t.icon}`}><ReportIcon name={icon}/></div></div>
    {typeof progress === "number" && <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${t.bar}`} style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}/></div>}
  </article>;
}

export function ReportSection({ title, description, icon, action, children, className = "" }: { title: string; description: string; icon: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`rg-section-card bg-white ${className}`}><div className="rg-section-card-head flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700"><ReportIcon name={icon}/></div><div><h2 className="text-[13px] font-black text-slate-950">{title}</h2><p className="mt-0.5 text-[11px] text-slate-500">{description}</p></div></div>{action}</div>{children}</section>;
}

export function ReportsSkeleton() {
  return <div className="rg-module-page rg-adopted-page"><div className="space-y-4"><div className="report-skeleton h-20 rounded-xl"/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length:8}).map((_,i)=><div key={i} className="report-skeleton h-36 rounded-2xl"/>)}</div><div className="grid gap-6 xl:grid-cols-3"><div className="report-skeleton h-96 rounded-3xl xl:col-span-2"/><div className="report-skeleton h-96 rounded-3xl"/></div></div></div>;
}

export function ReportsPageStyles() {
  return <style jsx global>{`
    @keyframes reportFloat { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(-12px,12px,0)} }
    @keyframes reportShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    .report-float{animation:reportFloat 7s ease-in-out infinite}
    .report-skeleton{background:linear-gradient(90deg,#e2e8f0 25%,#f8fafc 50%,#e2e8f0 75%);background-size:200% 100%;animation:reportShimmer 1.5s infinite}
    @media print { .report-no-print, nav { display:none !important } body{background:#fff !important} .report-print-shell{padding:0 !important;max-width:none !important} .report-print-card{box-shadow:none !important;break-inside:avoid} }
  `}</style>;
}
