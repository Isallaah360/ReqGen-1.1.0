"use client";

import { useMemo, useState } from "react";
import { HRNavigation } from "@/app/components/hr";
import { HRAccessState, HRPageHero, HRRecordTable, HRSearchBox, HRStatCard, isArchived, isCompleted, isRejected, useFilteredRows, useHRRequests } from "@/app/components/hr/HRWorkspace";

export default function HRArchivePage() {
  const workspace = useHRRequests();
  const [search, setSearch] = useState("");
  const archivedRows = useMemo(() => workspace.rows.filter(isArchived).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [workspace.rows]);
  const filtered = useFilteredRows(archivedRows, search);
  const completed = archivedRows.filter(isCompleted).length;
  const rejected = archivedRows.filter(isRejected).length;
  const thisYear = archivedRows.filter((row) => new Date(row.created_at).getFullYear() === new Date().getFullYear()).length;
  const departments = new Set(archivedRows.map((row) => row.dept_id).filter(Boolean)).size;

  if (workspace.loading || !workspace.allowed) {
    return <HRAccessState loading={workspace.loading} allowed={workspace.allowed} message={workspace.message} />;
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-8"><div className="mx-auto max-w-7xl space-y-6">
    <HRPageHero eyebrow="HR Filing Centre" title="HR Archive Register" description="A clean, searchable register of completed, paid, closed, rejected and cancelled personal HR workflows. It supports retrieval and audit review while preserving the original request record as the source of truth." icon="archive" roleSummary={workspace.roleSummary} refreshing={workspace.refreshing} onRefresh={workspace.refresh} />
    <HRNavigation />
    {workspace.message && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{workspace.message}</div>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><HRStatCard label="Archived records" value={archivedRows.length} note="All closed HR workflows" tone="violet"/><HRStatCard label="Completed / Paid" value={completed} note="Successfully completed records" tone="emerald"/><HRStatCard label="Rejected / Cancelled" value={rejected} note="Closed without completion" tone="rose"/><HRStatCard label="Current year" value={thisYear} note={`${departments} department(s) represented`} tone="slate"/></section>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-xl font-black text-slate-950">Archived HR Workflow Records</h2><p className="mt-1 text-sm font-medium text-slate-500">Search archived records by reference, staff name, department, status or category.</p></div><div className="w-full lg:max-w-md"><HRSearchBox value={search} onChange={setSearch} placeholder="Search HR archive..."/></div></div></section>
    <HRRecordTable rows={filtered} emptyText="No archived HR records match the current search." />
  </div></main>;
}
