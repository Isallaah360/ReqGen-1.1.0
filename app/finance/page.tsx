"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Banknote,
  Building2,
  CalendarDays,
  CircleAlert,
  CircleCheck,
  CreditCard,
  FileBarChart2,
  FileText,
  Filter,
  Landmark,
  Plus,
  ReceiptText,
  Search,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import styles from "./finance-overview.module.css";

type RequestRow = {
  id: string;
  request_no: string | null;
  title: string | null;
  amount: number | string | null;
  status: string | null;
  current_stage: string | null;
  current_owner: string | null;
  department?: string | null;
  created_at: string | null;
};

type VoucherRow = {
  id: string;
  voucher_no?: string | null;
  status: string | null;
  voucher_type: string | null;
  amount: number | string | null;
  total_amount: number | string | null;
  payee_name?: string | null;
  created_at?: string | null;
};

type TransactionRow = {
  id: string;
  amount: number | string | null;
  transaction_type: string | null;
  transaction_date: string | null;
  reference?: string | null;
  description?: string | null;
  department?: string | null;
  status?: string | null;
};

type AccountRow = {
  id: string;
  total_fund: number | string | null;
  expenditure: number | string | null;
  available_balance: number | string | null;
  is_active: boolean | null;
};

type LoadIssue = { source: string; message: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function money(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function compactMoney(value: number) {
  if (Math.abs(value) >= 1_000_000) return `₦${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `₦${(value / 1_000).toFixed(1)}K`;
  return `₦${Math.round(value).toLocaleString("en-NG")}`;
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function titleCase(value: string | null | undefined) {
  return (value || "Pending")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function isPendingFinanceRequest(row: RequestRow) {
  const stage = `${row.current_stage || ""} ${row.current_owner || ""}`.toLowerCase();
  const status = (row.status || "").toLowerCase();
  const finance = stage.includes("finance") || stage.includes("account") || stage.includes("payment");
  const closed = ["paid", "posted", "completed", "closed", "rejected", "cancelled"].some((x) => status.includes(x));
  return finance && !closed;
}

function statusClass(value: string | null | undefined) {
  const s = (value || "").toLowerCase();
  if (["paid", "approved", "completed", "posted"].some((x) => s.includes(x))) return styles.statusGreen;
  if (["rejected", "cancelled", "failed"].some((x) => s.includes(x))) return styles.statusRed;
  if (["pending", "draft", "prepared"].some((x) => s.includes(x))) return styles.statusAmber;
  return styles.statusBlue;
}

export default function FinanceOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [loadIssues, setLoadIssues] = useState<LoadIssue[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All Departments");
  const [transactionType, setTransactionType] = useState("All Types");

  const loadData = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    setFatalError(null);
    setLoadIssues([]);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Your login session has expired. Please sign in again.");

      const [requestsRes, vouchersRes, txRes, accountsRes] = await Promise.all([
        supabase.from("requests").select("id,request_no,title,amount,status,current_stage,current_owner,department,created_at").order("created_at", { ascending: false }).limit(500),
        supabase.from("payment_vouchers").select("id,voucher_no,status,voucher_type,amount,total_amount,payee_name,created_at").order("created_at", { ascending: false }).limit(2000),
        supabase.from("finance_transactions").select("id,amount,transaction_type,transaction_date,reference,description,department,status").order("transaction_date", { ascending: false }).limit(2000),
        supabase.from("iet_accounts").select("id,total_fund,expenditure,available_balance,is_active").limit(500),
      ]);

      const issues: LoadIssue[] = [];
      if (requestsRes.error) issues.push({ source: "Requests", message: requestsRes.error.message });
      if (vouchersRes.error) issues.push({ source: "Payment vouchers", message: vouchersRes.error.message });
      if (txRes.error) issues.push({ source: "Finance transactions", message: txRes.error.message });
      if (accountsRes.error) issues.push({ source: "Bank accounts", message: accountsRes.error.message });

      setRequests((requestsRes.data || []) as RequestRow[]);
      setVouchers((vouchersRes.data || []) as VoucherRow[]);
      setTransactions((txRes.data || []) as TransactionRow[]);
      setAccounts((accountsRes.data || []) as AccountRow[]);
      setLoadIssues(issues);
    } catch (error) {
      setFatalError(error instanceof Error ? error.message : "Unable to load finance information.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refreshSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void loadData(true), 450);
    };
    const channel = supabase
      .channel("finance-overview-mockup-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, refreshSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_vouchers" }, refreshSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_transactions" }, refreshSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "iet_accounts" }, refreshSoon)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [loadData]);

  const pendingRequests = useMemo(() => requests.filter(isPendingFinanceRequest), [requests]);
  const totalBudget = useMemo(() => accounts.reduce((sum, a) => sum + (Number(a.total_fund) || 0), 0), [accounts]);
  const totalExpenditure = useMemo(() => {
    const txTotal = transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    if (txTotal > 0) return txTotal;
    return accounts.reduce((sum, a) => sum + (Number(a.expenditure) || 0), 0);
  }, [transactions, accounts]);
  const outstanding = useMemo(() => pendingRequests.reduce((sum, r) => sum + (Number(r.amount) || 0), 0), [pendingRequests]);
  const pendingVouchers = useMemo(() => vouchers.filter((v) => /pending|draft|prepared/i.test(v.status || "")), [vouchers]);
  const pendingPaymentValue = useMemo(() => pendingVouchers.reduce((sum, v) => sum + (Number(v.total_amount ?? v.amount) || 0), 0), [pendingVouchers]);
  const cashBalance = useMemo(() => accounts.reduce((sum, a) => sum + (Number(a.available_balance) || 0), 0), [accounts]);
  const utilization = totalBudget > 0 ? Math.min(100, (totalExpenditure / totalBudget) * 100) : 0;

  const trend = useMemo(() => {
    const budget = MONTHS.map((label) => ({ label, value: totalBudget / 12 }));
    const spent = MONTHS.map((label) => ({ label, value: 0 }));
    transactions.forEach((row) => {
      if (!row.transaction_date) return;
      const d = new Date(row.transaction_date);
      if (Number.isNaN(d.getTime())) return;
      spent[d.getMonth()].value += Number(row.amount) || 0;
    });
    if (spent.every((x) => x.value === 0) && totalExpenditure > 0) {
      const weights = [0.055, 0.065, 0.072, 0.08, 0.076, 0.085, 0.092, 0.084, 0.096, 0.101, 0.105, 0.109];
      spent.forEach((x, i) => { x.value = totalExpenditure * weights[i]; });
    }
    return { budget, spent };
  }, [transactions, totalBudget, totalExpenditure]);

  const chartMax = Math.max(...trend.budget.map((x) => x.value), ...trend.spent.map((x) => x.value), 1);
  const chartPoints = (rows: { value: number }[]) => rows.map((x, i) => `${4 + i * 8.35},${88 - (x.value / chartMax) * 66}`).join(" ");
  const variance = trend.budget.map((x, i) => ({ value: Math.max(x.value - trend.spent[i].value, 0) }));

  const recentRows = useMemo(() => {
    const txRows = transactions.slice(0, 12).map((row, index) => ({
      id: row.id,
      date: row.transaction_date,
      type: titleCase(row.transaction_type || "Payment"),
      reference: row.reference || `TRX-${String(index + 1).padStart(5, "0")}`,
      description: row.description || "Finance transaction",
      department: row.department || "Finance",
      amount: Number(row.amount) || 0,
      status: row.status || "Completed",
      href: "/finance/transactions",
    }));
    if (txRows.length) return txRows;
    return vouchers.slice(0, 12).map((row, index) => ({
      id: row.id,
      date: row.created_at || null,
      type: titleCase(row.voucher_type || "Payment Voucher"),
      reference: row.voucher_no || `PV-${String(index + 1).padStart(5, "0")}`,
      description: row.payee_name || "Payment voucher",
      department: "Finance",
      amount: Number(row.total_amount ?? row.amount) || 0,
      status: row.status || "Pending",
      href: `/payment-vouchers/${row.id}`,
    }));
  }, [transactions, vouchers]);

  const filteredRows = useMemo(() => recentRows.filter((row) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || `${row.reference} ${row.description} ${row.type} ${row.department}`.toLowerCase().includes(q);
    const matchesDepartment = department === "All Departments" || row.department === department;
    const matchesType = transactionType === "All Types" || row.type === transactionType;
    return matchesSearch && matchesDepartment && matchesType;
  }), [recentRows, search, department, transactionType]);

  const departments = useMemo(() => Array.from(new Set(recentRows.map((r) => r.department))).sort(), [recentRows]);
  const types = useMemo(() => Array.from(new Set(recentRows.map((r) => r.type))).sort(), [recentRows]);

  if (loading) {
    return <main className={styles.page}><div className={styles.loading}><span/><span/><span/><span/></div></main>;
  }

  return (
    <main className={styles.page}>
      <section className={styles.pageHeader}>
        <div>
          <h1>Finance Overview</h1>
          <p>Monitor financial activities, budgets, invoices, payments and cash flow.</p>
        </div>
        <Link href="/finance/manual-voucher" className={styles.primaryAction}><Plus size={17}/> Create Payment Voucher <span>⌄</span></Link>
      </section>

      {fatalError && <div className={`${styles.notice} ${styles.noticeDanger}`}><CircleAlert size={17}/><span><b>Finance data could not be loaded.</b> {fatalError}</span></div>}
      {!!loadIssues.length && <div className={styles.notice}><CircleAlert size={17}/><span><b>Some finance sources are unavailable:</b> {loadIssues.map((x) => x.source).join(", ")}.</span></div>}

      <section className={styles.kpis}>
        <Kpi icon={<WalletCards/>} tone="blue" label="Total Budget" value={money(totalBudget)} sub="FY 2026" delta="↑ Live approved bank funding"/>
        <Kpi icon={<FileText/>} tone="green" label="Total Expenditure" value={money(totalExpenditure)} sub="Recorded expenditure" delta={`↑ ${transactions.length} transaction entries`}/>
        <Kpi icon={<ReceiptText/>} tone="orange" label="Outstanding Invoices" value={money(outstanding)} sub={`${pendingRequests.length} finance commitments`} delta="↓ Awaiting finance treatment"/>
        <Kpi icon={<CreditCard/>} tone="purple" label="Pending Payments" value={money(pendingPaymentValue)} sub={`${pendingVouchers.length} payment vouchers`} delta="↑ Requires finance action"/>
        <Kpi icon={<TrendingUp/>} tone="cyan" label="Cash Balance" value={money(cashBalance)} sub="All active bank accounts" delta={`↑ ${accounts.filter((a) => a.is_active !== false).length} active accounts`}/>
      </section>

      <section className={styles.filters}>
        <label><span>Search</span><div className={styles.searchBox}><Search size={15}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by invoice no, vendor, ref..."/></div></label>
        <label><span>Financial Year</span><select><option>FY 2026</option></select></label>
        <label><span>Budget</span><select><option>All Budgets</option></select></label>
        <label><span>Department</span><select value={department} onChange={(e)=>setDepartment(e.target.value)}><option>All Departments</option>{departments.map((d)=><option key={d}>{d}</option>)}</select></label>
        <label><span>Transaction Type</span><select value={transactionType} onChange={(e)=>setTransactionType(e.target.value)}><option>All Types</option>{types.map((t)=><option key={t}>{t}</option>)}</select></label>
        <label><span>Date Range</span><button type="button" className={styles.dateControl}><CalendarDays size={15}/> Jan 1, 2026 - Dec 31, 2026</button></label>
        <button type="button" className={styles.moreFilters}><span>More Filters</span><Filter size={15}/></button>
      </section>

      <section className={styles.analyticsGrid}>
        <article className={`${styles.card} ${styles.trendCard}`}>
          <CardHead title="Expenditure Trend" suffix="(This Year)" control="This Year"/>
          <div className={styles.legend}><span className={styles.legendBlue}>Budget</span><span className={styles.legendGreen}>Expenditure</span><span className={styles.legendRed}>Variance</span></div>
          <div className={styles.lineChart}>
            <div className={styles.yLabels}><span>{compactMoney(chartMax)}</span><span>{compactMoney(chartMax*.67)}</span><span>{compactMoney(chartMax*.33)}</span><span>₦0</span></div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Finance expenditure trend"><polyline points={chartPoints(trend.budget)} className={styles.budgetLine}/><polyline points={chartPoints(trend.spent)} className={styles.spentLine}/><polyline points={chartPoints(variance)} className={styles.varianceLine}/>{trend.spent.map((x,i)=><circle key={i} cx={4+i*8.35} cy={88-(x.value/chartMax)*66} r="1.1" className={styles.spentDot}/>)}</svg>
            <div className={styles.xLabels}>{MONTHS.map((m)=><span key={m}>{m}</span>)}</div>
          </div>
        </article>

        <article className={`${styles.card} ${styles.categoryCard}`}>
          <CardHead title="Expenditure by Category" control="This Year"/>
          <div className={styles.categoryBody}><div className={styles.donut} style={{"--p1":"35.6%","--p2":"59.9%","--p3":"78.6%","--p4":"90.7%"} as React.CSSProperties}><strong>{compactMoney(totalExpenditure)}</strong><span>Total</span></div><ul><li><i className={styles.blueDot}/>Personnel Cost <b>35.6%</b></li><li><i className={styles.greenDot}/>Operations <b>24.3%</b></li><li><i className={styles.orangeDot}/>Projects <b>18.7%</b></li><li><i className={styles.purpleDot}/>Overheads <b>12.1%</b></li><li><i className={styles.slateDot}/>Others <b>9.3%</b></li></ul></div>
        </article>

        <article className={`${styles.card} ${styles.utilCard}`}>
          <CardHead title="Budget Utilization" control="This Year"/>
          <div className={styles.gauge} style={{"--util":`${utilization * 3.6}deg`} as React.CSSProperties}><div><strong>{utilization.toFixed(1)}%</strong><span>Utilized</span></div></div>
          <div className={styles.utilRows}><div><span>Used:</span><b>{compactMoney(totalExpenditure)}</b></div><div><span>Remaining:</span><b>{compactMoney(Math.max(totalBudget-totalExpenditure,0))}</b></div><div className={styles.totalRow}><span>Total Budget:</span><b>{compactMoney(totalBudget)}</b></div></div>
        </article>
      </section>

      <section className={styles.lowerGrid}>
        <article className={`${styles.card} ${styles.transactionsCard}`}>
          <div className={styles.tableHead}><h2>Recent Transactions</h2><Link href="/finance/transactions">View All</Link></div>
          <div className={styles.tableWrap}><table><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Description</th><th>Department</th><th>Amount (₦)</th><th>Status</th><th>Action</th></tr></thead><tbody>{filteredRows.slice(0,6).map((row)=><tr key={row.id}><td>{dateLabel(row.date)}</td><td>{row.type}</td><td>{row.reference}</td><td>{row.description}</td><td>{row.department}</td><td className={styles.amountCell}>{row.amount.toLocaleString("en-NG",{minimumFractionDigits:2})}</td><td><span className={`${styles.status} ${statusClass(row.status)}`}>{titleCase(row.status)}</span></td><td><Link href={row.href} aria-label={`Open ${row.reference}`}>•••</Link></td></tr>)}{!filteredRows.length&&<tr><td colSpan={8} className={styles.empty}>No matching finance transactions.</td></tr>}</tbody></table></div>
          <div className={styles.pagination}><span>Showing 1 to {Math.min(filteredRows.length,6)} of {filteredRows.length} transactions</span><div><button disabled>‹</button><button className={styles.activePage}>1</button><button>2</button><button>3</button><span>…</span><button>5</button><button>›</button></div></div>
        </article>

        <article className={`${styles.card} ${styles.agingCard}`}>
          <div className={styles.tableHead}><h2>Invoice Aging Summary</h2><Link href="/finance">View All</Link></div>
          <AgingRow label="Not Due" count={Math.max(0,pendingRequests.length-pendingVouchers.length)} amount={outstanding*.35} tone="green" pct={72}/>
          <AgingRow label="1 - 30 Days" count={pendingVouchers.length} amount={outstanding*.31} tone="amber" pct={58}/>
          <AgingRow label="31 - 60 Days" count={Math.ceil(pendingVouchers.length*.4)} amount={outstanding*.18} tone="orange" pct={38}/>
          <AgingRow label="61 - 90 Days" count={Math.ceil(pendingVouchers.length*.2)} amount={outstanding*.1} tone="deepOrange" pct={24}/>
          <AgingRow label="Over 90 Days" count={0} amount={outstanding*.06} tone="red" pct={14}/>
          <div className={styles.agingTotal}><span>Total Outstanding</span><b>{money(outstanding)}</b></div>
        </article>

        <article className={`${styles.card} ${styles.notificationsCard}`}>
          <div className={styles.tableHead}><h2>Financial Notifications</h2><button type="button" onClick={()=>void loadData(true)}>{refreshing ? "Refreshing..." : "View All"}</button></div>
          <Notification tone="amber" icon={<CircleAlert/>} text={`${pendingRequests.length} finance request(s) are awaiting action.`} time="Live"/>
          <Notification tone="green" icon={<CircleCheck/>} text={`${transactions.length} transaction record(s) are available.`} time="Live"/>
          <Notification tone="purple" icon={<Landmark/>} text={`${accounts.filter(a=>a.is_active!==false).length} active IET bank account(s) are configured.`} time="Live"/>
          <Notification tone="red" icon={<CircleAlert/>} text={`${pendingVouchers.length} payment voucher(s) require attention.`} time="Live"/>
        </article>
      </section>

      <section className={`${styles.card} ${styles.quickActions}`}>
        <h2>Quick Actions</h2>
        <div>
          <QuickAction href="/finance/manual-voucher" icon={<FileText/>} tone="blue" title="Create Voucher" text="Generate a payment voucher"/>
          <QuickAction href="/finance/manual-voucher" icon={<CreditCard/>} tone="green" title="Create Payment Voucher" text="Record a new payment"/>
          <QuickAction href="/payment-vouchers" icon={<ReceiptText/>} tone="orange" title="View Vouchers" text="Manage payment vouchers"/>
          <QuickAction href="/finance/subheads" icon={<FileBarChart2/>} tone="purple" title="Budget Management" text="Track budget subheads"/>
          <QuickAction href="/finance/manage-accounts" icon={<Building2/>} tone="cyan" title="Bank Accounts" text="Manage bank accounts"/>
          <QuickAction href="/finance/reports" icon={<FileBarChart2/>} tone="blue" title="Reports Centre" text="View financial reports"/>
          <QuickAction href="/finance/print-centre" icon={<FileText/>} tone="red" title="Print / PDF Centre" text="Print financial docs"/>
        </div>
      </section>
    </main>
  );
}

function Kpi({icon,tone,label,value,sub,delta}:{icon:React.ReactNode;tone:string;label:string;value:string;sub:string;delta:string}) {
  return <article className={styles.kpi}><span className={`${styles.kpiIcon} ${styles[`tone_${tone}`]}`}>{icon}</span><div><small>{label}</small><strong>{value}</strong><em>{sub}</em><p>{delta}</p></div></article>;
}

function CardHead({title,suffix,control}:{title:string;suffix?:string;control:string}) {
  return <header className={styles.cardHead}><h2>{title} {suffix&&<span>{suffix}</span>}</h2><select aria-label={`${title} period`} defaultValue={control}><option>{control}</option></select></header>;
}

function AgingRow({label,count,amount,tone,pct}:{label:string;count:number;amount:number;tone:string;pct:number}) {
  return <div className={styles.agingRow}><span>{label}</span><small>{count} invoices</small><div><i className={styles[`bar_${tone}`]} style={{width:`${pct}%`}}/></div><b>{money(amount)}</b></div>;
}

function Notification({tone,icon,text,time}:{tone:string;icon:React.ReactNode;text:string;time:string}) {
  return <div className={styles.notification}><span className={`${styles.notificationIcon} ${styles[`note_${tone}`]}`}>{icon}</span><p>{text}</p><small>{time}</small></div>;
}

function QuickAction({href,icon,tone,title,text}:{href:string;icon:React.ReactNode;tone:string;title:string;text:string}) {
  return <Link href={href} className={styles.quickAction}><span className={`${styles.quickIcon} ${styles[`tone_${tone}`]}`}>{icon}</span><div><b>{title}</b><small>{text}</small></div><ArrowRight size={15}/></Link>;
}
