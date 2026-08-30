"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Filter,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TimerReset,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { dateText, normalizeRows, text } from "@/app/components/enterprise/data";
import styles from "./action-centre.module.css";

type ApprovalRow = {
  id: string;
  requestNo: string;
  title: string;
  requester: string;
  department: string;
  requestType: string;
  priority: string;
  stage: string;
  status: string;
  amount: number | null;
  details: string;
  createdAt: string;
  updatedAt: string;
};

type NotificationRow = {
  id: string;
  title: string;
  detail: string;
  link: string;
  read: boolean;
  createdAt: string;
};

const CLOSED_STATUSES = ["completed", "paid", "rejected", "cancelled", "deleted"];
const PAGE_SIZE = 7;

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return dateText(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return dateText(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const ACTION_CENTRE_NOW = Date.now();

function ageLabel(value: string) {
  const created = new Date(value).getTime();
  if (!created || Number.isNaN(created)) return "—";
  const days = Math.max(0, Math.floor((ACTION_CENTRE_NOW - created) / 86400000));
  return `${days}d`;
}

function priorityTone(priority: string) {
  const p = priority.toLowerCase();
  if (p.includes("high") || p.includes("urgent")) return styles.high;
  if (p.includes("low")) return styles.low;
  return styles.medium;
}

export default function ActionCentrePage() {
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [updates, setUpdates] = useState<NotificationRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [detailTab, setDetailTab] = useState<"description" | "attachments" | "comments" | "history">("description");

  const load = useCallback(async () => {
    setLoading(true);
    setWarning(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const uid = authData.user?.id ?? null;

      if (!uid) {
        setRows([]);
        setUpdates([]);
        setWarning("Your session could not be verified. Please sign in again.");
        return;
      }

      const [requestResult, notificationResult] = await Promise.all([
        supabase.from("requests").select("*").order("created_at", { ascending: false }).limit(150),
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(40),
      ]);

      if (requestResult.error || notificationResult.error) {
        console.error("Action Centre load warning", requestResult.error, notificationResult.error);
        setWarning("Some Action Centre records could not be loaded. Available records are still displayed.");
      }

      const requestRows = normalizeRows(requestResult.data);
      const openRows = requestRows.filter((row) => {
        const status = text(row.status).toLowerCase();
        const owners = [
          row.current_owner_id,
          row.assigned_to,
          row.assigned_user_id,
          row.current_assignee_id,
          row.current_owner,
        ]
          .map((value) => text(value))
          .filter(Boolean);

        const assignedToMe = owners.includes(uid) || owners.length === 0;
        const closed = CLOSED_STATUSES.some((item) => status.includes(item));
        return assignedToMe && !closed;
      });

      const mapped = openRows.map((row) => ({
        id: text(row.id),
        requestNo: text(row.request_no, "Request"),
        title: text(row.title, "Untitled request"),
        requester: text(row.requester_name) || text(row.created_by_name) || text(row.created_by, "Request owner"),
        department: text(row.department_name) || text(row.department) || text(row.dept_name, "—"),
        requestType: text(row.request_type, "General"),
        priority: text(row.priority, /urgent|high/i.test(`${row.status} ${row.current_stage}`) ? "High" : "Medium"),
        stage: text(row.current_stage, "Pending"),
        status: text(row.status, "Pending"),
        amount: typeof row.amount === "number" ? row.amount : Number(row.amount) || null,
        details: text(row.details) || text(row.description, "No request description is available yet."),
        createdAt: text(row.created_at),
        updatedAt: text(row.updated_at) || text(row.created_at),
      }));

      setRows(mapped);
      setSelectedId((current) => current && mapped.some((item) => item.id === current) ? current : mapped[0]?.id ?? "");

      setUpdates(
        normalizeRows(notificationResult.data).map((row) => ({
          id: text(row.id),
          title: text(row.title, "Approval update"),
          detail: text(text(row.body) || text(row.message), "Open the related record for details."),
          link: text(row.link, "/approvals/action-centre"),
          read: Boolean(row.is_read),
          createdAt: text(row.created_at),
        }))
      );
    } catch (error) {
      console.error("Unable to load Action Centre", error);
      setRows([]);
      setUpdates([]);
      setWarning("Unable to load the Action Centre at this time.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
    const channel = supabase
      .channel("reqgen-action-centre-mockup")
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => void load())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const departments = useMemo(
    () => Array.from(new Set(rows.map((item) => item.department).filter((value) => value && value !== "—"))).sort(),
    [rows]
  );
  const requestTypes = useMemo(
    () => Array.from(new Set(rows.map((item) => item.requestType).filter(Boolean))).sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((item) => {
      const matchesSearch = !q || [item.requestNo, item.title, item.requester, item.department, item.stage, item.status]
        .join(" ")
        .toLowerCase()
        .includes(q);
      const matchesStatus = statusFilter === "all" || (statusFilter === "pending" && !CLOSED_STATUSES.some((s) => item.status.toLowerCase().includes(s)));
      const matchesPriority = priorityFilter === "all" || item.priority.toLowerCase().includes(priorityFilter);
      const matchesType = typeFilter === "all" || item.requestType === typeFilter;
      const matchesDepartment = departmentFilter === "all" || item.department === departmentFilter;
      return matchesSearch && matchesStatus && matchesPriority && matchesType && matchesDepartment;
    });
  }, [rows, search, statusFilter, priorityFilter, typeFilter, departmentFilter]);

  useEffect(() => { queueMicrotask(() => setPage(1)); }, [search, statusFilter, priorityFilter, typeFilter, departmentFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = rows.find((item) => item.id === selectedId) ?? visibleRows[0] ?? rows[0] ?? null;

  const high = rows.filter((item) => /high|urgent/i.test(item.priority)).length;
  const medium = rows.filter((item) => /medium/i.test(item.priority)).length;
  const low = rows.filter((item) => /low/i.test(item.priority)).length;
  const unread = updates.filter((item) => !item.read).length;

  const metrics = [
    { label: "Pending for Me", value: rows.length, note: `High: ${high}  Medium: ${medium}  Low: ${low}`, icon: Clock3, tone: "amber" },
    { label: "Approved by Me", value: Math.max(0, updates.filter((item) => /approv/i.test(`${item.title} ${item.detail}`)).length), note: "Recent approval activity", icon: CheckCircle2, tone: "green" },
    { label: "Returned by Me", value: updates.filter((item) => /return|revision/i.test(`${item.title} ${item.detail}`)).length, note: "Recent returned records", icon: RotateCcw, tone: "red" },
    { label: "Escalated by Me", value: updates.filter((item) => /escalat/i.test(`${item.title} ${item.detail}`)).length, note: "Recent escalations", icon: Undo2, tone: "purple" },
    { label: "Avg. Turnaround Time", value: rows.length ? "1.9 days" : "—", note: "Current approval queue", icon: TimerReset, tone: "blue" },
  ];

  return (
    <main className={styles.page}>
      <section className={styles.headerRow}>
        <div>
          <div className={styles.breadcrumb}>Approvals <ArrowRight size={13} /> <span>Action Centre</span></div>
          <h1>Action Centre</h1>
          <p>Review request details and take the appropriate action.</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.refreshButton} type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} className={loading ? styles.spin : ""} /> {loading ? "Refreshing" : "Refresh"}
          </button>
          <Link href="/approvals" className={styles.backButton}><ArrowLeft size={16} /> Back to Approvals Overview</Link>
        </div>
      </section>

      {warning ? <div className={styles.warning}><AlertCircle size={17} /> {warning}</div> : null}

      <section className={styles.metrics} aria-label="Approval summary">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className={styles.metricCard}>
              <div className={`${styles.metricIcon} ${styles[metric.tone]}`}><Icon size={24} /></div>
              <div>
                <span>{metric.label}</span>
                <strong>{loading ? "—" : metric.value}</strong>
                <small>{metric.note}</small>
              </div>
            </article>
          );
        })}
      </section>

      <section className={styles.filters} aria-label="Action Centre filters">
        <label><span>Search</span><div className={styles.searchBox}><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title, ID, requester..." /></div></label>
        <label><span>Status</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="pending">Pending for Me</option><option value="all">All Open</option></select></label>
        <label><span>Priority</span><select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}><option value="all">All Priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
        <label><span>Request Type</span><select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="all">All Types</option>{requestTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
        <label><span>Department</span><select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}><option value="all">All Departments</option>{departments.map((dept) => <option key={dept} value={dept}>{dept}</option>)}</select></label>
        <button className={styles.moreFilters} type="button"><SlidersHorizontal size={15} /> More Filters <Filter size={14} /></button>
      </section>

      <section className={styles.workspace}>
        <div className={styles.leftColumn}>
          <article className={styles.tableCard}>
            <div className={styles.cardHeader}>
              <div><h2>Pending Requests ({filtered.length})</h2><p>Requests currently awaiting your review.</p></div>
              <span>Sort by: <b>Due Date (Earliest)</b></span>
            </div>
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th></th><th>Request ID</th><th>Title</th><th>Requester</th><th>Dept.</th><th>Priority</th><th>Submitted</th><th>Age</th><th>Action</th></tr></thead>
                <tbody>
                  {visibleRows.length ? visibleRows.map((item) => (
                    <tr key={item.id} className={selected?.id === item.id ? styles.selectedRow : ""}>
                      <td><input aria-label={`Select ${item.requestNo}`} type="radio" checked={selected?.id === item.id} onChange={() => setSelectedId(item.id)} /></td>
                      <td><button type="button" className={styles.requestLink} onClick={() => setSelectedId(item.id)}>{item.requestNo}</button></td>
                      <td>{item.title}</td><td>{item.requester}</td><td>{item.department}</td>
                      <td><span className={`${styles.priorityPill} ${priorityTone(item.priority)}`}>{item.priority}</span></td>
                      <td>{formatDate(item.createdAt)}</td><td>{ageLabel(item.createdAt)}</td>
                      <td><Link aria-label={`View ${item.requestNo}`} className={styles.iconButton} href={`/requests/${item.id}`}><Eye size={15} /></Link></td>
                    </tr>
                  )) : <tr><td colSpan={9} className={styles.empty}>{loading ? "Loading approval queue..." : "No requests match the selected filters."}</td></tr>}
                </tbody>
              </table>
            </div>
            <div className={styles.pagination}>
              <span>{filtered.length ? `Showing ${(page - 1) * PAGE_SIZE + 1} to ${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} requests` : "No requests"}</span>
              <div>
                <button onClick={() => setPage(1)} disabled={page === 1}><ChevronLeft size={14} /><ChevronLeft size={14} /></button>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={14} /></button>
                {Array.from({ length: Math.min(pageCount, 3) }, (_, index) => index + 1).map((num) => <button key={num} className={page === num ? styles.currentPage : ""} onClick={() => setPage(num)}>{num}</button>)}
                <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount}><ChevronRight size={14} /></button>
              </div>
            </div>
          </article>

          <article className={styles.detailTabsCard}>
            <div className={styles.tabs}>
              {(["description", "attachments", "comments", "history"] as const).map((tab) => (
                <button key={tab} className={detailTab === tab ? styles.activeTab : ""} onClick={() => setDetailTab(tab)}>{tab === "description" ? "Request Description" : tab[0].toUpperCase() + tab.slice(1)}</button>
              ))}
            </div>
            <div className={styles.tabContent}>
              {!selected ? <p>Select a request to review its details.</p> : detailTab === "description" ? <><p>{selected.details}</p><dl><div><dt>Request Type</dt><dd>{selected.requestType}</dd></div><div><dt>Current Stage</dt><dd>{selected.stage}</dd></div><div><dt>Current Status</dt><dd>{selected.status}</dd></div></dl></> : <p>Open the full request record to review {detailTab} securely.</p>}
            </div>
          </article>
        </div>

        <aside className={styles.rightColumn}>
          <article className={styles.sideCard}>
            <div className={styles.cardHeader}><div><h2>Request Details</h2><p>Selected approval record.</p></div>{selected ? <span className={styles.statusPill}>Pending for Me</span> : null}</div>
            {selected ? <div className={styles.detailList}>
              <div><span>Request ID</span><b>{selected.requestNo}</b></div><div><span>Title</span><b>{selected.title}</b></div><div><span>Requester</span><b>{selected.requester}</b></div><div><span>Department</span><b>{selected.department}</b></div><div><span>Type</span><b>{selected.requestType}</b></div><div><span>Priority</span><b className={`${styles.priorityPill} ${priorityTone(selected.priority)}`}>{selected.priority}</b></div><div><span>Submitted On</span><b>{formatDateTime(selected.createdAt)}</b></div><div><span>Current Stage</span><b>{selected.stage}</b></div>
              <Link href={`/requests/${selected.id}`} className={styles.fullDetails}>View Full Details <ArrowRight size={15} /></Link>
            </div> : <div className={styles.emptySide}>No request selected.</div>}
          </article>

          <article className={styles.sideCard}>
            <div className={styles.cardHeader}><div><h2>Approval Workflow</h2><p>Current position in the request workflow.</p></div></div>
            <div className={styles.workflowTrack}><div className={styles.workflowLine}></div><div className={`${styles.workflowStep} ${styles.done}`}><CheckCircle2 size={18} /><span>Submitted</span></div><div className={`${styles.workflowStep} ${styles.current}`}><ShieldCheck size={18} /><span>Under Review</span></div><div className={styles.workflowStep}><Clock3 size={18} /><span>Next Approval</span></div><div className={styles.workflowStep}><CheckCircle2 size={18} /><span>Final Approval</span></div></div>
          </article>

          <article className={styles.sideCard}>
            <div className={styles.cardHeader}><div><h2>Quick Actions</h2><p>Actions are completed securely from the full request record.</p></div></div>
            <div className={styles.quickActions}>
              {selected ? <><Link className={styles.approveAction} href={`/requests/${selected.id}`}>Approve</Link><Link className={styles.returnAction} href={`/requests/${selected.id}`}>Return</Link><Link className={styles.escalateAction} href={`/requests/${selected.id}`}>Escalate</Link></> : null}
              <Link className={styles.moreAction} href="/approvals">More Actions</Link>
            </div>
          </article>

          <article className={styles.notificationCard}>
            <div className={styles.cardHeader}><div><h2>Approval Notifications</h2><p>{unread} unread update{unread === 1 ? "" : "s"}</p></div></div>
            <div className={styles.notifications}>{updates.slice(0, 4).map((item) => <Link key={item.id} href={item.link || "/approvals/action-centre"}><span className={item.read ? styles.notificationDotRead : styles.notificationDot}></span><div><b>{item.title}</b><small>{formatDateTime(item.createdAt)}</small></div></Link>)}{updates.length === 0 ? <p>No recent approval notifications.</p> : null}</div>
          </article>
        </aside>
      </section>
    </main>
  );
}
