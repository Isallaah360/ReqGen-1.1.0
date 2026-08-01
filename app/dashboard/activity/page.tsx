"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ActionButton, EmptyState, EnterpriseHero, EnterpriseShell, SectionCard, StatusBadge } from "@/app/components/enterprise/EnterpriseUI";
import { dateText, normalizeRows, text, type GenericRow } from "@/app/components/enterprise/data";

type EventItem = { id: string; source: string; action: string; detail: string; actor: string; createdAt: string };

const activitySources = [
  { table: "request_history", source: "Requests" },
  { table: "finance_activity_history", source: "Finance" },
  { table: "hr_assignment_history", source: "HR" },
  { table: "user_role_switch_history", source: "Security" },
  { table: "manual_payment_voucher_audit", source: "Vouchers" },
  { table: "audit_logs", source: "System" },
];

export default function GlobalActivityPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("All");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const groups = await Promise.all(activitySources.map(async (item) => {
        const { data, error } = await supabase.from(item.table).select("*").order("created_at", { ascending: false }).limit(100);
        return error ? [] : normalizeRows(data).map((row: GenericRow) => ({
          id: `${item.table}-${text(row.id, crypto.randomUUID())}`,
          source: item.source,
          action: text(row.action || row.action_type || row.decision || row.event_type, "Activity"),
          detail: text(row.details || row.comment || row.description || row.message || row.entity_type, "Recorded system activity"),
          actor: text(row.actor_name || row.role_name || row.active_role_key || row.performed_by, "System user"),
          createdAt: text(row.created_at || row.switched_at || row.recorded_at),
        }));
      }));
      setEvents(groups.flat().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 300));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => events.filter((event) => {
    if (source !== "All" && event.source !== source) return false;
    const term = query.trim().toLowerCase();
    return !term || `${event.source} ${event.action} ${event.detail} ${event.actor}`.toLowerCase().includes(term);
  }), [events, query, source]);

  return <EnterpriseShell><div className="mx-auto max-w-[1400px] space-y-6">
    <EnterpriseHero eyebrow="ReqGen Accountability" title="Global Activity Timeline" description="A permission-aware chronological view of operational, workflow, security and audit events visible to the current active role." actions={<ActionButton tone="cyan" onClick={() => void load()}>{loading ? "Refreshing..." : "Refresh Timeline"}</ActionButton>} />
    <SectionCard title="Activity Filters" eyebrow={`${filtered.length} visible events`}><div className="grid gap-3 sm:grid-cols-2"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search actor, action or detail" className="min-h-12 rounded-xl border-2 border-slate-200 px-4 font-bold outline-none focus:border-blue-600" /><select value={source} onChange={(e) => setSource(e.target.value)} className="min-h-12 rounded-xl border-2 border-slate-200 px-4 font-bold outline-none focus:border-blue-600"><option>All</option>{activitySources.map((item) => <option key={item.source}>{item.source}</option>)}</select></div></SectionCard>
    <SectionCard title="Chronological Activity" eyebrow="Latest first">{filtered.length === 0 ? <EmptyState title="No activity available" description="No authorized activity event matched the current filter." /> : <div className="space-y-3">{filtered.map((event) => <article key={event.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[150px_1fr_auto] sm:items-center"><div className="text-xs font-black text-slate-500">{dateText(event.createdAt)}</div><div><div className="font-black text-slate-950">{event.action}</div><div className="mt-1 text-sm font-semibold text-slate-600">{event.detail}</div><div className="mt-1 text-xs font-bold text-slate-400">Actor: {event.actor}</div></div><StatusBadge tone="violet">{event.source}</StatusBadge></article>)}</div>}</SectionCard>
  </div></EnterpriseShell>;
}
