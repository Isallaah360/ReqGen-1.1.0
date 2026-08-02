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

type AnyRow = Record<string, unknown>;
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
type LoadIssue = { source: string; message: string };
type StatusFilter = "ALL" | "ACTIVE" | "COMPLETED" | "REJECTED";
type TypeFilter = "ALL" | "OFFICIAL" | "PERSONAL";
type SectionKey =
  | "EXECUTIVE"
  | "REQUESTS"
  | "MONTHLY_FINANCE"
  | "ANNUAL_FINANCE"
  | "VOUCHERS"
  | "AUDIT"
  | "DEPARTMENTS"
  | "ACCOUNTS"
  | "REGISTERS";
type PrintKey = "ALL" | SectionKey;

const REPORT_SECTIONS: Array<{
  key: SectionKey;
  title: string;
  shortTitle: string;
  id: string;
  icon: string;
}> = [
  { key: "EXECUTIVE", title: "EXECUTIVE OVERVIEW & DECISION INSIGHTS", shortTitle: "Executive Overview", id: "executive-overview", icon: "chart" },
  { key: "REQUESTS", title: "REQUESTS & WORKFLOW PERFORMANCE", shortTitle: "Requests & Workflow", id: "requests-workflow", icon: "request" },
  { key: "MONTHLY_FINANCE", title: "MONTHLY FINANCE REPORT", shortTitle: "Monthly Finance", id: "monthly-finance-report", icon: "chart" },
  { key: "ANNUAL_FINANCE", title: "ANNUAL FINANCE REPORT", shortTitle: "Annual Finance", id: "annual-finance-report", icon: "building" },
  { key: "VOUCHERS", title: "PAYMENT VOUCHER REPORT", shortTitle: "Payment Vouchers", id: "payment-voucher-report", icon: "money" },
  { key: "AUDIT", title: "AUDIT, COMPLIANCE & RECONCILIATION", shortTitle: "Audit & Reconciliation", id: "audit-reconciliation", icon: "warning" },
  { key: "DEPARTMENTS", title: "DEPARTMENT & SUBHEAD PERFORMANCE", shortTitle: "Departments & Subheads", id: "department-subhead-performance", icon: "building" },
  { key: "ACCOUNTS", title: "ACCOUNTS, TRANSFERS & BANK LEDGER", shortTitle: "Accounts & Ledger", id: "accounts-transfers-ledger", icon: "money" },
  { key: "REGISTERS", title: "DETAILED INSTITUTIONAL REGISTERS", shortTitle: "Detailed Registers", id: "detailed-registers", icon: "report" },
];

function n(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
function s(value: unknown) {
  return String(value ?? "").trim();
}
function money(value: unknown) {
  return "₦" + Math.round(n(value)).toLocaleString("en-NG");
}
function compactMoney(value: unknown) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n(value));
}
function dateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function rowDate(row: AnyRow) {
  return s(row.transaction_date || row.voucher_date || row.entry_date || row.created_at || row.updated_at || row.date);
}
function dateLabel(value: unknown) {
  const raw = s(value);
  if (!raw) return "—";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
}
function requestRejected(row: RequestRow) {
  return /reject|cancel|delete/.test(`${row.status || ""} ${row.current_stage || ""}`.toLowerCase());
}
function requestCompleted(row: RequestRow) {
  return /complete|paid|closed|approved/.test(`${row.status || ""} ${row.current_stage || ""}`.toLowerCase());
}
function requestActive(row: RequestRow) {
  return !requestRejected(row) && !requestCompleted(row);
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

function DataBar({ label, value, max, valueLabel, tone = "blue" }: { label: string; value: number; max: number; valueLabel?: string; tone?: "blue" | "emerald" | "amber" | "rose" | "violet" | "cyan" }) {
  const tones = {
    blue: "from-blue-700 to-cyan-400",
    emerald: "from-emerald-700 to-teal-400",
    amber: "from-amber-600 to-orange-400",
    rose: "from-rose-700 to-pink-400",
    violet: "from-violet-700 to-fuchsia-400",
    cyan: "from-cyan-700 to-sky-400",
  };
  const width = max ? Math.max(value > 0 ? 3 : 0, Math.min(100, (value / max) * 100)) : 0;
  return <div>
    <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
      <span className="truncate font-bold text-slate-700">{label}</span>
      <span className="shrink-0 font-black text-slate-950">{valueLabel ?? value.toLocaleString()}</span>
    </div>
    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full bg-gradient-to-r ${tones[tone]}`} style={{ width: `${width}%` }} /></div>
  </div>;
}

function Donut({ segments, center, note }: { segments: Array<{ label: string; value: number; color: string }>; center: string; note: string }) {
  const total = Math.max(1, segments.reduce((sum, item) => sum + item.value, 0));
  let cursor = 0;
  const gradient = segments.map((item) => {
    const start = cursor;
    cursor += (item.value / total) * 100;
    return `${item.color} ${start}% ${cursor}%`;
  }).join(",");
  return <div className="grid gap-5 sm:grid-cols-[170px_1fr] sm:items-center">
    <div className="relative mx-auto h-40 w-40 rounded-full" style={{ background: `conic-gradient(${gradient || "#e2e8f0 0 100%"})` }}>
      <div className="absolute inset-7 grid place-items-center rounded-full bg-white text-center shadow-inner"><div><div className="text-2xl font-black text-slate-950">{center}</div><div className="text-[11px] font-bold text-slate-500">{note}</div></div></div>
    </div>
    <div className="space-y-3">{segments.map((item) => <div key={item.label} className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 font-bold text-slate-700"><span className="h-3 w-3 rounded-full" style={{ background: item.color }} />{item.label}</span><span className="font-black text-slate-950">{item.value.toLocaleString()}</span></div>)}</div>
  </div>;
}

function Insight({ tone, title, text }: { tone: "emerald" | "amber" | "rose" | "blue"; title: string; text: string }) {
  const classes = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    rose: "border-rose-200 bg-rose-50 text-rose-950",
    blue: "border-blue-200 bg-blue-50 text-blue-950",
  };
  return <article className={`rounded-2xl border p-4 ${classes[tone]}`}><h3 className="font-black uppercase tracking-wide">{title}</h3><p className="mt-1 text-sm leading-6 opacity-90">{text}</p></article>;
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return <tr><td colSpan={colSpan} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">{text}</td></tr>;
}

export default function ReportsAnalyticsPage() {
  const router = useRouter();
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 1);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [issues, setIssues] = useState<LoadIssue[]>([]);
  const [dateFrom, setDateFrom] = useState(dateInput(startOfYear));
  const [dateTo, setDateTo] = useState(dateInput(today));
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [printSection, setPrintSection] = useState<PrintKey>("ALL");

  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [requestHistory, setRequestHistory] = useState<AnyRow[]>([]);
  const [attachments, setAttachments] = useState<AnyRow[]>([]);
  const [subheads, setSubheads] = useState<AnyRow[]>([]);
  const [transactions, setTransactions] = useState<AnyRow[]>([]);
  const [accounts, setAccounts] = useState<AnyRow[]>([]);
  const [accountTransactions, setAccountTransactions] = useState<AnyRow[]>([]);
  const [transfers, setTransfers] = useState<AnyRow[]>([]);
  const [bankLedger, setBankLedger] = useState<AnyRow[]>([]);
  const [vouchers, setVouchers] = useState<AnyRow[]>([]);
  const [voucherItems, setVoucherItems] = useState<AnyRow[]>([]);
  const [voucherHistory, setVoucherHistory] = useState<AnyRow[]>([]);
  const [auditRows, setAuditRows] = useState<AnyRow[]>([]);

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setFatalError(null);
    setIssues([]);
    try {
      const auth = await getCurrentAuthContext();
      if (!auth) {
        router.replace("/login?next=%2Freports");
        return;
      }
      if (!hasAnyRole(auth.roleSet, [...REPORT_ACCESS_ROLES])) {
        router.replace("/unauthorized?from=%2Freports");
        return;
      }

      const sources: Array<{ label: string; table: string; order?: string; limit: number }> = [
        { label: "Requests", table: "requests", order: "created_at", limit: 5000 },
        { label: "Departments", table: "departments", order: "name", limit: 1000 },
        { label: "Request history", table: "request_history", order: "created_at", limit: 5000 },
        { label: "Request attachments", table: "request_attachments", order: "created_at", limit: 5000 },
        { label: "Subheads", table: "subheads", order: "name", limit: 5000 },
        { label: "Finance transactions", table: "finance_transactions", order: "created_at", limit: 5000 },
        { label: "IET accounts", table: "iet_accounts", order: "created_at", limit: 1000 },
        { label: "Account transactions", table: "iet_account_transactions", order: "created_at", limit: 5000 },
        { label: "Account transfers", table: "account_transfers", order: "created_at", limit: 5000 },
        { label: "Bank ledger", table: "iet_bank_ledger", order: "created_at", limit: 5000 },
        { label: "Payment vouchers", table: "payment_vouchers", order: "created_at", limit: 5000 },
        { label: "Payment voucher items", table: "payment_voucher_items", order: "created_at", limit: 5000 },
        { label: "Payment voucher history", table: "payment_voucher_history", order: "created_at", limit: 5000 },
      ];

      const results = await Promise.all(sources.map(async (source) => {
        let query = supabase.from(source.table).select("*").limit(source.limit);
        if (source.order) query = query.order(source.order, { ascending: source.order === "name" });
        return query;
      }));

      const nextIssues: LoadIssue[] = [];
      results.forEach((result, index) => {
        if (result.error) nextIssues.push({ source: sources[index].label, message: result.error.message });
      });

      setRequests((results[0].data || []) as RequestRow[]);
      setDepartments((results[1].data || []) as DepartmentRow[]);
      setRequestHistory((results[2].data || []) as AnyRow[]);
      setAttachments((results[3].data || []) as AnyRow[]);
      setSubheads((results[4].data || []) as AnyRow[]);
      setTransactions((results[5].data || []) as AnyRow[]);
      setAccounts((results[6].data || []) as AnyRow[]);
      setAccountTransactions((results[7].data || []) as AnyRow[]);
      setTransfers((results[8].data || []) as AnyRow[]);
      setBankLedger((results[9].data || []) as AnyRow[]);
      setVouchers((results[10].data || []) as AnyRow[]);
      setVoucherItems((results[11].data || []) as AnyRow[]);
      setVoucherHistory((results[12].data || []) as AnyRow[]);

      const auditSources = ["finance_audit_trail", "finance_activity_history", "manual_payment_voucher_audit", "audit_logs"];
      const auditResults = await Promise.all(auditSources.map((table) => supabase.from(table).select("*").order("created_at", { ascending: false }).limit(1500)));
      const mergedAudit: AnyRow[] = [];
      auditResults.forEach((result, index) => {
        if (result.error) nextIssues.push({ source: auditSources[index], message: result.error.message });
        else mergedAudit.push(...((result.data || []) as AnyRow[]).map((row) => ({ ...row, __source: auditSources[index] })));
      });
      setAuditRows(mergedAudit.sort((a, b) => new Date(rowDate(b) || 0).getTime() - new Date(rowDate(a) || 0).getTime()));
      setIssues(nextIssues);
    } catch (error) {
      setFatalError(error instanceof Error ? error.message : "Unable to load the institutional reports centre.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const inPeriod = useCallback((row: AnyRow) => {
    const raw = rowDate(row);
    if (!raw) return true;
    const time = new Date(raw).getTime();
    return time >= new Date(`${dateFrom}T00:00:00`).getTime() && time <= new Date(`${dateTo}T23:59:59`).getTime();
  }, [dateFrom, dateTo]);

  const filteredRequests = useMemo(() => requests.filter((row) => {
    const created = new Date(row.created_at).getTime();
    if (created < new Date(`${dateFrom}T00:00:00`).getTime() || created > new Date(`${dateTo}T23:59:59`).getTime()) return false;
    if (departmentFilter !== "ALL" && row.dept_id !== departmentFilter) return false;
    if (typeFilter !== "ALL" && s(row.request_type).toUpperCase() !== typeFilter) return false;
    if (statusFilter === "ACTIVE" && !requestActive(row)) return false;
    if (statusFilter === "COMPLETED" && !requestCompleted(row)) return false;
    if (statusFilter === "REJECTED" && !requestRejected(row)) return false;
    return true;
  }), [requests, dateFrom, dateTo, departmentFilter, typeFilter, statusFilter]);

  const filteredSubheads = useMemo(() => subheads.filter((row) => departmentFilter === "ALL" || s(row.dept_id) === departmentFilter), [subheads, departmentFilter]);
  const filteredTransactions = useMemo(() => transactions.filter(inPeriod).filter((row) => departmentFilter === "ALL" || s(row.dept_id || row.department_id) === departmentFilter), [transactions, inPeriod, departmentFilter]);
  const filteredAccountTransactions = useMemo(() => accountTransactions.filter(inPeriod), [accountTransactions, inPeriod]);
  const filteredTransfers = useMemo(() => transfers.filter(inPeriod), [transfers, inPeriod]);
  const filteredLedger = useMemo(() => bankLedger.filter(inPeriod), [bankLedger, inPeriod]);
  const filteredVouchers = useMemo(() => vouchers.filter(inPeriod).filter((row) => departmentFilter === "ALL" || s(row.dept_id || row.department_id) === departmentFilter), [vouchers, inPeriod, departmentFilter]);
  const filteredHistory = useMemo(() => requestHistory.filter(inPeriod), [requestHistory, inPeriod]);
  const filteredVoucherHistory = useMemo(() => voucherHistory.filter(inPeriod), [voucherHistory, inPeriod]);
  const filteredAudit = useMemo(() => auditRows.filter(inPeriod), [auditRows, inPeriod]);

  const departmentNames = useMemo(() => new Map(departments.map((department) => [department.id, department.name])), [departments]);
  const requestStats = useMemo(() => ({
    total: filteredRequests.length,
    active: filteredRequests.filter(requestActive).length,
    completed: filteredRequests.filter(requestCompleted).length,
    rejected: filteredRequests.filter(requestRejected).length,
    amount: filteredRequests.reduce((sum, row) => sum + n(row.amount), 0),
  }), [filteredRequests]);

  const financeStats = useMemo(() => ({
    allocation: filteredSubheads.reduce((sum, row) => sum + n(row.approved_allocation || row.allocation_amount), 0),
    reserved: filteredSubheads.reduce((sum, row) => sum + n(row.reserved_amount), 0),
    expenditure: filteredSubheads.reduce((sum, row) => sum + n(row.expenditure || row.spent_amount), 0),
    balance: filteredSubheads.reduce((sum, row) => sum + n(row.balance || row.available_balance), 0),
    movement: filteredTransactions.reduce((sum, row) => sum + Math.abs(n(row.amount)), 0),
    income: filteredTransactions.filter((row) => /income|credit|deposit|receipt/.test(s(row.transaction_type || row.type).toLowerCase())).reduce((sum, row) => sum + Math.abs(n(row.amount)), 0),
    expense: filteredTransactions.filter((row) => /expense|debit|payment|withdraw/.test(s(row.transaction_type || row.type).toLowerCase())).reduce((sum, row) => sum + Math.abs(n(row.amount)), 0),
  }), [filteredSubheads, filteredTransactions]);

  const voucherStats = useMemo(() => ({
    total: filteredVouchers.length,
    value: filteredVouchers.reduce((sum, row) => sum + n(row.total_amount || row.amount || row.net_amount), 0),
    paid: filteredVouchers.filter((row) => /paid|complete/.test(s(row.status).toLowerCase())).length,
    pending: filteredVouchers.filter((row) => /pending|draft|submitted|review/.test(s(row.status).toLowerCase())).length,
    rejected: filteredVouchers.filter((row) => /reject|void|cancel/.test(s(row.status).toLowerCase())).length,
  }), [filteredVouchers]);

  const auditStats = useMemo(() => {
    const negativeSubheads = filteredSubheads.filter((row) => n(row.balance || row.available_balance) < 0).length;
    const overspent = filteredSubheads.filter((row) => n(row.expenditure || row.spent_amount) > n(row.approved_allocation || row.allocation_amount)).length;
    const unlinkedSubheads = filteredSubheads.filter((row) => !s(row.dept_id)).length;
    const unreconciled = filteredLedger.filter((row) => !/reconciled|matched|cleared/.test(s(row.reconciliation_status || row.status).toLowerCase())).length;
    const reversed = [...filteredTransactions, ...filteredVouchers, ...filteredTransfers].filter((row) => /reverse|void|cancel/.test(s(row.status || row.transaction_status).toLowerCase())).length;
    return { negativeSubheads, overspent, unlinkedSubheads, unreconciled, reversed, events: filteredAudit.length, exceptions: negativeSubheads + overspent + unlinkedSubheads + unreconciled + reversed };
  }, [filteredSubheads, filteredLedger, filteredTransactions, filteredVouchers, filteredTransfers, filteredAudit]);

  const stageRows = useMemo(() => {
    const map = new Map<string, number>();
    filteredRequests.forEach((row) => map.set(row.current_stage || "Unassigned", (map.get(row.current_stage || "Unassigned") || 0) + 1));
    return [...map].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [filteredRequests]);

  const monthRows = useMemo(() => {
    const rows: Array<{ key: string; label: string; requestCount: number; requested: number; finance: number; vouchers: number }> = [];
    const start = new Date(`${dateFrom}T00:00:00`);
    const end = new Date(`${dateTo}T23:59:59`);
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end && rows.length < 24) {
      rows.push({ key: `${cursor.getFullYear()}-${cursor.getMonth()}`, label: cursor.toLocaleDateString("en-NG", { month: "short", year: "2-digit" }), requestCount: 0, requested: 0, finance: 0, vouchers: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const map = new Map(rows.map((row) => [row.key, row]));
    filteredRequests.forEach((row) => { const date = new Date(row.created_at); const item = map.get(`${date.getFullYear()}-${date.getMonth()}`); if (item) { item.requestCount += 1; item.requested += n(row.amount); } });
    filteredTransactions.forEach((row) => { const date = new Date(rowDate(row)); const item = map.get(`${date.getFullYear()}-${date.getMonth()}`); if (item) item.finance += Math.abs(n(row.amount)); });
    filteredVouchers.forEach((row) => { const date = new Date(rowDate(row)); const item = map.get(`${date.getFullYear()}-${date.getMonth()}`); if (item) item.vouchers += n(row.total_amount || row.amount || row.net_amount); });
    return rows;
  }, [dateFrom, dateTo, filteredRequests, filteredTransactions, filteredVouchers]);

  const annualRows = useMemo(() => {
    const map = new Map<number, { year: number; requests: number; requested: number; finance: number; vouchers: number }>();
    const ensure = (year: number) => { if (!map.has(year)) map.set(year, { year, requests: 0, requested: 0, finance: 0, vouchers: 0 }); return map.get(year)!; };
    requests.forEach((row) => { const year = new Date(row.created_at).getFullYear(); if (Number.isFinite(year)) { const item = ensure(year); item.requests += 1; item.requested += n(row.amount); } });
    transactions.forEach((row) => { const year = new Date(rowDate(row)).getFullYear(); if (Number.isFinite(year)) ensure(year).finance += Math.abs(n(row.amount)); });
    vouchers.forEach((row) => { const year = new Date(rowDate(row)).getFullYear(); if (Number.isFinite(year)) ensure(year).vouchers += n(row.total_amount || row.amount || row.net_amount); });
    return [...map.values()].sort((a, b) => b.year - a.year).slice(0, 6);
  }, [requests, transactions, vouchers]);

  const departmentRows = useMemo(() => {
    const map = new Map<string, { id: string; name: string; requests: number; completed: number; requested: number; allocation: number; reserved: number; spent: number; balance: number }>();
    departments.forEach((department) => map.set(department.id, { id: department.id, name: department.name, requests: 0, completed: 0, requested: 0, allocation: 0, reserved: 0, spent: 0, balance: 0 }));
    filteredRequests.forEach((row) => {
      const id = row.dept_id || "UNASSIGNED";
      if (!map.has(id)) map.set(id, { id, name: departmentNames.get(id) || "Unassigned", requests: 0, completed: 0, requested: 0, allocation: 0, reserved: 0, spent: 0, balance: 0 });
      const item = map.get(id)!; item.requests += 1; item.requested += n(row.amount); if (requestCompleted(row)) item.completed += 1;
    });
    filteredSubheads.forEach((row) => {
      const id = s(row.dept_id) || "UNASSIGNED";
      if (!map.has(id)) map.set(id, { id, name: departmentNames.get(id) || "Unassigned", requests: 0, completed: 0, requested: 0, allocation: 0, reserved: 0, spent: 0, balance: 0 });
      const item = map.get(id)!; item.allocation += n(row.approved_allocation || row.allocation_amount); item.reserved += n(row.reserved_amount); item.spent += n(row.expenditure || row.spent_amount); item.balance += n(row.balance || row.available_balance);
    });
    return [...map.values()].filter((row) => row.requests || row.allocation).sort((a, b) => b.spent - a.spent);
  }, [departments, departmentNames, filteredRequests, filteredSubheads]);

  const completionRate = requestStats.total ? (requestStats.completed / requestStats.total) * 100 : 0;
  const utilisationRate = financeStats.allocation ? (financeStats.expenditure / financeStats.allocation) * 100 : 0;
  const maxStage = Math.max(1, ...stageRows.map((row) => row.value));
  const maxMonth = Math.max(1, ...monthRows.flatMap((row) => [row.requested, row.finance, row.vouchers]));
  const maxDepartment = Math.max(1, ...departmentRows.map((row) => row.spent));

  const insights = useMemo(() => {
    const rows: Array<{ tone: "emerald" | "amber" | "rose" | "blue"; title: string; text: string }> = [];
    rows.push(utilisationRate >= 90
      ? { tone: "rose", title: "CRITICAL BUDGET PRESSURE", text: `Budget utilisation is ${utilisationRate.toFixed(1)}%. Immediate expenditure restraint and reallocation review are recommended.` }
      : utilisationRate >= 75
        ? { tone: "amber", title: "BUDGET UTILISATION REQUIRES ATTENTION", text: `${utilisationRate.toFixed(1)}% of approved allocation has been consumed. Review fast-moving subheads before new commitments.` }
        : { tone: "emerald", title: "BUDGET POSITION WITHIN CONTROL", text: `${utilisationRate.toFixed(1)}% of approved allocation is utilised, with ${money(financeStats.balance)} recorded balance.` });
    if (stageRows[0]) rows.push({ tone: stageRows[0].value > Math.max(5, requestStats.total * 0.35) ? "amber" : "blue", title: "WORKFLOW BOTTLENECK", text: `${stageRows[0].value} request(s) are concentrated at ${stageRows[0].label}, currently the largest queue.` });
    rows.push(auditStats.exceptions
      ? { tone: "rose", title: "CONTROL EXCEPTIONS DETECTED", text: `${auditStats.exceptions} exception(s) require audit or reconciliation attention.` }
      : { tone: "emerald", title: "NO MATERIAL CONTROL EXCEPTION", text: "Automated checks found no material negative balance, overspend, unlinked subhead, unreconciled ledger or reversed record in scope." });
    return rows;
  }, [utilisationRate, financeStats.balance, stageRows, requestStats.total, auditStats.exceptions]);

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clearPrintWorkspace() {
    document.body.classList.remove("report-print-active");
    const root = document.getElementById("reqgen-print-root");
    if (root) root.innerHTML = "";
  }

  function printSelected() {
    const root = document.getElementById("reqgen-print-root");
    if (!root) return;
    root.innerHTML = "";
    const selectedKeys = printSection === "ALL" ? REPORT_SECTIONS.map((section) => section.key) : [printSection];
    selectedKeys.forEach((sectionKey) => {
      const config = REPORT_SECTIONS.find((section) => section.key === sectionKey);
      const source = document.querySelector<HTMLElement>(`[data-report-section="${sectionKey}"]`);
      if (!config || !source) return;
      const sheet = document.createElement("article");
      sheet.className = "reqgen-a4-sheet";
      const header = document.createElement("header");
      header.className = "reqgen-a4-header";
      header.innerHTML = `<div class="reqgen-a4-brand"><div class="reqgen-a4-mark">RG</div><div><div class="reqgen-a4-org">ISLAMIC EDUCATION TRUST (IET)</div><div class="reqgen-a4-system">REQGEN CENTRAL REPORTS & DECISION INTELLIGENCE</div></div></div><div class="reqgen-a4-meta"><div><span>REPORT:</span> ${config.title}</div><div><span>PERIOD:</span> ${dateFrom} TO ${dateTo}</div><div><span>GENERATED:</span> ${new Date().toLocaleString("en-NG")}</div></div>`;
      const content = document.createElement("div");
      content.className = "reqgen-a4-content";
      const clone = source.cloneNode(true) as HTMLElement;
      clone.removeAttribute("id"); clone.removeAttribute("data-report-section"); clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
      content.appendChild(clone);
      const footer = document.createElement("footer");
      footer.className = "reqgen-a4-footer";
      footer.innerHTML = `<span>OFFICIAL MANAGEMENT REPORT • REQGEN 1.1.0</span><span>CONFIDENTIAL</span>`;
      sheet.append(header, content, footer); root.appendChild(sheet);
    });
    if (!root.children.length) { alert("The selected report section could not be prepared. Refresh the page and try again."); return; }
    document.body.classList.add("report-print-active");
    const cleanup = () => { clearPrintWorkspace(); window.removeEventListener("afterprint", cleanup); };
    window.addEventListener("afterprint", cleanup);
    window.open('/output?report=requests', '_blank', 'noopener,noreferrer');
  }

  function exportReport() {
    downloadCsv(`reqgen-central-report-${dateFrom}-to-${dateTo}.csv`, [
      ["Request No", "Title", "Department", "Type", "Status", "Stage", "Amount", "Created"],
      ...filteredRequests.map((row) => [row.request_no || "", row.title || "", departmentNames.get(row.dept_id || "") || "Unassigned", row.request_type || "", row.status || "", row.current_stage || "", n(row.amount), row.created_at]),
    ]);
  }

  if (loading) return <><ReportsPageStyles /><ReportsSkeleton /></>;

  return <div className="min-h-screen bg-slate-100 p-4 sm:p-7">
    <ReportsPageStyles />
    <style jsx global>{`
      #reqgen-print-root { display:none; }
      [data-report-section] { display:block; }
      .report-section-anchor { scroll-margin-top: 104px; }
      @media print {
        @page { size:A4 portrait; margin:0; }
        html, body { background:#fff !important; }
        body.report-print-active * { visibility:hidden !important; }
        body.report-print-active #reqgen-print-root, body.report-print-active #reqgen-print-root * { visibility:visible !important; }
        body.report-print-active #reqgen-print-root { display:block !important; position:absolute; inset:0; width:100%; background:#fff; }
        .reqgen-a4-sheet { box-sizing:border-box; width:210mm; min-height:297mm; margin:0 auto; padding:12mm 12mm 13mm; background:#fff; color:#0f172a; page-break-after:always; position:relative; }
        .reqgen-a4-sheet:last-child { page-break-after:auto; }
        .reqgen-a4-header { display:flex; justify-content:space-between; gap:8mm; padding-bottom:5mm; border-bottom:1.5px solid #0f172a; }
        .reqgen-a4-brand { display:flex; align-items:center; gap:3mm; }
        .reqgen-a4-mark { width:12mm; height:12mm; display:grid; place-items:center; border-radius:3mm; background:#0f172a; color:#fff; font-weight:900; font-size:11pt; }
        .reqgen-a4-org { font-size:10pt; font-weight:900; letter-spacing:.04em; }
        .reqgen-a4-system { margin-top:1mm; font-size:7.5pt; font-weight:700; color:#475569; }
        .reqgen-a4-meta { text-align:right; font-size:7pt; line-height:1.55; color:#475569; }
        .reqgen-a4-meta span { font-weight:900; color:#0f172a; }
        .reqgen-a4-content { margin-top:5mm; }
        .reqgen-a4-content .rounded-3xl, .reqgen-a4-content .rounded-2xl { border-radius:2mm !important; box-shadow:none !important; }
        .reqgen-a4-content h2 { font-size:11pt !important; text-transform:uppercase !important; }
        .reqgen-a4-content table { width:100% !important; font-size:6.5pt !important; }
        .reqgen-a4-content th, .reqgen-a4-content td { padding:1.6mm 1.8mm !important; }
        .reqgen-a4-content article, .reqgen-a4-content section, .reqgen-a4-content table, .reqgen-a4-content tr { break-inside:avoid; }
        .reqgen-a4-footer { position:absolute; left:12mm; right:12mm; bottom:6mm; display:flex; justify-content:space-between; border-top:1px solid #cbd5e1; padding-top:2mm; font-size:6.5pt; font-weight:800; color:#64748b; }
      }
    `}</style>
    <div id="reqgen-print-root" aria-hidden="true" />

    <main className="mx-auto max-w-[1600px] space-y-6">
      <ReportsHero actions={<>
        <ReportButton icon="refresh" variant="cyan" disabled={refreshing} onClick={() => void load(true)}>{refreshing ? "Refreshing…" : "Refresh Data"}</ReportButton>
        <ReportButton icon="download" variant="violet" onClick={exportReport}>Export CSV</ReportButton>
        <ReportButton icon="print" variant="blue" onClick={printSelected}>{printSection === "ALL" ? "Print All" : "Print Section"}</ReportButton>
        <ReportButton icon="download" variant="cyan" onClick={() => router.push("/output")}>Output Centre</ReportButton>
        <ReportButton icon="report" variant="violet" onClick={() => router.push("/audit-centre")}>Audit Centre</ReportButton>
      </>} />

      <section className="report-no-print sticky top-20 z-30 rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-xl shadow-slate-300/30 backdrop-blur-xl">
        <div className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white"><ReportIcon name="print" /></div><div><h2 className="text-lg font-black uppercase tracking-wide text-slate-950">REPORT NAVIGATION & PRINT CENTRE</h2><p className="text-sm text-slate-500">Every option corresponds exactly with a visible report section below.</p></div></div>
            <div className="mt-4 flex flex-wrap gap-2">{REPORT_SECTIONS.map((section) => <button key={section.key} type="button" onClick={() => scrollToSection(section.id)} className="reqgen-btn reqgen-btn-violet inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-xs font-black uppercase tracking-wide text-blue-900 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-100 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-100"><ReportIcon name={section.icon} className="h-4 w-4" />{section.shortTitle}</button>)}</div>
          </div>
          <label className="block min-w-[300px] text-xs font-black uppercase tracking-[0.14em] text-slate-600">Select section to print
            <div className="relative mt-2"><select value={printSection} onChange={(event) => setPrintSection(event.target.value as PrintKey)} className="h-12 w-full appearance-none rounded-2xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 px-4 pr-11 text-sm font-black text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"><option value="ALL">PRINT ALL SECTIONS</option>{REPORT_SECTIONS.map((section) => <option key={section.key} value={section.key}>{section.title}</option>)}</select><ReportIcon name="chevron" className="pointer-events-none absolute right-4 top-3.5 h-5 w-5 text-blue-700" /></div>
          </label>
        </div>
      </section>

      <section className="report-no-print rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white"><ReportIcon name="filter" /></div><div><h2 className="font-black uppercase tracking-wide text-slate-950">INSTITUTIONAL REPORT CONTROLS</h2><p className="text-sm text-slate-500">One scope controls requests, finance, vouchers, audit and departmental intelligence.</p></div></div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm font-bold text-slate-700">From<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
          <label className="text-sm font-bold text-slate-700">To<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
          <label className="text-sm font-bold text-slate-700">Department<select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"><option value="ALL">All departments</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
          <label className="text-sm font-bold text-slate-700">Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="COMPLETED">Completed</option><option value="REJECTED">Rejected / cancelled</option></select></label>
          <label className="text-sm font-bold text-slate-700">Request type<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"><option value="ALL">All types</option><option value="OFFICIAL">Official</option><option value="PERSONAL">Personal</option></select></label>
        </div>
      </section>

      {fatalError && <Insight tone="rose" title="REPORT LOADING ERROR" text={fatalError} />}
      {issues.length > 0 && <ReportSection title="DATA SOURCE STATUS" description="Core reporting remains available. The optional sources below are not configured or are restricted for this account." icon="warning"><div className="grid gap-3 md:grid-cols-2">{issues.map((issue) => { const unavailable = /could not find the table|schema cache|does not exist/i.test(issue.message); return <div key={`${issue.source}-${issue.message}`} className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4"><div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-500 text-white"><ReportIcon name="warning" className="h-4 w-4" /></div><div><p className="text-sm font-black uppercase tracking-wide text-amber-950">{issue.source}</p><p className="mt-1 text-sm leading-6 text-amber-800">{unavailable ? "Optional reporting source is not currently available. This does not affect the other report sections." : "Access to this optional source is restricted. Contact the system administrator when this dataset is required."}</p></div></div>; })}</div></ReportSection>}

      <div id="executive-overview" data-report-section="EXECUTIVE" className="report-section-anchor space-y-6">
        <ReportSection title="EXECUTIVE OVERVIEW & DECISION INSIGHTS" description="Institution-wide position, management priorities and decision-critical indicators." icon="chart">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ReportStat label="Total Requests" value={requestStats.total.toLocaleString()} note={`${completionRate.toFixed(1)}% completion rate`} icon="request" tone="blue" />
            <ReportStat label="Requested Value" value={money(requestStats.amount)} note="Total demand in reporting scope" icon="money" tone="violet" />
            <ReportStat label="Approved Allocation" value={money(financeStats.allocation)} note={`${utilisationRate.toFixed(1)}% utilised`} icon="building" tone="cyan" progress={utilisationRate} />
            <ReportStat label="Available Balance" value={money(financeStats.balance)} note={`Reserved: ${money(financeStats.reserved)}`} icon="money" tone="emerald" />
            <ReportStat label="Finance Movement" value={money(financeStats.movement)} note={`${filteredTransactions.length} transaction(s)`} icon="chart" tone="blue" />
            <ReportStat label="Payment Vouchers" value={voucherStats.total.toLocaleString()} note={`Value: ${money(voucherStats.value)}`} icon="request" tone="amber" />
            <ReportStat label="Audit Exceptions" value={auditStats.exceptions.toLocaleString()} note={`${auditStats.events} audit event(s)`} icon="warning" tone={auditStats.exceptions ? "rose" : "emerald"} />
            <ReportStat label="Account Transfers" value={filteredTransfers.length.toLocaleString()} note="Transfers recorded in period" icon="clock" tone="violet" />
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">{insights.map((insight) => <Insight key={insight.title} {...insight} />)}</div>
        </ReportSection>
      </div>

      <div id="requests-workflow" data-report-section="REQUESTS" className="report-section-anchor space-y-6">
        <ReportSection title="REQUESTS & WORKFLOW PERFORMANCE" description="Request demand, status distribution, workflow queues, processing activity and document controls." icon="request">
          <div className="grid gap-6 xl:grid-cols-3">
            <Donut center={requestStats.total.toLocaleString()} note="requests" segments={[{ label: "Active", value: requestStats.active, color: "#f59e0b" }, { label: "Completed", value: requestStats.completed, color: "#10b981" }, { label: "Rejected", value: requestStats.rejected, color: "#f43f5e" }]} />
            <div className="space-y-4">{stageRows.slice(0, 10).map((row, index) => <DataBar key={row.label} label={row.label} value={row.value} max={maxStage} tone={index === 0 ? "rose" : index < 3 ? "amber" : "violet"} />)}{stageRows.length === 0 && <p className="text-sm text-slate-500">No workflow records in the selected period.</p>}</div>
            <div className="grid gap-3"><Insight tone={completionRate >= 70 ? "emerald" : "amber"} title="COMPLETION RATE" text={`${requestStats.completed} of ${requestStats.total} request(s) are completed (${completionRate.toFixed(1)}%).`} /><Insight tone="blue" title="REQUEST HISTORY ACTIVITY" text={`${filteredHistory.length} workflow history event(s) were recorded in the period.`} /><Insight tone="blue" title="ATTACHMENT CONTROL" text={`${attachments.length} request attachment record(s) are available for supporting-document analysis.`} /></div>
          </div>
        </ReportSection>
      </div>

      <div id="monthly-finance-report" data-report-section="MONTHLY_FINANCE" className="report-section-anchor space-y-6">
        <ReportSection title="MONTHLY FINANCE REPORT" description="Monthly requested value, financial movement and payment voucher value for the selected reporting period." icon="chart">
          <div className="overflow-x-auto"><div className="min-w-[820px]"><div className="grid h-80 items-end gap-3 rounded-2xl bg-slate-50 p-5" style={{ gridTemplateColumns: `repeat(${Math.max(1, monthRows.length)}, minmax(38px, 1fr))` }}>{monthRows.map((row) => <div key={row.key} className="flex h-full flex-col justify-end"><div className="flex h-[240px] items-end justify-center gap-1"><div className="w-2.5 rounded-t bg-blue-600" style={{ height: `${Math.max(row.requested ? 4 : 0, (row.requested / maxMonth) * 225)}px` }} title={`Requested: ${money(row.requested)}`} /><div className="w-2.5 rounded-t bg-emerald-500" style={{ height: `${Math.max(row.finance ? 4 : 0, (row.finance / maxMonth) * 225)}px` }} title={`Finance: ${money(row.finance)}`} /><div className="w-2.5 rounded-t bg-violet-500" style={{ height: `${Math.max(row.vouchers ? 4 : 0, (row.vouchers / maxMonth) * 225)}px` }} title={`Vouchers: ${money(row.vouchers)}`} /></div><div className="mt-2 text-center text-[10px] font-black text-slate-600">{row.label}</div></div>)}</div><div className="mt-3 flex flex-wrap gap-5 text-xs font-bold text-slate-600"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded bg-blue-600" />Requested value</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded bg-emerald-500" />Finance movement</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded bg-violet-500" />Voucher value</span></div></div></div>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-slate-950 text-white"><tr><th className="px-4 py-3 text-left">Month</th><th className="px-4 py-3 text-right">Requests</th><th className="px-4 py-3 text-right">Requested</th><th className="px-4 py-3 text-right">Finance Movement</th><th className="px-4 py-3 text-right">Voucher Value</th></tr></thead><tbody>{monthRows.map((row) => <tr key={row.key} className="border-t border-slate-100"><td className="px-4 py-3 font-bold">{row.label}</td><td className="px-4 py-3 text-right">{row.requestCount}</td><td className="px-4 py-3 text-right">{money(row.requested)}</td><td className="px-4 py-3 text-right">{money(row.finance)}</td><td className="px-4 py-3 text-right">{money(row.vouchers)}</td></tr>)}</tbody></table></div>
        </ReportSection>
      </div>

      <div id="annual-finance-report" data-report-section="ANNUAL_FINANCE" className="report-section-anchor space-y-6">
        <ReportSection title="ANNUAL FINANCE REPORT" description="Multi-year comparison of institutional requests, financial movement and payment voucher obligations." icon="building">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><ReportStat label="Annual Allocation" value={money(financeStats.allocation)} note="Approved subhead allocation" icon="building" tone="blue" /><ReportStat label="Annual Expenditure" value={money(financeStats.expenditure)} note={`${utilisationRate.toFixed(1)}% utilisation`} icon="money" tone="rose" progress={utilisationRate} /><ReportStat label="Reserved Commitments" value={money(financeStats.reserved)} note="Outstanding reservations" icon="clock" tone="amber" /><ReportStat label="Closing Balance" value={money(financeStats.balance)} note="Recorded available balance" icon="check" tone="emerald" /></div>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-slate-950 text-white"><tr><th className="px-4 py-3 text-left">Year</th><th className="px-4 py-3 text-right">Requests</th><th className="px-4 py-3 text-right">Requested Value</th><th className="px-4 py-3 text-right">Finance Movement</th><th className="px-4 py-3 text-right">Voucher Value</th></tr></thead><tbody>{annualRows.map((row) => <tr key={row.year} className="border-t border-slate-100"><td className="px-4 py-3 font-black">{row.year}</td><td className="px-4 py-3 text-right">{row.requests}</td><td className="px-4 py-3 text-right">{money(row.requested)}</td><td className="px-4 py-3 text-right">{money(row.finance)}</td><td className="px-4 py-3 text-right">{money(row.vouchers)}</td></tr>)}{annualRows.length === 0 && <EmptyRow colSpan={5} text="No annual report data is available." />}</tbody></table></div>
        </ReportSection>
      </div>

      <div id="payment-voucher-report" data-report-section="VOUCHERS" className="report-section-anchor space-y-6">
        <ReportSection title="PAYMENT VOUCHER REPORT" description="Voucher volume, value, status, item detail and approval-history activity." icon="money">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><ReportStat label="Total Vouchers" value={voucherStats.total} note="Filtered voucher records" icon="request" tone="blue" /><ReportStat label="Voucher Value" value={money(voucherStats.value)} note="Gross recorded value" icon="money" tone="violet" /><ReportStat label="Paid / Completed" value={voucherStats.paid} note="Finalised vouchers" icon="check" tone="emerald" /><ReportStat label="Pending" value={voucherStats.pending} note="Draft or processing" icon="clock" tone="amber" /><ReportStat label="Rejected / Void" value={voucherStats.rejected} note="Control exceptions" icon="warning" tone="rose" /></div>
          <div className="mt-6 grid gap-6 xl:grid-cols-2"><Donut center={voucherStats.total.toLocaleString()} note="vouchers" segments={[{ label: "Paid / completed", value: voucherStats.paid, color: "#10b981" }, { label: "Pending", value: voucherStats.pending, color: "#f59e0b" }, { label: "Rejected / void", value: voucherStats.rejected, color: "#f43f5e" }]} /><div className="grid gap-3"><Insight tone="blue" title="VOUCHER ITEM COVERAGE" text={`${voucherItems.length} payment voucher item record(s) are available.`} /><Insight tone="blue" title="VOUCHER HISTORY" text={`${filteredVoucherHistory.length} voucher workflow or approval event(s) were recorded in the period.`} /><Insight tone={voucherStats.pending > voucherStats.paid ? "amber" : "emerald"} title="PROCESSING POSITION" text={`${voucherStats.pending} pending voucher(s) compared with ${voucherStats.paid} completed voucher(s).`} /></div></div>
        </ReportSection>
      </div>

      <div id="audit-reconciliation" data-report-section="AUDIT" className="report-section-anchor space-y-6">
        <ReportSection title="AUDIT, COMPLIANCE & RECONCILIATION" description="Automated control checks, audit evidence, ledger reconciliation and exception monitoring." icon="warning">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6"><ReportStat label="Audit Events" value={auditStats.events} note="Accessible audit records" icon="report" tone="blue" /><ReportStat label="Negative Balances" value={auditStats.negativeSubheads} note="Subheads below zero" icon="warning" tone={auditStats.negativeSubheads ? "rose" : "emerald"} /><ReportStat label="Overspent Subheads" value={auditStats.overspent} note="Expenditure above allocation" icon="warning" tone={auditStats.overspent ? "rose" : "emerald"} /><ReportStat label="Unlinked Subheads" value={auditStats.unlinkedSubheads} note="Missing department link" icon="building" tone={auditStats.unlinkedSubheads ? "amber" : "emerald"} /><ReportStat label="Unreconciled Ledger" value={auditStats.unreconciled} note="Not matched or cleared" icon="clock" tone={auditStats.unreconciled ? "amber" : "emerald"} /><ReportStat label="Reversed / Void" value={auditStats.reversed} note="Reversed control records" icon="warning" tone={auditStats.reversed ? "rose" : "emerald"} /></div>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-slate-950 text-white"><tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Source</th><th className="px-4 py-3 text-left">Action / Event</th><th className="px-4 py-3 text-left">Reference</th><th className="px-4 py-3 text-left">Details</th></tr></thead><tbody>{filteredAudit.slice(0, 30).map((row, index) => <tr key={`${s(row.id)}-${index}`} className="border-t border-slate-100"><td className="px-4 py-3 whitespace-nowrap">{dateLabel(rowDate(row))}</td><td className="px-4 py-3 font-bold">{s(row.__source || row.source || "Audit")}</td><td className="px-4 py-3">{s(row.action || row.event_type || row.activity || row.operation || "Event")}</td><td className="px-4 py-3">{s(row.reference_no || row.request_no || row.voucher_no || row.entity_id || "—")}</td><td className="max-w-md px-4 py-3 text-slate-600">{s(row.details || row.description || row.notes || row.reason || "—")}</td></tr>)}{filteredAudit.length === 0 && <EmptyRow colSpan={5} text="No audit records are available in the selected period." />}</tbody></table></div>
        </ReportSection>
      </div>

      <div id="department-subhead-performance" data-report-section="DEPARTMENTS" className="report-section-anchor space-y-6">
        <ReportSection title="DEPARTMENT & SUBHEAD PERFORMANCE" description="Department demand, completion, allocation, expenditure, reservation and available balance." icon="building">
          <div className="grid gap-6 xl:grid-cols-2"><div className="space-y-4">{departmentRows.slice(0, 12).map((row, index) => <DataBar key={row.id} label={row.name} value={row.spent} max={maxDepartment} valueLabel={compactMoney(row.spent)} tone={index < 3 ? "rose" : index < 6 ? "amber" : "blue"} />)}</div><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-slate-950 text-white"><tr><th className="px-4 py-3 text-left">Department</th><th className="px-4 py-3 text-right">Requests</th><th className="px-4 py-3 text-right">Completion</th><th className="px-4 py-3 text-right">Allocation</th><th className="px-4 py-3 text-right">Spent</th><th className="px-4 py-3 text-right">Balance</th></tr></thead><tbody>{departmentRows.map((row) => <tr key={row.id} className="border-t border-slate-100"><td className="px-4 py-3 font-bold">{row.name}</td><td className="px-4 py-3 text-right">{row.requests}</td><td className="px-4 py-3 text-right">{row.requests ? `${((row.completed / row.requests) * 100).toFixed(1)}%` : "—"}</td><td className="px-4 py-3 text-right">{money(row.allocation)}</td><td className="px-4 py-3 text-right">{money(row.spent)}</td><td className="px-4 py-3 text-right">{money(row.balance)}</td></tr>)}{departmentRows.length === 0 && <EmptyRow colSpan={6} text="No department performance data is available." />}</tbody></table></div></div>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-blue-950 text-white"><tr><th className="px-4 py-3 text-left">Subhead</th><th className="px-4 py-3 text-left">Department</th><th className="px-4 py-3 text-right">Allocation</th><th className="px-4 py-3 text-right">Reserved</th><th className="px-4 py-3 text-right">Expenditure</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3 text-left">Status</th></tr></thead><tbody>{filteredSubheads.slice(0, 100).map((row, index) => <tr key={`${s(row.id)}-${index}`} className="border-t border-slate-100"><td className="px-4 py-3 font-bold">{s(row.code || row.subhead_code)} — {s(row.name || row.title || row.description)}</td><td className="px-4 py-3">{departmentNames.get(s(row.dept_id)) || "Unassigned"}</td><td className="px-4 py-3 text-right">{money(row.approved_allocation || row.allocation_amount)}</td><td className="px-4 py-3 text-right">{money(row.reserved_amount)}</td><td className="px-4 py-3 text-right">{money(row.expenditure || row.spent_amount)}</td><td className="px-4 py-3 text-right">{money(row.balance || row.available_balance)}</td><td className="px-4 py-3">{n(row.balance || row.available_balance) < 0 ? "Negative" : n(row.expenditure || row.spent_amount) > n(row.approved_allocation || row.allocation_amount) ? "Overspent" : "Within control"}</td></tr>)}{filteredSubheads.length === 0 && <EmptyRow colSpan={7} text="No subhead records are available." />}</tbody></table></div>
        </ReportSection>
      </div>

      <div id="accounts-transfers-ledger" data-report-section="ACCOUNTS" className="report-section-anchor space-y-6">
        <ReportSection title="ACCOUNTS, TRANSFERS & BANK LEDGER" description="Institutional accounts, account transactions, transfer activity and bank-ledger reconciliation position." icon="money">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><ReportStat label="Institutional Accounts" value={accounts.length} note="Accessible account records" icon="building" tone="blue" /><ReportStat label="Account Transactions" value={filteredAccountTransactions.length} note="Transactions in period" icon="chart" tone="cyan" /><ReportStat label="Account Transfers" value={filteredTransfers.length} note="Transfers in period" icon="clock" tone="violet" /><ReportStat label="Bank Ledger Entries" value={filteredLedger.length} note={`${auditStats.unreconciled} unreconciled`} icon="report" tone={auditStats.unreconciled ? "amber" : "emerald"} /></div>
          <div className="mt-6 grid gap-6 xl:grid-cols-2"><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-slate-950 text-white"><tr><th className="px-4 py-3 text-left">Account</th><th className="px-4 py-3 text-left">Bank</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3 text-left">Status</th></tr></thead><tbody>{accounts.slice(0, 50).map((row, index) => <tr key={`${s(row.id)}-${index}`} className="border-t border-slate-100"><td className="px-4 py-3 font-bold">{s(row.account_name || row.name || row.account_no || row.account_number || "Account")}</td><td className="px-4 py-3">{s(row.bank_name || row.bank || "—")}</td><td className="px-4 py-3 text-right">{money(row.current_balance || row.balance || row.available_balance)}</td><td className="px-4 py-3">{s(row.status || (row.is_active === false ? "Inactive" : "Active"))}</td></tr>)}{accounts.length === 0 && <EmptyRow colSpan={4} text="No institutional account records are available." />}</tbody></table></div><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-blue-950 text-white"><tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Reference</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-left">Status</th></tr></thead><tbody>{filteredTransfers.slice(0, 50).map((row, index) => <tr key={`${s(row.id)}-${index}`} className="border-t border-slate-100"><td className="px-4 py-3">{dateLabel(rowDate(row))}</td><td className="px-4 py-3 font-bold">{s(row.transfer_no || row.reference_no || row.reference || "Transfer")}</td><td className="px-4 py-3 text-right">{money(row.amount)}</td><td className="px-4 py-3">{s(row.status || "Recorded")}</td></tr>)}{filteredTransfers.length === 0 && <EmptyRow colSpan={4} text="No transfer records are available in the selected period." />}</tbody></table></div></div>
        </ReportSection>
      </div>

      <div id="detailed-registers" data-report-section="REGISTERS" className="report-section-anchor space-y-6">
        <ReportSection title="DETAILED INSTITUTIONAL REGISTERS" description="Operational registers supporting verification, printing, export and management review." icon="report">
          <div className="space-y-6">
            <div><h3 className="mb-3 font-black uppercase tracking-wide text-slate-950">REQUEST REGISTER</h3><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-slate-950 text-white"><tr><th className="px-4 py-3 text-left">Request No.</th><th className="px-4 py-3 text-left">Title</th><th className="px-4 py-3 text-left">Department</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-left">Stage</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-left">Created</th></tr></thead><tbody>{filteredRequests.slice(0, 150).map((row) => <tr key={row.id} className="border-t border-slate-100"><td className="px-4 py-3 font-black">{row.request_no || "—"}</td><td className="max-w-sm px-4 py-3">{row.title || "Untitled request"}</td><td className="px-4 py-3">{departmentNames.get(row.dept_id || "") || "Unassigned"}</td><td className="px-4 py-3">{row.status || "—"}</td><td className="px-4 py-3">{row.current_stage || "—"}</td><td className="px-4 py-3 text-right">{money(row.amount)}</td><td className="px-4 py-3 whitespace-nowrap">{dateLabel(row.created_at)}</td></tr>)}{filteredRequests.length === 0 && <EmptyRow colSpan={7} text="No request records are available in the selected reporting scope." />}</tbody></table></div></div>
            <div><h3 className="mb-3 font-black uppercase tracking-wide text-slate-950">FINANCE TRANSACTION REGISTER</h3><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-blue-950 text-white"><tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Reference</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Description</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-left">Status</th></tr></thead><tbody>{filteredTransactions.slice(0, 150).map((row, index) => <tr key={`${s(row.id)}-${index}`} className="border-t border-slate-100"><td className="px-4 py-3 whitespace-nowrap">{dateLabel(rowDate(row))}</td><td className="px-4 py-3 font-black">{s(row.reference_no || row.transaction_no || row.reference || "—")}</td><td className="px-4 py-3">{s(row.transaction_type || row.type || "—")}</td><td className="max-w-md px-4 py-3">{s(row.description || row.narration || row.notes || "—")}</td><td className="px-4 py-3 text-right">{money(row.amount)}</td><td className="px-4 py-3">{s(row.status || "Recorded")}</td></tr>)}{filteredTransactions.length === 0 && <EmptyRow colSpan={6} text="No finance transactions are available in the selected reporting scope." />}</tbody></table></div></div>
            <div><h3 className="mb-3 font-black uppercase tracking-wide text-slate-950">PAYMENT VOUCHER REGISTER</h3><div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full text-sm"><thead className="bg-violet-950 text-white"><tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Voucher No.</th><th className="px-4 py-3 text-left">Payee / Description</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-left">Status</th></tr></thead><tbody>{filteredVouchers.slice(0, 150).map((row, index) => <tr key={`${s(row.id)}-${index}`} className="border-t border-slate-100"><td className="px-4 py-3 whitespace-nowrap">{dateLabel(rowDate(row))}</td><td className="px-4 py-3 font-black">{s(row.voucher_no || row.pv_no || row.reference_no || "—")}</td><td className="max-w-md px-4 py-3">{s(row.payee_name || row.payee || row.description || row.purpose || "—")}</td><td className="px-4 py-3 text-right">{money(row.total_amount || row.amount || row.net_amount)}</td><td className="px-4 py-3">{s(row.status || "—")}</td></tr>)}{filteredVouchers.length === 0 && <EmptyRow colSpan={5} text="No payment vouchers are available in the selected reporting scope." />}</tbody></table></div></div>
          </div>
        </ReportSection>
      </div>
    </main>
  </div>;
}
