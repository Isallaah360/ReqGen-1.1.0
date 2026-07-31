"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import HRAccessGuard from "@/app/components/hr/HRAccessGuard";
import { DataTable } from "@/app/components/hr/HRAnalyticsUI";
import { PrimaryButton, SectionCard, StatCard, StrategicHero, StrategicNavigation, StrategicShell } from "@/app/components/hr/HRStrategicUI";

type EventRow = { id: string; source: string; action: string; actor: string; details: string; created_at: string };

export default function HRCompliancePage() {
  const [rows, setRows] = useState<EventRow[]>([]); const [loading, setLoading] = useState(true); const [query, setQuery] = useState("");
  const load = useCallback(async () => { setLoading(true); const sources = [
    ["HR Assignment", "hr_assignment_history", "id,action,details,created_at"],
    ["Role Switch", "user_role_switch_history", "id,new_role_key,previous_role_key,switched_at"],
    ["Seminar Correction", "hr_seminar_attendance_corrections", "id,decision,correction_reason,created_at"],
    ["KPI Review", "hr_kpi_reviews", "id,status,comment,created_at"],
  ] as const;
  const result = await Promise.all(sources.map(async ([source, table, select]) => { const response = await supabase.from(table).select(select).order(table === "user_role_switch_history" ? "switched_at" : "created_at", { ascending: false }).limit(100); return [source, response.data || []] as const; }));
  const events: EventRow[] = []; result.forEach(([source, data]) => (data as Record<string, unknown>[]).forEach((item) => events.push({ id: String(item.id), source, action: String(item.action || item.decision || item.status || item.new_role_key || "Recorded action"), actor: String(item.actor_id || item.user_id || "System"), details: String(item.details || item.correction_reason || item.comment || (item.previous_role_key ? `${item.previous_role_key} → ${item.new_role_key}` : "No additional details")), created_at: String(item.created_at || item.switched_at || "") }))); events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); setRows(events); setLoading(false); }, []);
  useEffect(() => { void load(); }, [load]);
  const filtered = rows.filter((row) => `${row.source} ${row.action} ${row.details}`.toLowerCase().includes(query.toLowerCase()));
  return <HRAccessGuard bossOnly><StrategicShell><StrategicHero eyebrow="HR Audit & Compliance" title="HR Compliance Centre" description="A consolidated, searchable chronology of HR assignments, role switches, attendance corrections, KPI reviews and sensitive governance actions." action={<PrimaryButton tone="cyan" onClick={() => void load()}>Refresh Audit</PrimaryButton>} /><StrategicNavigation />
  <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Audit Events" value={loading ? "—" : rows.length} note="Combined HR governance evidence" tone="blue" /><StatCard label="Assignment Actions" value={rows.filter((r) => r.source === "HR Assignment").length} note="Delegation and review history" tone="violet" /><StatCard label="Role Switches" value={rows.filter((r) => r.source === "Role Switch").length} note="Active-role context changes" tone="cyan" /><StatCard label="Corrections & Reviews" value={rows.filter((r) => ["Seminar Correction", "KPI Review"].includes(r.source)).length} note="Controlled amendments and moderation" tone="amber" /></section>
  <SectionCard title="Compliance Timeline" eyebrow="Immutable Evidence" action={<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search audit events" className="rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-semibold outline-none focus:border-blue-600" />}><DataTable headers={["Date", "Source", "Action", "Actor", "Details"]}>{filtered.map((row) => <tr key={`${row.source}-${row.id}`} className="hover:bg-slate-50"><td className="px-4 py-4 text-xs font-bold text-slate-600">{row.created_at ? new Date(row.created_at).toLocaleString("en-NG") : "—"}</td><td className="px-4 py-4 font-black text-blue-800">{row.source}</td><td className="px-4 py-4 font-black text-slate-900">{row.action}</td><td className="px-4 py-4 text-xs font-semibold text-slate-600">{row.actor}</td><td className="max-w-xl px-4 py-4 text-sm font-semibold text-slate-700">{row.details}</td></tr>)}</DataTable></SectionCard>
  </StrategicShell></HRAccessGuard>;
}
