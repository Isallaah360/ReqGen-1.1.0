"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ActionButton, EmptyState, EnterpriseHero, EnterpriseShell, SectionCard, StatCard, StatusBadge } from "@/app/components/enterprise/EnterpriseUI";
import { dateText, normalizeRows, text } from "@/app/components/enterprise/data";

type Event = { id: string; module: string; action: string; actor: string; activeRole: string; record: string; createdAt: string; details: string };
const sources = [
  ["Enterprise", "enterprise_audit_events"], ["Requests", "request_history"], ["Finance", "finance_activity_history"], ["HR", "hr_assignment_history"], ["Roles", "user_role_switch_history"], ["Vouchers", "manual_payment_voucher_audit"],
] as const;

export default function AuditCentrePage() {
  const [events, setEvents] = useState<Event[]>([]); const [loading, setLoading] = useState(true); const [query, setQuery] = useState(""); const [source, setSource] = useState("ALL"); const [warning, setWarning] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setWarning(null); const collected: Event[] = []; const failures: string[] = [];
    await Promise.all(sources.map(async ([module, table]) => { const result = await supabase.from(table).select("*").order("created_at", { ascending: false }).limit(250); if (result.error) { failures.push(module); return; } normalizeRows(result.data).forEach((row, index) => collected.push({ id: text(row.id, `${module}-${index}`), module, action: text(row.action, text(row.event_type, text(row.decision, "Activity"))), actor: text(row.actor_name, text(row.user_name, text(row.performed_by_name, text(row.actor_id, "System")))), activeRole: text(row.active_role_name, text(row.active_role_key, "—")), record: text(row.reference_no, text(row.request_id, text(row.entity_id, "—"))), createdAt: text(row.created_at, text(row.switched_at)), details: text(row.details, text(row.comment, text(row.description, ""))) })); }));
    collected.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); setEvents(collected); if (failures.length) setWarning(`Some audit sources are unavailable: ${failures.join(", ")}.`); setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => events.filter((event) => (source === "ALL" || event.module === source) && (!query.trim() || [event.module,event.action,event.actor,event.activeRole,event.record,event.details].join(" ").toLowerCase().includes(query.toLowerCase()))), [events,query,source]);
  return <EnterpriseShell><div className="mx-auto max-w-[1500px] space-y-6"><EnterpriseHero eyebrow="Governance & Accountability" title="Enterprise Audit & Activity Centre" description="A consolidated, read-only timeline of request, finance, HR, role-switch, voucher and system activity with active-role attribution." actions={<ActionButton tone="cyan" onClick={() => void load()}>{loading ? "Refreshing..." : "Refresh Audit"}</ActionButton>} />
  {warning ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{warning}</div> : null}
  <section className="grid gap-4 sm:grid-cols-3"><StatCard label="Audit Events" value={loading ? "—" : events.length} note="Across available sources" tone="violet" /><StatCard label="Modules" value={new Set(events.map(e=>e.module)).size} note="Contributing activity sources" tone="blue" /><StatCard label="Filtered Results" value={filtered.length} note="Current search scope" tone="emerald" /></section>
  <SectionCard title="Compliance Timeline" eyebrow="Chronological evidence"><div className="mb-5 grid gap-3 md:grid-cols-[1fr_240px]"><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search actor, action, role, record or details..." className="min-h-12 rounded-xl border border-slate-300 px-4 text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /><select value={source} onChange={(e)=>setSource(e.target.value)} className="min-h-12 rounded-xl border border-slate-300 px-4 text-sm font-bold"><option value="ALL">All Sources</option>{sources.map(([label])=><option key={label}>{label}</option>)}</select></div>
  {filtered.length === 0 ? <EmptyState title={loading ? "Loading audit events" : "No audit event found"} description="Activity matching your authorized scope will appear here." /> : <div className="space-y-3">{filtered.map(event => <article key={`${event.module}-${event.id}`} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[auto_1fr_auto] sm:items-center"><StatusBadge tone="violet">{event.module}</StatusBadge><div><div className="font-black text-slate-950">{event.action}</div><div className="mt-1 text-sm font-semibold text-slate-600">Actor: {event.actor} · Active role: {event.activeRole} · Record: {event.record}</div>{event.details ? <div className="mt-1 text-xs font-semibold text-slate-500">{event.details}</div> : null}</div><div className="text-xs font-black text-slate-500">{dateText(event.createdAt)}</div></article>)}</div>}
  </SectionCard></div></EnterpriseShell>;
}
