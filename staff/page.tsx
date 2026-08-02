"use client";

import Link from "next/link";
import StaffNavigation from "@/app/components/staff/StaffNavigation";
import { StaffAction, StaffBadge, StaffEmpty, StaffHero, StaffSection, StaffShell, StaffStat } from "@/app/components/staff/StaffUI";
import { useStaffWorkspace } from "@/app/components/staff/useStaffWorkspace";
import { dateText, text } from "@/app/components/enterprise/data";

const closed = ["approved", "paid", "completed", "closed"];
const rejected = ["rejected", "cancelled", "deleted"];

export default function StaffWorkspacePage() {
  const { profile, requests, notifications, leave, attendance, training, loading, warning, refresh } = useStaffWorkspace();

  const pendingRequests = requests.filter((row) => {
    const status = text(row.status).toLowerCase();
    return !closed.some((key) => status.includes(key)) && !rejected.some((key) => status.includes(key));
  });
  const approvedRequests = requests.filter((row) => closed.some((key) => text(row.status).toLowerCase().includes(key)));
  const unread = notifications.filter((row) => !Boolean(row.is_read)).length;
  const attended = attendance.filter((row) => text(row.attendance_status).toLowerCase() !== "absent").length;
  const attendanceRate = attendance.length ? Math.round((attended / attendance.length) * 100) : 0;
  const activeLeave = leave.filter((row) => ["approved", "active", "in_progress"].some((key) => text(row.status).toLowerCase().includes(key))).length;

  return (
    <StaffShell>
      <div className="mx-auto max-w-[1500px] space-y-6">
        <StaffHero
          name={profile?.fullName || (loading ? "Loading..." : "Staff Member")}
          designation={`${profile?.designation || "IET Staff"} · ${profile?.department || "Islamic Education Trust"}`}
          description="Your secure digital office for personal requests, leave, attendance, training, performance, notifications and official documents."
          actions={<><StaffAction href="/requests/new" tone="amber">New Request</StaffAction><StaffAction href="/dashboard" tone="slate">Main Dashboard</StaffAction></>}
        />

        <StaffNavigation />

        {warning ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{warning}</div> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StaffStat label="Pending Requests" value={loading ? "—" : pendingRequests.length} note="Requests still moving through workflow" tone="amber" />
          <StaffStat label="Approved Requests" value={loading ? "—" : approvedRequests.length} note="Completed or approved personal records" tone="emerald" />
          <StaffStat label="Attendance" value={loading ? "—" : `${attendanceRate}%`} note={`${attended} of ${attendance.length} captured sessions`} tone="cyan" />
          <StaffStat label="Unread Updates" value={loading ? "—" : unread} note="Notifications requiring your attention" tone="rose" />
          <StaffStat label="Active Leave" value={loading ? "—" : activeLeave} note="Approved or active leave records" tone="violet" />
          <StaffStat label="Training Records" value={loading ? "—" : training.length} note="Learning and capacity-building participation" tone="blue" />
          <StaffStat label="Staff File" value={profile ? "Active" : "—"} note="Personal employment profile status" tone="slate" />
          <StaffStat label="Downloads" value={approvedRequests.length} note="Approved requests available for printing" tone="emerald" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
          <StaffSection title="My Recent Requests" eyebrow="Workflow activity" action={<StaffAction href="/staff/requests" tone="blue">View All</StaffAction>}>
            {requests.length === 0 ? <StaffEmpty title="No request record" description="Your submitted requests will appear here." /> : (
              <div className="space-y-3">
                {requests.slice(0, 6).map((row) => (
                  <Link key={text(row.id)} href={`/requests/${text(row.id)}`} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white hover:shadow-md sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <div className="font-black text-slate-950">{text(row.request_no, "Request")} · {text(row.title, "Untitled request")}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-600">{text(row.current_stage, "Pending")} · {dateText(row.created_at)}</div>
                    </div>
                    <StaffBadge tone="amber">{text(row.status, "Pending")}</StaffBadge>
                  </Link>
                ))}
              </div>
            )}
          </StaffSection>

          <StaffSection title="Quick Actions" eyebrow="Personal tools">
            <div className="grid gap-3 sm:grid-cols-2">
              <StaffAction href="/requests/new" tone="amber">Create Request</StaffAction>
              <StaffAction href="/staff/leave" tone="violet">My Leave</StaffAction>
              <StaffAction href="/staff/attendance" tone="cyan">Attendance</StaffAction>
              <StaffAction href="/staff/training" tone="blue">Training</StaffAction>
              <StaffAction href="/staff/downloads" tone="emerald">Downloads</StaffAction>
              <StaffAction href="/profile" tone="slate">Update Profile</StaffAction>
            </div>
            <button onClick={() => void refresh()} className="mt-4 w-full rounded-xl bg-gradient-to-r from-cyan-700 to-sky-500 px-4 py-3 text-sm font-black text-white shadow-md">Refresh Workspace</button>
          </StaffSection>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <StaffSection title="Recent Notifications" eyebrow="Personal inbox" action={<StaffAction href="/staff/notifications" tone="rose">Open Inbox</StaffAction>}>
            {notifications.length === 0 ? <StaffEmpty title="No notification" description="Workflow and system updates addressed to you will appear here." /> : (
              <div className="space-y-3">
                {notifications.slice(0, 5).map((row) => <div key={text(row.id)} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="font-black text-slate-950">{text(row.title, "ReqGen update")}</div><p className="mt-1 text-sm font-semibold text-slate-600">{text(row.body) || text(row.message, "Open the related record for details.")}</p><p className="mt-2 text-xs font-bold text-slate-400">{dateText(row.created_at)}</p></div>)}
              </div>
            )}
          </StaffSection>

          <StaffSection title="My Employment Snapshot" eyebrow="Personal profile">
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ["Full Name", profile?.fullName || "—"],
                ["Department", profile?.department || "—"],
                ["Designation", profile?.designation || "—"],
                ["Primary Role", profile?.role || "—"],
                ["Email", profile?.email || "—"],
                ["Phone", profile?.phone || "Not provided"],
              ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><dt className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</dt><dd className="mt-2 break-words text-sm font-black text-slate-950">{value}</dd></div>)}
            </dl>
          </StaffSection>
        </section>
      </div>
    </StaffShell>
  );
}
