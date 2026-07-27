"use client";

import Link from "next/link";
import {
    FormEvent,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
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

const PAYMENT_METHODS = [
    "Bank Transfer",
    "Cheque",
    "Cash",
    "POS",
    "Mobile Transfer",
    "Other",
];

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

function subheadCode(subhead: SubheadRow) {
    return subhead.subhead_code || subhead.code || "";
}

function accountLabel(account: AccountRow) {
    return account.name || account.bank_name || "Unnamed IET account";
}

function accountBalance(account: AccountRow | undefined) {
    if (!account) return 0;

    return Number(account.available_balance ?? account.balance ?? 0);
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

function isPostedStatus(statusValue: string | null | undefined) {
    const status = (statusValue || "").toLowerCase();

    return status.includes("posted") || status.includes("paid");
}

function isCancelledStatus(statusValue: string | null | undefined) {
    const status = (statusValue || "").toLowerCase();

    return status.includes("cancel") || status.includes("reverse");
}

function firstRpcRecord<T>(data: unknown): T {
    if (Array.isArray(data)) {
        return data[0] as T;
    }

    return data as T;
}

export default function ManualVoucherPage() {
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [saving, setSaving] = useState(false);
    const [posting, setPosting] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [accounts, setAccounts] = useState<AccountRow[]>([]);
    const [subheads, setSubheads] = useState<SubheadRow[]>([]);
    const [manualVouchers, setManualVouchers] = useState<ManualVoucherRow[]>(
        []
    );

    const [voucherId, setVoucherId] = useState<string | null>(null);
    const [voucherNo, setVoucherNo] = useState<string | null>(null);
    const [accountId, setAccountId] = useState("");
    const [subheadId, setSubheadId] = useState("");
    const [payeeName, setPayeeName] = useState("");
    const [narration, setNarration] = useState("");
    const [amount, setAmount] = useState("");
    const [paymentMethod, setPaymentMethod] =
        useState("Bank Transfer");
    const [paymentReference, setPaymentReference] = useState("");
    const [paymentDate, setPaymentDate] = useState(todayInput());
    const [confirmPosting, setConfirmPosting] = useState(false);

    const loadPage = useCallback(async (manual = false) => {
        if (manual) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError(null);

        try {
            const { data: authData, error: authError } =
                await supabase.auth.getUser();

            const user = authData.user;

            if (authError || !user) {
                throw new Error(
                    "Your session has expired. Please sign in again."
                );
            }

            const [profileResult, rolesResult] = await Promise.all([
                supabase
                    .from("profiles")
                    .select("role")
                    .eq("id", user.id)
                    .maybeSingle(),

                supabase
                    .from("profile_roles")
                    .select("role_key,is_active")
                    .eq("profile_id", user.id)
                    .eq("is_active", true),
            ]);

            if (profileResult.error) {
                console.warn(
                    "Unable to read primary profile role:",
                    profileResult.error
                );
            }

            if (rolesResult.error) {
                console.warn(
                    "Unable to read assigned profile roles:",
                    rolesResult.error
                );
            }

            const roleKeys = new Set<string>();

            const primaryRole = normalizeRole(profileResult.data?.role);

            if (primaryRole) {
                roleKeys.add(primaryRole);
            }

            ((rolesResult.data || []) as ProfileRole[]).forEach((item) => {
                if (item.is_active) {
                    const normalized = normalizeRole(item.role_key);

                    if (normalized) {
                        roleKeys.add(normalized);
                    }
                }
            });

            const hasFinanceRole = [...roleKeys].some((role) =>
                FINANCE_ROLES.has(role)
            );

            setAuthorized(hasFinanceRole);

            if (!hasFinanceRole) {
                return;
            }

            const [
                accountResult,
                subheadResult,
                voucherResult,
            ] = await Promise.all([
                supabase
                    .from("iet_accounts")
                    .select("*"),

                supabase
                    .from("subheads")
                    .select("*"),

                supabase
                    .from("payment_vouchers")
                    .select("*")
                    .eq("voucher_type", "Manual")
                    .order("created_at", { ascending: false })
                    .limit(50),
            ]);

            if (accountResult.error) {
                throw accountResult.error;
            }

            if (subheadResult.error) {
                throw subheadResult.error;
            }

            if (voucherResult.error) {
                throw voucherResult.error;
            }

            const accountRows = ((accountResult.data || []) as AccountRow[])
                .slice()
                .sort((left, right) =>
                    accountLabel(left).localeCompare(accountLabel(right))
                );

            const subheadRows = ((subheadResult.data || []) as SubheadRow[])
                .slice()
                .sort((left, right) =>
                    subheadLabel(left).localeCompare(subheadLabel(right))
                );

            setAccounts(accountRows);
            setSubheads(subheadRows);
            setManualVouchers(
                (voucherResult.data || []) as ManualVoucherRow[]
            );
        } catch (caught) {
            console.error("Manual Voucher Centre load error:", caught);
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
                {
                    event: "*",
                    schema: "public",
                    table: "payment_vouchers",
                },
                () => loadPage(true)
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "finance_transactions",
                },
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

    const availableSubheads = useMemo(() => {
        return subheads.filter((item) => {
            if (!accountId) return true;

            return (
                item.account_id === accountId ||
                item.bank_account_id === accountId ||
                (!item.account_id && !item.bank_account_id)
            );
        });
    }, [accountId, subheads]);

    const selectedSubhead = useMemo(
        () => subheads.find((item) => item.id === subheadId),
        [subheadId, subheads]
    );

    const numericAmount = Number(amount || 0);
    const currentAccountBalance = accountBalance(selectedAccount);
    const currentSubheadBalance = Number(
        selectedSubhead?.balance || 0
    );

    const accountBalanceAfterPayment =
        currentAccountBalance -
        (Number.isFinite(numericAmount) ? numericAmount : 0);

    const subheadBalanceAfterPayment =
        currentSubheadBalance -
        (Number.isFinite(numericAmount) ? numericAmount : 0);

    const draftCount = useMemo(
        () =>
            manualVouchers.filter(
                (voucher) =>
                    !isPostedStatus(voucher.status) &&
                    !isCancelledStatus(voucher.status)
            ).length,
        [manualVouchers]
    );

    const postedCount = useMemo(
        () =>
            manualVouchers.filter((voucher) =>
                isPostedStatus(voucher.status)
            ).length,
        [manualVouchers]
    );

    const postedValue = useMemo(
        () =>
            manualVouchers
                .filter((voucher) => isPostedStatus(voucher.status))
                .reduce(
                    (total, voucher) =>
                        total +
                        Number(
                            voucher.total_amount ??
                            voucher.amount ??
                            0
                        ),
                    0
                ),
        [manualVouchers]
    );

    function clearForm(preserveMessage = false) {
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

        if (!preserveMessage) {
            setSuccess(null);
        }
    }

    function handleAccountChange(value: string) {
        setAccountId(value);
        setSubheadId("");
        setError(null);
        setSuccess(null);
    }

    function openDraft(voucher: ManualVoucherRow) {
        if (isPostedStatus(voucher.status)) {
            setSuccess(null);
            setError(
                "Posted vouchers are read-only and cannot be edited."
            );
            return;
        }

        if (isCancelledStatus(voucher.status)) {
            setSuccess(null);
            setError(
                "Cancelled vouchers are read-only and cannot be edited."
            );
            return;
        }

        setVoucherId(voucher.id);
        setVoucherNo(voucher.voucher_no);
        setAccountId(voucher.account_id || "");
        setSubheadId(voucher.subhead_id || "");
        setPayeeName(voucher.payee_name || "");
        setNarration(voucher.narration || "");
        setAmount(
            String(voucher.total_amount ?? voucher.amount ?? "")
        );
        setPaymentMethod(
            voucher.payment_method || "Bank Transfer"
        );
        setPaymentReference(voucher.payment_reference || "");
        setPaymentDate(voucher.payment_date || todayInput());
        setConfirmPosting(false);
        setError(null);
        setSuccess(
            `Draft ${voucher.voucher_no || ""} loaded for editing.`
        );

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    }

    function validateVoucher() {
        const value = Number(amount);

        if (!accountId) {
            throw new Error("Select an IET account.");
        }

        if (!payeeName.trim()) {
            throw new Error("Enter the payee or beneficiary.");
        }

        if (!narration.trim()) {
            throw new Error("Enter the payment narration.");
        }

        if (!Number.isFinite(value) || value <= 0) {
            throw new Error(
                "Enter a valid amount greater than zero."
            );
        }

        if (!paymentDate) {
            throw new Error("Select the payment date.");
        }

        return value;
    }

    async function saveDraft(event?: FormEvent) {
        event?.preventDefault();

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const validatedAmount = validateVoucher();

            const { data, error: rpcError } = await supabase.rpc(
                "save_manual_payment_voucher",
                {
                    p_voucher_id: voucherId,
                    p_account_id: accountId,
                    p_subhead_id: subheadId || null,
                    p_payee_name: payeeName.trim(),
                    p_narration: narration.trim(),
                    p_amount: validatedAmount,
                    p_payment_method: paymentMethod,
                    p_payment_reference:
                        paymentReference.trim() || null,
                    p_payment_date: paymentDate,
                }
            );

            if (rpcError) {
                throw rpcError;
            }

            const result = firstRpcRecord<SaveResult>(data);

            if (!result?.voucher_id) {
                throw new Error(
                    "The voucher was processed, but Supabase did not return a voucher ID."
                );
            }

            setVoucherId(result.voucher_id);
            setVoucherNo(result.voucher_no);
            setSuccess(
                `Draft ${result.voucher_no} saved successfully.`
            );

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

    async function cancelDraft() {
        if (!voucherId) {
            setError("Save the voucher as a draft before cancelling it.");
            return;
        }

        const currentVoucher = manualVouchers.find(
            (voucher) => voucher.id === voucherId
        );

        if (isPostedStatus(currentVoucher?.status)) {
            setError("A posted voucher cannot be cancelled from the draft form.");
            return;
        }

        if (isCancelledStatus(currentVoucher?.status)) {
            setError("This voucher has already been cancelled.");
            return;
        }

        const confirmed = window.confirm(
            `Cancel ${voucherNo || "this draft voucher"}? This action will make the draft read-only.`
        );

        if (!confirmed) return;

        setCancelling(true);
        setError(null);
        setSuccess(null);

        try {
            const { error: cancelError } = await supabase
                .from("payment_vouchers")
                .update({ status: "Cancelled" })
                .eq("id", voucherId)
                .not("status", "ilike", "%posted%")
                .not("status", "ilike", "%paid%");

            if (cancelError) {
                throw cancelError;
            }

            const cancelledVoucherNo = voucherNo || "Draft voucher";

            await loadPage(true);
            clearForm(true);
            setSuccess(`${cancelledVoucherNo} cancelled successfully.`);
        } catch (caught) {
            console.error("Manual voucher cancellation error:", caught);
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Unable to cancel the draft voucher."
            );
        } finally {
            setCancelling(false);
        }
    }

    async function postVoucher() {
        setPosting(true);
        setError(null);
        setSuccess(null);

        try {
            validateVoucher();

            const currentVoucher = manualVouchers.find(
                (voucher) => voucher.id === voucherId
            );

            if (isPostedStatus(currentVoucher?.status)) {
                throw new Error(
                    "This voucher has already been posted. Duplicate posting was prevented."
                );
            }

            if (isCancelledStatus(currentVoucher?.status)) {
                throw new Error("A cancelled voucher cannot be posted.");
            }

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
                throw new Error(
                    "The voucher must be saved before posting."
                );
            }

            const { data, error: rpcError } = await supabase.rpc(
                "post_manual_payment_voucher",
                {
                    p_voucher_id: activeVoucherId,
                }
            );

            if (rpcError) {
                throw rpcError;
            }

            const result = firstRpcRecord<PostResult>(data);

            if (!result?.voucher_no) {
                throw new Error(
                    "Supabase did not return the posted voucher details."
                );
            }

            await loadPage(true);
            clearForm(true);

            setSuccess(
                `${result.voucher_no} posted successfully as ${result.transaction_no
                }. Account balance: ${money(
                    result.account_balance
                )}. Subhead balance: ${money(
                    result.subhead_balance
                )}.`
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
                    <div className="h-20 rounded-3xl bg-slate-200" />
                    <div className="h-64 rounded-3xl bg-slate-200" />
                    <div className="h-[620px] rounded-3xl bg-slate-200" />
                    <div className="h-96 rounded-3xl bg-slate-200" />
                </div>
            </main>
        );
    }

    if (!authorized) {
        return (
            <main className="mx-auto max-w-3xl px-4 py-12">
                <section className="rounded-3xl border border-amber-200 bg-amber-50 p-7 shadow-sm">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl">
                        🔐
                    </div>

                    <h1 className="mt-5 text-2xl font-black text-amber-950">
                        Finance access required
                    </h1>

                    <p className="mt-3 font-semibold leading-7 text-amber-900">
                        Your active roles do not permit access to the
                        Manual Voucher Centre.
                    </p>

                    <Link
                        href="/dashboard"
                        className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800"
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
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-black text-slate-800 transition hover:bg-slate-100"
                    >
                        ← Finance Dashboard
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
                    onClick={() => loadPage(true)}
                    disabled={refreshing}
                    className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-black text-cyan-800 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {refreshing
                        ? "Refreshing…"
                        : "Refresh Voucher Data"}
                </button>
            </nav>

            <section className="overflow-hidden rounded-[32px] border border-violet-800/40 bg-gradient-to-br from-slate-950 via-violet-950 to-amber-950 p-6 text-white shadow-xl sm:p-8">
                <div className="grid gap-7 lg:grid-cols-[1fr_340px] lg:items-center">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">
                            Finance Management
                        </p>

                        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                            Manual Voucher Centre
                        </h1>

                        <p className="mt-4 max-w-3xl font-semibold leading-7 text-slate-300">
                            Create direct payment vouchers, retain
                            unfinished vouchers as drafts and post verified
                            payments into the central finance transaction
                            register.
                        </p>

                        <div className="mt-6 flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => clearForm()}
                                className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-300"
                            >
                                + Start New Voucher
                            </button>

                            <Link
                                href="/finance/vouchers"
                                className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
                            >
                                View Voucher Register
                            </Link>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                        <p className="text-xs font-black uppercase tracking-[0.17em] text-slate-300">
                            Manual voucher activity
                        </p>

                        <p className="mt-3 text-3xl font-black">
                            {money(postedValue)}
                        </p>

                        <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
                            Total value of posted manual vouchers among the
                            latest records.
                        </p>

                        <div className="mt-5 grid grid-cols-3 gap-2">
                            <div className="rounded-xl bg-amber-300/15 px-3 py-2 text-center">
                                <p className="text-lg font-black text-amber-200">
                                    {draftCount}
                                </p>
                                <p className="text-[10px] font-black uppercase tracking-wide text-slate-300">
                                    Drafts
                                </p>
                            </div>

                            <div className="rounded-xl bg-emerald-300/15 px-3 py-2 text-center">
                                <p className="text-lg font-black text-emerald-200">
                                    {postedCount}
                                </p>
                                <p className="text-[10px] font-black uppercase tracking-wide text-slate-300">
                                    Posted
                                </p>
                            </div>

                            <div className="rounded-xl bg-violet-300/15 px-3 py-2 text-center">
                                <p className="text-lg font-black text-violet-200">
                                    {manualVouchers.length}
                                </p>
                                <p className="text-[10px] font-black uppercase tracking-wide text-slate-300">
                                    Records
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {error && (
                <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 font-semibold text-red-800 shadow-sm">
                    <span className="text-lg">⚠️</span>
                    <p>{error}</p>
                </div>
            )}

            {success && (
                <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 font-semibold text-emerald-800 shadow-sm">
                    <span className="text-lg">✅</span>
                    <p>{success}</p>
                </div>
            )}

            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">
                        Draft vouchers
                    </p>
                    <p className="mt-2 text-3xl font-black text-amber-950">
                        {draftCount}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-amber-800">
                        Saved vouchers awaiting posting
                    </p>
                </article>

                <article className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                        Posted vouchers
                    </p>
                    <p className="mt-2 text-3xl font-black text-emerald-950">
                        {postedCount}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-emerald-800">
                        Completed manual payments
                    </p>
                </article>

                <article className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
                        IET accounts
                    </p>
                    <p className="mt-2 text-3xl font-black text-blue-950">
                        {accounts.length}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-blue-800">
                        Available finance accounts
                    </p>
                </article>

                <article className="rounded-3xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                        Finance subheads
                    </p>
                    <p className="mt-2 text-3xl font-black text-violet-950">
                        {subheads.length}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-violet-800">
                        Available budget classifications
                    </p>
                </article>
            </section>

            <section className="mt-6 rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
                            {voucherId
                                ? "Edit Manual Voucher"
                                : "New Manual Voucher"}
                        </p>

                        <h2 className="mt-2 text-2xl font-black text-slate-950">
                            {voucherNo ||
                                "Voucher number generated on first save"}
                        </h2>

                        <p className="mt-2 text-sm font-semibold text-slate-500">
                            Fields marked with an asterisk are required.
                        </p>
                    </div>

                    {voucherId && (
                        <button
                            type="button"
                            onClick={() => clearForm()}
                            className="w-fit rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                        >
                            Start New Voucher
                        </button>
                    )}
                </div>

                <form
                    onSubmit={saveDraft}
                    className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]"
                >
                    <div className="grid gap-5 lg:grid-cols-2">
                        <label className="block">
                            <span className="text-sm font-black text-slate-800">
                                IET Account *
                            </span>

                            <select
                                value={accountId}
                                onChange={(event) =>
                                    handleAccountChange(
                                        event.target.value
                                    )
                                }
                                disabled={saving || posting || cancelling}
                                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                            >
                                <option value="">
                                    Select an IET account
                                </option>

                                {accounts.map((account) => (
                                    <option
                                        key={account.id}
                                        value={account.id}
                                    >
                                        {accountLabel(account)}
                                        {account.account_number
                                            ? ` • ${account.account_number}`
                                            : ""}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className="text-sm font-black text-slate-800">
                                Finance Subhead (where applicable)
                            </span>

                            <select
                                value={subheadId}
                                onChange={(event) => {
                                    setSubheadId(event.target.value);
                                    setError(null);
                                    setSuccess(null);
                                }}
                                disabled={
                                    saving ||
                                    posting ||
                                    !accountId
                                }
                                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100 disabled:bg-slate-100"
                            >
                                <option value="">
                                    {accountId
                                        ? "Select a finance subhead (optional)"
                                        : "Select an account first"}
                                </option>

                                {availableSubheads.map((subhead) => (
                                    <option
                                        key={subhead.id}
                                        value={subhead.id}
                                    >
                                        {subheadCode(subhead)
                                            ? `${subheadCode(
                                                subhead
                                            )} • `
                                            : ""}
                                        {subheadLabel(subhead)}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block lg:col-span-2">
                            <span className="text-sm font-black text-slate-800">
                                Payee or Beneficiary *
                            </span>

                            <input
                                type="text"
                                value={payeeName}
                                onChange={(event) =>
                                    setPayeeName(event.target.value)
                                }
                                disabled={saving || posting || cancelling}
                                placeholder="Enter the full name of the payee"
                                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                            />
                        </label>

                        <label className="block lg:col-span-2">
                            <span className="text-sm font-black text-slate-800">
                                Payment Narration *
                            </span>

                            <textarea
                                value={narration}
                                onChange={(event) =>
                                    setNarration(event.target.value)
                                }
                                disabled={saving || posting || cancelling}
                                rows={4}
                                placeholder="Clearly describe the purpose of this payment"
                                className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold leading-7 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                            />
                        </label>

                        <label className="block">
                            <span className="text-sm font-black text-slate-800">
                                Amount *
                            </span>

                            <div className="mt-2 flex overflow-hidden rounded-xl border border-slate-300 bg-white transition focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-100">
                                <span className="flex items-center border-r border-slate-200 bg-slate-50 px-4 font-black text-slate-600">
                                    NGN
                                </span>

                                <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={amount}
                                    onChange={(event) =>
                                        setAmount(event.target.value)
                                    }
                                    disabled={saving || posting || cancelling}
                                    placeholder="0.00"
                                    className="w-full px-4 py-3 font-black text-slate-950 outline-none disabled:bg-slate-100"
                                />
                            </div>
                        </label>

                        <label className="block">
                            <span className="text-sm font-black text-slate-800">
                                Payment Date *
                            </span>

                            <input
                                type="date"
                                value={paymentDate}
                                onChange={(event) =>
                                    setPaymentDate(event.target.value)
                                }
                                disabled={saving || posting || cancelling}
                                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                            />
                        </label>

                        <label className="block">
                            <span className="text-sm font-black text-slate-800">
                                Payment Method
                            </span>

                            <select
                                value={paymentMethod}
                                onChange={(event) =>
                                    setPaymentMethod(
                                        event.target.value
                                    )
                                }
                                disabled={saving || posting || cancelling}
                                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100 disabled:bg-slate-100"
                            >
                                {PAYMENT_METHODS.map((method) => (
                                    <option
                                        key={method}
                                        value={method}
                                    >
                                        {method}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className="text-sm font-black text-slate-800">
                                Payment Reference
                            </span>

                            <input
                                type="text"
                                value={paymentReference}
                                onChange={(event) =>
                                    setPaymentReference(
                                        event.target.value
                                    )
                                }
                                disabled={saving || posting || cancelling}
                                placeholder="Cheque, transfer or receipt reference"
                                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                            />
                        </label>

                        <div className="lg:col-span-2">
                            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                <input
                                    type="checkbox"
                                    checked={confirmPosting}
                                    onChange={(event) =>
                                        setConfirmPosting(
                                            event.target.checked
                                        )
                                    }
                                    disabled={saving || posting || cancelling}
                                    className="mt-1 h-5 w-5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                                />

                                <span>
                                    <span className="block text-sm font-black text-amber-950">
                                        Final posting confirmation
                                    </span>

                                    <span className="mt-1 block text-sm font-semibold leading-6 text-amber-800">
                                        I confirm that the voucher
                                        information, available balance and
                                        supporting physical documents have
                                        been properly verified.
                                    </span>
                                </span>
                            </label>
                        </div>

                        <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row lg:col-span-2">
                            <button
                                type="submit"
                                disabled={saving || posting || cancelling}
                                className="rounded-xl bg-amber-500 px-6 py-3.5 text-sm font-black text-slate-950 shadow-sm transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {saving
                                    ? "Saving Draft…"
                                    : voucherId
                                        ? "Update Draft Voucher"
                                        : "Save as Draft"}
                            </button>

                            <button
                                type="button"
                                onClick={postVoucher}
                                disabled={saving || posting || cancelling}
                                className="rounded-xl bg-emerald-700 px-6 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {posting
                                    ? "Posting Voucher…"
                                    : "Post Voucher & Record Transaction"}
                            </button>

                            {voucherId && (
                                <button
                                    type="button"
                                    onClick={cancelDraft}
                                    disabled={saving || posting || cancelling}
                                    className="rounded-xl border border-red-200 bg-red-50 px-6 py-3.5 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {cancelling ? "Cancelling Draft…" : "Cancel Draft"}
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => clearForm()}
                                disabled={saving || posting || cancelling}
                                className="rounded-xl border border-slate-300 bg-slate-50 px-6 py-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Clear Form
                            </button>
                        </div>
                    </div>

                    <aside className="space-y-4">
                        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5">
                            <p className="text-xs font-black uppercase tracking-[0.15em] text-blue-700">
                                Selected account
                            </p>

                            <h3 className="mt-2 text-lg font-black text-blue-950">
                                {selectedAccount
                                    ? accountLabel(selectedAccount)
                                    : "No account selected"}
                            </h3>

                            {selectedAccount?.account_number && (
                                <p className="mt-1 text-sm font-semibold text-blue-800">
                                    Account number:{" "}
                                    {selectedAccount.account_number}
                                </p>
                            )}

                            <div className="mt-4 rounded-2xl bg-white/80 p-4">
                                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                                    Current balance
                                </p>

                                <p className="mt-1 text-2xl font-black text-slate-950">
                                    {money(currentAccountBalance)}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5">
                            <p className="text-xs font-black uppercase tracking-[0.15em] text-violet-700">
                                Selected subhead
                            </p>

                            <h3 className="mt-2 text-lg font-black text-violet-950">
                                {selectedSubhead
                                    ? subheadLabel(selectedSubhead)
                                    : "No subhead selected"}
                            </h3>

                            {selectedSubhead &&
                                subheadCode(selectedSubhead) && (
                                    <p className="mt-1 text-sm font-semibold text-violet-800">
                                        Code:{" "}
                                        {subheadCode(selectedSubhead)}
                                    </p>
                                )}

                            <div className="mt-4 rounded-2xl bg-white/80 p-4">
                                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                                    Current balance
                                </p>

                                <p className="mt-1 text-2xl font-black text-slate-950">
                                    {money(currentSubheadBalance)}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                            <p className="text-xs font-black uppercase tracking-[0.15em] text-emerald-700">
                                Posting preview
                            </p>

                            <div className="mt-4 space-y-3">
                                <div className="flex items-center justify-between gap-3 border-b border-emerald-200 pb-3">
                                    <span className="text-sm font-bold text-emerald-900">
                                        Voucher amount
                                    </span>

                                    <span className="font-black text-emerald-950">
                                        {money(numericAmount)}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between gap-3 border-b border-emerald-200 pb-3">
                                    <span className="text-sm font-bold text-emerald-900">
                                        Account after posting
                                    </span>

                                    <span
                                        className={`font-black ${accountBalanceAfterPayment <
                                            0
                                            ? "text-red-700"
                                            : "text-emerald-950"
                                            }`}
                                    >
                                        {money(
                                            accountBalanceAfterPayment
                                        )}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-sm font-bold text-emerald-900">
                                        Subhead after posting
                                    </span>

                                    <span
                                        className={`font-black ${subheadBalanceAfterPayment <
                                            0
                                            ? "text-red-700"
                                            : "text-emerald-950"
                                            }`}
                                    >
                                        {money(
                                            subheadBalanceAfterPayment
                                        )}
                                    </span>
                                </div>
                            </div>

                            {(accountBalanceAfterPayment < 0 ||
                                subheadBalanceAfterPayment < 0) &&
                                numericAmount > 0 && (
                                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold leading-6 text-red-800">
                                        The entered amount may exceed an
                                        available account or subhead
                                        balance. The posting RPC should
                                        perform the final authoritative
                                        balance validation.
                                    </div>
                                )}
                        </div>
                    </aside>
                </form>
            </section>

            <section className="mt-6 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:p-7">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">
                            Voucher Records
                        </p>

                        <h2 className="mt-2 text-2xl font-black text-slate-950">
                            Recent Manual Vouchers
                        </h2>

                        <p className="mt-2 text-sm font-semibold text-slate-500">
                            The latest 50 manual vouchers are displayed.
                            Drafts can be reopened and edited.
                        </p>
                    </div>

                    <div className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
                        {manualVouchers.length} record
                        {manualVouchers.length === 1 ? "" : "s"}
                    </div>
                </div>

                {manualVouchers.length === 0 ? (
                    <div className="p-8 text-center sm:p-12">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-100 text-3xl">
                            🧾
                        </div>

                        <h3 className="mt-5 text-xl font-black text-slate-950">
                            No manual vouchers recorded
                        </h3>

                        <p className="mx-auto mt-2 max-w-xl font-semibold leading-7 text-slate-500">
                            Create and save the first manual payment
                            voucher using the form above.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="grid gap-4 p-4 md:hidden">
                            {manualVouchers.map((voucher) => {
                                const posted = isPostedStatus(
                                    voucher.status
                                );

                                return (
                                    <article
                                        key={voucher.id}
                                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                                                    Voucher number
                                                </p>

                                                <p className="mt-1 font-black text-slate-950">
                                                    {voucher.voucher_no ||
                                                        "Pending number"}
                                                </p>
                                            </div>

                                            <span
                                                className={`rounded-full border px-3 py-1 text-xs font-black ${statusClasses(
                                                    voucher.status
                                                )}`}
                                            >
                                                {voucher.status ||
                                                    "Draft"}
                                            </span>
                                        </div>

                                        <div className="mt-4 space-y-3 text-sm">
                                            <div>
                                                <p className="font-black text-slate-500">
                                                    Payee
                                                </p>
                                                <p className="mt-1 font-bold text-slate-900">
                                                    {voucher.payee_name ||
                                                        "Not recorded"}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="font-black text-slate-500">
                                                    Narration
                                                </p>
                                                <p className="mt-1 font-semibold leading-6 text-slate-700">
                                                    {voucher.narration ||
                                                        "Not recorded"}
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <p className="font-black text-slate-500">
                                                        Amount
                                                    </p>
                                                    <p className="mt-1 font-black text-slate-950">
                                                        {money(
                                                            voucher.total_amount ??
                                                            voucher.amount
                                                        )}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="font-black text-slate-500">
                                                        Date
                                                    </p>
                                                    <p className="mt-1 font-bold text-slate-800">
                                                        {readableDate(
                                                            voucher.payment_date ||
                                                            voucher.created_at
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 border-t border-slate-200 pt-4">
                                            {posted ? (
                                                <Link
                                                    href="/finance/vouchers"
                                                    className="inline-flex rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-800"
                                                >
                                                    View in Register
                                                </Link>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        openDraft(
                                                            voucher
                                                        )
                                                    }
                                                    className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-black text-slate-950"
                                                >
                                                    Open Draft
                                                </button>
                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>

                        <div className="hidden overflow-x-auto md:block">
                            <table className="min-w-full">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                                            Voucher
                                        </th>
                                        <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                                            Payee and narration
                                        </th>
                                        <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                                            Amount
                                        </th>
                                        <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                                            Payment
                                        </th>
                                        <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                                            Status
                                        </th>
                                        <th className="px-5 py-4 text-right text-xs font-black uppercase tracking-wide text-slate-500">
                                            Action
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-200">
                                    {manualVouchers.map((voucher) => {
                                        const posted = isPostedStatus(
                                            voucher.status
                                        );

                                        return (
                                            <tr
                                                key={voucher.id}
                                                className="align-top transition hover:bg-slate-50"
                                            >
                                                <td className="px-5 py-5">
                                                    <p className="font-black text-slate-950">
                                                        {voucher.voucher_no ||
                                                            "Pending number"}
                                                    </p>

                                                    <p className="mt-1 text-xs font-semibold text-slate-500">
                                                        Created{" "}
                                                        {readableDate(
                                                            voucher.created_at
                                                        )}
                                                    </p>

                                                    {voucher.prepared_by_name && (
                                                        <p className="mt-1 text-xs font-semibold text-slate-500">
                                                            By{" "}
                                                            {
                                                                voucher.prepared_by_name
                                                            }
                                                        </p>
                                                    )}
                                                </td>

                                                <td className="max-w-md px-5 py-5">
                                                    <p className="font-black text-slate-950">
                                                        {voucher.payee_name ||
                                                            "Unnamed payee"}
                                                    </p>

                                                    <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-slate-600">
                                                        {voucher.narration ||
                                                            "No narration recorded"}
                                                    </p>
                                                </td>

                                                <td className="whitespace-nowrap px-5 py-5">
                                                    <p className="font-black text-slate-950">
                                                        {money(
                                                            voucher.total_amount ??
                                                            voucher.amount
                                                        )}
                                                    </p>
                                                </td>

                                                <td className="px-5 py-5">
                                                    <p className="font-bold text-slate-800">
                                                        {voucher.payment_method ||
                                                            "Not specified"}
                                                    </p>

                                                    <p className="mt-1 text-xs font-semibold text-slate-500">
                                                        {readableDate(
                                                            voucher.payment_date
                                                        )}
                                                    </p>

                                                    {voucher.payment_reference && (
                                                        <p className="mt-1 text-xs font-semibold text-slate-500">
                                                            Ref:{" "}
                                                            {
                                                                voucher.payment_reference
                                                            }
                                                        </p>
                                                    )}
                                                </td>

                                                <td className="px-5 py-5">
                                                    <span
                                                        className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-black ${statusClasses(
                                                            voucher.status
                                                        )}`}
                                                    >
                                                        {voucher.status ||
                                                            "Draft"}
                                                    </span>

                                                    {voucher.posted_at && (
                                                        <p className="mt-2 text-xs font-semibold text-slate-500">
                                                            Posted{" "}
                                                            {readableDate(
                                                                voucher.posted_at
                                                            )}
                                                        </p>
                                                    )}
                                                </td>

                                                <td className="px-5 py-5 text-right">
                                                    {posted ? (
                                                        <Link
                                                            href="/finance/vouchers"
                                                            className="inline-flex rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800 transition hover:bg-emerald-100"
                                                        >
                                                            View Register
                                                        </Link>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                openDraft(
                                                                    voucher
                                                                )
                                                            }
                                                            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-amber-400"
                                                        >
                                                            Open Draft
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </section>
        </main>
    );
}
