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
/** badges: a small red chip on a tile (e.g. "1 stuck"). */
export type Summary = { stats: SummaryStat[]; meta: Record<string, string>; badges?: Record<string, string> };

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
    supabase.from("payment_vouchers").select("*").order("created_at", { ascending: false }).limit(3000),
    vouchersForMe(),
  ]);
  if (list.error) return { stats: [], meta: {} };
  const rows = (list.data || []) as Array<{ status?: string | null; amount?: number | null; total_amount?: number | null; created_at?: string | null; paid_at?: string | null; updated_at?: string | null }>;
  const amt = (r: { amount?: number | null; total_amount?: number | null }) => Number(r.total_amount ?? r.amount ?? 0);
  const signing = rows.filter((r) => status(r).startsWith("pending"));
  const late = signing.filter((r) => daysSince(r.created_at) >= 3).length;
  const ready = rows.filter((r) => /^(authori[sz]ed|approved)$/.test(status(r)));
  const since = new Date(monthStart()).getTime();
  const paidMonth = rows.filter((r) => status(r) === "paid" && new Date(r.paid_at || r.updated_at || r.created_at || 0).getTime() >= since);
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
  const [corr, track, arch, filing] = await Promise.all([
    supabase.from("registry_correspondence").select("direction,created_at,received_at,status,priority,archived_at").order("created_at", { ascending: false }).limit(5000),
    supabase.rpc("reqgen_registry_tracking"),
    supabase.from("reqgen_registry_archive").select("archived_at,keep_until,permanent,restored_at").is("restored_at", null).limit(20000),
    supabase.rpc("reqgen_registry_filing_queue"),
  ]);
  if (corr.error) return { stats: [], meta: {} };
  const rows = (corr.data || []) as Array<{ direction?: string | null; created_at?: string | null; received_at?: string | null; status?: string | null; priority?: string | null }>;
  const today = dayStart();
  const isIn = (r: { direction?: string | null }) => String(r.direction || "").toLowerCase() === "incoming";
  const isOut = (r: { direction?: string | null }) => String(r.direction || "").toLowerCase() === "outgoing";
  const inToday = rows.filter((r) => isIn(r) && new Date(r.received_at || r.created_at || 0).getTime() >= today);
  const toDispatch = rows.filter((r) => isOut(r) && /ready to dispatch/i.test(String(r.status || "")));
  const tr = ((track.data || []) as Array<{ waiting_since: string }>);
  const stuck = tr.filter((r) => daysSince(r.waiting_since) >= 3).length;
  const ar = (arch.data || []) as Array<{ archived_at: string; keep_until: string | null; permanent: boolean }>;
  const monthStartMs = new Date(monthStart()).getTime();
  const due = ar.filter((r) => !r.permanent && r.keep_until && new Date(r.keep_until).getTime() < Date.now()).length;
  const toFile = ((filing.data || []) as unknown[]).length;
  return {
    stats: [
      { label: "Received today", value: n(inToday.length), note: `${inToday.filter((r) => /urgent/i.test(String(r.priority || ""))).length} urgent`, icon: "download", tone: "blue", href: "/registry/incoming" },
      { label: "To dispatch", value: n(toDispatch.length), note: `${toDispatch.filter((r) => daysSince(r.created_at) >= 2).length} waiting 2+ days`, icon: "send", tone: "brand", href: "/registry/dispatch" },
      { label: "Requests moving", value: track.error ? DASH : n(tr.length), note: stuck ? `${stuck} stuck 3+ days` : "None stuck", icon: "route", tone: "amber", href: "/registry/tracking" },
      { label: "Archived this month", value: arch.error ? DASH : n(ar.filter((r) => new Date(r.archived_at).getTime() >= monthStartMs).length), note: `${due} due for review`, icon: "archive", tone: "green", href: "/registry/archive" },
    ],
    meta: {
      "/registry/tracking": track.error ? DASH : `${tr.length} moving`,
      "/registry/incoming": `${inToday.length} today`,
      "/registry/outgoing": plural(rows.filter(isOut).length, "record"),
      "/registry/dispatch": `${toDispatch.length} to dispatch`,
      "/registry/archive": arch.error ? DASH : plural(ar.length, "record"),
      "/registry/filing": `${toFile} to file`,
    },
    badges: stuck ? { "/registry/tracking": `${stuck} stuck` } : undefined,
  };
}

export async function adminSummary(): Promise<Summary> {
  // v4.6 (mock-up 79): one call, decided in the database (Super Admin and Developer only)
  const [{ data, error }, routes] = await Promise.all([
    supabase.rpc("reqgen_admin_summary"),
    supabase.rpc("reqgen_department_route_overview"),
  ]);
  const v = (error ? null : typeof data === "string" ? JSON.parse(data) : data) as null | {
    staff: number; deactivated: number; positions_held: number; positions: number; departments: number; accounts: number; officers_without_2fa: number; system_accounts: number;
  };
  const routeCount = routes.error ? null : new Set(((routes.data || []) as Array<{ dept_id: string }>).map((r) => r.dept_id)).size;
  const no2fa = v?.officers_without_2fa ?? 0;
  return {
    stats: [
      { label: "Staff", value: n(v ? v.staff : null), note: "All have the Staff level", icon: "users", tone: "blue", href: "/admin/users" },
      { label: "Positions held", value: n(v ? v.positions_held : null), note: v ? `Across ${v.positions} positions` : undefined, icon: "key", tone: "brand", href: "/admin/positions" },
      { label: "Departments", value: n(v ? v.departments : null), note: v ? plural(v.accounts, "account") : undefined, icon: "building", tone: "green", href: "/admin/departments" },
      { label: "Security", value: n(v ? no2fa : null), note: "Officers without 2FA", icon: "lock", tone: no2fa ? "amber" : "green", href: "/admin/security" },
    ],
    meta: {
      "/admin/system-accounts": v ? plural(v.system_accounts, "account") : DASH,
      "/admin/users": v ? `${v.staff} staff` : DASH,
      "/admin/positions": v ? plural(v.positions, "position") : DASH,
      "/admin/roles": "15 × 16",
      "/admin/departments": v ? plural(v.departments, "department") : DASH,
      "/admin/routing": routeCount === null ? DASH : plural(routeCount, "route"),
      "/admin/security": v ? (no2fa ? `${no2fa} to fix` : "All protected") : DASH,
      "/admin/system-health": "Run checks",
    },
    badges: no2fa ? { "/admin/security": String(no2fa) } : undefined,
  };
}

export async function auditSummary(): Promise<Summary> {
  const today = new Date(dayStart()).toISOString();
  const week = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [todayCount, stamps, recon, backup] = await Promise.all([
    supabase.from("reqgen_audit_log").select("id", { count: "exact", head: true }).gte("at", today),
    supabase.from("reqgen_audit_log").select("id", { count: "exact", head: true }).eq("category", "stamp").gte("at", week),
    supabase.from("reqgen_reconciliations").select("month,difference,status").neq("status", "Reconciled"),
    supabase.from("reqgen_backup_log").select("created_at,mode,summary,bytes").eq("action", "backup").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const t = todayCount.error ? null : todayCount.count ?? 0;
  const open = ((recon.data || []) as Array<{ difference: number | null }>).filter((r) => Number(r.difference || 0) !== 0).length;
  const last = backup.data as { created_at: string; bytes?: number | null } | null;
  return {
    stats: [
      { label: "Events today", value: n(t), note: "Sign-ins, approvals, edits", icon: "activity", tone: "blue", href: "/audit-centre/logs" },
      { label: "Stamps applied", value: stamps.error ? DASH : n(stamps.count ?? 0), note: "This week · all by the DG", icon: "pentool", tone: "brand", href: "/audit-centre/logs?tab=stamp" },
      { label: "To reconcile", value: recon.error ? DASH : n(open), note: open ? "Differences to explain" : "All matched", icon: "scale", tone: "amber", href: "/audit-centre/reconciliation" },
      { label: "Last backup", value: last ? new Date(last.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : DASH, note: last ? new Date(last.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "No backup yet", icon: "database", tone: "green", href: "/audit-centre/backup" },
    ],
    meta: {
      "/audit-centre/logs": t === null ? DASH : `${t} today`,
      "/workflow": "Search any number",
      "/audit-centre/reconciliation": recon.error ? DASH : open ? `${open} difference${open === 1 ? "" : "s"}` : "All matched",
      "/audit-centre/backup": "Nightly at 02:00",
    },
    badges: open ? { "/audit-centre/reconciliation": `${open} to check` } : undefined,
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
