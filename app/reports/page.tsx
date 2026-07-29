"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentAuthContext } from "@/lib/auth";
import { hasAnyRole, REPORT_ACCESS_ROLES } from "@/lib/roles";
import {
  ReportButton,
  ReportIcon,
  ReportSection,
  ReportsHero,
  ReportsPageStyles,
  ReportsSkeleton,
  ReportStat,
} from "@/app/components/ui/ReportsUI";

type RequestRow = {
  id: string;
  request_no: string | null;
  title: string | null;
  amount: number | null;
  status: string | null;
  current_stage: string | null;
  request_type: string | null;
  dept_id: string | null;
  created_at: string;
};

type DepartmentRow = { id: string; name: string };
type SubheadRow = {
  id: string;
  dept_id: string | null;
  approved_allocation: number | null;
  reserved_amount: number | null;
  expenditure: number | null;
  balance: number | null;
  is_active: boolean | null;
};
type TransactionRow = {
  id: string;
  amount: number | null;
  transaction_type: string | null;
  transaction_date: string | null;
};
type VoucherRow = {
  id: string;
  status: string | null;
  amount: number | null;
  total_amount: number | null;
  voucher_type: string | null;
};

type LoadIssue = { source: string; message: string };
type StatusFilter = "ALL" | "ACTIVE" | "COMPLETED" | "REJECTED";
type TypeFilter = "ALL" | "OFFICIAL" | "PERSONAL";

function money(value: number | null | undefined) {
  return "₦" + Math.round(Number(value || 0)).toLocaleString();
}
function key(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase().replace(/[\s_-]+/g, "");
}
function isRejected(row: RequestRow) {
  const text = `${row.status || ""} ${row.current_stage || ""}`.toLowerCase();
  return /reject|delete|cancel/.test(text);
}
function isCompleted(row: RequestRow) {
  const text = `${row.status || ""} ${row.current_stage || ""}`.toLowerCase();
  return /complete|paid|closed/.test(text);
}
function isActive(row: RequestRow) {
  return !isRejected(row) && !isCompleted(row);
}
function dateInput(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ReportsAnalyticsPage() {
  const router = useRouter();
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [issues, setIssues] = useState<LoadIssue[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [subheads, setSubheads] = useState<SubheadRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);

  const [dateFrom, setDateFrom] = useState(dateInput(start));
  const [dateTo, setDateTo] = useState(dateInput(today));
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setFatalError(null);
    setIssues([]);

    try {
      const authContext = await getCurrentAuthContext();
      if (!authContext) {
        router.replace("/login?next=%2Freports");
        return;
      }

      if (!hasAnyRole(authContext.roleSet, [...REPORT_ACCESS_ROLES])) {
        router.replace("/unauthorized?from=%2Freports");
        return;
      }

      const [requestRes, departmentRes, subheadRes, transactionRes, voucherRes] = await Promise.all([
        supabase.from("requests").select("id,request_no,title,amount,status,current_stage,request_type,dept_id,created_at").order("created_at", { ascending: false }).limit(5000),
        supabase.from("departments").select("id,name").order("name", { ascending: true }),
        supabase.from("subheads").select("id,dept_id,approved_allocation,reserved_amount,expenditure,balance,is_active").limit(5000),
        supabase.from("finance_transactions").select("id,amount,transaction_type,transaction_date").order("transaction_date", { ascending: false }).limit(5000),
        supabase.from("payment_vouchers").select("id,status,amount,total_amount,voucher_type").limit(5000),
      ]);

      const nextIssues: LoadIssue[] = [];
      if (requestRes.error) nextIssues.push({ source: "Requests", message: requestRes.error.message });
      if (departmentRes.error) nextIssues.push({ source: "Departments", message: departmentRes.error.message });
      if (subheadRes.error) nextIssues.push({ source: "Subheads", message: subheadRes.error.message });
      if (transactionRes.error) nextIssues.push({ source: "Finance transactions", message: transactionRes.error.message });
      if (voucherRes.error) nextIssues.push({ source: "Payment vouchers", message: voucherRes.error.message });

      setRequests((requestRes.data || []) as RequestRow[]);
      setDepartments((departmentRes.data || []) as DepartmentRow[]);
      setSubheads((subheadRes.data || []) as SubheadRow[]);
      setTransactions((transactionRes.data || []) as TransactionRow[]);
      setVouchers((voucherRes.data || []) as VoucherRow[]);
      setIssues(nextIssues);
    } catch (error) {
      setFatalError(error instanceof Error ? error.message : "Unable to load reports and analytics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    load();
    const onFocus = () => load(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const filteredRequests = useMemo(() => {
    const from = new Date(`${dateFrom}T00:00:00`).getTime();
    const to = new Date(`${dateTo}T23:59:59.999`).getTime();
    return requests.filter((row) => {
      const timestamp = new Date(row.created_at).getTime();
      if (timestamp < from || timestamp > to) return false;
      if (departmentFilter !== "ALL" && row.dept_id !== departmentFilter) return false;
      if (statusFilter === "ACTIVE" && !isActive(row)) return false;
      if (statusFilter === "COMPLETED" && !isCompleted(row)) return false;
      if (statusFilter === "REJECTED" && !isRejected(row)) return false;
      if (typeFilter !== "ALL" && key(row.request_type) !== typeFilter) return false;
      return true;
    });
  }, [requests, dateFrom, dateTo, departmentFilter, statusFilter, typeFilter]);

  const filteredTransactions = useMemo(() => {
    const from = new Date(`${dateFrom}T00:00:00`).getTime();
    const to = new Date(`${dateTo}T23:59:59.999`).getTime();
    return transactions.filter((row) => {
      if (!row.transaction_date) return false;
      const timestamp = new Date(row.transaction_date).getTime();
      return timestamp >= from && timestamp <= to;
    });
  }, [transactions, dateFrom, dateTo]);

  const metrics = useMemo(() => {
    const total = filteredRequests.length;
    const active = filteredRequests.filter(isActive).length;
    const completed = filteredRequests.filter(isCompleted).length;
    const rejected = filteredRequests.filter(isRejected).length;
    const requestedAmount = filteredRequests.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const allocation = subheads.filter((s) => s.is_active !== false).reduce((sum, s) => sum + Number(s.approved_allocation || 0), 0);
    const expenditure = subheads.filter((s) => s.is_active !== false).reduce((sum, s) => sum + Number(s.expenditure || 0), 0);
    const balance = subheads.filter((s) => s.is_active !== false).reduce((sum, s) => sum + Number(s.balance || 0), 0);
    const financeMovement = filteredTransactions.reduce((sum, row) => sum + Math.abs(Number(row.amount || 0)), 0);
    const voucherValue = vouchers.reduce((sum, row) => sum + Number(row.total_amount ?? row.amount ?? 0), 0);
    return { total, active, completed, rejected, requestedAmount, allocation, expenditure, balance, financeMovement, voucherValue };
  }, [filteredRequests, filteredTransactions, subheads, vouchers]);

  const departmentRows = useMemo(() => {
    const deptName = new Map(departments.map((d) => [d.id, d.name]));
    const map = new Map<string, { id: string; name: string; total: number; active: number; completed: number; rejected: number; amount: number; allocation: number; spent: number }>();
    departments.forEach((dept) => map.set(dept.id, { id: dept.id, name: dept.name, total: 0, active: 0, completed: 0, rejected: 0, amount: 0, allocation: 0, spent: 0 }));
    filteredRequests.forEach((row) => {
      const id = row.dept_id || "UNASSIGNED";
      if (!map.has(id)) map.set(id, { id, name: deptName.get(id) || "Unassigned", total: 0, active: 0, completed: 0, rejected: 0, amount: 0, allocation: 0, spent: 0 });
      const item = map.get(id)!;
      item.total += 1;
      item.amount += Number(row.amount || 0);
      if (isActive(row)) item.active += 1;
      if (isCompleted(row)) item.completed += 1;
      if (isRejected(row)) item.rejected += 1;
    });
    subheads.forEach((s) => {
      const id = s.dept_id || "UNASSIGNED";
      if (!map.has(id)) map.set(id, { id, name: deptName.get(id) || "Unassigned", total: 0, active: 0, completed: 0, rejected: 0, amount: 0, allocation: 0, spent: 0 });
      const item = map.get(id)!;
      item.allocation += Number(s.approved_allocation || 0);
      item.spent += Number(s.expenditure || 0);
    });
    return Array.from(map.values()).filter((row) => row.total > 0 || row.allocation > 0).sort((a, b) => b.total - a.total || b.amount - a.amount);
  }, [departments, filteredRequests, subheads]);

  const stageRows = useMemo(() => {
    const map = new Map<string, number>();
    filteredRequests.forEach((row) => {
      const stage = row.current_stage || "Unassigned";
      map.set(stage, (map.get(stage) || 0) + 1);
    });
    return Array.from(map.entries()).map(([stage, count]) => ({ stage, count })).sort((a, b) => b.count - a.count);
  }, [filteredRequests]);

  const monthlyRows = useMemo(() => {
    const from = new Date(`${dateFrom}T00:00:00`);
    const to = new Date(`${dateTo}T23:59:59`);
    const months: Array<{ key: string; label: string; requests: number; amount: number; finance: number }> = [];
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cursor <= to && months.length < 24) {
      months.push({ key: `${cursor.getFullYear()}-${cursor.getMonth()}`, label: cursor.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }), requests: 0, amount: 0, finance: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const byKey = new Map(months.map((m) => [m.key, m]));
    filteredRequests.forEach((row) => {
      const d = new Date(row.created_at); const item = byKey.get(`${d.getFullYear()}-${d.getMonth()}`); if (item) { item.requests += 1; item.amount += Number(row.amount || 0); }
    });
    filteredTransactions.forEach((row) => {
      if (!row.transaction_date) return; const d = new Date(row.transaction_date); const item = byKey.get(`${d.getFullYear()}-${d.getMonth()}`); if (item) item.finance += Math.abs(Number(row.amount || 0));
    });
    return months;
  }, [dateFrom, dateTo, filteredRequests, filteredTransactions]);

  const maxMonthly = Math.max(1, ...monthlyRows.map((row) => row.requests));
  const completionRate = metrics.total ? (metrics.completed / metrics.total) * 100 : 0;
  const utilisation = metrics.allocation ? (metrics.expenditure / metrics.allocation) * 100 : 0;

  function exportReport() {
    const deptName = new Map(departments.map((d) => [d.id, d.name]));
    downloadCsv(`reqgen-reports-${dateFrom}-to-${dateTo}.csv`, [
      ["Request No", "Title", "Department", "Type", "Status", "Stage", "Amount", "Created"],
      ...filteredRequests.map((row) => [row.request_no || "", row.title || "", deptName.get(row.dept_id || "") || "Unassigned", row.request_type || "", row.status || "", row.current_stage || "", Number(row.amount || 0), new Date(row.created_at).toLocaleString()]),
    ]);
  }

  if (loading) return <><ReportsPageStyles/><ReportsSkeleton/></>;

  return <div className="min-h-screen bg-slate-100 p-4 sm:p-7"><ReportsPageStyles/><main className="report-print-shell mx-auto max-w-[1500px] space-y-6">
    <div className="report-no-print"><ReportsHero actions={<><ReportButton icon="refresh" variant="cyan" onClick={() => load(true)} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh"}</ReportButton><ReportButton icon="download" variant="violet" onClick={exportReport}>Export CSV</ReportButton><ReportButton icon="print" variant="blue" onClick={() => window.print()}>Print Report</ReportButton></>}/></div>

    {fatalError && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-800">{fatalError}</div>}
    {issues.length > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-center gap-2 font-black text-amber-900"><ReportIcon name="warning"/>Partial data warning</div><div className="mt-2 space-y-1 text-sm text-amber-800">{issues.map((issue) => <p key={issue.source}><strong>{issue.source}:</strong> {issue.message}</p>)}</div></div>}

    <section className="report-no-print rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white"><ReportIcon name="filter"/></div><div><h2 className="font-black text-slate-950">Report filters</h2><p className="text-sm text-slate-500">Filters apply to request and dated finance activity.</p></div></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <label className="text-sm font-bold text-slate-700">From<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"/></label>
      <label className="text-sm font-bold text-slate-700">To<input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"/></label>
      <label className="text-sm font-bold text-slate-700">Department<select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"><option value="ALL">All departments</option>{departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}</select></label>
      <label className="text-sm font-bold text-slate-700">Status<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="COMPLETED">Completed</option><option value="REJECTED">Rejected/Cancelled</option></select></label>
      <label className="text-sm font-bold text-slate-700">Request type<select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"><option value="ALL">All types</option><option value="OFFICIAL">Official</option><option value="PERSONAL">Personal</option></select></label>
    </div></section>

    <div id="executive-overview" className="scroll-mt-24 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <ReportStat label="Total requests" value={metrics.total.toLocaleString()} note={`${dateFrom} to ${dateTo}`} icon="request" tone="blue"/>
      <ReportStat label="Active workflow" value={metrics.active.toLocaleString()} note="Requests still moving through approval" icon="clock" tone="amber"/>
      <ReportStat label="Completed" value={metrics.completed.toLocaleString()} note={`${completionRate.toFixed(1)}% completion rate`} icon="check" tone="emerald" progress={completionRate}/>
      <ReportStat label="Rejected / cancelled" value={metrics.rejected.toLocaleString()} note="Requests not completed" icon="warning" tone="rose"/>
      <ReportStat label="Requested value" value={money(metrics.requestedAmount)} note="Value of filtered requests" icon="money" tone="violet"/>
      <ReportStat label="Approved allocation" value={money(metrics.allocation)} note="Across active subheads" icon="building" tone="cyan"/>
      <ReportStat label="Expenditure" value={money(metrics.expenditure)} note={`${utilisation.toFixed(1)}% budget utilisation`} icon="chart" tone="amber" progress={utilisation}/>
      <ReportStat label="Available balance" value={money(metrics.balance)} note={`Finance movement: ${money(metrics.financeMovement)}`} icon="money" tone="emerald"/>
    </div>

    <div id="finance-and-workflow" className="scroll-mt-24 grid gap-6 xl:grid-cols-3">
      <ReportSection title="Monthly activity trend" description="Request volume and financial movement over the selected period." icon="chart" className="report-print-card xl:col-span-2"><div className="overflow-x-auto"><div className="flex min-w-[680px] items-end gap-3 rounded-2xl bg-slate-50 p-5" style={{height: 300}}>{monthlyRows.length === 0 ? <div className="m-auto text-sm text-slate-500">No monthly activity in this period.</div> : monthlyRows.map((row) => <div key={row.key} className="flex h-full flex-1 flex-col justify-end"><div className="mb-2 text-center text-[11px] font-bold text-slate-500">{row.requests}</div><div className="mx-auto w-full max-w-12 rounded-t-xl bg-gradient-to-t from-blue-700 to-cyan-400 transition-all" style={{height: `${Math.max(8, (row.requests / maxMonthly) * 210)}px`}} title={`${row.label}: ${row.requests} requests, ${money(row.finance)} finance movement`}/><div className="mt-2 text-center text-[11px] font-extrabold text-slate-600">{row.label}</div></div>)}</div></div></ReportSection>
      <ReportSection title="Workflow distribution" description="Current request position by approval stage." icon="clock" className="report-print-card"><div className="space-y-3">{stageRows.length === 0 ? <p className="text-sm text-slate-500">No workflow data.</p> : stageRows.slice(0, 10).map((row) => <div key={row.stage}><div className="mb-1 flex items-center justify-between gap-3 text-sm"><span className="font-bold text-slate-700">{row.stage}</span><span className="font-black text-slate-950">{row.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-blue-500" style={{width: `${metrics.total ? Math.max(3, row.count / metrics.total * 100) : 0}%`}}/></div></div>)}</div></ReportSection>
    </div>

    <div id="department-performance" className="scroll-mt-24"><ReportSection title="Department performance" description="Request volume, completion and budget utilisation by department." icon="building" className="report-print-card"><div className="overflow-x-auto"><table className="min-w-[980px] w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Department</th><th className="px-3 py-3 text-right">Requests</th><th className="px-3 py-3 text-right">Active</th><th className="px-3 py-3 text-right">Completed</th><th className="px-3 py-3 text-right">Request value</th><th className="px-3 py-3 text-right">Allocation</th><th className="px-3 py-3 text-right">Spent</th><th className="px-3 py-3 text-right">Utilisation</th></tr></thead><tbody>{departmentRows.length === 0 ? <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-500">No department data for this selection.</td></tr> : departmentRows.map((row) => { const rate = row.allocation ? row.spent / row.allocation * 100 : 0; return <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50"><td className="px-3 py-3 font-extrabold text-slate-900">{row.name}</td><td className="px-3 py-3 text-right font-bold">{row.total}</td><td className="px-3 py-3 text-right text-amber-700">{row.active}</td><td className="px-3 py-3 text-right text-emerald-700">{row.completed}</td><td className="px-3 py-3 text-right font-bold">{money(row.amount)}</td><td className="px-3 py-3 text-right">{money(row.allocation)}</td><td className="px-3 py-3 text-right">{money(row.spent)}</td><td className="px-3 py-3 text-right font-black">{rate.toFixed(1)}%</td></tr>; })}</tbody></table></div></ReportSection></div>

    <div id="request-records" className="scroll-mt-24"><ReportSection title="Recent request records" description="Latest requests matching the current report filters." icon="request" className="report-print-card"><div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Request</th><th className="px-3 py-3">Title</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Stage</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3">Date</th></tr></thead><tbody>{filteredRequests.slice(0, 50).map((row) => <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50"><td className="px-3 py-3 font-extrabold text-blue-700">{row.request_no || "—"}</td><td className="max-w-[280px] truncate px-3 py-3 font-semibold text-slate-800">{row.title || "Untitled request"}</td><td className="px-3 py-3">{row.request_type || "—"}</td><td className="px-3 py-3">{row.status || "—"}</td><td className="px-3 py-3">{row.current_stage || "—"}</td><td className="px-3 py-3 text-right font-bold">{money(row.amount)}</td><td className="px-3 py-3 text-slate-500">{new Date(row.created_at).toLocaleDateString()}</td></tr>)}{filteredRequests.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-500">No requests match the selected filters.</td></tr>}</tbody></table></div>{filteredRequests.length > 50 && <p className="mt-4 text-xs font-semibold text-slate-500">Showing the latest 50 of {filteredRequests.length.toLocaleString()} matching requests. Export CSV contains all matching records.</p>}</ReportSection></div>

    <footer className="pb-4 text-center text-xs font-semibold text-slate-500">ReqGen 1.1.0 • Reports generated {new Date().toLocaleString()}</footer>
  </main></div>;
}
