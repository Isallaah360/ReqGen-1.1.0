"use client";

import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

export type HRTone = "blue" | "cyan" | "emerald" | "amber" | "rose" | "violet" | "slate";

const gradients: Record<HRTone, string> = {
  blue: "from-blue-700 to-indigo-800",
  cyan: "from-cyan-600 to-blue-800",
  emerald: "from-emerald-600 to-teal-800",
  amber: "from-amber-500 to-orange-700",
  rose: "from-rose-600 to-red-800",
  violet: "from-violet-600 to-purple-800",
  slate: "from-slate-700 to-slate-950",
};

export function HRPageShell({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,.10),_transparent_34%),linear-gradient(to_bottom,#f8fafc,#eef2ff)] px-4 py-8 lg:px-8"><div className="mx-auto max-w-7xl space-y-6">{children}</div></main>;
}

export function HRHero({ eyebrow, title, description, icon: Icon, tone = "blue", action }: { eyebrow: string; title: string; description: string; icon: LucideIcon; tone?: HRTone; action?: ReactNode }) {
  return <section className={`relative overflow-hidden rounded-[2rem] bg-gradient-to-br ${gradients[tone]} p-7 text-white shadow-2xl lg:p-9`}>
    <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="max-w-4xl"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25"><Icon className="h-7 w-7" /></span><p className="text-xs font-black uppercase tracking-[.25em] text-white/75">{eyebrow}</p></div><h1 className="mt-4 text-3xl font-black tracking-tight lg:text-5xl">{title}</h1><p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/80 lg:text-base">{description}</p></div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  </section>;
}

export function HRStatCard({ label, value, note, icon: Icon, tone = "blue" }: { label: string; value: string | number; note: string; icon: LucideIcon; tone?: HRTone }) {
  return <article className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradients[tone]} p-5 text-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl`}><div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" /><div className="relative flex items-start justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-[.18em] text-white/70">{label}</p><p className="mt-3 text-3xl font-black">{value}</p><p className="mt-2 text-xs font-semibold leading-5 text-white/75">{note}</p></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20"><Icon className="h-6 w-6" /></span></div></article>;
}

export function HRPanel({ title, eyebrow, action, children }: { title: string; eyebrow?: string; action?: ReactNode; children: ReactNode }) {
  return <section className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-lg backdrop-blur-xl"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div>{eyebrow ? <p className="text-[11px] font-black uppercase tracking-[.2em] text-blue-700">{eyebrow}</p> : null}<h2 className="mt-1 text-xl font-black text-slate-950 lg:text-2xl">{title}</h2></div>{action}</div>{children}</section>;
}

export function HRButton({ children, onClick, disabled, tone = "blue", type = "button" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; tone?: HRTone; type?: "button" | "submit" }) {
  return <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${gradients[tone]} px-4 py-2.5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50`}>{children}</button>;
}

export function HRRefreshButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return <HRButton onClick={onClick} disabled={loading} tone="cyan"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{loading ? "Refreshing..." : "Refresh"}</HRButton>;
}

export function HRBadge({ value, tone = "slate" }: { value: string; tone?: HRTone }) {
  const cls: Record<HRTone, string> = { blue:"border-blue-200 bg-blue-50 text-blue-700",cyan:"border-cyan-200 bg-cyan-50 text-cyan-700",emerald:"border-emerald-200 bg-emerald-50 text-emerald-700",amber:"border-amber-200 bg-amber-50 text-amber-800",rose:"border-rose-200 bg-rose-50 text-rose-700",violet:"border-violet-200 bg-violet-50 text-violet-700",slate:"border-slate-200 bg-slate-100 text-slate-700" };
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${cls[tone]}`}>{pretty(value)}</span>;
}

export function HREmpty({ title = "No records found", description = "There is no matching record for the selected view." }: { title?: string; description?: string }) {
  return <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center"><Inbox className="mx-auto h-10 w-10 text-slate-400" /><p className="mt-3 font-black text-slate-800">{title}</p><p className="mt-1 text-sm font-semibold text-slate-500">{description}</p></div>;
}

export function HRAlert({ message }: { message: string }) {
  return <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><span>{message}</span></div>;
}

export function pretty(value: string | null | undefined) { return (value || "Not available").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }
export function formatDate(value: string | null | undefined) { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
export function formatDateTime(value: string | null | undefined) { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }); }
