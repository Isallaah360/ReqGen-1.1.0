"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type ExecTone = "blue" | "cyan" | "emerald" | "violet" | "amber" | "rose" | "slate";
const tones: Record<ExecTone, string> = {
  blue: "from-blue-800 to-blue-600", cyan: "from-cyan-700 to-sky-600",
  emerald: "from-emerald-700 to-teal-600", violet: "from-violet-800 to-purple-600",
  amber: "from-amber-600 to-orange-500", rose: "from-rose-700 to-red-600",
  slate: "from-slate-950 to-slate-700",
};

export function ExecHero({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <section className="relative overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-800 p-6 text-white shadow-2xl sm:p-9">
    <div className="absolute -right-12 -top-20 h-56 w-56 rounded-full bg-cyan-300/15 blur-3xl" />
    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-4xl"><p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-200">{eyebrow}</p><h1 className="mt-3 text-3xl font-black sm:text-5xl">{title}</h1><p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-blue-100 sm:text-base">{description}</p></div>
      {children ? <div className="flex flex-wrap gap-3">{children}</div> : null}
    </div>
  </section>;
}

export function ExecButton({ children, onClick, tone="blue", disabled=false }: { children: ReactNode; onClick?:()=>void; tone?: ExecTone; disabled?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${tones[tone]} px-4 py-2.5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 disabled:opacity-50`}>{children}</button>;
}
export function ExecLink({ href, children, tone="blue" }: { href: string; children: ReactNode; tone?: ExecTone }) {
  return <Link href={href} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${tones[tone]} px-4 py-2.5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5`}>{children}</Link>;
}
export function ExecStat({ label, value, note, icon: Icon, tone="blue" }: { label:string; value:ReactNode; note:string; icon:LucideIcon; tone?:ExecTone }) {
  return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className={`h-1.5 bg-gradient-to-r ${tones[tone]}`} /><div className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">{label}</p><div className="mt-2 text-3xl font-black text-slate-950">{value}</div></div><span className={`rounded-xl bg-gradient-to-br ${tones[tone]} p-2.5 text-white`}><Icon className="h-5 w-5" /></span></div><p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{note}</p></div></article>;
}
export function ExecSection({ title, eyebrow, children, action }: { title:string; eyebrow?:string; children:ReactNode; action?:ReactNode }) {
  return <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div>{eyebrow && <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">{eyebrow}</p>}<h2 className="mt-1 text-xl font-black text-slate-950">{title}</h2></div>{action}</div>{children}</section>;
}
export function ExecEmpty({ title, description }: {title:string; description:string}) { return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center"><p className="font-black text-slate-900">{title}</p><p className="mt-2 text-sm font-semibold text-slate-500">{description}</p></div>; }
export function MiniBar({ label, value, total=100 }: {label:string; value:number; total?:number}) { const pct=Math.max(0,Math.min(100,total?value/total*100:0)); return <div><div className="mb-2 flex justify-between text-xs font-black text-slate-600"><span>{label}</span><span>{value.toFixed(1)}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-700 to-cyan-500" style={{width:`${pct}%`}} /></div></div>; }
