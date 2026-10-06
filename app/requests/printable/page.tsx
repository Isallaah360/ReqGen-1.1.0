"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileCheck2, Printer, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { StatTile } from "@/app/components/ui/StatTile";

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

type HistoryRow = { request_id: string | null; action_by: string | null; from_stage: string | null; action_type: string | null; created_at: string };

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

function isForward(action: string | null | undefined) {
  const value = key(action);
  if (/reject|return|declin|cancel|comment|attachment/.test(value)) return false;
  return /approv|treat|paid|forward|confirm|check/.test(value);
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
  const [view, setView] = useState<View>("mine");
  const [query, setQuery] = useState("");
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

      const [profileRes, rolesRes, requestRes] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle(),
        supabase.from("profile_roles").select("role_key,is_active").eq("profile_id", auth.user.id),
        supabase
          .from("requests")
          .select("id,request_no,title,amount,status,current_stage,created_at,request_type,personal_category,created_by")
          .order("created_at", { ascending: false })
          .limit(2000),
      ]);
      if (requestRes.error) throw new Error(requestRes.error.message);

      const roleSet = new Set<string>();
      if (profileRes.data?.role) roleSet.add(key(profileRes.data.role));
      for (const role of (rolesRes.data || []) as Array<{ role_key: string | null; is_active: boolean | null }>) {
        if (role.is_active !== false && role.role_key) roleSet.add(key(role.role_key));
      }
      setRoles(roleSet);

      const requestRows = ((requestRes.data || []) as Row[]).filter(isFinished);
      setRows(requestRows);

      // Account-stage decisions on the finished requests (who treated each one).
      const ids = requestRows.map((row) => row.id);
      const mine = new Map<string, string>();
      const treated = new Map<string, string>();
      for (let start = 0; start < ids.length; start += 200) {
        const chunk = ids.slice(start, start + 200);
        const { data } = await supabase
          .from("request_history")
          .select("request_id,action_by,from_stage,action_type,created_at")
          .in("request_id", chunk)
          .limit(5000);
        for (const item of (data || []) as HistoryRow[]) {
          if (!item.request_id || key(item.from_stage) !== "account" || !isForward(item.action_type)) continue;
          treated.set(item.request_id, item.created_at);
          if (item.action_by === auth.user.id) mine.set(item.request_id, item.created_at);
        }
      }
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

  const mineRows = useMemo(() => rows.filter((row) => row.created_by === userId), [rows, userId]);
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
    if (!q) return source;
    return source.filter((row) => [row.request_no, row.title, row.status, typeLabel(row)].join(" ").toLowerCase().includes(q));
  }, [query, source]);

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
          <label className="rg-register-search">
            <Search size={15} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search request no., title or status" />
          </label>
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
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="rg-register-empty">Loading completed requests...</td></tr>
              ) : visible.length ? (
                visible.map((row) => (
                  <tr key={row.id}>
                    <td>{row.request_no || "—"}</td>
                    <td>{row.title || "Untitled"}</td>
                    <td>{typeLabel(row)}</td>
                    <td>{naira(row.amount)}</td>
                    <td>{dateText(row.created_at)}</td>
                    <td>{activeView === "mine" ? (row.status || "Completed") : dateText(activeView === "treated" ? myAccountActions.get(row.id) : accountTreated.get(row.id))}</td>
                    <td>
                      <Link className="rg-register-print" href={`/requests/${row.id}/print`}>
                        <Printer size={14} /> Print / Save
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="rg-register-empty">
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
