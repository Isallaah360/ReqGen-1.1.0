import type { ChipTone } from "@/app/components/v4/ui";

/**
 * ReqGen v4.3 — payment voucher words shared by every voucher page.
 * Signing order (Build Reference §8): Account Officer prepares → Auditor checks →
 * Counter Signer → Director General signs, stamps and authorises → paid.
 */

export type Voucher = {
  id: string; voucher_no: string | null; request_id: string | null; request_no: string | null; request_type: string | null;
  personal_category: string | null; payee_name: string | null; narration: string | null; amount: number | null; total_amount: number | null;
  dept_id: string | null; dept_name: string | null; subhead_id: string | null; subhead_code: string | null; subhead_name: string | null;
  prepared_by: string | null; prepared_by_name: string | null; prepared_signature_url: string | null; prepared_at: string | null;
  checked_by: string | null; checked_by_name: string | null; checked_signature_url: string | null; checked_at: string | null;
  authorized_by: string | null; authorized_by_name: string | null; authorized_signature_url: string | null; authorized_at: string | null;
  cheque_no: string | null; cheque_date: string | null; bank_name: string | null;
  cheque_counter_signed_by: string | null; cheque_counter_signed_by_name: string | null; cheque_counter_signed_signature_url: string | null; cheque_counter_signed_at: string | null;
  disbursement_mode: string | null; transfer_account_name: string | null; transfer_account_number: string | null; transfer_bank_name: string | null;
  cash_payee_name: string | null; counter_signatory_name: string | null; current_signing_owner: string | null; signing_stage: string | null;
  is_multi_request: boolean | null; item_count: number | null; voucher_scope: string | null; status: string | null;
  voucher_type: string | null; voucher_origin: string | null; created_at: string | null; updated_at: string | null;
  prepared_section?: string | null; reissue_of?: string | null; returned_reason?: string | null; returned_by_name?: string | null; returned_at?: string | null;
  payee_count?: number | null; cancel_reason?: string | null; paid_on?: string | null; paid_reference?: string | null; paid_by_name?: string | null; paid_at?: string | null;
};

export type ScheduleLine = { id: string; voucher_id: string; payee_name: string; account_name: string; account_number: string; bank_name: string; amount: number; request_ids: string[]; line_no: number };

export const SECTIONS = ["General Admin", "DIN", "ASAP-ALLI"] as const;

export function pvAmount(v: Pick<Voucher, "total_amount" | "amount">) { return Number(v.total_amount ?? v.amount ?? 0); }
export function isManual(v: Pick<Voucher, "voucher_type" | "voucher_origin">) { return v.voucher_type === "Manual" || v.voucher_origin === "Manual"; }

export type PvStage = "check" | "counter" | "dg" | "ready" | "paid" | "cancelled" | "returned" | "draft";
export function pvStage(status: string | null | undefined): PvStage {
  const s = String(status || "");
  if (s === "Pending Check") return "check";
  if (s === "Pending Counter Signature" || s === "Pending Cheque Signature") return "counter";
  if (s === "Pending DG Authorisation") return "dg";
  if (s === "Authorized") return "ready";
  if (s === "Paid") return "paid";
  if (s === "Cancelled") return "cancelled";
  if (s === "Returned to Account") return "returned";
  return "draft";
}

export function pvChip(status: string | null | undefined): { tone: ChipTone; label: string } {
  switch (pvStage(status)) {
    case "check": return { tone: "amber", label: "Pending check" };
    case "counter": return { tone: "amber", label: "With Counter Signer" };
    case "dg": return { tone: "amber", label: "With DG" };
    case "ready": return { tone: "blue", label: "Ready to pay" };
    case "paid": return { tone: "green", label: "Paid" };
    case "cancelled": return { tone: "red", label: "Cancelled" };
    case "returned": return { tone: "red", label: "Back with Account" };
    default: return { tone: "grey", label: String(status || "Draft") };
  }
}

export function pvNowWith(v: Voucher) {
  switch (pvStage(v.status)) {
    case "check": return "Auditor";
    case "counter": return v.cheque_counter_signed_by_name || v.counter_signatory_name || "Counter Signer";
    case "dg": return "Director General";
    case "ready": case "returned": return v.prepared_by_name ? `${v.prepared_by_name} (Account)` : "Account Officer";
    default: return "—";
  }
}

export function pvInSigning(status: string | null | undefined) { return ["check", "counter", "dg"].includes(pvStage(status)); }

export function pvMode(v: Voucher) {
  const m = v.disbursement_mode || "Transfer";
  if (m === "Transfer") return Number(v.payee_count || 1) > 1 ? `Transfer · ${v.payee_count} accounts` : `Transfer${v.transfer_bank_name ? ` · ${v.transfer_bank_name}` : ""}`;
  if (m === "Cheque") return `Cheque${v.cheque_no ? ` ${v.cheque_no}` : ""}${v.bank_name ? ` · ${v.bank_name}` : ""}`;
  return "Cash";
}

/** Signing steps as shown on the record and the tracker. */
export function pvSteps(v: Voucher) {
  const st = pvStage(v.status);
  const order: PvStage[] = ["check", "counter", "dg", "ready", "paid"];
  const pos = st === "returned" ? 0 : order.indexOf(st);
  return [
    { key: "prepared", label: "Prepared", who: v.prepared_by_name || "Account Officer", role: `Account Officer${v.prepared_section ? `, ${v.prepared_section}` : ""}`, at: v.prepared_at || v.created_at, sig: v.prepared_signature_url, state: "done" as const },
    { key: "checked", label: "Checked", who: v.checked_by_name || "Patricia Michael", role: "Auditor", at: v.checked_at, sig: v.checked_signature_url, state: v.checked_at ? "done" as const : pos === 0 && st !== "returned" ? "now" as const : "wait" as const },
    { key: "counter", label: "Counter-signed", who: v.cheque_counter_signed_by_name || v.counter_signatory_name || "Counter Signer", role: "Counter Signer", at: v.cheque_counter_signed_at, sig: v.cheque_counter_signed_signature_url, state: v.cheque_counter_signed_at ? "done" as const : st === "counter" ? "now" as const : "wait" as const },
    { key: "dg", label: "Signed, stamped & authorised", who: v.authorized_by_name || "Director General", role: "Director General", at: v.authorized_at, sig: v.authorized_signature_url, state: v.authorized_at ? "done" as const : st === "dg" ? "now" as const : "wait" as const },
    { key: "paid", label: "Paid", who: v.paid_by_name || "Account Officer", role: "Payee receives", at: v.paid_at, sig: null, state: st === "paid" ? "done" as const : st === "ready" ? "now" as const : "wait" as const },
  ];
}
