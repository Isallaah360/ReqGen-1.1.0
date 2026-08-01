"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ActionButton, EnterpriseHero, EnterpriseShell, SectionCard, StatCard } from "@/app/components/enterprise/EnterpriseUI";
import { activeRoleFromRpc, normalizeRows, text } from "@/app/components/enterprise/data";

type SourceKey = "requests" | "vouchers" | "transactions" | "hr" | "registry" | "audit";
type Row = Record<string, unknown>;

const SOURCES: Record<SourceKey, { label: string; table: string; columns: string; roles: string[] }> = {
  requests: { label: "Requests Register", table: "requests", columns: "*", roles: ["admin","auditor","dg","registry","hr","hrboss","staff"] },
  vouchers: { label: "Payment Vouchers", table: "payment_vouchers", columns: "*", roles: ["admin","auditor","account","accounts","accountofficer"] },
  transactions: { label: "Finance Transactions", table: "finance_transactions", columns: "*", roles: ["admin","auditor","account","accounts","accountofficer"] },
  hr: { label: "HR Operational Register", table: "hr_request_assignments", columns: "*", roles: ["admin","auditor","hr","hrboss"] },
  registry: { label: "Registry Correspondence", table: "registry_correspondence", columns: "*", roles: ["admin","auditor","registry"] },
  audit: { label: "Enterprise Audit Events", table: "enterprise_audit_events", columns: "*", roles: ["admin","auditor"] },
};

function normalizeRole(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, ""); }

export default function OutputCentrePage() {
  const [role, setRole] = useState("staff");
  const [selected, setSelected] = useState<SourceKey>("requests");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);

  const available = useMemo(() => Object.entries(SOURCES).filter(([, config]) => config.roles.includes(normalizeRole(role))) as Array<[SourceKey, typeof SOURCES[SourceKey]]>, [role]);

  const load = useCallback(async () => {
    setLoading(true); setWarning(null);
    try {
      const active = await supabase.rpc("get_my_active_role");
      const roleValue = normalizeRole(activeRoleFromRpc(active.data));
      setRole(roleValue);
      const permitted = Object.entries(SOURCES).filter(([, config]) => config.roles.includes(roleValue)) as Array<[SourceKey, typeof SOURCES[SourceKey]]>;
      const actualKey = permitted.some(([key]) => key === selected) ? selected : permitted[0]?.[0] ?? "requests";
      if (actualKey !== selected) setSelected(actualKey);
      const config = SOURCES[actualKey];
      const result = await supabase.from(config.table).select(config.columns).limit(1000);
      if (result.error) throw result.error;
      setRows(normalizeRows(result.data));
    } catch (error) {
      console.error(error); setRows([]); setWarning("The selected output source is unavailable or restricted to your active role.");
    } finally { setLoading(false); }
  }, [selected]);

  useEffect(() => { void load(); }, [load]);

  const headers = useMemo(() => Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 12), [rows]);

  function exportCsv() {
    const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => `"${text(row[header]).replace(/"/g, '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${selected}-report.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <EnterpriseShell><div className="mx-auto max-w-[1500px] space-y-6">
    <EnterpriseHero eyebrow="Institutional Output" title="Central Print & Export Centre" description="Generate role-authorized institutional registers from one controlled output workspace without bypassing module permissions." actions={<><ActionButton tone="cyan" onClick={() => void load()}>{loading ? "Refreshing..." : "Refresh"}</ActionButton><ActionButton tone="emerald" onClick={exportCsv} disabled={rows.length === 0}>Export CSV</ActionButton><ActionButton tone="violet" onClick={() => window.print()}>Print Report</ActionButton></>} />
    {warning ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{warning}</div> : null}
    <section className="grid gap-4 sm:grid-cols-3"><StatCard label="Active Role" value={role || "Staff"} note="Controls available output sources" tone="slate" /><StatCard label="Available Reports" value={available.length} note="Authorized report categories" tone="blue" /><StatCard label="Current Records" value={loading ? "—" : rows.length} note="Maximum 1,000 records" tone="emerald" /></section>
    <SectionCard title="Report Selection" eyebrow="Permission-aware output">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{available.map(([key, config]) => <button key={key} type="button" onClick={() => setSelected(key)} className={`min-h-12 rounded-xl px-4 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg ${selected === key ? "bg-gradient-to-r from-blue-800 to-cyan-600 ring-4 ring-blue-100" : "bg-gradient-to-r from-slate-700 to-slate-900"}`}>{config.label}</button>)}</div>
    </SectionCard>
    <SectionCard title={SOURCES[selected].label} eyebrow="Institutional register">
      <div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full divide-y divide-slate-200 text-xs"><thead className="bg-slate-950 text-white"><tr>{headers.map((header) => <th key={header} className="px-3 py-3 text-left font-black uppercase">{header.replace(/_/g," ")}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 bg-white">{rows.map((row, index) => <tr key={text(row.id, String(index))} className="hover:bg-slate-50">{headers.map((header) => <td key={header} className="max-w-xs truncate px-3 py-3 font-semibold text-slate-700">{text(row[header], "—")}</td>)}</tr>)}</tbody></table></div>
    </SectionCard>
  </div></EnterpriseShell>;
}
