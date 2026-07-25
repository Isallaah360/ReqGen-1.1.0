"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ProfileRole = {
    role_key: string;
    is_active: boolean;
};

type AccountRow = {
    id: string;
    name: string | null;
    bank_name: string | null;
    account_number: string | null;
    available_balance: number | string | null;
    balance: number | string | null;
};

type SubheadRow = {
    id: string;
    name: string | null;
    title: string | null;
    subhead_name: string | null;
    code: string | null;
    subhead_code: string | null;
    account_id: string | null;
    bank_account_id: string | null;
    balance: number | string | null;
};

type ManualVoucherRow = {
    id: string;
    voucher_no: string | null;
    account_id: string | null;
    subhead_id: string | null;
    payee_name: string | null;
    narration: string | null;
    amount: number | string | null;
    total_amount: number | string | null;
    payment_method: string | null;
    payment_reference: string | null;
    payment_date: string | null;
    prepared_by_name: string | null;
    status: string | null;
    posted_at: string | null;
    created_at: string | null;
};

type SaveResult = {
    success: boolean;
    voucher_id: string;
    voucher_no: string;
    status: string;
};

type PostResult = {
    success: boolean;
    voucher_id: string;
    voucher_no: string;
    transaction_no: string;
    account_balance: number;
    subhead_balance: number;
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

function todayInput() {
    const now = new Date();
    const offset = now.getTimezoneOffset();

    return new Date(now.getTime() - offset * 60_000)
        .toISOString()
        .slice(0, 10);
}

function subheadLabel(subhead: SubheadRow) {
    return (
        subhead.subhead_name ||
        subhead.name ||
        subhead.title ||
        subhead.subhead_code ||
        subhead.code ||
        "Unnamed subhead"
    );
}

function accountLabel(account: AccountRow) {
    return account.name || account.bank_name || "Unnamed IET account";
}

function readableDate(value: string | null | undefined) {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Not available";

    return date.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function statusClasses(statusValue: string | null | undefined) {
    const status = (statusValue || "").toLowerCase();

    if (status.includes("posted") || status.includes("paid")) {
        return "border-emerald-200 bg-emerald-50 text-emerald-800";
    }

    if (status.includes("cancel") || status.includes("reverse")) {
        return "border-red-200 bg-red-50 text-red-800";
    }

    return "border-amber-200 bg-amber-50 text-amber-800";
}

export default function ManualVoucherPage() {
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [saving, setSaving] = useState(false);
    const [posting, setPosting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [accounts, setAccounts] = useState<AccountRow[]>([]);
    const [subheads, setSubheads] = useState<SubheadRow[]>([]);
    const [manualVouchers, setManualVouchers] = useState<ManualVoucherRow[]>([]);

    const [voucherId, setVoucherId] = useState<string | null>(null);
    const [voucherNo, setVoucherNo] = useState<string | null>(null);
    const [accountId, setAccountId] = useState("");
    const [subheadId, setSubheadId] = useState("");
    const [payeeName, setPayeeName] = useState("");
    const [narration, setNarration] = useState("");
    const [amount, setAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
    const [paymentReference, setPaymentReference] = useState("");
    const [paymentDate, setPaymentDate] = useState(todayInput());
    const [confirmPosting, setConfirmPosting] = useState(false);

    const loadPage = useCallback(async (manual = false) => {
        manual ? setRefreshing(true) : setLoading(true);
        setError(null);

        try {
            const { data: authData, error: authError } = await supabase.auth.getUser();
            const user = authData.user;

            if (authError || !user) {
                throw new Error("Your session has expired. Please sign in again.");
            }

            const [profileResult, rolesResult] = await Promise.all([
                supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
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
                return;
            }

            const [accountResult, subheadResult, voucherResult] = await Promise.all([
                supabase
                    .from("iet_accounts")
                    .select(
                        "id,name,bank_name,account_number,available_balance,balance"
                    )
                    .order("name", { ascending: true }),
                supabase
                    .from("subheads")
                    .select(
                        "id,name,title,subhead_name,code,subhead_code,account_id,bank_account_id,balance"
                    )
                    .order("name", { ascending: true }),
                supabase
                    .from("payment_vouchers")
                    .select(
                        "id,voucher_no,account_id,subhead_id,payee_name,narration,amount,total_amount,payment_method,payment_reference,payment_date,prepared_by_name,status,posted_at,created_at"
                    )
                    .eq("voucher_type", "Manual")
                    .order("created_at", { ascending: false })
                    .limit(50),
            ]);

            if (accountResult.error) throw accountResult.error;
            if (subheadResult.error) throw subheadResult.error;
            if (voucherResult.error) throw voucherResult.error;

            setAccounts((accountResult.data || []) as AccountRow[]);
            setSubheads((subheadResult.data || []) as SubheadRow[]);
            setManualVouchers((voucherResult.data || []) as ManualVoucherRow[]);
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Unable to load the Manual Voucher Centre."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadPage();
    }, [loadPage]);

    useEffect(() => {
        const channel = supabase
            .channel("manual-voucher-centre-live")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "payment_vouchers" },
                () => loadPage(true)
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "finance_transactions" },
                () => loadPage(true)
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadPage]);

    const selectedAccount = useMemo(
        () => accounts.find((item) => item.id === accountId),
        [accountId, accounts]
    );

    const availableSubheads = useMemo(
        () =>
            subheads.filter(
                (item) =>
                    !accountId ||
                    item.account_id === accountId ||
                    item.bank_account_id === accountId ||
                    (!item.account_id && !item.bank_account_id)
            ),
        [accountId, subheads]
    );

    const selectedSubhead = useMemo(
        () => subheads.find((item) => item.id === subheadId),
        [subheadId, subheads]
    );

    function clearForm() {
        setVoucherId(null);
        setVoucherNo(null);
        setAccountId("");
        setSubheadId("");
        setPayeeName("");
        setNarration("");
        setAmount("");
        setPaymentMethod("Bank Transfer");
        setPaymentReference("");
        setPaymentDate(todayInput());
        setConfirmPosting(false);
        setError(null);
        setSuccess(null);
    }

    function openDraft(voucher: ManualVoucherRow) {
        const status = (voucher.status || "").toLowerCase();

        if (status.includes("posted") || status.includes("paid")) {
            setError("Posted vouchers are read-only and cannot be edited.");
            return;
        }

        setVoucherId(voucher.id);
        setVoucherNo(voucher.voucher_no);
        setAccountId(voucher.account_id || "");
        setSubheadId(voucher.subhead_id || "");
        setPayeeName(voucher.payee_name || "");
        setNarration(voucher.narration || "");
        setAmount(String(voucher.total_amount || voucher.amount || ""));
        setPaymentMethod(voucher.payment_method || "Bank Transfer");
        setPaymentReference(voucher.payment_reference || "");
        setPaymentDate(voucher.payment_date || todayInput());
        setConfirmPosting(false);
        setError(null);
        setSuccess(`Draft ${voucher.voucher_no || ""} loaded for editing.`);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    async function saveDraft(event?: FormEvent) {
        event?.preventDefault();
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const numericAmount = Number(amount);

            if (!accountId) throw new Error("Select an IET account.");
            if (!subheadId) throw new Error("Select a subhead.");
            if (!payeeName.trim()) throw new Error("Enter the payee or beneficiary.");
            if (!narration.trim()) throw new Error("Enter the payment narration.");
            if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
                throw new Error("Enter a valid amount greater than zero.");
            }

            const { data, error: rpcError } = await supabase.rpc(
                "save_manual_payment_voucher",
                {
                    p_voucher_id: voucherId,
                    p_account_id: accountId,
                    p_subhead_id: subheadId,
                    p_payee_name: payeeName.trim(),
                    p_narration: narration.trim(),
                    p_amount: numericAmount,
                    p_payment_method: paymentMethod,
                    p_payment_reference: paymentReference.trim() || null,
                    p_payment_date: paymentDate,
                }
            );

            if (rpcError) throw rpcError;

            const result = data as SaveResult;
            setVoucherId(result.voucher_id);
            setVoucherNo(result.voucher_no);
            setSuccess(`Draft ${result.voucher_no} saved successfully.`);
            await loadPage(true);

            return result;
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Unable to save the manual voucher."
            );
            return null;
        } finally {
            setSaving(false);
        }
    }

    async function postVoucher() {
        setPosting(true);
        setError(null);
        setSuccess(null);

        try {
            if (!confirmPosting) {
                throw new Error(
                    "Confirm that the voucher details and supporting physical documents have been verified."
                );
            }

            let activeVoucherId = voucherId;

            if (!activeVoucherId) {
                const saveResult = await saveDraft();
                activeVoucherId = saveResult?.voucher_id || null;
            }

            if (!activeVoucherId) {
                throw new Error("The voucher must be saved before posting.");
            }

            const { data, error: rpcError } = await supabase.rpc(
                "post_manual_payment_voucher",
                {
                    p_voucher_id: activeVoucherId,
                }
            );

            if (rpcError) throw rpcError;

            const result = data as PostResult;

            setSuccess(
                `${result.voucher_no} posted successfully as ${result.transaction_no}. Updated account balance: ${money(
                    result.account_balance
                )}; subhead balance: ${money(result.subhead_balance)}.`
            );

            await loadPage(true);
            clearForm();
            setSuccess(
                `${result.voucher_no} posted successfully as ${result.transaction_no}.`
            );
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Unable to post the manual voucher."
            );
        } finally {
            setPosting(false);
        }
    }

    if (loading) {
        return (
            <main className="mx-auto max-w-7xl px-4 py-8">
                <div className="animate-pulse space-y-6">
                    <div className="h-32 rounded-3xl bg-slate-200" />
                    <div className="h-96 rounded-3xl bg-slate-200" />
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
                        Your active roles do not permit access to the Manual Voucher
                        Centre.
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
                        href="/finance"
                        className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-800"
                    >
                        ← Finance Dashboard
                    </Link>
                    <Link
                        href="/finance/vouchers"
                        className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-violet-800"
                    >
                        Vouchers Register
                    </Link>
                    <Link
                        href="/finance/transactions"
                        className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-800"
                    >
                        Transactions Register
                    </Link>
                </div>

                <button
                    type="button"
                    onClick={() => loadPage(true)}
                    disabled={refreshing}
                    className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-black text-cyan-800 transition hover:bg-cyan-100 disabled:opacity-60"
                >
                    {refreshing ? "Refreshing…" : "Refresh Centre"}
                </button>
            </nav>

            <section className="overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-slate-950 via-amber-950 to-violet-950 p-6 text-white shadow-xl sm:p-8">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
                    Phase 2C • Manual Voucher Saga
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                    Manual Voucher Centre
                </h1>
                <p className="mt-3 max-w-3xl font-semibold leading-7 text-slate-300">
                    Create direct finance vouchers, save drafts, post approved payments
                    and update the same ledgers used by request-based payments.
                </p>
            </section>

            {error && (
                <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 font-semibold text-red-800">
                    {error}
                </div>
            )}

            {success && (
                <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-800">
                    {success}
                </div>
            )}

            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
                            {voucherId ? "Edit Manual Voucher" : "New Manual Voucher"}
                        </p>
                        <h2 className="mt-1 text-2xl font-black text-slate-950">
                            {voucherNo || "Voucher number generated on first save"}
                        </h2>
                    </div>

                    {voucherId && (
                        <button
                            type="button"
                            onClick={clearForm}
                            className="w-fit rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-black text-slate-700"
                        >
                            Start New Voucher
                        </button>
                    )}
                </div>

                <form onSubmit={saveDraft} className="mt-6 grid gap-5 lg:grid-cols-2">
                    <label>
                        <span className="text-sm font-black text-slate-800">
                            IET Account
                        </span>
                        <select
                            required
                            value={accountId}
                            onChange={(event) => {
                                setAccountId(event.target.value);
                                setSubheadId("");
                            }}
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none focus:border-amber-500"
                        >
                            <option value="">Select account</option>
                            {accounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                    {accountLabel(account)}
                                    {account.account_number
                                        ? ` • ${account.account_number}`
                                        : ""}
                                </option>
                            ))}
                        </select>
                        {selectedAccount && (
                            <p className="mt-2 text-xs font-bold text-emerald-700">
                                Available balance:{" "}
                                {money(
                                    selectedAccount.available_balance ??
                                    selectedAccount.balance
                                )}
                            </p>
                        )}
                    </label>

                    <label>
                        <span className="text-sm font-black text-slate-800">Subhead</span>
                        <select
                            required
                            value={subheadId}
                            onChange={(event) => setSubheadId(event.target.value)}
                            disabled={!accountId}
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none focus:border-amber-500 disabled:bg-slate-100"
                        >
                            <option value="">
                                {accountId ? "Select subhead" : "Select account first"}
                            </option>
                            {availableSubheads.map((subhead) => (
                                <option key={subhead.id} value={subhead.id}>
                                    {subheadLabel(subhead)}
                                </option>
                            ))}
                        </select>
                        {selectedSubhead && (
                            <p className="mt-2 text-xs font-bold text-violet-700">
                                Subhead balance: {money(selectedSubhead.balance)}
                            </p>
                        )}
                    </label>

                    <label>
                        <span className="text-sm font-black text-slate-800">
                            Payee / Beneficiary
                        </span>
                        <input
                            required
                            value={payeeName}
                            onChange={(event) => setPayeeName(event.target.value)}
                            placeholder="Person or organisation receiving payment"
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none focus:border-amber-500"
                        />
                    </label>

                    <label>
                        <span className="text-sm font-black text-slate-800">Amount</span>
                        <input
                            required
                            min="0.01"
                            step="0.01"
                            type="number"
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            placeholder="0.00"
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none focus:border-amber-500"
                        />
                    </label>

                    <label className="lg:col-span-2">
                        <span className="text-sm font-black text-slate-800">
                            Payment Narration
                        </span>
                        <textarea
                            required
                            rows={4}
                            value={narration}
                            onChange={(event) => setNarration(event.target.value)}
                            placeholder="Describe exactly what the payment is for"
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none focus:border-amber-500"
                        />
                    </label>

                    <label>
                        <span className="text-sm font-black text-slate-800">
                            Payment Method
                        </span>
                        <select
                            value={paymentMethod}
                            onChange={(event) => setPaymentMethod(event.target.value)}
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none focus:border-amber-500"
                        >
                            <option>Bank Transfer</option>
                            <option>Cheque</option>
                            <option>Cash</option>
                            <option>Direct Debit</option>
                            <option>Other</option>
                        </select>
                    </label>

                    <label>
                        <span className="text-sm font-black text-slate-800">
                            Payment Date
                        </span>
                        <input
                            required
                            type="date"
                            value={paymentDate}
                            onChange={(event) => setPaymentDate(event.target.value)}
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none focus:border-amber-500"
                        />
                    </label>

                    <label className="lg:col-span-2">
                        <span className="text-sm font-black text-slate-800">
                            Payment Reference
                        </span>
                        <input
                            value={paymentReference}
                            onChange={(event) => setPaymentReference(event.target.value)}
                            placeholder="Transfer reference, cheque number or supporting reference"
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none focus:border-amber-500"
                        />
                    </label>

                    <div className="lg:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <label className="flex items-start gap-3">
                            <input
                                type="checkbox"
                                checked={confirmPosting}
                                onChange={(event) => setConfirmPosting(event.target.checked)}
                                className="mt-1 h-5 w-5 rounded border-amber-400"
                            />
                            <span className="text-sm font-bold leading-6 text-amber-950">
                                I confirm that the voucher details are correct, the physical
                                supporting documents have been verified and this payment is
                                ready for final ledger posting.
                            </span>
                        </label>
                    </div>

                    <div className="flex flex-wrap gap-3 lg:col-span-2">
                        <button
                            type="submit"
                            disabled={saving || posting}
                            className="rounded-xl bg-violet-700 px-5 py-3 text-sm font-black text-white transition hover:bg-violet-800 disabled:opacity-60"
                        >
                            {saving ? "Saving Draft…" : voucherId ? "Update Draft" : "Save Draft"}
                        </button>

                        <button
                            type="button"
                            onClick={postVoucher}
                            disabled={saving || posting || !confirmPosting}
                            className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {posting ? "Posting Payment…" : "Final Post Payment"}
                        </button>
                    </div>
                </form>
            </section>

            <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
                    <div>
                        <h2 className="text-xl font-black text-slate-950">
                            Manual Voucher Records
                        </h2>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                            Recent drafts and posted manual vouchers.
                        </p>
                    </div>

                    <span className="w-fit rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800">
                        {manualVouchers.length} voucher
                        {manualVouchers.length === 1 ? "" : "s"}
                    </span>
                </div>

                {manualVouchers.length === 0 ? (
                    <div className="px-6 py-16 text-center">
                        <div className="text-lg font-black text-slate-900">
                            No manual voucher yet
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-500">
                            Your first saved manual voucher will appear here.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-[1050px] divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr className="text-left text-xs font-black uppercase tracking-wide text-slate-500">
                                    <th className="px-5 py-3 sm:px-6">Voucher</th>
                                    <th className="px-5 py-3">Payee</th>
                                    <th className="px-5 py-3">Narration</th>
                                    <th className="px-5 py-3">Date</th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3 text-right">Amount</th>
                                    <th className="px-5 py-3 text-right sm:px-6">Action</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100">
                                {manualVouchers.map((voucher) => {
                                    const posted =
                                        Boolean(voucher.posted_at) ||
                                        (voucher.status || "").toLowerCase().includes("posted") ||
                                        (voucher.status || "").toLowerCase().includes("paid");

                                    return (
                                        <tr key={voucher.id} className="align-top hover:bg-slate-50/80">
                                            <td className="px-5 py-5 sm:px-6">
                                                <div className="font-black text-amber-800">
                                                    {voucher.voucher_no || "Number pending"}
                                                </div>
                                                <div className="mt-1 text-xs font-bold text-slate-500">
                                                    {voucher.prepared_by_name || "Finance Officer"}
                                                </div>
                                            </td>

                                            <td className="px-5 py-5 font-semibold text-slate-800">
                                                {voucher.payee_name || "Not recorded"}
                                            </td>

                                            <td className="px-5 py-5">
                                                <div className="max-w-sm text-sm font-semibold leading-6 text-slate-700">
                                                    {voucher.narration || "No narration"}
                                                </div>
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-5 text-sm font-semibold text-slate-700">
                                                {readableDate(
                                                    voucher.payment_date || voucher.created_at
                                                )}
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-5">
                                                <span
                                                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClasses(
                                                        voucher.status
                                                    )}`}
                                                >
                                                    {voucher.status || "Prepared"}
                                                </span>
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-5 text-right text-base font-black text-emerald-800">
                                                {money(voucher.total_amount || voucher.amount)}
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-5 text-right sm:px-6">
                                                {posted ? (
                                                    <Link
                                                        href="/finance/vouchers"
                                                        className="inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white"
                                                    >
                                                        View Register
                                                    </Link>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => openDraft(voucher)}
                                                        className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-amber-700"
                                                    >
                                                        Edit Draft
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </main>
    );
}
