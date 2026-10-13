import { supabase } from "@/lib/supabaseClient";
import { normalizeRole } from "@/lib/roles";

/**
 * ReqGen v4.4 — shared report helpers. Who sees what is decided in the
 * database (reqgen_report_tier); the page only mirrors it for the labels.
 *   all      Super Admin and Auditor — every department
 *   finance  Account Officers, DG, General Secretary — finance for every department
 *   mine     everyone else — their own requests and money paid to them
 */
export type Tier = "all" | "finance" | "mine";

export function tierFromRole(role: string): Tier {
  const r = normalizeRole(role).replace(/\d+$/, "");
  if (r === "admin" || r === "auditor") return "all";
  if (["account", "accounts", "accountofficer", "dg", "directorgeneral", "generalsecretary"].includes(r)) return "finance";
  return "mine";
}

export async function loadTier(role: string): Promise<Tier> {
  const { data, error } = await supabase.rpc("reqgen_report_tier");
  if (!error && (data === "all" || data === "finance" || data === "mine")) return data;
  return tierFromRole(role);
}

export function scopeLabel(tier: Tier, roleName: string, what = "") {
  const view = tier === "all" ? "all departments" : tier === "finance" ? `${what || "finance"} for all departments` : "your own requests";
  return `Your view: ${view} · ${roleName}`;
}

export const pad = (n: number) => String(n).padStart(2, "0");
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function fyLabel(y: number) { return `${y}/${String((y + 1) % 100).padStart(2, "0")}`; }
export function fyOfMonth(ym: string) { const [y, m] = ym.split("-").map(Number); return m >= 9 ? y : y - 1; }
export function fyRange(y: number) { return { from: `${y}-09-01`, to: `${y + 1}-08-31` }; }
export function thisMonth() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
export function addMonths(ym: string, n: number) { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
export function monthRange(ym: string) { const [y, m] = ym.split("-").map(Number); return { from: `${ym}-01`, to: iso(new Date(y, m, 0)) }; }
export function monthName(ym: string, short = false) { const [y, m] = ym.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("en-GB", short ? { month: "short" } : { month: "long", year: "numeric" }); }
/** The 12 months ending with `ym`, oldest first. */
export function last12(ym: string) { return Array.from({ length: 12 }, (_, i) => addMonths(ym, i - 11)); }
/** September … August of a financial year. */
export function fyMonths(y: number) { return Array.from({ length: 12 }, (_, i) => addMonths(`${y}-09`, i)); }
export const monthOf = (at: string | null | undefined) => String(at || "").slice(0, 7);

export function nairaShort(n: number) {
  const v = Math.abs(n);
  if (v >= 1_000_000) return `₦ ${(n / 1_000_000).toFixed(2)}m`;
  if (v >= 1_000) return `₦ ${Math.round(n / 1_000).toLocaleString("en-GB")}k`;
  return `₦ ${Math.round(n).toLocaleString("en-GB")}`;
}
export function pct(part: number, whole: number) { return whole > 0 ? Math.round((part / whole) * 100) : 0; }
export function change(now: number, before: number) {
  if (!before) return now ? "new this month" : "no change";
  const p = Math.round(((now - before) / before) * 100);
  return `${p >= 0 ? "+" : ""}${p}% on ${"last month"}`;
}

/** Expense group from the subhead code: "GA05" → "GA". */
export function groupOf(code: string | null | undefined) { return (String(code || "").match(/^[A-Za-z]+/)?.[0] || "Other").toUpperCase(); }

export async function logPrint(kind: "request" | "voucher" | "report", id: string | null, no: string) {
  try { await supabase.rpc("reqgen_log_print", { p_kind: kind, p_doc_id: id, p_doc_no: no }); } catch { /* the print still goes ahead */ }
}

export type TxRow = {
  kind: "out" | "pending" | "in" | "transfer"; at: string; voucher_id: string | null; ref: string; title: string; detail: string; amount: number;
  status: string; mode: string; dept_name: string; subhead_code: string; subhead_name: string; request_no: string | null; days_to_pay: number | null;
};
export async function loadTransactions(from: string, to: string) {
  const { data, error } = await supabase.rpc("reqgen_report_transactions", { p_from: from, p_to: to });
  return { rows: ((data || []) as TxRow[]).map((r) => ({ ...r, amount: Number(r.amount || 0) })), error: error?.message || null };
}

export type SpendRow = { at: string; ref: string; detail: string; amount: number; subhead_id: string | null; subhead_code: string | null; subhead_name: string | null; dept_id: string | null; dept_name: string | null; source: string };
export async function loadSpend(from: string | null, to: string | null) {
  const { data, error } = await supabase.rpc("reqgen_report_spend", { p_from: from, p_to: to });
  return { rows: ((data || []) as SpendRow[]).map((r) => ({ ...r, amount: Number(r.amount || 0) })), error: error?.message || null };
}
