"use client";
import Link from "next/link";
import StaffNavigation from "@/app/components/staff/StaffNavigation";
import { StaffAction, StaffBadge, StaffEmpty, StaffHero, StaffSection, StaffShell, StaffStat } from "@/app/components/staff/StaffUI";
import { useStaffWorkspace } from "@/app/components/staff/useStaffWorkspace";
import { dateText, text } from "@/app/components/enterprise/data";

export default function StaffRequestsPage() {
  const { profile, requests, loading, warning } = useStaffWorkspace();
  const pending = requests.filter((r) => !["approved","paid","completed","closed","rejected","cancelled"].some((s) => text(r.status).toLowerCase().includes(s)));
  const approved = requests.filter((r) => ["approved","paid","completed","closed"].some((s) => text(r.status).toLowerCase().includes(s)));
  const rejected = requests.filter((r) => ["rejected","cancelled","deleted"].some((s) => text(r.status).toLowerCase().includes(s)));
  return <StaffShell><div className="mx-auto max-w-[1500px] space-y-6">
    <StaffHero name={profile?.fullName || "Staff Member"} designation="My Requests" description="Track every request you submitted, its current workflow stage, status and approved printout." actions={<><StaffAction href="/requests/new" tone="amber">New Request</StaffAction><StaffAction href="/staff" tone="slate">Overview</StaffAction></>} />
    <StaffNavigation />
    {warning ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{warning}</div> : null}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StaffStat label="All Requests" value={loading ? "—" : requests.length}/><StaffStat label="Pending" value={loading ? "—" : pending.length} tone="amber"/><StaffStat label="Approved" value={loading ? "—" : approved.length} tone="emerald"/><StaffStat label="Rejected" value={loading ? "—" : rejected.length} tone="rose"/></section>
    <StaffSection title="Personal Request Register" eyebrow="Only your submissions are shown">
      {requests.length === 0 ? <StaffEmpty title="No submitted request" description="Use New Request to start your first workflow."/> : <div className="space-y-3">{requests.map((r) => <div key={text(r.id)} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto] md:items-center"><div><div className="font-black text-slate-950">{text(r.request_no,"Request")} · {text(r.title,"Untitled request")}</div><div className="mt-1 text-sm font-semibold text-slate-600">{text(r.request_type,"Request")} · Stage: {text(r.current_stage,"Pending")} · {dateText(r.created_at)}</div></div><div className="flex flex-wrap gap-2"><StaffBadge tone="amber">{text(r.status,"Pending")}</StaffBadge><Link href={`/requests/${text(r.id)}`} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white">View</Link><Link href={`/requests/${text(r.id)}/print`} className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-black text-white">Print</Link></div></div>)}</div>}
    </StaffSection>
  </div></StaffShell>;
}
