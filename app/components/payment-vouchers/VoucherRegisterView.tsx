"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CircleX,
  Download,
  Eye,
  FileClock,
  FileText,
  History,
  Printer,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import styles from "./voucher-register-view.module.css";

type VoucherRow = Record<string, unknown>;
type Mode = "pending" | "approved" | "history" | "print";
type Tone = "blue" | "green" | "amber" | "violet" | "red" | "cyan";

type ModeConfig = {
  title: string;
  description: string;
  breadcrumb: string;
  workspace: string;
  icon: typeof FileClock;
  tone: Tone;
  tabs: string[];
};

const cfg: Record<Mode, ModeConfig> = {
  pending: {
    title: "Pending Vouchers",
    description: "Review vouchers awaiting checking, authorisation or payment processing.",
    breadcrumb: "Pending Approval",
    workspace: "Approval Queue",
    icon: FileClock,
    tone: "amber",
    tabs: ["All Pending", "Awaiting Approval", "Department Review", "Finance Review"],
  },
  approved: {
    title: "Approved Vouchers",
    description: "View and manage authorised payment vouchers ready for payment or official output.",
    breadcrumb: "Approved Vouchers",
    workspace: "Approved Register",
    icon: CheckCircle2,
    tone: "green",
    tabs: ["All Approved", "Authorised", "Cheque Ready", "Paid"],
  },
  history: {
    title: "Voucher History",
    description: "View and track completed, paid, cancelled and historically processed payment vouchers.",
    breadcrumb: "Payment History",
    workspace: "Historical Register",
    icon: History,
    tone: "violet",
    tabs: ["All Vouchers", "This Month", "Completed", "Cancelled"],
  },
  print: {
    title: "Voucher Print Centre",
    description: "Locate authorised vouchers and prepare official Payment Voucher print or PDF output.",
    breadcrumb: "Print / PDF Centre",
    workspace: "Official Output",
    icon: Printer,
    tone: "blue",
    tabs: ["All Printable", "Transfer", "Cheque", "Cash"],
  },
};

function txt(value: unknown) {
  return String(value ?? "").trim();
}

function num(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function money(value: unknown) {
  return "₦" + Math.round(num(value)).toLocaleString("en-NG");
}

function date(value: unknown, withTime = false) {
  if (value === null || value === undefined || value === "") return "—";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return "—";
  if (!withTime) {
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function key(value: unknown) {
  return txt(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isPending(status: unknown) {
  const s = key(status);
  return !/(paid|complete|closed|cancel|reject)/.test(s);
}

function isApproved(status: unknown) {
  return /(approve|authoriz|checked|ready|cheque|paid|complete)/.test(key(status));
}

function isHistory(status: unknown) {
  return /(paid|complete|closed|cancel|reject)/.test(key(status));
}

function isPrintable(status: unknown) {
  return /(approve|authoriz|ready|cheque|paid|complete)/.test(key(status));
}

function statusClass(value: unknown) {
  const s = key(value);
  if (/cancel|reject/.test(s)) return styles.statusRed;
  if (/paid|complete/.test(s)) return styles.statusGreen;
  if (/approve|authoriz|ready|cheque/.test(s)) return styles.statusBlue;
  if (/review/.test(s)) return styles.statusViolet;
  return styles.statusAmber;
}

function statusLabel(value: unknown) {
  const raw = txt(value);
  if (!raw) return "Pending";
  return raw.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function department(value: unknown) {
  return txt(value) || "Unassigned";
}

function method(row: VoucherRow) {
  return txt(row.disbursement_mode || row.payment_method || "Transfer") || "Transfer";
}

function rowAmount(row: VoucherRow) {
  return num(row.total_amount ?? row.amount);
}

function rowDate(row: VoucherRow) {
  return row.created_at ?? row.updated_at;
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export default function VoucherRegisterView({ mode }: { mode: Mode }) {
  const meta = cfg[mode];
  const Icon = meta.icon;

  const [rows, setRows] = useState<VoucherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [dept, setDept] = useState("ALL");
  const [paymentMethod, setPaymentMethod] = useState("ALL");
  const [tab, setTab] = useState(meta.tabs[0]);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await supabase
        .from("payment_vouchers")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      setRows(Array.isArray(result.data) ? (result.data as VoucherRow[]) : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const scoped = useMemo(() => {
    return rows.filter((row) => {
      if (mode === "pending") return isPending(row.status);
      if (mode === "approved") return isApproved(row.status);
      if (mode === "history") return isHistory(row.status);
      return isPrintable(row.status);
    });
  }, [rows, mode]);

  const statuses = useMemo(
    () => [...new Set(scoped.map((row) => txt(row.status)).filter(Boolean))].sort(),
    [scoped]
  );

  const departments = useMemo(
    () => [...new Set(scoped.map((row) => department(row.dept_name)))].sort(),
    [scoped]
  );

  const methods = useMemo(
    () => [...new Set(scoped.map((row) => method(row)))].sort(),
    [scoped]
  );

  const tabbed = useMemo(() => {
    const monthStart = startOfMonth();
    return scoped.filter((row) => {
      const s = key(row.status);
      const m = key(method(row));
      const t = key(tab);
      if (mode === "pending") {
        if (t === "awaitingapproval") return /prepared|pending|await|approval/.test(s);
        if (t === "departmentreview") return /department|dept|hod|director/.test(s);
        if (t === "financereview") return /finance|account|checked/.test(s);
      }
      if (mode === "approved") {
        if (t === "authorised") return /authoriz|approve/.test(s);
        if (t === "chequeready") return /cheque|ready/.test(s);
        if (t === "paid") return /paid|complete/.test(s);
      }
      if (mode === "history") {
        if (t === "thismonth") {
          const d = new Date(String(rowDate(row) ?? ""));
          return !Number.isNaN(d.getTime()) && d >= monthStart;
        }
        if (t === "completed") return /paid|complete|closed/.test(s);
        if (t === "cancelled") return /cancel|reject/.test(s);
      }
      if (mode === "print") {
        if (t === "transfer") return /transfer/.test(m);
        if (t === "cheque") return /cheque/.test(m);
        if (t === "cash") return /cash/.test(m);
      }
      return true;
    });
  }, [scoped, tab, mode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tabbed.filter((row) => {
      if (status !== "ALL" && txt(row.status) !== status) return false;
      if (dept !== "ALL" && department(row.dept_name) !== dept) return false;
      if (paymentMethod !== "ALL" && method(row) !== paymentMethod) return false;
      if (!q) return true;
      return [
        row.voucher_no,
        row.payee_name,
        row.narration,
        row.dept_name,
        row.request_no,
        row.status,
        row.prepared_by_name,
        row.checked_by_name,
        row.authorized_by_name,
        method(row),
      ].some((value) => txt(value).toLowerCase().includes(q));
    });
  }, [tabbed, query, status, dept, paymentMethod]);

  useEffect(() => {
    queueMicrotask(() => setPage(1));
  }, [query, status, dept, paymentMethod, tab]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const totalAmount = scoped.reduce((sum, row) => sum + rowAmount(row), 0);
  const thisMonth = scoped.filter((row) => {
    const d = new Date(String(rowDate(row) ?? ""));
    return !Number.isNaN(d.getTime()) && d >= startOfMonth();
  });
  const thisMonthAmount = thisMonth.reduce((sum, row) => sum + rowAmount(row), 0);
  const averageAmount = scoped.length ? totalAmount / scoped.length : 0;
  const oldest = [...scoped]
    .filter((row) => rowDate(row))
    .sort((a, b) => new Date(String(rowDate(a))).getTime() - new Date(String(rowDate(b))).getTime())[0];
  const newest = [...scoped]
    .filter((row) => rowDate(row))
    .sort((a, b) => new Date(String(rowDate(b))).getTime() - new Date(String(rowDate(a))).getTime())[0];

  const statusGroups = useMemo(() => {
    const map = new Map<string, number>();
    scoped.forEach((row) => {
      const label = statusLabel(row.status);
      map.set(label, (map.get(label) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [scoped]);

  const deptGroups = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    scoped.forEach((row) => {
      const label = department(row.dept_name);
      const prev = map.get(label) || { count: 0, amount: 0 };
      map.set(label, { count: prev.count + 1, amount: prev.amount + rowAmount(row) });
    });
    return [...map.entries()].sort((a, b) => b[1].amount - a[1].amount).slice(0, 6);
  }, [scoped]);

  const methodGroups = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    scoped.forEach((row) => {
      const label = method(row);
      const prev = map.get(label) || { count: 0, amount: 0 };
      map.set(label, { count: prev.count + 1, amount: prev.amount + rowAmount(row) });
    });
    return [...map.entries()].sort((a, b) => b[1].amount - a[1].amount);
  }, [scoped]);

  const recent = scoped.slice(0, 4);
  const cancelled = rows.filter((row) => /cancel|reject/.test(key(row.status))).slice(0, 4);

  function clearFilters() {
    setQuery("");
    setStatus("ALL");
    setDept("ALL");
    setPaymentMethod("ALL");
    setTab(meta.tabs[0]);
  }

  function exportCsv() {
    const header = ["Voucher No", "Date", "Department", "Payee", "Description", "Amount", "Method", "Status"];
    const body = filtered.map((row) => [
      txt(row.voucher_no),
      date(rowDate(row), true),
      department(row.dept_name),
      txt(row.payee_name),
      txt(row.narration),
      rowAmount(row),
      method(row),
      statusLabel(row.status),
    ]);
    const csv = [header, ...body].map((r) => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payment-vouchers-${mode}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const kpis = (() => {
    if (mode === "pending") {
      return [
        { label: "Pending Vouchers", value: scoped.length, note: "Current queue", tone: "amber" as Tone, icon: FileClock },
        { label: "Pending Amount", value: money(totalAmount), note: "Value awaiting action", tone: "green" as Tone, icon: WalletCards },
        { label: "Oldest Pending", value: oldest ? date(rowDate(oldest)) : "—", note: oldest ? statusLabel(oldest.status) : "No pending voucher", tone: "violet" as Tone, icon: CalendarDays },
        { label: "This Month", value: thisMonth.length, note: `${money(thisMonthAmount)} submitted`, tone: "blue" as Tone, icon: Users },
      ];
    }
    if (mode === "approved") {
      return [
        { label: "Approved This Month", value: thisMonth.length, note: money(thisMonthAmount), tone: "green" as Tone, icon: CheckCircle2 },
        { label: "Total Approved", value: money(totalAmount), note: `${scoped.length} vouchers`, tone: "blue" as Tone, icon: WalletCards },
        { label: "Average Voucher", value: money(averageAmount), note: "Approved register", tone: "amber" as Tone, icon: CircleDollarSign },
        { label: "Latest Approval", value: newest ? date(rowDate(newest)) : "—", note: newest ? statusLabel(newest.status) : "No approved voucher", tone: "violet" as Tone, icon: ShieldCheck },
      ];
    }
    if (mode === "history") {
      return [
        { label: "Total Vouchers", value: scoped.length, note: "Historical records", tone: "violet" as Tone, icon: FileText },
        { label: "Total Amount", value: money(totalAmount), note: "Historical value", tone: "green" as Tone, icon: WalletCards },
        { label: "This Month", value: thisMonth.length, note: money(thisMonthAmount), tone: "amber" as Tone, icon: CalendarDays },
        { label: "Last Processed", value: newest ? date(rowDate(newest)) : "—", note: newest ? txt(newest.voucher_no) || "Latest record" : "No history", tone: "blue" as Tone, icon: History },
      ];
    }
    return [
      { label: "Printable Vouchers", value: scoped.length, note: "Ready for output", tone: "blue" as Tone, icon: Printer },
      { label: "Printable Value", value: money(totalAmount), note: "Authorised value", tone: "green" as Tone, icon: WalletCards },
      { label: "This Month", value: thisMonth.length, note: "Available documents", tone: "amber" as Tone, icon: CalendarDays },
      { label: "Payment Methods", value: methodGroups.length, note: "Output categories", tone: "violet" as Tone, icon: Banknote },
    ];
  })();

  const sideTitle = mode === "approved" ? "Approval Summary" : mode === "history" ? "History Summary" : mode === "print" ? "Print Summary" : "Pending Summary";

  return (
    <main className={`${styles.page} ${styles[`mode_${mode}`]}`}>
      <div className={styles.breadcrumb}>
        <Link href="/dashboard">Home</Link><ChevronRight size={13}/>
        <Link href="/payment-vouchers">Payment Vouchers</Link><ChevronRight size={13}/>
        <span>{meta.breadcrumb}</span>
      </div>

      <header className={styles.hero}>
        <div className={styles.heroIdentity}>
          <div className={`${styles.titleIcon} ${styles[`tone_${meta.tone}`]}`}><Icon size={25}/></div>
          <div><h1>{meta.title}</h1><p>{meta.description}</p></div>
        </div>
        <div className={styles.heroMeta}>
          <div className={styles.metaItem}><CalendarDays size={17}/><span>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</span></div>
          <div className={styles.metaDivider}/>
          <div className={styles.metaItem}><ShieldCheck size={17}/><span>{meta.workspace}</span></div>
          <button className={styles.secondaryButton} onClick={() => void load()} disabled={loading}><RefreshCw size={15}/>{loading ? "Refreshing..." : "Refresh"}</button>
          {mode !== "pending" ? <button className={styles.primaryButton} onClick={exportCsv}><Download size={16}/>Export CSV</button> : null}
        </div>
      </header>

      <section className={styles.kpiGrid}>
        {kpis.map((kpi) => {
          const KpiIcon = kpi.icon;
          return <article className={styles.kpi} key={kpi.label}>
            <span className={`${styles.kpiIcon} ${styles[`soft_${kpi.tone}`]}`}><KpiIcon size={21}/></span>
            <div className={styles.kpiContent}><small>{kpi.label}</small><strong className={typeof kpi.value === "string" && kpi.value.startsWith("₦") ? styles.moneyValue : ""}>{kpi.value}</strong><p>{kpi.note}</p></div>
          </article>;
        })}
      </section>

      <div className={styles.contentGrid}>
        <section className={styles.registerCard}>
          <div className={styles.tabs}>
            {meta.tabs.map((item) => <button key={item} className={tab === item ? styles.activeTab : ""} onClick={() => setTab(item)}>{item}</button>)}
          </div>

          <div className={styles.filterBar}>
            <label className={styles.searchBox}><Search size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search voucher no., payee, description..."/></label>
            <select value={dept} onChange={(e) => setDept(e.target.value)}><option value="ALL">All Departments</option>{departments.map((d) => <option key={d} value={d}>{d}</option>)}</select>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option value="ALL">All Payment Methods</option>{methods.map((m) => <option key={m} value={m}>{m}</option>)}</select>
            <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="ALL">All Statuses</option>{statuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select>
            <button className={styles.clearButton} onClick={clearFilters}>Clear</button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr>
                <th>#</th><th>Voucher No.</th><th>Date</th><th>Payee / Description</th><th>Department</th><th className={styles.right}>Amount (₦)</th><th>Payment Method</th>
                {mode === "approved" ? <th>Approved By</th> : mode === "history" ? <th>Processed By</th> : mode === "pending" ? <th>Submitted By</th> : <th>Prepared By</th>}
                <th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {pagedRows.map((row, index) => {
                  const id = txt(row.id);
                  const actor = mode === "approved" ? row.authorized_by_name : mode === "history" ? (row.authorized_by_name || row.checked_by_name || row.prepared_by_name) : row.prepared_by_name;
                  return <tr key={id || `${index}`}>
                    <td>{(safePage - 1) * pageSize + index + 1}</td>
                    <td><Link className={styles.voucherLink} href={`/payment-vouchers/${id}`}>{txt(row.voucher_no) || "—"}</Link></td>
                    <td>{date(rowDate(row), true)}</td>
                    <td><span className={styles.payee}>{txt(row.payee_name) || "—"}</span><span className={styles.description}>{txt(row.narration) || txt(row.request_no) || "—"}</span></td>
                    <td><span className={styles.departmentTag}>{department(row.dept_name)}</span></td>
                    <td className={`${styles.amount} ${styles.right}`}>{rowAmount(row).toLocaleString("en-NG")}</td>
                    <td><span className={styles.method}><Banknote size={13}/>{method(row)}</span></td>
                    <td>{txt(actor) || "—"}</td>
                    <td><span className={`${styles.status} ${statusClass(row.status)}`}>{statusLabel(row.status)}</span></td>
                    <td><div className={styles.actions}><Link aria-label="View voucher" href={`/payment-vouchers/${id}`}><Eye size={14}/></Link><Link aria-label="Print voucher" href={`/payment-vouchers/${id}/print`}><Printer size={14}/></Link></div></td>
                  </tr>;
                })}
                {!pagedRows.length ? <tr><td colSpan={10} className={styles.empty}>{loading ? "Loading vouchers..." : "No voucher matches this workspace."}</td></tr> : null}
              </tbody>
            </table>
          </div>

          <div className={styles.tableFooter}>
            <span>Showing {filtered.length ? (safePage - 1) * pageSize + 1 : 0} to {Math.min(safePage * pageSize, filtered.length)} of {filtered.length} vouchers</span>
            <div className={styles.pagination}><button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}><ChevronLeft size={14}/></button><strong>{safePage}</strong><span>of {pageCount}</span><button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={safePage >= pageCount}><ChevronRight size={14}/></button></div>
          </div>
        </section>

        <aside className={styles.sideStack}>
          <section className={styles.sideCard}>
            <div className={styles.sideHeading}><h3>{sideTitle}</h3><span>{mode === "history" ? "All Time" : "Current"}</span></div>
            <div className={styles.summaryList}>
              {statusGroups.length ? statusGroups.map(([label, count], idx) => <div className={styles.summaryRow} key={label}><span className={`${styles.summaryDot} ${styles[`dot${idx % 5}`]}`}/><span>{label}</span><strong>{count}</strong></div>) : <div className={styles.emptyCompact}>No status data available.</div>}
              <div className={styles.summaryTotal}><span>Total Vouchers</span><strong>{scoped.length}</strong></div>
            </div>
          </section>

          <section className={styles.sideCard}>
            <div className={styles.sideHeading}><h3>{mode === "history" || mode === "print" ? "Amount by Payment Method" : "Top Departments"}</h3><span>{mode === "history" ? "All Time" : "Current"}</span></div>
            <div className={styles.rankList}>
              {(mode === "history" || mode === "print" ? methodGroups.map(([label, value]) => [label, value.amount] as const) : deptGroups.map(([label, value]) => [label, value.amount] as const)).slice(0, 6).map(([label, amount]) => <div key={label}><span>{label}</span><strong>{money(amount)}</strong></div>)}
              {!(mode === "history" || mode === "print" ? methodGroups.length : deptGroups.length) ? <div className={styles.emptyCompact}>No summary data available.</div> : null}
            </div>
          </section>

          <section className={styles.sideCard}>
            <div className={styles.sideHeading}><h3>{mode === "history" ? "Recent Cancelled Vouchers" : mode === "print" ? "Recent Printable Vouchers" : mode === "approved" ? "Recent Approvals" : "Recent Pending"}</h3></div>
            <div className={styles.recentList}>
              {(mode === "history" ? cancelled : recent).slice(0, 4).map((row) => <Link key={txt(row.id)} href={`/payment-vouchers/${txt(row.id)}`} className={styles.recentItem}><span className={styles.recentIcon}>{mode === "history" ? <CircleX size={14}/> : mode === "print" ? <Printer size={14}/> : <FileText size={14}/>}</span><span><strong>{txt(row.voucher_no) || "Voucher"}</strong><small>{txt(row.payee_name) || date(rowDate(row))}</small></span><em>{money(rowAmount(row))}</em></Link>)}
              {!(mode === "history" ? cancelled.length : recent.length) ? <div className={styles.emptyCompact}>No recent records.</div> : null}
            </div>
          </section>

          <section className={styles.sideCard}>
            <div className={styles.sideHeading}><h3>Quick Actions</h3></div>
            <div className={styles.quickGrid}>
              <Link href="/payment-vouchers"><WalletCards size={18}/><span>PV Dashboard</span></Link>
              <button onClick={exportCsv}><Download size={18}/><span>Export List</span></button>
              <Link href="/payment-vouchers/settings"><Settings2 size={18}/><span>PV Settings</span></Link>
              <button onClick={() => void load()}><RefreshCw size={18}/><span>Refresh</span></button>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
