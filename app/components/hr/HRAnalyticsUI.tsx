"use client";

import { ReactNode } from "react";

export function MetricBar({ label, value, maximum = 100, note }: { label: string; value: number; maximum?: number; note?: string }) {
  const width = Math.max(0, Math.min(100, maximum > 0 ? (value / maximum) * 100 : 0));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div><p className="font-black text-slate-900">{label}</p>{note ? <p className="mt-1 text-xs font-semibold text-slate-500">{note}</p> : null}</div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">{value.toLocaleString()}</span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" style={{ width: `${width}%` }} /></div>
    </div>
  );
}

export function InsightCard({ title, description, tone = "blue" }: { title: string; description: string; tone?: "blue" | "amber" | "rose" | "emerald" }) {
  const styles = {
    blue: "border-blue-200 bg-blue-50 text-blue-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    rose: "border-rose-200 bg-rose-50 text-rose-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
  };
  return <article className={`rounded-2xl border p-4 ${styles[tone]}`}><p className="font-black">{title}</p><p className="mt-2 text-sm font-semibold leading-6 opacity-80">{description}</p></article>;
}

export function DataTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50"><tr>{headers.map((header) => <th key={header} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-600">{header}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>
      </table>
    </div>
  );
}
