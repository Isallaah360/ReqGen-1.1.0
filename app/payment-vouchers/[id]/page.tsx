"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type VoucherDetail = {
  id: string;
  voucher_no: string;
  request_id: string;
  request_no: string | null;
  request_type: string | null;
  personal_category: string | null;

  payee_name: string | null;
  narration: string | null;
  amount: number | null;

  dept_id: string | null;
  dept_name: string | null;

  subhead_id: string | null;
  subhead_code: string | null;
  subhead_name: string | null;

  prepared_by: string | null;
  prepared_by_name: string | null;
  prepared_signature_url: string | null;
  prepared_at: string | null;

  checked_by: string | null;
  checked_by_name: string | null;
  checked_signature_url: string | null;
  checked_at: string | null;

  authorized_by: string | null;
  authorized_by_name: string | null;
  authorized_signature_url: string | null;
  authorized_at: string | null;

  cheque_no: string | null;
  cheque_date: string | null;
  bank_name: string | null;

  cheque_signed_by: string | null;
  cheque_signed_by_name: string | null;
  cheque_signed_signature_url: string | null;
  cheque_signed_at: string | null;

  cheque_counter_signed_by: string | null;
  cheque_counter_signed_by_name: string | null;
  cheque_counter_signed_signature_url: string | null;
  cheque_counter_signed_at: string | null;

  payee_signed_name: string | null;
  payee_signature_url: string | null;
  payee_signed_at: string | null;

  disbursement_mode: string | null;
  transfer_account_name: string | null;
  transfer_account_number: string | null;
  transfer_bank_name: string | null;
  cash_payee_name: string | null;
  counter_signatory_name: string | null;

  current_signing_owner: string | null;
  signing_stage: string | null;

  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type Hist = {
  id: string;
  action_type: string | null;
  from_status: string | null;
  to_status: string | null;
  comment: string | null;
  actor_name: string | null;
  actor_role: string | null;
  actor_signature_url: string | null;
  created_at: string;
};

type ProfileMini = {
  id: string;
  role: string | null;
};

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function normalize(v: string | null | undefined) {
  return (v || "").toLowerCase().replace(/[^a-z]/g, "");
}

function naira(n: number | null | undefined) {
  return "₦" + Math.round(Number(n || 0)).toLocaleString();
}

function shortDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function shortDateTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

function categoryLabel(v: VoucherDetail | null) {
  const rt = normalize(v?.request_type);
  const pc = normalize(v?.personal_category);

  if (rt === "official") return "Official";
  if (rt === "personal" && pc === "fund") return "Personal Fund";
  if (rt === "personal" && pc === "nonfund") return "Personal NonFund";
  return v?.request_type || "—";
}

function statusBadgeClass(status: string | null | undefined) {
  const s = (status || "").toLowerCase();

  if (s.includes("paid")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s.includes("cancel")) return "border-red-200 bg-red-50 text-red-700";
  if (s.includes("counter")) return "border-purple-200 bg-purple-50 text-purple-700";
  if (s.includes("cheque signed")) return "border-blue-200 bg-blue-50 text-blue-700";
  if (s.includes("cheque")) return "border-amber-200 bg-amber-50 text-amber-700";
  if (s.includes("authorized") || s.includes("checked")) return "border-blue-200 bg-blue-50 text-blue-700";

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function modeBadgeClass(mode: string | null | undefined) {
  const m = normalize(mode);

  if (m === "transfer") return "border-blue-200 bg-blue-50 text-blue-700";
  if (m === "cash") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (m === "cheque") return "border-amber-200 bg-amber-50 text-amber-700";

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function signingStageBadgeClass(stage: string | null | undefined) {
  const s = (stage || "").toLowerCase();

  if (s.includes("cheque")) return "border-blue-200 bg-blue-50 text-blue-700";
  if (s.includes("counter")) return "border-purple-200 bg-purple-50 text-purple-700";
  if (s.includes("completed")) return "border-emerald-200 bg-emerald-50 text-emerald-700";

  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function PaymentVoucherDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = String((params as any)?.id || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [me, setMe] = useState<ProfileMini | null>(null);
  const rk = roleKey(me?.role);

  const [voucher, setVoucher] = useState<VoucherDetail | null>(null);
  const [history, setHistory] = useState<Hist[]>([]);

  const [comment, setComment] = useState("");

  const isFinanceRole = ["admin", "auditor", "account", "accounts", "accountofficer"].includes(rk);
  const isAdminOrAuditor = ["admin", "auditor"].includes(rk);

  const isCheque = normalize(voucher?.disbursement_mode) === "cheque";
  const isTransfer = normalize(voucher?.disbursement_mode) === "transfer";
  const isCash = normalize(voucher?.disbursement_mode) === "cash";

  const isSelectedChequeSigner = !!me?.id && !!voucher?.cheque_signed_by && me.id === voucher.cheque_signed_by;
  const isSelectedCounterSigner =
    !!me?.id && !!voucher?.cheque_counter_signed_by && me.id === voucher.cheque_counter_signed_by;

  const isCurrentSigningOwner =
    !!me?.id && !!voucher?.current_signing_owner && me.id === voucher.current_signing_owner;

  const canAccess = useMemo(() => {
    if (!me || !voucher) return false;

    if (isFinanceRole) return true;
    if (isSelectedChequeSigner) return true;
    if (isSelectedCounterSigner) return true;
    if (isCurrentSigningOwner) return true;

    return false;
  }, [
    me,
    voucher,
    isFinanceRole,
    isSelectedChequeSigner,
    isSelectedCounterSigner,
    isCurrentSigningOwner,
  ]);

  const canSignCheque =
    isCheque &&
    voucher?.status === "Cheque Prepared" &&
    voucher?.signing_stage === "Awaiting Cheque Signature" &&
    isSelectedChequeSigner &&
    isCurrentSigningOwner;

  const canCounterSignCheque =
    isCheque &&
    voucher?.status === "Cheque Signed" &&
    voucher?.signing_stage === "Awaiting Counter Signature" &&
    isSelectedCounterSigner &&
    isCurrentSigningOwner;

  const canPayVoucher = isFinanceRole && voucher?.status !== "Paid" && voucher?.status !== "Cancelled";

  const canCancelVoucher = isFinanceRole && voucher?.status !== "Paid" && voucher?.status !== "Cancelled";

  async function load() {
    setLoading(true);
    setMsg(null);

    if (!id) {
      setMsg("Invalid voucher ID.");
      setLoading(false);
      return;
    }

    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      router.push("/login");
      return;
    }

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("id,role")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (profErr || !prof) {
      setMsg("Failed to load your profile: " + (profErr?.message || "Profile not found."));
      setLoading(false);
      return;
    }

    setMe(prof as ProfileMini);

    const [detailRes, histRes] = await Promise.all([
      supabase.rpc("get_payment_voucher_detail", { p_voucher_id: id }),
      supabase.rpc("get_payment_voucher_history", { p_voucher_id: id }),
    ]);

    if (detailRes.error) {
      setMsg("Failed to load voucher: " + detailRes.error.message);
      setVoucher(null);
      setLoading(false);
      return;
    }

    const row = Array.isArray(detailRes.data)
      ? (detailRes.data[0] as VoucherDetail | undefined)
      : (detailRes.data as VoucherDetail | undefined);

    if (!row) {
      setMsg("Payment voucher not found.");
      setVoucher(null);
      setLoading(false);
      return;
    }

    setVoucher(row);

    if (histRes.error) {
      setMsg("Failed to load voucher history: " + histRes.error.message);
      setHistory([]);
    } else {
      setHistory((histRes.data || []) as Hist[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function runFinanceAction(actionType: string) {
    if (!voucher) return;

    if (!isFinanceRole) {
      setMsg("❌ Access denied. Only Finance/Admin/Auditor/Account can perform this action.");
      return;
    }

    const ok = confirm(`Proceed with "${actionType}" for this voucher?`);
    if (!ok) return;

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase.rpc("update_payment_voucher_status", {
        p_voucher_id: voucher.id,
        p_action_type: actionType,
        p_comment: comment.trim() || null,
        p_cheque_no: null,
        p_cheque_date: null,
        p_bank_name: null,
      });

      if (error) throw new Error(error.message);

      setMsg(`✅ Voucher action completed: ${actionType}`);
      setComment("");
      await load();
    } catch (e: any) {
      setMsg("❌ Action failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function signCheque() {
    if (!voucher) return;

    if (!canSignCheque) {
      setMsg("❌ Only the selected Cheque Signer can sign this voucher at this stage.");
      return;
    }

    const ok = confirm(
      `Sign cheque for ${voucher.voucher_no}?\n\nYour saved profile signature will be appended to this payment voucher.`
    );

    if (!ok) return;

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase.rpc("sign_payment_voucher_cheque", {
        p_voucher_id: voucher.id,
      });

      if (error) throw new Error(error.message);

      setMsg("✅ Cheque signed successfully. It has now been sent for counter signature.");
      setComment("");
      await load();
    } catch (e: any) {
      setMsg("❌ Cheque signing failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function counterSignCheque() {
    if (!voucher) return;

    if (!canCounterSignCheque) {
      setMsg("❌ Only the selected Counter Signer can counter-sign this voucher at this stage.");
      return;
    }

    const ok = confirm(
      `Counter-sign cheque for ${voucher.voucher_no}?\n\nYour saved profile signature will be appended to this payment voucher.`
    );

    if (!ok) return;

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase.rpc("counter_sign_payment_voucher_cheque", {
        p_voucher_id: voucher.id,
      });

      if (error) throw new Error(error.message);

      setMsg("✅ Cheque counter-signed successfully. The voucher is now ready for payment.");
      setComment("");
      await load();
    } catch (e: any) {
      setMsg("❌ Counter-signing failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteVoucher() {
    if (!voucher) return;

    if (!isAdminOrAuditor) {
      setMsg("❌ Only Admin and Auditor can delete payment vouchers.");
      return;
    }

    const ok = confirm(
      `Permanently delete ${voucher.voucher_no}?\n\nThis will allow request ${voucher.request_no || ""} to generate a new PV.\n\nThis action cannot be undone.`
    );

    if (!ok) return;

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase.rpc("delete_payment_voucher_for_regeneration", {
        p_voucher_id: voucher.id,
      });

      if (error) throw new Error(error.message);

      router.push("/payment-vouchers");
    } catch (e: any) {
      setMsg("❌ Failed to delete voucher: " + (e?.message || "Unknown error"));
      setSaving(false);
    }
  }

  const financeActionButtons = useMemo(() => {
    if (!voucher || !isFinanceRole) return [];

    if (voucher.status === "Cancelled" || voucher.status === "Paid") return [];

    if (normalize(voucher.disbursement_mode) === "transfer") {
      return [{ label: "Mark Transfer as Paid", action: "Pay", tone: "emerald" }];
    }

    if (normalize(voucher.disbursement_mode) === "cash") {
      return [{ label: "Mark Cash as Paid", action: "Pay", tone: "emerald" }];
    }

    if (normalize(voucher.disbursement_mode) === "cheque") {
      if (voucher.status === "Counter Signed") {
        return [{ label: "Mark Cheque as Paid", action: "Pay", tone: "emerald" }];
      }

      return [];
    }

    return [];
  }, [voucher, isFinanceRole]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-6xl py-10 text-slate-600">
          Loading payment voucher...
        </div>
      </main>
    );
  }

  if (!voucher || !canAccess) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-3xl py-10">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h1 className="text-xl font-extrabold text-slate-900">Payment Voucher</h1>
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {msg || "Access denied or voucher not found."}
            </div>

            <button
              onClick={() => router.push("/dashboard")}
              className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-6xl py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Payment Voucher
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Review, sign, manage and print official IET payment voucher.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {isFinanceRole && (
              <button
                onClick={() => router.push("/payment-vouchers")}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Back to Vouchers
              </button>
            )}

            <button
              onClick={() => router.push(`/requests/${voucher.request_id}`)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Open Request
            </button>

            <button
              onClick={() => router.push(`/payment-vouchers/${voucher.id}/print`)}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Print Voucher
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-2xl border bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
            {msg}
          </div>
        )}

        {isCheque && voucher.status !== "Paid" && voucher.status !== "Cancelled" && (
          <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
            <div className="font-extrabold">Cheque Signing Status</div>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              <div>
                <span className="font-semibold">Current Stage:</span>{" "}
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${signingStageBadgeClass(voucher.signing_stage)}`}>
                  {voucher.signing_stage || "—"}
                </span>
              </div>

              <div>
                <span className="font-semibold">Cheque Signer:</span>{" "}
                {voucher.cheque_signed_by_name || "—"}
                {voucher.cheque_signed_at ? " ✅" : ""}
              </div>

              <div>
                <span className="font-semibold">Counter Signer:</span>{" "}
                {voucher.cheque_counter_signed_by_name || "—"}
                {voucher.cheque_counter_signed_at ? " ✅" : ""}
              </div>
            </div>

            {canSignCheque && (
              <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
                This PV is assigned to you for cheque signature. Review the voucher details before signing.
              </div>
            )}

            {canCounterSignCheque && (
              <div className="mt-3 rounded-2xl border border-purple-200 bg-purple-50 p-4 text-purple-900">
                This PV is assigned to you for counter signature. Review the voucher details before counter-signing.
              </div>
            )}
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <InfoCard title="Voucher No" value={voucher.voucher_no} />
          <InfoCard title="Request No" value={voucher.request_no || "—"} />
          <InfoCard title="Amount" value={naira(voucher.amount)} />
          <InfoCard title="Status" value={voucher.status || "—"} badge />
        </div>

        <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Voucher Details</h2>
              <p className="mt-1 text-sm text-slate-600">
                Payee, narration, department and approval metadata.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${modeBadgeClass(voucher.disbursement_mode)}`}>
                {voucher.disbursement_mode || "No Mode"}
              </span>

              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusBadgeClass(voucher.status)}`}>
                {voucher.status || "—"}
              </span>

              {voucher.signing_stage && (
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${signingStageBadgeClass(voucher.signing_stage)}`}>
                  {voucher.signing_stage}
                </span>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <InfoLine label="Payee" value={voucher.payee_name || "—"} />
            <InfoLine label="Category" value={categoryLabel(voucher)} />
            <InfoLine label="Department" value={voucher.dept_name || "—"} />
            <InfoLine
              label="Subhead"
              value={
                voucher.subhead_id
                  ? `${voucher.subhead_code || ""} — ${voucher.subhead_name || ""}`.trim()
                  : "—"
              }
            />
            <InfoLine label="Prepared By" value={voucher.prepared_by_name || "—"} />
            <InfoLine label="Prepared At" value={shortDateTime(voucher.prepared_at)} />
            <InfoLine label="Checked By" value={voucher.checked_by_name || "—"} />
            <InfoLine label="Authorized By" value={voucher.authorized_by_name || "—"} />
          </div>

          <div className="mt-5">
            <div className="text-sm font-semibold text-slate-800">Narration</div>
            <div className="mt-2 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
              {voucher.narration || "—"}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Disbursement Details</h2>
          <p className="mt-1 text-sm text-slate-600">
            Payment mode and supporting transfer, cash or cheque information.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <InfoLine label="Mode" value={voucher.disbursement_mode || "—"} />

            {isTransfer && (
              <>
                <InfoLine label="Account Name" value={voucher.transfer_account_name || "—"} />
                <InfoLine label="Account Number" value={voucher.transfer_account_number || "—"} />
                <InfoLine label="Bank Name" value={voucher.transfer_bank_name || "—"} />
              </>
            )}

            {isCash && (
              <>
                <InfoLine label="Cash Payee Name" value={voucher.cash_payee_name || voucher.payee_name || "—"} />
                <InfoLine label="Received By" value={voucher.payee_signed_name || "—"} />
                <InfoLine label="Received Date" value={shortDate(voucher.payee_signed_at)} />
              </>
            )}

            {isCheque && (
              <>
                <InfoLine label="Cheque No" value={voucher.cheque_no || "—"} />
                <InfoLine label="Cheque Date" value={shortDate(voucher.cheque_date)} />
                <InfoLine label="Bank Name" value={voucher.bank_name || "—"} />
                <InfoLine label="Cheque Signed By" value={voucher.cheque_signed_by_name || "—"} />
                <InfoLine label="Cheque Signed At" value={shortDateTime(voucher.cheque_signed_at)} />
                <InfoLine label="Counter Signed By" value={voucher.cheque_counter_signed_by_name || "—"} />
                <InfoLine label="Counter Signed At" value={shortDateTime(voucher.cheque_counter_signed_at)} />
              </>
            )}

            {!isTransfer && !isCash && !isCheque && (
              <>
                <InfoLine label="Account / Cheque No" value="—" />
                <InfoLine label="Bank" value="—" />
              </>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Voucher Actions</h2>
          <p className="mt-1 text-sm text-slate-600">
            Actions are shown based on your role and the voucher’s current status.
          </p>

          {isFinanceRole && (
            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-800">Comment</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="mt-1 min-h-[90px] w-full rounded-2xl border border-slate-200 px-3 py-3 outline-none focus:border-blue-500"
                placeholder="Optional comment for finance actions..."
              />
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {canSignCheque && (
              <button
                onClick={signCheque}
                disabled={saving}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Signing..." : "Sign Cheque"}
              </button>
            )}

            {canCounterSignCheque && (
              <button
                onClick={counterSignCheque}
                disabled={saving}
                className="rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
              >
                {saving ? "Counter Signing..." : "Counter Sign Cheque"}
              </button>
            )}

            {financeActionButtons.map((a) => (
              <button
                key={a.action}
                onClick={() => runFinanceAction(a.action)}
                disabled={saving}
                className={`rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 ${
                  a.tone === "emerald"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : a.tone === "purple"
                    ? "bg-purple-600 hover:bg-purple-700"
                    : a.tone === "amber"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {saving ? "Working..." : a.label}
              </button>
            ))}

            {canCancelVoucher && (
              <button
                onClick={() => runFinanceAction("Cancel")}
                disabled={saving}
                className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                Cancel Voucher
              </button>
            )}

            {isAdminOrAuditor && (
              <button
                onClick={deleteVoucher}
                disabled={saving}
                className="rounded-xl bg-red-800 px-4 py-3 text-sm font-semibold text-white hover:bg-red-900 disabled:opacity-60"
              >
                Delete PV for Regeneration
              </button>
            )}

            {!canSignCheque &&
              !canCounterSignCheque &&
              financeActionButtons.length === 0 &&
              !canCancelVoucher &&
              !isAdminOrAuditor && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  No action is currently assigned to you for this voucher.
                </div>
              )}
          </div>
        </div>

        <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Voucher History</h2>

          {history.length === 0 ? (
            <div className="mt-4 text-sm text-slate-700">No voucher history yet.</div>
          ) : (
            <div className="mt-4 space-y-3">
              {history.map((h) => (
                <div key={h.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-slate-900">
                      {h.actor_name || "Officer"} • {h.action_type || "Action"}
                    </div>
                    <div className="text-xs text-slate-500">{shortDateTime(h.created_at)}</div>
                  </div>

                  <div className="mt-1 text-sm text-slate-700">
                    {h.from_status || "—"} → <b>{h.to_status || "—"}</b>
                  </div>

                  {h.comment && (
                    <div className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                      {h.comment}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function InfoCard({
  title,
  value,
  badge,
}: {
  title: string;
  value: string;
  badge?: boolean;
}) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      <div
        className={`mt-3 inline-flex rounded-2xl px-3 py-2 text-lg font-extrabold ${
          badge ? statusBadgeClass(value) + " border" : "bg-slate-50 text-slate-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}