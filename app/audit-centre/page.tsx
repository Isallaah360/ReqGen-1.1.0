"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  FileSearch,
  Filter,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { REQGEN_PRODUCT_LABEL } from "@/lib/version";
import styles from "./approved-mockup.module.css";

type Severity = "info" | "success" | "warning" | "critical";
type AuditEvent = {
  id: string;
  module: string;
  action: string;
  actorId: string;
  actor: string;
  activeRole: string;
  record: string;
  createdAt: string;
  details: string;
  severity: Severity;
  sourceTable: string;
};
type SourceDefinition = { module: string; tables: string[]; createdFields: string[] };
type ProfileLite = { id: string; full_name: string | null; email: string | null };
type SourceHealth = { module: string; table: string; available: boolean; rows: number; message: string };
type IntegrityCheck = { name: string; module: string; status: "Passed" | "Warning" | "Failed"; detail: string };

type Tab = "overview" | "logs" | "users" | "integrity" | "workflow" | "reports";

const SOURCE_DEFINITIONS: SourceDefinition[] = [
  { module: "Enterprise", tables: ["enterprise_audit_events", "audit_logs"], createdFields: ["created_at", "event_at"] },
  { module: "Requests", tables: ["request_history"], createdFields: ["created_at"] },
  { module: "Approvals", tables: ["request_attachment_checks"], createdFields: ["created_at", "checked_at"] },
  { module: "Finance", tables: ["finance_activity_history", "finance_transactions", "iet_account_transactions"], createdFields: ["created_at", "posted_at", "transaction_date"] },
  { module: "Payment Vouchers", tables: ["manual_payment_voucher_audit", "payment_voucher_history"], createdFields: ["created_at"] },
  { module: "HR", tables: ["hr_assignment_history", "hr_request_reviews", "hr_seminar_attendance_corrections"], createdFields: ["created_at", "reviewed_at", "decided_at"] },
  { module: "Roles", tables: ["user_role_switch_history"], createdFields: ["switched_at", "created_at"] },
  { module: "Registry", tables: ["registry_file_movements", "registry_correspondence"], createdFields: ["created_at", "movement_date"] },
  { module: "Security", tables: ["notifications"], createdFields: ["created_at"] },
];

const PAGE_SIZES = [10, 25, 50];
const AUDIT_CENTRE_NOW = Date.now();

function text(value: unknown) { return value == null ? "" : String(value).trim(); }
function rows(value: unknown): Record<string, unknown>[] { return Array.isArray(value) ? value.filter(Boolean) as Record<string, unknown>[] : []; }
function n(value: unknown) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
function normalizeRole(value: unknown) { return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9:]+/g, ""); }
function parseActiveRole(value: unknown): string {
  if (typeof value === "string") return normalizeRole(value);
  if (Array.isArray(value)) return parseActiveRole(value[0]);
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return normalizeRole(row.active_role_key ?? row.role_key ?? row.role ?? row.get_my_active_role ?? row.reqgen_current_active_role);
  }
  return "";
}
function firstText(row: Record<string, unknown>, fields: string[], fallback = "") {
  for (const field of fields) { const value = text(row[field]); if (value) return value; }
  return fallback;
}
function eventSeverity(action: string): Severity {
  const key = action.toLowerCase();
  if (/(delete|reject|revoke|disable|suspend|failed|denied|unauthor|missing|reverse)/.test(key)) return "critical";
  if (/(return|late|overdue|warning|correction|change|update)/.test(key)) return "warning";
  if (/(approve|complete|create|assign|activate|verify|paid|success)/.test(key)) return "success";
  return "info";
}
function dateText(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

export default function AuditCentrePage() {
  const router = useRouter();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [sourceHealth, setSourceHealth] = useState<SourceHealth[]>([]);
  const [integrityChecks, setIntegrityChecks] = useState<IntegrityCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("ALL");
  const [period, setPeriod] = useState("30");
  const [severity, setSeverity] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  const verifyAccess = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace("/login"); return false; }
    const { data: activeRoleData } = await supabase.rpc("get_my_active_role");
    let role = parseActiveRole(activeRoleData);
    if (!role) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
      role = normalizeRole(profile?.role);
    }
    if (!["admin", "auditor"].includes(role)) { router.replace("/unauthorized?from=/audit-centre"); return false; }
    setAuthorized(true);
    return true;
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!(await verifyAccess())) return;
      const collected: AuditEvent[] = [];
      const actorIds = new Set<string>();
      const health: SourceHealth[] = [];

      for (const definition of SOURCE_DEFINITIONS) {
        let loaded = false;
        for (const table of definition.tables) {
          const result = await supabase.from(table).select("*").limit(500);
          if (result.error) {
            health.push({ module: definition.module, table, available: false, rows: 0, message: result.error.message });
            continue;
          }
          const resultRows = rows(result.data);
          health.push({ module: definition.module, table, available: true, rows: resultRows.length, message: "Live source connected" });
          loaded = true;
          resultRows.forEach((row, index) => {
            const action = firstText(row, ["action", "event_type", "decision", "activity_type", "transaction_type", "status", "title"], "Activity");
            const actorId = firstText(row, ["actor_id", "user_id", "performed_by", "changed_by", "created_by", "reviewed_by", "assigned_by", "posted_by"]);
            if (actorId) actorIds.add(actorId);
            const detailsValue = row.details;
            const details = typeof detailsValue === "object" && detailsValue !== null
              ? JSON.stringify(detailsValue)
              : firstText(row, ["details", "comment", "description", "message", "narration", "reason", "remarks"]);
            collected.push({
              id: firstText(row, ["id"], `${table}-${index}`), module: definition.module, action, actorId,
              actor: firstText(row, ["actor_name", "user_name", "performed_by_name", "created_by_name", "officer_name", "requester_name"], actorId || "System"),
              activeRole: firstText(row, ["active_role_name", "active_role_key", "role_name", "role_key"], "—"),
              record: firstText(row, ["reference_no", "request_no", "voucher_no", "transaction_no", "entity_id", "request_id", "record_id"], "—"),
              createdAt: firstText(row, definition.createdFields, new Date(0).toISOString()), details, severity: eventSeverity(action), sourceTable: table,
            });
          });
          break;
        }
        if (!loaded) health.push({ module: definition.module, table: definition.tables.join(" / "), available: false, rows: 0, message: "No readable configured source" });
      }

      if (actorIds.size) {
        const { data: profileRows } = await supabase.from("profiles").select("id,full_name,email").in("id", [...actorIds].slice(0, 500));
        const map: Record<string, ProfileLite> = {};
        rows(profileRows).forEach((row) => { const id = text(row.id); if (id) map[id] = { id, full_name: text(row.full_name) || null, email: text(row.email) || null }; });
        collected.forEach((event) => {
          const profile = map[event.actorId];
          if (profile && (event.actor === event.actorId || event.actor === "System")) event.actor = profile.full_name || profile.email || event.actorId;
        });
      }
      collected.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Reconstruct missing historical role labels from the nearest recorded role-switch
      // event for the same actor. This avoids blank USER / ROLE cells where the audit
      // source recorded the actor but not the role on the business event itself.
      const roleEventsByActor = new Map<string, AuditEvent[]>();
      collected.filter((event) => event.module === "Roles" && event.actorId && event.activeRole !== "—").forEach((event) => {
        const list = roleEventsByActor.get(event.actorId) || [];
        list.push(event);
        roleEventsByActor.set(event.actorId, list);
      });
      roleEventsByActor.forEach((list) => list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      collected.forEach((event) => {
        if (event.activeRole !== "—" || !event.actorId) return;
        const eventTime = new Date(event.createdAt).getTime();
        const historicalRole = (roleEventsByActor.get(event.actorId) || []).find((candidate) => new Date(candidate.createdAt).getTime() <= eventTime);
        if (historicalRole) event.activeRole = historicalRole.activeRole;
      });

      const [deptRes, subheadRes, accountRes] = await Promise.all([
        supabase.from("departments").select("id,name,is_active"),
        supabase.from("subheads").select("id,code,name,dept_id,approved_allocation,reserved_amount,expenditure,balance,is_active"),
        supabase.from("iet_accounts").select("id,name,available_balance,is_active"),
      ]);
      const checks: IntegrityCheck[] = [];
      checks.push({ name: "Department register", module: "Admin", status: deptRes.error ? "Failed" : "Passed", detail: deptRes.error?.message || `${rows(deptRes.data).length} departments readable` });
      if (subheadRes.error) checks.push({ name: "Budget/subhead register", module: "Finance", status: "Failed", detail: subheadRes.error.message });
      else {
        const subheadRows = rows(subheadRes.data);
        const mismatches = subheadRows.filter((r) => Math.abs((n(r.approved_allocation) - n(r.reserved_amount) - n(r.expenditure)) - n(r.balance)) > 0.01).length;
        checks.push({ name: "Canonical subhead balance", module: "Finance", status: mismatches ? "Warning" : "Passed", detail: mismatches ? `${mismatches} stored balance values differ from the canonical calculated balance` : `${subheadRows.length} subheads reconcile to the canonical rule` });
      }
      checks.push({ name: "IET account register", module: "Finance", status: accountRes.error ? "Failed" : "Passed", detail: accountRes.error?.message || `${rows(accountRes.data).length} IET accounts readable` });
      const unavailable = health.filter((item) => !item.available).length;
      checks.push({ name: "Audit source coverage", module: "Audit", status: unavailable ? "Warning" : "Passed", detail: unavailable ? `${unavailable} configured source checks are unavailable; see Source Health` : "All configured audit source checks are available" });

      setEvents(collected);
      setSourceHealth(health);
      setIntegrityChecks(checks);
    } finally { setLoading(false); }
  }, [verifyAccess]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => void load(), 600); };
    const channel = supabase.channel("enterprise-audit-centre-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "enterprise_audit_events" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "request_history" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_role_switch_history" }, refresh)
      .subscribe();
    return () => { if (timer) clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [load]);

  const filtered = useMemo(() => {
    const days = Number(period);
    const cutoff = days > 0 ? AUDIT_CENTRE_NOW - days * 86400000 : 0;
    const needle = query.trim().toLowerCase();
    return events.filter((event) => {
      if (source !== "ALL" && event.module !== source) return false;
      if (severity !== "ALL" && event.severity !== severity) return false;
      if (cutoff && new Date(event.createdAt).getTime() < cutoff) return false;
      if (!needle) return true;
      return [event.module, event.action, event.actor, event.activeRole, event.record, event.details, event.sourceTable].some((value) => value.toLowerCase().includes(needle));
    });
  }, [events, period, query, severity, source]);

  const moduleCounts = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((event) => map.set(event.module, (map.get(event.module) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);
  const userCounts = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((event) => map.set(event.actor || "System", (map.get(event.actor || "System") || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);
  const daily = useMemo(() => {
    const result: { label: string; count: number }[] = [];
    const map = new Map<string, number>();
    filtered.forEach((event) => {
      const d = new Date(event.createdAt); if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; map.set(key, (map.get(key) || 0) + 1);
    });
    for (let offset = 13; offset >= 0; offset--) {
      const d = new Date(AUDIT_CENTRE_NOW); d.setHours(0,0,0,0); d.setDate(d.getDate() - offset);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      result.push({ label: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), count: map.get(key) || 0 });
    }
    return result;
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const critical = filtered.filter((e) => e.severity === "critical").length;
  const uniqueUsers = new Set(filtered.map((e) => e.actorId || e.actor)).size;
  const availableSources = sourceHealth.filter((s) => s.available).length;
  const maxModule = Math.max(1, ...moduleCounts.map(([, count]) => count));
  const maxDaily = Math.max(1, ...daily.map((d) => d.count));

  function exportCsv() {
    const header = ["Date & Time", "User", "Active Role", "Module", "Action", "Record", "Risk", "Details", "Source"];
    const body = filtered.map((e) => [dateText(e.createdAt), e.actor, e.activeRole, e.module, e.action, e.record, e.severity, e.details, e.sourceTable].map(csvCell).join(","));
    const blob = new Blob([[`Generated from ${REQGEN_PRODUCT_LABEL}`, header.map(csvCell).join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `ReqGen_Audit_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  if (!authorized && loading) return <main className={styles.page}><div className={styles.loading}>Verifying Audit Centre authority…</div></main>;

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div><h1>Audit Centre</h1><p>Monitor, trace and review system activity, workflow evidence, data integrity and source health.</p></div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => window.print()}><Printer size={15}/>Print</button>
          <button type="button" className={styles.secondaryButton} onClick={exportCsv}><Download size={15}/>Export</button>
          <button type="button" className={styles.primaryButton} onClick={() => void load()} disabled={loading}><RefreshCw size={15}/>{loading ? "Refreshing…" : "Refresh Live Data"}</button>
        </div>
      </section>

      <nav className={styles.tabs} aria-label="Audit Centre workspaces">
        {([
          ["overview","Overview",BarChart3],["logs","Audit Logs",FileSearch],["users","User Activity",Users],
          ["integrity","Data Integrity",ShieldCheck],["workflow","Workflow Trace",Activity],["reports","Compliance Reports",CheckCircle2],
        ] as [Tab,string,typeof Activity][]).map(([key,label,Icon]) => (
          <button key={key} type="button" className={tab === key ? styles.activeTab : ""} onClick={() => setTab(key)}><Icon size={15}/>{label}</button>
        ))}
      </nav>

      <section className={styles.filters}>
        <label className={styles.search}><Search size={15}/><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search user, action, record, details or source…"/></label>
        <label><Filter size={14}/><select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}><option value="ALL">All Modules</option>{[...new Set(events.map((e) => e.module))].sort().map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
        <label><select value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }}><option value="ALL">All Risk Levels</option><option value="info">Information</option><option value="success">Successful</option><option value="warning">Attention</option><option value="critical">Critical</option></select></label>
        <label><select value={period} onChange={(e) => { setPeriod(e.target.value); setPage(1); }}><option value="7">Last 7 Days</option><option value="30">Last 30 Days</option><option value="90">Last 90 Days</option><option value="365">Last Year</option><option value="0">All Time</option></select></label>
      </section>

      {tab === "overview" && <>
        <section className={styles.kpis}>
          <Kpi label="Total Activities" value={filtered.length} note="Filtered live evidence" icon={<Activity/>}/>
          <Kpi label="Users Seen" value={uniqueUsers} note="Distinct actors" icon={<Users/>}/>
          <Kpi label="Critical Events" value={critical} note="High-risk actions" icon={<AlertTriangle/>} tone="rose"/>
          <Kpi label="Live Sources" value={`${availableSources}/${sourceHealth.length}`} note="Readable configured sources" icon={<ShieldCheck/>} tone="green"/>
        </section>
        <section className={styles.grid2}>
          <Card title="Activities by Module" note="Hover each bar for the exact live count.">
            <div className={styles.moduleChart}>{moduleCounts.length ? moduleCounts.map(([module,count]) => <button type="button" key={module} className={styles.moduleBar} title={`${module}: ${count} activities`} onClick={() => { setSource(module); setTab("logs"); }}><span>{module}</span><i><b style={{width:`${(count/maxModule)*100}%`}}/></i><strong>{count}</strong></button>) : <Empty text="No audit activity matches the current filters."/>}</div>
          </Card>
          <Card title="Daily Activity Trend" note="Live activity count across the latest 14 days.">
            <div className={styles.dailyChart}>{daily.map((point) => <div key={point.label} className={styles.dailyCol} title={`${point.label}: ${point.count} activities`}><span>{point.count || ""}</span><i style={{height:`${Math.max(point.count ? 7 : 2,(point.count/maxDaily)*100)}%`}}/><small>{point.label}</small></div>)}</div>
          </Card>
        </section>
        <Card title="Recent Audit Activities" note="Newest live evidence. Open details without leaving the Audit Centre.">
          <AuditTable events={filtered.slice(0,5)} onSelect={setSelectedEvent}/>
          {filtered.length > 5 ? <div className={styles.cardFooter}><button type="button" onClick={() => setTab("logs")}>View All Activities</button></div> : null}
        </Card>
      </>}

      {tab === "logs" && <Card title="Audit Logs" note={`${filtered.length} matching live records`}><AuditTable events={pageRows} onSelect={setSelectedEvent}/><Pager page={page} totalPages={totalPages} pageSize={pageSize} count={filtered.length} setPage={setPage} setPageSize={(value) => { setPageSize(value); setPage(1); }}/></Card>}

      {tab === "users" && <section className={styles.grid2}>
        <Card title="Top Users by Activity" note="Derived from the same filtered audit dataset."><div className={styles.userBars}>{userCounts.slice(0,10).map(([name,count]) => <button type="button" key={name} title={`${name}: ${count} activities`} onClick={() => { setQuery(name); setTab("logs"); }}><span>{name}</span><i><b style={{width:`${(count/Math.max(1,userCounts[0]?.[1] || 1))*100}%`}}/></i><strong>{count}</strong></button>)}</div></Card>
        <Card title="User Activity Summary" note="Interactive actor register"><div className={styles.tableWrap}><table><thead><tr><th>#</th><th>User</th><th>Activities</th><th>Latest Activity</th><th>Action</th></tr></thead><tbody>{userCounts.slice(0,25).map(([name,count],i) => { const latest=filtered.find((e)=>e.actor===name); return <tr key={name}><td>{i+1}</td><td><strong>{name}</strong></td><td>{count}</td><td>{latest?dateText(latest.createdAt):"—"}</td><td><button className={styles.tableAction} onClick={()=>{setQuery(name);setTab("logs")}}>View</button></td></tr>})}</tbody></table></div></Card>
      </section>}

      {tab === "integrity" && <Card title="Data Integrity Checks" note="Live checks only; ReqGen does not fabricate passing results."><div className={styles.tableWrap}><table><thead><tr><th>#</th><th>Check</th><th>Module</th><th>Status</th><th>Details</th></tr></thead><tbody>{integrityChecks.map((check,i)=><tr key={check.name}><td>{i+1}</td><td><strong>{check.name}</strong></td><td>{check.module}</td><td><Status value={check.status}/></td><td>{check.detail}</td></tr>)}</tbody></table></div></Card>}

      {tab === "workflow" && <Card title="Workflow Trace" note="Request and approval history retained after removal of the standalone Workflow UI."><AuditTable events={filtered.filter((e)=>e.module==="Requests"||e.module==="Approvals").slice(0,100)} onSelect={setSelectedEvent}/></Card>}

      {tab === "reports" && <section className={styles.grid2}>
        <Card title="Compliance Report Generator" note="Generate traceable output from the currently filtered live audit dataset."><div className={styles.reportPanel}><div><strong>Current dataset</strong><span>{filtered.length} activities · {uniqueUsers} actors · {critical} critical events</span></div><button className={styles.primaryButton} onClick={exportCsv}><Download size={15}/>Export CSV</button><button className={styles.secondaryButton} onClick={()=>window.print()}><Printer size={15}/>Print / Save PDF</button></div></Card>
        <Card title="Source Health" note="Audit-source availability by configured module."><div className={styles.sourceList}>{sourceHealth.map((item,i)=><div key={`${item.module}-${item.table}-${i}`}><span><strong>{item.module}</strong><small>{item.table}</small></span><Status value={item.available?"Passed":"Warning"}/><b>{item.available?`${item.rows} rows`:"Unavailable"}</b></div>)}</div></Card>
      </section>}

      {selectedEvent ? <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setSelectedEvent(null)}><section className={styles.modal} role="dialog" aria-modal="true" aria-label="Audit event details" onMouseDown={(e)=>e.stopPropagation()}><header><div><span>Audit Evidence</span><h2>{selectedEvent.action}</h2></div><button onClick={()=>setSelectedEvent(null)} aria-label="Close">×</button></header><dl><dt>Date & Time</dt><dd>{dateText(selectedEvent.createdAt)}</dd><dt>User</dt><dd>{selectedEvent.actor}</dd><dt>Active Role</dt><dd>{selectedEvent.activeRole}</dd><dt>Module / Source</dt><dd>{selectedEvent.module} · {selectedEvent.sourceTable}</dd><dt>Record</dt><dd>{selectedEvent.record}</dd><dt>Risk</dt><dd><span className={`${styles.badge} ${styles[selectedEvent.severity]}`}>{selectedEvent.severity}</span></dd><dt>Details</dt><dd>{selectedEvent.details || "No additional details were recorded."}</dd></dl><footer>Generated from {REQGEN_PRODUCT_LABEL}</footer></section></div> : null}
    </main>
  );
}

function Kpi({label,value,note,icon,tone="blue"}:{label:string;value:string|number;note:string;icon:React.ReactNode;tone?:"blue"|"green"|"rose"}) { return <article className={`${styles.kpi} ${styles[tone]}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>; }
function Card({title,note,children}:{title:string;note:string;children:React.ReactNode}) { return <article className={styles.card}><header><div><h2>{title}</h2><p>{note}</p></div></header>{children}</article>; }
function Empty({text:textValue}:{text:string}) { return <div className={styles.empty}>{textValue}</div>; }
function Status({value}:{value:"Passed"|"Warning"|"Failed"}) { return <span className={`${styles.status} ${value==="Passed"?styles.passed:value==="Warning"?styles.warning:styles.failed}`}>{value}</span>; }
function AuditTable({events,onSelect}:{events:AuditEvent[];onSelect:(event:AuditEvent)=>void}) { return <div className={styles.tableWrap}><table><thead><tr><th>#</th><th>Date & Time</th><th>User / Role</th><th>Module</th><th>Action</th><th>Record</th><th>Risk</th><th>Details</th></tr></thead><tbody>{events.map((event,i)=><tr key={`${event.module}-${event.id}-${event.createdAt}`} onDoubleClick={()=>onSelect(event)}><td>{i+1}</td><td>{dateText(event.createdAt)}</td><td><strong>{event.actor}</strong><small>{event.activeRole}</small></td><td>{event.module}</td><td>{event.action}</td><td>{event.record}</td><td><span className={`${styles.badge} ${styles[event.severity]}`}>{event.severity}</span></td><td><button className={styles.tableAction} onClick={()=>onSelect(event)}>View</button></td></tr>)}{!events.length?<tr><td colSpan={8}><Empty text="No matching audit evidence is available."/></td></tr>:null}</tbody></table></div>; }
function Pager({page,totalPages,pageSize,count,setPage,setPageSize}:{page:number;totalPages:number;pageSize:number;count:number;setPage:(v:number)=>void;setPageSize:(v:number)=>void}) { const pages=Array.from({length:Math.min(5,totalPages)},(_,i)=>Math.min(totalPages,Math.max(1,page-2)+i)).filter((v,i,a)=>a.indexOf(v)===i); return <div className={styles.pager}><span>Showing {count?((page-1)*pageSize)+1:0}–{Math.min(page*pageSize,count)} of {count}</span><div><button disabled={page<=1} onClick={()=>setPage(page-1)}>‹</button>{pages.map(p=><button key={p} className={p===page?styles.currentPage:""} onClick={()=>setPage(p)}>{p}</button>)}<button disabled={page>=totalPages} onClick={()=>setPage(page+1)}>›</button><select value={pageSize} onChange={(e)=>setPageSize(Number(e.target.value))}>{PAGE_SIZES.map(size=><option key={size} value={size}>{size} / page</option>)}</select></div></div>; }
