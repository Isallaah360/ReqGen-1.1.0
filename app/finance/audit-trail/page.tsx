"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { FinanceCard, FinancePageFrame, LoadingPanel, MetricCard, PrimaryButton, StatusPill } from "../_components/FinancePageFrame";

type AuditRow = { id?: string; action?: string; module?: string; entity_type?: string; record_id?: string; actor_name?: string; actor_email?: string; created_at?: string; details?: unknown };

export default function AuditTrailPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [issue, setIssue] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setIssue("");
    const candidates = ["finance_audit_trail", "audit_logs", "finance_activity_history"];
    for (const table of candidates) {
      const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: false }).limit(250);
      if (!error) { setRows((data || []) as AuditRow[]); setLoading(false); return; }
    }
    setRows([]); setIssue("No compatible audit table was found yet. The page is ready and will display records once the audit migration is connected."); setLoading(false);
  }, []);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);
  const filtered = useMemo(() => rows.filter((r) => JSON.stringify(r).toLowerCase().includes(query.toLowerCase())), [rows, query]);

  return (
    <FinancePageFrame eyebrow="Finance Governance" title="Audit Trail" description="Trace sensitive Finance actions, affected records and responsible officers through an immutable review workspace." icon="🛡️" tone="rose" badge="Control & Assurance" actions={<PrimaryButton tone="rose" onClick={load}>↻ Refresh</PrimaryButton>}>
      {loading ? <LoadingPanel label="Loading audit evidence..." /> : <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Audit events" value={String(rows.length)} icon="🧭" tone="rose" helper="Loaded control records" />
          <MetricCard label="Visible results" value={String(filtered.length)} icon="🔎" tone="blue" helper="Current filter result" />
          <MetricCard label="Data source" value={rows.length ? "Connected" : "Pending"} icon="🔗" tone={rows.length ? "emerald" : "amber"} helper="Audit storage status" />
          <MetricCard label="Retention view" value="250" icon="🗄️" tone="violet" helper="Latest events per load" />
        </div>

        <FinanceCard className="mt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.15em] text-rose-700">Evidence register</p><h2 className="mt-1 text-xl font-black">Finance audit events</h2></div><StatusPill tone="rose">Read-only review</StatusPill></div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search action, officer, module or record..." className="mt-5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-100" />
          {issue ? <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">⚠️ {issue}</div> : null}
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-950 text-white"><tr><th className="px-4 py-3">Date & time</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Module</th><th className="px-4 py-3">Officer</th><th className="px-4 py-3">Record</th></tr></thead><tbody className="divide-y divide-slate-200 bg-white">{filtered.length ? filtered.map((row, index) => <tr key={row.id || index} className="transition hover:bg-rose-50/50"><td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">{row.created_at ? new Date(row.created_at).toLocaleString("en-NG") : "—"}</td><td className="px-4 py-3 font-black text-slate-950">{row.action || "Finance activity"}</td><td className="px-4 py-3 font-semibold text-slate-600">{row.module || row.entity_type || "Finance"}</td><td className="px-4 py-3 font-semibold text-slate-600">{row.actor_name || row.actor_email || "System user"}</td><td className="px-4 py-3 font-mono text-xs text-slate-500">{row.record_id || row.id || "—"}</td></tr>) : <tr><td colSpan={5} className="px-5 py-12 text-center font-bold text-slate-500">No audit records match this view.</td></tr>}</tbody></table></div>
          </div>
        </FinanceCard>
      </>}
    </FinancePageFrame>
  );
}
