"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  HRPageHero,
  HRRecordTable,
  HRSearchBox,
  HRStatCard,
  categoryKey,
  formatDate,
  isArchived,
  isCompleted,
  isRejected,
  stageKey,
  type HRRequest,
  useHRRequests,
} from "@/app/components/hr/HRWorkspace";
import { HRNavigation } from "@/app/components/hr";

type LeaveRecord = {
  id: string;
  request_id: string;
  leave_type: string | null;
  start_date: string | null;
  end_date: string | null;
  duration_days: number | null;
  supporting_documents_status: string | null;
  hr_status: string | null;
  filing_status: string | null;
  assigned_officer_id: string | null;
  hr_recommendation: string | null;
  updated_at: string | null;
};

type QueueKey = "all" | "review" | "boss" | "approved" | "closed";

function daysUntil(value: string | null) {
  if (!value) return null;
  const target = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function queueMatch(row: HRRequest, record: LeaveRecord | undefined, queue: QueueKey) {
  if (queue === "all") return true;
  const status = (record?.hr_status || "").toLowerCase();
  const stage = stageKey(row.current_stage);
  if (queue === "review") return stage === "HR" || ["pending_hr_review", "assigned", "in_progress", "returned"].includes(status);
  if (queue === "boss") return ["submitted_to_hr_boss", "awaiting_hr_boss"].includes(status);
  if (queue === "approved") return ["approved", "forwarded_to_dg", "filed"].includes(status) || isCompleted(row);
  return isRejected(row) || ["rejected", "cancelled", "closed"].includes(status);
}

function queueTabs(counts: Record<QueueKey, number>) {
  return [
    { key: "all" as const, label: "ALL LEAVE", count: counts.all, tone: "bg-slate-700 hover:bg-slate-800" },
    { key: "review" as const, label: "HR REVIEW", count: counts.review, tone: "bg-cyan-600 hover:bg-cyan-700" },
    { key: "boss" as const, label: "HR BOSS REVIEW", count: counts.boss, tone: "bg-amber-500 hover:bg-amber-600" },
    { key: "approved" as const, label: "APPROVED / FILED", count: counts.approved, tone: "bg-emerald-600 hover:bg-emerald-700" },
    { key: "closed" as const, label: "REJECTED / CLOSED", count: counts.closed, tone: "bg-rose-600 hover:bg-rose-700" },
  ];
}

export default function LeaveDashboard() {
  const workspace = useHRRequests();
  const [records, setRecords] = useState<LeaveRecord[]>([]);
  const [metadataWarning, setMetadataWarning] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [queue, setQueue] = useState<QueueKey>("all");
  const [department, setDepartment] = useState("all");

  const leaveRows = useMemo(
    () => workspace.rows.filter((row) => categoryKey(row.personal_category) === "LEAVE"),
    [workspace.rows]
  );

  useEffect(() => {
    let active = true;
    async function loadMetadata() {
      if (!workspace.allowed) return;
      const { data, error } = await supabase
        .from("hr_leave_records")
        .select("id,request_id,leave_type,start_date,end_date,duration_days,supporting_documents_status,hr_status,filing_status,assigned_officer_id,hr_recommendation,updated_at");
      if (!active) return;
      if (error) {
        setMetadataWarning("Leave workflow data is available. Run the latest leave metadata SQL migration to activate leave dates, balances and HR recommendations.");
        setRecords([]);
      } else {
        setMetadataWarning(null);
        setRecords((data || []) as LeaveRecord[]);
      }
    }
    void loadMetadata();
    return () => { active = false; };
  }, [workspace.allowed, workspace.refreshing]);

  const recordMap = useMemo(() => new Map(records.map((record) => [record.request_id, record])), [records]);
  const departments = useMemo(
    () => Array.from(new Set(leaveRows.map((row) => row.dept_name).filter(Boolean) as string[])).sort(),
    [leaveRows]
  );

  const counts = useMemo<Record<QueueKey, number>>(() => ({
    all: leaveRows.length,
    review: leaveRows.filter((row) => queueMatch(row, recordMap.get(row.id), "review")).length,
    boss: leaveRows.filter((row) => queueMatch(row, recordMap.get(row.id), "boss")).length,
    approved: leaveRows.filter((row) => queueMatch(row, recordMap.get(row.id), "approved")).length,
    closed: leaveRows.filter((row) => queueMatch(row, recordMap.get(row.id), "closed")).length,
  }), [leaveRows, recordMap]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leaveRows
      .filter((row) => queueMatch(row, recordMap.get(row.id), queue))
      .filter((row) => department === "all" || row.dept_name === department)
      .filter((row) => {
        if (!term) return true;
        const record = recordMap.get(row.id);
        return [
          row.request_no,
          row.title,
          row.requester_name,
          row.dept_name,
          row.current_stage,
          row.status,
          record?.leave_type,
          record?.hr_status,
        ].join(" ").toLowerCase().includes(term);
      });
  }, [department, leaveRows, queue, recordMap, search]);

  const activeLeave = records.filter((record) => {
    const start = daysUntil(record.start_date);
    const end = daysUntil(record.end_date);
    return start !== null && end !== null && start <= 0 && end >= 0;
  }).length;
  const upcoming = records.filter((record) => {
    const days = daysUntil(record.start_date);
    return days !== null && days >= 0 && days <= 14;
  }).length;
  const incompleteDocs = records.filter((record) => (record.supporting_documents_status || "").toLowerCase() === "incomplete").length;

  const departmentSummary = useMemo(() => {
    const map = new Map<string, { total: number; active: number; closed: number }>();
    leaveRows.forEach((row) => {
      const name = row.dept_name || "Unassigned Department";
      const current = map.get(name) || { total: 0, active: 0, closed: 0 };
      current.total += 1;
      if (isArchived(row)) current.closed += 1;
      else current.active += 1;
      map.set(name, current);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total).slice(0, 8);
  }, [leaveRows]);

  if (workspace.loading || !workspace.allowed) {
    return <div className="min-h-screen bg-slate-50 px-4 py-12 text-center font-bold text-slate-600">{workspace.loading ? "Loading Leave Management Centre…" : workspace.message || "Access denied."}</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <HRPageHero
          eyebrow="HR Operations Centre"
          title="Leave Management Centre"
          description="Review leave workflows, monitor HR recommendations, track approved leave periods and complete filing after the final decision. Access is limited to HR leadership and assigned Leave Officers."
          icon="leave"
          roleSummary={workspace.roleSummary}
          refreshing={workspace.refreshing}
          onRefresh={workspace.refresh}
        />
        <HRNavigation />

        {(workspace.message || metadataWarning) && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            {workspace.message || metadataWarning}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <HRStatCard label="Leave requests" value={leaveRows.length} note="All leave-related HR workflows" tone="blue" />
          <HRStatCard label="Awaiting HR action" value={counts.review + counts.boss} note={`${counts.review} officer review, ${counts.boss} HR Boss`} tone="amber" />
          <HRStatCard label="Currently on leave" value={activeLeave} note={`${upcoming} starting within 14 days`} tone="emerald" />
          <HRStatCard label="Control exceptions" value={incompleteDocs} note="Records with incomplete supporting documents" tone="rose" />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {queueTabs(counts).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setQueue(tab.key)}
                className={`flex min-h-14 items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-xs font-black text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-100 ${tab.tone} ${queue === tab.key ? "ring-4 ring-blue-200" : ""}`}
              >
                <span>{tab.label}</span>
                <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-black text-white ring-1 ring-white/30">{tab.count}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Operational Register</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Leave Workflow Queue</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Showing {filtered.length} of {leaveRows.length} leave records.</p>
              </div>
              <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-2xl">
                <HRSearchBox value={search} onChange={setSearch} placeholder="Search leave records…" />
                <select value={department} onChange={(event) => setDepartment(event.target.value)} className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                  <option value="all">All departments</option>
                  {departments.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-blue-950 via-indigo-900 to-violet-800 p-5 text-white shadow-xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">HR Governance</p>
            <h2 className="mt-2 text-xl font-black">Leave Review Chain</h2>
            <div className="mt-4 space-y-3 text-sm font-semibold text-white/85">
              <p>1. Assigned Leave Officer verifies the record.</p>
              <p>2. Officer submits an HR recommendation.</p>
              <p>3. HR Boss approves, returns or reassigns.</p>
              <p>4. Final HR position proceeds through the existing workflow.</p>
              <p>5. HR files the completed decision.</p>
            </div>
            <Link href="/hr/review" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-cyan-400">Open HR Boss Review</Link>
          </div>
        </section>

        <HRRecordTable rows={filtered} emptyText="No leave records match the selected queue and filters." />

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Department Analysis</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Leave Workload by Department</h2>
            <div className="mt-5 space-y-4">
              {departmentSummary.length === 0 ? <p className="text-sm font-semibold text-slate-500">No departmental leave data is available.</p> : departmentSummary.map(([name, values]) => (
                <div key={name}>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-black text-slate-800">{name}</span>
                    <span className="font-bold text-slate-500">{values.active} active · {values.closed} closed</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${Math.max(8, (values.total / Math.max(1, leaveRows.length)) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Upcoming Leave</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Next Fourteen Days</h2>
            <div className="mt-4 space-y-3">
              {records.filter((record) => { const days = daysUntil(record.start_date); return days !== null && days >= 0 && days <= 14; }).slice(0, 8).map((record) => {
                const row = leaveRows.find((item) => item.id === record.request_id);
                return (
                  <div key={record.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-black text-slate-900">{row?.requester_name || row?.request_no || "Leave record"}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{record.leave_type || "Leave"} · {formatDate(record.start_date)} to {formatDate(record.end_date)}</p>
                      </div>
                      <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">{record.duration_days || "—"} day(s)</span>
                    </div>
                  </div>
                );
              })}
              {upcoming === 0 && <p className="text-sm font-semibold text-slate-500">No leave is scheduled to begin within the next fourteen days.</p>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
