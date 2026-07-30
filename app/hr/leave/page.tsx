"use client";

import { useMemo, useState } from "react";
import { HRAccessState, HRModuleNav, HRPageHero, HRRecordTable, HRSearchBox, HRStatCard, categoryKey, isArchived, isCompleted, isRejected, stageKey, useFilteredRows, useHRRequests } from "@/app/components/hr/HRWorkspace";

export default function HRLeaveRecordsPage() {
  const workspace = useHRRequests();
  const [search, setSearch] = useState("");
  const leaveRows = useMemo(() => workspace.rows.filter((row) => categoryKey(row.personal_category) === "LEAVE"), [workspace.rows]);
  const filtered = useFilteredRows(leaveRows, search);
  const active = leaveRows.filter((row) => !isArchived(row)).length;
  const hrReview = leaveRows.filter((row) => stageKey(row.current_stage) === "HR").length;
  const filing = leaveRows.filter((row) => stageKey(row.current_stage) === "HRFILING").length;
  const closed = leaveRows.filter((row) => isCompleted(row) || isRejected(row)).length;

  if (workspace.loading || !workspace.allowed) {
    return <HRAccessState loading={workspace.loading} allowed={workspace.allowed} message={workspace.message} />;
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-8"><div className="mx-auto max-w-7xl space-y-6">
    <HRPageHero eyebrow="HR Filing Centre" title="Leave Records Dashboard" description="A focused view of leave requests moving through HR review, DG decision and final HR filing. The page presents workflow status and filing readiness without exposing unrelated request categories." icon="leave" roleSummary={workspace.roleSummary} refreshing={workspace.refreshing} onRefresh={workspace.refresh} />
    <HRModuleNav />
    {workspace.message && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{workspace.message}</div>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><HRStatCard label="Leave records" value={leaveRows.length} note="All leave workflow records" tone="emerald"/><HRStatCard label="Active leave" value={active} note="Currently moving through workflow" tone="blue"/><HRStatCard label="At HR / Filing" value={hrReview + filing} note={`${hrReview} review, ${filing} filing`} tone="amber"/><HRStatCard label="Closed records" value={closed} note="Completed, rejected or cancelled" tone="violet"/></section>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-xl font-black text-slate-950">Leave Workflow Register</h2><p className="mt-1 text-sm font-medium text-slate-500">Monitor leave movement, current stage and filing completion.</p></div><div className="w-full lg:max-w-md"><HRSearchBox value={search} onChange={setSearch} placeholder="Search leave records..."/></div></div></section>
    <HRRecordTable rows={filtered} emptyText="No leave records match the current search." />
  </div></main>;
}
