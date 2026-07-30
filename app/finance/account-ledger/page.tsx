"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ProfileRole = {
    role_key: string;
    is_active: boolean;
};

type AccountRow = {
    id: string;
    name?: string | null;
    account_name?: string | null;
    bank_name?: string | null;
    account_number?: string | null;
    balance?: number | string | null;
    available_balance?: number | string | null;
    opening_balance?: number | string | null;
};

type LedgerRow = {
    id: string;
    account_id: string | null;
    transaction_type: string | null;
    amount: number | string | null;
    balance_before: number | string | null;
    balance_after: number | string | null;
    reference_type: string | null;
    reference_id: string | null;
    reference_no: string | null;
    narration: string | null;
    actor_id: string | null;
    actor_name: string | null;
    created_at: string | null;
};

type LedgerView = LedgerRow & {
    debit: number;
    credit: number;
    running_balance: number;
    voucher_no: string | null;
    request_no: string | null;
    transaction_no: string | null;
};

type VoucherRow = {
    id: string;
    voucher_no?: string | null;
    request_no?: string | null;
};

type TransactionRow = {
    id: string;
    transaction_no?: string | null;
    voucher_id?: string | null;
    request_id?: string | null;
};

const FINANCE_ROLES = new Set([
    "admin",
    "auditor",
    "account",
    "accounts",
    "accountofficer",
    "pvsigner",
    "pvcountersigner",
    "dg",
]);

function normalizeRole(value: string | null | undefined) {
    return (value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/_/g, "");
}

function numberValue(value: number | string | null | undefined) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number | string | null | undefined) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 2,
    }).format(numberValue(value));
}

function readableDate(value: string | null | undefined) {
    if (!value) return "Not available";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not available";

    return date.toLocaleString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function dateInputValue(date: Date) {
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60_000)
        .toISOString()
        .slice(0, 10);
}

function beginningOfYear() {
    const date = new Date();
    date.setMonth(0, 1);
    return dateInputValue(date);
}

function accountLabel(account: AccountRow | undefined) {
    if (!account) return "Unknown account";
    return (
        account.account_name ||
        account.name ||
        account.bank_name ||
        "IET Account"
    );
}

function csvCell(value: string | number | null | undefined) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
}

function isCreditType(type: string | null | undefined) {
    const value = (type || "").trim().toLowerCase();
    return [
        "credit",
        "opening balance",
        "deposit",
        "income",
        "receipt",
        "transfer in",
        "refund",
    ].some((item) => value === item || value.includes(item));
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
    tone: "blue" | "emerald" | "amber" | "violet";
}) {
    const tones = {
        blue: "border-blue-100 bg-gradient-to-br from-white to-blue-50",
        emerald: "border-emerald-100 bg-gradient-to-br from-white to-emerald-50",
        amber: "border-amber-100 bg-gradient-to-br from-white to-amber-50",
        violet: "border-violet-100 bg-gradient-to-br from-white to-violet-50",
    };

    return (
        <section className={`rounded-3xl border p-5 shadow-sm ${tones[tone]}`}>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                {label}
            </p>
            <p className="mt-3 break-words text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                {value}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-500">{hint}</p>
        </section>
    );
}

export default function AccountLedgerPage() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [authorized, setAuthorized] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [accounts, setAccounts] = useState<AccountRow[]>([]);
    const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [dateFrom, setDateFrom] = useState(beginningOfYear());
    const [dateTo, setDateTo] = useState(dateInputValue(new Date()));

    const loadLedger = useCallback(async (manual = false) => {
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

            ((rolesResult.data || []) as ProfileRole[]).forEach((role) => {
                if (role.is_active) roleKeys.add(normalizeRole(role.role_key));
            });

            const hasFinanceRole = [...roleKeys].some((role) => FINANCE_ROLES.has(role));
            setAuthorized(hasFinanceRole);

            if (!hasFinanceRole) {
                setAccounts([]);
                setLedgerRows([]);
                return;
            }

            const [accountResult, ledgerResult] = await Promise.all([
                supabase.from("iet_accounts").select("*"),
                supabase
                    .from("iet_account_transactions")
                    .select("*")
                    .order("created_at", { ascending: true }),
            ]);

            if (accountResult.error) throw accountResult.error;
            if (ledgerResult.error) throw ledgerResult.error;

            const accountData = ((accountResult.data || []) as AccountRow[]).sort((a, b) =>
                accountLabel(a).localeCompare(accountLabel(b))
            );

            const rawLedger = (ledgerResult.data || []) as LedgerRow[];

            setAccounts(accountData);
            setLedgerRows(rawLedger);
            setSelectedAccountId((current) => {
                if (current && accountData.some((account) => account.id === current)) {
                    return current;
                }
                return accountData[0]?.id || "";
            });
        } catch (caught) {
            console.error("Account Ledger Error:", caught);
            const message =
                typeof caught === "object" && caught && "message" in caught
                    ? String((caught as { message?: unknown }).message || "")
                    : "";
            setError(message || "Unable to load the Account Ledger.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void loadLedger();
    }, [loadLedger]);

    useEffect(() => {
        if (!authorized) return;

        let timer: ReturnType<typeof setTimeout> | null = null;
        const refresh = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => void loadLedger(true), 500);
        };

        const channel = supabase
            .channel("account-ledger-live")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "iet_account_transactions" },
                refresh
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "iet_accounts" },
                refresh
            )
            .subscribe();

        return () => {
            if (timer) clearTimeout(timer);
            void supabase.removeChannel(channel);
        };
    }, [authorized, loadLedger]);

    const selectedAccount = useMemo(
        () => accounts.find((account) => account.id === selectedAccountId),
        [accounts, selectedAccountId]
    );

    const accountLedger = useMemo(() => {
        return ledgerRows
            .filter((row) => row.account_id === selectedAccountId)
            .sort((a, b) => {
                const left = new Date(a.created_at || 0).getTime();
                const right = new Date(b.created_at || 0).getTime();
                return left - right;
            });
    }, [ledgerRows, selectedAccountId]);

    const openingBalance = useMemo(() => {
        const first = accountLedger[0];
        if (first?.balance_before !== null && first?.balance_before !== undefined) {
            return numberValue(first.balance_before);
        }
        return numberValue(selectedAccount?.opening_balance);
    }, [accountLedger, selectedAccount]);

    const hydratedLedger = useMemo<LedgerView[]>(() => {
        let running = openingBalance;

        return accountLedger.map((row) => {
            const amount = numberValue(row.amount);
            const credit = isCreditType(row.transaction_type) ? amount : 0;
            const debit = credit > 0 ? 0 : amount;

            if (row.balance_after !== null && row.balance_after !== undefined) {
                running = numberValue(row.balance_after);
            } else {
                running += credit - debit;
            }

            return {
                ...row,
                debit,
                credit,
                running_balance: running,
                voucher_no:
                    row.reference_type?.toLowerCase().includes("voucher")
                        ? row.reference_no
                        : null,
                request_no:
                    row.reference_type?.toLowerCase().includes("request")
                        ? row.reference_no
                        : null,
                transaction_no:
                    row.reference_type?.toLowerCase().includes("transaction")
                        ? row.reference_no
                        : null,
            };
        });
    }, [accountLedger, openingBalance]);

    const filteredLedger = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
        const toTime = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;

        return hydratedLedger.filter((row) => {
            const rowTime = new Date(row.created_at || 0).getTime();
            if (fromTime !== null && rowTime < fromTime) return false;
            if (toTime !== null && rowTime > toTime) return false;

            if (!query) return true;

            return [
                row.transaction_type,
                row.reference_type,
                row.reference_no,
                row.narration,
                row.actor_name,
                row.voucher_no,
                row.request_no,
                row.transaction_no,
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query));
        });
    }, [hydratedLedger, searchTerm, dateFrom, dateTo]);

    const totals = useMemo(() => {
        return filteredLedger.reduce(
            (summary, row) => {
                summary.debits += row.debit;
                summary.credits += row.credit;
                return summary;
            },
            { debits: 0, credits: 0 }
        );
    }, [filteredLedger]);

    const closingBalance =
        filteredLedger.length > 0
            ? filteredLedger[filteredLedger.length - 1].running_balance
            : numberValue(
                selectedAccount?.available_balance ?? selectedAccount?.balance ?? openingBalance
            );

    const exportCsv = () => {
        const rows = [
            [
                "Date",
                "Transaction Type",
                "Voucher Reference",
                "Request Reference",
                "Transaction Reference",
                "Narration",
                "Actor",
                "Debit",
                "Credit",
                "Running Balance",
            ],
            ...filteredLedger.map((row) => [
                readableDate(row.created_at),
                row.transaction_type || "",
                row.voucher_no || "",
                row.request_no || "",
                row.transaction_no || row.reference_no || "",
                row.narration || "",
                row.actor_name || "",
                row.debit,
                row.credit,
                row.running_balance,
            ]),
        ];

        const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `account-ledger-${selectedAccountId || "all"}-${dateInputValue(
            new Date()
        )}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-7xl animate-pulse space-y-6">
                    <div className="h-64 rounded-[2rem] bg-slate-200" />
                    <div className="grid gap-4 md:grid-cols-4">
                        {[1, 2, 3, 4].map((item) => (
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
            <main className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6">
                <section className="mx-auto max-w-2xl rounded-[2rem] border border-red-100 bg-white p-8 text-center shadow-sm">
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-red-600">
                        Access Restricted
                    </p>
                    <h1 className="mt-3 text-3xl font-black text-slate-950">
                        Account Ledger is unavailable
                    </h1>
                    <p className="mt-4 text-slate-600">
                        Your current role is not authorised to view finance ledger records.
                    </p>
                    <Link
                        href="/finance"
                        className="reqgen-btn reqgen-btn-slate mt-7 inline-flex rounded-2xl bg-slate-950 px-5 py-3 font-bold text-white"
                    >
                        Return to Finance Control Centre
                    </Link>
                </section>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8 print:bg-white print:p-0">
            <div className="mx-auto max-w-7xl space-y-6">
                <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6 text-white shadow-xl sm:p-8 print:hidden">
                    <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:items-end">
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-400">
                                Finance Accounting
                            </p>
                            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                                Account Ledger
                            </h1>
                            <p className="mt-4 max-w-3xl text-base font-medium leading-7 text-slate-300">
                                Review opening balances, credits, debits, references and running balances for every IET account.
                            </p>
                            <div className="mt-6 flex flex-wrap gap-3">
                                <Link
                                    href="/finance"
                                    className="reqgen-btn reqgen-btn-blue rounded-2xl border border-white/20 bg-white/10 px-5 py-3 font-bold text-white hover:bg-white/15"
                                >
                                    Finance Control Centre
                                </Link>
                                <Link
                                    href="/finance/transactions"
                                    className="reqgen-btn reqgen-btn-emerald rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-500"
                                >
                                    Transactions Register
                                </Link>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">
                                Selected Account
                            </p>
                            <p className="mt-3 text-2xl font-black">
                                {accountLabel(selectedAccount)}
                            </p>
                            <p className="mt-2 text-sm font-semibold text-slate-300">
                                {selectedAccount?.bank_name || "IET Finance Account"}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-300">
                                {selectedAccount?.account_number || "Account number unavailable"}
                            </p>
                        </div>
                    </div>
                </section>

                {error && (
                    <section className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 print:hidden">
                        {error}
                    </section>
                )}

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard
                        label="Opening Balance"
                        value={money(openingBalance)}
                        hint="Balance before the first recorded entry"
                        tone="blue"
                    />
                    <SummaryCard
                        label="Total Credits"
                        value={money(totals.credits)}
                        hint="Credits within the selected period"
                        tone="emerald"
                    />
                    <SummaryCard
                        label="Total Debits"
                        value={money(totals.debits)}
                        hint="Debits within the selected period"
                        tone="amber"
                    />
                    <SummaryCard
                        label="Closing Balance"
                        value={money(closingBalance)}
                        hint="Latest running balance in view"
                        tone="violet"
                    />
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
                    <div className="grid gap-4 lg:grid-cols-6">
                        <label className="lg:col-span-2">
                            <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                                IET Account
                            </span>
                            <select
                                value={selectedAccountId}
                                onChange={(event) => setSelectedAccountId(event.target.value)}
                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-blue-500"
                            >
                                {accounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                        {accountLabel(account)}
                                        {account.account_number ? ` - ${account.account_number}` : ""}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="lg:col-span-2">
                            <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                                Search Ledger
                            </span>
                            <input
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Reference, narration, actor..."
                                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-blue-500"
                            />
                        </label>

                        <label>
                            <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                                From
                            </span>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(event) => setDateFrom(event.target.value)}
                                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-blue-500"
                            />
                        </label>

                        <label>
                            <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                                To
                            </span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(event) => setDateTo(event.target.value)}
                                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-blue-500"
                            />
                        </label>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => void loadLedger(true)}
                            disabled={refreshing}
                            className="reqgen-btn reqgen-btn-rose rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-3 font-bold text-cyan-800 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {refreshing ? "Refreshing..." : "Refresh Ledger"}
                        </button>
                        <button
                            type="button"
                            onClick={exportCsv}
                            disabled={!filteredLedger.length}
                            className="reqgen-btn reqgen-btn-rose rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Export Excel / CSV
                        </button>
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="reqgen-btn reqgen-btn-emerald rounded-2xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-800"
                        >
                            Print / Save PDF
                        </button>
                    </div>
                </section>

                <section className="hidden print:block">
                    <h1 className="text-2xl font-black">IET Account Statement</h1>
                    <p className="mt-2 font-bold">{accountLabel(selectedAccount)}</p>
                    <p>{selectedAccount?.account_number || ""}</p>
                    <p className="mt-2 text-sm">
                        Period: {dateFrom || "Beginning"} to {dateTo || "Current"}
                    </p>
                </section>

                <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm print:border-0 print:shadow-none">
                    <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">
                                Account Statement
                            </p>
                            <h2 className="mt-1 text-2xl font-black text-slate-950">
                                {accountLabel(selectedAccount)}
                            </h2>
                        </div>
                        <p className="text-sm font-bold text-slate-500">
                            {filteredLedger.length} entr{filteredLedger.length === 1 ? "y" : "ies"}
                        </p>
                    </div>

                    {filteredLedger.length === 0 ? (
                        <div className="p-10 text-center">
                            <p className="text-xl font-black text-slate-900">No ledger entries found</p>
                            <p className="mt-2 text-slate-500">
                                Adjust the account, search term or date range.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
                                <thead className="bg-slate-950 text-white">
                                    <tr>
                                        <th className="px-4 py-4 font-black">Date</th>
                                        <th className="px-4 py-4 font-black">Type</th>
                                        <th className="px-4 py-4 font-black">References</th>
                                        <th className="px-4 py-4 font-black">Narration</th>
                                        <th className="px-4 py-4 font-black">Actor</th>
                                        <th className="px-4 py-4 text-right font-black">Debit</th>
                                        <th className="px-4 py-4 text-right font-black">Credit</th>
                                        <th className="px-4 py-4 text-right font-black">Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLedger.map((row) => (
                                        <tr key={row.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                                            <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-700">
                                                {readableDate(row.created_at)}
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                                                    {row.transaction_type || "Transaction"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 font-semibold text-slate-700">
                                                <div>{row.voucher_no || ""}</div>
                                                <div>{row.request_no || ""}</div>
                                                <div>{row.transaction_no || row.reference_no || "—"}</div>
                                            </td>
                                            <td className="max-w-sm px-4 py-4 font-medium text-slate-700">
                                                {row.narration || "No narration"}
                                            </td>
                                            <td className="px-4 py-4 font-semibold text-slate-700">
                                                {row.actor_name || "System"}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-right font-black text-red-700">
                                                {row.debit ? money(row.debit) : "—"}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-right font-black text-emerald-700">
                                                {row.credit ? money(row.credit) : "—"}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-right font-black text-slate-950">
                                                {money(row.running_balance)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 font-black text-slate-950">
                                    <tr>
                                        <td colSpan={5} className="px-4 py-4 text-right">
                                            Period Totals
                                        </td>
                                        <td className="px-4 py-4 text-right text-red-700">
                                            {money(totals.debits)}
                                        </td>
                                        <td className="px-4 py-4 text-right text-emerald-700">
                                            {money(totals.credits)}
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            {money(closingBalance)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </section>
            </div>

            <style jsx global>{`
                @media print {
                    nav,
                    header,
                    aside,
                    button {
                        display: none !important;
                    }

                    body {
                        background: white !important;
                    }

                    @page {
                        size: landscape;
                        margin: 12mm;
                    }
                }
            `}</style>
        </main>
    );
}
