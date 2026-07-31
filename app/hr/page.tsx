"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HRAccessGuard, HRNavigation } from "@/app/components/hr";
import { supabase } from "@/lib/supabaseClient";

type HRRequest = {
  id: string;
  request_no: string;
  title: string;
  status: string | null;
  current_stage: string | null;
  created_at: string;
  requester_name: string | null;
  dept_name: string | null;
  personal_category: string | null;
};

type AssignmentRow = { id: string; status: string | null; priority: string | null };
type OfficerAssignment = { id: string; officer_id: string; is_active: boolean };

type ModuleCard = {
  title: string;
  description: string;
  href: string;
  badge: string;
  tone: string;
  icon: string;
};

const modules: ModuleCard[] = [
  { title: "Officer Assignment Centre", description: "Assign multiple HR functions, permission levels and operational scopes to HR Officers.", href: "/hr/assignments", badge: "Authority", tone: "from-violet-600 to-indigo-700", icon: "👥" },
  { title: "My HR Work", description: "View delegated work, returned assignments, active tasks and completed HR submissions.", href: "/hr/my-work", badge: "Work Queue", tone: "from-cyan-500 to-blue-700", icon: "💼" },
  { title: "HR Boss Review", description: "Review officer recommendations, return corrections and finalize the official HR position.", href: "/hr/review", badge: "Review", tone: "from-orange-500 to-rose-700", icon: "✅" },
  { title: "HR Filing Centre", description: "Monitor HR-related request movement, filing readiness and summarized HR workflow records.", href: "/hr/filing", badge: "Live Records", tone: "from-emerald-500 to-teal-700", icon: "🗂️" },
  { title: "Staff Files", description: "Review staff-related workflow records, contract renewals and personnel-file movements.", href: "/hr/staff", badge: "Staff", tone: "from-blue-600 to-indigo-700", icon: "🧑‍💼" },
  { title: "Leave Records", description: "Track leave workflows, HR review, DG decisions and final filing status.", href: "/hr/leave", badge: "Leave", tone: "from-emerald-600 to-green-700", icon: "📅" },
  { title: "HR Archive", description: "Retrieve completed, paid, rejected and closed HR workflow records.", href: "/hr/archive", badge: "Archive", tone: "from-violet-600 to-purple-700", icon: "🗄️" },
  { title: "Registrar Centre", description: "Manage personnel records, file movement, classification and archive operations.", href: "/hr/registrar", badge: "Records", tone: "from-sky-600 to-cyan-700", icon: "📚" },
  { title: "HR Audit Trail", description: "Inspect delegated actions, assignment changes, reviews and accountability history.", href: "/hr/audit", badge: "Compliance", tone: "from-amber-500 to-orange-700", icon: "🛡️" },
];

const planned = [
  ["Wednesday Weekly Seminar", "Attendance, punctuality and staff participation intelligence.", "Seminar"],
  ["Staff Capacity Building", "Training needs, programmes, certification and impact measurement.", "Development"],
  ["Department Capacity Building", "Departmental gaps, interventions and improvement plans.", "Development"],
  ["Department KPI", "Targets, evidence, scoring and departmental performance intelligence.", "Performance"],
  ["Annual Staff 360° Assessment", "Controlled multi-source assessment and staff development analysis.", "Assessment"],
];

function key(value: string | null | undefined) {
  return (value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function stage(value: string | null | undefined) {
  return (value || "").trim().toUpperCase().replace(/[\s_]+/g, "");
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function stageLabel(value: string | null | undefined) {
  const normalized = stage(value);
  if (normalized === "HRFILING") return "HR Filing";
  if (normalized === "ACCOUNT") return "Account Officer";
  return value || "Unassigned";
}

export default function HRBossDashboard() {
  const [requests, setRequests] = useState<HRRequest[]>([]);
  const [requestAssignments, setRequestAssignments] = useState<AssignmentRow[]>([]);
  const [officerAssignments, setOfficerAssignments] = useState<OfficerAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setMessage("");

    const [requestsResult, delegatedResult, officersResult] = await Promise.all([
      supabase.rpc("get_hr_filing_requests"),
      supabase.from("hr_request_assignments").select("id,status,priority"),
      supabase.from("hr_officer_assignments").select("id,officer_id,is_active").eq("is_active", true),
    ]);

    if (requestsResult.error) setMessage(`Some HR request intelligence could not load: ${requestsResult.error.message}`);
    setRequests(((requestsResult.data || []) as HRRequest[]).filter((row) => key(row.personal_category) || key(row.status) || key(row.current_stage)));
    setRequestAssignments((delegatedResult.data || []) as AssignmentRow[]);
    setOfficerAssignments((officersResult.data || []) as OfficerAssignment[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load(false);
    const onFocus = () => void load(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const metrics = useMemo(() => {
    const active = requests.filter((row) => !["COMPLETED", "REJECTED", "CANCELLED", "DELETED"].includes(stage(row.current_stage)) && !["completed", "paid", "closed", "rejected", "cancelled"].some((s) => key(row.status).includes(s)));
    const review = requests.filter((row) => stage(row.current_stage) === "HR").length;
    const filing = requests.filter((row) => stage(row.current_stage) === "HRFILING").length;
    const completed = requests.filter((row) => stage(row.current_stage) === "COMPLETED" || ["complete", "paid", "closed"].some((s) => key(row.status).includes(s))).length;
    const submitted = requestAssignments.filter((row) => key(row.status) === "submitted").length;
    const urgent = requestAssignments.filter((row) => ["urgent", "high"].includes(key(row.priority))).length;
    const activeOfficers = new Set(officerAssignments.map((row) => row.officer_id)).size;
    return { total: requests.length, active: active.length, review, filing, completed, submitted, urgent, activeOfficers };
  }, [officerAssignments, requestAssignments, requests]);

  const stageDistribution = useMemo(() => {
    const count = new Map<string, number>();
    for (const row of requests) {
      const label = stageLabel(row.current_stage);
      count.set(label, (count.get(label) || 0) + 1);
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
  }, [requests]);

  const departmentDistribution = useMemo(() => {
    const count = new Map<string, number>();
    for (const row of requests) {
      const name = row.dept_name || "Unassigned Department";
      count.set(name, (count.get(name) || 0) + 1);
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [requests]);

  const recent = useMemo(() => [...requests].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6), [requests]);
  const maxStage = Math.max(1, ...stageDistribution.map(([, value]) => value));
  const maxDepartment = Math.max(1, ...departmentDistribution.map(([, value]) => value));

  return (
    <HRAccessGuard bossOnly>
      <main className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/40 to-slate-50 px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="relative overflow-hidden rounded-[2.25rem] bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-800 p-7 text-white shadow-2xl md:p-10">
            <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
            <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-cyan-100 backdrop-blur">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,.9)]" />
                  Restricted Directorate Workspace
                </div>
                <h1 className="mt-5 max-w-4xl text-3xl font-black tracking-tight md:text-5xl">HR Directorate Command Centre</h1>
                <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-blue-100 md:text-base">A single, secure command centre for HR requests, officer delegation, review authority, filing intelligence, staff records and future workforce-performance functions.</p>
              </div>
              <div className="grid min-w-[260px] gap-3 rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-xl">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100">Live HR Position</div>
                <div className="flex items-end justify-between"><span className="text-sm font-bold text-blue-100">Active HR workflow</span><span className="text-3xl font-black">{loading ? "—" : metrics.active}</span></div>
                <button onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-cyan-500 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-cyan-400 disabled:opacity-60">{refreshing ? "Refreshing…" : "Refresh HR Intelligence"}</button>
              </div>
            </div>
          </section>

          <HRNavigation />

          {message && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900 shadow-sm">{message}</div>}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric title="HR-related Requests" value={metrics.total} note="Visible HR workflow records" tone="from-blue-600 to-indigo-700" icon="📋" />
            <Metric title="Awaiting HR Review" value={metrics.review} note="Requests currently at HR stage" tone="from-cyan-500 to-blue-700" icon="🔎" />
            <Metric title="Ready for Filing" value={metrics.filing} note="Final filing queue" tone="from-violet-600 to-purple-700" icon="🗂️" />
            <Metric title="Completed / Filed" value={metrics.completed} note="Closed HR workflow records" tone="from-emerald-500 to-teal-700" icon="✅" />
            <Metric title="Awaiting Boss Review" value={metrics.submitted} note="Officer submissions to review" tone="from-orange-500 to-rose-700" icon="📝" />
            <Metric title="Active HR Officers" value={metrics.activeOfficers} note="Officers with active functions" tone="from-sky-500 to-cyan-700" icon="👥" />
            <Metric title="High-priority Work" value={metrics.urgent} note="High and urgent assignments" tone="from-rose-600 to-red-700" icon="⚠️" />
            <Metric title="Active Workload" value={metrics.active} note="Requests still in movement" tone="from-slate-700 to-slate-950" icon="⚙️" />
          </section>

          <section>
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div><p className="text-xs font-black uppercase tracking-[0.22em] text-blue-700">Operational Workspaces</p><h2 className="mt-1 text-2xl font-black text-slate-950">Available HR Functions</h2></div>
              <p className="max-w-xl text-sm font-semibold text-slate-500">Every live HR workspace is accessible from one central dashboard. Planned domains remain clearly separated until their secure workspaces are deployed.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {modules.map((module) => <Module key={module.href} module={module} />)}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
              <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em] text-blue-700">Workflow Intelligence</p><h2 className="mt-1 text-xl font-black text-slate-950">HR Request Movement</h2></div><Link href="/hr/filing" className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-emerald-500">Open Filing Centre</Link></div>
              <div className="mt-6 space-y-4">{stageDistribution.length === 0 ? <p className="text-sm font-semibold text-slate-500">No HR request movement is currently available.</p> : stageDistribution.map(([label, value], index) => <Bar key={label} label={label} value={value} max={maxStage} color={["bg-blue-600", "bg-cyan-500", "bg-violet-600", "bg-emerald-600", "bg-orange-500", "bg-rose-600", "bg-slate-700"][index % 7]} />)}</div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
              <div><p className="text-xs font-black uppercase tracking-[.2em] text-violet-700">Department Intelligence</p><h2 className="mt-1 text-xl font-black text-slate-950">HR Workload by Department</h2></div>
              <div className="mt-6 space-y-4">{departmentDistribution.length === 0 ? <p className="text-sm font-semibold text-slate-500">No department workload is currently available.</p> : departmentDistribution.map(([label, value], index) => <Bar key={label} label={label} value={value} max={maxDepartment} color={["bg-violet-600", "bg-blue-600", "bg-emerald-600", "bg-orange-500", "bg-cyan-500", "bg-rose-600"][index % 6]} />)}</div>
            </article>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white shadow-lg">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-5 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-700">Live HR Queue</p><h2 className="mt-1 text-xl font-black text-slate-950">Recent HR-related Requests</h2><p className="mt-1 text-sm font-semibold text-slate-500">A summarized view of the latest records available from the HR Filing Centre.</p></div><Link href="/hr/filing" className="rounded-xl bg-blue-700 px-5 py-3 text-center text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-blue-600">View All HR Records</Link></div>
            <div className="divide-y divide-slate-100">{recent.length === 0 ? <div className="p-10 text-center text-sm font-bold text-slate-500">No HR-related requests are currently available.</div> : recent.map((row) => <article key={row.id} className="flex flex-col gap-4 p-5 transition hover:bg-slate-50 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{row.request_no}</span><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">{stageLabel(row.current_stage)}</span></div><h3 className="mt-2 truncate text-base font-black text-slate-950">{row.title}</h3><p className="mt-1 text-sm font-semibold text-slate-500">{row.requester_name || "Unknown requester"} · {row.dept_name || "Unassigned department"} · {shortDate(row.created_at)}</p></div><Link href={`/requests/${row.id}`} className="rounded-xl bg-slate-800 px-4 py-3 text-center text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-slate-700">Open Workflow</Link></article>)}</div>
          </section>

          <section>
            <div className="mb-4"><p className="text-xs font-black uppercase tracking-[.22em] text-fuchsia-700">Captured HR Roadmap</p><h2 className="mt-1 text-2xl font-black text-slate-950">Strategic HR Functions</h2></div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{planned.map(([title, description, badge], index) => <article key={title} className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-md"><div className={`absolute inset-x-0 top-0 h-1.5 ${["bg-orange-500", "bg-cyan-500", "bg-indigo-600", "bg-fuchsia-600", "bg-rose-600"][index]}`} /><span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-600">{badge} · Planned</span><h3 className="mt-4 text-lg font-black text-slate-950">{title}</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{description}</p></article>)}</div>
          </section>

          <section className="rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-6 shadow-sm"><h2 className="font-black text-amber-950">Mandatory HR governance chain</h2><p className="mt-2 text-sm font-semibold leading-6 text-amber-900">HR Officer → HR Boss review → DG. Assigned officers process and recommend; the official HR position remains under HR Boss authority unless an Admin-approved governance policy provides otherwise.</p></section>
        </div>
      </main>
    </HRAccessGuard>
  );
}

function Metric({ title, value, note, tone, icon }: { title: string; value: number; note: string; tone: string; icon: string }) {
  return <article className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${tone} p-5 text-white shadow-lg`}><div className="absolute -right-5 -top-5 h-24 w-24 rounded-full bg-white/10"/><div className="relative flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.15em] text-white/80">{title}</p><div className="mt-3 text-4xl font-black">{value}</div><p className="mt-2 text-xs font-bold text-white/75">{note}</p></div><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-2xl ring-1 ring-white/20">{icon}</span></div></article>;
}

function Module({ module }: { module: ModuleCard }) {
  return <article className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-md transition hover:-translate-y-1 hover:shadow-xl"><div className={`absolute inset-x-0 top-0 h-2 bg-gradient-to-r ${module.tone}`} /><div className="flex items-start justify-between gap-4"><span className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${module.tone} text-2xl text-white shadow-lg`}>{module.icon}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-600">{module.badge}</span></div><h3 className="mt-5 text-xl font-black text-slate-950">{module.title}</h3><p className="mt-2 min-h-16 text-sm font-semibold leading-6 text-slate-500">{module.description}</p><Link href={module.href} className={`mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r ${module.tone} px-5 py-3 text-sm font-black text-white shadow-md transition group-hover:-translate-y-0.5 group-hover:brightness-110 group-hover:shadow-lg`}>Open Centre <span className="ml-2">→</span></Link></article>;
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const width = Math.max(value ? 7 : 0, Math.round((value / max) * 100));
  return <div><div className="flex items-center justify-between gap-3 text-sm"><span className="truncate font-black text-slate-800">{label}</span><span className="font-black text-slate-600">{value}</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${width}%` }} /></div></div>;
}
