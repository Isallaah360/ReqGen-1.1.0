"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ActionButton, EmptyState, EnterpriseHero, EnterpriseShell, SectionCard, StatCard, StatusBadge } from "@/app/components/enterprise/EnterpriseUI";
import { dateText, normalizeRows, text } from "@/app/components/enterprise/data";

type RegisterKind = "incoming" | "outgoing" | "dispatch" | "archive" | "all";

type Item = {
  id: string;
  referenceNo: string;
  subject: string;
  department: string;
  status: string;
  priority: string;
  direction: string;
  createdAt: string;
};

const kindMeta: Record<RegisterKind, { title: string; description: string; eyebrow: string }> = {
  all: { title: "Registry Operations Centre", description: "Manage incoming and outgoing correspondence, dispatch, collection, movement and archive records from one controlled workspace.", eyebrow: "Registry Operations" },
  incoming: { title: "Incoming Correspondence Register", description: "Record, classify and route correspondence received by IET while preserving a complete movement history.", eyebrow: "Incoming Registry" },
  outgoing: { title: "Outgoing Correspondence Register", description: "Prepare and monitor correspondence leaving IET, including destination, dispatch status and acknowledgement.", eyebrow: "Outgoing Registry" },
  dispatch: { title: "Dispatch & Collection Register", description: "Track items awaiting dispatch, dispatched items, collections, acknowledgements and overdue returns.", eyebrow: "Dispatch Control" },
  archive: { title: "Registry Archive Register", description: "Monitor archived correspondence, retention status, storage location and authorized restoration activity.", eyebrow: "Archive Control" },
};

function tone(status: string) {
  const s = status.toLowerCase();
  if (/complete|delivered|collected|archived/.test(s)) return "emerald" as const;
  if (/overdue|missing|rejected|cancel/.test(s)) return "rose" as const;
  if (/pending|awaiting|draft/.test(s)) return "amber" as const;
  return "blue" as const;
}

export default function RegistryRegister({ kind }: { kind: RegisterKind }) {
  const meta = kindMeta[kind];
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [warning, setWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setWarning(null);
    try {
      const result = await supabase.from("registry_correspondence").select("*").order("created_at", { ascending: false }).limit(500);
      if (result.error) throw result.error;
      const data = normalizeRows(result.data)
        .filter((row) => kind === "all" || text(row.direction).toLowerCase() === kind || (kind === "dispatch" && /dispatch|collection/.test(text(row.status).toLowerCase())) || (kind === "archive" && /archive/.test(text(row.status).toLowerCase())))
        .map((row) => ({
          id: text(row.id),
          referenceNo: text(row.reference_no, "Unnumbered"),
          subject: text(row.subject, "Untitled correspondence"),
          department: text(row.department_name, text(row.department_id, "Unassigned")),
          status: text(row.status, "Pending"),
          priority: text(row.priority, "Normal"),
          direction: text(row.direction, "Incoming"),
          createdAt: text(row.created_at),
        }));
      setRows(data);
    } catch (error) {
      console.error(error);
      setWarning("Registry operational tables are not available yet or your active role cannot read them.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => [row.referenceNo, row.subject, row.department, row.status, row.priority].some((value) => value.toLowerCase().includes(q)));
  }, [query, rows]);

  const stats = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((r) => /pending|awaiting|draft/i.test(r.status)).length,
    completed: rows.filter((r) => /complete|delivered|collected|archived/i.test(r.status)).length,
    urgent: rows.filter((r) => /urgent|high/i.test(r.priority)).length,
  }), [rows]);

  return (
    <EnterpriseShell>
      <div className="mx-auto max-w-[1500px] space-y-4">
        <EnterpriseHero eyebrow={meta.eyebrow} title={meta.title} description={meta.description} actions={<ActionButton tone="cyan" onClick={() => void load()}>{loading ? "Refreshing..." : "Refresh Register"}</ActionButton>} />
        {warning ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{warning}</div> : null}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Records" value={loading ? "—" : stats.total} note="Within this registry scope" tone="blue" />
          <StatCard label="Pending" value={loading ? "—" : stats.pending} note="Awaiting action" tone="amber" />
          <StatCard label="Completed" value={loading ? "—" : stats.completed} note="Closed movement" tone="emerald" />
          <StatCard label="Urgent / High" value={loading ? "—" : stats.urgent} note="Priority attention" tone="rose" />
        </section>
        <SectionCard title="Registry Register" eyebrow="Operational records">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reference, subject, department or status..." className="mb-5 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
          {filtered.length === 0 ? <EmptyState title={loading ? "Loading registry records" : "No registry records found"} description="Records matching this registry scope will appear here." /> : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-100 text-slate-700"><tr><th className="px-4 py-3 text-left font-black">Reference</th><th className="px-4 py-3 text-left font-black">Subject</th><th className="px-4 py-3 text-left font-black">Department</th><th className="px-4 py-3 text-left font-black">Direction</th><th className="px-4 py-3 text-left font-black">Priority</th><th className="px-4 py-3 text-left font-black">Status</th><th className="px-4 py-3 text-left font-black">Date</th></tr></thead>
                <tbody className="divide-y divide-slate-100 bg-white">{filtered.map((row) => <tr key={row.id} className="hover:bg-slate-50"><td className="px-4 py-4 font-black text-slate-950">{row.referenceNo}</td><td className="max-w-sm px-4 py-4 font-bold text-slate-800">{row.subject}</td><td className="px-4 py-4 font-semibold text-slate-600">{row.department}</td><td className="px-4 py-4"><StatusBadge tone="cyan">{row.direction}</StatusBadge></td><td className="px-4 py-4"><StatusBadge tone={/urgent|high/i.test(row.priority) ? "rose" : "slate"}>{row.priority}</StatusBadge></td><td className="px-4 py-4"><StatusBadge tone={tone(row.status)}>{row.status}</StatusBadge></td><td className="px-4 py-4 font-semibold text-slate-500">{dateText(row.createdAt)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </EnterpriseShell>
  );
}
