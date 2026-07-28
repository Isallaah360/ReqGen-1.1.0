"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { FinanceCard, FinancePageFrame, LoadingPanel, MetricCard, PrimaryButton, StatusPill } from "../_components/FinancePageFrame";

type ActivityRow = { id?: string; action?: string; title?: string; description?: string; module?: string; actor_name?: string; actor_email?: string; created_at?: string; status?: string };

function activityIcon(value: string) {
  const text = value.toLowerCase();
  if (text.includes("voucher")) return "🧾";
  if (text.includes("transfer")) return "🔁";
  if (text.includes("post")) return "✅";
  if (text.includes("cancel") || text.includes("reject")) return "⛔";
  if (text.includes("setting")) return "⚙️";
  return "💠";
}

export default function ActivityHistoryPage() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [issue, setIssue] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setIssue("");
    const candidates = ["finance_activity_history", "finance_history", "audit_logs"];
    for (const table of candidates) {
      const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: false }).limit(120);
      if (!error) { setRows((data || []) as ActivityRow[]); setLoading(false); return; }
    }
    setRows([]); setIssue("Activity storage is not connected yet. This page will populate automatically after the history table or compatible audit source is available."); setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => rows.filter((r) => JSON.stringify(r).toLowerCase().includes(query.toLowerCase())), [rows, query]);
  const today = rows.filter((r) => r.created_at && new Date(r.created_at).toDateString() === new Date().toDateString()).length;

  return (
    <FinancePageFrame eyebrow="Finance Operations" title="Activity History" description="Follow the Finance Control Centre as a readable operational timeline of vouchers, postings, transfers and administrative actions." icon="🕘" tone="amber" badge="Live Timeline" actions={<PrimaryButton tone="amber" onClick={load}>↻ Refresh</PrimaryButton>}>
      {loading ? <LoadingPanel label="Building the Finance timeline..." /> : <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Timeline events" value={String(rows.length)} icon="🕘" tone="amber" helper="Latest loaded activities" />
          <MetricCard label="Today" value={String(today)} icon="☀️" tone="cyan" helper="Events recorded today" />
          <MetricCard label="Search results" value={String(filtered.length)} icon="🔎" tone="blue" helper="Visible timeline entries" />
          <MetricCard label="Workspace" value="Finance" icon="🏦" tone="violet" helper="Operational history scope" />
        </div>

        <FinanceCard className="mt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.15em] text-amber-700">Operational timeline</p><h2 className="mt-1 text-xl font-black">Recent Finance activity</h2></div><StatusPill tone="amber">Newest first</StatusPill></div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search vouchers, transfers, officers or actions..." className="mt-5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100" />
          {issue ? <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">⚠️ {issue}</div> : null}
          <div className="mt-6 space-y-4">
            {filtered.length ? filtered.map((row, index) => {
              const action = row.action || row.title || "Finance activity";
              return <article key={row.id || index} className="group relative flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-50/40 hover:shadow-md"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-xl transition group-hover:scale-110">{activityIcon(action)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-black text-slate-950">{action}</h3><span className="text-xs font-bold text-slate-500">{row.created_at ? new Date(row.created_at).toLocaleString("en-NG") : "Date unavailable"}</span></div><p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{row.description || `${row.module || "Finance"} record updated by ${row.actor_name || row.actor_email || "a system user"}.`}</p><div className="mt-3 flex flex-wrap gap-2"><StatusPill tone="amber">{row.module || "Finance"}</StatusPill>{row.status ? <StatusPill tone="blue">{row.status}</StatusPill> : null}</div></div></article>;
            }) : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center"><div className="text-4xl">🕊️</div><p className="mt-3 font-black text-slate-800">No activity is available in this view.</p><p className="mt-1 text-sm font-semibold text-slate-500">New Finance operations will appear here automatically.</p></div>}
          </div>
        </FinanceCard>
      </>}
    </FinancePageFrame>
  );
}
