"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CreditCard, Download, FileText, Landmark, Printer, RefreshCw, ShieldCheck, Archive } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentAuthContext } from "@/lib/auth";
import { hasAnyRole, REPORT_ACCESS_ROLES } from "@/lib/roles";
import { AnyRow, Department, dateLabel, downloadCsv, isRequestCompleted, isRequestRejected, isVoucherPaid, money, numberValue, rowDate, text } from "@/app/components/reports/section7Data";
import styles from "./reports.module.css";

type Tab = "overview" | "requests" | "approvals" | "finance" | "vouchers" | "registry" | "departments";

type Dataset = {
  requests: AnyRow[];
  departments: Department[];
  subheads: AnyRow[];
  transactions: AnyRow[];
  vouchers: AnyRow[];
  registry: AnyRow[];
  history: AnyRow[];
};

const EMPTY: Dataset = { requests: [], departments: [], subheads: [], transactions: [], vouchers: [], registry: [], history: [] };
const tabs: Array<{ key: Tab; label: string }> = [
  { key: "overview", label: "Overview" }, { key: "requests", label: "Requests" }, { key: "approvals", label: "Approvals" },
  { key: "finance", label: "Finance" }, { key: "vouchers", label: "Payment Vouchers" }, { key: "registry", label: "Registry" }, { key: "departments", label: "Departments" },
];

function inRange(row: AnyRow, from: string, to: string) {
  const date = rowDate(row); if (!date) return true;
  if (from && date < new Date(`${from}T00:00:00`)) return false;
  if (to && date > new Date(`${to}T23:59:59`)) return false;
  return true;
}
function Kpi({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return <article className={styles.kpi}><div className={styles.kpiIcon}>{icon}</div><div><div className={styles.kpiLabel}>{label}</div><div className={styles.kpiValue}>{value}</div><div className={styles.kpiNote}>{note}</div></div></article>;
}

export default function ReportsCentrePage() {
  const router = useRouter();
  const now = new Date(); const yearStart = `${now.getFullYear()}-01-01`; const today = now.toISOString().slice(0, 10);
  const [data, setData] = useState<Dataset>(EMPTY); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [issue, setIssue] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview"); const [dateFrom, setDateFrom] = useState(yearStart); const [dateTo, setDateTo] = useState(today); const [department, setDepartment] = useState("all"); const [status, setStatus] = useState("all");

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true); setIssue(null);
    try {
      const auth = await getCurrentAuthContext();
      if (!auth) { router.replace("/login?next=%2Freports"); return; }
      if (!hasAnyRole(auth.roleSet, [...REPORT_ACCESS_ROLES])) { router.replace("/unauthorized?from=%2Freports"); return; }
      const [rq, dp, sh, tx, pv, rg, rh] = await Promise.all([
        supabase.from("requests").select("*").order("created_at", { ascending: false }).limit(5000),
        supabase.from("departments").select("id,name").order("name").limit(1000),
        supabase.from("subheads").select("*").order("code").limit(5000),
        supabase.from("finance_transactions").select("*").order("transaction_date", { ascending: false }).limit(5000),
        supabase.from("payment_vouchers").select("*").order("created_at", { ascending: false }).limit(5000),
        supabase.from("registry_correspondence").select("*").order("created_at", { ascending: false }).limit(5000),
        supabase.from("request_history").select("*").order("created_at", { ascending: false }).limit(5000),
      ]);
      const errors = [rq.error, dp.error, sh.error, tx.error, pv.error, rg.error, rh.error].filter(Boolean).map(e => e?.message).filter(Boolean);
      setData({ requests: (rq.data || []) as AnyRow[], departments: (dp.data || []) as Department[], subheads: (sh.data || []) as AnyRow[], transactions: (tx.data || []) as AnyRow[], vouchers: (pv.data || []) as AnyRow[], registry: (rg.data || []) as AnyRow[], history: (rh.data || []) as AnyRow[] });
      if (errors.length) setIssue(`Some authorised report sources could not be loaded: ${errors.join(" | ")}`);
    } finally { setLoading(false); setRefreshing(false); }
  }, [router]);
  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  const deptName = useMemo(() => new Map(data.departments.map(d => [d.id, d.name])), [data.departments]);
  const filteredRequests = useMemo(() => data.requests.filter(r => inRange(r, dateFrom, dateTo) && (department === "all" || text(r.dept_id) === department) && (status === "all" || text(r.status).toLowerCase().includes(status))), [data.requests, dateFrom, dateTo, department, status]);
  const filteredVouchers = useMemo(() => data.vouchers.filter(r => inRange(r, dateFrom, dateTo) && (department === "all" || text(r.department_id ?? r.dept_id) === department) && (status === "all" || text(r.status).toLowerCase().includes(status))), [data.vouchers, dateFrom, dateTo, department, status]);
  const filteredRegistry = useMemo(() => data.registry.filter(r => inRange(r, dateFrom, dateTo) && (department === "all" || text(r.department_id ?? r.dept_id) === department) && (status === "all" || text(r.status).toLowerCase().includes(status))), [data.registry, dateFrom, dateTo, department, status]);
  const filteredSubheads = useMemo(() => data.subheads.filter(r => department === "all" || text(r.dept_id) === department), [data.subheads, department]);
  const filteredTx = useMemo(() => data.transactions.filter(r => inRange(r, dateFrom, dateTo)), [data.transactions, dateFrom, dateTo]);

  const totalExpenditure = filteredSubheads.reduce((sum, r) => sum + numberValue(r.expenditure), 0);
  const paidPv = filteredVouchers.filter(isVoucherPaid); const paidPvValue = paidPv.reduce((sum, r) => sum + numberValue(r.total_amount ?? r.amount ?? r.net_amount), 0);
  const approvedRequests = filteredRequests.filter(r => isRequestCompleted(r) && !isRequestRejected(r));
  const requestById = useMemo(() => new Map(data.requests.map(r => [text(r.id), r])), [data.requests]);
  const approvalHistory = useMemo(() => data.history.filter(h => /approve|reject/i.test(text(h.action_type)) && inRange(h, dateFrom, dateTo)), [data.history, dateFrom, dateTo]);
  const statusOptions = useMemo(() => Array.from(new Set([...data.requests, ...data.vouchers, ...data.registry].map(r => text(r.status).toLowerCase()).filter(Boolean))).sort(), [data]);
  const summary = [
    { label: "Requests", value: filteredRequests.length, color: "#1269f3" }, { label: "Approvals", value: approvedRequests.length, color: "#18a56d" },
    { label: "Finance", value: filteredTx.length, color: "#f1a21a" }, { label: "Payment Vouchers", value: filteredVouchers.length, color: "#7e56d8" }, { label: "Registry", value: filteredRegistry.length, color: "#e95663" },
  ];
  const donutTotal = Math.max(1, summary.reduce((a, b) => a + b.value, 0)); let cursor = 0; const gradient = summary.map(item => { const start = cursor; cursor += item.value / donutTotal * 100; return `${item.color} ${start}% ${cursor}%`; }).join(",");

  const tableRows = useMemo(() => {
    if (tab === "requests") return filteredRequests.map(r => ({ id: text(r.id), ref: text(r.request_no) || "—", title: text(r.title) || "Untitled request", module: "Requests", type: text(r.request_type) || "Request", date: dateLabel(r.created_at), status: text(r.status) || text(r.current_stage) || "—", department: deptName.get(text(r.dept_id)) || "—" }));
    if (tab === "approvals") return approvalHistory.map(h => { const req = requestById.get(text(h.request_id)); return { id: text(h.id), ref: text(req?.request_no) || text(h.request_id) || "—", title: text(req?.title) || text(h.comment) || "Approval action", module: "Approvals", type: text(h.actor_role_name ?? h.actor_role_key) || "Approver", date: dateLabel(h.created_at), status: text(h.action_type) || "Decision", department: req ? (deptName.get(text(req.dept_id)) || "—") : "—" }; });
    if (tab === "finance") return filteredTx.map(r => ({ id: text(r.id), ref: text(r.transaction_no) || "—", title: text(r.narration) || "Finance transaction", module: "Finance", type: text(r.transaction_type) || "Transaction", date: dateLabel(r.transaction_date ?? r.created_at), status: text(r.is_reversed) === "true" ? "Reversed" : "Posted", department: "—" }));
    if (tab === "vouchers") return filteredVouchers.map(r => ({ id: text(r.id), ref: text(r.voucher_no) || "—", title: text(r.payee_name ?? r.beneficiary ?? r.description) || "Payment Voucher", module: "Payment Vouchers", type: text(r.payment_mode ?? r.category) || "Voucher", date: dateLabel(r.created_at), status: text(r.status) || "—", department: deptName.get(text(r.department_id ?? r.dept_id)) || "—" }));
    if (tab === "registry") return filteredRegistry.map(r => ({ id: text(r.id), ref: text(r.reference_no ?? r.ref_no) || "—", title: text(r.subject) || "Correspondence", module: "Registry", type: text(r.direction) || "Correspondence", date: dateLabel(r.created_at), status: text(r.status) || "—", department: deptName.get(text(r.department_id ?? r.dept_id)) || "—" }));
    if (tab === "departments") return data.departments.map(r => ({ id: r.id, ref: r.id, title: r.name, module: "Departments", type: "Department", date: "—", status: "Active", department: r.name }));
    return [];
  }, [tab, filteredRequests, filteredTx, filteredVouchers, filteredRegistry, data.departments, deptName, approvalHistory, requestById]);

  function exportCurrent() {
    const rows = tableRows.length ? tableRows : [
      { ref: "Requests", title: String(filteredRequests.length), module: "Summary", type: "Count", date: dateFrom + " to " + dateTo, status: "", department: "" },
      { ref: "Approved", title: String(approvedRequests.length), module: "Summary", type: "Count", date: "", status: "", department: "" },
      { ref: "Expenditure", title: String(totalExpenditure), module: "Finance", type: "NGN", date: "", status: "", department: "" },
      { ref: "Paid PV", title: String(paidPvValue), module: "Payment Vouchers", type: "NGN", date: "", status: "", department: "" },
    ];
    downloadCsv(`reqgen-reports-${tab}-${today}.csv`, [["Reference", "Title/Value", "Module", "Type", "Date", "Status", "Department"], ...rows.map(r => [r.ref, r.title, r.module, r.type, r.date, r.status, r.department])]);
  }

  if (loading) return <div className={styles.page}><div className={styles.loading}>Loading authorised live report sources…</div></div>;
  return <main className={styles.page}>
    <header className={styles.head}><div><div className={styles.eyebrow}>Reports</div><h1 className={styles.title}>Reports Centre</h1><p className={styles.subtitle}>Generate, review and export operational reports across authorised ReqGen modules.</p></div><div className={styles.actions}><button className={styles.button} onClick={() => window.print()}><Printer size={15}/> Print / PDF</button><button className={styles.primary} onClick={exportCurrent}><Download size={15}/> Export</button></div></header>
    {issue ? <div className={`${styles.notice} ${styles.error}`}>{issue}</div> : null}
    <nav className={styles.tabs}>{tabs.map(t => <button key={t.key} className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`} onClick={() => setTab(t.key)}>{t.label}</button>)}</nav>
    <section className={styles.kpis}>
      <Kpi icon={<FileText size={18}/>} label="Total Requests" value={filteredRequests.length.toLocaleString()} note="Selected period"/>
      <Kpi icon={<ShieldCheck size={18}/>} label="Total Approved" value={approvedRequests.length.toLocaleString()} note={`${filteredRequests.length ? (approvedRequests.length/filteredRequests.length*100).toFixed(1) : "0.0"}% of requests`}/>
      <Kpi icon={<Landmark size={18}/>} label="Total Expenditure" value={money(totalExpenditure)} note="Live subhead expenditure"/>
      <Kpi icon={<CreditCard size={18}/>} label="Paid PV" value={money(paidPvValue)} note={`${paidPv.length} paid vouchers`}/>
      <Kpi icon={<Building2 size={18}/>} label="Departments" value={data.departments.length.toLocaleString()} note="Live department register"/>
      <Kpi icon={<Archive size={18}/>} label="Registry Items" value={filteredRegistry.length.toLocaleString()} note="Selected period"/>
    </section>
    <section className={styles.filters}>
      <div className={styles.field}><label>Date From</label><input className={styles.input} type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}/></div>
      <div className={styles.field}><label>Date To</label><input className={styles.input} type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}/></div>
      <div className={styles.field}><label>Department</label><select className={styles.select} value={department} onChange={e => setDepartment(e.target.value)}><option value="all">All Departments</option>{data.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
      <div className={styles.field}><label>Report Type</label><select className={styles.select} value={tab} onChange={e => setTab(e.target.value as Tab)}>{tabs.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select></div>
      <div className={styles.field}><label>Status</label><select className={styles.select} value={status} onChange={e => setStatus(e.target.value)}><option value="all">All Statuses</option>{statusOptions.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
      <button className={styles.primary} onClick={() => void load(true)}><RefreshCw size={14}/>{refreshing ? "Refreshing…" : "Refresh"}</button>
      <button className={styles.button} onClick={() => { setDateFrom(yearStart); setDateTo(today); setDepartment("all"); setStatus("all"); setTab("overview"); }}>Reset</button>
    </section>
    {tab === "overview" ? <section className={styles.grid2}>
      <article className={styles.card}><h2 className={styles.cardTitle}>Reports Summary · Selected Period</h2><div className={styles.donutWrap}><div className={styles.donut} style={{ background: `conic-gradient(${gradient || "#e6ecf4 0 100%"})` }}/><div className={styles.legend}>{summary.map(x => <div className={styles.legendRow} key={x.label}><span className={styles.legendLabel}><i className={styles.dot} style={{ background:x.color }}/>{x.label}</span><strong>{x.value.toLocaleString()}</strong></div>)}</div></div></article>
      <article className={styles.card}><h2 className={styles.cardTitle}>Live Report Sources</h2><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Report</th><th>Source</th><th>Records</th><th>Period / Basis</th><th>Action</th></tr></thead><tbody>
        <tr><td className={styles.strong}>Requests Register</td><td>requests</td><td>{filteredRequests.length}</td><td>{dateFrom} → {dateTo}</td><td><button className={styles.button} onClick={() => setTab("requests")}>Open</button></td></tr>
        <tr><td className={styles.strong}>Approval Decisions</td><td>request_history</td><td>{approvalHistory.length}</td><td>Recorded approve/reject actions</td><td><button className={styles.button} onClick={() => setTab("approvals")}>Open</button></td></tr>
        <tr><td className={styles.strong}>Finance Transactions</td><td>finance_transactions</td><td>{filteredTx.length}</td><td>{dateFrom} → {dateTo}</td><td><button className={styles.button} onClick={() => setTab("finance")}>Open</button></td></tr>
        <tr><td className={styles.strong}>Payment Vouchers</td><td>payment_vouchers</td><td>{filteredVouchers.length}</td><td>{dateFrom} → {dateTo}</td><td><button className={styles.button} onClick={() => setTab("vouchers")}>Open</button></td></tr>
        <tr><td className={styles.strong}>Registry Movement</td><td>registry_correspondence</td><td>{filteredRegistry.length}</td><td>{dateFrom} → {dateTo}</td><td><button className={styles.button} onClick={() => setTab("registry")}>Open</button></td></tr>
      </tbody></table></div></article>
    </section> : <article className={styles.card}><h2 className={styles.cardTitle}>{tabs.find(t => t.key === tab)?.label} Report</h2><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Reference</th><th>Title / Description</th><th>Module</th><th>Type</th><th>Department</th><th>Date</th><th>Status</th></tr></thead><tbody>{tableRows.length ? tableRows.map(r => <tr key={`${tab}-${r.id}`}><td className={styles.strong}>{r.ref}</td><td>{r.title}</td><td>{r.module}</td><td>{r.type}</td><td>{r.department}</td><td>{r.date}</td><td><span className={styles.badge}>{r.status}</span></td></tr>) : <tr><td colSpan={7} className={styles.empty}>No live records match the selected filters.</td></tr>}</tbody></table></div></article>}
  </main>;
}
