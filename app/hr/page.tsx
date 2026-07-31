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

type OfficerAssignment = {
  officer_id: string;
  section_key: string;
  is_active: boolean;
};

type RequestAssignment = {
  id: string;
  status: string;
  priority: string;
  due_at: string | null;
  officer_id: string;
};

function key(value: string | null | undefined) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function stageLabel(value: string | null | undefined) {
  const stage = key(value);
  if (stage === "hrfiling") return "HR Filing";
  if (stage === "account") return "Account Officer";
  if (stage === "completed") return "Completed";
  if (stage === "dg") return "DG";
  if (stage === "hr") return "HR Review";
  if (stage === "hod") return "HOD";
  if (stage === "dod") return "DOD";
  return value || "Unassigned";
}

function isComplete(row: HRRequest) {
  const value = `${row.status || ""} ${row.current_stage || ""}`.toLowerCase();
  return value.includes("complete") || value.includes("paid") || value.includes("closed");
}

function isRejected(row: HRRequest) {
  const value = `${row.status || ""} ${row.current_stage || ""}`.toLowerCase();
  return value.includes("reject") || value.includes("cancel") || value.includes("delete");
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function barWidth(value: number, max: number) {
  if (max <= 0) return "0%";
  return `${Math.max(6, Math.round((value / max) * 100))}%`;
}

export default function HRBossDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [requests, setRequests] = useState<HRRequest[]>([]);
  const [officerAssignments, setOfficerAssignments] = useState<OfficerAssignment[]>([]);
  const [requestAssignments, setRequestAssignments] = useState<RequestAssignment[]>([]);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setMessage(null);

    const [requestResult, officerResult, assignmentResult] = await Promise.all([
      supabase.rpc("get_hr_filing_requests"),
      supabase
        .from("hr_officer_assignments")
        .select("officer_id,section_key,is_active")
        .eq("is_active", true),
      supabase
        .from("hr_request_assignments")
        .select("id,status,priority,due_at,officer_id")
        .order("assigned_at", { ascending: false }),
    ]);

    if (requestResult.error) {
      setMessage(`Unable to load HR request intelligence: ${requestResult.error.message}`);
      setRequests([]);
    } else {
      setRequests((requestResult.data || []) as HRRequest[]);
    }

    setOfficerAssignments(
      officerResult.error ? [] : ((officerResult.data || []) as OfficerAssignment[]),
    );
    setRequestAssignments(
      assignmentResult.error ? [] : ((assignmentResult.data || []) as RequestAssignment[]),
    );

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load(false);
    const onFocus = () => void load(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const stats = useMemo(() => {
    const total = requests.length;
    const completed = requests.filter(isComplete).length;
    const rejected = requests.filter(isRejected).length;
    const active = Math.max(0, total - completed - rejected);
    const awaitingHR = requests.filter((row) => key(row.current_stage) === "hr").length;
    const awaitingFiling = requests.filter((row) => key(row.current_stage) === "hrfiling").length;
    const submittedForReview = requestAssignments.filter((row) => row.status === "submitted").length;
    const urgent = requestAssignments.filter((row) => row.priority === "urgent" || row.priority === "high").length;
    const activeOfficers = new Set(officerAssignments.map((row) => row.officer_id)).size;

    return {
      total,
      completed,
      rejected,
      active,
      awaitingHR,
      awaitingFiling,
      submittedForReview,
      urgent,
      activeOfficers,
    };
  }, [requests, officerAssignments, requestAssignments]);

  const stageData = useMemo(() => {
    const map = new Map<string, number>();
    requests.forEach((row) => {
      const label = stageLabel(row.current_stage);
      map.set(label, (map.get(label) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [requests]);

  const departmentData = useMemo(() => {
    const map = new Map<string, number>();
    requests.forEach((row) => {
      const label = row.dept_name || "Unassigned Department";
      map.set(label, (map.get(label) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [requests]);

  const maxStage = Math.max(1, ...stageData.map((item) => item.value));
  const maxDept = Math.max(1, ...departmentData.map((item) => item.value));
  const latest = requests.slice(0, 6);

  return (
    <HRAccessGuard bossOnly>
      <main className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-800 p-7 text-white shadow-2xl lg:p-9">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
            <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">
                  Restricted Directorate Workspace
                </p>
                <h1 className="mt-3 text-3xl font-black tracking-tight lg:text-5xl">
                  HR Directorate Command Centre
                </h1>
                <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-blue-100 lg:text-base">
                  Live HR request movement, officer delegation, review workload, filing readiness and personnel operations from one secured command centre.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void load(true)}
                disabled={refreshing}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-cyan-500 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-cyan-400 disabled:opacity-60"
              >
                {refreshing ? "Refreshing..." : "Refresh HR Data"}
              </button>
            </div>
          </section>

          <HRNavigation />

          {message ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
              {message}
            </div>
          ) : null}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["HR Requests", stats.total, "All HR-related workflow records", "from-blue-600 to-indigo-700"],
              ["Active Workflow", stats.active, "Requests still moving", "from-cyan-500 to-blue-700"],
              ["Awaiting HR", stats.awaitingHR, "Initial HR review queue", "from-amber-500 to-orange-600"],
              ["Ready for Filing", stats.awaitingFiling, "Final HR filing queue", "from-violet-600 to-purple-700"],
              ["Active Officers", stats.activeOfficers, "Officers with current assignments", "from-emerald-500 to-teal-700"],
            ].map(([label, value, note, tone]) => (
              <article key={String(label)} className={`rounded-3xl bg-gradient-to-br ${tone} p-5 text-white shadow-lg`}>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/75">{label}</p>
                <p className="mt-3 text-3xl font-black">{loading ? "—" : value}</p>
                <p className="mt-2 text-xs font-semibold text-white/75">{note}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Live Workflow Visualisation</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">HR request movement by stage</h2>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{stats.active} active</span>
              </div>
              <div className="mt-6 space-y-4">
                {stageData.length === 0 ? (
                  <p className="rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-500">No HR workflow data is available yet.</p>
                ) : (
                  stageData.map((item, index) => (
                    <div key={item.label}>
                      <div className="mb-2 flex items-center justify-between gap-4">
                        <span className="text-sm font-black text-slate-800">{item.label}</span>
                        <span className="text-sm font-black text-slate-950">{item.value}</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${
                            index % 4 === 0
                              ? "bg-blue-600"
                              : index % 4 === 1
                                ? "bg-cyan-500"
                                : index % 4 === 2
                                  ? "bg-violet-600"
                                  : "bg-emerald-500"
                          }`}
                          style={{ width: barWidth(item.value, maxStage) }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Operational Attention</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">HR Boss priority panel</h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {[
                  ["Awaiting boss review", stats.submittedForReview, "bg-orange-50 text-orange-800 border-orange-200"],
                  ["High / urgent delegated work", stats.urgent, "bg-rose-50 text-rose-800 border-rose-200"],
                  ["Completed / filed", stats.completed, "bg-emerald-50 text-emerald-800 border-emerald-200"],
                  ["Rejected / closed", stats.rejected, "bg-slate-50 text-slate-700 border-slate-200"],
                ].map(([label, value, tone]) => (
                  <div key={String(label)} className={`flex items-center justify-between rounded-2xl border p-4 ${tone}`}>
                    <span className="text-sm font-black">{label}</span>
                    <span className="text-2xl font-black">{loading ? "—" : value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Link href="/hr/review" className="rounded-xl bg-orange-600 px-4 py-3 text-center text-sm font-black text-white shadow-md hover:bg-orange-700">Open Review Queue</Link>
                <Link href="/hr/assignments" className="rounded-xl bg-violet-600 px-4 py-3 text-center text-sm font-black text-white shadow-md hover:bg-violet-700">Manage Officers</Link>
              </div>
            </article>
          </section>

          <section className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Department Intelligence</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">HR workload by department</h2>
              <div className="mt-6 space-y-4">
                {departmentData.map((item) => (
                  <div key={item.label}>
                    <div className="mb-2 flex justify-between gap-4 text-sm font-black text-slate-800">
                      <span className="truncate">{item.label}</span>
                      <span>{item.value}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500" style={{ width: barWidth(item.value, maxDept) }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Latest HR Requests</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">Recent HR-bound movement</h2>
                </div>
                <Link href="/hr/filing" className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-md hover:bg-blue-700">Open Filing Centre</Link>
              </div>
              <div className="divide-y divide-slate-100">
                {latest.length === 0 ? (
                  <p className="px-6 py-12 text-center text-sm font-semibold text-slate-500">No HR-related requests are available.</p>
                ) : (
                  latest.map((row) => (
                    <Link key={row.id} href={`/requests/${row.id}`} className="flex flex-col gap-3 px-6 py-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-black text-slate-950">{row.request_no}</p>
                        <p className="mt-1 truncate text-sm font-semibold text-slate-700">{row.title}</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">{row.requester_name || "Unknown requester"} · {row.dept_name || "Unassigned department"}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{stageLabel(row.current_stage)}</span>
                        <span className="text-xs font-bold text-slate-500">{formatDate(row.created_at)}</span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </article>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">Strategic HR Development</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">Learning, performance and assessment centres</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/hr/reports" className="rounded-xl bg-violet-700 px-4 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-violet-800">Open HR Reports</Link>
                <Link href="/hr/analytics" className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-blue-800">HR Analytics</Link>
                <Link href="/hr/officer-performance" className="rounded-xl bg-cyan-600 px-4 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-cyan-700">Officer Performance</Link>
                <Link href="/hr/compliance" className="rounded-xl bg-rose-700 px-4 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-rose-800">Compliance</Link>
                <Link href="/hr/settings" className="rounded-xl bg-slate-800 px-4 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-slate-900">HR Settings</Link>
                <Link href="/hr/output" className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-emerald-800">Print & Export</Link>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {[
                ["/hr/weekly-seminar", "Wednesday Weekly Seminar", "Attendance, punctuality and departmental participation.", "from-violet-600 to-blue-700"],
                ["/hr/capacity-building/staff", "Staff Capacity Building", "Training needs, programmes, certification and impact.", "from-fuchsia-600 to-violet-700"],
                ["/hr/capacity-building/departments", "Department Capacity Building", "Gap assessment and institutional improvement programmes.", "from-cyan-600 to-blue-700"],
                ["/hr/department-kpi", "Department KPI", "Targets, weighted evidence and performance review.", "from-emerald-600 to-teal-700"],
                ["/hr/assessments/annual-360", "Annual Staff 360° Assessment", "Controlled multi-source assessment and development planning.", "from-amber-500 to-orange-700"],
              ].map(([href, title, description, tone]) => (
                <Link key={href} href={href} className={`group rounded-2xl border border-white/20 bg-gradient-to-br ${tone} p-4 text-white shadow-md transition hover:-translate-y-1 hover:shadow-xl`}>
                  <p className="text-sm font-black">{title}</p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-white/80">{description}</p>
                  <span className="mt-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white ring-1 ring-white/20">Operational</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </HRAccessGuard>
  );
}
