"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AdminNavigation from "@/app/components/admin/AdminNavigation";

type AuditRow = { id: string; source: string; action: string; actor: string; details: string; created_at: string };
type GenericRow = Record<string, unknown>;

function normalizeRole(value: unknown) { return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9:]+/g, ""); }
function activeRoleFromRpc(value: unknown) {
  if (typeof value === "string") return normalizeRole(value);
  if (Array.isArray(value)) return activeRoleFromRpc(value[0]);
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return normalizeRole(row.active_role_key ?? row.role_key ?? row.role ?? row.get_my_active_role);
  }
  return "";
}
function asRows(value: unknown): GenericRow[] { return Array.isArray(value) ? value.filter((v): v is GenericRow => !!v && typeof v === "object" && !Array.isArray(v)) : []; }
function text(row: GenericRow, keys: string[], fallback = "—") { for (const key of keys) { const v = row[key]; if (v !== null && v !== undefined && String(v).trim()) return String(v); } return fallback; }
function dateText(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }); }

export default function AdminAuditPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("ALL");
  const [warning, setWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setWarning(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.push("/login"); return; }
      const [{ data: profile }, { data: activeRole }] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle(),
        supabase.rpc("get_my_active_role"),
      ]);
      const role = activeRoleFromRpc(activeRole) || normalizeRole(profile?.role);
      if (!["admin", "auditor"].includes(role)) { router.push("/unauthorized?from=/admin/audit"); return; }

      const sources = [
        { source: "Role Switch", table: "user_role_switch_history", select: "*" },
        { source: "HR Assignment", table: "hr_assignment_history", select: "*" },
        { source: "Finance Activity", table: "finance_activity_history", select: "*" },
        { source: "Manual Voucher", table: "manual_payment_voucher_audit", select: "*" },
        { source: "Audit Log", table: "audit_logs", select: "*" },
      ];
      const results = await Promise.all(sources.map(async (item) => {
        const result = await supabase.from(item.table).select(item.select).order("created_at", { ascending: false }).limit(150);
        return { ...item, data: result.data as unknown, error: result.error?.message ?? null };
      }));
      const next: AuditRow[] = [];
      const unavailable: string[] = [];
      for (const result of results) {
        if (result.error) { unavailable.push(result.source); continue; }
        asRows(result.data).forEach((row, index) => {
          const created = text(row, ["created_at", "switched_at", "assigned_at", "updated_at"], new Date(0).toISOString());
          next.push({
            id: text(row, ["id"], `${result.source}-${index}-${created}`),
            source: result.source,
            action: text(row, ["action", "event_type", "decision", "new_role_key", "status"], "Recorded activity"),
            actor: text(row, ["actor_name", "performed_by_name", "user_id", "actor_id", "performed_by", "changed_by"], "System / secured actor"),
            details: text(row, ["details", "description", "comment", "reason", "new_values", "metadata"], "Administrative event recorded."),
            created_at: created,
          });
        });
      }
      next.sort((a,b) => new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
      setRows(next);
      if (unavailable.length) setWarning(`Some optional audit sources are unavailable or restricted: ${unavailable.join(", ")}.`);
    } catch (error) {
      console.error(error); setWarning("Unable to load the complete administrative audit trail.");
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const sources = useMemo(() => ["ALL", ...Array.from(new Set(rows.map((r) => r.source)))], [rows]);
  const filtered = useMemo(() => {
    const q=query.trim().toLowerCase();
    return rows.filter((r) => (source === "ALL" || r.source === source) && (!q || `${r.source} ${r.action} ${r.actor} ${r.details}`.toLowerCase().includes(q)));
  }, [rows,query,source]);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8">
      <AdminNavigation />
      <section className="overflow-hidden rounded-3xl border border-fuchsia-200 bg-gradient-to-br from-slate-950 via-purple-950 to-fuchsia-900 p-7 text-white shadow-xl">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">System Administration</p>
        <div className="mt-2 flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><h1 className="text-3xl font-black sm:text-4xl">Administrative Audit Trail</h1><p className="mt-3 max-w-3xl font-semibold leading-7 text-slate-200">Review role switches, assignment changes, Finance administration events and other high-value control activities from one secured workspace.</p></div><button onClick={() => void load()} className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-cyan-700">Refresh Audit</button></div>
      </section>
      {warning && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 font-bold text-amber-900">{warning}</div>}
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_240px_auto]"><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search action, actor or details" className="h-12 rounded-xl border border-slate-300 px-4 font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"/><select value={source} onChange={(e)=>setSource(e.target.value)} className="h-12 rounded-xl border border-slate-300 px-4 font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">{sources.map((s)=><option key={s}>{s}</option>)}</select><button onClick={()=>{setQuery("");setSource("ALL");}} className="rounded-xl bg-slate-700 px-5 py-3 font-black text-white shadow-md transition hover:bg-slate-800">Reset</button></div>
      </section>
      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="text-xl font-black text-slate-950">Audit Events</h2><p className="text-sm font-semibold text-slate-500">{loading ? "Loading secured activity…" : `${filtered.length} event(s) displayed`}</p></div>
        <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-600"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Source</th><th className="px-5 py-3">Action</th><th className="px-5 py-3">Actor</th><th className="px-5 py-3">Details</th></tr></thead><tbody className="divide-y divide-slate-100">{!loading && filtered.map((row)=><tr key={row.id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-600">{dateText(row.created_at)}</td><td className="px-5 py-4"><span className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-black text-purple-800">{row.source}</span></td><td className="px-5 py-4 font-black text-slate-900">{row.action}</td><td className="px-5 py-4 font-semibold text-slate-700">{row.actor}</td><td className="max-w-xl px-5 py-4 font-medium text-slate-600">{row.details}</td></tr>)}{!loading && filtered.length===0 && <tr><td colSpan={5} className="px-6 py-16 text-center font-bold text-slate-500">No matching administrative audit event was found.</td></tr>}</tbody></table></div>
      </section>
    </main>
  );
}
