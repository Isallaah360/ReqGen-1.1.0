"use client";

import { useMemo, useState } from "react";
import { RefreshCw, Search, AlertTriangle, CheckCircle2, Clock3, Activity, Building2, Banknote, Users, Archive, ShieldCheck, BarChart3, CalendarDays, Bell, FileText, BriefcaseBusiness, ClipboardList } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { dateText, numberValue, text, type GenericRow } from "@/app/components/enterprise/data";
import { useExecutiveData } from "./useExecutiveData";
import { ExecutiveActionButton, ExecutiveActionLink, ExecutiveBadge, ExecutiveEmpty, ExecutiveHero, ExecutiveLoading, ExecutivePanel, ExecutiveShell, ExecutiveStatCard, type ExecutiveTone } from "./ExecutiveUI";

export type ExecutiveModule = "overview" | "requests" | "finance" | "hr" | "registry" | "audit" | "analytics" | "calendar" | "meetings" | "notifications" | "reports";

type Row = GenericRow;

type ModuleMeta = {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

const META: Record<ExecutiveModule, ModuleMeta> = {
  overview: { eyebrow: "Executive Command", title: "Enterprise Command Centre", description: "A secure executive view of requests, Finance, HR, Registry, audit evidence, alerts and institutional performance.", icon: Building2 },
  requests: { eyebrow: "Workflow Intelligence", title: "Executive Requests Intelligence", description: "Monitor request volume, approval queues, workflow stages, bottlenecks and recent institutional submissions.", icon: ClipboardList },
  finance: { eyebrow: "Authorized Financial Intelligence", title: "Executive Finance Intelligence", description: "Review Finance workload and values permitted by your active role and existing Supabase security policies.", icon: Banknote },
  hr: { eyebrow: "Workforce Intelligence", title: "Executive HR Intelligence", description: "Monitor HR workload, leave activity, seminar participation, capacity records and departmental KPIs.", icon: Users },
  registry: { eyebrow: "Records Intelligence", title: "Executive Registry Intelligence", description: "Track correspondence, open records, archival activity and file movement across the institution.", icon: Archive },
  audit: { eyebrow: "Assurance and Risk", title: "Executive Audit Intelligence", description: "Review who did what, under which active role, when it happened and the risk signals requiring oversight.", icon: ShieldCheck },
  analytics: { eyebrow: "Institutional Performance", title: "Enterprise Analytics", description: "Compare completion, workload, attendance and data-source coverage across major ReqGen modules.", icon: BarChart3 },
  calendar: { eyebrow: "Institutional Schedule", title: "Executive Calendar", description: "View leave, seminars, workflow deadlines and available institutional events in one executive schedule.", icon: CalendarDays },
  meetings: { eyebrow: "Governance Activities", title: "Executive Meetings Centre", description: "Monitor seminar sessions, governance activities and action follow-up information available in ReqGen.", icon: BriefcaseBusiness },
  notifications: { eyebrow: "Priority Communications", title: "Executive Notification Centre", description: "Review unread updates, priority workflow alerts and system notifications addressed to your account.", icon: Bell },
  reports: { eyebrow: "Executive Reporting", title: "Executive Management Report", description: "Generate a structured institutional summary for printing or saving as PDF.", icon: FileText },
};

function statusTone(status: unknown): ExecutiveTone {
  const value = text(status).toLowerCase();
  if (/paid|completed|approved|present|active|closed|filed/.test(value)) return "emerald";
  if (/rejected|failed|overdue|missing|critical|cancelled/.test(value)) return "rose";
  if (/pending|review|submitted|processing|late|open/.test(value)) return "amber";
  if (/archive|security|audit/.test(value)) return "violet";
  return "blue";
}

function currency(value: unknown) {
  return `₦${Math.round(numberValue(value)).toLocaleString("en-NG")}`;
}

function rowTitle(row: Row) {
  return text(row.title || row.subject || row.request_no || row.voucher_no || row.reference || row.name, "Untitled record");
}

function recordDate(row: Row) {
  return dateText(row.created_at || row.updated_at || row.session_date || row.start_date || row.due_at || row.occurred_at);
}

function RecordList({ rows, emptyTitle, emptyDescription, limit = 40 }: { rows: Row[]; emptyTitle: string; emptyDescription: string; limit?: number }) {
  if (!rows.length) return <ExecutiveEmpty title={emptyTitle} description={emptyDescription} />;
  return (
    <div className="space-y-3">
      {rows.slice(0, limit).map((row, index) => (
        <article key={text(row.id, `record-${index}`)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <ExecutiveBadge tone={statusTone(row.status || row.current_stage)}>{text(row.status || row.current_stage, "Recorded")}</ExecutiveBadge>
                {row.request_type ? <ExecutiveBadge tone="violet">{text(row.request_type)}</ExecutiveBadge> : null}
              </div>
              <h3 className="mt-3 break-words text-base font-black text-slate-950">{rowTitle(row)}</h3>
              <p className="mt-2 break-words text-sm font-semibold leading-6 text-slate-600">{text(row.description || row.details || row.message || row.notes || row.current_stage, "No additional details supplied.")}</p>
            </div>
            <div className="shrink-0 text-left sm:text-right">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Recorded</p>
              <p className="mt-1 text-sm font-bold text-slate-700">{recordDate(row)}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function ExecutiveModulePage({ module }: { module: ExecutiveModule }) {
  const meta = META[module];
  const Icon = meta.icon;
  const { data, loading, warning, coverage, activeRole, metrics, refresh } = useExecutiveData();
  const [query, setQuery] = useState("");

  const filteredRequests = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = data.requests ?? [];
    if (!q) return rows;
    return rows.filter((row) => `${rowTitle(row)} ${text(row.status)} ${text(row.current_stage)} ${text(row.request_type)}`.toLowerCase().includes(q));
  }, [data.requests, query]);

  return (
    <ExecutiveShell>
      <div className="mx-auto max-w-[1500px] space-y-6">
        <ExecutiveHero
          eyebrow={meta.eyebrow}
          title={meta.title}
          description={meta.description}
          actions={
            <>
              <ExecutiveActionButton onClick={() => void refresh()} tone="cyan" disabled={loading}><RefreshCw className="h-4 w-4" />{loading ? "Refreshing…" : "Refresh"}</ExecutiveActionButton>
              <ExecutiveActionLink href="/staff" tone="slate">Staff Workspace</ExecutiveActionLink>
            </>
          }
        />

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <ExecutiveBadge tone="blue">Active Role: {activeRole}</ExecutiveBadge>
          <ExecutiveBadge tone={coverage >= 75 ? "emerald" : coverage >= 45 ? "amber" : "rose"}>Data Coverage: {coverage}%</ExecutiveBadge>
          <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-500"><Icon className="h-4 w-4 text-blue-700" />Secured executive workspace</span>
        </div>

        {warning ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{warning}</div> : null}
        {loading ? <ExecutiveLoading /> : <ModuleContent module={module} data={data} metrics={metrics} coverage={coverage} query={query} setQuery={setQuery} filteredRequests={filteredRequests} />}
      </div>
    </ExecutiveShell>
  );
}

function ModuleContent({ module, data, metrics, coverage, query, setQuery, filteredRequests }: { module: ExecutiveModule; data: Record<string, Row[]>; metrics: ReturnType<typeof useExecutiveData>["metrics"]; coverage: number; query: string; setQuery: (value: string) => void; filteredRequests: Row[] }) {
  switch (module) {
    case "overview": return <Overview data={data} metrics={metrics} coverage={coverage} />;
    case "requests": return <Requests rows={filteredRequests} metrics={metrics} query={query} setQuery={setQuery} />;
    case "finance": return <Finance data={data} metrics={metrics} />;
    case "hr": return <HR data={data} metrics={metrics} />;
    case "registry": return <Registry data={data} metrics={metrics} />;
    case "audit": return <Audit data={data} />;
    case "analytics": return <Analytics metrics={metrics} coverage={coverage} />;
    case "calendar": return <Calendar data={data} />;
    case "meetings": return <Meetings data={data} />;
    case "notifications": return <Notifications rows={data.notifications ?? []} />;
    case "reports": return <Reports metrics={metrics} coverage={coverage} />;
  }
}

function Overview({ data, metrics, coverage }: { data: Record<string, Row[]>; metrics: ReturnType<typeof useExecutiveData>["metrics"]; coverage: number }) {
  const recent = [...(data.requests ?? []).slice(0, 5), ...(data.audit ?? []).slice(0, 5)].sort((a, b) => new Date(text(b.created_at || b.occurred_at, "1970-01-01")).getTime() - new Date(text(a.created_at || a.occurred_at, "1970-01-01")).getTime());
  return <>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <ExecutiveStatCard label="Total Requests" value={metrics.requestTotal} note="Visible institutional requests" icon={ClipboardList} tone="blue" />
      <ExecutiveStatCard label="Pending Decisions" value={metrics.requestPending} note="Requests still in active workflow" icon={Clock3} tone="amber" />
      <ExecutiveStatCard label="HR Open Work" value={metrics.hrOpen} note="Open HR assignments" icon={Users} tone="violet" />
      <ExecutiveStatCard label="Unread Updates" value={metrics.notificationsUnread} note="Notifications requiring attention" icon={Bell} tone="rose" />
      <ExecutiveStatCard label="Finance Pending" value={metrics.financePending} note="Uncompleted vouchers" icon={Banknote} tone="cyan" />
      <ExecutiveStatCard label="Registry Open" value={metrics.registryOpen} note="Active correspondence records" icon={Archive} tone="slate" />
      <ExecutiveStatCard label="Seminar Attendance" value={`${metrics.attendanceRate}%`} note="Available attendance evidence" icon={CheckCircle2} tone="emerald" />
      <ExecutiveStatCard label="Data Coverage" value={`${coverage}%`} note="Connected authorized sources" icon={Activity} tone="blue" />
    </section>
    <section className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
      <ExecutivePanel eyebrow="Live Enterprise Feed" title="Recent Institutional Activity" description="The latest request and audit activity available to your active role."><RecordList rows={recent} emptyTitle="No recent activity" emptyDescription="Recent authorized events will appear here." limit={12} /></ExecutivePanel>
      <ExecutivePanel eyebrow="Directorate Status" title="Operational Health" description="Immediate workload position across major ReqGen directorates.">
        <div className="space-y-3">
          {[
            ["Requests", metrics.requestPending, "Active workflow items", "blue"],
            ["Finance", metrics.financePending, "Pending voucher work", "cyan"],
            ["Human Resources", metrics.hrOpen, "Open assignments", "violet"],
            ["Registry", metrics.registryOpen, "Open records", "slate"],
          ].map(([label, value, note, tone]) => <div key={String(label)} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4"><div><p className="font-black text-slate-950">{label}</p><p className="mt-1 text-xs font-semibold text-slate-500">{note}</p></div><ExecutiveBadge tone={tone as ExecutiveTone}>{String(value)}</ExecutiveBadge></div>)}
        </div>
      </ExecutivePanel>
    </section>
  </>;
}

function Requests({ rows, metrics, query, setQuery }: { rows: Row[]; metrics: ReturnType<typeof useExecutiveData>["metrics"]; query: string; setQuery: (value: string) => void }) {
  const approvedRate = metrics.requestTotal ? Math.round((metrics.requestClosed / metrics.requestTotal) * 100) : 0;
  return <>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <ExecutiveStatCard label="Requests" value={metrics.requestTotal} icon={ClipboardList} tone="blue" />
      <ExecutiveStatCard label="Pending" value={metrics.requestPending} icon={Clock3} tone="amber" />
      <ExecutiveStatCard label="Closed" value={metrics.requestClosed} icon={CheckCircle2} tone="emerald" />
      <ExecutiveStatCard label="Completion Rate" value={`${approvedRate}%`} icon={BarChart3} tone="cyan" />
    </section>
    <ExecutivePanel title="Request Register" eyebrow="Workflow Queue" description="Search and review the executive request register permitted by RLS." action={<div className="relative w-full sm:w-80"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search request, stage or status…" className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></div>}><RecordList rows={rows} emptyTitle="No request found" emptyDescription="No request matches the current search or active-role access." /></ExecutivePanel>
  </>;
}

function Finance({ data, metrics }: { data: Record<string, Row[]>; metrics: ReturnType<typeof useExecutiveData>["metrics"] }) {
  const vouchers = data.vouchers ?? [];
  const transactions = data.transactions ?? [];
  return <>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <ExecutiveStatCard label="Vouchers" value={vouchers.length} icon={FileText} tone="blue" />
      <ExecutiveStatCard label="Pending Vouchers" value={metrics.financePending} icon={Clock3} tone="amber" />
      <ExecutiveStatCard label="Transactions" value={transactions.length} icon={Activity} tone="cyan" />
      <ExecutiveStatCard label="Recorded Value" value={currency(metrics.totalTransactionValue)} icon={Banknote} tone="emerald" />
    </section>
    <section className="grid gap-6 xl:grid-cols-2">
      <ExecutivePanel title="Recent Vouchers" eyebrow="Finance Workload" description="Voucher records available to your active role."><RecordList rows={vouchers} emptyTitle="No voucher records" emptyDescription="No authorized voucher record is currently available." limit={20} /></ExecutivePanel>
      <ExecutivePanel title="Recent Transactions" eyebrow="Financial Activity" description="Transaction records available through Finance RLS."><RecordList rows={transactions} emptyTitle="No transaction records" emptyDescription="No authorized transaction record is currently available." limit={20} /></ExecutivePanel>
    </section>
  </>;
}

function HR({ data, metrics }: { data: Record<string, Row[]>; metrics: ReturnType<typeof useExecutiveData>["metrics"] }) {
  const leave = data.leave ?? [];
  const seminars = data.seminars ?? [];
  const kpis = data.kpis ?? [];
  return <>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <ExecutiveStatCard label="Open HR Work" value={metrics.hrOpen} icon={Users} tone="violet" />
      <ExecutiveStatCard label="Leave Records" value={leave.length} icon={CalendarDays} tone="amber" />
      <ExecutiveStatCard label="Seminar Sessions" value={seminars.length} icon={BriefcaseBusiness} tone="cyan" />
      <ExecutiveStatCard label="Department KPIs" value={kpis.length} icon={BarChart3} tone="emerald" />
    </section>
    <section className="grid gap-6 xl:grid-cols-2">
      <ExecutivePanel title="HR Workload" eyebrow="Assignments" description="Recent HR assignments permitted to the executive role."><RecordList rows={data.hrAssignments ?? []} emptyTitle="No HR assignment" emptyDescription="No authorized HR assignment is currently available." limit={20} /></ExecutivePanel>
      <ExecutivePanel title="Leave and Seminar Signals" eyebrow="Workforce Activity" description="Recent leave and seminar records."><RecordList rows={[...leave.slice(0, 10), ...seminars.slice(0, 10)]} emptyTitle="No workforce activity" emptyDescription="No leave or seminar record is available." limit={20} /></ExecutivePanel>
    </section>
  </>;
}

function Registry({ data, metrics }: { data: Record<string, Row[]>; metrics: ReturnType<typeof useExecutiveData>["metrics"] }) {
  const registry = data.registry ?? [];
  const movements = data.movements ?? [];
  const archived = registry.filter((row) => /archived/i.test(text(row.status))).length;
  return <>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <ExecutiveStatCard label="Correspondence" value={registry.length} icon={Archive} tone="blue" />
      <ExecutiveStatCard label="Open Records" value={metrics.registryOpen} icon={Clock3} tone="amber" />
      <ExecutiveStatCard label="Archived" value={archived} icon={CheckCircle2} tone="violet" />
      <ExecutiveStatCard label="File Movements" value={movements.length} icon={Activity} tone="cyan" />
    </section>
    <section className="grid gap-6 xl:grid-cols-2">
      <ExecutivePanel title="Correspondence Register" eyebrow="Registry Operations" description="Incoming, outgoing and archived correspondence."><RecordList rows={registry} emptyTitle="No correspondence" emptyDescription="No Registry correspondence is available to this active role." limit={25} /></ExecutivePanel>
      <ExecutivePanel title="Recent File Movement" eyebrow="Custody Evidence" description="File movement records visible through Registry security."><RecordList rows={movements} emptyTitle="No file movement" emptyDescription="No authorized movement record is available." limit={25} /></ExecutivePanel>
    </section>
  </>;
}

function Audit({ data }: { data: Record<string, Row[]> }) {
  const rows: Row[] = [
    ...(data.audit ?? []).map((row): Row => ({ ...row, module: text(row.module, "Audit"), action: text(row.action, "Activity recorded"), details: text(row.details || row.description || row.message || row.metadata, "No additional evidence supplied.") })),
    ...(data.roleSwitches ?? []).map((row): Row => ({ ...row, module: "Security", action: text(row.action, `Working role changed to ${text(row.new_role_key || row.active_role_key || row.role_key, "another role")}`), details: text(row.details || row.reason || row.source, "Active-role switch recorded.") })),
  ].sort((a, b) => new Date(text(b.created_at || b.occurred_at, "1970-01-01")).getTime() - new Date(text(a.created_at || a.occurred_at, "1970-01-01")).getTime());
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = rows.filter((row) => text(row.created_at || row.occurred_at).startsWith(today)).length;
  const critical = rows.filter((row) => /delete|revoke|failed|denied|critical|security|role/i.test(`${text(row.action)} ${text(row.details)}`)).length;
  const actors = new Set(rows.map((row) => text(row.actor_name || row.user_name || row.user_id || row.actor_id)).filter(Boolean)).size;
  return <>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <ExecutiveStatCard label="Audit Events" value={rows.length} icon={ShieldCheck} tone="blue" />
      <ExecutiveStatCard label="Recorded Today" value={todayCount} icon={Clock3} tone="cyan" />
      <ExecutiveStatCard label="Risk Signals" value={critical} icon={AlertTriangle} tone="rose" />
      <ExecutiveStatCard label="Distinct Actors" value={actors} icon={Users} tone="violet" />
    </section>
    <ExecutivePanel title="Enterprise Evidence Timeline" eyebrow="Who Did What" description="Consolidated audit and active-role evidence available to the executive role."><RecordList rows={rows} emptyTitle="No audit evidence" emptyDescription="No authorized audit evidence is currently available." limit={60} /></ExecutivePanel>
  </>;
}

function Analytics({ metrics, coverage }: { metrics: ReturnType<typeof useExecutiveData>["metrics"]; coverage: number }) {
  const completion = metrics.requestTotal ? Math.round((metrics.requestClosed / metrics.requestTotal) * 100) : 0;
  const items = [
    ["Request Completion", completion, "emerald"],
    ["Seminar Attendance", metrics.attendanceRate, "cyan"],
    ["Data Coverage", coverage, "blue"],
    ["Pending Load", metrics.requestTotal ? Math.round((metrics.requestPending / metrics.requestTotal) * 100) : 0, "amber"],
  ] as const;
  return <>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{items.map(([label, value, tone]) => <ExecutiveStatCard key={label} label={label} value={`${value}%`} icon={BarChart3} tone={tone} />)}</section>
    <ExecutivePanel title="Institutional Performance Interpretation" eyebrow="Executive Analysis" description="A concise operational interpretation of current ReqGen indicators.">
      <div className="grid gap-4 md:grid-cols-2">
        {items.map(([label, value, tone]) => <article key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-center justify-between"><p className="font-black text-slate-950">{label}</p><ExecutiveBadge tone={tone}>{value}%</ExecutiveBadge></div><div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-blue-700 to-cyan-500" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div></article>)}
      </div>
    </ExecutivePanel>
  </>;
}

function Calendar({ data }: { data: Record<string, Row[]> }) {
  const rows: Row[] = [
    ...(data.leave ?? []).map((row): Row => ({ ...row, title: text(row.leave_type, "Staff Leave"), status: text(row.status, "Leave"), created_at: row.start_date || row.created_at })),
    ...(data.seminars ?? []).map((row): Row => ({ ...row, title: text(row.title, "Wednesday Seminar"), status: text(row.status, "Seminar"), created_at: row.session_date || row.created_at })),
    ...(data.workflowSla ?? []).map((row): Row => ({ ...row, title: text(row.title || row.request_no, "Workflow Deadline"), status: text(row.status, "Deadline"), created_at: row.due_at || row.created_at })),
  ].sort((a, b) => new Date(text(a.created_at, "2099-01-01")).getTime() - new Date(text(b.created_at, "2099-01-01")).getTime());
  const today = new Date().toISOString().slice(0, 10);
  return <>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <ExecutiveStatCard label="Calendar Items" value={rows.length} icon={CalendarDays} tone="blue" />
      <ExecutiveStatCard label="Today" value={rows.filter((row) => text(row.created_at).startsWith(today)).length} icon={Clock3} tone="cyan" />
      <ExecutiveStatCard label="Leave Events" value={(data.leave ?? []).length} icon={Users} tone="amber" />
      <ExecutiveStatCard label="Workflow Deadlines" value={(data.workflowSla ?? []).length} icon={AlertTriangle} tone="rose" />
    </section>
    <ExecutivePanel title="Institutional Schedule" eyebrow="Executive Calendar" description="Leave, seminars and workflow deadlines available in ReqGen."><RecordList rows={rows} emptyTitle="No calendar records" emptyDescription="No authorized calendar record is currently available." limit={60} /></ExecutivePanel>
  </>;
}

function Meetings({ data }: { data: Record<string, Row[]> }) {
  const seminars = data.seminars ?? [];
  const completed = seminars.filter((row) => /completed|held|closed/i.test(text(row.status))).length;
  return <>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <ExecutiveStatCard label="Governance Activities" value={seminars.length} icon={BriefcaseBusiness} tone="blue" />
      <ExecutiveStatCard label="Completed" value={completed} icon={CheckCircle2} tone="emerald" />
      <ExecutiveStatCard label="Upcoming" value={Math.max(0, seminars.length - completed)} icon={CalendarDays} tone="cyan" />
      <ExecutiveStatCard label="Follow-up" value={seminars.filter((row) => /follow|action|pending/i.test(text(row.status || row.notes))).length} icon={AlertTriangle} tone="amber" />
    </section>
    <ExecutivePanel title="Meetings and Seminar Register" eyebrow="Governance Schedule" description="Available governance and Wednesday Seminar sessions."><RecordList rows={seminars} emptyTitle="No governance activity" emptyDescription="No meeting or seminar record is currently available." limit={50} /></ExecutivePanel>
  </>;
}

function Notifications({ rows }: { rows: Row[] }) {
  const unread = rows.filter((row) => !Boolean(row.is_read));
  const today = new Date().toISOString().slice(0, 10);
  return <>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <ExecutiveStatCard label="Notifications" value={rows.length} icon={Bell} tone="blue" />
      <ExecutiveStatCard label="Unread" value={unread.length} icon={AlertTriangle} tone="rose" />
      <ExecutiveStatCard label="Received Today" value={rows.filter((row) => text(row.created_at).startsWith(today)).length} icon={Clock3} tone="cyan" />
      <ExecutiveStatCard label="Read" value={rows.length - unread.length} icon={CheckCircle2} tone="emerald" />
    </section>
    <ExecutivePanel title="Priority Updates" eyebrow="Executive Inbox" description="Notifications and workflow messages addressed to your authenticated account."><RecordList rows={rows} emptyTitle="No notification" emptyDescription="No executive notification is currently available." limit={60} /></ExecutivePanel>
  </>;
}

function Reports({ metrics, coverage }: { metrics: ReturnType<typeof useExecutiveData>["metrics"]; coverage: number }) {
  return <>
    <div className="no-print flex flex-wrap gap-3"><ExecutiveActionButton onClick={() => window.print()} tone="emerald"><FileText className="h-4 w-4" />Print / Save PDF</ExecutiveActionButton></div>
    <section className="executive-print-sheet rounded-[1.75rem] border border-slate-300 bg-white p-6 shadow-sm sm:p-8">
      <div className="border-b-2 border-blue-700 pb-5 text-center"><p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">Islamic Education Trust</p><h2 className="mt-2 text-3xl font-black text-slate-950">Executive Management Report</h2><p className="mt-2 text-sm font-semibold text-slate-500">Generated {new Date().toLocaleString("en-NG", { hour12: true })}</p></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ExecutiveStatCard label="Requests" value={metrics.requestTotal} tone="blue" />
        <ExecutiveStatCard label="Pending" value={metrics.requestPending} tone="amber" />
        <ExecutiveStatCard label="Finance Pending" value={metrics.financePending} tone="cyan" />
        <ExecutiveStatCard label="HR Open Work" value={metrics.hrOpen} tone="violet" />
        <ExecutiveStatCard label="Registry Open" value={metrics.registryOpen} tone="slate" />
        <ExecutiveStatCard label="Attendance" value={`${metrics.attendanceRate}%`} tone="emerald" />
        <ExecutiveStatCard label="Unread Alerts" value={metrics.notificationsUnread} tone="rose" />
        <ExecutiveStatCard label="Data Coverage" value={`${coverage}%`} tone="blue" />
      </div>
      <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5"><h3 className="text-lg font-black text-slate-950">Management Observation</h3><p className="mt-3 text-sm font-semibold leading-7 text-slate-600">ReqGen currently records {metrics.requestTotal} visible requests, with {metrics.requestPending} still active in workflow. Finance shows {metrics.financePending} pending voucher records, HR has {metrics.hrOpen} open assignments, and Registry has {metrics.registryOpen} open records. Data-source coverage for this report is {coverage}% under the current active role.</p></div>
      <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3"><div className="border-t border-slate-500 pt-2 text-center text-xs font-black">Prepared By</div><div className="border-t border-slate-500 pt-2 text-center text-xs font-black">Reviewed By</div><div className="border-t border-slate-500 pt-2 text-center text-xs font-black">Date</div></div>
    </section>
    <style jsx global>{`@media print { .no-print, header, nav { display:none !important; } body { background:white !important; } .executive-print-sheet { box-shadow:none !important; border:0 !important; width:210mm; min-height:297mm; margin:0 auto; } @page { size:A4 portrait; margin:12mm; } }`}</style>
  </>;
}
