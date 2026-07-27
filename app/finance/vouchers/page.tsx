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

function readableDate(value: string | null | undefined, includeTime = false) {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Not available";

    return includeTime
        ? date.toLocaleString("en-US", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })
        : date.toLocaleDateString("en-US", {
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

function escapeCsv(value: unknown) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
}

function safeFilePart(value: string) {
    return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "");
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
    tone: "blue" | "emerald" | "violet" | "amber" | "red";
}) {
    const styles = {
        blue: "border-blue-100 bg-gradient-to-br from-white to-blue-50",
        emerald: "border-emerald-100 bg-gradient-to-br from-white to-emerald-50",
        violet: "border-violet-100 bg-gradient-to-br from-white to-violet-50",
        amber: "border-amber-100 bg-gradient-to-br from-white to-amber-50",
        red: "border-red-100 bg-gradient-to-br from-white to-red-50",
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

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                {label}
            </p>
            <p className="mt-2 break-words text-sm font-black text-slate-950">
                {value}
            </p>
        </div>
    );
}

export default function PaymentVouchersRegisterPage() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [authorized, setAuthorized] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [vouchers, setVouchers] = useState<VoucherView[]>([]);
    const [selectedVoucher, setSelectedVoucher] = useState<VoucherView | null>(null);
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

            if (profileResult.error) throw profileResult.error;
            if (rolesResult.error) throw rolesResult.error;

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

            const nextVouchers = rawVouchers.map((voucher) => ({
                ...voucher,
                transaction_no: transactionMap.get(voucher.id) || null,
            }));

            setVouchers(nextVouchers);
            setSelectedVoucher((current) =>
                current
                    ? nextVouchers.find((item) => item.id === current.id) || null
                    : null
            );
        } catch (caught) {
            console.error("Payment Vouchers Register error:", caught);
            const message =
                caught && typeof caught === "object" && "message" in caught
                    ? String((caught as { message?: unknown }).message || "")
                    : "";
            setError(message || "Unable to load the Payment Vouchers Register.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadVouchers();
    }, [loadVouchers]);

    useEffect(() => {
        let refreshTimer: number | null = null;

        const requestRefresh = () => {
            if (refreshTimer) window.clearTimeout(refreshTimer);
            refreshTimer = window.setTimeout(() => loadVouchers(true), 500);
        };

        const intervalId = window.setInterval(() => {
            loadVouchers(true);
        }, 30_000);

        const channel = supabase
            .channel("payment-vouchers-register-live")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "payment_vouchers" },
                requestRefresh
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "finance_transactions" },
                requestRefresh
            )
            .subscribe();

        return () => {
            if (refreshTimer) window.clearTimeout(refreshTimer);
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
                return (
                    Boolean(voucher.posted_at) ||
                    status.includes("posted") ||
                    status.includes("paid")
                );
            }),
        [filteredVouchers]
    );

    const draftVouchers = useMemo(
        () =>
            filteredVouchers.filter((voucher) => {
                const status = (voucher.status || "").toLowerCase();
                return (
                    !voucher.posted_at &&
                    (status.includes("draft") || status.includes("prepared"))
                );
            }),
        [filteredVouchers]
    );

    const cancelledVouchers = useMemo(
        () =>
            filteredVouchers.filter((voucher) => {
                const status = (voucher.status || "").toLowerCase();
                return status.includes("cancel") || status.includes("reverse");
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

    const postedValue = useMemo(
        () =>
            postedVouchers.reduce(
                (sum, voucher) => sum + voucherAmount(voucher),
                0
            ),
        [postedVouchers]
    );

    function resetFilters() {
        setSearchTerm("");
        setStatusFilter("all");
        setKindFilter("all");
        setPaymentMethodFilter("all");
        setDateFrom(beginningOfMonth());
        setDateTo(dateInputValue(new Date()));
    }

    function exportCsv() {
        const headers = [
            "Voucher Number",
            "Transaction Number",
            "Voucher Type",
            "Request Number",
            "Status",
            "Narration",
            "IET Account",
            "Payment Method",
            "Payment Reference",
            "Prepared By",
            "Payment Date",
            "Posted At",
            "Amount",
        ];

        const rows = filteredVouchers.map((voucher) => [
            voucher.voucher_no || "",
            voucher.transaction_no || "",
            voucherKind(voucher),
            voucher.request_no || "",
            voucher.status || "",
            voucher.narration || "",
            voucher.bank_account_name || "",
            voucher.payment_method || "",
            voucher.payment_reference || "",
            voucher.prepared_by_name || "",
            voucher.payment_date || "",
            voucher.posted_at || "",
            voucherAmount(voucher),
        ]);

        const csv = [headers, ...rows]
            .map((row) => row.map(escapeCsv).join(","))
            .join("\n");
        const blob = new Blob(["\uFEFF", csv], {
            type: "text/csv;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `payment-vouchers-${safeFilePart(
            dateFrom || "all"
        )}-to-${safeFilePart(dateTo || "all")}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }

    function printRegister() {
        window.print();
    }

    if (loading) {
        return (
            <main className="mx-auto max-w-7xl px-4 py-8">
                <div className="animate-pulse space-y-6">
                    <div className="h-40 rounded-3xl bg-slate-200" />
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                        {[0, 1, 2, 3, 4].map((item) => (
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
        <main className="mx-auto max-w-7xl px-4 py-8 print:max-w-none print:px-0 print:py-0">
            <nav className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm print:hidden">
                <div className="flex flex-wrap gap-2">
                    <Link
                        href="/finance"
                        className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-800"
                    >
                        ← Finance Dashboard
                    </Link>
                    <Link
                        href="/finance/manual-voucher"
                        className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-amber-700"
                    >
                        Manual Voucher Centre
                    </Link>
                    <Link
                        href="/finance/transactions"
                        className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-violet-800"
                    >
                        Transactions Register
                    </Link>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={exportCsv}
                        disabled={filteredVouchers.length === 0}
                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Export CSV
                    </button>
                    <button
                        type="button"
                        onClick={printRegister}
                        className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-black text-slate-800 transition hover:bg-slate-100"
                    >
                        Print Register
                    </button>
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

            <section className="overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-slate-950 via-violet-950 to-blue-950 p-6 text-white shadow-xl sm:p-8 print:rounded-none print:border-slate-300 print:bg-white print:text-slate-950 print:shadow-none">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300 print:text-slate-600">
                    Finance Management • Central Register
                </p>
                <div className="mt-2 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                            Payment Vouchers Register
                        </h1>
                        <p className="mt-3 max-w-3xl font-semibold leading-7 text-slate-300 print:text-slate-700">
                            Consolidated register for request-based and manual payment
                            vouchers, including drafts, posted records and cancelled entries.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 print:border-slate-300 print:bg-slate-50">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-300 print:text-slate-500">
                            Posted value in view
                        </p>
                        <p className="mt-2 text-2xl font-black text-white print:text-slate-950">
                            {money(postedValue)}
                        </p>
                    </div>
                </div>
            </section>

            {error && (
                <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 font-semibold text-red-800 print:hidden">
                    {error}
                </div>
            )}

            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5 print:grid-cols-5">
                <SummaryCard
                    label="Displayed"
                    value={String(filteredVouchers.length)}
                    hint="Records matching active filters"
                    tone="blue"
                />
                <SummaryCard
                    label="Posted"
                    value={String(postedVouchers.length)}
                    hint="Completed payment vouchers"
                    tone="emerald"
                />
                <SummaryCard
                    label="Draft"
                    value={String(draftVouchers.length)}
                    hint="Awaiting final posting"
                    tone="amber"
                />
                <SummaryCard
                    label="Cancelled"
                    value={String(cancelledVouchers.length)}
                    hint="Cancelled or reversed records"
                    tone="red"
                />
                <SummaryCard
                    label="Total Value"
                    value={money(totalValue)}
                    hint="Value of all displayed vouchers"
                    tone="violet"
                />
            </section>

            <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 print:hidden">
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

            <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm print:rounded-none print:shadow-none">
                <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
                    <div>
                        <h2 className="text-xl font-black text-slate-950">
                            Voucher Records
                        </h2>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                            Request-based, manual, draft, posted and cancelled vouchers.
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
                            Adjust the filters or create a new manual voucher.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-[1320px] divide-y divide-slate-200 print:min-w-full print:text-[10px]">
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
                                    <th className="px-5 py-3 text-right sm:px-6 print:hidden">Action</th>
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
                                            {voucher.prepared_by_name || "Account Officer"}
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

                                        <td className="whitespace-nowrap px-5 py-5 text-right sm:px-6 print:hidden">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedVoucher(voucher)}
                                                    className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-black text-violet-800 transition hover:bg-violet-100"
                                                >
                                                    Details
                                                </button>
                                                <Link
                                                    href={
                                                        voucher.request_id
                                                            ? `/finance/request/${voucher.request_id}`
                                                            : `/finance/manual-voucher?voucher=${voucher.id}`
                                                    }
                                                    className={`rounded-xl px-3 py-2 text-xs font-black text-white transition ${voucher.request_id
                                                            ? "bg-blue-700 hover:bg-blue-800"
                                                            : "bg-amber-600 hover:bg-amber-700"
                                                        }`}
                                                >
                                                    Open
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {selectedVoucher && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 print:hidden"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Voucher details"
                    onMouseDown={(event) => {
                        if (event.currentTarget === event.target) setSelectedVoucher(null);
                    }}
                >
                    <section className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
                        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-7">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">
                                    Voucher Details
                                </p>
                                <h2 className="mt-1 text-2xl font-black text-slate-950">
                                    {selectedVoucher.voucher_no || "Voucher number pending"}
                                </h2>
                                <p className="mt-1 text-sm font-semibold text-slate-500">
                                    {voucherKind(selectedVoucher)}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedVoucher(null)}
                                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-100"
                            >
                                Close
                            </button>
                        </div>

                        <div className="p-5 sm:p-7">
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <span
                                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusTone(
                                        selectedVoucher.status
                                    )}`}
                                >
                                    {selectedVoucher.status || "Prepared"}
                                </span>
                                <p className="text-2xl font-black text-emerald-800">
                                    {money(voucherAmount(selectedVoucher))}
                                </p>
                            </div>

                            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                <DetailRow
                                    label="Transaction Number"
                                    value={selectedVoucher.transaction_no || "Not posted"}
                                />
                                <DetailRow
                                    label="Request Number"
                                    value={selectedVoucher.request_no || "No linked request"}
                                />
                                <DetailRow
                                    label="IET Account"
                                    value={selectedVoucher.bank_account_name || "Not recorded"}
                                />
                                <DetailRow
                                    label="Payment Method"
                                    value={selectedVoucher.payment_method || "Not recorded"}
                                />
                                <DetailRow
                                    label="Payment Reference"
                                    value={selectedVoucher.payment_reference || "Not recorded"}
                                />
                                <DetailRow
                                    label="Prepared By"
                                    value={selectedVoucher.prepared_by_name || "Not recorded"}
                                />
                                <DetailRow
                                    label="Payment Date"
                                    value={readableDate(selectedVoucher.payment_date)}
                                />
                                <DetailRow
                                    label="Created At"
                                    value={readableDate(selectedVoucher.created_at, true)}
                                />
                                <DetailRow
                                    label="Posted At"
                                    value={readableDate(selectedVoucher.posted_at, true)}
                                />
                            </div>

                            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
                                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                                    Narration
                                </p>
                                <p className="mt-3 whitespace-pre-wrap font-semibold leading-7 text-slate-800">
                                    {selectedVoucher.narration || "No narration recorded."}
                                </p>
                            </div>

                            <div className="mt-6 flex flex-wrap justify-end gap-3">
                                <Link
                                    href={
                                        selectedVoucher.request_id
                                            ? `/finance/request/${selectedVoucher.request_id}`
                                            : `/finance/manual-voucher?voucher=${selectedVoucher.id}`
                                    }
                                    className={`rounded-xl px-4 py-3 text-sm font-black text-white transition ${selectedVoucher.request_id
                                            ? "bg-blue-700 hover:bg-blue-800"
                                            : "bg-amber-600 hover:bg-amber-700"
                                        }`}
                                >
                                    Open Full Voucher
                                </Link>
                            </div>
                        </div>
                    </section>
                </div>
            )}
        </main>
    );
}
