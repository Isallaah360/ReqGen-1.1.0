"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ActionButton, EnterpriseHero, EnterpriseShell, LoadingGrid, SectionCard, StatCard } from "@/app/components/enterprise/EnterpriseUI";
import { normalizeRows, numberValue, text, type GenericRow } from "@/app/components/enterprise/data";

type DataMap = Record<string, GenericRow[]>;
const sourceMap = [
  ["requests", "requests"], ["vouchers", "payment_vouchers"], ["transactions", "finance_transactions"], ["departments", "departments"], ["seminars", "hr_seminar_attendance"], ["kpis", "hr_department_kpis"], ["roles", "profile_roles"],
] as const;

function Bar({ label, value, maximum }: { label: string; value: number; maximum: number }) {
  const width = maximum > 0 ? Math.min(100, Math.max(0, (value / maximum) * 100)) : 0;
  return <div><div className="mb-1 flex items-center justify-between text-xs font-black text-slate-600"><span>{label}</span><span>{value.toLocaleString()}</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-700 to-cyan-500" style={{ width: `${width}%` }} /></div></div>;
}

export default function EnterpriseAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DataMap>({});
  const [warning, setWarning] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setWarning(null);
    try {
      const results = await Promise.all(sourceMap.map(async ([key, table]) => {
        const { data: rows, error } = await supabase.from(table).select("*").limit(1000);
        return { key, rows: normalizeRows(rows), error: error?.message ?? null };
      }));
      const next: DataMap = {}; const errors: string[] = [];
      for (const result of results) { next[result.key] = result.rows; if (result.error) errors.push(result.error); }
      setData(next); if (errors.length) setWarning("Some sources are hidden by your active role or are not yet available. Authorized intelligence is still displayed.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const metrics = useMemo(() => {
    const requests = data.requests ?? []; const vouchers = data.vouchers ?? []; const transactions = data.transactions ?? []; const seminars = data.seminars ?? []; const kpis = data.kpis ?? [];
    const activeRequests = requests.filter((r) => !["completed", "paid", "rejected", "cancelled"].some((x) => text(r.status).toLowerCase().includes(x))).length;
    const completedRequests = requests.filter((r) => ["completed", "paid"].some((x) => text(r.status).toLowerCase().includes(x))).length;
    const voucherValue = vouchers.reduce((sum, r) => sum + numberValue(r.amount || r.total_amount || r.net_amount), 0);
    const transactionValue = transactions.reduce((sum, r) => sum + numberValue(r.amount), 0);
    const attended = seminars.filter((r) => text(r.attendance_status).toLowerCase() !== "absent").length;
    const seminarRate = seminars.length ? attended / seminars.length * 100 : 0;
    const scores = kpis.map((r) => { const target = numberValue(r.target_value); return target ? numberValue(r.actual_value) / target * 100 : 0; });
    const averageKpi = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { requests: requests.length, activeRequests, completedRequests, vouchers: vouchers.length, voucherValue, transactions: transactions.length, transactionValue, departments: (data.departments ?? []).length, seminarRate, averageKpi };
  }, [data]);
  const maximum = Math.max(metrics.requests, metrics.vouchers, metrics.transactions, metrics.departments, 1);

  return <EnterpriseShell><div className="mx-auto max-w-[1500px] space-y-4">
    <EnterpriseHero eyebrow="Reports" title="Enterprise Analytics / Report Workspace" description="Explore, analyze and visualize institutional data from authorised ReqGen sources using the existing role-aware data model." actions={<ActionButton tone="cyan" onClick={() => void load()}>{loading ? "Refreshing..." : "Refresh Analytics"}</ActionButton>} />
    {warning ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{warning}</div> : null}
    {loading ? <LoadingGrid /> : <><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><StatCard label="Requests" value={metrics.requests} note={`${metrics.activeRequests} active workflow`} tone="blue" /><StatCard label="Completed Requests" value={metrics.completedRequests} note="Completed or paid" tone="emerald" /><StatCard label="Payment Vouchers" value={metrics.vouchers} note="Visible to current role" tone="violet" /><StatCard label="Departments" value={metrics.departments} note="Authorized department records" tone="cyan" /><StatCard label="Transactions" value={metrics.transactions} note="Authorized financial movements" tone="amber" /></section>
    <section className="grid gap-4 lg:grid-cols-2"><SectionCard title="Operational Portfolio" eyebrow="Comparative volume"><div className="space-y-5"><Bar label="Requests" value={metrics.requests} maximum={maximum} /><Bar label="Payment Vouchers" value={metrics.vouchers} maximum={maximum} /><Bar label="Transactions" value={metrics.transactions} maximum={maximum} /><Bar label="Departments" value={metrics.departments} maximum={maximum} /></div></SectionCard><SectionCard title="Performance Intelligence" eyebrow="Management indicators"><div className="grid gap-4 sm:grid-cols-2"><StatCard label="Seminar Attendance" value={`${metrics.seminarRate.toFixed(1)}%`} note="Attendance records visible to this role" tone="rose" /><StatCard label="Average KPI" value={`${metrics.averageKpi.toFixed(1)}%`} note="Department KPI achievement" tone="emerald" /><StatCard label="Voucher Value" value={`₦${Math.round(metrics.voucherValue).toLocaleString()}`} note="Visible voucher total" tone="violet" /><StatCard label="Transaction Value" value={`₦${Math.round(metrics.transactionValue).toLocaleString()}`} note="Visible transaction total" tone="amber" /></div></SectionCard></section></>}
  </div></EnterpriseShell>;
}
