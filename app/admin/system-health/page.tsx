"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AdminNavigation from "@/app/components/admin/AdminNavigation";
import { ActionButton, EnterpriseHero, EnterpriseShell, SectionCard, StatCard, StatusBadge } from "@/app/components/enterprise/EnterpriseUI";
import { dateText, normalizeRows } from "@/app/components/enterprise/data";

type Check = { name: string; table: string; rows: number; ok: boolean; checkedAt: string; message: string };
const checks = ["profiles", "profile_roles", "requests", "notifications", "departments", "payment_vouchers", "finance_transactions", "hr_officer_assignments"];

export default function SystemHealthPage() {
  const [loading, setLoading] = useState(true); const [items, setItems] = useState<Check[]>([]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const results = await Promise.all(checks.map(async (table) => {
        const { data, error } = await supabase.from(table).select("*").limit(5);
        const rows = normalizeRows(data).length;
        return { name: table.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), table, rows, ok: !error, checkedAt: now, message: error?.message ?? "Data source reachable" };
      }));
      setItems(results);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);
  const healthy = items.filter((item) => item.ok).length;
  return <EnterpriseShell><div className="mx-auto max-w-[1400px] space-y-6"><AdminNavigation /><EnterpriseHero eyebrow="System Health" title="System Health Centre" description="A lightweight operational check of key ReqGen data sources under the active Admin role. This does not replace Supabase monitoring or Vercel observability." actions={<ActionButton tone="cyan" onClick={() => void load()}>{loading ? "Checking..." : "Run Health Check"}</ActionButton>} /><section className="grid gap-4 sm:grid-cols-3"><StatCard label="Healthy Sources" value={healthy} note={`${items.length} sources checked`} tone="emerald" /><StatCard label="Attention Required" value={items.length - healthy} note="Unavailable or restricted sources" tone="rose" /><StatCard label="Health Percentage" value={`${items.length ? Math.round(healthy / items.length * 100) : 0}%`} note="Current application-level check" tone="blue" /></section><SectionCard title="Data Source Health" eyebrow="Checks"><div className="grid gap-3 lg:grid-cols-2">{items.map((item) => <article key={item.table} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-slate-950">{item.name}</h3><p className="mt-1 text-sm font-semibold text-slate-600">{item.message}</p><p className="mt-2 text-xs font-bold text-slate-400">Checked {dateText(item.checkedAt)}</p></div><StatusBadge tone={item.ok ? "emerald" : "rose"}>{item.ok ? "Healthy" : "Attention"}</StatusBadge></div></article>)}</div></SectionCard></div></EnterpriseShell>;
}
