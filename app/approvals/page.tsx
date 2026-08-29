"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Eye,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
  TimerReset,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import styles from "./approvals.module.css";

type RequestRow = {
  id: string;
  request_no: string;
  title: string;
  status: string;
  current_stage: string;
  current_owner: string | null;
  amount: number;
  created_at: string;
  request_type: string | null;
  personal_category: string | null;
  funds_state: string | null;
  assigned_account_officer_name: string | null;
};

type ProfileRole = {
  id: string;
  profile_id: string;
  role_key: string;
  role_name: string;
  is_primary: boolean;
  is_active: boolean;
};

type StageFilter =
  | "ALL"
  | "PO"
  | "DOD"
  | "DINADMIN"
  | "REGISTRAR"
  | "HOD"
  | "HR"
  | "DG"
  | "ACCOUNT"
  | "HRFILING";

type TypeFilter = "ALL" | "OFFICIAL" | "PERSONAL_FUND" | "PERSONAL_NONFUND";
type StatusFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

type MonthPoint = {
  label: string;
  pending: number;
  approved: number;
  rejected: number;
};

const PAGE_SIZE = 5;

function roleKey(role: string | null | undefined) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function stageKey(stage: string | null | undefined) {
  return String(stage || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function categoryKey(category: string | null | undefined) {
  return String(category || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function requestGroup(row: RequestRow): TypeFilter {
  const rt = String(row.request_type || "").trim().toUpperCase();
  const cat = categoryKey(row.personal_category);

  if (rt === "OFFICIAL") return "OFFICIAL";
  if (rt === "PERSONAL" && cat === "FUND") return "PERSONAL_FUND";
  if (rt === "PERSONAL") return "PERSONAL_NONFUND";
  return "ALL";
}

function requestTypeLabel(row: RequestRow) {
  const group = requestGroup(row);
  if (group === "OFFICIAL") return "Official";
  if (group === "PERSONAL_FUND") return "Personal Fund";
  if (group === "PERSONAL_NONFUND") return "Personal Other";
  return row.request_type || "Other";
}

function stageLabel(stage: string | null | undefined) {
  const s = stageKey(stage);
  if (s === "DINADMIN") return "DIN Admin";
  if (s === "HRFILING") return "HR Filing";
  if (s === "ACCOUNT") return "Account";
  return s || "—";
}

function isApproved(status: string | null | undefined) {
  const s = String(status || "").toLowerCase();
  return s.includes("approved") || s.includes("paid") || s.includes("complete") || s.includes("closed");
}

function isRejected(status: string | null | undefined) {
  const s = String(status || "").toLowerCase();
  return s.includes("reject") || s.includes("delete") || s.includes("cancel") || s.includes("failed");
}

function isEscalated(status: string | null | undefined) {
  return String(status || "").toLowerCase().includes("escalat");
}

function isPending(status: string | null | undefined) {
  return !isApproved(status) && !isRejected(status);
}

function isActiveApproval(row: RequestRow) {
  const status = String(row.status || "").toLowerCase();
  const stage = stageKey(row.current_stage);

  return (
    !!row.current_owner &&
    !["COMPLETED", "REJECTED", "DELETED", "CANCELLED"].includes(stage) &&
    !status.includes("reject") &&
    !status.includes("delete") &&
    !status.includes("cancel") &&
    !status.includes("paid") &&
    !status.includes("complete") &&
    !status.includes("closed")
  );
}

function statusTone(status: string | null | undefined) {
  if (isRejected(status)) return styles.badgeRed;
  if (isApproved(status)) return styles.badgeGreen;
  return styles.badgeAmber;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function relativeTime(value: string) {
  const time = new Date(value).getTime();
  if (!time) return "Recently";
  const minutes = Math.max(1, Math.floor((Date.now() - time) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthPoints(rows: RequestRow[]): MonthPoint[] {
  const now = new Date();
  const points = Array.from({ length: 6 }, (_, index) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: monthKey(d),
      label: d.toLocaleDateString("en-US", { month: "short" }),
      pending: 0,
      approved: 0,
      rejected: 0,
    };
  });

  const map = new Map(points.map((p) => [p.key, p]));
  rows.forEach((row) => {
    const d = new Date(row.created_at);
    if (Number.isNaN(d.getTime())) return;
    const point = map.get(monthKey(d));
    if (!point) return;
    if (isRejected(row.status)) point.rejected += 1;
    else if (isApproved(row.status)) point.approved += 1;
    else point.pending += 1;
  });

  return points.map(({ label, pending, approved, rejected }) => ({ label, pending, approved, rejected }));
}

function polyline(points: number[], width = 560, height = 176) {
  const max = Math.max(...points, 1);
  const step = points.length > 1 ? width / (points.length - 1) : width;
  return points
    .map((value, index) => `${Math.round(index * step)},${Math.round(height - (value / max) * (height - 26) - 10)}`)
    .join(" ");
}

function donutGradient(values: number[]) {
  const colors = ["#1463f3", "#20a66a", "#f7941d", "#7b4bc4", "#9aa8b8"];
  const total = Math.max(values.reduce((a, b) => a + b, 0), 1);
  let cursor = 0;
  return `conic-gradient(${values
    .map((value, index) => {
      const start = (cursor / total) * 360;
      cursor += value;
      const end = (cursor / total) * 360;
      return `${colors[index]} ${start}deg ${end}deg`;
    })
    .join(",")})`;
}

export default function ApprovalsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [allRows, setAllRows] = useState<RequestRow[]>([]);
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [meRole, setMeRole] = useState<string | null>(null);
  const [meRoles, setMeRoles] = useState<ProfileRole[]>([]);
  const [activeRole, setActiveRole] = useState("staff");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [stageFilter, setStageFilter] = useState<StageFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      options?.silent ? setRefreshing(true) : setLoading(true);
      setMessage(null);

      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        router.push("/login");
        return;
      }

      const [profileRes, rolesRes, activeRoleRes, requestRes, notificationRes] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
        supabase
          .from("profile_roles")
          .select("id,profile_id,role_key,role_name,is_primary,is_active")
          .eq("profile_id", user.id)
          .eq("is_active", true),
        supabase.rpc("get_my_active_role"),
        supabase
          .from("requests")
          .select(
            "id,request_no,title,status,current_stage,current_owner,amount,created_at,request_type,personal_category,funds_state,assigned_account_officer_name"
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("is_read", false),
      ]);

      if (profileRes.error) {
        setMessage("Failed to load your profile: " + profileRes.error.message);
      } else {
        setMeRole((profileRes.data?.role as string) || "Staff");
      }

      setMeRoles(rolesRes.error ? [] : ((rolesRes.data || []) as ProfileRole[]));

      const rawActiveRole = activeRoleRes.data as unknown;
      let resolved = "";
      if (typeof rawActiveRole === "string") resolved = rawActiveRole;
      else if (Array.isArray(rawActiveRole)) {
        const first = rawActiveRole[0] as Record<string, unknown> | undefined;
        resolved = String(first?.active_role_key || first?.role_key || first?.get_my_active_role || "");
      } else if (rawActiveRole && typeof rawActiveRole === "object") {
        const item = rawActiveRole as Record<string, unknown>;
        resolved = String(item.active_role_key || item.role_key || item.get_my_active_role || "");
      }

      const effectiveRole = roleKey(resolved || (profileRes.data?.role as string) || "staff");
      setActiveRole(effectiveRole);

      if (requestRes.error) {
        setMessage("Failed to load approvals: " + requestRes.error.message);
        setRows([]);
        setAllRows([]);
      } else {
        const requestRows = (requestRes.data || []) as RequestRow[];
        setAllRows(requestRows);

        const stageForRole: Record<string, string[]> = {
          po: ["PO"],
          dod: ["DOD"],
          director: ["DOD"],
          dinadmin: ["DINADMIN"],
          registrar: ["REGISTRAR"],
          registry: ["REGISTRAR"],
          hod: ["HOD"],
          hr: ["HR", "HRFILING"],
          hrboss: ["HR", "HRFILING"],
          hrofficer: ["HR", "HRFILING"],
          dg: ["DG"],
          account: ["ACCOUNT"],
          accounts: ["ACCOUNT"],
          accountofficer: ["ACCOUNT"],
        };
        const allowedStages = stageForRole[effectiveRole] || [];
        const canSeeAll = ["admin", "auditor"].includes(effectiveRole);

        const actionable = requestRows
          .filter(isActiveApproval)
          .filter((row) => canSeeAll || row.current_owner === user.id || allowedStages.includes(stageKey(row.current_stage)));
        setRows(actionable);
      }

      if (!notificationRes.error) setUnreadCount(notificationRes.count || 0);
      setLoading(false);
      setRefreshing(false);
    },
    [router]
  );

  useEffect(() => {
    void load();
    const refreshOnFocus = () => void load({ silent: true });
    const refreshOnVisible = () => document.visibilityState === "visible" && void load({ silent: true });
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisible);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("approvals-overview-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => void load({ silent: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => void load({ silent: true }))
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (typeFilter !== "ALL" && requestGroup(row) !== typeFilter) return false;
      if (stageFilter !== "ALL" && stageKey(row.current_stage) !== stageFilter) return false;
      if (statusFilter === "PENDING" && !isPending(row.status)) return false;
      if (statusFilter === "APPROVED" && !isApproved(row.status)) return false;
      if (statusFilter === "REJECTED" && !isRejected(row.status)) return false;
      if (!query) return true;
      return [row.request_no, row.title, row.status, row.current_stage, row.request_type, row.personal_category]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [rows, search, typeFilter, stageFilter, statusFilter]);

  useEffect(() => setPage(1), [search, typeFilter, stageFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const approvedWeek = allRows.filter((r) => new Date(r.created_at) >= weekAgo && isApproved(r.status)).length;
  const rejectedWeek = allRows.filter((r) => new Date(r.created_at) >= weekAgo && isRejected(r.status)).length;
  const escalated = rows.filter((r) => isEscalated(r.status) || stageKey(r.current_stage) === "DG").length;
  const avgAgeDays = rows.length
    ? rows.reduce((sum, r) => sum + Math.max(0, (Date.now() - new Date(r.created_at).getTime()) / 86400000), 0) / rows.length
    : 0;

  const monthPoints = useMemo(() => buildMonthPoints(allRows), [allRows]);
  const typeCounts = useMemo(() => {
    const official = rows.filter((r) => requestGroup(r) === "OFFICIAL").length;
    const fund = rows.filter((r) => requestGroup(r) === "PERSONAL_FUND").length;
    const other = rows.filter((r) => requestGroup(r) === "PERSONAL_NONFUND").length;
    const account = rows.filter((r) => stageKey(r.current_stage) === "ACCOUNT").length;
    const remainder = Math.max(0, rows.length - official - fund - other);
    return [official, fund, other, account, remainder];
  }, [rows]);

  const stageSummary = useMemo(() => {
    const entries = [
      ["High Attention", rows.filter((r) => ["DG", "ACCOUNT"].includes(stageKey(r.current_stage))).length, "red"],
      ["Mid Workflow", rows.filter((r) => ["HOD", "HR", "REGISTRAR"].includes(stageKey(r.current_stage))).length, "amber"],
      ["Early Workflow", rows.filter((r) => ["PO", "DOD", "DINADMIN"].includes(stageKey(r.current_stage))).length, "green"],
    ] as const;
    const max = Math.max(...entries.map((e) => e[1]), 1);
    return entries.map(([label, value, tone]) => ({ label, value, tone, pct: Math.round((value / max) * 100) }));
  }, [rows]);

  const notifications = useMemo(() => allRows.slice(0, 4), [allRows]);

  function resetFilters() {
    setSearch("");
    setTypeFilter("ALL");
    setStageFilter("ALL");
    setStatusFilter("ALL");
  }

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Approvals Overview</h1>
          <p>Review and take action on requests awaiting your approval.</p>
        </div>
        <button className={styles.primaryButton} onClick={() => router.push("/approvals/action-centre")}>
          Go to Action Centre <ArrowRight size={16} />
        </button>
      </div>

      {message && <div className={styles.message}>{message}</div>}

      <section className={styles.kpiGrid} aria-label="Approval summary">
        <KpiCard icon={<Clock3 />} label="Pending for Me" value={rows.length.toLocaleString()} tone="amber" note="Awaiting your action" trend="up" />
        <KpiCard icon={<ShieldCheck />} label="Approved (This Week)" value={approvedWeek.toLocaleString()} tone="green" note="Completed approvals" trend="up" />
        <KpiCard icon={<CircleAlert />} label="Rejected (This Week)" value={rejectedWeek.toLocaleString()} tone="red" note="Returned or rejected" trend="down" />
        <KpiCard icon={<TimerReset />} label="Escalated" value={escalated.toLocaleString()} tone="purple" note="DG / escalated stage" trend="up" />
        <KpiCard icon={<Clock3 />} label="Avg. Pending Age" value={`${avgAgeDays.toFixed(1)} days`} tone="blue" note="Current actionable queue" />
      </section>

      <section className={styles.filterCard}>
        <FilterField label="Search">
          <div className={styles.searchBox}>
            <Search size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title, ID, requester..." />
          </div>
        </FilterField>
        <FilterField label="Status">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="ALL">All Statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option>
          </select>
        </FilterField>
        <FilterField label="Workflow Stage">
          <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as StageFilter)}>
            <option value="ALL">All Stages</option><option value="PO">PO</option><option value="DOD">DOD</option><option value="DINADMIN">DIN Admin</option><option value="REGISTRAR">Registrar</option><option value="HOD">HOD</option><option value="HR">HR</option><option value="DG">DG</option><option value="ACCOUNT">Account</option><option value="HRFILING">HR Filing</option>
          </select>
        </FilterField>
        <FilterField label="Request Type">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}>
            <option value="ALL">All Types</option><option value="OFFICIAL">Official</option><option value="PERSONAL_FUND">Personal Fund</option><option value="PERSONAL_NONFUND">Personal Other</option>
          </select>
        </FilterField>
        <button className={styles.filterButton} onClick={resetFilters}><Filter size={15} /> Reset Filters</button>
      </section>

      <section className={styles.analyticsGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}><h2>Approvals Trend</h2><span>Last 6 Months</span></div>
          <div className={styles.legend}><i className={styles.dotAmber} />Pending <i className={styles.dotGreen} />Approved <i className={styles.dotRed} />Rejected</div>
          <div className={styles.lineChart}>
            <svg viewBox="0 0 560 210" role="img" aria-label="Approvals trend for the last six months">
              {[35, 75, 115, 155].map((y) => <line key={y} x1="0" y1={y} x2="560" y2={y} className={styles.gridLine} />)}
              <polyline points={polyline(monthPoints.map((p) => p.pending))} className={styles.lineAmber} />
              <polyline points={polyline(monthPoints.map((p) => p.approved))} className={styles.lineGreen} />
              <polyline points={polyline(monthPoints.map((p) => p.rejected))} className={styles.lineRed} />
              {monthPoints.map((p, i) => <text key={p.label} x={i * 112} y="202" className={styles.axisText}>{p.label}</text>)}
            </svg>
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}><h2>Requests by Type</h2><span>Live Queue</span></div>
          <div className={styles.donutLayout}>
            <div className={styles.donut} style={{ background: donutGradient(typeCounts) }}><div><strong>{rows.length}</strong><span>Total</span></div></div>
            <div className={styles.donutLegend}>
              <LegendRow tone="blue" label="Official" value={typeCounts[0]} total={rows.length} />
              <LegendRow tone="green" label="Personal Fund" value={typeCounts[1]} total={rows.length} />
              <LegendRow tone="orange" label="Personal Other" value={typeCounts[2]} total={rows.length} />
              <LegendRow tone="purple" label="Account Stage" value={typeCounts[3]} total={rows.length} />
              <LegendRow tone="slate" label="Others" value={typeCounts[4]} total={rows.length} />
            </div>
          </div>
        </article>

        <aside className={styles.sideStack}>
          <article className={styles.smallPanel}>
            <div className={styles.panelHeader}><h2>Stage Attention</h2><span>Live</span></div>
            {stageSummary.map((item) => <ProgressRow key={item.label} {...item} />)}
          </article>
          <article className={styles.smallPanel}>
            <div className={styles.panelHeader}><h2>Quick Filters</h2></div>
            <QuickRow label="Account Stage" value={rows.filter((r) => stageKey(r.current_stage) === "ACCOUNT").length} tone="red" />
            <QuickRow label="DG Review" value={rows.filter((r) => stageKey(r.current_stage) === "DG").length} tone="amber" />
            <QuickRow label="HR Review" value={rows.filter((r) => stageKey(r.current_stage) === "HR").length} tone="blue" />
            <QuickRow label="HR Filing" value={rows.filter((r) => stageKey(r.current_stage) === "HRFILING").length} tone="purple" />
          </article>
        </aside>
      </section>

      <section className={styles.lowerGrid}>
        <article className={styles.tablePanel}>
          <div className={styles.panelHeader}>
            <h2>Recent Pending Approvals</h2>
            <button className={styles.linkButton} onClick={() => router.push("/approvals/action-centre")}>View All <ArrowRight size={14} /></button>
          </div>
          {loading ? (
            <div className={styles.emptyState}>Loading approvals...</div>
          ) : pageRows.length === 0 ? (
            <div className={styles.emptyState}>No pending approvals match the selected filters.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Request ID</th><th>Title</th><th>Type</th><th>Stage</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>{pageRows.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.requestNo}>{row.request_no || "—"}</td>
                    <td>{row.title || "—"}</td>
                    <td><span className={styles.typeBadge}>{requestTypeLabel(row)}</span></td>
                    <td>{stageLabel(row.current_stage)}</td>
                    <td>{formatDate(row.created_at)}</td>
                    <td><span className={`${styles.statusBadge} ${statusTone(row.status)}`}>{row.status || "Pending"}</span></td>
                    <td><button className={styles.iconButton} aria-label={`Review ${row.request_no}`} onClick={() => router.push(`/requests/${row.id}?updated=${Date.now()}`)}><Eye size={15} /></button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <div className={styles.pagination}>
            <span>Showing {filteredRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1} to {Math.min(safePage * PAGE_SIZE, filteredRows.length)} of {filteredRows.length} requests</span>
            <div>
              <button disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft size={15} /></button>
              {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => i + 1).map((p) => <button key={p} className={p === safePage ? styles.activePage : ""} onClick={() => setPage(p)}>{p}</button>)}
              {totalPages > 3 && <span>…</span>}
              <button disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRight size={15} /></button>
            </div>
          </div>
        </article>

        <aside className={styles.notificationsPanel}>
          <div className={styles.panelHeader}><h2>Approval Notifications</h2><span>{unreadCount} unread</span></div>
          {notifications.length === 0 ? <div className={styles.emptyState}>No recent approval updates.</div> : notifications.map((row, index) => (
            <button key={row.id} className={styles.notificationItem} onClick={() => router.push(`/requests/${row.id}`)}>
              <span className={`${styles.notificationIcon} ${index % 4 === 0 ? styles.noticeRed : index % 4 === 1 ? styles.noticeAmber : index % 4 === 2 ? styles.noticeGreen : styles.noticePurple}`}>
                {index % 4 === 2 ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}
              </span>
              <span><strong>{row.request_no || "Request"} — {row.status || "Updated"}</strong><small>{relativeTime(row.created_at)}</small></span>
            </button>
          ))}
          <button className={styles.refreshLink} onClick={() => load({ silent: true })} disabled={refreshing}><RefreshCw size={14} className={refreshing ? styles.spin : ""} /> {refreshing ? "Refreshing..." : "Refresh Updates"}</button>
        </aside>
      </section>

      <section className={styles.securityTip}>
        <ShieldCheck size={22} />
        <div><strong>Approval Security Tip</strong><p>Review request details and supporting evidence carefully before taking action. Always act using the correct active role.</p></div>
        <span>Active role: <b>{activeRole || roleKey(meRole) || "staff"}</b>{meRoles.length > 1 ? ` • ${meRoles.length} assigned roles` : ""}</span>
      </section>
    </main>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return <label className={styles.filterField}><span>{label}</span>{children}</label>;
}

function KpiCard({ icon, label, value, tone, note, trend }: { icon: ReactNode; label: string; value: string; tone: "amber" | "green" | "red" | "purple" | "blue"; note: string; trend?: "up" | "down" }) {
  return <article className={styles.kpiCard}>
    <span className={`${styles.kpiIcon} ${styles[`tone_${tone}`]}`}>{icon}</span>
    <div><span className={styles.kpiLabel}>{label}</span><strong className={`${styles.kpiValue} ${styles[`text_${tone}`]}`}>{value}</strong><small>{trend === "up" ? <TrendingUp size={13} /> : trend === "down" ? <TrendingDown size={13} /> : null}{note}</small></div>
  </article>;
}

function LegendRow({ tone, label, value, total }: { tone: string; label: string; value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return <div className={styles.legendRow}><i className={styles[`legend_${tone}`]} /><span>{label}</span><b>{value} ({pct}%)</b></div>;
}

function ProgressRow({ label, value, tone, pct }: { label: string; value: number; tone: string; pct: number }) {
  return <div className={styles.progressRow}><div><span>{label}</span><b>{value}</b></div><div className={styles.progressTrack}><i className={styles[`progress_${tone}`]} style={{ width: `${Math.max(pct, value ? 12 : 0)}%` }} /></div></div>;
}

function QuickRow({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className={styles.quickRow}><span>{label}</span><b className={styles[`quick_${tone}`]}>{value}</b></div>;
}
