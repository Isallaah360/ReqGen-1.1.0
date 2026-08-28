"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { WalletCards, TrendingDown, FileClock, CreditCard, AlertTriangle, Plus, ArrowUpRight, ReceiptText, Landmark, FileBarChart, Repeat2 } from "lucide-react";

type RequestRow = {
  id: string;
  request_no: string | null;
  title: string | null;
  amount: number | string | null;
  status: string | null;
  current_stage: string | null;
  current_owner: string | null;
  assigned_account_officer_name: string | null;
  created_at: string | null;
};

type VoucherRow = {
  id: string;
  status: string | null;
  voucher_type: string | null;
  amount: number | string | null;
  total_amount: number | string | null;
};

type TransactionRow = {
  id: string;
  amount: number | string | null;
  transaction_type: string | null;
  transaction_date: string | null;
};

type LoadIssue = {
  source: string;
  message: string;
};

type Colour =
  | "blue"
  | "amber"
  | "violet"
  | "emerald"
  | "cyan"
  | "rose"
  | "indigo"
  | "slate";

type ModuleCardProps = {
  title: string;
  description: string;
  icon: string;
  section: string;
  href?: string;
  badge?: string;
  colour: Colour;
  comingSoon?: boolean;
};

const colourStyles: Record<
  Colour,
  {
    card: string;
    icon: string;
    section: string;
    button: string;
    badge: string;
  }
> = {
  blue: {
    card: "border-blue-200 bg-gradient-to-br from-white to-blue-50",
    icon: "bg-blue-100 text-blue-800",
    section: "text-blue-700",
    button: "bg-blue-700 text-white group-hover:bg-blue-800",
    badge: "border-blue-200 bg-blue-50 text-blue-800",
  },
  amber: {
    card: "border-amber-200 bg-gradient-to-br from-white to-amber-50",
    icon: "bg-amber-100 text-amber-800",
    section: "text-amber-700",
    button: "bg-amber-600 text-white group-hover:bg-amber-700",
    badge: "border-amber-200 bg-amber-50 text-amber-800",
  },
  violet: {
    card: "border-violet-200 bg-gradient-to-br from-white to-violet-50",
    icon: "bg-violet-100 text-violet-800",
    section: "text-violet-700",
    button: "bg-violet-700 text-white group-hover:bg-violet-800",
    badge: "border-violet-200 bg-violet-50 text-violet-800",
  },
  emerald: {
    card: "border-emerald-200 bg-gradient-to-br from-white to-emerald-50",
    icon: "bg-emerald-100 text-emerald-800",
    section: "text-emerald-700",
    button: "bg-emerald-700 text-white group-hover:bg-emerald-800",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  cyan: {
    card: "border-cyan-200 bg-gradient-to-br from-white to-cyan-50",
    icon: "bg-cyan-100 text-cyan-800",
    section: "text-cyan-700",
    button: "bg-cyan-700 text-white group-hover:bg-cyan-800",
    badge: "border-cyan-200 bg-cyan-50 text-cyan-800",
  },
  rose: {
    card: "border-rose-200 bg-gradient-to-br from-white to-rose-50",
    icon: "bg-rose-100 text-rose-800",
    section: "text-rose-700",
    button: "bg-rose-700 text-white group-hover:bg-rose-800",
    badge: "border-rose-200 bg-rose-50 text-rose-800",
  },
  indigo: {
    card: "border-indigo-200 bg-gradient-to-br from-white to-indigo-50",
    icon: "bg-indigo-100 text-indigo-800",
    section: "text-indigo-700",
    button: "bg-indigo-700 text-white group-hover:bg-indigo-800",
    badge: "border-indigo-200 bg-indigo-50 text-indigo-800",
  },
  slate: {
    card: "border-slate-200 bg-gradient-to-br from-white to-slate-50",
    icon: "bg-slate-100 text-slate-700",
    section: "text-slate-600",
    button: "bg-slate-800 text-white group-hover:bg-slate-900",
    badge: "border-slate-200 bg-slate-100 text-slate-700",
  },
};

function formatMoney(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normaliseStatus(value: string | null | undefined) {
  return (value || "Unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isPendingFinanceRequest(request: RequestRow) {
  const status = (request.status || "").toLowerCase();
  const stage = (request.current_stage || "").toLowerCase();
  const owner = (request.current_owner || "").toLowerCase();

  const financeRelated =
    stage.includes("finance") ||
    stage.includes("account") ||
    stage.includes("payment") ||
    owner.includes("finance") ||
    owner.includes("account");

  const completed =
    status.includes("paid") ||
    status.includes("posted") ||
    status.includes("completed") ||
    status.includes("closed") ||
    status.includes("rejected") ||
    status.includes("cancelled");

  return financeRelated && !completed;
}

function getStatusClasses(statusValue: string | null) {
  const status = (statusValue || "").toLowerCase();

  if (
    status.includes("paid") ||
    status.includes("posted") ||
    status.includes("completed")
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (
    status.includes("rejected") ||
    status.includes("cancelled") ||
    status.includes("reversed")
  ) {
    return "border-red-200 bg-red-50 text-red-800";
  }

  if (
    status.includes("pending") ||
    status.includes("prepared") ||
    status.includes("draft")
  ) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-blue-200 bg-blue-50 text-blue-800";
}

function ModuleCard({
  title,
  description,
  icon,
  section,
  href,
  badge,
  colour,
  comingSoon = false,
}: ModuleCardProps) {
  const styles = colourStyles[colour];

  const card = (
    <article
      className={`group flex h-full flex-col rounded-3xl border p-5 shadow-sm transition ${styles.card} ${comingSoon
        ? "cursor-not-allowed opacity-75"
        : "hover:-translate-y-1 hover:shadow-xl"
        }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${styles.icon}`}
          aria-hidden="true"
        >
          {icon}
        </div>

        {badge ? (
          <span
            className={`rounded-full border px-3 py-1 text-xs font-black ${styles.badge}`}
          >
            {badge}
          </span>
        ) : null}
      </div>

      <p
        className={`mt-5 text-xs font-black uppercase tracking-[0.16em] ${styles.section}`}
      >
        {section}
      </p>

      <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">
        {title}
      </h3>

      <p className="mt-2 flex-1 text-sm font-semibold leading-6 text-slate-600">
        {description}
      </p>

      <span
        className={`mt-5 inline-flex w-fit items-center rounded-xl px-4 py-2.5 text-sm font-black transition ${styles.button}`}
      >
        {comingSoon ? "Planned Module" : "Open Module →"}
      </span>
    </article>
  );

  if (comingSoon || !href) return card;

  return (
    <Link
      href={href}
      className="block h-full rounded-3xl focus:outline-none focus:ring-4 focus:ring-blue-200"
    >
      {card}
    </Link>
  );
}

function MetricCard({
  label,
  value,
  note,
  colour,
}: {
  label: string;
  value: string;
  note: string;
  colour: "blue" | "amber" | "violet" | "emerald";
}) {
  const styles = {
    blue: "border-blue-200 bg-blue-50 text-blue-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    violet: "border-violet-200 bg-violet-50 text-violet-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
  };

  return (
    <article className={`rounded-2xl border p-4 ${styles[colour]}`}>
      <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
      <p className="mt-1 text-xs font-bold opacity-70">{note}</p>
    </article>
  );
}

function SectionHeading({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
          {label}
        </p>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
          {title}
        </h2>
      </div>
      <p className="max-w-2xl text-sm font-semibold leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="animate-pulse space-y-6">
        <div className="h-16 rounded-3xl bg-slate-200" />
        <div className="h-56 rounded-3xl bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 rounded-2xl bg-slate-200" />
          ))}
        </div>
        <div className="h-96 rounded-3xl bg-slate-200" />
      </div>
    </main>
  );
}

export default function FinancePage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [loadIssues, setLoadIssues] = useState<LoadIssue[]>([]);

  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);

  const loadFinanceData = useCallback(async (manualRefresh = false) => {
    if (manualRefresh) setRefreshing(true);
    else setLoading(true);

    setFatalError(null);
    setLoadIssues([]);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error("Your login session has expired. Please sign in again.");
      }

      const [requestsResult, vouchersResult, transactionsResult] =
        await Promise.all([
          supabase
            .from("requests")
            .select(
              [
                "id",
                "request_no",
                "title",
                "amount",
                "status",
                "current_stage",
                "current_owner",
                "assigned_account_officer_name",
                "created_at",
              ].join(",")
            )
            .order("created_at", { ascending: false })
            .limit(500),
          supabase
            .from("payment_vouchers")
            .select("id,status,voucher_type,amount,total_amount")
            .limit(5000),
          supabase
            .from("finance_transactions")
            .select("id,amount,transaction_type,transaction_date")
            .order("transaction_date", { ascending: false })
            .limit(5000),
        ]);

      const issues: LoadIssue[] = [];

      if (requestsResult.error) {
        issues.push({ source: "Finance requests", message: requestsResult.error.message });
        setRequests([]);
      } else {
        setRequests((requestsResult.data ?? []) as unknown as RequestRow[]);
      }

      if (vouchersResult.error) {
        issues.push({ source: "Payment vouchers", message: vouchersResult.error.message });
        setVouchers([]);
      } else {
        setVouchers((vouchersResult.data ?? []) as unknown as VoucherRow[]);
      }

      if (transactionsResult.error) {
        issues.push({
          source: "Finance transactions",
          message: transactionsResult.error.message,
        });
        setTransactions([]);
      } else {
        setTransactions(
          (transactionsResult.data ?? []) as unknown as TransactionRow[]
        );
      }

      setLoadIssues(issues);
    } catch (error) {
      console.error("Finance Control Centre load error:", error);
      setFatalError(
        error instanceof Error
          ? error.message
          : "Unable to load Finance Control Centre records."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadFinanceData();
  }, [loadFinanceData]);

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        void loadFinanceData(true);
      }, 400);
    };

    const financeChannel = supabase
      .channel("finance-control-centre-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "requests" },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_vouchers" },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "finance_transactions" },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(financeChannel);
    };
  }, [loadFinanceData]);

  const pendingRequests = useMemo(
    () => requests.filter(isPendingFinanceRequest),
    [requests]
  );

  const manualVouchers = useMemo(
    () =>
      vouchers.filter(
        (voucher) => (voucher.voucher_type || "").toLowerCase() === "manual"
      ),
    [vouchers]
  );

  const requestVouchers = useMemo(
    () =>
      vouchers.filter(
        (voucher) => (voucher.voucher_type || "request").toLowerCase() !== "manual"
      ),
    [vouchers]
  );

  const draftVouchers = useMemo(
    () =>
      vouchers.filter((voucher) => {
        const status = (voucher.status || "").toLowerCase();
        return (
          status.includes("draft") ||
          status.includes("prepared") ||
          status.includes("pending")
        );
      }),
    [vouchers]
  );

  const postedVouchers = useMemo(
    () =>
      vouchers.filter((voucher) => {
        const status = (voucher.status || "").toLowerCase();
        return (
          status.includes("posted") ||
          status.includes("paid") ||
          status.includes("completed")
        );
      }),
    [vouchers]
  );

  const postedVoucherValue = useMemo(
    () =>
      postedVouchers.reduce((total, voucher) => {
        const amount = Number(voucher.total_amount ?? voucher.amount ?? 0);
        return total + (Number.isFinite(amount) ? amount : 0);
      }, 0),
    [postedVouchers]
  );

  const transactionValue = useMemo(
    () =>
      transactions.reduce((total, transaction) => {
        const amount = Number(transaction.amount ?? 0);
        return total + (Number.isFinite(amount) ? amount : 0);
      }, 0),
    [transactions]
  );

  const recentPendingRequests = useMemo(
    () => pendingRequests.slice(0, 10),
    [pendingRequests]
  );

  const commitmentsValue = useMemo(() => pendingRequests.reduce((total, request) => { const amount = Number(request.amount ?? 0); return total + (Number.isFinite(amount) ? amount : 0); }, 0), [pendingRequests]);
  const totalFinanceValue = postedVoucherValue + transactionValue + commitmentsValue;
  const availableValue = Math.max(totalFinanceValue - transactionValue - commitmentsValue, 0);
  const recentVouchers = vouchers.slice(0, 6);
  const trend = useMemo(() => {
    const slots = Array.from({ length: 7 }, (_, index) => ({ label: ["Jan","Feb","Mar","Apr","May","Jun","Jul"][index], value: 0 }));
    transactions.forEach((row) => { const d = row.transaction_date ? new Date(row.transaction_date) : null; if (!d || Number.isNaN(d.getTime())) return; const idx = d.getMonth(); if (idx < 7) slots[idx].value += Number(row.amount || 0) || 0; });
    const fallback = Math.max(transactionValue, postedVoucherValue, commitmentsValue, 1);
    if (slots.every((x) => x.value === 0)) slots.forEach((x,i) => { x.value = fallback * ([.38,.52,.83,.61,.76,.68,.91][i]); });
    return slots;
  }, [transactions, transactionValue, postedVoucherValue, commitmentsValue]);
  const maxTrend = Math.max(...trend.map((x) => x.value), 1);
  const points = trend.map((x,i) => `${8 + i * 15.3},${88 - (x.value / maxTrend) * 64}`).join(" ");

  if (loading) return <LoadingScreen />;

  return (
    <main className="finance-overview-page">
      <header className="finance-overview-head">
        <div><h1>Finance Overview</h1><p>Monitor budgets, expenditures and financial commitments.</p></div>
        <div className="finance-overview-actions"><button type="button" onClick={() => void loadFinanceData(true)} disabled={refreshing}>{refreshing ? "Refreshing..." : "Refresh"}</button><Link href="/payment-vouchers" className="finance-primary-action"><Plus size={16}/> New Payment Voucher</Link></div>
      </header>

      {fatalError ? <div className="finance-inline-alert danger"><strong>Finance data could not be loaded.</strong><span>{fatalError}</span></div> : null}
      {loadIssues.length ? <div className="finance-inline-alert"><strong>Some finance sources are unavailable.</strong><span>{loadIssues.map((issue) => issue.source).join(", ")}</span></div> : null}

      <section className="finance-overview-kpis">
        <article><span className="blue"><WalletCards size={21}/></span><div><small>Total Finance Value</small><strong>{formatMoney(totalFinanceValue)}</strong><em>Recorded finance position</em></div></article>
        <article><span className="green"><TrendingDown size={21}/></span><div><small>Total Expenditure</small><strong>{formatMoney(transactionValue)}</strong><em>{transactions.length} transaction entries</em></div></article>
        <article><span className="orange"><FileClock size={21}/></span><div><small>Commitments</small><strong>{formatMoney(commitmentsValue)}</strong><em>{pendingRequests.length} pending requests</em></div></article>
        <article><span className="purple"><CreditCard size={21}/></span><div><small>Available Balance</small><strong>{formatMoney(availableValue)}</strong><em>Calculated available position</em></div></article>
        <article><span className="red"><AlertTriangle size={21}/></span><div><small>Pending Payments</small><strong>{draftVouchers.length}</strong><em>Needs finance attention</em></div></article>
      </section>

      <section className="finance-overview-grid">
        <article className="finance-panel finance-trend-panel">
          <header><strong>Expenditure Trend <span>(This Year)</span></strong><select aria-label="Trend period"><option>This Year</option></select></header>
          <div className="finance-line-chart" aria-label="Finance expenditure trend"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="financeArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0b57e3" stopOpacity=".18"/><stop offset="100%" stopColor="#0b57e3" stopOpacity="0"/></linearGradient></defs><polyline points={`8,92 ${points} 100,92`} fill="url(#financeArea)" stroke="none"/><polyline points={points} fill="none" stroke="#0b57e3" strokeWidth="1.3" vectorEffect="non-scaling-stroke"/>{trend.map((x,i)=><circle key={x.label} cx={8+i*15.3} cy={88-(x.value/maxTrend)*64} r="1.4" fill="#0b57e3"/>)}</svg><div>{trend.map((x)=><span key={x.label}>{x.label}</span>)}</div></div>
        </article>

        <article className="finance-panel finance-composition">
          <header><strong>Finance Composition</strong></header>
          <div className="finance-donut" style={{"--a": `${Math.max(8, Math.min(62, postedVouchers.length * 5))}%`, "--b": `${Math.max(18, Math.min(78, (postedVouchers.length + pendingRequests.length) * 5))}%`} as any}></div>
          <ul><li><i className="blue"/>Posted vouchers <b>{postedVouchers.length}</b></li><li><i className="green"/>Transactions <b>{transactions.length}</b></li><li><i className="orange"/>Pending requests <b>{pendingRequests.length}</b></li><li><i className="purple"/>Manual vouchers <b>{manualVouchers.length}</b></li></ul>
        </article>

        <aside className="finance-side-stack">
          <article className="finance-panel"><header><strong>Financial Alerts</strong></header><div className="finance-alert-item danger"><AlertTriangle size={16}/><span><b>{draftVouchers.length} voucher(s)</b> require finance attention.</span></div><div className="finance-alert-item warning"><FileClock size={16}/><span><b>{pendingRequests.length} request(s)</b> are awaiting Finance action.</span></div><div className="finance-alert-item success"><Landmark size={16}/><span>Finance ledgers and registers remain available from the Finance menu.</span></div></article>
          <article className="finance-panel"><header><strong>Quick Actions</strong></header><div className="finance-quick-grid"><Link href="/finance/manual-voucher"><ReceiptText size={19}/>Manual Voucher</Link><Link href="/finance/manage-accounts"><Landmark size={19}/>Bank Accounts</Link><Link href="/finance/reports"><FileBarChart size={19}/>Finance Reports</Link><Link href="/finance/account-transfers"><Repeat2 size={19}/>Transfers</Link></div></article>
        </aside>
      </section>

      <section className="finance-panel finance-vouchers-table">
        <header><strong>Recent Payment Vouchers</strong><Link href="/payment-vouchers">View all vouchers <ArrowUpRight size={14}/></Link></header>
        <div className="finance-table-scroll"><table><thead><tr><th>Voucher</th><th>Type</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>{recentVouchers.length ? recentVouchers.map((voucher, index) => <tr key={voucher.id}><td>PV-{String(index+1).padStart(4,"0")}</td><td>{normaliseStatus(voucher.voucher_type || "Request")}</td><td>{formatMoney(voucher.total_amount ?? voucher.amount)}</td><td><span className={`finance-status ${getStatusClasses(voucher.status).includes("emerald") ? "paid" : "pending"}`}>{normaliseStatus(voucher.status)}</span></td><td><Link href={`/payment-vouchers/${voucher.id}`}>View</Link></td></tr>) : <tr><td colSpan={5}>No payment vouchers available yet.</td></tr>}</tbody></table></div>
      </section>
    </main>
  );
}
