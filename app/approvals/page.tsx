"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, Eye, RefreshCw, Search, ShieldCheck, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import styles from "./approvals.module.css";

type ApprovalRow = {
  id: string;
  request_no: string | null;
  title: string | null;
  status: string | null;
  current_stage: string | null;
  current_owner: string | null;
  amount: number | null;
  created_at: string;
  request_type: string | null;
  personal_category: string | null;
};

type ViewKey = "pending" | "history" | "all";

function roleKey(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function stageKey(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase().replace(/[\s_-]+/g, "");
}

function isClosed(row: ApprovalRow) {
  const status = String(row.status || "").toLowerCase();
  const stage = stageKey(row.current_stage);
  return ["COMPLETED", "REJECTED", "DELETED", "CANCELLED"].includes(stage) ||
    ["approved", "paid", "completed", "closed", "rejected", "deleted", "cancelled"].some((token) => status.includes(token));
}

function isApproved(row: ApprovalRow) {
  const status = String(row.status || "").toLowerCase();
  return ["approved", "paid", "completed", "closed"].some((token) => status.includes(token));
}

function formatNaira(value: number | null) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function typeLabel(row: ApprovalRow) {
  const requestType = String(row.request_type || "").toUpperCase();
  const personal = String(row.personal_category || "").toUpperCase();
  if (requestType === "OFFICIAL") return "Official";
  if (requestType === "PERSONAL" && personal === "FUND") return "Personal Fund";
  if (requestType === "PERSONAL") return "Personal Non-Fund";
  return row.request_type || "Request";
}

export default function ApprovalsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewKey>("pending");
  const [activeRole, setActiveRole] = useState("staff");
  const [userId, setUserId] = useState("");

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setMessage(null);

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.replace("/login");
        return;
      }

      setUserId(auth.user.id);

      const [profileRes, activeRoleRes, requestRes] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle(),
        supabase.rpc("get_my_active_role"),
        supabase
          .from("requests")
          .select("id,request_no,title,status,current_stage,current_owner,amount,created_at,request_type,personal_category")
          .order("created_at", { ascending: false }),
      ]);

      let resolvedRole = "";
      const rawRole = activeRoleRes.data as unknown;
      if (typeof rawRole === "string") resolvedRole = rawRole;
      else if (Array.isArray(rawRole)) {
        const first = rawRole[0] as Record<string, unknown> | undefined;
        resolvedRole = String(first?.active_role_key || first?.role_key || first?.get_my_active_role || "");
      } else if (rawRole && typeof rawRole === "object") {
        const item = rawRole as Record<string, unknown>;
        resolvedRole = String(item.active_role_key || item.role_key || item.get_my_active_role || "");
      }

      setActiveRole(roleKey(resolvedRole || String(profileRes.data?.role || "staff")));

      if (requestRes.error) throw new Error(requestRes.error.message);
      setRows((requestRes.data || []) as ApprovalRow[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load approvals.");
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    queueMicrotask(() => { void load(); });

    const channel = supabase
      .channel("reqgen-approvals-single-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => void load(true))
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const stageForRole: Record<string, string[]> = useMemo(() => ({
    po: ["PO"], dod: ["DOD"], director: ["DOD"], dinadmin: ["DINADMIN"], registrar: ["REGISTRAR"],
    registry: ["REGISTRAR"], hod: ["HOD"], hr: ["HR", "HRFILING"], hrboss: ["HR", "HRFILING"],
    hrofficer: ["HR", "HRFILING"], dg: ["DG"], account: ["ACCOUNT"], accounts: ["ACCOUNT"], accountofficer: ["ACCOUNT"],
  }), []);

  const relevantRows = useMemo(() => {
    const canSeeAll = ["admin", "auditor"].includes(activeRole);
    const stages = stageForRole[activeRole] || [];
    return rows.filter((row) => canSeeAll || row.current_owner === userId || stages.includes(stageKey(row.current_stage)));
  }, [activeRole, rows, stageForRole, userId]);

  const pendingRows = useMemo(() => relevantRows.filter((row) => !isClosed(row)), [relevantRows]);
  const historyRows = useMemo(() => relevantRows.filter(isClosed), [relevantRows]);
  const approvedCount = useMemo(() => historyRows.filter(isApproved).length, [historyRows]);
  const rejectedCount = Math.max(0, historyRows.length - approvedCount);

  const filteredRows = useMemo(() => {
    const source = view === "pending" ? pendingRows : view === "history" ? historyRows : relevantRows;
    const q = search.trim().toLowerCase();
    if (!q) return source;
    return source.filter((row) => [row.request_no, row.title, row.status, row.current_stage, typeLabel(row)]
      .some((value) => String(value || "").toLowerCase().includes(q)));
  }, [historyRows, pendingRows, relevantRows, search, view]);

  return (
    <main className={styles.page}>
      <header className={styles.simpleHeader}>
        <div>
          <span className={styles.eyebrow}>Approvals</span>
          <h1>Approvals</h1>
          <p>Everything requiring your decision is here. Review pending requests and see your approval history without an Action Centre.</p>
        </div>
        <button className={styles.refreshButton} onClick={() => void load(true)} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? styles.spin : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {message ? <div className={styles.errorBanner}>{message}</div> : null}

      <section className={styles.compactKpis} aria-label="Approval summary">
        <article><Clock3 size={20} /><div><span>Waiting for you</span><strong>{pendingRows.length}</strong><small>Requests requiring attention</small></div></article>
        <article><CheckCircle2 size={20} /><div><span>Approved history</span><strong>{approvedCount}</strong><small>Successfully completed</small></div></article>
        <article><XCircle size={20} /><div><span>Rejected / closed</span><strong>{rejectedCount}</strong><small>Completed decisions</small></div></article>
        <article><ShieldCheck size={20} /><div><span>Active role</span><strong className={styles.roleValue}>{activeRole || "staff"}</strong><small>Current approval authority</small></div></article>
      </section>

      <section className={styles.singleWorkspace}>
        <div className={styles.workspaceToolbar}>
          <div className={styles.viewTabs} role="tablist" aria-label="Approval views">
            <button className={view === "pending" ? styles.activeTab : ""} onClick={() => setView("pending")}>Pending <b>{pendingRows.length}</b></button>
            <button className={view === "history" ? styles.activeTab : ""} onClick={() => setView("history")}>History <b>{historyRows.length}</b></button>
            <button className={view === "all" ? styles.activeTab : ""} onClick={() => setView("all")}>All <b>{relevantRows.length}</b></button>
          </div>
          <label className={styles.approvalSearch}>
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search request no., title, stage or status..." />
          </label>
        </div>

        <div className={styles.queueHeading}>
          <div><h2>{view === "pending" ? "Requests waiting for you" : view === "history" ? "Approval history" : "All approval records"}</h2><p>{view === "pending" ? "Open a request to review the full record and take the authorised action." : "A complete history of requests routed through your approval authority."}</p></div>
          <span>{filteredRows.length} record{filteredRows.length === 1 ? "" : "s"}</span>
        </div>

        {loading ? <div className={styles.emptyState}>Loading approvals...</div> : filteredRows.length === 0 ? (
          <div className={styles.emptyState}>{view === "pending" ? "No request is waiting for your approval." : "No approval history matches this view."}</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Request</th><th>Title</th><th>Type</th><th>Stage</th><th>Amount</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>{filteredRows.map((row) => (
                <tr key={row.id}>
                  <td className={styles.requestNo}>{row.request_no || "—"}</td>
                  <td><strong>{row.title || "Untitled request"}</strong></td>
                  <td><span className={styles.typeBadge}>{typeLabel(row)}</span></td>
                  <td>{row.current_stage || "—"}</td>
                  <td>{formatNaira(row.amount)}</td>
                  <td>{formatDate(row.created_at)}</td>
                  <td><span className={`${styles.statusBadge} ${isApproved(row) ? styles.badgeGreen : isClosed(row) ? styles.badgeRed : styles.badgeAmber}`}>{row.status || "Pending"}</span></td>
                  <td>
                    <button className={styles.reviewButton} onClick={() => router.push(`/requests/${row.id}?from=approvals`)}>
                      <Eye size={15} /> {isClosed(row) ? "View" : "Review & Decide"}
                    </button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.securityTip}>
        <ShieldCheck size={21} />
        <div><strong>Simple and secure</strong><p>Your authenticated AAL2 session is reused for normal approval work. ReqGen asks for another authenticator code only when the secure session has expired.</p></div>
      </section>
    </main>
  );
}
