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

type ModuleCardProps = {
  title: string;
  description: string;
  icon: string;
  section: string;
  href?: string;
  badge?: string;
  colour:
  | "blue"
  | "amber"
  | "violet"
  | "emerald"
  | "cyan"
  | "rose"
  | "indigo"
  | "slate";
  comingSoon?: boolean;
};

const colourStyles = {
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

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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
        ? "cursor-not-allowed opacity-70"
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

        {badge && (
          <span
            className={`rounded-full border px-3 py-1 text-xs font-black ${styles.badge}`}
          >
            {badge}
          </span>
        )}
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
        {comingSoon ? "Coming Soon" : "Open Module →"}
      </span>
    </article>
  );

  if (comingSoon || !href) {
    return card;
  }

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

export default function FinancePage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);

  const loadFinanceData = useCallback(async (manualRefresh = false) => {
    if (manualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setErrorMessage(null);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error(
          "Your login session has expired. Please sign in again."
        );
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
            .limit(200),

          supabase
            .from("payment_vouchers")
            .select(
              [
                "id",
                "status",
                "voucher_type",
                "amount",
                "total_amount",
              ].join(",")
            )
            .limit(2000),

          supabase
            .from("finance_transactions")
            .select(
              [
                "id",
                "amount",
                "transaction_type",
                "transaction_date",
              ].join(",")
            )
            .order("transaction_date", { ascending: false })
            .limit(2000),
        ]);

      if (requestsResult.error) {
        throw requestsResult.error;
      }

      if (vouchersResult.error) {
        throw vouchersResult.error;
      }

      if (transactionsResult.error) {
        throw transactionsResult.error;
      }

      setRequests(((requestsResult.data || []) as unknown) as RequestRow[]);
      setVouchers(((vouchersResult.data || []) as unknown) as VoucherRow[]);
      setTransactions(((transactionsResult.data || []) as unknown) as TransactionRow[]);
    } catch (error) {
      setErrorMessage(
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
    loadFinanceData();
  }, [loadFinanceData]);

  useEffect(() => {
    const financeChannel = supabase
      .channel("finance-control-centre-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "requests",
        },
        () => loadFinanceData(true)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payment_vouchers",
        },
        () => loadFinanceData(true)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "finance_transactions",
        },
        () => loadFinanceData(true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(financeChannel);
    };
  }, [loadFinanceData]);

  const pendingRequests = useMemo(
    () => requests.filter(isPendingFinanceRequest),
    [requests]
  );

  const manualVouchers = useMemo(
    () =>
      vouchers.filter(
        (voucher) =>
          (voucher.voucher_type || "").toLowerCase() === "manual"
      ),
    [vouchers]
  );

  const requestVouchers = useMemo(
    () =>
      vouchers.filter(
        (voucher) =>
          (voucher.voucher_type || "request").toLowerCase() !==
          "manual"
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
        const amount = Number(
          voucher.total_amount ?? voucher.amount ?? 0
        );

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
    () => pendingRequests.slice(0, 8),
    [pendingRequests]
  );

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-48 rounded-3xl bg-slate-200" />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="h-28 rounded-2xl bg-slate-200" />
            <div className="h-28 rounded-2xl bg-slate-200" />
            <div className="h-28 rounded-2xl bg-slate-200" />
            <div className="h-28 rounded-2xl bg-slate-200" />
          </div>

          <div className="h-96 rounded-3xl bg-slate-200" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      {/* TOP NAVIGATION */}

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
          onClick={() => loadFinanceData(true)}
          disabled={refreshing}
          className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-black text-cyan-800 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? "Refreshing..." : "Refresh Finance Data"}
        </button>
      </nav>

      {/* HERO */}

      <section className="overflow-hidden rounded-3xl border border-blue-900/20 bg-gradient-to-br from-slate-950 via-blue-950 to-violet-950 p-6 text-white shadow-xl sm:p-8">
        <div className="grid gap-7 lg:grid-cols-[1.45fr_0.75fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
              ReqGen 1.1.0 · Finance Management
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
              Finance Control Centre
            </h1>

            <p className="mt-4 max-w-3xl font-semibold leading-7 text-slate-300">
              A unified control centre for finance requests, payment
              vouchers, transaction records, accounting ledgers,
              reporting, audit controls and financial administration.
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
              Total value currently returned by the transaction
              register.
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

      {errorMessage && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 font-semibold text-red-800">
          {errorMessage}
        </div>
      )}

      {/* METRICS */}

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

      {/* =========================
    OPERATIONS
========================= */}

      <section className="mt-10">
        <SectionHeading
          label="Operations"
          title="Daily Finance Operations"
          description="Core operational tools used daily by the Finance Department."
        />

        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <ModuleCard
            title="Pending Finance Requests"
            description="Process all approved requests awaiting Finance action."
            icon="📝"
            section="Operations"
            href="#pending-finance-requests"
            badge={`${pendingRequests.length} Pending`}
            colour="blue"
          />

          <ModuleCard
            title="Manual Voucher Centre"
            description="Create, edit, draft and post manual payment vouchers."
            icon="💳"
            section="Operations"
            href="/finance/manual-voucher"
            badge={`${manualVouchers.length} Records`}
            colour="amber"
          />

          <ModuleCard
            title="Payment Voucher Register"
            description="View all Request and Manual Payment Vouchers."
            icon="📄"
            section="Operations"
            href="/finance/vouchers"
            badge={`${vouchers.length} Vouchers`}
            colour="violet"
          />

          <ModuleCard
            title="Transactions Register"
            description="View every posted finance transaction."
            icon="💰"
            section="Operations"
            href="/finance/transactions"
            badge={`${transactions.length} Entries`}
            colour="emerald"
          />
        </div>
      </section>

      {/* =========================
    ACCOUNTING
========================= */}

      <section className="mt-10">
        <SectionHeading
          label="Accounting"
          title="Accounting & Fund Management"
          description="Control ledgers, balances and fund movements."
        />

        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <ModuleCard
            title="Account Ledger"
            description="Debit, credit and balance movement for each IET account."
            icon="🏦"
            section="Accounting"
            badge="Coming Soon"
            colour="cyan"
            comingSoon
          />

          <ModuleCard
            title="Subhead Ledger"
            description="Allocation, reservation and expenditure history."
            icon="📚"
            section="Accounting"
            badge="Coming Soon"
            colour="blue"
            comingSoon
          />

          <ModuleCard
            title="Account Transfers"
            description="Transfer funds between authorised IET accounts."
            icon="🔄"
            section="Accounting"
            badge="Coming Soon"
            colour="indigo"
            comingSoon
          />
        </div>
      </section>

      {/* =========================
    REPORTS
========================= */}

      <section className="mt-10">
        <SectionHeading
          label="Reports"
          title="Finance Reports"
          description="Management reports, exports and printing."
        />

        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <ModuleCard
            title="Monthly Reports"
            description="Generate monthly finance reports."
            icon="📊"
            section="Reports"
            badge="Coming Soon"
            colour="blue"
            comingSoon
          />

          <ModuleCard
            title="Annual Reports"
            description="Generate annual finance reports."
            icon="📈"
            section="Reports"
            badge="Coming Soon"
            colour="emerald"
            comingSoon
          />

          <ModuleCard
            title="Print Centre"
            description="Print vouchers and financial reports."
            icon="🖨️"
            section="Reports"
            badge="Coming Soon"
            colour="slate"
            comingSoon
          />

          <ModuleCard
            title="PDF / Excel Export"
            description="Export finance records to PDF and Excel."
            icon="📑"
            section="Reports"
            badge="Coming Soon"
            colour="violet"
            comingSoon
          />
        </div>
      </section>

      {/* =========================
    ADMINISTRATION
========================= */}

      <section className="mt-10">
        <SectionHeading
          label="Administration"
          title="Finance Administration"
          description="System administration, audit and activity monitoring."
        />

        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <ModuleCard
            title="Finance Settings"
            description="Configure finance module settings."
            icon="⚙️"
            section="Administration"
            badge="Coming Soon"
            colour="slate"
            comingSoon
          />

          <ModuleCard
            title="Audit Trail"
            description="Inspect every finance action performed."
            icon="📋"
            section="Administration"
            badge="Coming Soon"
            colour="rose"
            comingSoon
          />

          <ModuleCard
            title="Activity History"
            description="Chronological finance activity by user and date."
            icon="📜"
            section="Administration"
            badge="Coming Soon"
            colour="indigo"
            comingSoon
          />
        </div>
      </section>
    </main>
  );
}