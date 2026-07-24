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
  department_name?: string | null;
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
  return new Intl.NumberFormat("en-NG", {
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
  return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth();
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
  } else if (status.includes("evidence")) {
    label = "Awaiting Evidence";
    classes = "border-amber-200 bg-amber-50 text-amber-800";
  } else if (request.assigned_account_officer_id) {
    label = "Assigned";
    classes = "border-cyan-200 bg-cyan-50 text-cyan-800";
  }

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${classes}`}>
      {label}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-3 break-words text-3xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm font-semibold text-slate-500">{hint}</p>
    </section>
  );
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
        supabase.from("profiles").select("role,full_name").eq("id", user.id).maybeSingle(),
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

      const hasFinanceRole = [...roleKeys].some((role) => FINANCE_ROLES.has(role));
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

      const requestResult = await supabase
        .from("requests")
        .select(
          "id,request_no,title,amount,status,current_stage,current_owner,assigned_account_officer_id,assigned_account_officer_name,created_at"
        )
        .eq("assigned_account_officer_id", user.id)
        .eq("current_stage", "Account")
        .not("status", "in", '("Paid","Closed","Completed","Cancelled","Deleted","Rejected")')
        .order("created_at", { ascending: false });

      if (requestResult.error) throw requestResult.error;

      const transactionResult = await supabase
        .from("finance_transactions")
        .select("amount,transaction_date,transaction_type")
        .eq("posted_by", user.id)
        .order("transaction_date", { ascending: false });

      if (transactionResult.error) throw transactionResult.error;

      setRequests((requestResult.data || []) as RequestRow[]);
      setTransactions((transactionResult.data || []) as TransactionRow[]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to load the Finance Dashboard.";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadDashboard]);

  const now = new Date();

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
          <div className="h-28 rounded-3xl bg-slate-200" />
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
          <h1 className="text-2xl font-black text-amber-950">Finance access required</h1>
          <p className="mt-3 font-semibold leading-7 text-amber-900">
            Your active roles do not currently permit access to the Finance workspace.
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
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
              ReqGen Finance
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              AccountOfficer Dashboard
            </h1>
            <p className="mt-3 max-w-2xl font-semibold leading-7 text-slate-300">
              Welcome, {officerName}. Review and process only the payment requests assigned to you.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/20 disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : "Refresh Dashboard"}
          </button>
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
        />
        <SummaryCard
          label="Total Pending Amount"
          value={money(pendingAmount)}
          hint="Combined value awaiting action"
        />
        <SummaryCard label="Paid Today" value={money(paidToday)} hint="Payments posted today" />
        <SummaryCard
          label="This Month"
          value={money(paidThisMonth)}
          hint="Payments posted this month"
        />
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h2 className="text-xl font-black text-slate-950">Pending Payments</h2>
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
            <div className="text-lg font-black text-slate-900">No pending payment request</div>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              New DG-approved requests assigned to you will appear here automatically.
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
                      {new Date(request.created_at).toLocaleDateString("en-NG", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="whitespace-nowrap px-5 py-5 text-right sm:px-6">
                      <Link
                        href={`/finance/request/${request.id}`}
                        className="inline-flex rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-700"
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
