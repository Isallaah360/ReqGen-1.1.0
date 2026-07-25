"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ProfileRole = {
    role_key: string;
    is_active: boolean;
};

type FinanceTransaction = {
    id: string;
    transaction_no: string | null;
    account_id: string | null;
    subhead_id: string | null;
    request_id: string | null;
    voucher_id: string | null;
    transaction_type: string | null;
    amount: number | string | null;
    narration: string | null;
    external_reference: string | null;
    transaction_date: string | null;
    posted_by: string | null;
    posted_at: string | null;
};

type VoucherRow = {
    id: string;
    voucher_no: string | null;
    request_no: string | null;
    bank_account_name: string | null;
    payment_method: string | null;
    prepared_by_name: string | null;
    status: string | null;
};

type AccountRow = {
    id: string;
    name?: string | null;
    account_name?: string | null;
    bank_name?: string | null;
    account_number?: string | null;
};

type SubheadRow = {
    id: string;
    name?: string | null;
    title?: string | null;
    subhead_name?: string | null;
    code?: string | null;
    subhead_code?: string | null;
};

type TransactionView = FinanceTransaction & {
    voucher_no: string | null;
    request_no: string | null;
    account_name: string;
    account_number: string | null;
    payment_method: string | null;
    officer_name: string | null;
    subhead_name: string;
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

function dateInputValue(date: Date) {
    const offset = date.getTimezoneOffset();

    return new Date(date.getTime() - offset * 60_000)
        .toISOString()
        .slice(0, 10);
}

function beginningOfMonth() {
    const date = new Date();
    date.setDate(1);
    return dateInputValue(date);
}

function accountLabel(account: AccountRow | undefined) {
    if (!account) return "Unknown account";

    return (
        account.account_name ||
        account.name ||
        account.bank_name ||
        "Linked IET account"
    );
}

function subheadLabel(subhead: SubheadRow | undefined) {
    if (!subhead) return "Unknown subhead";

    return (
        subhead.subhead_name ||
        subhead.name ||
        subhead.title ||
        subhead.subhead_code ||
        subhead.code ||
        "Linked subhead"
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
    const classes = {
        blue: "border-blue-100 bg-gradient-to-br from-white to-blue-50",
        emerald: "border-emerald-100 bg-gradient-to-br from-white to-emerald-50",
        violet: "border-violet-100 bg-gradient-to-br from-white to-violet-50",
        amber: "border-amber-100 bg-gradient-to-br from-white to-amber-50",
    };

    return (
        <section className={`rounded-3xl border p-5 shadow-sm ${classes[tone]}`}>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                {label}
            </p>
            <p className="mt-3 break-words text-3xl font-black tracking-tight text-slate-950">
                {value}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-500">{hint}</p>
        </section>
    );
}

export default function FinanceTransactionsPage() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [authorized, setAuthorized] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [transactions, setTransactions] = useState<TransactionView[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("all");
    const [transactionType, setTransactionType] = useState("all");
    const [dateFrom, setDateFrom] = useState(beginningOfMonth());
    const [dateTo, setDateTo] = useState(dateInputValue(new Date()));

    const loadTransactions = useCallback(async (manual = false) => {
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
                setTransactions([]);
                return;
            }

            const { data: transactionData, error: transactionError } = await supabase
                .from("finance_transactions")
                .select(
                    "id,transaction_no,account_id,subhead_id,request_id,voucher_id,transaction_type,amount,narration,external_reference,transaction_date,posted_by,posted_at"
                )
                .order("transaction_date", { ascending: false });

            if (transactionError) throw transactionError;

            const rawTransactions = (transactionData || []) as FinanceTransaction[];

            const voucherIds = Array.from(
                new Set(
                    rawTransactions
                        .map((item) => item.voucher_id)
                        .filter((value): value is string => Boolean(value))
                )
            );

            const accountIds = Array.from(
                new Set(
                    rawTransactions
                        .map((item) => item.account_id)
                        .filter((value): value is string => Boolean(value))
                )
            );

            const subheadIds = Array.from(
                new Set(
                    rawTransactions
                        .map((item) => item.subhead_id)
                        .filter((value): value is string => Boolean(value))
                )
            );

            const [voucherResult, accountResult, subheadResult] = await Promise.all([
                voucherIds.length
                    ? supabase
                        .from("payment_vouchers")
                        .select(
                            "id,voucher_no,request_no,bank_account_name,payment_method,prepared_by_name,status"
                        )
                        .in("id", voucherIds)
                    : Promise.resolve({ data: [], error: null }),
                accountIds.length
                    ? supabase
                        .from("iet_accounts")
                        .select("*")
                        .in("id", accountIds)
                    : Promise.resolve({ data: [], error: null }),
                subheadIds.length
                    ? supabase
                        .from("subheads")
                        .select("*")
                        .in("id", subheadIds)
                    : Promise.resolve({ data: [], error: null }),
            ]);

            if (voucherResult.error) throw voucherResult.error;
            if (accountResult.error) throw accountResult.error;
            if (subheadResult.error) throw subheadResult.error;

            const voucherMap = new Map(
                ((voucherResult.data || []) as VoucherRow[]).map((item) => [
                    item.id,
                    item,
                ])
            );

            const accountMap = new Map(
                ((accountResult.data || []) as AccountRow[]).map((item) => [
                    item.id,
                    item,
                ])
            );

            const subheadMap = new Map(
                ((subheadResult.data || []) as SubheadRow[]).map((item) => [
                    item.id,
                    item,
                ])
            );

            const combined = rawTransactions.map((item) => {
                const voucher = item.voucher_id
                    ? voucherMap.get(item.voucher_id)
                    : undefined;

                const account = item.account_id
                    ? accountMap.get(item.account_id)
                    : undefined;

                const subhead = item.subhead_id
                    ? subheadMap.get(item.subhead_id)
                    : undefined;

                return {
                    ...item,
                    voucher_no: voucher?.voucher_no || null,
                    request_no: voucher?.request_no || null,
                    account_name:
                        voucher?.bank_account_name || accountLabel(account),
                    account_number: account?.account_number || null,
                    payment_method: voucher?.payment_method || null,
                    officer_name: voucher?.prepared_by_name || null,
                    subhead_name: subheadLabel(subhead),
                };
            });

            setTransactions(combined);
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Unable to load the Finance Transactions Register."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadTransactions();
    }, [loadTransactions]);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            loadTransactions(true);
        }, 30_000);

        const channel = supabase
            .channel("finance-transactions-register-live")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "finance_transactions" },
                () => loadTransactions(true)
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "payment_vouchers" },
                () => loadTransactions(true)
            )
            .subscribe();

        return () => {
            window.clearInterval(intervalId);
            supabase.removeChannel(channel);
        };
    }, [loadTransactions]);

    const filteredTransactions = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        return transactions.filter((item) => {
            const searchable = [
                item.transaction_no,
                item.voucher_no,
                item.request_no,
                item.narration,
                item.external_reference,
                item.account_name,
                item.account_number,
                item.payment_method,
                item.officer_name,
                item.subhead_name,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            const matchesSearch =
                !normalizedSearch || searchable.includes(normalizedSearch);

            const matchesMethod =
                paymentMethod === "all" ||
                (item.payment_method || "").toLowerCase() ===
                paymentMethod.toLowerCase();

            const matchesType =
                transactionType === "all" ||
                (item.transaction_type || "").toLowerCase() ===
                transactionType.toLowerCase();

            const transactionDate = item.transaction_date
                ? item.transaction_date.slice(0, 10)
                : "";

            const matchesFrom = !dateFrom || transactionDate >= dateFrom;
            const matchesTo = !dateTo || transactionDate <= dateTo;

            return (
                matchesSearch &&
                matchesMethod &&
                matchesType &&
                matchesFrom &&
                matchesTo
            );
        });
    }, [
        dateFrom,
        dateTo,
        paymentMethod,
        searchTerm,
        transactionType,
        transactions,
    ]);

    const totalPosted = useMemo(
        () =>
            filteredTransactions.reduce(
                (sum, item) => sum + Number(item.amount || 0),
                0
            ),
        [filteredTransactions]
    );

    const accountCount = useMemo(
        () =>
            new Set(
                filteredTransactions
                    .map((item) => item.account_id)
                    .filter(Boolean)
            ).size,
        [filteredTransactions]
    );

    const voucherCount = useMemo(
        () =>
            new Set(
                filteredTransactions
                    .map((item) => item.voucher_id)
                    .filter(Boolean)
            ).size,
        [filteredTransactions]
    );

    const paymentMethods = useMemo(
        () =>
            Array.from(
                new Set(
                    transactions
                        .map((item) => item.payment_method)
                        .filter((value): value is string => Boolean(value))
                )
            ).sort(),
        [transactions]
    );

    const transactionTypes = useMemo(
        () =>
            Array.from(
                new Set(
                    transactions
                        .map((item) => item.transaction_type)
                        .filter((value): value is string => Boolean(value))
                )
            ).sort(),
        [transactions]
    );

    function resetFilters() {
        setSearchTerm("");
        setPaymentMethod("all");
        setTransactionType("all");
        setDateFrom(beginningOfMonth());
        setDateTo(dateInputValue(new Date()));
    }

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
                    <div className="h-96 rounded-3xl bg-slate-200" />
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
                        Transactions Register.
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
                        href="/dashboard"
                        className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800"
                    >
                        Main Dashboard
                    </Link>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">
                        Auto-refresh: 30 seconds
                    </span>
                    <button
                        type="button"
                        onClick={() => loadTransactions(true)}
                        disabled={refreshing}
                        className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-black text-cyan-800 transition hover:bg-cyan-100 disabled:opacity-60"
                    >
                        {refreshing ? "Refreshing…" : "Refresh Now"}
                    </button>
                </div>
            </nav>

            <section className="overflow-hidden rounded-3xl border border-blue-200 bg-gradient-to-br from-slate-950 via-blue-950 to-violet-950 p-6 text-white shadow-xl sm:p-8">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                    Phase 2C • Finance Records
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                    Finance Transactions Register
                </h1>
                <p className="mt-3 max-w-3xl font-semibold leading-7 text-slate-300">
                    Search and review posted transactions, vouchers, accounts, subheads,
                    payment methods and posting references.
                </p>
            </section>

            {error && (
                <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 font-semibold text-red-800">
                    {error}
                </div>
            )}

            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                    label="Filtered Transactions"
                    value={String(filteredTransactions.length)}
                    hint="Transactions currently displayed"
                    tone="blue"
                />
                <SummaryCard
                    label="Total Posted"
                    value={money(totalPosted)}
                    hint="Combined value of displayed transactions"
                    tone="emerald"
                />
                <SummaryCard
                    label="Payment Vouchers"
                    value={String(voucherCount)}
                    hint="Unique vouchers represented"
                    tone="violet"
                />
                <SummaryCard
                    label="Accounts Used"
                    value={String(accountCount)}
                    hint="Unique IET accounts represented"
                    tone="amber"
                />
            </section>

            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                            Search and Filters
                        </p>
                        <h2 className="mt-1 text-xl font-black text-slate-950">
                            Refine the register
                        </h2>
                    </div>

                    <button
                        type="button"
                        onClick={resetFilters}
                        className="w-fit rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                    >
                        Reset Filters
                    </button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <label className="xl:col-span-2">
                        <span className="text-sm font-black text-slate-800">Search</span>
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Transaction, voucher, request, narration, account..."
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none focus:border-blue-500"
                        />
                    </label>

                    <label>
                        <span className="text-sm font-black text-slate-800">
                            Payment Method
                        </span>
                        <select
                            value={paymentMethod}
                            onChange={(event) => setPaymentMethod(event.target.value)}
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none focus:border-blue-500"
                        >
                            <option value="all">All methods</option>
                            {paymentMethods.map((method) => (
                                <option key={method} value={method}>
                                    {method}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        <span className="text-sm font-black text-slate-800">
                            Transaction Type
                        </span>
                        <select
                            value={transactionType}
                            onChange={(event) => setTransactionType(event.target.value)}
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none focus:border-blue-500"
                        >
                            <option value="all">All types</option>
                            {transactionTypes.map((type) => (
                                <option key={type} value={type}>
                                    {type}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                        <label>
                            <span className="text-sm font-black text-slate-800">From</span>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(event) => setDateFrom(event.target.value)}
                                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-semibold text-slate-900 outline-none focus:border-blue-500"
                            />
                        </label>

                        <label>
                            <span className="text-sm font-black text-slate-800">To</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(event) => setDateTo(event.target.value)}
                                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-semibold text-slate-900 outline-none focus:border-blue-500"
                            />
                        </label>
                    </div>
                </div>
            </section>

            <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
                    <div>
                        <h2 className="text-xl font-black text-slate-950">
                            Posted Transactions
                        </h2>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                            Request-based transactions now; manual vouchers will join this
                            register when the Manual Voucher Saga is completed.
                        </p>
                    </div>

                    <span className="w-fit rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-800">
                        {filteredTransactions.length} record
                        {filteredTransactions.length === 1 ? "" : "s"}
                    </span>
                </div>

                {filteredTransactions.length === 0 ? (
                    <div className="px-6 py-16 text-center">
                        <div className="text-lg font-black text-slate-900">
                            No matching finance transaction
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-500">
                            Adjust the date range or filters, or wait for a payment to be
                            posted.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-[1150px] divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr className="text-left text-xs font-black uppercase tracking-wide text-slate-500">
                                    <th className="px-5 py-3 sm:px-6">Transaction</th>
                                    <th className="px-5 py-3">Voucher / Request</th>
                                    <th className="px-5 py-3">Account / Subhead</th>
                                    <th className="px-5 py-3">Method</th>
                                    <th className="px-5 py-3">Date</th>
                                    <th className="px-5 py-3">Officer</th>
                                    <th className="px-5 py-3 text-right sm:px-6">Amount</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100">
                                {filteredTransactions.map((item) => (
                                    <tr key={item.id} className="align-top hover:bg-slate-50/80">
                                        <td className="px-5 py-5 sm:px-6">
                                            <div className="font-black text-blue-800">
                                                {item.transaction_no || "No transaction number"}
                                            </div>
                                            <div className="mt-1 max-w-sm text-sm font-semibold text-slate-700">
                                                {item.narration || "No narration"}
                                            </div>
                                            <div className="mt-1 text-xs font-bold text-slate-500">
                                                {item.transaction_type || "Payment"}
                                            </div>
                                        </td>

                                        <td className="px-5 py-5">
                                            <div className="font-black text-violet-800">
                                                {item.voucher_no || "No voucher"}
                                            </div>
                                            <div className="mt-1 text-sm font-semibold text-slate-600">
                                                {item.request_no || "Manual / unlinked request"}
                                            </div>
                                            {item.external_reference && (
                                                <div className="mt-1 text-xs font-bold text-slate-500">
                                                    Ref: {item.external_reference}
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-5 py-5">
                                            <div className="font-black text-slate-950">
                                                {item.account_name}
                                            </div>
                                            <div className="mt-1 text-sm font-semibold text-slate-600">
                                                {item.account_number || "No account number"}
                                            </div>
                                            <div className="mt-1 text-xs font-bold text-slate-500">
                                                {item.subhead_name}
                                            </div>
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-5">
                                            <span className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-800">
                                                {item.payment_method || "Not recorded"}
                                            </span>
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-5 text-sm font-semibold text-slate-700">
                                            {readableDate(item.transaction_date || item.posted_at)}
                                        </td>

                                        <td className="px-5 py-5 text-sm font-semibold text-slate-700">
                                            {item.officer_name || "AccountOfficer"}
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-5 text-right text-base font-black text-emerald-800 sm:px-6">
                                            {money(item.amount)}
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
