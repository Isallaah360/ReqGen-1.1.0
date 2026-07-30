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
  voucher_no: string | null;
  request_id: string | null;
  request_no: string | null;
  narration: string | null;
  amount: number | string | null;
  subhead_id: string | null;
  subhead_code: string | null;
  subhead_name: string | null;
  prepared_by: string | null;
  prepared_by_name: string | null;
  status: string | null;
  bank_account_id: string | null;
  bank_account_name: string | null;
  account_id: string | null;
  payment_method: string | null;
  disbursement_mode: string | null;
  payment_reference: string | null;
  payment_date: string | null;
  created_at: string | null;
  posted_by: string | null;
  posted_at: string | null;
  updated_at: string | null;
};

type PostPaymentResult = {
  success?: boolean;
  message?: string;
  transaction_no?: string;
  balance_after?: number;
};

const PAYMENT_METHODS = ["Bank Transfer", "Cash", "Cheque", "POS"] as const;

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

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function todayInputValue() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset();

  return new Date(now.getTime() - timezoneOffset * 60_000)
    .toISOString()
    .slice(0, 10);
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

function getSubheadCode(subhead: SubheadRow | null) {
  if (!subhead) return null;

  return subhead.subhead_code || subhead.code || null;
}

function getAccountName(account: AccountRow | null) {
  if (!account) return "Not linked";

  return (
    account.account_name ||
    account.name ||
    account.bank_name ||
    "Linked IET account"
  );
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
      <dt className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className={`mt-2 break-words font-black ${valueClassName}`}>
        {value}
      </dd>
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
  const [savingDraft, setSavingDraft] = useState(false);
  const [postingPayment, setPostingPayment] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayInputValue());
  const [paymentReference, setPaymentReference] = useState("");
  const [narration, setNarration] = useState("");
  const [hardcopyConfirmed, setHardcopyConfirmed] = useState(true);
  const [confirmPost, setConfirmPost] = useState(false);
  const [postResult, setPostResult] = useState<PostPaymentResult | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadFinanceRequest = useCallback(async () => {
    if (!requestId) return;

    setLoading(true);
    setError(null);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

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

      if (loadedRequest.subhead_id) {
        const { data: subheadData, error: subheadError } = await supabase
          .from("subheads")
          .select("*")
          .eq("id", loadedRequest.subhead_id)
          .maybeSingle();

        if (subheadError) throw subheadError;

        const loadedSubhead = (subheadData || null) as SubheadRow | null;
        setSubhead(loadedSubhead);

        const linkedAccountId =
          loadedSubhead?.bank_account_id ||
          loadedSubhead?.account_id ||
          null;

        if (linkedAccountId) {
          const { data: accountData, error: accountError } = await supabase
            .from("iet_accounts")
            .select("*")
            .eq("id", linkedAccountId)
            .maybeSingle();

          if (accountError) throw accountError;

          setAccount((accountData || null) as AccountRow | null);
        } else {
          setAccount(null);
        }
      } else {
        setSubhead(null);
        setAccount(null);
      }

      const { data: voucherData, error: voucherError } = await supabase
        .from("payment_vouchers")
        .select(
          "id,voucher_no,request_id,request_no,narration,amount,subhead_id,subhead_code,subhead_name,prepared_by,prepared_by_name,status,bank_account_id,bank_account_name,account_id,payment_method,disbursement_mode,payment_reference,payment_date,posted_by,posted_at,created_at,updated_at"
        )
        .eq("request_id", loadedRequest.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (voucherError) throw voucherError;

      const loadedVoucher = (voucherData || null) as VoucherRow | null;
      setVoucher(loadedVoucher);

      if (loadedVoucher) {
        setPaymentMethod(
          loadedVoucher.payment_method ||
          loadedVoucher.disbursement_mode ||
          ""
        );
        setPaymentDate(
          loadedVoucher.payment_date || todayInputValue()
        );
        setPaymentReference(
          loadedVoucher.payment_reference || ""
        );
        setNarration(
          loadedVoucher.narration ||
          loadedRequest.description ||
          ""
        );
      } else {
        setPaymentMethod("");
        setPaymentDate(todayInputValue());
        setPaymentReference("");
        setNarration(loadedRequest.description || "");
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load this finance request."
      );
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadFinanceRequest();
  }, [loadFinanceRequest]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadFinanceRequest();
    }, 30_000);

    const channel = supabase
      .channel(`finance-request-${requestId || "unknown"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "requests",
          filter: requestId ? `id=eq.${requestId}` : undefined,
        },
        () => loadFinanceRequest()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payment_vouchers",
          filter: requestId ? `request_id=eq.${requestId}` : undefined,
        },
        () => loadFinanceRequest()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "finance_transactions",
          filter: requestId ? `request_id=eq.${requestId}` : undefined,
        },
        () => loadFinanceRequest()
      )
      .subscribe();

    return () => {
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [loadFinanceRequest, requestId]);

  const linkedAccountId = useMemo(() => {
    return subhead?.bank_account_id || subhead?.account_id || null;
  }, [subhead]);

  const approvedAllocation = Number(
    subhead?.approved_allocation || 0
  );
  const reservedAmount = Number(subhead?.reserved_amount || 0);
  const expenditure = Number(subhead?.expenditure || 0);

  const availableBalance = useMemo(() => {
    if (
      subhead?.balance !== null &&
      subhead?.balance !== undefined
    ) {
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
          `Payment Voucher ${voucher.voucher_no || ""
          } already exists for this request.`
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
        request_no: request.request_no,
        narration:
          narration.trim() ||
          request.description ||
          request.title,
        amount: Number(request.amount || 0),
        subhead_id: request.subhead_id,
        subhead_code: getSubheadCode(subhead),
        subhead_name: getSubheadName(subhead),
        prepared_by: userId,
        prepared_by_name:
          request.assigned_account_officer_name ||
          "AccountOfficer",
        status: "Prepared",
        bank_account_id: linkedAccountId,
        bank_account_name: getAccountName(account),
        account_id: linkedAccountId,
      };

      const { data: createdVoucher, error: createError } =
        await supabase
          .from("payment_vouchers")
          .insert(voucherPayload)
          .select(
            "id,voucher_no,request_id,request_no,narration,amount,subhead_id,subhead_code,subhead_name,prepared_by,prepared_by_name,status,bank_account_id,bank_account_name,account_id,payment_method,disbursement_mode,payment_reference,payment_date,posted_by,posted_at,created_at,updated_at"
          )
          .single();

      if (createError) throw createError;

      const newVoucher = createdVoucher as VoucherRow;

      setVoucher(newVoucher);
      setSuccess(
        `Payment Voucher ${newVoucher.voucher_no || ""
        } generated successfully.`
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to generate the Payment Voucher."
      );
    } finally {
      setGeneratingVoucher(false);
    }
  }

  async function savePaymentDraft() {
    if (!voucher || !request) {
      setError(
        "Generate the Payment Voucher before saving payment details."
      );
      return;
    }

    if (!paymentMethod) {
      setError("Please select a payment method.");
      return;
    }

    if (!paymentDate) {
      setError("Please select the payment date.");
      return;
    }

    if (!narration.trim()) {
      setError("Please enter a short payment narration.");
      return;
    }

    setSavingDraft(true);
    setError(null);
    setSuccess(null);

    try {
      const hardcopyNote =
        "Original payment receipt retained in the Finance Department and available on request.";

      const finalNarration = hardcopyConfirmed
        ? narration.includes(hardcopyNote)
          ? narration.trim()
          : `${narration.trim()}\n\n${hardcopyNote}`
        : narration.trim();

      const { data: updatedVoucher, error: updateError } =
        await supabase
          .from("payment_vouchers")
          .update({
            payment_method: paymentMethod,
            disbursement_mode: paymentMethod,
            payment_date: paymentDate,
            payment_reference:
              paymentReference.trim() || null,
            narration: finalNarration,
            status: "Prepared",
          })
          .eq("id", voucher.id)
          .eq("request_id", request.id)
          .select(
            "id,voucher_no,request_id,request_no,narration,amount,subhead_id,subhead_code,subhead_name,prepared_by,prepared_by_name,status,bank_account_id,bank_account_name,account_id,payment_method,disbursement_mode,payment_reference,payment_date,posted_by,posted_at,created_at,updated_at"
          )
          .single();

      if (updateError) throw updateError;

      const savedVoucher = updatedVoucher as VoucherRow;

      setVoucher(savedVoucher);
      setNarration(
        savedVoucher.narration || finalNarration
      );
      setSuccess(
        `Payment details saved for Voucher ${savedVoucher.voucher_no || ""
        }.`
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save the payment details."
      );
    } finally {
      setSavingDraft(false);
    }
  }


  const isPosted =
    voucher?.status?.toLowerCase() === "posted" ||
    request?.status?.toLowerCase() === "paid";

  const paymentDetailsReady =
    Boolean(voucher) &&
    Boolean(paymentMethod) &&
    Boolean(paymentDate) &&
    Boolean(narration.trim());

  async function postPayment() {
    if (!voucher || !request) {
      setError("Generate and save the Payment Voucher before posting.");
      return;
    }

    if (isPosted) {
      setError("This payment has already been posted.");
      return;
    }

    if (!paymentDetailsReady) {
      setError(
        "Complete and save the payment method, payment date and narration before posting."
      );
      return;
    }

    if (!confirmPost) {
      setError(
        "Please confirm that you understand this action will post the payment permanently."
      );
      return;
    }

    setPostingPayment(true);
    setError(null);
    setSuccess(null);
    setPostResult(null);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "post_finance_payment",
        { p_voucher_id: voucher.id }
      );

      if (rpcError) throw rpcError;

      const result = (data || {}) as PostPaymentResult;
      setPostResult(result);
      setSuccess(
        result.message ||
        `Payment posted successfully for Voucher ${voucher.voucher_no || ""}.`
      );
      setConfirmPost(false);
      await loadFinanceRequest();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to post the payment."
      );
    } finally {
      setPostingPayment(false);
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
            className="mt-5 inline-flex bg-slate-950 px-4 py-3 text-sm text-white font-black rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Return to Finance
          </Link>
        </section>
      </main>
    );
  }

  if (!request) return null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-6 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <Link
              href="/finance"
              className="inline-flex items-center bg-blue-700 px-4 py-2.5 text-sm text-white hover:bg-blue-800 font-black rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              ← Finance Dashboard
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center bg-slate-950 px-4 py-2.5 text-sm text-white hover:bg-slate-800 font-black rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Main Dashboard
            </Link>

            <Link
              href="/requests"
              className="inline-flex items-center border border-violet-200 bg-violet-700 px-4 py-2.5 text-sm hover:bg-violet-800 font-black text-white rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              All Requests
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">
              Auto-refresh: 30 seconds
            </span>

            <button
              type="button"
              onClick={loadFinanceRequest}
              className="border border-cyan-200 bg-cyan-700 px-4 py-2.5 text-sm hover:bg-cyan-800 font-black text-white rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refresh Now
            </button>
          </div>
        </div>
      </nav>

      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-gradient-to-br from-slate-950 via-blue-950 to-violet-950 p-6 text-white shadow-xl sm:p-8">
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

          <div className="rounded-2xl border border-emerald-300/40 bg-emerald-300/10 px-5 py-4 shadow-lg backdrop-blur sm:text-right">
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
        <article className="rounded-3xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
            Section 1
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            Request Summary
          </h2>

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
                request.assigned_account_officer_name ||
                "Not available"
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
                {request.description ||
                  "No description supplied."}
              </dd>
            </div>
          </dl>
        </article>

        <article className="rounded-3xl border border-violet-100 bg-gradient-to-br from-white to-violet-50 p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">
            Section 2
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            Budget and Account Information
          </h2>

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
                availableBalance >=
                  Number(request.amount || 0)
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
              value={
                account?.account_number || "Not available"
              }
            />
          </dl>

          {availableBalance <
            Number(request.amount || 0) && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-800">
                Warning: the available subhead balance appears lower
                than the request amount. Do not post payment until the
                allocation is confirmed.
              </div>
            )}
        </article>
      </section>

      <section className="mt-6 rounded-3xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 p-5 shadow-sm sm:p-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
              Section 3
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Payment Voucher
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
              Generate one Payment Voucher for this approved request.
              ReqGen creates the official voucher number
              automatically.
            </p>
          </div>

          <span
            className={`w-fit rounded-full border px-3 py-1.5 text-xs font-black ${voucher
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
          >
            {voucher
              ? "Voucher Generated"
              : "Voucher Not Generated"}
          </span>
        </div>

        {voucher ? (
          <div className="mt-6 grid gap-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:grid-cols-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                Voucher Number
              </p>
              <p className="mt-2 text-xl font-black text-emerald-950">
                {voucher.voucher_no || "Generated"}
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
                {voucher.status || "Prepared"}
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
              className="mt-5 inline-flex bg-emerald-700 px-5 py-3 text-sm text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-400 font-black rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60"
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

      <section className="mt-6 rounded-3xl border border-cyan-100 bg-gradient-to-br from-white to-cyan-50 p-5 shadow-sm sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
          Section 4
        </p>
        <h2 className="mt-1 text-2xl font-black text-slate-950">
          Payment Details
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
          Evidence upload is not required. Original hardcopy receipts
          remain with the Finance Department and can be produced when
          requested.
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-black text-slate-800">
              Payment Method
            </span>
            <select
              value={paymentMethod}
              onChange={(event) =>
                setPaymentMethod(event.target.value)
              }
              disabled={!voucher || isPosted}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-100"
            >
              <option value="">Select payment method</option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-black text-slate-800">
              Payment Date
            </span>
            <input
              type="date"
              value={paymentDate}
              onChange={(event) =>
                setPaymentDate(event.target.value)
              }
              disabled={!voucher || isPosted}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-100"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-sm font-black text-slate-800">
              Payment Reference
            </span>
            <input
              type="text"
              value={paymentReference}
              onChange={(event) =>
                setPaymentReference(event.target.value)
              }
              disabled={!voucher || isPosted}
              placeholder="Transfer reference, cheque number or POS reference — optional"
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-100"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-sm font-black text-slate-800">
              Narration
            </span>
            <textarea
              value={narration}
              onChange={(event) =>
                setNarration(event.target.value)
              }
              disabled={!voucher || isPosted}
              rows={5}
              placeholder="Briefly describe the payment."
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold leading-6 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-100"
            />
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
            <input
              type="checkbox"
              checked={hardcopyConfirmed}
              onChange={(event) =>
                setHardcopyConfirmed(event.target.checked)
              }
              disabled={!voucher || isPosted}
              className="mt-1 h-4 w-4"
            />
            <span className="text-sm font-semibold leading-6 text-slate-700">
              Confirm that the original hardcopy receipt will be
              retained by the Finance Department and made available
              on request.
            </span>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={savePaymentDraft}
            disabled={!voucher || savingDraft || isPosted}
            className="bg-blue-700 px-5 py-3 text-sm text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400 font-black rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {savingDraft
              ? "Saving Draft…"
              : "Save Payment Draft"}
          </button>

          {!voucher && (
            <p className="text-sm font-bold text-amber-700">
              Generate the Payment Voucher before entering payment
              details.
            </p>
          )}
        </div>
      </section>

      {postResult?.transaction_no && (
        <section className="mt-6 rounded-3xl border border-blue-200 bg-blue-50 p-5 sm:p-6">
          <h2 className="font-black text-blue-950">
            Transaction Posted
          </h2>
          <p className="mt-2 text-sm font-semibold text-blue-800">
            Transaction No: {postResult.transaction_no}
          </p>
          <p className="mt-1 text-sm font-semibold text-blue-800">
            New Account Balance: {money(postResult.balance_after)}
          </p>
        </section>
      )}

      <section className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-red-700">
          Section 5
        </p>
        <h2 className="mt-1 text-2xl font-black text-red-950">
          Final Payment Posting
        </h2>

        {isPosted ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="font-black text-emerald-950">
              This payment has been posted successfully.
            </p>
            <p className="mt-2 text-sm font-semibold text-emerald-800">
              Voucher: {voucher?.voucher_no || "Not available"}
            </p>
            <p className="mt-1 text-sm font-semibold text-emerald-800">
              Posted: {readableDate(voucher?.posted_at)}
            </p>
          </div>
        ) : (
          <>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-red-800">
              This action is permanent. It will create the finance transaction,
              update the IET account and subhead balances, mark the voucher as
              Posted, and mark the request as Paid.
            </p>

            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-white p-4">
              <input
                type="checkbox"
                checked={confirmPost}
                onChange={(event) => setConfirmPost(event.target.checked)}
                disabled={!paymentDetailsReady}
                className="mt-1 h-4 w-4"
              />
              <span className="text-sm font-semibold leading-6 text-slate-700">
                I have reviewed the voucher and payment details and confirm that
                this payment is ready to be posted permanently.
              </span>
            </label>

            <button
              type="button"
              onClick={postPayment}
              disabled={!paymentDetailsReady || !confirmPost || postingPayment}
              className="mt-5 bg-red-700 px-5 py-3 text-sm text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-400 font-black rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {postingPayment
                ? "Posting Payment…"
                : "Post Payment Permanently"}
            </button>

            {!paymentDetailsReady && (
              <p className="mt-3 text-sm font-bold text-red-800">
                Complete and save the payment details before posting.
              </p>
            )}
          </>
        )}
      </section>
      <footer className="mt-8 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-600">
            ReqGen Finance Workspace • Data refreshes automatically every 30 seconds.
          </p>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/finance"
              className="bg-blue-700 px-4 py-2.5 text-sm text-white hover:bg-blue-800 font-black rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Finance Home
            </Link>

            <Link
              href="/dashboard"
              className="bg-slate-950 px-4 py-2.5 text-sm text-white hover:bg-slate-800 font-black rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Main Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
