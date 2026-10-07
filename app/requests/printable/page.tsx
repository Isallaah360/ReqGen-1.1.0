"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileCheck2, Printer, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { StatTile } from "@/app/components/ui/StatTile";
import { fyLabel, fyStartYear } from "@/lib/financialYear";

/**
 * ReqGen v3.1.6 — Print Register.
 * One place to find and print completed requests:
 *   1. My completed requests — the requester's own approved / paid requests.
 *   2. Treated by me — requests the signed-in Account Officer treated.
 *   3. All treated requests — Auditor / Admin view of requests treated by Accounts
 *      (only the requests the privacy rules already let them open).
 * "Print / Save" opens the A4 document; the browser print dialog offers
 * "Save as PDF" for a downloadable copy.
 */

type Row = {
  id: string;
  request_no: string | null;
  title: string | null;
  amount: number | null;
  status: string | null;
  current_stage: string | null;
  created_at: string;
  request_type: string | null;
  personal_category: string | null;
  created_by: string | null;
};

type RegisterRow = Row & { is_mine: boolean; treated_by_me: boolean; treated_by_accounts: boolean; treated_at: string | null; treated_by_name: string | null; voucher_no: string | null };

type View = "mine" | "treated" | "all";

const ACCOUNT_KEYS = ["account", "accounts", "accountofficer", "accountofficer1", "accountofficer2", "accountofficer3", "finance"];
const OVERSIGHT_KEYS = ["auditor", "admin"];

function key(value: string | null | undefined) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isFinished(row: Row) {
  const status = key(row.status);
  const stage = key(row.current_stage);
  if (/reject|delete|cancel|withdraw/.test(status)) return false;
  return stage === "completed" || /paid|completed|closed|treated|filed/.test(status);
}

function naira(value: number | null | undefined) {
  return `₦${Math.round(Number(value || 0)).toLocaleString("en-NG")}`;
}

function dateText(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function typeLabel(row: Row) {
  const type = key(row.request_type);
  if (type.includes("official")) return "Official";
  if (type.includes("personal")) return key(row.personal_category).includes("fund") ? "Personal Fund" : "Personal";
  return row.request_type || "—";
}

export default function PrintRegisterPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [roles, setRoles] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<Row[]>([]);
  const [myAccountActions, setMyAccountActions] = useState<Map<string, string>>(new Map());
  const [accountTreated, setAccountTreated] = useState<Map<string, string>>(new Map());
  const [voucherNos, setVoucherNos] = useState<Map<string, string>>(new Map());
  const [view, setView] = useState<View>("mine");
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setMessage(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.push("/login"); return; }
      setUserId(auth.user.id);

      const [profileRes, rolesRes, registerRes] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle(),
        supabase.from("profile_roles").select("role_key,is_active").eq("profile_id", auth.user.id),
        // v3.1.7: one trusted server list (reqgen_print_register) instead of
        // assembling it from tables the privacy rules partly hide.
        supabase.rpc("reqgen_print_register"),
      ]);
      if (registerRes.error) {
        // v3.1.9: a clear message when the database update has not been run.
        throw new Error(/could not find the function|schema cache|does not exist/i.test(registerRes.error.message)
          ? "The Print Register needs the database update database/v3_1_9_print_register_tracker.sql. Please ask the Administrator to run it in Supabase, then refresh this page."
          : registerRes.error.message);
      }

      const roleSet = new Set<string>();
      if (profileRes.data?.role) roleSet.add(key(profileRes.data.role));
      for (const role of (rolesRes.data || []) as Array<{ role_key: string | null; is_active: boolean | null }>) {
        if (role.is_active !== false && role.role_key) roleSet.add(key(role.role_key));
      }
      setRoles(roleSet);

      const register = (registerRes.data || []) as RegisterRow[];
      setRows(register.map((row) => ({ ...row, created_by: row.is_mine ? auth.user.id : null })));
      const mine = new Map<string, string>();
      const treated = new Map<string, string>();
      for (const row of register) {
        if (row.treated_by_accounts) treated.set(row.id, row.treated_at || row.created_at);
        if (row.treated_by_me) mine.set(row.id, row.treated_at || row.created_at);
      }
      setVoucherNos(new Map(register.filter((row) => row.voucher_no).map((row) => [row.id, row.voucher_no as string])));
      setMyAccountActions(mine);
      setAccountTreated(treated);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The print register could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  const isAccount = useMemo(() => ACCOUNT_KEYS.some((k) => roles.has(k)), [roles]);
  const isOversight = useMemo(() => OVERSIGHT_KEYS.some((k) => roles.has(k)), [roles]);

  const mineRows = useMemo(() => rows.filter((row) => row.created_by === userId && (isFinished(row) || accountTreated.has(row.id))), [accountTreated, rows, userId]);
  const treatedRows = useMemo(() => rows.filter((row) => myAccountActions.has(row.id)), [rows, myAccountActions]);
  const allTreatedRows = useMemo(() => rows.filter((row) => accountTreated.has(row.id)), [rows, accountTreated]);

  const views = useMemo(() => {
    const list: Array<{ id: View; label: string; count: number }> = [{ id: "mine", label: "My completed requests", count: mineRows.length }];
    if (isAccount) list.push({ id: "treated", label: "Treated by me", count: treatedRows.length });
    if (isOversight) list.push({ id: "all", label: "All treated requests", count: allTreatedRows.length });
    return list;
  }, [allTreatedRows.length, isAccount, isOversight, mineRows.length, treatedRows.length]);

  const activeView = views.some((item) => item.id === view) ? view : "mine";
  const source = activeView === "treated" ? treatedRows : activeView === "all" ? allTreatedRows : mineRows;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return source.filter((row) =>
      (year === "all" || String(fyStartYear(row.created_at)) === year) &&
      (!q || [row.request_no, row.title, row.status, typeLabel(row), voucherNos.get(row.id)].join(" ").toLowerCase().includes(q)));
  }, [query, source, voucherNos, year]);
  // IET financial year: 1 September – 31 August.
  const years = useMemo(() => Array.from(new Set(rows.map((row) => String(fyStartYear(row.created_at))))).filter((y) => y !== "NaN").sort().reverse(), [rows]);

  const total = useMemo(() => visible.reduce((sum, row) => sum + Number(row.amount || 0), 0), [visible]);

  return (
    <main className="rg-register-page">
      <PageHeader
        title="Print Register"
        description="Completed requests you can print, or save as PDF from the print dialog."
        actions={
          <button type="button" className="rg-btn rg-btn-secondary" onClick={() => void load(true)} disabled={refreshing}>
            <RefreshCw size={15} /> {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        }
      />

      {message ? <div className="rg-register-message" role="alert">{message}</div> : null}

      <section className="rg-register-stats">
        <StatTile title="My completed requests" value={mineRows.length} tone="blue" note="Approved, paid or filed" />
        {isAccount ? <StatTile title="Treated by me" value={treatedRows.length} tone="emerald" note="Treated at the Account stage" /> : null}
        {isOversight ? <StatTile title="All treated requests" value={allTreatedRows.length} tone="amber" note="Treated by Accounts" /> : null}
        <StatTile title="Value in this list" value={naira(total)} tone="purple" note={`${visible.length} request${visible.length === 1 ? "" : "s"}`} />
      </section>

      <section className="rg-register-card">
        <div className="rg-register-toolbar">
          <div className="rg-register-segments" role="tablist" aria-label="Print register lists">
            {views.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={activeView === item.id}
                className={activeView === item.id ? "is-active" : ""}
                onClick={() => setView(item.id)}
              >
                <span>{index + 1}</span>{item.label}<em>{item.count}</em>
              </button>
            ))}
          </div>
          <div className="rg-register-filters">
          <select className="rg-register-year" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Financial year">
            <option value="all">All financial years</option>
            {years.map((y) => <option key={y} value={y}>FY {fyLabel(Number(y))}</option>)}
          </select>
          <label className="rg-register-search">
            <Search size={15} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search request no., title, status or PV" />
          </label>
          </div>
        </div>

        <div className="rg-register-table">
          <table>
            <thead>
              <tr>
                <th>Request</th>
                <th>Title</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Requested</th>
                <th>{activeView === "mine" ? "Status" : "Treated"}</th>
                <th>Voucher</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="rg-register-empty">Loading completed requests...</td></tr>
              ) : visible.length ? (
                visible.map((row) => (
                  <tr key={row.id}>
                    <td>{row.request_no || "—"}</td>
                    <td>{row.title || "Untitled"}</td>
                    <td>{typeLabel(row)}</td>
                    <td>{naira(row.amount)}</td>
                    <td>{dateText(row.created_at)}</td>
                    <td>{activeView === "mine" ? (row.status || "Completed") : dateText(activeView === "treated" ? myAccountActions.get(row.id) : accountTreated.get(row.id))}</td>
                    <td>{voucherNos.get(row.id) || "Not yet"}</td>
                    <td>
                      <Link className="rg-register-print" href={`/requests/${row.id}/print`}>
                        <Printer size={14} /> Print / Save
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="rg-register-empty">
                    <FileCheck2 size={18} aria-hidden="true" /> No completed request in this list yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
