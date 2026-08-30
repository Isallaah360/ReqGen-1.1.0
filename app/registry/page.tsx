"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type RequestMovementRow = {
  id: string;
  status: string | null;
  current_stage: string | null;
  dept_id: string | null;
  request_type: string | null;
  personal_category: string | null;
  created_at: string;
};

type DepartmentRow = { id: string; name: string };

type ProfileRole = {
  id: string;
  profile_id: string;
  role_key: string;
  role_name: string;
  is_primary: boolean;
  is_active: boolean;
};

type StageKey =
  | "PO"
  | "DOD"
  | "DINADMIN"
  | "REGISTRAR"
  | "HOD"
  | "HR"
  | "DG"
  | "ACCOUNT"
  | "HRFILING"
  | "COMPLETED"
  | "REJECTED";

const STAGES: Array<{
  key: StageKey;
  label: string;
  short: string;
  tone: string;
  bar: string;
}> = [
  { key: "PO", label: "Programme Officer", short: "PO", tone: "bg-indigo-600", bar: "bg-indigo-500" },
  { key: "DOD", label: "Director of Department", short: "DOD", tone: "bg-blue-600", bar: "bg-blue-500" },
  { key: "DINADMIN", label: "DIN Administration", short: "DIN", tone: "bg-cyan-600", bar: "bg-cyan-500" },
  { key: "REGISTRAR", label: "Registrar", short: "REG", tone: "bg-sky-600", bar: "bg-sky-500" },
  { key: "HOD", label: "Head of Department", short: "HOD", tone: "bg-emerald-600", bar: "bg-emerald-500" },
  { key: "HR", label: "Human Resources", short: "HR", tone: "bg-teal-600", bar: "bg-teal-500" },
  { key: "DG", label: "Director-General", short: "DG", tone: "bg-violet-600", bar: "bg-violet-500" },
  { key: "ACCOUNT", label: "Account Officer", short: "ACCT", tone: "bg-amber-600", bar: "bg-amber-500" },
  { key: "HRFILING", label: "HR Filing", short: "FILE", tone: "bg-fuchsia-600", bar: "bg-fuchsia-500" },
  { key: "COMPLETED", label: "Completed / Paid", short: "DONE", tone: "bg-green-600", bar: "bg-green-500" },
  { key: "REJECTED", label: "Rejected / Closed", short: "CLOSED", tone: "bg-rose-600", bar: "bg-rose-500" },
];

function roleKey(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "");
}

function stageKey(value: string | null | undefined): StageKey {
  const key = String(value || "").trim().toUpperCase().replace(/[\s_]+/g, "");
  if (["PO", "DOD", "DINADMIN", "REGISTRAR", "HOD", "HR", "DG", "ACCOUNT", "HRFILING", "COMPLETED"].includes(key)) {
    return key as StageKey;
  }
  if (["REJECTED", "DELETED", "CANCELLED"].includes(key)) return "REJECTED";
  return "PO";
}

function isCompleted(row: RequestMovementRow) {
  const status = String(row.status || "").toLowerCase();
  return stageKey(row.current_stage) === "COMPLETED" || status.includes("complete") || status.includes("paid") || status.includes("closed");
}

function isRejected(row: RequestMovementRow) {
  const status = String(row.status || "").toLowerCase();
  const stage = String(row.current_stage || "").toUpperCase();
  return ["REJECTED", "DELETED", "CANCELLED"].includes(stage) || status.includes("reject") || status.includes("delete") || status.includes("cancel");
}

function isActive(row: RequestMovementRow) {
  return !isCompleted(row) && !isRejected(row);
}

function isToday(value: string) {
  const d = new Date(value);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

const REGISTRY_NOW = Date.now();

function isWithinDays(value: string, days: number) {
  const time = new Date(value).getTime();
  return time >= REGISTRY_NOW - days * 24 * 60 * 60 * 1000;
}

function requestType(row: RequestMovementRow) {
  const type = String(row.request_type || "").trim().toUpperCase();
  const category = String(row.personal_category || "").trim().toUpperCase().replace(/[\s_]+/g, "");
  if (type === "OFFICIAL") return "Official";
  if (type === "PERSONAL" && category === "FUND") return "Personal Fund";
  if (type === "PERSONAL") return "Personal Other";
  return "Unclassified";
}

function hasAnyRole(roleSet: Set<string>, roles: string[]) {
  return roles.some((role) => roleSet.has(roleKey(role)));
}

function pct(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}


function KpiCard({ label, value, note, className, icon }: { label: string; value: number; note: string; className: string; icon: ReactNode }) {
  const accent = /rose|red/.test(className) ? "#e84655" : /emerald|green/.test(className) ? "#129a67" : /cyan|sky/.test(className) ? "#0891b2" : /slate/.test(className) ? "#334155" : "#0b5cf0";
  return (
    <section className="rg-stat-card">
      <div className="rg-stat-accent" style={{ background: accent }} />
      <div className="rg-stat-body flex items-start justify-between gap-4">
        <div><p className="rg-stat-label">{label}</p><p className="rg-stat-value">{value.toLocaleString()}</p><p className="rg-stat-note">{note}</p></div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-50" style={{ color: accent }}><span className="h-5 w-5">{icon}</span></span>
      </div>
    </section>
  );
}

function MiniBar({ label, value, total, bar }: { label: string; value: number; total: number; bar: string }) {
  const percentage = pct(value, total);
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-bold text-slate-700">{label}</span>
        <span className="font-black text-slate-900">{value} <span className="text-xs text-slate-400">({percentage}%)</span></span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(percentage, value > 0 ? 4 : 0)}%` }} />
      </div>
    </div>
  );
}

export default function RegistryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [role, setRole] = useState("Staff");
  const [roles, setRoles] = useState<ProfileRole[]>([]);
  const [rows, setRows] = useState<RequestMovementRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);

  const roleSet = useMemo(() => {
    const set = new Set<string>([roleKey(role)]);
    roles.filter((item) => item.is_active).forEach((item) => set.add(roleKey(item.role_key)));
    return set;
  }, [role, roles]);

  const canAccess = useMemo(() => hasAnyRole(roleSet, ["registry", "admin", "auditor"]), [roleSet]);

  const load = useCallback(async (silent = false) => {
    if (silent) { setRefreshing(true); } else { setLoading(true); }
    setMessage(null);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }

    const [profileResult, rolesResult] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle(),
      supabase.from("profile_roles").select("id,profile_id,role_key,role_name,is_primary,is_active").eq("profile_id", auth.user.id).eq("is_active", true),
    ]);

    if (profileResult.error) {
      setMessage(`Unable to verify Registry access: ${profileResult.error.message}`);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const fallbackRole = String(profileResult.data?.role || "Staff");
    const activeRoles = (rolesResult.data || []) as ProfileRole[];
    setRole(fallbackRole);
    setRoles(activeRoles);

    const accessSet = new Set<string>([roleKey(fallbackRole)]);
    activeRoles.forEach((item) => accessSet.add(roleKey(item.role_key)));
    if (!hasAnyRole(accessSet, ["registry", "admin", "auditor"])) {
      setRows([]);
      setDepartments([]);
      setMessage("Access denied. Registry Dashboard is available to Registry, Admin and Auditor roles.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const [requestResult, departmentResult] = await Promise.all([
      supabase.from("requests").select("id,status,current_stage,dept_id,request_type,personal_category,created_at").order("created_at", { ascending: false }),
      supabase.from("departments").select("id,name").order("name", { ascending: true }),
    ]);

    if (requestResult.error) setMessage(`Unable to load request movement summary: ${requestResult.error.message}`);
    if (departmentResult.error) setMessage((current) => current || `Unable to load departments: ${departmentResult.error.message}`);

    setRows((requestResult.data || []) as RequestMovementRow[]);
    setDepartments((departmentResult.data || []) as DepartmentRow[]);
    setLoading(false);
    setRefreshing(false);
  }, [router]);

  useEffect(() => { queueMicrotask(() => { void load(false); }); }, [load]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter(isActive).length;
    const completed = rows.filter(isCompleted).length;
    const rejected = rows.filter(isRejected).length;
    const today = rows.filter((row) => isToday(row.created_at)).length;
    const last7 = rows.filter((row) => isWithinDays(row.created_at, 7)).length;
    return { total, active, completed, rejected, today, last7 };
  }, [rows]);

  const stageCounts = useMemo(() => {
    const counts = new Map<StageKey, number>();
    STAGES.forEach((stage) => counts.set(stage.key, 0));
    rows.forEach((row) => {
      const key = isRejected(row) ? "REJECTED" : isCompleted(row) ? "COMPLETED" : stageKey(row.current_stage);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [rows]);

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const key = requestType(row);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return ["Official", "Personal Fund", "Personal Other", "Unclassified"].map((label) => ({ label, value: counts.get(label) || 0 }));
  }, [rows]);

  const departmentSummary = useMemo(() => {
    const names = new Map<string, string>(departments.map((department) => [department.id, department.name]));
    const counts = new Map<string, { name: string; total: number; active: number; completed: number; today: number }>();
    rows.forEach((row) => {
      const id = row.dept_id || "UNASSIGNED";
      const current = counts.get(id) || { name: names.get(id) || "Unassigned Department", total: 0, active: 0, completed: 0, today: 0 };
      current.total += 1;
      if (isActive(row)) current.active += 1;
      if (isCompleted(row)) current.completed += 1;
      if (isToday(row.created_at)) current.today += 1;
      counts.set(id, current);
    });
    return Array.from(counts.values()).sort((a, b) => b.total - a.total);
  }, [rows, departments]);

  const bottleneck = useMemo(() => {
    return STAGES.filter((stage) => !["COMPLETED", "REJECTED"].includes(stage.key))
      .map((stage) => ({ ...stage, value: stageCounts.get(stage.key) || 0 }))
      .sort((a, b) => b.value - a.value)[0];
  }, [stageCounts]);

  if (loading) {
    return <main className="min-h-screen bg-slate-50 px-4"><div className="mx-auto max-w-7xl py-12 font-bold text-slate-600">Loading Registry Dashboard...</div></main>;
  }

  if (!canAccess) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-7 shadow-lg">
          <h1 className="text-2xl font-black text-slate-900">Registry Dashboard Access</h1>
          <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{message || "Access denied."}</p>
          <button type="button" onClick={() => router.push("/dashboard")} className="reqgen-btn reqgen-btn-slate mt-5 rounded-xl bg-slate-700 px-5 py-3 text-sm font-black text-white shadow-md hover:bg-slate-800">Back to Dashboard</button>
        </section>
      </main>
    );
  }

  return (
    <main className="rg-module-page rg-adopted-page rg-registry-page">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <section className="rg-module-header">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="rg-module-eyebrow">Registry Command Centre</div>
              <h1 className="mt-1 text-3xl font-black tracking-tight">Request Movement Intelligence</h1>
              <p className="rg-module-description">A privacy-conscious visual dashboard showing only summarized request movement, workload distribution and workflow position. Request contents, narratives and financial details are not displayed.</p>
              <p className="mt-2 text-[10px] font-bold text-slate-500">Viewing capacity: {roles.filter((item) => item.is_active).map((item) => item.role_name).join(", ") || role}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => void load(true)} disabled={refreshing} className="reqgen-btn reqgen-btn-cyan rounded-xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-lg hover:bg-cyan-500 disabled:opacity-60">{refreshing ? "Refreshing..." : "Refresh Dashboard"}</button>
              <button type="button" onClick={() => router.push("/registry/operations")} className="reqgen-btn reqgen-btn-blue rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-lg hover:bg-blue-600">Registry Operations</button>
              <button type="button" onClick={() => router.push("/dashboard")} className="reqgen-btn reqgen-btn-slate rounded-xl bg-slate-700 px-5 py-3 text-sm font-black text-white shadow-lg hover:bg-slate-600">Main Dashboard</button>
            </div>
          </div>
        </section>

        {message && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{message}</div>}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="Total Movement" value={stats.total} note="All summarized requests" className="bg-gradient-to-br from-slate-700 to-slate-900" icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h10" /></svg>} />
          <KpiCard label="Active Workflow" value={stats.active} note="Currently moving" className="bg-gradient-to-br from-blue-600 to-indigo-700" icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>} />
          <KpiCard label="Submitted Today" value={stats.today} note={`${stats.last7} in the last 7 days`} className="bg-gradient-to-br from-cyan-600 to-sky-700" icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 012 2v14H3V6a2 2 0 012-2z" /></svg>} />
          <KpiCard label="Completed / Paid" value={stats.completed} note={`${pct(stats.completed, stats.total)}% completion rate`} className="bg-gradient-to-br from-emerald-600 to-green-700" icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>} />
          <KpiCard label="Closed / Rejected" value={stats.rejected} note={`${pct(stats.rejected, stats.total)}% of movement`} className="bg-gradient-to-br from-rose-600 to-red-700" icon={<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>} />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg md:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 className="text-xl font-black text-slate-900">Workflow Movement Pipeline</h2><p className="mt-1 text-sm font-semibold text-slate-500">Current summarized position across each approval stage.</p></div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">Live Snapshot</span>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {STAGES.map((stage) => {
                const count = stageCounts.get(stage.key) || 0;
                return <div key={stage.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center justify-between gap-3"><span className={`rounded-xl px-3 py-2 text-xs font-black text-white shadow-sm ${stage.tone}`}>{stage.short}</span><span className="text-2xl font-black text-slate-900">{count}</span></div><p className="mt-3 text-sm font-extrabold text-slate-700">{stage.label}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className={`h-full rounded-full ${stage.bar}`} style={{ width: `${Math.max(pct(count, stats.total), count > 0 ? 5 : 0)}%` }} /></div></div>;
              })}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
              <h2 className="text-lg font-black text-slate-900">Request Category Mix</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Volume only; no request content shown.</p>
              <div className="mt-5 space-y-5">
                {typeCounts.map((item, index) => <MiniBar key={item.label} label={item.label} value={item.value} total={stats.total} bar={["bg-blue-500", "bg-violet-500", "bg-amber-500", "bg-slate-400"][index]} />)}
              </div>
            </div>
            <div className="rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 p-5 text-white shadow-lg">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/80">Movement Attention</p>
              <p className="mt-3 text-3xl font-black">{bottleneck?.value || 0}</p>
              <p className="mt-1 text-lg font-black">{bottleneck?.label || "No active stage"}</p>
              <p className="mt-3 text-sm font-semibold text-white/85">This is currently the busiest active workflow stage and may deserve operational attention.</p>
            </div>
          </aside>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-lg md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-black text-slate-900">Department Movement Overview</h2><p className="mt-1 text-sm font-semibold text-slate-500">Summarized request volume by originating department.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{departmentSummary.length} department(s)</span></div>
          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-100 text-slate-700"><tr><th className="px-4 py-3 text-left font-black">Department</th><th className="px-4 py-3 text-center font-black">Total</th><th className="px-4 py-3 text-center font-black">Active</th><th className="px-4 py-3 text-center font-black">Completed</th><th className="px-4 py-3 text-center font-black">Today</th><th className="px-4 py-3 text-left font-black">Movement Share</th></tr></thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {departmentSummary.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center font-bold text-slate-500">No summarized movement is available yet.</td></tr> : departmentSummary.map((department) => {
                  const share = pct(department.total, stats.total);
                  return <tr key={department.name} className="hover:bg-slate-50"><td className="px-4 py-4 font-extrabold text-slate-900">{department.name}</td><td className="px-4 py-4 text-center font-black text-slate-900">{department.total}</td><td className="px-4 py-4 text-center"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">{department.active}</span></td><td className="px-4 py-4 text-center"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">{department.completed}</span></td><td className="px-4 py-4 text-center"><span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-black text-cyan-700">{department.today}</span></td><td className="min-w-48 px-4 py-4"><div className="flex items-center gap-3"><div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(share, department.total > 0 ? 4 : 0)}%` }} /></div><span className="w-10 text-right text-xs font-black text-slate-600">{share}%</span></div></td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Registry Boundary</p><h3 className="mt-2 text-lg font-black text-blue-950">Movement, not content</h3><p className="mt-2 text-sm font-semibold leading-6 text-blue-900">The dashboard deliberately excludes request titles, descriptions, amounts, attachments and personal narratives.</p></div>
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Operational Purpose</p><h3 className="mt-2 text-lg font-black text-emerald-950">Monitor and summarize</h3><p className="mt-2 text-sm font-semibold leading-6 text-emerald-900">Registry can observe volume, current stage, departmental distribution and completion trends without taking approval action.</p></div>
          <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">Data Protection</p><h3 className="mt-2 text-lg font-black text-violet-950">Privacy-conscious view</h3><p className="mt-2 text-sm font-semibold leading-6 text-violet-900">The data query retrieves only workflow metadata required for visual summaries and does not retrieve request contents.</p></div>
        </section>
      </div>
    </main>
  );
}
