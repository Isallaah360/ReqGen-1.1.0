import { supabase } from "@/lib/supabaseClient";

/**
 * ReqGen v4.2 — Finance data shared by the Finance pages.
 * Account lists show the account NAME only, with the bank in small grey text
 * (some names exist at two banks). No payment words in account lists.
 */

export type Account = {
  id: string;
  code: string | null;
  name: string;
  bank_name: string | null;
  is_active: boolean | null;
  total_fund: number | null;
  allocated_amount: number | null;
  reserved_amount: number | null;
  expenditure: number | null;
  unallocated_balance: number | null;
  available_balance: number | null;
  updated_at: string | null;
};

export type Subhead = {
  id: string;
  dept_id: string | null;
  code: string | null;
  name: string;
  approved_allocation: number | null;
  reserved_amount: number | null;
  expenditure: number | null;
  balance: number | null;
  is_active: boolean | null;
  bank_account_id: string | null;
};

export type Assignment = { id: string; account_id: string; officer_user_id: string; created_at: string | null };
export type Person = { id: string; full_name: string | null; email: string | null; role: string | null };

export type Transfer = {
  id: string; transfer_no: string; kind: "account" | "subhead"; from_label: string; to_label: string;
  from_account_id: string | null; to_account_id: string | null; from_subhead_id: string | null; to_subhead_id: string | null;
  amount: number; narration: string; external_reference: string | null; status: string;
  initiated_by: string | null; initiated_label: string | null; initiated_at: string;
  checked_label: string | null; checked_at: string | null; check_comment: string | null;
  approved_label: string | null; approved_signature: string | null; approved_at: string | null; approve_comment: string | null;
  stamped: boolean; acting_for_dg: boolean; returned_reason: string | null; created_at: string;
};

export const ACCOUNT_COLUMNS = "id,code,name,bank_name,is_active,total_fund,allocated_amount,reserved_amount,expenditure,unallocated_balance,available_balance,updated_at";
export const SUBHEAD_COLUMNS = "id,dept_id,code,name,approved_allocation,reserved_amount,expenditure,balance,is_active,bank_account_id";

export const num = (v: unknown) => Number(v || 0);

/** "Admin" with "IET002 · Zenith Bank" under it. */
export function accountName(a: Pick<Account, "name"> | null | undefined) { return a?.name || "IET account"; }
export function accountSub(a: Pick<Account, "code" | "bank_name"> | null | undefined) {
  return [a?.code, a?.bank_name].filter(Boolean).join(" · ");
}
export function subheadLabel(s: Pick<Subhead, "code" | "name"> | null | undefined) {
  return s ? `${s.code ? `${s.code} — ` : ""}${s.name}` : "—";
}

/** Money free to spend in an account (fund minus spending and reservations). */
export function accountAvailable(a: Account) {
  if (a.available_balance !== null && a.available_balance !== undefined) return num(a.available_balance);
  return num(a.total_fund) - num(a.expenditure) - num(a.reserved_amount);
}
/** Fund not yet given to any subhead. */
export function accountUnallocated(a: Account) {
  if (a.unallocated_balance !== null && a.unallocated_balance !== undefined) return num(a.unallocated_balance);
  return num(a.total_fund) - num(a.allocated_amount);
}
export function subheadUsed(s: Subhead) { return num(s.expenditure) + num(s.reserved_amount); }
export function subheadLeft(s: Subhead) { return num(s.approved_allocation) - subheadUsed(s); }
export function utilisation(s: Subhead) {
  const a = num(s.approved_allocation);
  return a > 0 ? Math.round((subheadUsed(s) / a) * 100) : 0;
}

export function fyOf(d = new Date()) { return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; }

export type FinanceSettings = { default_payment_method: "Transfer" | "Cheque" | "Cash"; cash_dg_note_above: number };
export async function loadFinanceSettings(): Promise<FinanceSettings> {
  const { data } = await supabase.from("reqgen_finance_settings").select("key,value");
  const m = Object.fromEntries(((data || []) as Array<{ key: string; value: string | null }>).map((r) => [r.key, r.value]));
  const pm = m.default_payment_method;
  return {
    default_payment_method: pm === "Cheque" || pm === "Cash" ? pm : "Transfer",
    cash_dg_note_above: Number(m.cash_dg_note_above || 200000),
  };
}

export const TRANSFER_TONE: Record<string, "amber" | "green" | "red" | "grey" | "blue"> = {
  "With the Auditor": "amber",
  "With the DG": "amber",
  Approved: "green",
  Returned: "red",
  Rejected: "red",
  Cancelled: "grey",
};

/** Banks most IET accounts and payees use (the list can be typed over). */
export const NIGERIAN_BANKS = [
  "Access Bank", "Citibank", "Ecobank", "Fidelity Bank", "First Bank", "FCMB", "Globus Bank", "GT-Bank", "Jaiz Bank",
  "Keystone Bank", "Lotus Bank", "Moniepoint", "OPay", "Optimus Bank", "Palmpay", "Parallex Bank", "Polaris Bank",
  "Providus Bank", "Stanbic IBTC", "Standard Chartered", "Sterling Bank", "SunTrust Bank", "TAJBank", "Titan Trust Bank",
  "UBA Bank", "Union Bank", "Unity Bank", "Wema Bank", "Zenith Bank",
];
