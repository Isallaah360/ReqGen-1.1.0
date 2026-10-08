"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, Eye, RefreshCw, Search, ShieldCheck, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import RequestDetailsWorkspace from "@/app/components/requests/RequestDetailsWorkspace";
import RequestAccessGate from "@/app/components/requests/RequestAccessGate";
import { StatTile } from "@/app/components/ui/StatTile";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { WaitingForYou } from "@/app/payment-vouchers/views/PvViews";
import styles from "./approvals.module.css";
import { APPROVAL_QUEUE_CHANGED_EVENT, isAwaitingUser, isClosedRequest, isHeldElsewhere } from "@/lib/approvalQueue";

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
  assigned_account_officer_id: string | null;
  assigned_account_officer_user_id: string | null;
};

/** The signed-in user's own decision on a request (latest action wins). */
type MyAction = { kind: "approved" | "rejected" | "other"; at: string };

function actionKind(actionType: string | null | undefined): MyAction["kind"] {
  const value = String(actionType || "").toLowerCase();
  if (value.includes("reject") || value.includes("decline") || value.includes("return")) return "rejected";
  if (value.includes("attachment") || value.includes("comment") || value.includes("view")) return "other";
  return "approved";
}

type ViewKey = "pending" | "history" | "all";

function roleKey(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}


function isClosed(row: ApprovalRow) {
  return isClosedRequest(row);
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
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [myActions, setMyActions] = useState<Map<string, MyAction>>(new Map());

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

      const [profileRes, activeRoleRes, requestRes, historyRes] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle(),
        supabase.rpc("get_my_active_role"),
        supabase
          .from("requests")
          .select("id,request_no,title,status,current_stage,current_owner,amount,created_at,request_type,personal_category,assigned_account_officer_id,assigned_account_officer_user_id")
          .order("created_at", { ascending: false }),
        supabase
          .from("request_history")
          .select("request_id,action_type,created_at")
          .eq("action_by", auth.user.id)
          .order("created_at", { ascending: true })
          .limit(5000),
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

      // Approval history = requests this user personally acted on.
      const acted = new Map<string, MyAction>();
      for (const item of (historyRes.data || []) as Array<{ request_id: string | null; action_type: string | null; created_at: string }>) {
        if (!item.request_id) continue;
        const kind = actionKind(item.action_type);
        const previous = acted.get(item.request_id);
        if (kind === "other" && previous) continue;
        acted.set(item.request_id, { kind, at: item.created_at });
      }
      setMyActions(acted);
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

  // v3.1.5: ONE rule (lib/approvalQueue.ts) for the list, the bell, the
  // access gate and the Process screen, so "waiting for you" is always actionable.
  const pendingRows = useMemo(() => rows.filter((row) => isAwaitingUser(row, userId, activeRole)), [activeRole, rows, userId]);
  const historyRows = useMemo(() => {
    const pendingIds = new Set(pendingRows.map((row) => row.id));
    return rows.filter((row) => !pendingIds.has(row.id) && myActions.has(row.id) && myActions.get(row.id)?.kind !== "other");
  }, [myActions, pendingRows, rows]);
  const relevantRows = useMemo(() => [...pendingRows, ...historyRows], [historyRows, pendingRows]);
  const heldElsewhere = useMemo(
    () => rows.filter((row) => isHeldElsewhere(row, userId, activeRole) && !myActions.has(row.id)),
    [activeRole, myActions, rows, userId],
  );
  const approvedCount = useMemo(() => historyRows.filter((row) => myActions.get(row.id)?.kind === "approved").length, [historyRows, myActions]);
  const rejectedCount = useMemo(() => historyRows.filter((row) => myActions.get(row.id)?.kind === "rejected").length, [historyRows, myActions]);

  const filteredRows = useMemo(() => {
    const source = view === "pending" ? pendingRows : view === "history" ? historyRows : relevantRows;
    const q = search.trim().toLowerCase();
    if (!q) return source;
    return source.filter((row) => [row.request_no, row.title, row.status, row.current_stage, typeLabel(row)]
      .some((value) => String(value || "").toLowerCase().includes(q)));
  }, [historyRows, pendingRows, relevantRows, search, view]);

  if (selectedRequestId) {
    return (
      <main className={`${styles.page} ${styles.processingPage}`}>
        <section className={styles.processWorkspace} aria-label="Process request">
          <div className={styles.processWorkspaceBar}>
            <button type="button" onClick={() => setSelectedRequestId(null)} className={styles.backToApprovals}>
              <ArrowLeft size={17} /> Back to Approvals
            </button>
            <div>
              <strong>Process Request</strong>
              <span>Review the complete request record and take the authorised action.</span>
            </div>
          </div>
          <div className={styles.processWorkspaceBody}>
            <RequestAccessGate requestId={selectedRequestId}>
              <RequestDetailsWorkspace
                requestId={selectedRequestId}
                embedded
                onClose={() => setSelectedRequestId(null)}
                onProcessed={() => { setSelectedRequestId(null); window.dispatchEvent(new Event(APPROVAL_QUEUE_CHANGED_EVENT)); void load(true); }}
              />
            </RequestAccessGate>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <PageHeader
        title="Approvals"
        description="Requests waiting for your decision, and the requests you have already acted on."
        actions={
          <button className={styles.refreshButton} onClick={() => void load(true)} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? styles.spin : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        }
      />

      {message ? <div className={styles.errorBanner}>{message}</div> : null}

      <WaitingForYou />

      {!loading && heldElsewhere.length > 0 ? (
        <div className="rg-approvals-held" role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          <p>
            <strong>{heldElsewhere.length} request{heldElsewhere.length === 1 ? " is" : "s are"} at your stage but assigned to another officer</strong>
            {" "}({heldElsewhere.map((row) => row.request_no || "request").slice(0, 4).join(", ")}{heldElsewhere.length > 4 ? ", …" : ""}).
            {" "}They are not counted as waiting for you. If you should handle them, ask Admin to reassign them (Admin → Routing Engine).
          </p>
        </div>
      ) : null}

      <section className={styles.compactKpis} aria-label="Approval summary">
        <StatTile title="Waiting for you" value={pendingRows.length} tone="amber" icon={<Clock3 size={18} />} note="Requests requiring attention" />
        <StatTile title="Approved by you" value={approvedCount} tone="emerald" icon={<CheckCircle2 size={18} />} note="Requests you approved or treated" />
        <StatTile title="Rejected by you" value={rejectedCount} tone="red" icon={<XCircle size={18} />} note="Requests you rejected or returned" />
        <StatTile title="Active role" value={activeRole || "staff"} tone="blue" icon={<ShieldCheck size={18} />} note="Current approval authority" />
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
          <div><h2>{view === "pending" ? "Requests waiting for you" : view === "history" ? "Your approval history" : "All approval records"}</h2><p>{view === "pending" ? "Open a request to review the full record and take the authorised action." : "Requests you have personally approved, treated, rejected or returned."}</p></div>
          <span>{filteredRows.length} record{filteredRows.length === 1 ? "" : "s"}</span>
        </div>

        {loading ? <div className={styles.emptyState}>Loading approvals...</div> : filteredRows.length === 0 ? (
          <div className={styles.emptyState}>{view === "pending" ? "No request is waiting for your approval." : "No approval history matches this view."}</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Request</th><th>Title</th><th>Type</th><th>Stage</th><th>Amount</th><th>Date</th><th>Action</th><th>Status</th></tr></thead>
              <tbody>{filteredRows.map((row) => (
                <tr key={row.id} className={styles.clickableRow} onClick={() => setSelectedRequestId(row.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedRequestId(row.id); }}>
                  <td className={styles.requestNo}>{row.request_no || "—"}</td>
                  <td><strong>{row.title || "Untitled request"}</strong></td>
                  <td><span className={styles.typeBadge}>{typeLabel(row)}</span></td>
                  <td>{row.current_stage || "—"}</td>
                  <td>{formatNaira(row.amount)}</td>
                  <td>{formatDate(row.created_at)}</td>
                  <td>
                    <button className={styles.reviewButton} onClick={(event) => { event.stopPropagation(); setSelectedRequestId(row.id); }}>
                      <Eye size={15} /> {isAwaitingUser(row, userId, activeRole) ? "Process Request" : "View Request"}
                    </button>
                  </td>
                  <td><span className={`${styles.statusBadge} ${isApproved(row) ? styles.badgeGreen : isClosed(row) ? styles.badgeRed : styles.badgeAmber}`}>{row.status || "Pending"}</span></td>
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
