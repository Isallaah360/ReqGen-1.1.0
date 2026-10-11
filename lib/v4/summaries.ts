"use client";

import { supabase } from "@/lib/supabaseClient";
import { isAwaitingUser, isClosedRequest, type ApprovalQueueRow } from "@/lib/approvalQueue";
import type { Tone } from "@/lib/v4/modules";

/**
 * ReqGen v4 — live numbers for the mother pages.
 * Every figure is read with the signed-in person's own permissions (row-level
 * security), so nobody sees a number about records they may not open.
 * A query that fails shows "—" instead of a wrong zero.
 */

export type SummaryStat = { label: string; value: string; note?: string; icon: string; tone: Tone; href?: string };
export type Summary = { stats: SummaryStat[]; meta: Record<string, string> };

const DASH = "—";

function n(v: number | null | undefined) {
  return v === null || v === undefined ? DASH : v.toLocaleString("en-GB");
}

export function nairaShort(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(v)) return DASH;
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `₦ ${(v / 1_000_000_000).toFixed(2)}bn`;
  if (abs >= 1_000_000) return `₦ ${(v / 1_000_000).toFixed(2)}m`;
  return `₦ ${Math.round(v).toLocaleString("en-GB")}`;
}

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function dayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function plural(v: number, one: string, many = `${one}s`) {
  return `${v.toLocaleString("en-GB")} ${v === 1 ? one : many}`;
}

function daysSince(iso: string | null | undefined) {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 86_400_000)) : 0;
}

type ReqRow = ApprovalQueueRow & { id: string; amount?: number | null; created_at?: string | null; created_by?: string | null };

async function myRequests(userId: string) {
  const { data, error } = await supabase
    .from("requests")
    .select("id,status,current_stage,current_owner,amount,created_at")
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .limit(1000);
  return error ? null : ((data || []) as ReqRow[]);
}

async function visibleQueue() {
  const { data, error } = await supabase
    .from("requests")
    .select("id,status,current_stage,current_owner,assigned_account_officer_id,assigned_account_officer_user_id,amount,created_at")
    .limit(2000);
  return error ? null : ((data || []) as ReqRow[]);
}

async function vouchersForMe() {
  const { data, error } = await supabase.rpc("get_payment_vouchers_assigned_to_me");
  if (error) return null;
  return ((data || []) as Array<{ status?: string | null; amount?: number | null; created_at?: string | null }>).filter((r) => String(r.status || "").startsWith("Pending"));
}

const status = (r: { status?: string | null }) => String(r.status || "").toLowerCase();

export async function requestsSummary(userId: string): Promise<Summary> {
  const rows = await myRequests(userId);
  if (!rows) return { stats: [], meta: {} };
  const open = rows.filter((r) => !isClosedRequest(r));
  const returned = open.filter((r) => /return|correct|query/.test(status(r)) || r.current_owner === userId);
  const since = new Date(monthStart()).getTime();
  const approvedMonth = rows.filter((r) => /approv|paid|complet/.test(status(r)) && new Date(r.created_at || 0).getTime() >= since);
  const paid = rows.filter((r) => /paid|complet/.test(status(r)));
  const withDg = open.filter((r) => String(r.current_stage || "").toUpperCase() === "DG").length;
  return {
    stats: [
      { label: "In progress", value: n(open.length), note: withDg ? `${withDg} with the DG` : "Moving through approval", icon: "clock", tone: "amber", href: "/requests/mine" },
      { label: "Back with you", value: n(returned.length), note: returned.length ? "Correct and resend" : "Nothing to correct", icon: "returned", tone: returned.length ? "red" : "green", href: "/requests/mine" },
      { label: "Approved this month", value: n(approvedMonth.length), note: nairaShort(approvedMonth.reduce((s, r) => s + Number(r.amount || 0), 0)), icon: "check", tone: "green" },
      { label: "Paid", value: n(paid.length), note: "Ready for the print register", icon: "wallet", tone: "blue", href: "/requests/printable" },
    ],
    meta: {
      "/requests/mine": plural(rows.length, "request"),
      "/requests/new": "Live budget check",
      "/requests/printable": `${plural(paid.length, "request")} to print`,
    },
  };
}

export async function approvalsSummary(userId: string, role: string): Promise<Summary> {
  const [rows, vouchers] = await Promise.all([visibleQueue(), vouchersForMe()]);
  const waiting = rows ? rows.filter((r) => isAwaitingUser(r, userId, role)) : null;
  const oldest = waiting && waiting.length ? Math.max(...waiting.map((r) => daysSince(r.created_at))) : 0;
  return {
    stats: [
      { label: "Requests waiting", value: n(waiting?.length), note: waiting ? nairaShort(waiting.reduce((s, r) => s + Number(r.amount || 0), 0)) : undefined, icon: "file", tone: "brand", href: "/approvals/inbox" },
      { label: "Vouchers to sign", value: n(vouchers?.length), note: vouchers ? nairaShort(vouchers.reduce((s, r) => s + Number(r.amount || 0), 0)) : undefined, icon: "pen", tone: "blue", href: "/approvals/vouchers" },
      { label: "Oldest waiting", value: waiting && waiting.length ? plural(oldest, "day") : DASH, note: oldest >= 3 ? "Waiting 3 days or more" : oldest >= 1 ? "Waiting since yesterday or earlier" : "All on time", icon: "clock", tone: oldest >= 3 ? "red" : "amber" },
    ],
    meta: {
      "/approvals/inbox": waiting ? `${plural(waiting.length, "request")} waiting` : DASH,
      "/approvals/vouchers": vouchers ? `${plural(vouchers.length, "voucher")} waiting` : DASH,
    },
  };
}

export async function financeSummary(): Promise<Summary> {
  const [accounts, subheads, queue] = await Promise.all([
    supabase.from("iet_accounts").select("id,available_balance,is_active").eq("is_active", true),
    supabase.from("subheads").select("id,approved_allocation,reserved_amount,expenditure,balance,is_active").eq("is_active", true),
    visibleQueue(),
  ]);
  const acc = accounts.error ? null : (accounts.data || []) as Array<{ available_balance?: number | null }>;
  const sub = subheads.error ? null : (subheads.data || []) as Array<{ approved_allocation?: number | null; reserved_amount?: number | null; expenditure?: number | null; balance?: number | null }>;
  const sum = <T,>(rows: T[] | null, pick: (r: T) => number | null | undefined) => (rows ? rows.reduce((s, r) => s + Number(pick(r) || 0), 0) : null);
  const budget = sum(sub, (r) => r.approved_allocation);
  const spent = sum(sub, (r) => r.expenditure);
  const reserved = sum(sub, (r) => r.reserved_amount);
  const cash = sum(acc, (r) => r.available_balance);
  const atAccount = queue ? queue.filter((r) => !isClosedRequest(r) && String(r.current_stage || "").toUpperCase() === "ACCOUNT") : null;
  const pct = budget && spent !== null ? `${((spent / budget) * 100).toFixed(1)}% of budget` : "Of the approved budget";
  return {
    stats: [
      { label: "Approved budget", value: nairaShort(budget), note: sub ? `${plural(sub.length, "subhead")}` : undefined, icon: "wallet", tone: "blue", href: "/finance/subheads" },
      { label: "Spent", value: nairaShort(spent), note: pct, icon: "trend", tone: "brand", href: "/finance/transactions" },
      { label: "Reserved", value: nairaShort(reserved), note: "Approved, not yet paid", icon: "clock", tone: "amber", href: "/finance/subheads" },
      { label: "Bank cash", value: nairaShort(cash), note: acc ? plural(acc.length, "IET account") : undefined, icon: "landmark", tone: "green", href: "/finance/manage-accounts" },
    ],
    meta: {
      "/finance/processing": atAccount ? `${plural(atAccount.length, "request")} waiting` : DASH,
      "/finance/manage-accounts": acc ? plural(acc.length, "account") : DASH,
      "/finance/subheads": sub ? plural(sub.length, "subhead") : DASH,
    },
  };
}

export async function vouchersSummary(): Promise<Summary> {
  const [list, mine] = await Promise.all([
    supabase.from("payment_vouchers").select("id,status,amount,total_amount,created_at").order("created_at", { ascending: false }).limit(3000),
    vouchersForMe(),
  ]);
  if (list.error) return { stats: [], meta: {} };
  const rows = (list.data || []) as Array<{ status?: string | null; amount?: number | null; total_amount?: number | null; created_at?: string | null }>;
  const amt = (r: { amount?: number | null; total_amount?: number | null }) => Number(r.total_amount ?? r.amount ?? 0);
  const signing = rows.filter((r) => status(r).startsWith("pending"));
  const late = signing.filter((r) => daysSince(r.created_at) >= 3).length;
  const ready = rows.filter((r) => /^(authori[sz]ed|approved)$/.test(status(r)));
  const since = new Date(monthStart()).getTime();
  const paidMonth = rows.filter((r) => status(r) === "paid" && new Date(r.created_at || 0).getTime() >= since);
  const paidAll = rows.filter((r) => status(r) === "paid");
  return {
    stats: [
      { label: "Waiting for you", value: n(mine?.length), note: "Check or sign", icon: "pen", tone: "brand", href: "/approvals/vouchers" },
      { label: "In signing", value: n(signing.length), note: late ? `${late} waiting 3+ days` : "All on time", icon: "clock", tone: "amber", href: "/payment-vouchers/pending" },
      { label: "Ready to pay", value: n(ready.length), note: nairaShort(ready.reduce((s, r) => s + amt(r), 0)), icon: "wallet", tone: "blue", href: "/payment-vouchers/approved" },
      { label: "Paid this month", value: n(paidMonth.length), note: nairaShort(paidMonth.reduce((s, r) => s + amt(r), 0)), icon: "check", tone: "green", href: "/payment-vouchers/history" },
    ],
    meta: {
      "/payment-vouchers/centre": plural(rows.length, "voucher"),
      "/payment-vouchers/pending": `${signing.length} in signing`,
      "/payment-vouchers/approved": `${ready.length} · ${nairaShort(ready.reduce((s, r) => s + amt(r), 0))}`,
      "/payment-vouchers/history": `${paidAll.length} paid`,
      "/payment-vouchers/print-centre": `${ready.length + paidAll.length} ready`,
      "/payment-vouchers/settings": "Super Admin · Auditor",
    },
  };
}

export async function registrySummary(): Promise<Summary> {
  const { data, error } = await supabase.from("registry_correspondence").select("direction,created_at,status").order("created_at", { ascending: false }).limit(5000);
  if (error) return { stats: [], meta: {} };
  const rows = (data || []) as Array<{ direction?: string | null; created_at?: string | null; status?: string | null }>;
  const today = dayStart();
  const isIn = (r: { direction?: string | null }) => String(r.direction || "").toLowerCase() === "incoming";
  const isOut = (r: { direction?: string | null }) => String(r.direction || "").toLowerCase() === "outgoing";
  const todayRows = rows.filter((r) => new Date(r.created_at || 0).getTime() >= today);
  const archived = rows.filter((r) => /archiv|filed/.test(status(r)));
  return {
    stats: [
      { label: "Received today", value: n(todayRows.filter(isIn).length), note: "Incoming letters and files", icon: "download", tone: "blue", href: "/registry/incoming" },
      { label: "Sent today", value: n(todayRows.filter(isOut).length), note: "Outgoing letters and files", icon: "upload", tone: "brand", href: "/registry/outgoing" },
      { label: "Filed records", value: n(archived.length), note: "In the archive", icon: "archive", tone: "green", href: "/registry/archive" },
    ],
    meta: {
      "/registry/incoming": plural(rows.filter(isIn).length, "record"),
      "/registry/outgoing": plural(rows.filter(isOut).length, "record"),
      "/registry/archive": plural(archived.length, "filed record"),
    },
  };
}

export async function adminSummary(): Promise<Summary> {
  const [people, depts, accounts] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("departments").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("iet_accounts").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);
  const staff = people.error ? null : people.count ?? 0;
  const d = depts.error ? null : depts.count ?? 0;
  const a = accounts.error ? null : accounts.count ?? 0;
  return {
    stats: [
      { label: "Staff", value: n(staff), note: "Everyone with a ReqGen account", icon: "users", tone: "blue", href: "/admin/users" },
      { label: "Departments", value: n(d), note: "Active departments", icon: "building", tone: "green", href: "/admin/departments" },
      { label: "IET accounts", value: n(a), note: "Active accounts", icon: "landmark", tone: "brand", href: "/finance/manage-accounts" },
    ],
    meta: {
      "/admin/users": staff === null ? DASH : plural(staff, "person", "people"),
      "/admin/departments": d === null ? DASH : plural(d, "department"),
    },
  };
}

export async function auditSummary(): Promise<Summary> {
  const today = new Date(dayStart()).toISOString();
  const week = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [todayCount, weekCount] = await Promise.all([
    supabase.from("audit_logs").select("id", { count: "exact", head: true }).gte("created_at", today),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }).gte("created_at", week),
  ]);
  const t = todayCount.error ? null : todayCount.count ?? 0;
  const w = weekCount.error ? null : weekCount.count ?? 0;
  return {
    stats: [
      { label: "Actions today", value: n(t), note: "Every user, every module", icon: "activity", tone: "blue", href: "/audit-centre/logs" },
      { label: "Last 7 days", value: n(w), note: "Logged actions", icon: "history", tone: "brand", href: "/audit-centre/logs" },
    ],
    meta: { "/audit-centre/logs": t === null ? DASH : `${t} today` },
  };
}

export async function summaryFor(moduleKey: string, userId: string, role: string): Promise<Summary> {
  try {
    switch (moduleKey) {
      case "requests": return await requestsSummary(userId);
      case "approvals": return await approvalsSummary(userId, role);
      case "finance": return await financeSummary();
      case "payment-vouchers": return await vouchersSummary();
      case "registry": return await registrySummary();
      case "admin": return await adminSummary();
      case "audit": return await auditSummary();
      default: return { stats: [], meta: {} };
    }
  } catch {
    return { stats: [], meta: {} };
  }
}
