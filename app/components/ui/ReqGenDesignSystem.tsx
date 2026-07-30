"use client";

import type { ReactNode } from "react";
import Link from "next/link";

type Tone = "navy" | "blue" | "cyan" | "emerald" | "violet" | "amber" | "rose" | "slate";

const tones: Record<Tone, { card: string; icon: string; bar: string; button: string }> = {
  navy: { card: "border-slate-200 bg-white", icon: "bg-slate-900 text-white", bar: "bg-slate-900", button: "bg-slate-900 text-white hover:bg-slate-800" },
  blue: { card: "border-blue-100 bg-gradient-to-br from-white to-blue-50/70", icon: "bg-blue-600 text-white", bar: "bg-blue-600", button: "bg-blue-600 text-white hover:bg-blue-700" },
  cyan: { card: "border-cyan-100 bg-gradient-to-br from-white to-cyan-50/70", icon: "bg-cyan-600 text-white", bar: "bg-cyan-500", button: "bg-cyan-600 text-white hover:bg-cyan-700" },
  emerald: { card: "border-emerald-100 bg-gradient-to-br from-white to-emerald-50/70", icon: "bg-emerald-600 text-white", bar: "bg-emerald-500", button: "bg-emerald-600 text-white hover:bg-emerald-700" },
  violet: { card: "border-violet-100 bg-gradient-to-br from-white to-violet-50/70", icon: "bg-violet-600 text-white", bar: "bg-violet-500", button: "bg-violet-600 text-white hover:bg-violet-700" },
  amber: { card: "border-amber-100 bg-gradient-to-br from-white to-amber-50/70", icon: "bg-amber-500 text-white", bar: "bg-amber-500", button: "bg-amber-500 text-white hover:bg-amber-600" },
  rose: { card: "border-rose-100 bg-gradient-to-br from-white to-rose-50/70", icon: "bg-rose-600 text-white", bar: "bg-rose-500", button: "bg-rose-600 text-white hover:bg-rose-700" },
  slate: { card: "border-slate-200 bg-gradient-to-br from-white to-slate-50", icon: "bg-slate-600 text-white", bar: "bg-slate-500", button: "bg-slate-600 text-white hover:bg-slate-700" },
};

export function ReqGenPageStyles() {
  return (
    <style jsx global>{`
      @keyframes reqgen-float { 0%,100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(0,-8px,0); } }
      @keyframes reqgen-shimmer { 0% { background-position: -700px 0; } 100% { background-position: 700px 0; } }
      .reqgen-float { animation: reqgen-float 6s ease-in-out infinite; }
      .reqgen-skeleton { background: linear-gradient(90deg,#e2e8f0 25%,#f8fafc 45%,#e2e8f0 65%); background-size: 1400px 100%; animation: reqgen-shimmer 1.7s linear infinite; }
    `}</style>
  );
}

export function Icon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const paths: Record<string, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    request: <><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></>,
    approval: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></>,
    money: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h.01M6 9h2M6 15h2"/><circle cx="12" cy="12" r="2.5"/></>,
    building: <><path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h1M14 10h1M9 14h1M14 14h1M10 21v-3h4v3"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    chart: <><path d="M3 3v18h18"/><path d="m7 16 4-5 3 3 5-7"/></>,
    refresh: <><path d="M20 11a8 8 0 1 0 2 5"/><path d="M20 4v7h-7"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    audit: <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
    voucher: <><path d="M4 2h16v20l-4-2-4 2-4-2-4 2z"/><path d="M8 7h8M8 11h8M8 15h5"/></>,
    alert: <><path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    report: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h7M9 11h7"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.7 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.5 4.7a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.17.36.38.69.6 1 .28.38.67.6 1.1.6h.09v4h-.09a1.7 1.7 0 0 0-1.7.4z"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className}>{paths[name] || paths.dashboard}</svg>;
}

export function ExecutiveHero({ eyebrow, title, description, actions, meta }: { eyebrow: string; title: string; description: string; actions?: ReactNode; meta?: ReactNode }) {
  return <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 px-6 py-8 text-white shadow-2xl shadow-blue-950/20 sm:px-9 sm:py-10">
    <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl reqgen-float" />
    <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
    <div className="relative z-10 flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
      <div className="max-w-3xl"><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-cyan-100"><Icon name="dashboard" className="h-4 w-4" />{eyebrow}</div><h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">{title}</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">{description}</p>{meta && <div className="mt-5">{meta}</div>}</div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  </section>;
}

export function ActionButton({ href, onClick, icon = "arrow", children, variant = "light", disabled = false }: { href?: string; onClick?: () => void; icon?: string; children: ReactNode; variant?: "light" | "primary" | "ghost"; disabled?: boolean }) {
  const cls = variant === "primary" ? "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-950/20" : variant === "ghost" ? "border border-white/20 bg-white/10 text-white hover:bg-white/20" : "bg-white text-slate-900 hover:bg-slate-100 shadow-lg shadow-slate-950/10";
  const content = <><Icon name={icon} className="h-4 w-4" /><span>{children}</span></>;
  if (href) return <Link href={href} className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-extrabold transition duration-200 hover:-translate-y-0.5 ${cls} focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60`}>{content}</Link>;
  return <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-extrabold transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${cls} focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200`}>{content}</button>;
}

export function StatCard({ label, value, note, icon, tone = "blue", progress }: { label: string; value: ReactNode; note?: string; icon: string; tone?: Tone; progress?: number }) {
  const t = tones[tone];
  return <article className={`group relative overflow-hidden rounded-2xl border p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl ${t.card}`}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">{label}</p><div className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</div>{note && <p className="mt-2 text-xs leading-5 text-slate-500">{note}</p>}</div><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-lg transition group-hover:scale-105 ${t.icon}`}><Icon name={icon} /></div></div>{typeof progress === "number" && <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${t.bar}`} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div>}</article>;
}

export function SectionCard({ title, description, icon = "chart", action, children, className = "" }: { title: string; description?: string; icon?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-white"><Icon name={icon} className="h-5 w-5" /></div><div><h2 className="text-lg font-black text-slate-950">{title}</h2>{description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}</div></div>{action}</div>{children}</section>;
}

export function QuickAction({ href, title, description, icon, tone = "blue" }: { href: string; title: string; description: string; icon: string; tone?: Tone }) {
  const t = tones[tone];
  return <Link href={href} className={`group flex min-h-[118px] items-start gap-4 rounded-2xl border p-4 transition duration-300 hover:-translate-y-1 hover:shadow-lg ${t.card} focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60`}><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${t.icon}`}><Icon name={icon} /></div><div><h3 className="font-extrabold text-slate-950 group-hover:text-blue-700">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div></Link>;
}

export function StatusBadge({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  const map: Record<Tone,string> = { navy:"border-slate-300 bg-slate-100 text-slate-800", blue:"border-blue-200 bg-blue-50 text-blue-700", cyan:"border-cyan-200 bg-cyan-50 text-cyan-700", emerald:"border-emerald-200 bg-emerald-50 text-emerald-700", violet:"border-violet-200 bg-violet-50 text-violet-700", amber:"border-amber-200 bg-amber-50 text-amber-800", rose:"border-rose-200 bg-rose-50 text-rose-700", slate:"border-slate-200 bg-slate-50 text-slate-700" };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide ${map[tone]}`}>{children}</span>;
}

export function SkeletonDashboard() {
  return <div className="min-h-screen bg-slate-100 p-4 sm:p-7"><div className="mx-auto max-w-[1500px] space-y-6"><div className="reqgen-skeleton h-64 rounded-[30px]"/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length:8}).map((_,i)=><div key={i} className="reqgen-skeleton h-36 rounded-2xl"/>)}</div><div className="grid gap-6 xl:grid-cols-3"><div className="reqgen-skeleton h-96 rounded-3xl xl:col-span-2"/><div className="reqgen-skeleton h-96 rounded-3xl"/></div></div></div>;
}
