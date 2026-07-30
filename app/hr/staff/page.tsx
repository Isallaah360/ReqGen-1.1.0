"use client";

import { useMemo, useState } from "react";
import { HRAccessState, HRModuleNav, HRPageHero, HRRecordTable, HRSearchBox, HRStatCard, categoryKey, isArchived, useFilteredRows, useHRRequests } from "@/app/components/hr/HRWorkspace";

export default function HRStaffFilesPage() {
  const workspace = useHRRequests();
  const [search, setSearch] = useState("");
  const staffRows = useMemo(() => workspace.rows.filter((row) => categoryKey(row.personal_category) !== "LEAVE"), [workspace.rows]);
  const filtered = useFilteredRows(staffRows, search);
  const active = staffRows.filter((row) => !isArchived(row)).length;
  const contract = staffRows.filter((row) => categoryKey(row.personal_category) === "CONTRACTRENEWAL").length;
  const resignation = staffRows.filter((row) => categoryKey(row.personal_category) === "RESIGNATION").length;
  const departments = new Set(staffRows.map((row) => row.dept_id).filter(Boolean)).size;

  if (workspace.loading || !workspace.allowed) {
    return <HRAccessState loading={workspace.loading} allowed={workspace.allowed} message={workspace.message} />;
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-8"><div className="mx-auto max-w-7xl space-y-6">
    <HRPageHero eyebrow="HR Filing Centre" title="Staff Files Intelligence" description="A structured operational view of staff-related personal requests, contract renewals, resignations and HR filing movements. This workspace summarizes workflow records and does not replace the authoritative personnel file." icon="staff" roleSummary={workspace.roleSummary} refreshing={workspace.refreshing} onRefresh={workspace.refresh} />
    <HRModuleNav />
    {workspace.message && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{workspace.message}</div>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><HRStatCard label="Staff-related files" value={staffRows.length} note="Workflow-linked HR records" tone="blue"/><HRStatCard label="Active movement" value={active} note="Not yet completed or closed" tone="amber"/><HRStatCard label="Contract renewals" value={contract} note="Renewal workflow records" tone="violet"/><HRStatCard label="Departments" value={departments} note={`${resignation} resignation record(s)`} tone="slate"/></section>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-xl font-black text-slate-950">Staff File Register</h2><p className="mt-1 text-sm font-medium text-slate-500">Search staff-related HR workflow records by reference, staff name, department or category.</p></div><div className="w-full lg:max-w-md"><HRSearchBox value={search} onChange={setSearch} placeholder="Search staff files..."/></div></div></section>
    <HRRecordTable rows={filtered} emptyText="No staff-related HR workflow records match the current search." />
  </div></main>;
}
