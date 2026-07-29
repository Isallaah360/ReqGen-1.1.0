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
type RequestRow = { id: string; request_no: string | null; title: string | null; amount: number | null; status: string | null; current_stage: string | null; request_type: string | null; dept_id: string | null; created_at: string };
type DepartmentRow = { id: string; name: string };
type LoadIssue = { source: string; message: string };
type StatusFilter = "ALL" | "ACTIVE" | "COMPLETED" | "REJECTED";
type TypeFilter = "ALL" | "OFFICIAL" | "PERSONAL";
type PrintSection = "ALL" | "OVERVIEW" | "REQUESTS" | "FINANCE" | "VOUCHERS" | "AUDIT" | "DEPARTMENTS" | "REGISTERS";

const PRINT_OPTIONS: Array<{ value: PrintSection; label: string }> = [
  { value: "ALL", label: "Print all report sections" },
  { value: "OVERVIEW", label: "Executive overview only" },
  { value: "REQUESTS", label: "Request intelligence" },
  { value: "FINANCE", label: "Finance: monthly & annual" },
  { value: "VOUCHERS", label: "Payment voucher report" },
  { value: "AUDIT", label: "Audit & reconciliation" },
  { value: "DEPARTMENTS", label: "Department performance" },
  { value: "REGISTERS", label: "Detailed registers" },
];

function n(value: unknown) { const x = Number(value ?? 0); return Number.isFinite(x) ? x : 0; }
function s(value: unknown) { return String(value ?? "").trim(); }
function money(value: unknown) { return "₦" + Math.round(n(value)).toLocaleString("en-NG"); }
function compactMoney(value: unknown) { return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", notation: "compact", maximumFractionDigits: 1 }).format(n(value)); }
function key(value: unknown) { return s(value).toUpperCase().replace(/[\s_-]+/g, ""); }
function dateInput(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function isRejected(row: RequestRow) { return /reject|delete|cancel/.test(`${row.status || ""} ${row.current_stage || ""}`.toLowerCase()); }
function isCompleted(row: RequestRow) { return /complete|paid|closed|approved/.test(`${row.status || ""} ${row.current_stage || ""}`.toLowerCase()); }
function isActive(row: RequestRow) { return !isRejected(row) && !isCompleted(row); }
function rowDate(row: AnyRow) { return s(row.transaction_date || row.voucher_date || row.created_at || row.updated_at || row.date); }
function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}

function DataBar({ label, value, max, tone = "blue", suffix = "" }: { label: string; value: number; max: number; tone?: "blue" | "emerald" | "amber" | "rose" | "violet" | "cyan"; suffix?: string }) {
  const styles = { blue: "from-blue-700 to-cyan-400", emerald: "from-emerald-700 to-teal-400", amber: "from-amber-600 to-orange-400", rose: "from-rose-700 to-pink-400", violet: "from-violet-700 to-fuchsia-400", cyan: "from-cyan-700 to-sky-400" };
  const pct = max ? Math.max(value > 0 ? 3 : 0, Math.min(100, value / max * 100)) : 0;
  return <div><div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="truncate font-bold text-slate-700">{label}</span><span className="shrink-0 font-black text-slate-950">{value.toLocaleString()}{suffix}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full bg-gradient-to-r ${styles[tone]}`} style={{ width: `${pct}%` }}/></div></div>;
}

function Donut({ segments, center, note }: { segments: Array<{ label: string; value: number; color: string }>; center: string; note: string }) {
  const total = Math.max(1, segments.reduce((a, b) => a + b.value, 0)); let cursor = 0;
  const gradient = segments.map((segment) => { const start = cursor; cursor += segment.value / total * 100; return `${segment.color} ${start}% ${cursor}%`; }).join(",");
  return <div className="grid gap-5 sm:grid-cols-[170px_1fr] sm:items-center"><div className="relative mx-auto h-40 w-40 rounded-full" style={{ background: `conic-gradient(${gradient || "#e2e8f0 0 100%"})` }}><div className="absolute inset-7 grid place-items-center rounded-full bg-white text-center shadow-inner"><div><div className="text-2xl font-black text-slate-950">{center}</div><div className="text-[11px] font-bold text-slate-500">{note}</div></div></div></div><div className="space-y-3">{segments.map((item) => <div key={item.label} className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 font-bold text-slate-700"><span className="h-3 w-3 rounded-full" style={{ background: item.color }}/>{item.label}</span><span className="font-black text-slate-950">{item.value.toLocaleString()}</span></div>)}</div></div>;
}

function Insight({ tone, title, text }: { tone: "emerald" | "amber" | "rose" | "blue"; title: string; text: string }) {
  const c = { emerald: "border-emerald-200 bg-emerald-50 text-emerald-900", amber: "border-amber-200 bg-amber-50 text-amber-900", rose: "border-rose-200 bg-rose-50 text-rose-900", blue: "border-blue-200 bg-blue-50 text-blue-900" };
  return <div className={`rounded-2xl border p-4 ${c[tone]}`}><div className="font-black">{title}</div><p className="mt-1 text-sm leading-6 opacity-90">{text}</p></div>;
}

export default function ReportsAnalyticsPage() {
  const router = useRouter(); const today = new Date(); const defaultStart = new Date(today.getFullYear(), 0, 1);
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [fatalError, setFatalError] = useState<string | null>(null); const [issues, setIssues] = useState<LoadIssue[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]); const [departments, setDepartments] = useState<DepartmentRow[]>([]); const [subheads, setSubheads] = useState<AnyRow[]>([]); const [transactions, setTransactions] = useState<AnyRow[]>([]); const [vouchers, setVouchers] = useState<AnyRow[]>([]); const [accounts, setAccounts] = useState<AnyRow[]>([]); const [transfers, setTransfers] = useState<AnyRow[]>([]); const [bankLedger, setBankLedger] = useState<AnyRow[]>([]); const [auditRows, setAuditRows] = useState<AnyRow[]>([]);
  const [dateFrom, setDateFrom] = useState(dateInput(defaultStart)); const [dateTo, setDateTo] = useState(dateInput(today)); const [departmentFilter, setDepartmentFilter] = useState("ALL"); const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL"); const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL"); const [printSection, setPrintSection] = useState<PrintSection>("ALL");

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true); setFatalError(null); setIssues([]);
    try {
      const auth = await getCurrentAuthContext(); if (!auth) { router.replace("/login?next=%2Freports"); return; }
      if (!hasAnyRole(auth.roleSet, [...REPORT_ACCESS_ROLES])) { router.replace("/unauthorized?from=%2Freports"); return; }
      const results = await Promise.all([
        supabase.from("requests").select("id,request_no,title,amount,status,current_stage,request_type,dept_id,created_at").order("created_at", { ascending: false }).limit(5000),
        supabase.from("departments").select("id,name").order("name"),
        supabase.from("subheads").select("*").limit(5000),
        supabase.from("finance_transactions").select("*").order("created_at", { ascending: false }).limit(5000),
        supabase.from("payment_vouchers").select("*").order("created_at", { ascending: false }).limit(5000),
        supabase.from("iet_accounts").select("*").limit(1000),
        supabase.from("account_transfers").select("*").order("created_at", { ascending: false }).limit(5000),
        supabase.from("iet_bank_ledger").select("*").order("created_at", { ascending: false }).limit(5000),
      ]);
      const labels = ["Requests", "Departments", "Subheads", "Finance transactions", "Payment vouchers", "IET accounts", "Account transfers", "Bank ledger"];
      const nextIssues: LoadIssue[] = []; results.forEach((result, index) => { if (result.error) nextIssues.push({ source: labels[index], message: result.error.message }); });
      setRequests((results[0].data || []) as RequestRow[]); setDepartments((results[1].data || []) as DepartmentRow[]); setSubheads((results[2].data || []) as AnyRow[]); setTransactions((results[3].data || []) as AnyRow[]); setVouchers((results[4].data || []) as AnyRow[]); setAccounts((results[5].data || []) as AnyRow[]); setTransfers((results[6].data || []) as AnyRow[]); setBankLedger((results[7].data || []) as AnyRow[]);
      let auditData: AnyRow[] = []; for (const table of ["finance_audit_trail", "audit_logs", "finance_activity_history", "manual_payment_voucher_audit"]) { const res = await supabase.from(table).select("*").order("created_at", { ascending: false }).limit(1000); if (!res.error) { auditData = [...auditData, ...((res.data || []) as AnyRow[])]; } }
      setAuditRows(auditData.sort((a, b) => new Date(rowDate(b) || 0).getTime() - new Date(rowDate(a) || 0).getTime())); setIssues(nextIssues);
    } catch (error) { setFatalError(error instanceof Error ? error.message : "Unable to load the institutional report."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [router]);

  useEffect(() => { load(); const onFocus = () => load(true); window.addEventListener("focus", onFocus); return () => window.removeEventListener("focus", onFocus); }, [load]);
  const inRange = useCallback((value: string) => { if (!value) return false; const t = new Date(value).getTime(); return t >= new Date(`${dateFrom}T00:00:00`).getTime() && t <= new Date(`${dateTo}T23:59:59.999`).getTime(); }, [dateFrom, dateTo]);
  const filteredRequests = useMemo(() => requests.filter((row) => { if (!inRange(row.created_at)) return false; if (departmentFilter !== "ALL" && row.dept_id !== departmentFilter) return false; if (statusFilter === "ACTIVE" && !isActive(row)) return false; if (statusFilter === "COMPLETED" && !isCompleted(row)) return false; if (statusFilter === "REJECTED" && !isRejected(row)) return false; if (typeFilter !== "ALL" && key(row.request_type) !== typeFilter) return false; return true; }), [requests, inRange, departmentFilter, statusFilter, typeFilter]);
  const filteredTransactions = useMemo(() => transactions.filter((row) => inRange(rowDate(row))), [transactions, inRange]); const filteredVouchers = useMemo(() => vouchers.filter((row) => !rowDate(row) || inRange(rowDate(row))), [vouchers, inRange]); const filteredTransfers = useMemo(() => transfers.filter((row) => !rowDate(row) || inRange(rowDate(row))), [transfers, inRange]);

  const requestStats = useMemo(() => ({ total: filteredRequests.length, active: filteredRequests.filter(isActive).length, completed: filteredRequests.filter(isCompleted).length, rejected: filteredRequests.filter(isRejected).length, amount: filteredRequests.reduce((a, b) => a + n(b.amount), 0) }), [filteredRequests]);
  const financeStats = useMemo(() => { const active = subheads.filter((r) => r.is_active !== false); const allocation = active.reduce((a, r) => a + n(r.approved_allocation || r.allocation_amount), 0); const reserved = active.reduce((a, r) => a + n(r.reserved_amount), 0); const expenditure = active.reduce((a, r) => a + n(r.expenditure || r.spent_amount), 0); const balance = active.reduce((a, r) => a + n(r.balance || r.available_balance), 0); const movement = filteredTransactions.reduce((a, r) => a + Math.abs(n(r.amount)), 0); const accountBalance = accounts.reduce((a, r) => a + n(r.current_balance || r.balance || r.available_balance), 0); return { allocation, reserved, expenditure, balance, movement, accountBalance }; }, [subheads, filteredTransactions, accounts]);
  const voucherStats = useMemo(() => { const totalValue = filteredVouchers.reduce((a, r) => a + n(r.total_amount || r.amount || r.net_amount), 0); const count = (pattern: RegExp) => filteredVouchers.filter((r) => pattern.test(s(r.status).toLowerCase())).length; return { total: filteredVouchers.length, value: totalValue, draft: count(/draft/), pending: count(/pending|submitted|review|approval/), approved: count(/approved|paid|complete/), rejected: count(/reject|cancel|void/) }; }, [filteredVouchers]);
  const auditStats = useMemo(() => { const unlinked = subheads.filter((r) => !r.iet_account_id && !r.account_id).length; const negative = subheads.filter((r) => n(r.balance || r.available_balance) < 0).length; const overUtilised = subheads.filter((r) => { const alloc = n(r.approved_allocation || r.allocation_amount); return alloc > 0 && n(r.expenditure || r.spent_amount) > alloc; }).length; const unreconciled = bankLedger.filter((r) => r.is_reconciled === false || /unreconciled|pending/.test(s(r.reconciliation_status || r.status).toLowerCase())).length; const reversed = [...filteredTransactions, ...filteredVouchers].filter((r) => /reverse|void|cancel/.test(s(r.status || r.transaction_type).toLowerCase())).length; return { unlinked, negative, overUtilised, unreconciled, reversed, events: auditRows.length, exceptions: unlinked + negative + overUtilised + unreconciled + reversed }; }, [subheads, bankLedger, filteredTransactions, filteredVouchers, auditRows]);

  const departmentRows = useMemo(() => { const names = new Map(departments.map((d) => [d.id, d.name])); const map = new Map<string, AnyRow>(); departments.forEach((d) => map.set(d.id, { id: d.id, name: d.name, total: 0, completed: 0, amount: 0, allocation: 0, spent: 0 })); filteredRequests.forEach((r) => { const id = r.dept_id || "UNASSIGNED"; if (!map.has(id)) map.set(id, { id, name: names.get(id) || "Unassigned", total: 0, completed: 0, amount: 0, allocation: 0, spent: 0 }); const x = map.get(id)!; x.total = n(x.total) + 1; x.amount = n(x.amount) + n(r.amount); if (isCompleted(r)) x.completed = n(x.completed) + 1; }); subheads.forEach((r) => { const id = s(r.dept_id) || "UNASSIGNED"; if (!map.has(id)) map.set(id, { id, name: names.get(id) || "Unassigned", total: 0, completed: 0, amount: 0, allocation: 0, spent: 0 }); const x = map.get(id)!; x.allocation = n(x.allocation) + n(r.approved_allocation || r.allocation_amount); x.spent = n(x.spent) + n(r.expenditure || r.spent_amount); }); return [...map.values()].filter((r) => n(r.total) || n(r.allocation)).sort((a, b) => n(b.spent) - n(a.spent)); }, [departments, filteredRequests, subheads]);
  const stageRows = useMemo(() => { const map = new Map<string, number>(); filteredRequests.forEach((r) => map.set(r.current_stage || "Unassigned", (map.get(r.current_stage || "Unassigned") || 0) + 1)); return [...map].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value); }, [filteredRequests]);
  const monthRows = useMemo(() => { const rows: Array<{ key: string; label: string; requests: number; requestValue: number; finance: number; vouchers: number }> = []; const start = new Date(`${dateFrom}T00:00:00`); const end = new Date(`${dateTo}T23:59:59`); const cursor = new Date(start.getFullYear(), start.getMonth(), 1); while (cursor <= end && rows.length < 24) { rows.push({ key: `${cursor.getFullYear()}-${cursor.getMonth()}`, label: cursor.toLocaleDateString("en-NG", { month: "short", year: "2-digit" }), requests: 0, requestValue: 0, finance: 0, vouchers: 0 }); cursor.setMonth(cursor.getMonth() + 1); } const map = new Map(rows.map((r) => [r.key, r])); filteredRequests.forEach((r) => { const d = new Date(r.created_at); const x = map.get(`${d.getFullYear()}-${d.getMonth()}`); if (x) { x.requests++; x.requestValue += n(r.amount); } }); filteredTransactions.forEach((r) => { const d = new Date(rowDate(r)); const x = map.get(`${d.getFullYear()}-${d.getMonth()}`); if (x) x.finance += Math.abs(n(r.amount)); }); filteredVouchers.forEach((r) => { const d = new Date(rowDate(r)); const x = map.get(`${d.getFullYear()}-${d.getMonth()}`); if (x) x.vouchers += n(r.total_amount || r.amount || r.net_amount); }); return rows; }, [dateFrom, dateTo, filteredRequests, filteredTransactions, filteredVouchers]);
  const annualRows = useMemo(() => { const map = new Map<number, { year: number; requests: number; requested: number; finance: number; vouchers: number }>(); const ensure = (year: number) => { if (!map.has(year)) map.set(year, { year, requests: 0, requested: 0, finance: 0, vouchers: 0 }); return map.get(year)!; }; requests.forEach((r) => { const y = new Date(r.created_at).getFullYear(); const x = ensure(y); x.requests++; x.requested += n(r.amount); }); transactions.forEach((r) => { const y = new Date(rowDate(r)).getFullYear(); if (Number.isFinite(y)) ensure(y).finance += Math.abs(n(r.amount)); }); vouchers.forEach((r) => { const y = new Date(rowDate(r)).getFullYear(); if (Number.isFinite(y)) ensure(y).vouchers += n(r.total_amount || r.amount || r.net_amount); }); return [...map.values()].sort((a, b) => b.year - a.year).slice(0, 5); }, [requests, transactions, vouchers]);

  const utilisation = financeStats.allocation ? financeStats.expenditure / financeStats.allocation * 100 : 0; const completion = requestStats.total ? requestStats.completed / requestStats.total * 100 : 0; const maxMonth = Math.max(1, ...monthRows.flatMap((r) => [r.requestValue, r.finance, r.vouchers])); const maxDept = Math.max(1, ...departmentRows.map((r) => n(r.spent))); const maxStage = Math.max(1, ...stageRows.map((r) => r.value));
  const insights = useMemo(() => { const result: Array<{ tone: "emerald" | "amber" | "rose" | "blue"; title: string; text: string }> = []; if (utilisation >= 90) result.push({ tone: "rose", title: "Critical budget pressure", text: `Institutional budget utilisation is ${utilisation.toFixed(1)}%. Immediate expenditure control and reallocation review are recommended.` }); else if (utilisation >= 75) result.push({ tone: "amber", title: "Budget utilisation requires attention", text: `${utilisation.toFixed(1)}% of approved allocation has been consumed. Review fast-moving subheads before further commitments.` }); else result.push({ tone: "emerald", title: "Budget position is within control", text: `${utilisation.toFixed(1)}% of approved allocation is currently utilised, leaving ${money(financeStats.balance)} recorded balance.` }); const bottleneck = stageRows[0]; if (bottleneck) result.push({ tone: bottleneck.value > Math.max(5, requestStats.total * .35) ? "amber" : "blue", title: "Workflow concentration", text: `${bottleneck.value} request(s) are currently concentrated at “${bottleneck.label}”, the largest workflow queue in the selected period.` }); if (auditStats.exceptions) result.push({ tone: "rose", title: "Control exceptions detected", text: `${auditStats.exceptions} audit or reconciliation exception(s) require review, including unlinked subheads, negative balances, unreconciled ledger items or reversed records.` }); else result.push({ tone: "emerald", title: "No material reconciliation exception", text: "The automated control checks did not identify a major exception in the currently accessible records." }); return result; }, [utilisation, financeStats.balance, stageRows, requestStats.total, auditStats.exceptions]);

  const selectedPrintOption = PRINT_OPTIONS.find((option) => option.value === printSection) ?? PRINT_OPTIONS[0];
  function clearPrintWorkspace() {
    document.body.classList.remove("report-print-active");
    const root = document.getElementById("reqgen-print-root");
    if (root) root.innerHTML = "";
  }

  function printSelected() {
    const root = document.getElementById("reqgen-print-root");
    if (!root) return;

    root.innerHTML = "";
    const scopes: PrintSection[] = printSection === "ALL"
      ? PRINT_OPTIONS.filter((option) => option.value !== "ALL").map((option) => option.value)
      : [printSection];

    for (const scope of scopes) {
      const source = document.querySelector<HTMLElement>(`[data-report-section="${scope}"]`);
      if (!source) continue;

      const option = PRINT_OPTIONS.find((item) => item.value === scope) ?? selectedPrintOption;
      const sheet = document.createElement("article");
      sheet.className = "reqgen-a4-sheet";

      const header = document.createElement("header");
      header.className = "reqgen-a4-header";
      header.innerHTML = `
        <div class="reqgen-a4-brand">
          <div class="reqgen-a4-mark">RG</div>
          <div>
            <div class="reqgen-a4-org">Islamic Education Trust (IET)</div>
            <div class="reqgen-a4-system">ReqGen Central Reports & Decision Intelligence</div>
          </div>
        </div>
        <div class="reqgen-a4-meta">
          <div><span>Report:</span> ${option.label}</div>
          <div><span>Period:</span> ${dateFrom} to ${dateTo}</div>
          <div><span>Generated:</span> ${new Date().toLocaleString("en-NG")}</div>
        </div>`;

      const content = document.createElement("div");
      content.className = "reqgen-a4-content";
      const clone = source.cloneNode(true) as HTMLElement;
      clone.removeAttribute("id");
      clone.removeAttribute("data-report-section");
      clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
      content.appendChild(clone);

      const footer = document.createElement("footer");
      footer.className = "reqgen-a4-footer";
      footer.innerHTML = `<span>Official management report • Generated from ReqGen 1.1.0</span><span>Confidential</span>`;

      sheet.append(header, content, footer);
      root.appendChild(sheet);
    }

    if (!root.children.length) {
      alert("The selected report section could not be prepared. Please refresh the page and try again.");
      return;
    }

    document.body.classList.add("report-print-active");
    const cleanup = () => {
      clearPrintWorkspace();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.setTimeout(() => window.print(), 250);
  }
  function exportReport() { const dept = new Map(departments.map((d) => [d.id, d.name])); downloadCsv(`reqgen-central-report-${dateFrom}-to-${dateTo}.csv`, [["Request No", "Title", "Department", "Type", "Status", "Stage", "Amount", "Created"], ...filteredRequests.map((r) => [r.request_no || "", r.title || "", dept.get(r.dept_id || "") || "Unassigned", r.request_type || "", r.status || "", r.current_stage || "", n(r.amount), new Date(r.created_at).toLocaleString("en-NG")])]); }
  if (loading) return <><ReportsPageStyles/><ReportsSkeleton/></>;

  return <div className="min-h-screen bg-slate-100 p-4 sm:p-7"><ReportsPageStyles/><style jsx global>{`
    #reqgen-print-root { display: none; }
    [data-report-section] { display: block; }
    @media print {
      @page { size: A4 portrait; margin: 0; }
      html, body { background: #fff !important; }
      body.report-print-active * { visibility: hidden !important; }
      body.report-print-active #reqgen-print-root,
      body.report-print-active #reqgen-print-root * { visibility: visible !important; }
      body.report-print-active #reqgen-print-root {
        display: block !important;
        position: absolute;
        inset: 0;
        width: 100%;
        background: #fff;
      }
      .reqgen-a4-sheet {
        box-sizing: border-box;
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: 13mm 13mm 12mm;
        background: #fff;
        color: #0f172a;
        page-break-after: always;
        position: relative;
      }
      .reqgen-a4-sheet:last-child { page-break-after: auto; }
      .reqgen-a4-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10mm;
        border-bottom: 2px solid #0f172a;
        padding-bottom: 4mm;
        margin-bottom: 5mm;
      }
      .reqgen-a4-brand { display: flex; align-items: center; gap: 3mm; }
      .reqgen-a4-mark {
        display: grid;
        place-items: center;
        width: 12mm;
        height: 12mm;
        border-radius: 3mm;
        background: #0f172a;
        color: #fff;
        font-size: 12pt;
        font-weight: 900;
      }
      .reqgen-a4-org { font-size: 12pt; font-weight: 900; }
      .reqgen-a4-system { margin-top: 1mm; font-size: 8.5pt; font-weight: 700; color: #475569; }
      .reqgen-a4-meta { min-width: 62mm; font-size: 8pt; line-height: 1.55; color: #334155; text-align: right; }
      .reqgen-a4-meta span { font-weight: 900; color: #0f172a; }
      .reqgen-a4-content { font-size: 9pt; }
      .reqgen-a4-content [data-report-section] { display: block !important; }
      .reqgen-a4-content .rounded-3xl,
      .reqgen-a4-content .rounded-2xl { border-radius: 3mm !important; }
      .reqgen-a4-content article,
      .reqgen-a4-content section,
      .reqgen-a4-content table,
      .reqgen-a4-content .report-print-card { break-inside: avoid; }
      .reqgen-a4-content .shadow-sm,
      .reqgen-a4-content .shadow-lg,
      .reqgen-a4-content .shadow-xl { box-shadow: none !important; }
      .reqgen-a4-content .overflow-x-auto { overflow: visible !important; }
      .reqgen-a4-content table { min-width: 0 !important; width: 100% !important; font-size: 7.4pt !important; }
      .reqgen-a4-content th,
      .reqgen-a4-content td { padding: 1.8mm 1.4mm !important; }
      .reqgen-a4-footer {
        display: flex;
        justify-content: space-between;
        gap: 6mm;
        border-top: 1px solid #cbd5e1;
        margin-top: 6mm;
        padding-top: 3mm;
        font-size: 7.5pt;
        font-weight: 700;
        color: #64748b;
      }
    }
  `}</style><main className="report-print-shell mx-auto max-w-[1500px] space-y-6">
    <div className="report-no-print"><ReportsHero actions={<><ReportButton icon="refresh" variant="cyan" onClick={() => load(true)} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh"}</ReportButton><ReportButton icon="download" variant="violet" onClick={exportReport}>Export CSV</ReportButton></>}/></div>

    <section className="report-no-print sticky top-3 z-30 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-xl shadow-slate-900/10 backdrop-blur-xl sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white"><ReportIcon name="print"/></div><div><h2 className="text-lg font-black text-slate-950">Report Print Centre</h2><p className="text-sm text-slate-500">Choose one exact report section or print every section in a standardized A4 management template.</p></div></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(280px,430px)_auto] sm:items-end">
          <label className="block text-xs font-black uppercase tracking-[0.14em] text-slate-500">Print scope
            <div className="relative mt-2"><ReportIcon name="report" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-700"/><select aria-label="Select report section to print" value={printSection} onChange={(e) => setPrintSection(e.target.value as PrintSection)} className="h-13 w-full appearance-none rounded-2xl border border-slate-300 bg-slate-50 py-3.5 pl-12 pr-12 text-sm font-black text-slate-950 outline-none transition hover:border-blue-400 hover:bg-white focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100">{PRINT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select><ReportIcon name="chevron" className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500"/></div>
          </label>
          <button type="button" onClick={printSelected} className="inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 text-sm font-black text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-200"><ReportIcon name="print" className="h-5 w-5"/>{printSection === "ALL" ? "Print All Sections" : "Print Selected Section"}</button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">{PRINT_OPTIONS.filter((option) => option.value !== "ALL").map((option) => <button key={option.value} type="button" onClick={() => { setPrintSection(option.value); document.querySelector(`[data-report-section="${option.value}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className={`rounded-full border px-3 py-1.5 text-xs font-extrabold transition ${printSection === option.value ? "border-blue-700 bg-blue-700 text-white" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"}`}>{option.label.replace(" only", "")}</button>)}</div>
    </section>
    {fatalError && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 font-semibold text-rose-800">{fatalError}</div>}{issues.length > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-center gap-2 font-black text-amber-900"><ReportIcon name="warning"/>Partial-data notice</div>{issues.map((i) => <p key={i.source} className="mt-1 text-sm text-amber-800"><b>{i.source}:</b> {i.message}</p>)}</div>}

    <section className="report-no-print rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white"><ReportIcon name="filter"/></div><div><h2 className="font-black text-slate-950">Institutional report controls</h2><p className="text-sm text-slate-500">One reporting scope for requests, finance, vouchers, audit and departmental intelligence.</p></div></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"><label className="text-sm font-bold text-slate-700">From<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"/></label><label className="text-sm font-bold text-slate-700">To<input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"/></label><label className="text-sm font-bold text-slate-700">Department<select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"><option value="ALL">All departments</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label className="text-sm font-bold text-slate-700">Status<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="COMPLETED">Completed</option><option value="REJECTED">Rejected / cancelled</option></select></label><label className="text-sm font-bold text-slate-700">Request type<select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"><option value="ALL">All types</option><option value="OFFICIAL">Official</option><option value="PERSONAL">Personal</option></select></label></div></section>

    <div data-report-section="OVERVIEW" id="executive-overview" className="scroll-mt-24 space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><ReportStat label="Total requests" value={requestStats.total.toLocaleString()} note={`${completion.toFixed(1)}% completion rate`} icon="request" tone="blue"/><ReportStat label="Requested value" value={money(requestStats.amount)} note="Filtered institutional demand" icon="money" tone="violet"/><ReportStat label="Approved allocation" value={money(financeStats.allocation)} note={`${utilisation.toFixed(1)}% utilised`} icon="building" tone="cyan" progress={utilisation}/><ReportStat label="Available balance" value={money(financeStats.balance)} note={`Reserved: ${money(financeStats.reserved)}`} icon="money" tone="emerald"/><ReportStat label="Payment vouchers" value={voucherStats.total.toLocaleString()} note={`Value: ${money(voucherStats.value)}`} icon="request" tone="amber"/><ReportStat label="Finance movement" value={money(financeStats.movement)} note="Absolute movement in period" icon="chart" tone="blue"/><ReportStat label="Audit exceptions" value={auditStats.exceptions.toLocaleString()} note={`${auditStats.events} audit event(s) loaded`} icon="warning" tone={auditStats.exceptions ? "rose" : "emerald"}/><ReportStat label="Account transfers" value={filteredTransfers.length.toLocaleString()} note="Transfers recorded in period" icon="clock" tone="violet"/></div><ReportSection title="Management decision insights" description="Automated interpretation of the most decision-relevant indicators." icon="chart"><div className="grid gap-4 lg:grid-cols-3">{insights.map((x) => <Insight key={x.title} {...x}/>)}</div></ReportSection></div>

    <div data-report-section="REQUESTS" id="request-intelligence" className="scroll-mt-24 grid gap-6 xl:grid-cols-3"><ReportSection title="Request status distribution" description="Completion, active workflow and rejected records." icon="request"><Donut center={requestStats.total.toLocaleString()} note="requests" segments={[{ label: "Active", value: requestStats.active, color: "#f59e0b" }, { label: "Completed", value: requestStats.completed, color: "#10b981" }, { label: "Rejected", value: requestStats.rejected, color: "#f43f5e" }]}/></ReportSection><ReportSection title="Workflow bottlenecks" description="Largest current queues by approval stage." icon="clock"><div className="space-y-4">{stageRows.slice(0, 10).map((r, i) => <DataBar key={r.label} label={r.label} value={r.value} max={maxStage} tone={i === 0 ? "rose" : i < 3 ? "amber" : "violet"}/>)}</div></ReportSection><ReportSection title="Request control indicators" description="Core operational ratios for management review." icon="chart"><div className="space-y-4"><Insight tone={completion >= 70 ? "emerald" : "amber"} title={`${completion.toFixed(1)}% completion`} text={`${requestStats.completed} of ${requestStats.total} request(s) are completed in the reporting scope.`}/><Insight tone={requestStats.rejected ? "rose" : "blue"} title={`${requestStats.rejected} rejected / cancelled`} text="Review recurring rejection reasons to improve request quality and reduce rework."/><Insight tone="blue" title={compactMoney(requestStats.amount)} text="Total requested monetary value across all filtered records."/></div></ReportSection></div>

    <div data-report-section="FINANCE" id="finance-and-workflow" className="scroll-mt-24 space-y-6"><div className="grid gap-6 xl:grid-cols-3"><ReportSection title="Monthly financial movement" description="Requested value, finance movement and payment vouchers by month." icon="chart" className="xl:col-span-2"><div className="overflow-x-auto"><div className="min-w-[760px]"><div className="grid h-72 grid-cols-12 items-end gap-3 rounded-2xl bg-slate-50 p-5">{monthRows.map((r) => <div key={r.key} className="flex h-full flex-col justify-end"><div className="flex h-[220px] items-end justify-center gap-1"><div className="w-2 rounded-t bg-blue-600" style={{ height: `${Math.max(r.requestValue ? 4 : 0, r.requestValue / maxMonth * 210)}px` }} title={`Requested: ${money(r.requestValue)}`}/><div className="w-2 rounded-t bg-emerald-500" style={{ height: `${Math.max(r.finance ? 4 : 0, r.finance / maxMonth * 210)}px` }} title={`Finance movement: ${money(r.finance)}`}/><div className="w-2 rounded-t bg-violet-500" style={{ height: `${Math.max(r.vouchers ? 4 : 0, r.vouchers / maxMonth * 210)}px` }} title={`Vouchers: ${money(r.vouchers)}`}/></div><div className="mt-2 text-center text-[10px] font-black text-slate-600">{r.label}</div></div>)}</div><div className="mt-3 flex flex-wrap gap-4 text-xs font-bold text-slate-600"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded bg-blue-600"/>Requested</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded bg-emerald-500"/>Finance movement</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded bg-violet-500"/>Vouchers</span></div></div></div></ReportSection><ReportSection title="Budget position" description="Allocation, commitments, expenditure and available balance." icon="money"><div className="space-y-4"><DataBar label="Expenditure utilisation" value={Math.round(utilisation)} max={100} suffix="%" tone={utilisation > 90 ? "rose" : utilisation > 75 ? "amber" : "emerald"}/><div className="grid grid-cols-2 gap-3">{[["Allocation", financeStats.allocation], ["Reserved", financeStats.reserved], ["Expenditure", financeStats.expenditure], ["Balance", financeStats.balance]].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-slate-50 p-3"><div className="text-xs font-bold text-slate-500">{label}</div><div className="mt-1 text-base font-black text-slate-950">{compactMoney(value)}</div></div>)}</div></div></ReportSection></div><ReportSection title="Annual institutional comparison" description="Five-year view of request demand, finance movement and voucher value." icon="building"><div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Year</th><th className="px-3 py-3 text-right">Requests</th><th className="px-3 py-3 text-right">Requested value</th><th className="px-3 py-3 text-right">Finance movement</th><th className="px-3 py-3 text-right">Voucher value</th></tr></thead><tbody>{annualRows.map((r) => <tr key={r.year} className="border-b border-slate-100"><td className="px-3 py-3 font-black">{r.year}</td><td className="px-3 py-3 text-right font-bold">{r.requests}</td><td className="px-3 py-3 text-right">{money(r.requested)}</td><td className="px-3 py-3 text-right">{money(r.finance)}</td><td className="px-3 py-3 text-right">{money(r.vouchers)}</td></tr>)}</tbody></table></div></ReportSection></div>

    <div data-report-section="VOUCHERS" id="payment-voucher-intelligence" className="scroll-mt-24 grid gap-6 xl:grid-cols-3"><ReportSection title="Payment voucher status" description="Voucher processing position and value." icon="request"><Donut center={voucherStats.total.toLocaleString()} note="vouchers" segments={[{ label: "Draft", value: voucherStats.draft, color: "#64748b" }, { label: "Pending", value: voucherStats.pending, color: "#f59e0b" }, { label: "Approved / paid", value: voucherStats.approved, color: "#10b981" }, { label: "Rejected / void", value: voucherStats.rejected, color: "#f43f5e" }]}/></ReportSection><ReportSection title="Voucher financial exposure" description="Monetary and processing indicators." icon="money"><div className="space-y-4"><Insight tone="blue" title={money(voucherStats.value)} text="Gross value represented by vouchers in the reporting period."/><Insight tone={voucherStats.pending ? "amber" : "emerald"} title={`${voucherStats.pending} pending`} text="Vouchers awaiting review, approval, counter-signature or payment completion."/><Insight tone={voucherStats.rejected ? "rose" : "blue"} title={`${voucherStats.rejected} rejected / void`} text="Records requiring root-cause review or corrective documentation."/></div></ReportSection><ReportSection title="Recent voucher register" description="Latest accessible payment voucher records." icon="clock"><div className="space-y-3">{filteredVouchers.slice(0, 8).map((r, i) => <div key={s(r.id) || i} className="rounded-2xl border border-slate-100 p-3"><div className="flex justify-between gap-3"><div className="min-w-0"><div className="truncate font-black text-slate-900">{s(r.voucher_no || r.voucher_number || r.reference_no) || `Voucher ${i + 1}`}</div><div className="mt-1 text-xs font-bold text-slate-500">{s(r.status) || "Unclassified"}</div></div><div className="shrink-0 font-black text-violet-700">{money(r.total_amount || r.amount || r.net_amount)}</div></div></div>)}</div></ReportSection></div>

    <div data-report-section="AUDIT" id="audit-reconciliation" className="scroll-mt-24 space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><ReportStat label="Audit events" value={auditStats.events.toLocaleString()} note="Loaded governance records" icon="clock" tone="blue"/><ReportStat label="Unlinked subheads" value={auditStats.unlinked.toLocaleString()} note="Missing bank-account relationship" icon="warning" tone={auditStats.unlinked ? "amber" : "emerald"}/><ReportStat label="Unreconciled ledger" value={auditStats.unreconciled.toLocaleString()} note="Pending reconciliation indicators" icon="warning" tone={auditStats.unreconciled ? "rose" : "emerald"}/><ReportStat label="Over-utilised subheads" value={auditStats.overUtilised.toLocaleString()} note="Expenditure above allocation" icon="chart" tone={auditStats.overUtilised ? "rose" : "emerald"}/><ReportStat label="Reversed / void records" value={auditStats.reversed.toLocaleString()} note="Transactions and vouchers" icon="request" tone={auditStats.reversed ? "amber" : "emerald"}/></div><div className="grid gap-6 xl:grid-cols-2"><ReportSection title="Automated reconciliation checks" description="Control checks derived from accessible finance, ledger, subhead and voucher records." icon="warning"><div className="space-y-4"><DataBar label="Unlinked subheads" value={auditStats.unlinked} max={Math.max(1, auditStats.exceptions)} tone="amber"/><DataBar label="Negative balances" value={auditStats.negative} max={Math.max(1, auditStats.exceptions)} tone="rose"/><DataBar label="Over-utilised subheads" value={auditStats.overUtilised} max={Math.max(1, auditStats.exceptions)} tone="rose"/><DataBar label="Unreconciled bank ledger" value={auditStats.unreconciled} max={Math.max(1, auditStats.exceptions)} tone="violet"/><DataBar label="Reversed / void records" value={auditStats.reversed} max={Math.max(1, auditStats.exceptions)} tone="amber"/></div></ReportSection><ReportSection title="Recent audit evidence" description="Most recent available audit, activity and manual-voucher control records." icon="clock"><div className="space-y-3">{auditRows.slice(0, 10).map((r, i) => <div key={s(r.id) || i} className="rounded-2xl border border-slate-100 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-black text-slate-900">{s(r.action || r.event_type || r.activity || r.module) || "Audit activity"}</div><div className="mt-1 text-xs font-semibold text-slate-500">{s(r.actor_name || r.actor_email || r.user_email) || "System user"}</div></div><div className="text-xs font-bold text-slate-500">{rowDate(r) ? new Date(rowDate(r)).toLocaleString("en-NG") : "—"}</div></div></div>)}{!auditRows.length && <p className="text-sm text-slate-500">No compatible audit records were returned. Automated reconciliation checks above remain active.</p>}</div></ReportSection></div></div>

    <div data-report-section="DEPARTMENTS" id="department-performance" className="scroll-mt-24 grid gap-6 xl:grid-cols-3"><ReportSection title="Department expenditure ranking" description="Departments ranked by recorded expenditure." icon="building"><div className="space-y-4">{departmentRows.slice(0, 10).map((r, i) => <DataBar key={s(r.id)} label={s(r.name)} value={Math.round(n(r.spent))} max={maxDept} tone={i < 2 ? "rose" : i < 5 ? "amber" : "blue"}/>)}</div></ReportSection><ReportSection title="Department completion performance" description="Request completion rate by department." icon="check"><div className="space-y-4">{departmentRows.slice(0, 10).map((r) => { const rate = n(r.total) ? n(r.completed) / n(r.total) * 100 : 0; return <DataBar key={s(r.id)} label={s(r.name)} value={Math.round(rate)} max={100} suffix="%" tone={rate >= 75 ? "emerald" : rate >= 50 ? "amber" : "rose"}/>; })}</div></ReportSection><ReportSection title="Department decision flags" description="Highest utilisation and outstanding demand." icon="warning"><div className="space-y-3">{departmentRows.slice(0, 6).map((r) => { const util = n(r.allocation) ? n(r.spent) / n(r.allocation) * 100 : 0; return <div key={s(r.id)} className="rounded-2xl border border-slate-100 p-3"><div className="flex justify-between gap-3"><span className="font-black text-slate-900">{s(r.name)}</span><span className={`font-black ${util > 90 ? "text-rose-700" : util > 75 ? "text-amber-700" : "text-emerald-700"}`}>{util.toFixed(1)}%</span></div><div className="mt-1 text-xs font-semibold text-slate-500">{n(r.total)} requests • {money(r.spent)} spent</div></div>; })}</div></ReportSection></div>

    <div data-report-section="REGISTERS" id="detailed-registers" className="scroll-mt-24 space-y-6"><ReportSection title="Department financial and request register" description="Detailed institutional comparison for management, audit and reconciliation." icon="building"><div className="overflow-x-auto"><table className="min-w-[1050px] w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Department</th><th className="px-3 py-3 text-right">Requests</th><th className="px-3 py-3 text-right">Completed</th><th className="px-3 py-3 text-right">Requested</th><th className="px-3 py-3 text-right">Allocation</th><th className="px-3 py-3 text-right">Spent</th><th className="px-3 py-3 text-right">Balance</th><th className="px-3 py-3 text-right">Utilisation</th></tr></thead><tbody>{departmentRows.map((r) => { const balance = n(r.allocation) - n(r.spent); const util = n(r.allocation) ? n(r.spent) / n(r.allocation) * 100 : 0; return <tr key={s(r.id)} className="border-b border-slate-100"><td className="px-3 py-3 font-black">{s(r.name)}</td><td className="px-3 py-3 text-right">{n(r.total)}</td><td className="px-3 py-3 text-right">{n(r.completed)}</td><td className="px-3 py-3 text-right">{money(r.amount)}</td><td className="px-3 py-3 text-right">{money(r.allocation)}</td><td className="px-3 py-3 text-right">{money(r.spent)}</td><td className="px-3 py-3 text-right">{money(balance)}</td><td className="px-3 py-3 text-right font-black">{util.toFixed(1)}%</td></tr>; })}</tbody></table></div></ReportSection><ReportSection title="Recent request records" description="Latest requests matching the current report controls." icon="request"><div className="overflow-x-auto"><table className="min-w-[980px] w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Request</th><th className="px-3 py-3">Title</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Stage</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3">Date</th></tr></thead><tbody>{filteredRequests.slice(0, 100).map((r) => <tr key={r.id} className="border-b border-slate-100"><td className="px-3 py-3 font-black text-blue-700">{r.request_no || "—"}</td><td className="max-w-[280px] truncate px-3 py-3 font-semibold">{r.title || "Untitled request"}</td><td className="px-3 py-3">{r.request_type || "—"}</td><td className="px-3 py-3">{r.status || "—"}</td><td className="px-3 py-3">{r.current_stage || "—"}</td><td className="px-3 py-3 text-right font-bold">{money(r.amount)}</td><td className="px-3 py-3 text-slate-500">{new Date(r.created_at).toLocaleDateString("en-NG")}</td></tr>)}</tbody></table></div></ReportSection></div>
    <footer className="report-print-footer pb-4 text-center text-xs font-semibold text-slate-500">ReqGen 1.1.0 • Central Reports & Decision Intelligence • Generated {new Date().toLocaleString("en-NG")}</footer>
  </main><div id="reqgen-print-root" aria-hidden="true"/></div>;
}
