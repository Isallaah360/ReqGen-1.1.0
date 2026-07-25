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
  assigned_account_officer_id: string | null;
  assigned_account_officer_name: string | null;
  created_at: string;
};

type TransactionRow = {
  amount: number | string | null;
  transaction_date: string | null;
  transaction_type: string | null;
};

type ProfileRole = {
  role_key: string;
  is_active: boolean;
};

const FINANCE_ROLES = new Set([
  "admin",
  "auditor",
  "account",
  "accounts",
  "accountofficer",
  "pvsigner",
  "pvcountersigner",
]);

function normalizeRole(value: string | null | undefined) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function money(value: number | string | null | undefined) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function sameLocalDay(dateValue: string | null | undefined, target: Date) {
  if (!dateValue) return false;

  const date = new Date(dateValue);

  return (
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  );
}

function sameLocalMonth(dateValue: string | null | undefined, target: Date) {
  if (!dateValue) return false;

  const date = new Date(dateValue);

  return (
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth()
  );
}

function StatusBadge({ request }: { request: RequestRow }) {
  const status = (request.status || "").toLowerCase();

  let label = "Pending Payment";
  let classes = "border-blue-200 bg-blue-50 text-blue-800";

  if (status.includes("paid")) {
    label = "Paid";
    classes = "border-emerald-200 bg-emerald-50 text-emerald-800";
  } else if (status.includes("voucher")) {
    label = "Voucher Ready";
    classes = "border-violet-200 bg-violet-50 text-violet-800";
  } else if (request.assigned_account_officer_id) {
    label = "Assigned";
    classes = "border-cyan-200 bg-cyan-50 text-cyan-800";
  }

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${classes}`}
    >
      {label}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "blue" | "emerald" | "violet" | "amber";
}) {
  const toneClasses = {
    blue: "border-blue-100 bg-gradient-to-br from-white to-blue-50 text-blue-700",
    emerald:
      "border-emerald-100 bg-gradient-to-br from-white to-emerald-50 text-emerald-700",
    violet:
      "border-violet-100 bg-gradient-to-br from-white to-violet-50 text-violet-700",
    amber:
      "border-amber-100 bg-gradient-to-br from-white to-amber-50 text-amber-700",
  };

  return (
    <section className={`rounded-3xl border p-5 shadow-sm ${toneClasses[tone]}`}>
      <p className="text-xs font-black uppercase tracking-[0.16em]">{label}</p>
      <p className="mt-3 break-words text-3xl font-black tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-500">{hint}</p>
    </section>
  );
}

function NavigationCard({
  href,
  title,
  description,
  accent,
  disabled = false,
}: {
  href: string;
  title: string;
  description: string;
  accent: "blue" | "violet" | "emerald" | "amber";
  disabled?: boolean;
}) {
  const styles = {
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    violet: "border-violet-200 bg-violet-50 text-violet-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
  };

  const content = (
    <article
      className={`h-full rounded-3xl border p-5 shadow-sm transition ${styles[accent]} ${disabled ? "cursor-not-allowed opacity-70" : "hover:-translate-y-0.5 hover:shadow-md"
        }`}
    >
      <h3 className="text-lg font-black">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 opacity-80">{description}</p>
      <p className="mt-4 text-sm font-black">
        {disabled ? "Coming in this phase" : "Open workspace →"}
      </p>
    </article>
  );

  if (disabled) return content;

  return <Link href={href}>{content}</Link>;
}

export default function FinanceDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [officerName, setOfficerName] = useState("AccountOfficer");
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);

  const loadDashboard = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const user = authData.user;

      if (authError || !user) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const [profileResult, rolesResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("role,full_name")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("profile_roles")
          .select("role_key,is_active")
          .eq("profile_id", user.id)
          .eq("is_active", true),
      ]);

      const roleKeys = new Set<string>();
      roleKeys.add(normalizeRole(profileResult.data?.role));

      ((rolesResult.data || []) as ProfileRole[]).forEach((item) => {
        if (item.is_active) roleKeys.add(normalizeRole(item.role_key));
      });

      const hasFinanceRole = [...roleKeys].some((role) =>
        FINANCE_ROLES.has(role)
      );

      setAuthorized(hasFinanceRole);

      if (!hasFinanceRole) {
        setRequests([]);
        setTransactions([]);
        return;
      }

      setOfficerName(
        profileResult.data?.full_name ||
        user.user_metadata?.full_name ||
        user.email ||
        "AccountOfficer"
      );

      const [requestResult, transactionResult] = await Promise.all([
        supabase
          .from("requests")
          .select(
            "id,request_no,title,amount,status,current_stage,current_owner,assigned_account_officer_id,assigned_account_officer_name,created_at"
          )
          .eq("assigned_account_officer_id", user.id)
          .eq("current_stage", "Account")
          .not(
            "status",
            "in",
            '("Paid","Closed","Completed","Cancelled","Deleted","Rejected")'
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("finance_transactions")
          .select("amount,transaction_date,transaction_type")
          .eq("posted_by", user.id)
          .order("transaction_date", { ascending: false }),
      ]);

      if (requestResult.error) throw requestResult.error;
      if (transactionResult.error) throw transactionResult.error;

      setRequests((requestResult.data || []) as RequestRow[]);
      setTransactions((transactionResult.data || []) as TransactionRow[]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load the Finance Dashboard."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadDashboard(true);
    }, 30_000);

    const channel = supabase
      .channel("finance-dashboard-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "requests" },
        () => loadDashboard(true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "finance_transactions" },
        () => loadDashboard(true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_vouchers" },
        () => loadDashboard(true)
      )
      .subscribe();

    return () => {
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [loadDashboard]);

  const now = useMemo(() => new Date(), [transactions]);

  const pendingAmount = useMemo(
    () => requests.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [requests]
  );

  const paidToday = useMemo(
    () =>
      transactions
        .filter((item) => sameLocalDay(item.transaction_date, now))
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [transactions, now]
  );

  const paidThisMonth = useMemo(
    () =>
      transactions
        .filter((item) => sameLocalMonth(item.transaction_date, now))
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [transactions, now]
  );

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-32 rounded-3xl bg-slate-200" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-36 rounded-3xl bg-slate-200" />
            ))}
          </div>
          <div className="h-80 rounded-3xl bg-slate-200" />
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-7 shadow-sm">
          <h1 className="text-2xl font-black text-amber-950">
            Finance access required
          </h1>
          <p className="mt-3 font-semibold leading-7 text-amber-900">
            Your active roles do not currently permit access to the Finance
            workspace.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
          >
            Return to Dashboard
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard"
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800"
          >
            Main Dashboard
          </Link>
          <Link
            href="/finance/transactions"
            className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-800"
          >
            Transactions Register
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">
            Auto-refresh: 30 seconds
          </span>
          <button
            type="button"
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
            className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-black text-cyan-800 transition hover:bg-cyan-100 disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : "Refresh Now"}
          </button>
        </div>
      </nav>

      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-gradient-to-br from-slate-950 via-blue-950 to-violet-950 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
              ReqGen Finance
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              AccountOfficer Dashboard
            </h1>
            <p className="mt-3 max-w-2xl font-semibold leading-7 text-slate-300">
              Welcome, {officerName}. Process assigned requests and review
              complete finance records from one workspace.
            </p>
          </div>

          <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-wide text-blue-200">
              Phase 2C
            </p>
            <p className="mt-1 text-lg font-black">Finance Records & Reports</p>
          </div>
        </div>
      </section>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 font-semibold text-red-800">
          {error}
        </div>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Pending Payments"
          value={String(requests.length)}
          hint="Requests assigned to you"
          tone="blue"
        />
        <SummaryCard
          label="Total Pending Amount"
          value={money(pendingAmount)}
          hint="Combined value awaiting action"
          tone="amber"
        />
        <SummaryCard
          label="Paid Today"
          value={money(paidToday)}
          hint="Payments posted today"
          tone="emerald"
        />
        <SummaryCard
          label="This Month"
          value={money(paidThisMonth)}
          hint="Payments posted this month"
          tone="violet"
        />
      </section>

      <section className="mt-6">
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">
            Finance Navigation
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Records, Vouchers and Reports
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <NavigationCard
            href="/finance/transactions"
            title="Transactions Register"
            description="Review all posted finance transactions with search, filters and live updates."
            accent="blue"
          />
          <NavigationCard
            href="/finance/vouchers"
            title="Payment Vouchers"
            description="The consolidated register for request-based and manual payment vouchers."
            accent="violet"
            disabled
          />
          <NavigationCard
            href="/finance/manual-voucher"
            title="Manual Voucher Saga"
            description="Complete direct finance entries, approvals, posting and audit history."
            accent="amber"
            disabled
          />
          <NavigationCard
            href="/finance/reports"
            title="Finance Reports"
            description="Account ledgers, subhead reports, printing, PDF and Excel export."
            accent="emerald"
            disabled
          />
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h2 className="text-xl font-black text-slate-950">
              Pending Payments
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Requests routed to your linked IET accounts
            </p>
          </div>

          <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700">
            {requests.length} request{requests.length === 1 ? "" : "s"}
          </span>
        </div>

        {requests.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="text-lg font-black text-slate-900">
              No pending payment request
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              New DG-approved requests assigned to you will appear here
              automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-black uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 sm:px-6">Request</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Assigned</th>
                  <th className="px-5 py-3 text-right sm:px-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((request) => (
                  <tr key={request.id} className="align-top hover:bg-slate-50/80">
                    <td className="px-5 py-5 sm:px-6">
                      <div className="font-black text-slate-950">
                        {request.request_no || "No request number"}
                      </div>
                      <div className="mt-1 max-w-xl text-sm font-semibold text-slate-700">
                        {request.title || "Untitled request"}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        Stage: {request.current_stage || "Account"}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-5 text-sm font-black text-slate-950">
                      {money(request.amount)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-5">
                      <StatusBadge request={request} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-5 text-sm font-semibold text-slate-600">
                      {new Date(request.created_at).toLocaleDateString("en-US", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="whitespace-nowrap px-5 py-5 text-right sm:px-6">
                      <Link
                        href={`/finance/request/${request.id}`}
                        className="inline-flex rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-800"
                      >
                        Open Request
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
