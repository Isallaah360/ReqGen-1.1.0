"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ProfileRole = {
    role_key: string;
    is_active: boolean;
};

type VoucherRow = {
    id: string;
    voucher_no: string | null;
    request_id: string | null;
    request_no: string | null;
    amount: number | string | null;
    total_amount: number | string | null;
    narration: string | null;
    prepared_by: string | null;
    prepared_by_name: string | null;
    status: string | null;
    bank_account_id: string | null;
    bank_account_name: string | null;
    account_id: string | null;
    payment_method: string | null;
    payment_reference: string | null;
    payment_date: string | null;
    posted_by: string | null;
    posted_at: string | null;
    created_at: string | null;
    updated_at: string | null;
};

type TransactionRow = {
    voucher_id: string | null;
    transaction_no: string | null;
};

type VoucherView = VoucherRow & {
    transaction_no: string | null;
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

function voucherAmount(voucher: VoucherRow) {
    return Number(voucher.total_amount || voucher.amount || 0);
}

function voucherKind(voucher: VoucherRow) {
    return voucher.request_id || voucher.request_no
        ? "Request Voucher"
        : "Manual Voucher";
}

function statusTone(statusValue: string | null | undefined) {
    const status = (statusValue || "").trim().toLowerCase();

    if (status.includes("posted") || status.includes("paid")) {
        return "border-emerald-200 bg-emerald-50 text-emerald-800";
    }

    if (
        status.includes("cancel") ||
        status.includes("reverse") ||
        status.includes("reject")
    ) {
        return "border-red-200 bg-red-50 text-red-800";
    }

    if (status.includes("draft") || status.includes("prepared")) {
        return "border-amber-200 bg-amber-50 text-amber-800";
    }

    return "border-blue-200 bg-blue-50 text-blue-800";
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
    const styles = {
        blue: "border-blue-100 bg-gradient-to-br from-white to-blue-50",
        emerald: "border-emerald-100 bg-gradient-to-br from-white to-emerald-50",
        violet: "border-violet-100 bg-gradient-to-br from-white to-violet-50",
        amber: "border-amber-100 bg-gradient-to-br from-white to-amber-50",
    };

    return (
        <section className={`rounded-3xl border p-5 shadow-sm ${styles[tone]}`}>
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

export default function PaymentVouchersRegisterPage() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [authorized, setAuthorized] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [vouchers, setVouchers] = useState<VoucherView[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [kindFilter, setKindFilter] = useState("all");
    const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
    const [dateFrom, setDateFrom] = useState(beginningOfMonth());
    const [dateTo, setDateTo] = useState(dateInputValue(new Date()));

    const loadVouchers = useCallback(async (manual = false) => {
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
                setVouchers([]);
                return;
            }

            const { data: voucherData, error: voucherError } = await supabase
                .from("payment_vouchers")
                .select(
                    "id,voucher_no,request_id,request_no,amount,total_amount,narration,prepared_by,prepared_by_name,status,bank_account_id,bank_account_name,account_id,payment_method,payment_reference,payment_date,posted_by,posted_at,created_at,updated_at"
                )
                .order("created_at", { ascending: false });

            if (voucherError) throw voucherError;

            const rawVouchers = (voucherData || []) as VoucherRow[];
            const voucherIds = rawVouchers.map((item) => item.id);

            let transactionData: TransactionRow[] = [];

            if (voucherIds.length > 0) {
                const { data, error: transactionError } = await supabase
                    .from("finance_transactions")
                    .select("voucher_id,transaction_no")
                    .in("voucher_id", voucherIds);

                if (transactionError) throw transactionError;
                transactionData = (data || []) as TransactionRow[];
            }

            const transactionMap = new Map<string, string>();

            transactionData.forEach((item) => {
                if (item.voucher_id && item.transaction_no) {
                    transactionMap.set(item.voucher_id, item.transaction_no);
                }
            });

            setVouchers(
                rawVouchers.map((voucher) => ({
                    ...voucher,
                    transaction_no: transactionMap.get(voucher.id) || null,
                }))
            );
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Unable to load the Payment Vouchers Register."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadVouchers();
    }, [loadVouchers]);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            loadVouchers(true);
        }, 30_000);

        const channel = supabase
            .channel("payment-vouchers-register-live")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "payment_vouchers" },
                () => loadVouchers(true)
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "finance_transactions" },
                () => loadVouchers(true)
            )
            .subscribe();

        return () => {
            window.clearInterval(intervalId);
            supabase.removeChannel(channel);
        };
    }, [loadVouchers]);

    const statuses = useMemo(
        () =>
            Array.from(
                new Set(
                    vouchers
                        .map((item) => item.status)
                        .filter((value): value is string => Boolean(value))
                )
            ).sort(),
        [vouchers]
    );

    const paymentMethods = useMemo(
        () =>
            Array.from(
                new Set(
                    vouchers
                        .map((item) => item.payment_method)
                        .filter((value): value is string => Boolean(value))
                )
            ).sort(),
        [vouchers]
    );

    const filteredVouchers = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        return vouchers.filter((voucher) => {
            const searchable = [
                voucher.voucher_no,
                voucher.request_no,
                voucher.transaction_no,
                voucher.narration,
                voucher.prepared_by_name,
                voucher.bank_account_name,
                voucher.payment_method,
                voucher.payment_reference,
                voucher.status,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            const kind = voucherKind(voucher);
            const relevantDate =
                voucher.payment_date || voucher.posted_at || voucher.created_at || "";
            const datePart = relevantDate ? relevantDate.slice(0, 10) : "";

            const matchesSearch =
                !normalizedSearch || searchable.includes(normalizedSearch);

            const matchesStatus =
                statusFilter === "all" ||
                (voucher.status || "").toLowerCase() === statusFilter.toLowerCase();

            const matchesKind =
                kindFilter === "all" ||
                kind.toLowerCase() === kindFilter.toLowerCase();

            const matchesMethod =
                paymentMethodFilter === "all" ||
                (voucher.payment_method || "").toLowerCase() ===
                paymentMethodFilter.toLowerCase();

            const matchesFrom = !dateFrom || datePart >= dateFrom;
            const matchesTo = !dateTo || datePart <= dateTo;

            return (
                matchesSearch &&
                matchesStatus &&
                matchesKind &&
                matchesMethod &&
                matchesFrom &&
                matchesTo
            );
        });
    }, [
        dateFrom,
        dateTo,
        kindFilter,
        paymentMethodFilter,
        searchTerm,
        statusFilter,
        vouchers,
    ]);

    const postedVouchers = useMemo(
        () =>
            filteredVouchers.filter((voucher) => {
                const status = (voucher.status || "").toLowerCase();
                return Boolean(voucher.posted_at) || status.includes("posted") || status.includes("paid");
            }),
        [filteredVouchers]
    );

    const draftVouchers = useMemo(
        () =>
            filteredVouchers.filter((voucher) => {
                const status = (voucher.status || "").toLowerCase();
                return !voucher.posted_at && (status.includes("draft") || status.includes("prepared"));
            }),
        [filteredVouchers]
    );

    const totalValue = useMemo(
        () =>
            filteredVouchers.reduce(
                (sum, voucher) => sum + voucherAmount(voucher),
                0
            ),
        [filteredVouchers]
    );

    function resetFilters() {
        setSearchTerm("");
        setStatusFilter("all");
        setKindFilter("all");
        setPaymentMethodFilter("all");
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
                        Your active roles do not currently permit access to the Payment
                        Vouchers Register.
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
                        href="/finance/transactions"
                        className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-violet-800"
                    >
                        Transactions Register
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
                        onClick={() => loadVouchers(true)}
                        disabled={refreshing}
                        className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-black text-cyan-800 transition hover:bg-cyan-100 disabled:opacity-60"
                    >
                        {refreshing ? "Refreshing…" : "Refresh Now"}
                    </button>
                </div>
            </nav>

            <section className="overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-slate-950 via-violet-950 to-blue-950 p-6 text-white shadow-xl sm:p-8">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                    Phase 2C • Finance Records
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                    Payment Vouchers Register
                </h1>
                <p className="mt-3 max-w-3xl font-semibold leading-7 text-slate-300">
                    Review request-based vouchers today and receive manual vouchers in
                    the same register once the Manual Voucher Saga is completed.
                </p>
            </section>

            {error && (
                <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 font-semibold text-red-800">
                    {error}
                </div>
            )}

            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                    label="Displayed Vouchers"
                    value={String(filteredVouchers.length)}
                    hint="Vouchers matching the active filters"
                    tone="blue"
                />
                <SummaryCard
                    label="Posted Vouchers"
                    value={String(postedVouchers.length)}
                    hint="Completed and posted payment vouchers"
                    tone="emerald"
                />
                <SummaryCard
                    label="Draft Vouchers"
                    value={String(draftVouchers.length)}
                    hint="Prepared vouchers awaiting final posting"
                    tone="amber"
                />
                <SummaryCard
                    label="Total Voucher Value"
                    value={money(totalValue)}
                    hint="Combined value of displayed vouchers"
                    tone="violet"
                />
            </section>

            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">
                            Search and Filters
                        </p>
                        <h2 className="mt-1 text-xl font-black text-slate-950">
                            Refine the voucher register
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

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                    <label className="xl:col-span-2">
                        <span className="text-sm font-black text-slate-800">Search</span>
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Voucher, request, transaction, narration, officer..."
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none focus:border-violet-500"
                        />
                    </label>

                    <label>
                        <span className="text-sm font-black text-slate-800">Status</span>
                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none focus:border-violet-500"
                        >
                            <option value="all">All statuses</option>
                            {statuses.map((status) => (
                                <option key={status} value={status}>
                                    {status}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        <span className="text-sm font-black text-slate-800">
                            Voucher Type
                        </span>
                        <select
                            value={kindFilter}
                            onChange={(event) => setKindFilter(event.target.value)}
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none focus:border-violet-500"
                        >
                            <option value="all">All voucher types</option>
                            <option value="Request Voucher">Request vouchers</option>
                            <option value="Manual Voucher">Manual vouchers</option>
                        </select>
                    </label>

                    <label>
                        <span className="text-sm font-black text-slate-800">
                            Payment Method
                        </span>
                        <select
                            value={paymentMethodFilter}
                            onChange={(event) => setPaymentMethodFilter(event.target.value)}
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none focus:border-violet-500"
                        >
                            <option value="all">All methods</option>
                            {paymentMethods.map((method) => (
                                <option key={method} value={method}>
                                    {method}
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
                                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-semibold text-slate-900 outline-none focus:border-violet-500"
                            />
                        </label>

                        <label>
                            <span className="text-sm font-black text-slate-800">To</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(event) => setDateTo(event.target.value)}
                                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-semibold text-slate-900 outline-none focus:border-violet-500"
                            />
                        </label>
                    </div>
                </div>
            </section>

            <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
                    <div>
                        <h2 className="text-xl font-black text-slate-950">
                            Voucher Records
                        </h2>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                            Draft, posted, request-based and future manual voucher records.
                        </p>
                    </div>

                    <span className="w-fit rounded-full bg-violet-50 px-3 py-1.5 text-xs font-black text-violet-800">
                        {filteredVouchers.length} voucher
                        {filteredVouchers.length === 1 ? "" : "s"}
                    </span>
                </div>

                {filteredVouchers.length === 0 ? (
                    <div className="px-6 py-16 text-center">
                        <div className="text-lg font-black text-slate-900">
                            No matching payment voucher
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-500">
                            Adjust the filters or create a voucher from an assigned finance
                            request.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-[1250px] divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr className="text-left text-xs font-black uppercase tracking-wide text-slate-500">
                                    <th className="px-5 py-3 sm:px-6">Voucher</th>
                                    <th className="px-5 py-3">Request / Type</th>
                                    <th className="px-5 py-3">Narration</th>
                                    <th className="px-5 py-3">Account / Method</th>
                                    <th className="px-5 py-3">Officer</th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3">Date</th>
                                    <th className="px-5 py-3 text-right">Amount</th>
                                    <th className="px-5 py-3 text-right sm:px-6">Action</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100">
                                {filteredVouchers.map((voucher) => (
                                    <tr key={voucher.id} className="align-top hover:bg-slate-50/80">
                                        <td className="px-5 py-5 sm:px-6">
                                            <div className="font-black text-violet-800">
                                                {voucher.voucher_no || "Voucher number pending"}
                                            </div>
                                            {voucher.transaction_no && (
                                                <div className="mt-1 text-xs font-bold text-emerald-700">
                                                    {voucher.transaction_no}
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-5 py-5">
                                            <div className="font-black text-slate-950">
                                                {voucher.request_no || "No linked request"}
                                            </div>
                                            <span
                                                className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${voucherKind(voucher) === "Manual Voucher"
                                                        ? "border-amber-200 bg-amber-50 text-amber-800"
                                                        : "border-blue-200 bg-blue-50 text-blue-800"
                                                    }`}
                                            >
                                                {voucherKind(voucher)}
                                            </span>
                                        </td>

                                        <td className="px-5 py-5">
                                            <div className="max-w-sm text-sm font-semibold leading-6 text-slate-700">
                                                {voucher.narration || "No narration recorded"}
                                            </div>
                                            {voucher.payment_reference && (
                                                <div className="mt-1 text-xs font-bold text-slate-500">
                                                    Ref: {voucher.payment_reference}
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-5 py-5">
                                            <div className="font-black text-slate-950">
                                                {voucher.bank_account_name || "Linked IET account"}
                                            </div>
                                            <div className="mt-1 text-sm font-semibold text-slate-600">
                                                {voucher.payment_method || "Method not recorded"}
                                            </div>
                                        </td>

                                        <td className="px-5 py-5 text-sm font-semibold text-slate-700">
                                            {voucher.prepared_by_name || "AccountOfficer"}
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-5">
                                            <span
                                                className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusTone(
                                                    voucher.status
                                                )}`}
                                            >
                                                {voucher.status || "Prepared"}
                                            </span>
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-5 text-sm font-semibold text-slate-700">
                                            {readableDate(
                                                voucher.payment_date ||
                                                voucher.posted_at ||
                                                voucher.created_at
                                            )}
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-5 text-right text-base font-black text-emerald-800">
                                            {money(voucherAmount(voucher))}
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-5 text-right sm:px-6">
                                            {voucher.request_id ? (
                                                <Link
                                                    href={`/finance/request/${voucher.request_id}`}
                                                    className="inline-flex rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-800"
                                                >
                                                    Open Voucher
                                                </Link>
                                            ) : (
                                                <span className="inline-flex rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-black text-slate-500">
                                                    Manual view pending
                                                </span>
                                            )}
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
