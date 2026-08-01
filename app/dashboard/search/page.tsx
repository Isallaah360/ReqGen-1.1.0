"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { ActionButton, EmptyState, EnterpriseHero, EnterpriseShell, SectionCard, StatusBadge } from "@/app/components/enterprise/EnterpriseUI";
import { activeRoleFromRpc, dateText, normalizeRows, roleKey, text, type GenericRow } from "@/app/components/enterprise/data";

type SearchItem = { id: string; module: string; title: string; subtitle: string; href: string; date: string; status: string };

const sources = [
  { module: "Requests", table: "requests", href: (r: GenericRow) => `/requests/${text(r.id)}`, title: (r: GenericRow) => text(r.request_no || r.title, "Request"), subtitle: (r: GenericRow) => text(r.title || r.status) },
  { module: "Departments", table: "departments", href: () => "/admin/departments", title: (r: GenericRow) => text(r.name, "Department"), subtitle: (r: GenericRow) => text(r.description || r.is_active) },
  { module: "Payment Vouchers", table: "payment_vouchers", href: (r: GenericRow) => `/payment-vouchers/${text(r.id)}`, title: (r: GenericRow) => text(r.voucher_no || r.voucher_number, "Payment Voucher"), subtitle: (r: GenericRow) => text(r.beneficiary_name || r.status) },
  { module: "Transactions", table: "finance_transactions", href: () => "/finance/transactions", title: (r: GenericRow) => text(r.transaction_no || r.reference, "Transaction"), subtitle: (r: GenericRow) => text(r.description || r.status) },
  { module: "Staff Files", table: "hr_staff_files", href: () => "/hr/staff", title: (r: GenericRow) => text(r.file_number || r.staff_name, "Staff File"), subtitle: (r: GenericRow) => text(r.staff_name || r.custody_status) },
  { module: "Leave", table: "hr_leave_requests", href: () => "/hr/leave", title: (r: GenericRow) => text(r.leave_type || r.employee_name, "Leave Record"), subtitle: (r: GenericRow) => text(r.employee_name || r.status) },
];

export default function GlobalSearchPage() {
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState("staff");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    void supabase.rpc("get_my_active_role").then(({ data }) => setRole(roleKey(activeRoleFromRpc(data))));
  }, []);

  const allowedModules = useMemo(() => {
    if (["admin"].includes(role)) return sources.map((s) => s.module);
    if (["auditor"].includes(role)) return ["Requests", "Departments", "Payment Vouchers", "Transactions", "Staff Files", "Leave"];
    if (["account", "accounts", "accountofficer", "pvsigner", "pvcountersigner"].includes(role)) return ["Requests", "Payment Vouchers", "Transactions"];
    if (role.startsWith("hr") || ["registrarofficer", "leaveofficer", "stafffilingofficer", "archiveofficer"].includes(role)) return ["Requests", "Staff Files", "Leave"];
    if (["registry", "registrar"].includes(role)) return ["Requests", "Departments"];
    return ["Requests", "Departments"];
  }, [role]);

  const runSearch = useCallback(async () => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) { setResults([]); setWarning("Enter at least two characters."); return; }
    setLoading(true); setWarning(null);
    try {
      const selected = sources.filter((source) => allowedModules.includes(source.module) && (moduleFilter === "All" || source.module === moduleFilter));
      const settled = await Promise.all(selected.map(async (source) => {
        const { data, error } = await supabase.from(source.table).select("*").limit(100);
        if (error) return { rows: [] as GenericRow[], source };
        return { rows: normalizeRows(data), source };
      }));
      const next: SearchItem[] = [];
      for (const group of settled) {
        for (const row of group.rows) {
          const haystack = Object.values(row).map((value) => text(value)).join(" ").toLowerCase();
          if (!haystack.includes(term)) continue;
          next.push({
            id: `${group.source.table}-${text(row.id, String(next.length))}`,
            module: group.source.module,
            title: group.source.title(row),
            subtitle: group.source.subtitle(row),
            href: group.source.href(row),
            date: dateText(row.updated_at || row.created_at || row.session_date),
            status: text(row.status || row.current_stage || row.custody_status, "Record"),
          });
        }
      }
      setResults(next.slice(0, 80));
      if (next.length === 0) setWarning("No authorized record matched this search.");
    } catch (error) {
      console.error(error); setWarning("Search could not be completed.");
    } finally { setLoading(false); }
  }, [allowedModules, moduleFilter, query]);

  return (
    <EnterpriseShell>
      <div className="mx-auto max-w-[1500px] space-y-6">
        <EnterpriseHero eyebrow="ReqGen Enterprise Search" title="Global Search Centre" description="Find authorized records across ReqGen without bypassing the selected active role, route guards or Supabase Row Level Security." actions={<ActionButton tone="cyan" onClick={() => void runSearch()} disabled={loading}>{loading ? "Searching..." : "Search Now"}</ActionButton>} />
        <SectionCard title="Search authorized records" eyebrow={`Active role: ${role || "staff"}`}>
          <div className="grid gap-3 lg:grid-cols-[1fr_260px_auto]">
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void runSearch(); }} placeholder="Request number, voucher, staff, department, transaction..." className="min-h-12 rounded-xl border-2 border-slate-200 px-4 font-bold text-slate-900 outline-none focus:border-blue-600" />
            <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="min-h-12 rounded-xl border-2 border-slate-200 px-4 font-bold text-slate-900 outline-none focus:border-blue-600">
              <option>All</option>{allowedModules.map((module) => <option key={module}>{module}</option>)}
            </select>
            <ActionButton tone="blue" onClick={() => void runSearch()} disabled={loading}>Search</ActionButton>
          </div>
        </SectionCard>
        {warning ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{warning}</div> : null}
        <SectionCard title={`Search Results (${results.length})`} eyebrow="Permission-aware results">
          {results.length === 0 ? <EmptyState title="No result to display" description="Search results will appear here. Data sources unavailable to your active role are not queried." /> : <div className="grid gap-3 lg:grid-cols-2">
            {results.map((item) => <Link key={item.id} href={item.href} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-white hover:shadow-md">
              <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-wide text-blue-700">{item.module}</div><h3 className="mt-1 font-black text-slate-950">{item.title}</h3></div><StatusBadge tone="blue">{item.status}</StatusBadge></div>
              <p className="mt-2 text-sm font-semibold text-slate-600">{item.subtitle || "Open the authorized record."}</p><p className="mt-3 text-xs font-bold text-slate-400">{item.date}</p>
            </Link>)}
          </div>}
        </SectionCard>
      </div>
    </EnterpriseShell>
  );
}
