"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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

  if (loading) return <LoadingScreen />;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <nav className="mb-6 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-100"
          >
            ← Main Dashboard
          </Link>
          <Link
            href="/finance/manual-voucher"
            className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-amber-700"
          >
            + Create Manual Voucher
          </Link>
          <Link
            href="/finance/vouchers"
            className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-violet-800"
          >
            Voucher Register
          </Link>
          <Link
            href="/finance/transactions"
            className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-800"
          >
            Transactions
          </Link>
        </div>

        <button
          type="button"
          onClick={() => void loadFinanceData(true)}
          disabled={refreshing}
          className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-black text-cyan-800 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? "Refreshing..." : "Refresh Finance Data"}
        </button>
      </nav>

      <section className="overflow-hidden rounded-3xl border border-blue-900/20 bg-gradient-to-br from-slate-950 via-blue-950 to-violet-950 p-6 text-white shadow-xl sm:p-8">
        <div className="grid gap-7 lg:grid-cols-[1.45fr_0.75fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
              Finance Management
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
              Finance Control Centre
            </h1>
            <p className="mt-4 max-w-3xl font-semibold leading-7 text-slate-300">
              A unified control centre for finance requests, payment vouchers,
              transaction records, accounting ledgers, reporting, audit controls
              and financial administration.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/finance/manual-voucher"
                className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-400"
              >
                Create Manual Voucher
              </Link>
              <a
                href="#pending-finance-requests"
                className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
              >
                View Pending Requests
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">
              Recorded Transaction Value
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {formatMoney(transactionValue)}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-300">
              Total value currently returned by the finance transactions register.
            </p>

            <div className="mt-5 flex flex-wrap gap-2 text-xs font-black">
              <span className="rounded-full bg-amber-400/15 px-3 py-1.5 text-amber-200">
                {pendingRequests.length} Pending
              </span>
              <span className="rounded-full bg-violet-400/15 px-3 py-1.5 text-violet-200">
                {postedVouchers.length} Posted Vouchers
              </span>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-emerald-200">
                {transactions.length} Transactions
              </span>
            </div>
          </div>
        </div>
      </section>

      {fatalError ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-red-900">
          <p className="font-black">Finance Control Centre could not be loaded.</p>
          <p className="mt-1 text-sm font-semibold">{fatalError}</p>
          <button
            type="button"
            onClick={() => void loadFinanceData(true)}
            className="mt-3 rounded-xl bg-red-700 px-4 py-2 text-sm font-black text-white hover:bg-red-800"
          >
            Try Again
          </button>
        </div>
      ) : null}

      {loadIssues.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-950">
          <p className="font-black">Some finance records could not be loaded.</p>
          <div className="mt-2 space-y-1 text-sm font-semibold">
            {loadIssues.map((issue) => (
              <p key={`${issue.source}-${issue.message}`}>
                <span className="font-black">{issue.source}:</span> {issue.message}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Pending Finance Requests"
          value={String(pendingRequests.length)}
          note="Awaiting Finance action"
          colour="amber"
        />
        <MetricCard
          label="Manual Vouchers"
          value={String(manualVouchers.length)}
          note={`${draftVouchers.length} draft or pending vouchers`}
          colour="violet"
        />
        <MetricCard
          label="Posted Voucher Value"
          value={formatMoney(postedVoucherValue)}
          note={`${postedVouchers.length} posted vouchers`}
          colour="emerald"
        />
        <MetricCard
          label="Request-Based Vouchers"
          value={String(requestVouchers.length)}
          note="Generated from approved requests"
          colour="blue"
        />
      </section>

      <section className="mt-10">
        <SectionHeading
          label="Operations"
          title="Daily Finance Operations"
          description="Core operational tools used daily by the Finance Department."
        />
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <ModuleCard
            title="Pending Finance Requests"
            description="Process approved requests currently awaiting Finance action."
            icon="📝"
            section="Operations"
            href="#pending-finance-requests"
            badge={`${pendingRequests.length} Pending`}
            colour="blue"
          />
          <ModuleCard
            title="Manual Voucher Centre"
            description="Create, edit, save, cancel and post manual payment vouchers."
            icon="💳"
            section="Operations"
            href="/finance/manual-voucher"
            badge={`${manualVouchers.length} Records`}
            colour="amber"
          />
          <ModuleCard
            title="Payment Voucher Register"
            description="Review request-based and manual payment vouchers in one register."
            icon="📄"
            section="Operations"
            href="/finance/vouchers"
            badge={`${vouchers.length} Vouchers`}
            colour="violet"
          />
          <ModuleCard
            title="Transactions Register"
            description="Review every posted finance transaction and its source record."
            icon="💰"
            section="Operations"
            href="/finance/transactions"
            badge={`${transactions.length} Entries`}
            colour="emerald"
          />
        </div>
      </section>

      <section
        id="pending-finance-requests"
        className="mt-10 scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
              Live Work Queue
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
              Pending Finance Requests
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              The ten most recent requests detected at a Finance, Account or Payment stage.
            </p>
          </div>
          <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800">
            {pendingRequests.length} awaiting action
          </span>
        </div>

        {recentPendingRequests.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
            <p className="text-lg font-black text-slate-800">No pending Finance requests</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              New requests will appear here when they reach a Finance-related stage.
            </p>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                    Request
                  </th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                    Description
                  </th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                    Stage / Owner
                  </th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {recentPendingRequests.map((request) => (
                  <tr key={request.id} className="align-top hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-black text-blue-800">
                      {request.request_no || "No request number"}
                    </td>
                    <td className="min-w-60 px-4 py-4">
                      <p className="text-sm font-black text-slate-900">
                        {request.title || "Untitled request"}
                      </p>
                      {request.assigned_account_officer_name ? (
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          Officer: {request.assigned_account_officer_name}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-black text-slate-900">
                      {formatMoney(request.amount)}
                    </td>
                    <td className="min-w-48 px-4 py-4 text-sm font-semibold text-slate-600">
                      <p>{normaliseStatus(request.current_stage)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Owner: {normaliseStatus(request.current_owner)}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusClasses(
                          request.status
                        )}`}
                      >
                        {normaliseStatus(request.status)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-600">
                      {formatDate(request.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <SectionHeading
          label="Accounting"
          title="Accounting & Fund Management"
          description="Ledger, balance and authorised fund-movement modules available from the Finance Control Centre."
        />
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <ModuleCard
            title="Account Ledger"
            description="Debit, credit and running-balance movement for each IET account."
            icon="🏦"
            section="Accounting"
            badge="Live"
            colour="cyan"
            href="/finance/account-ledger"
          />
          <ModuleCard
            title="Subhead Ledger"
            description="Allocation, reservation, expenditure and available-balance history."
            icon="📚"
            section="Accounting"
            badge="Phase 7"
            colour="blue"
            href="/finance/subhead-ledger"
          />
          <ModuleCard
            title="Account Transfers"
            description="Controlled transfers between authorised IET accounts with dual entries."
            icon="🔄"
            section="Accounting"
            badge="Phase 8"
            colour="indigo"
            href="/finance/account-transfers"
          />
        </div>
      </section>

      <section className="mt-10">
        <SectionHeading
          label="Reports"
          title="Finance Reports & Output"
          description="Management reporting, statements, printing and export capabilities."
        />
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <ModuleCard
            title="Monthly Reports"
            description="Monthly expenditure, balances, vouchers and department spending."
            icon="📊"
            section="Reports"
            badge="Phase 9"
            colour="blue"
            href="/finance/reports?view=monthly"
          />
          <ModuleCard
            title="Annual Reports"
            description="Yearly allocation, expenditure, comparisons and performance reports."
            icon="📈"
            section="Reports"
            badge="Phase 9"
            colour="emerald"
            href="/finance/reports?view=annual"
          />
          <ModuleCard
            title="Print / PDF Centre"
            description="Print reports and save approved finance outputs as PDF from one central workspace."
            icon="🖨️"
            section="Reports"
            badge="Phase 10"
            colour="slate"
            href="/finance/reports?view=output"
          />
          <ModuleCard
            title="Excel Export"
            description="Export authorised finance reports and registers from the central Reports Centre."
            icon="📑"
            section="Reports"
            badge="Phase 10"
            colour="violet"
            href="/finance/reports?view=output"
          />
        </div>
      </section>

      <section className="mt-10 pb-8">
        <SectionHeading
          label="Administration"
          title="Finance Administration"
          description="Workflow configuration, audit evidence and chronological activity monitoring."
        />
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <ModuleCard
            title="Finance Settings"
            description="Configure numbering formats, fiscal year and permitted workflows."
            icon="⚙️"
            section="Administration"
            badge="Phase 11"
            colour="slate"
            href="/finance/settings"
          />
          <ModuleCard
            title="Audit Trail"
            description="Inspect who created, edited, posted or changed finance records."
            icon="📋"
            section="Administration"
            badge="Phase 11"
            colour="rose"
            href="/finance/audit-trail"
          />
          <ModuleCard
            title="Activity History"
            description="Review chronological finance activity by user, module, date and action."
            icon="📜"
            section="Administration"
            badge="Phase 11"
            colour="indigo"
            href="/finance/activity-history"
          />
        </div>
      </section>
    </main>
  );
}
