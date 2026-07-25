"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type FinanceRequest = {
  id: string;
  request_no: string | null;
  title: string | null;
  description: string | null;
  amount: number | string | null;
  status: string | null;
  current_stage: string | null;
  current_owner: string | null;
  assigned_account_officer_id: string | null;
  assigned_account_officer_name: string | null;
  subhead_id: string | null;
  created_at: string;
};

type SubheadRow = {
  id: string;
  name?: string | null;
  title?: string | null;
  subhead_name?: string | null;
  code?: string | null;
  subhead_code?: string | null;
  account_id?: string | null;
  bank_account_id?: string | null;
  approved_allocation?: number | string | null;
  reserved_amount?: number | string | null;
  expenditure?: number | string | null;
  balance?: number | string | null;
};

type AccountRow = {
  id: string;
  account_name?: string | null;
  name?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  current_balance?: number | string | null;
  balance?: number | string | null;
  is_active?: boolean | null;
};

type VoucherRow = {
  id: string;
  voucher_no?: string | null;
  payment_voucher_no?: string | null;
  request_id?: string | null;
  account_id?: string | null;
  amount?: number | string | null;
  status?: string | null;
  created_at?: string | null;
};

function money(value: number | string | null | undefined) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function readableDate(value: string | null | undefined) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getSubheadName(subhead: SubheadRow | null) {
  if (!subhead) return "Not linked";

  return (
    subhead.subhead_name ||
    subhead.name ||
    subhead.title ||
    subhead.subhead_code ||
    subhead.code ||
    "Linked subhead"
  );
}

function getAccountName(account: AccountRow | null) {
  if (!account) return "Not linked";

  return account.account_name || account.name || account.bank_name || "Linked IET account";
}

function getVoucherNumber(voucher: VoucherRow | null) {
  if (!voucher) return null;

  return voucher.voucher_no || voucher.payment_voucher_no || null;
}

function InformationBox({
  label,
  value,
  valueClassName = "text-slate-950",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <dt className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-2 break-words font-black ${valueClassName}`}>{value}</dd>
    </div>
  );
}

export default function FinanceRequestPage() {
  const params = useParams<{ id: string }>();
  const requestId = params?.id;

  const [request, setRequest] = useState<FinanceRequest | null>(null);
  const [subhead, setSubhead] = useState<SubheadRow | null>(null);
  const [account, setAccount] = useState<AccountRow | null>(null);
  const [voucher, setVoucher] = useState<VoucherRow | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingVoucher, setGeneratingVoucher] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadFinanceRequest = useCallback(async () => {
    if (!requestId) return;

    setLoading(true);
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const user = authData.user;

      if (authError || !user) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      setUserId(user.id);

      const { data: requestData, error: requestError } = await supabase
        .from("requests")
        .select(
          "id,request_no,title,description,amount,status,current_stage,current_owner,assigned_account_officer_id,assigned_account_officer_name,subhead_id,created_at"
        )
        .eq("id", requestId)
        .eq("assigned_account_officer_id", user.id)
        .maybeSingle();

      if (requestError) throw requestError;

      if (!requestData) {
        throw new Error(
          "This finance request is not assigned to your AccountOfficer profile."
        );
      }

      const loadedRequest = requestData as FinanceRequest;
      setRequest(loadedRequest);

      let loadedSubhead: SubheadRow | null = null;
      let loadedAccount: AccountRow | null = null;

      if (loadedRequest.subhead_id) {
        const { data: subheadData, error: subheadError } = await supabase
          .from("subheads")
          .select("*")
          .eq("id", loadedRequest.subhead_id)
          .maybeSingle();

        if (subheadError) throw subheadError;

        loadedSubhead = (subheadData || null) as SubheadRow | null;
        setSubhead(loadedSubhead);

        const accountId =
          loadedSubhead?.bank_account_id || loadedSubhead?.account_id || null;

        if (accountId) {
          const { data: accountData, error: accountError } = await supabase
            .from("iet_accounts")
            .select("*")
            .eq("id", accountId)
            .maybeSingle();

          if (accountError) throw accountError;

          loadedAccount = (accountData || null) as AccountRow | null;
          setAccount(loadedAccount);
        } else {
          setAccount(null);
        }
      } else {
        setSubhead(null);
        setAccount(null);
      }

      const { data: voucherData, error: voucherError } = await supabase
        .from("payment_vouchers")
        .select("*")
        .eq("request_id", loadedRequest.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (voucherError) throw voucherError;

      setVoucher((voucherData || null) as VoucherRow | null);
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Unable to load this finance request.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadFinanceRequest();
  }, [loadFinanceRequest]);

  const linkedAccountId = useMemo(() => {
    return subhead?.bank_account_id || subhead?.account_id || null;
  }, [subhead]);

  const approvedAllocation = Number(subhead?.approved_allocation || 0);
  const reservedAmount = Number(subhead?.reserved_amount || 0);
  const expenditure = Number(subhead?.expenditure || 0);

  const availableBalance = useMemo(() => {
    if (subhead?.balance !== null && subhead?.balance !== undefined) {
      return Number(subhead.balance || 0);
    }

    return approvedAllocation - reservedAmount - expenditure;
  }, [
    approvedAllocation,
    expenditure,
    reservedAmount,
    subhead?.balance,
  ]);

  async function generatePaymentVoucher() {
    if (!request || !userId) return;

    setGeneratingVoucher(true);
    setError(null);
    setSuccess(null);

    try {
      if (voucher) {
        setSuccess(
          `Payment Voucher ${getVoucherNumber(voucher) || ""} already exists for this request.`
        );
        return;
      }

      if (!request.subhead_id) {
        throw new Error(
          "This request has no linked subhead. A Payment Voucher cannot be generated."
        );
      }

      if (!linkedAccountId) {
        throw new Error(
          "The selected subhead has no linked IET bank account. Please link an account first."
        );
      }

      const voucherPayload = {
        request_id: request.id,
        account_id: linkedAccountId,
        amount: Number(request.amount || 0),
        status: "Draft",
        created_by: userId,
      };

      const { data: createdVoucher, error: createError } = await supabase
        .from("payment_vouchers")
        .insert(voucherPayload)
        .select("*")
        .single();

      if (createError) throw createError;

      const newVoucher = createdVoucher as VoucherRow;
      setVoucher(newVoucher);

      setSuccess(
        `Payment Voucher ${getVoucherNumber(newVoucher) || ""
        } generated successfully.`
      );
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Unable to generate the Payment Voucher.";

      setError(message);
    } finally {
      setGeneratingVoucher(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="animate-pulse space-y-5">
          <div className="h-6 w-44 rounded bg-slate-200" />
          <div className="h-52 rounded-3xl bg-slate-200" />
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="h-80 rounded-3xl bg-slate-200" />
            <div className="h-80 rounded-3xl bg-slate-200" />
          </div>
        </div>
      </main>
    );
  }

  if (error && !request) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <section className="rounded-3xl border border-red-200 bg-red-50 p-7 shadow-sm">
          <h1 className="text-2xl font-black text-red-950">
            Unable to open finance request
          </h1>

          <p className="mt-3 font-semibold leading-7 text-red-800">
            {error}
          </p>

          <Link
            href="/finance"
            className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
          >
            Return to Finance
          </Link>
        </section>
      </main>
    );
  }

  if (!request) return null;

  const voucherNumber = getVoucherNumber(voucher);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/finance"
          className="text-sm font-black text-blue-700 hover:underline"
        >
          ← Finance Dashboard
        </Link>

        <button
          type="button"
          onClick={loadFinanceRequest}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-800 transition hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
              Finance Request Workspace
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              {request.request_no || "Request"}
            </h1>

            <p className="mt-3 max-w-3xl text-lg font-bold text-slate-300">
              {request.title || "Untitled request"}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-4 sm:text-right">
            <div className="text-xs font-black uppercase tracking-wide text-emerald-300">
              Approved Amount
            </div>

            <div className="mt-1 text-2xl font-black text-white sm:text-3xl">
              {money(request.amount)}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-800">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 font-semibold text-emerald-800">
          {success}
        </div>
      )}

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm sm:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
              Section 1
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-950">
              Request Summary
            </h2>
          </div>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <InformationBox
              label="Request Number"
              value={request.request_no || "Not available"}
            />

            <InformationBox
              label="Status"
              value={request.status || "Pending Payment"}
              valueClassName="text-blue-800"
            />

            <InformationBox
              label="Current Stage"
              value={request.current_stage || "Account"}
            />

            <InformationBox
              label="Assigned AccountOfficer"
              value={
                request.assigned_account_officer_name || "Not available"
              }
            />

            <InformationBox
              label="Date Created"
              value={readableDate(request.created_at)}
            />

            <InformationBox
              label="Amount"
              value={money(request.amount)}
              valueClassName="text-emerald-800"
            />

            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2">
              <dt className="text-xs font-black uppercase tracking-wide text-slate-500">
                Purpose / Description
              </dt>

              <dd className="mt-2 whitespace-pre-wrap font-semibold leading-7 text-slate-700">
                {request.description || "No description supplied."}
              </dd>
            </div>
          </dl>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm sm:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">
              Section 2
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-950">
              Budget and Account Information
            </h2>
          </div>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <InformationBox
              label="Subhead"
              value={getSubheadName(subhead)}
            />

            <InformationBox
              label="Linked IET Account"
              value={getAccountName(account)}
            />

            <InformationBox
              label="Approved Allocation"
              value={money(approvedAllocation)}
              valueClassName="text-blue-800"
            />

            <InformationBox
              label="Reserved Amount"
              value={money(reservedAmount)}
              valueClassName="text-amber-800"
            />

            <InformationBox
              label="Expenditure"
              value={money(expenditure)}
              valueClassName="text-red-800"
            />

            <InformationBox
              label="Available Balance"
              value={money(availableBalance)}
              valueClassName={
                availableBalance >= Number(request.amount || 0)
                  ? "text-emerald-800"
                  : "text-red-800"
              }
            />

            <InformationBox
              label="Bank Name"
              value={account?.bank_name || "Not available"}
            />

            <InformationBox
              label="Account Number"
              value={account?.account_number || "Not available"}
            />
          </dl>

          {availableBalance < Number(request.amount || 0) && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-800">
              Warning: the available subhead balance appears lower than the
              request amount. Do not post payment until the allocation is
              confirmed.
            </div>
          )}
        </article>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
              Section 3
            </p>

            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Payment Voucher
            </h2>

            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
              Generate one draft Payment Voucher for this approved request.
              The official voucher number is created automatically by ReqGen.
            </p>
          </div>

          {voucher ? (
            <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">
              Voucher Generated
            </span>
          ) : (
            <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800">
              Voucher Not Generated
            </span>
          )}
        </div>

        {voucher ? (
          <div className="mt-6 grid gap-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:grid-cols-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                Voucher Number
              </p>

              <p className="mt-2 text-xl font-black text-emerald-950">
                {voucherNumber || "Generated"}
              </p>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                Amount
              </p>

              <p className="mt-2 text-xl font-black text-emerald-950">
                {money(voucher.amount ?? request.amount)}
              </p>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                Status
              </p>

              <p className="mt-2 text-xl font-black text-emerald-950">
                {voucher.status || "Draft"}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <p className="font-bold text-slate-700">
              No Payment Voucher has been generated for this request.
            </p>

            <button
              type="button"
              onClick={generatePaymentVoucher}
              disabled={
                generatingVoucher ||
                !request.subhead_id ||
                !linkedAccountId
              }
              className="mt-5 inline-flex rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {generatingVoucher
                ? "Generating Voucher…"
                : "Generate Payment Voucher"}
            </button>

            {!request.subhead_id && (
              <p className="mt-3 text-sm font-bold text-red-700">
                This request has no linked subhead.
              </p>
            )}

            {request.subhead_id && !linkedAccountId && (
              <p className="mt-3 text-sm font-bold text-red-700">
                The linked subhead has no IET bank account.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-blue-200 bg-blue-50 p-5 sm:p-6">
        <h2 className="font-black text-blue-950">Next Sprint</h2>

        <p className="mt-2 text-sm font-semibold leading-6 text-blue-800">
          Payment method, reference number, narration, evidence upload and
          final payment posting will be added after voucher generation is
          successfully tested.
        </p>
      </section>
    </main>
  );
}