"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Eye,
  FilePlus2,
  Flag,
  Inbox,
  MoreVertical,
  RefreshCw,
  Search,
  Send,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import styles from "@/app/registry/registry.module.css";

type Raw = Record<string, unknown>;
type Department = { id: string; name: string };
type ViewKey = "overview" | "incoming" | "outgoing" | "dispatch" | "all";
type Correspondence = {
  id: string;
  referenceNo: string;
  subject: string;
  direction: string;
  departmentId: string;
  department: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  party: string;
  dispatchMethod: string;
};
type RequestRow = {
  id: string;
  request_no: string | null;
  title: string | null;
  status: string | null;
  current_stage: string | null;
  current_owner: string | null;
  created_by: string | null;
  assigned_account_officer_id: string | null;
  assigned_account_officer_name: string | null;
  created_at: string | null;
};
type HistoryRow = {
  id: string;
  request_id: string;
  action_type: string | null;
  to_stage: string | null;
  actor_name: string | null;
  actor_role_name: string | null;
  created_at: string | null;
};
type VoucherRow = {
  id: string;
  request_id: string | null;
  voucher_no: string | null;
  status: string | null;
  voucher_type: string | null;
  created_at: string | null;
};

const VIEWS: Array<{ key: ViewKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "incoming", label: "Incoming Register" },
  { key: "outgoing", label: "Outgoing Register" },
  { key: "dispatch", label: "Dispatch" },
  { key: "all", label: "All Operations" },
];

const FLOW_STAGES = [
  { key: "REQUESTER", label: "Requester / Staff" },
  { key: "HOD", label: "HOD" },
  { key: "DOD", label: "DOD" },
  { key: "DIRECTOR", label: "Director" },
  { key: "HR", label: "HR" },
  { key: "REGISTRAR", label: "Registry / Registrar" },
  { key: "DG", label: "DG" },
  { key: "ACCOUNT", label: "Account Processing" },
] as const;

function s(v: unknown, fallback = "") {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}
function stageKey(v: unknown) {
  const key = s(v).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (key === "PO") return "REQUESTER";
  if (key === "DINADMIN") return "DIRECTOR";
  if (key === "REGISTRY") return "REGISTRAR";
  if (key === "ACCOUNTOFFICER" || key === "FINANCE") return "ACCOUNT";
  return key;
}
function dateValue(v: string | null | undefined) {
  const d = new Date(v || "");
  return Number.isNaN(d.getTime()) ? null : d;
}
function dateText(v: string | null | undefined) {
  const d = dateValue(v);
  return d
    ? d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
}
function isToday(v: string) {
  const d = dateValue(v);
  const n = new Date();
  return !!d && d.toDateString() === n.toDateString();
}
function mapRow(row: Raw, names: Map<string, string>): Correspondence {
  const departmentId = s(row.department_id, s(row.dept_id));
  return {
    id: s(row.id),
    referenceNo: s(row.reference_no, "Unnumbered"),
    subject: s(row.subject, "Untitled correspondence"),
    direction: s(row.direction, "Incoming"),
    departmentId,
    department: s(row.department_name, names.get(departmentId) || "Unassigned"),
    priority: s(row.priority, "Normal"),
    status: s(row.status, "Pending"),
    createdAt: s(row.created_at),
    updatedAt: s(row.updated_at, s(row.created_at)),
    party: s(row.from_to, s(row.sender_name, s(row.recipient_name, s(row.sender, s(row.recipient, s(row.source, s(row.destination, "—"))))))),
    dispatchMethod: s(row.dispatch_method, s(row.delivery_method, "—")),
  };
}
function statusTone(value: string) {
  const x = value.toLowerCase();
  if (/delivered|complete|approved|collected|closed|paid/.test(x)) return { bg: "var(--color-success-50)", color: "var(--color-success-700)" };
  if (/await|pending|draft|progress/.test(x)) return { bg: "var(--color-warning-50)", color: "var(--color-warning-700)" };
  if (/overdue|reject|cancel|missing/.test(x)) return { bg: "var(--color-danger-50)", color: "var(--color-danger-700)" };
  if (/dispatch/.test(x)) return { bg: "#f3efff", color: "#6842c2" };
  return { bg: "var(--color-brand-50)", color: "var(--color-brand-700)" };
}
function priorityTone(value: string) {
  return /urgent|high/i.test(value)
    ? { bg: "var(--color-danger-50)", color: "var(--color-danger-600)" }
    : /low/i.test(value)
      ? { bg: "var(--color-brand-50)", color: "var(--color-brand-600)" }
      : { bg: "var(--color-warning-50)", color: "var(--color-warning-700)" };
}

export default function RegistryCentreWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const requestedView = (params.get("view") || "overview") as ViewKey;
  const view: ViewKey = VIEWS.some((v) => v.key === requestedView) ? requestedView : "overview";

  const [rows, setRows] = useState<Correspondence[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [chartDetail, setChartDetail] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState("all");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [form, setForm] = useState({ referenceNo: "", subject: "", direction: "Incoming", departmentId: "", priority: "Normal", status: "Received / Logged", party: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    const [deptResult, registryResult, requestResult, historyResult, voucherResult] = await Promise.all([
      supabase.from("departments").select("id,name").order("name", { ascending: true }),
      supabase.from("registry_correspondence").select("*").order("created_at", { ascending: false }).limit(2000),
      supabase.from("requests").select("id,request_no,title,status,current_stage,current_owner,created_by,assigned_account_officer_id,assigned_account_officer_name,created_at").order("created_at", { ascending: false }).limit(5000),
      supabase.from("request_history").select("id,request_id,action_type,to_stage,actor_name,actor_role_name,created_at").order("created_at", { ascending: false }).limit(10000),
      supabase.from("payment_vouchers").select("id,request_id,voucher_no,status,voucher_type,created_at").order("created_at", { ascending: false }).limit(5000),
    ]);

    const errors = [deptResult.error, registryResult.error, requestResult.error, historyResult.error, voucherResult.error]
      .filter(Boolean)
      .map((error) => error?.message)
      .filter(Boolean);
    if (errors.length) setMessage(errors.join(" · "));

    const depts = (deptResult.data || []) as Department[];
    setDepartments(depts);
    const names = new Map(depts.map((d) => [d.id, d.name]));
    setRows(((registryResult.data || []) as Raw[]).map((r) => mapRow(r, names)));
    setRequests((requestResult.data || []) as RequestRow[]);
    setHistory((historyResult.data || []) as HistoryRow[]);
    setVouchers((voucherResult.data || []) as VoucherRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
  }, [load]);

  const requestMap = useMemo(() => new Map(requests.map((request) => [request.id, request])), [requests]);
  const statuses = useMemo(() => Array.from(new Set(rows.map((r) => r.status))).filter(Boolean).sort(), [rows]);
  const priorities = useMemo(() => Array.from(new Set(rows.map((r) => r.priority))).filter(Boolean).sort(), [rows]);
  const scoped = useMemo(() => rows.filter((r) =>
    view === "incoming" ? r.direction.toLowerCase() === "incoming" :
    view === "outgoing" ? r.direction.toLowerCase() === "outgoing" :
    view === "dispatch" ? /dispatch|awaiting collection|collected|delivered|courier|ack/i.test(`${r.status} ${r.dispatchMethod}`) : true
  ), [rows, view]);
  const filtered = useMemo(() => scoped.filter((r) => {
    const q = query.trim().toLowerCase();
    const d = dateValue(r.createdAt);
    return (!q || [r.referenceNo, r.subject, r.party, r.department, r.status].some((x) => x.toLowerCase().includes(q))) &&
      (direction === "all" || r.direction.toLowerCase() === direction) &&
      (department === "all" || r.departmentId === department) &&
      (status === "all" || r.status === status) &&
      (priority === "all" || r.priority === priority) &&
      (!dateFrom || (!!d && d >= new Date(`${dateFrom}T00:00:00`))) &&
      (!dateTo || (!!d && d <= new Date(`${dateTo}T23:59:59`)));
  }), [scoped, query, direction, department, status, priority, dateFrom, dateTo]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const registryStats = useMemo(() => ({
    total: rows.length,
    incomingToday: rows.filter((r) => r.direction.toLowerCase() === "incoming" && isToday(r.createdAt)).length,
    outgoingToday: rows.filter((r) => r.direction.toLowerCase() === "outgoing" && isToday(r.createdAt)).length,
    pendingDispatch: rows.filter((r) => /pending dispatch|awaiting dispatch|ready for dispatch/i.test(r.status)).length,
    awaitingAck: rows.filter((r) => /await.*ack|acknowledg|awaiting collection/i.test(r.status)).length,
    high: rows.filter((r) => /high|urgent/i.test(r.priority)).length,
  }), [rows]);

  const workflowSummary = useMemo(() => {
    const rejected = requests.filter((r) => /reject|cancel/i.test(`${r.status} ${r.current_stage}`)).length;
    const approved = requests.filter((r) => /approved|complete|paid|closed/i.test(`${r.status} ${r.current_stage}`)).length;
    const active = Math.max(0, requests.length - rejected - approved);
    const manualPvs = vouchers.filter((v) => /manual/i.test(v.voucher_type || "")).length;
    return { total: requests.length, active, approved, rejected, manualPvs, linkedPvs: vouchers.length - manualPvs };
  }, [requests, vouchers]);

  const stageRows = useMemo(() => FLOW_STAGES.map((stage) => {
    if (stage.key === "REQUESTER") {
      return { ...stage, current: requests.length, movements: requests.length };
    }
    const current = requests.filter((request) => stageKey(request.current_stage) === stage.key).length;
    const movements = history.filter((item) => stageKey(item.to_stage) === stage.key).length;
    return { ...stage, current, movements };
  }), [requests, history]);
  const maxStage = Math.max(1, ...stageRows.map((row) => Math.max(row.current, row.movements)));

  const accountQueues = useMemo(() => {
    const counts = new Map<string, number>();
    requests.filter((request) => stageKey(request.current_stage) === "ACCOUNT").forEach((request) => {
      const name = request.assigned_account_officer_name?.trim() || "Unassigned Account Queue";
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [requests]);

  const recentMovement = useMemo(() => history.slice(0, 12).map((item) => ({
    ...item,
    request: requestMap.get(item.request_id),
  })), [history, requestMap]);

  async function saveNew() {
    if (!form.referenceNo.trim() || !form.subject.trim()) {
      setMessage("Reference number and subject are required.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const base: Record<string, unknown> = {
      reference_no: form.referenceNo.trim(), subject: form.subject.trim(), direction: form.direction,
      priority: form.priority, status: form.status,
    };
    if (form.departmentId) base.department_id = form.departmentId;
    let result = await supabase.from("registry_correspondence").insert({ ...base, from_to: form.party.trim() || null });
    if (result.error && /column|schema|from_to/i.test(result.error.message)) result = await supabase.from("registry_correspondence").insert(base);
    if (result.error) setMessage(`Unable to create correspondence: ${result.error.message}`);
    else {
      setMessage("Correspondence created successfully.");
      setShowForm(false);
      setForm({ referenceNo: "", subject: "", direction: "Incoming", departmentId: "", priority: "Normal", status: "Received / Logged", party: "" });
      await load();
    }
    setSaving(false);
  }

  return <main className={styles.page} data-rg-standard="phase7"><div className={styles.shell}>
    <section className={styles.hero}>
      <div><h1 className={styles.title}>Registry Centre</h1><p className={styles.subtitle}>Track request movement, registry operations, correspondence and dispatch from one live workspace.</p></div>
      <div className={styles.actions}><button className={styles.buttonSecondary} onClick={() => void load()}><RefreshCw size={16}/>Refresh</button><button className={styles.button} onClick={() => setShowForm((x) => !x)}><FilePlus2 size={16}/>New Correspondence</button></div>
    </section>

    {message && <div className={`${styles.notice} ${/unable|failed|error/i.test(message) ? styles.error : styles.success}`}>{message}</div>}

    <nav className={styles.tabs} data-rg-tabs="true" role="tablist" aria-label="Registry Centre workspaces">
      {VIEWS.map((v) => <button key={v.key} role="tab" aria-selected={view === v.key} className={`${styles.tab} ${view === v.key ? styles.tabActive : ""}`} onClick={() => { setPage(1); router.replace(`/registry?view=${v.key}`); }}>{v.label}</button>)}
    </nav>

    {showForm && <section className={styles.form}><div><h2 className={styles.cardTitle}>New Correspondence</h2><p className={styles.cardNote}>Create the core registry record. The live Registry table remains the authoritative source.</p></div><div className={styles.formGrid}>
      <label className={styles.field}><span className={styles.label}>Reference No. *</span><input className={styles.input} value={form.referenceNo} onChange={(e) => setForm((f) => ({ ...f, referenceNo: e.target.value }))}/></label>
      <label className={styles.field}><span className={styles.label}>Direction</span><select className={styles.select} value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))}><option>Incoming</option><option>Outgoing</option></select></label>
      <label className={styles.field}><span className={styles.label}>Department</span><select className={styles.select} value={form.departmentId} onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}><option value="">Unassigned</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <label className={styles.field}><span className={styles.label}>Subject *</span><input className={styles.input} value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}/></label>
      <label className={styles.field}><span className={styles.label}>From / To</span><input className={styles.input} value={form.party} onChange={(e) => setForm((f) => ({ ...f, party: e.target.value }))}/></label>
      <label className={styles.field}><span className={styles.label}>Priority</span><select className={styles.select} value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}><option>Low</option><option>Normal</option><option>Medium</option><option>High</option><option>Urgent</option></select></label>
      <label className={styles.field}><span className={styles.label}>Status</span><select className={styles.select} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}><option>Received / Logged</option><option>In Progress</option><option>Awaiting Dispatch</option><option>Dispatched</option><option>Awaiting Acknowledgement</option><option>Delivered</option><option>Closed / Completed</option></select></label>
    </div><div className={styles.formActions}><button className={styles.buttonSecondary} onClick={() => setShowForm(false)}>Cancel</button><button className={styles.button} disabled={saving} onClick={() => void saveNew()}>{saving ? "Saving..." : "Save Correspondence"}</button></div></section>}

    {view === "overview" && <>
      <section className={styles.kpis}>{([
        ["Total Requests", workflowSummary.total, "All visible request records", Inbox],
        ["Active Workflow", workflowSummary.active, "Currently moving", Send],
        ["Approved / Completed", workflowSummary.approved, "Finished workflow", ArrowUpFromLine],
        ["Rejected / Cancelled", workflowSummary.rejected, "Stopped workflow", Flag],
        ["Request-linked PVs", workflowSummary.linkedPvs, "Generated from requests", Truck],
        ["Manual PVs", workflowSummary.manualPvs, "Controlled manual vouchers", ArrowDownToLine],
      ] as Array<[string, number, string, LucideIcon]>).map(([label, value, note, Icon]) => <div className={styles.kpi} key={label}><span className={styles.kpiIcon}><Icon size={19}/></span><div className={styles.kpiLabel}>{label}</div><div className={styles.kpiValue}>{loading ? "—" : value.toLocaleString()}</div><div className={styles.kpiNote}>{note}</div></div>)}</section>

      <section className={styles.workflowGrid}>
        <article className={styles.card}><h2 className={styles.cardTitle}>Request Workflow Movement</h2><p className={styles.cardNote}>Current queues and historical transitions from requester through approval and Account processing.</p><div className={styles.flowBars}>{stageRows.map((row) => <button key={row.key} type="button" className={styles.flowRow} onClick={() => setChartDetail(`${row.label}: ${row.current} currently at this stage; ${row.movements} recorded transitions.`)}><span>{row.label}</span><i><b style={{ width: `${Math.max(row.current || row.movements ? 3 : 0, (Math.max(row.current, row.movements) / maxStage) * 100)}%` }}/></i><strong>{row.current}</strong><small>{row.movements} moves</small></button>)}</div></article>
        <article className={styles.card}><h2 className={styles.cardTitle}>Account Queues</h2><p className={styles.cardNote}>Requests currently routed to the configured Account Officers.</p><div className={styles.queueList}>{accountQueues.length ? accountQueues.map(([name, count], index) => <div key={name}><span><b>{index + 1}</b><strong>{name}</strong></span><em>{count}</em></div>) : <div className={styles.empty}>No requests are currently in Account processing.</div>}</div></article>
        <article className={styles.card}><h2 className={styles.cardTitle}>Registry Operations</h2><p className={styles.cardNote}>Live correspondence and dispatch register alongside workflow tracking.</p><div className={styles.miniStats}><div><strong>{registryStats.total}</strong><span>Total correspondence</span></div><div><strong>{registryStats.pendingDispatch}</strong><span>Pending dispatch</span></div><div><strong>{registryStats.awaitingAck}</strong><span>Awaiting acknowledgement</span></div><div><strong>{registryStats.high}</strong><span>High priority</span></div></div></article>
      </section>
      <div className={styles.chartDetail} role="status" aria-live="polite">{chartDetail || "Select a workflow row to display its exact live values."}</div>

      <section className={styles.tableCard}><div className={styles.tableHeader}><div><h2 className={styles.cardTitle}>Recent Request Movements</h2><p className={styles.cardNote}>Latest approval/routing evidence from request history.</p></div><span className={styles.badge} style={{ background: "var(--color-brand-50)", color: "var(--color-brand-700)" }}>{history.length} events</span></div><div className={styles.tableWrap}><table data-rg-table="standard"><thead><tr><th>#</th><th>Request</th><th>Action</th><th>Moved To</th><th>Actor</th><th>Date & Time</th><th>Actions</th></tr></thead><tbody>{recentMovement.length ? recentMovement.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td className={styles.ref}>{item.request?.request_no || item.request_id}</td><td>{item.action_type || "Workflow action"}</td><td><span className={styles.badge} style={statusTone(item.to_stage || "Pending")}>{item.to_stage || "—"}</span></td><td>{item.actor_name || "System"}<small>{item.actor_role_name || ""}</small></td><td>{dateText(item.created_at)}</td><td><div className={styles.rowActions}><button title="View request" onClick={() => router.push(`/requests/${item.request_id}`)}><Eye size={15}/></button><details className={styles.moreMenu}><summary title="More actions"><MoreVertical size={15}/></summary><div><button onClick={() => router.push(`/requests/${item.request_id}`)}>Open Request</button><button onClick={() => setChartDetail(`${item.request?.request_no || item.request_id}: ${item.action_type || "Workflow action"} → ${item.to_stage || "—"} by ${item.actor_name || "System"}.`)}>Movement Details</button></div></details></div></td></tr>) : <tr><td colSpan={7}><div className={styles.empty}>No request workflow history is visible to this role yet.</div></td></tr>}</tbody></table></div></section>
    </>}

    {view !== "overview" && <>
      <section className={styles.card}><div className={styles.filters}>
        <label className={styles.field}><span className={styles.label}>Search</span><div className={styles.searchField}><Search size={15}/><input className={styles.input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Reference no., subject, sender/recipient..."/></div></label>
        <label className={styles.field}><span className={styles.label}>Direction</span><select className={styles.select} value={direction} onChange={(e) => setDirection(e.target.value)}><option value="all">All Directions</option><option value="incoming">Incoming</option><option value="outgoing">Outgoing</option></select></label>
        <label className={styles.field}><span className={styles.label}>Department</span><select className={styles.select} value={department} onChange={(e) => setDepartment(e.target.value)}><option value="all">All Departments</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label className={styles.field}><span className={styles.label}>Status</span><select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All Statuses</option>{statuses.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className={styles.field}><span className={styles.label}>Priority</span><select className={styles.select} value={priority} onChange={(e) => setPriority(e.target.value)}><option value="all">All Priorities</option>{priorities.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className={styles.field}><span className={styles.label}>Date Range</span><div className={styles.dateGrid}><input type="date" className={styles.input} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}/><input type="date" className={styles.input} value={dateTo} onChange={(e) => setDateTo(e.target.value)}/></div></label>
      </div></section>
      <section className={styles.tableCard}><div className={styles.tableHeader}><div><h2 className={styles.cardTitle}>{VIEWS.find((v) => v.key === view)?.label}</h2><p className={styles.cardNote}>{filtered.length.toLocaleString()} matching record(s)</p></div><span className={styles.badge} style={{ background: "var(--color-brand-50)", color: "var(--color-brand-700)" }}>{loading ? "Loading..." : `${filtered.length} records`}</span></div><div className={styles.tableWrap}>{paged.length ? <table data-rg-table="standard"><thead><tr><th>Ref. No.</th><th>Date</th><th>Direction</th><th>Subject</th><th>From / To</th><th>Department</th><th>Priority</th><th>Status</th><th>Last Action</th></tr></thead><tbody>{paged.map((r) => <tr key={r.id}><td className={styles.ref}>{r.referenceNo}</td><td>{dateText(r.createdAt)}</td><td><span className={styles.badge} style={{ background: r.direction.toLowerCase() === "incoming" ? "var(--color-brand-50)" : "var(--color-success-50)", color: r.direction.toLowerCase() === "incoming" ? "var(--color-brand-700)" : "var(--color-success-700)" }}>{r.direction}</span></td><td>{r.subject}</td><td>{r.party}</td><td>{r.department}</td><td><span className={styles.badge} style={priorityTone(r.priority)}>{r.priority}</span></td><td><span className={styles.badge} style={statusTone(r.status)}>{r.status}</span></td><td>{dateText(r.updatedAt)}</td></tr>)}</tbody></table> : <div className={styles.empty}>{loading ? "Loading Registry records..." : "No correspondence matches this view."}</div>}</div><div className={styles.pager}><span>Showing {paged.length ? ((safePage - 1) * pageSize + 1) : 0}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length}</span><div className={styles.pageButtons}>{Array.from({ length: Math.min(pageCount, 7) }, (_, i) => i + 1).map((p) => <button key={p} onClick={() => setPage(p)} className={`${styles.pageButton} ${p === safePage ? styles.pageButtonActive : ""}`}>{p}</button>)}</div></div></section>
    </>}
  </div></main>;
}
