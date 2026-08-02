"use client";

import Link from "next/link";
import { useMemo } from "react";
import StaffNavigation from "@/app/components/staff/StaffNavigation";
import {
  StaffAction,
  StaffBadge,
  StaffEmpty,
  StaffHero,
  StaffSection,
  StaffShell,
  StaffStat,
} from "@/app/components/staff/StaffUI";
import { useStaffWorkspace } from "@/app/components/staff/useStaffWorkspace";
import { dateText, text } from "@/app/components/enterprise/data";

const closedStatuses = ["approved", "completed", "paid", "closed", "filed"];
const rejectedStatuses = ["rejected", "cancelled", "deleted"];

export default function StaffWorkspacePage() {
  const {
    profile,
    requests,
    notifications,
    leave,
    attendance,
    training,
    staffFiles,
    loading,
    warning,
    refresh,
  } = useStaffWorkspace();

  const summary = useMemo(() => {
    const approved = requests.filter((row) =>
      closedStatuses.some((status) => text(row.status).toLowerCase().includes(status))
    ).length;

    const rejected = requests.filter((row) =>
      rejectedStatuses.some((status) => text(row.status).toLowerCase().includes(status))
    ).length;

    const pending = Math.max(requests.length - approved - rejected, 0);
    const unread = notifications.filter((row) => !Boolean(row.is_read)).length;
    const present = attendance.filter((row) => text(row.attendance_status).toLowerCase() !== "absent").length;
    const attendanceRate = attendance.length ? Math.round((present / attendance.length) * 100) : 0;

    return { approved, rejected, pending, unread, attendanceRate };
  }, [attendance, notifications, requests]);

  if (loading) {
    return (
      <StaffShell>
        <div className="mx-auto max-w-[1400px] space-y-5">
          <div className="h-64 animate-pulse rounded-[2rem] bg-slate-900/15" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-36 animate-pulse rounded-2xl bg-white/80" />
            ))}
          </div>
        </div>
      </StaffShell>
    );
  }

  return (
    <StaffShell>
      <div className="mx-auto max-w-[1400px] space-y-6">
        <StaffHero
          name={profile?.fullName || "Staff Member"}
          designation={`${profile?.designation || "IET Staff Member"}${profile?.department ? ` · ${profile.department}` : ""}`}
          description="Your secure personal workspace for requests, leave, attendance, training, notifications, downloads and employment information."
          actions={
            <>
              <StaffAction href="/dashboard" tone="slate">Main Dashboard</StaffAction>
              <button
                type="button"
                onClick={() => void refresh()}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-700 to-sky-500 px-4 py-2.5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                Refresh Workspace
              </button>
            </>
          }
        />

        <StaffNavigation />

        {warning ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
            {warning}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StaffStat label="Pending Requests" value={summary.pending} note="Requests still moving through workflow" tone="amber" />
          <StaffStat label="Approved / Completed" value={summary.approved} note="Successfully completed personal requests" tone="emerald" />
          <StaffStat label="Attendance Rate" value={`${summary.attendanceRate}%`} note={`${attendance.length} attendance record(s) captured`} tone="cyan" />
          <StaffStat label="Unread Notifications" value={summary.unread} note="Workflow and system updates" tone="rose" />
          <StaffStat label="Leave Records" value={leave.length} note="Personal leave applications and history" tone="violet" />
          <StaffStat label="Training Records" value={training.length} note="Capacity-building participation" tone="blue" />
          <StaffStat label="Staff File" value={staffFiles.length ? "Registered" : "Pending"} note="Read-only personnel-file status" tone={staffFiles.length ? "emerald" : "slate"} />
          <StaffStat label="Downloads" value={summary.approved} note="Approved Request printouts available" tone="cyan" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
          <StaffSection
            title="Recent Personal Requests"
            eyebrow="Workflow activity"
            action={<StaffAction href="/staff/requests" tone="blue">View All Requests</StaffAction>}
          >
            {requests.length === 0 ? (
              <StaffEmpty title="No request record" description="Requests submitted through ReqGen will appear here." />
            ) : (
              <div className="space-y-3">
                {requests.slice(0, 6).map((row) => (
                  <Link
                    key={text(row.id)}
                    href={`/requests/${text(row.id)}`}
                    className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div>
                      <p className="font-black text-slate-950">{text(row.request_no, "Request")} · {text(row.title, "Untitled request")}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-600">{text(row.current_stage, "Pending stage")} · {dateText(text(row.created_at))}</p>
                    </div>
                    <StaffBadge tone="blue">{text(row.status, "Pending")}</StaffBadge>
                  </Link>
                ))}
              </div>
            )}
          </StaffSection>

          <StaffSection title="Personal Profile" eyebrow="Employment snapshot" action={<StaffAction href="/profile" tone="violet">Open Profile</StaffAction>}>
            <dl className="space-y-4 text-sm">
              {[
                ["Full Name", profile?.fullName || "Not available"],
                ["Department", profile?.department || "Not assigned"],
                ["Designation / Role", profile?.designation || "Staff"],
                ["Email", profile?.email || "Not available"],
                ["Phone", profile?.phone || "Not provided"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <dt className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</dt>
                  <dd className="mt-1 break-words font-black text-slate-950">{value}</dd>
                </div>
              ))}
            </dl>
          </StaffSection>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <StaffSection title="Quick Personal Actions" eyebrow="Self-service">
            <div className="grid gap-3 sm:grid-cols-2">
              <StaffAction href="/requests/new" tone="blue">Create New Request</StaffAction>
              <StaffAction href="/staff/leave" tone="violet">Open My Leave</StaffAction>
              <StaffAction href="/staff/attendance" tone="emerald">View Attendance</StaffAction>
              <StaffAction href="/staff/training" tone="cyan">View Training</StaffAction>
              <StaffAction href="/staff/notifications" tone="rose">Open Notifications</StaffAction>
              <StaffAction href="/staff/downloads" tone="slate">Open Downloads</StaffAction>
            </div>
          </StaffSection>

          <StaffSection title="Latest Notifications" eyebrow="Personal updates" action={<StaffAction href="/staff/notifications" tone="rose">Notification Centre</StaffAction>}>
            {notifications.length === 0 ? (
              <StaffEmpty title="No recent notification" description="Workflow and personal system updates will appear here." />
            ) : (
              <div className="space-y-3">
                {notifications.slice(0, 5).map((row) => (
                  <div key={text(row.id)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">{text(row.title, "Workflow update")}</p>
                        <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{text(row.body) || text(row.message, "Open the related item for details.")}</p>
                        <p className="mt-2 text-xs font-bold text-slate-400">{dateText(text(row.created_at))}</p>
                      </div>
                      <StaffBadge tone={Boolean(row.is_read) ? "slate" : "rose"}>{Boolean(row.is_read) ? "Read" : "Unread"}</StaffBadge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </StaffSection>
        </section>
      </div>
    </StaffShell>
  );
}
