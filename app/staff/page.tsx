"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ActiveRoleSwitcher } from "@/app/components/ActiveRoleSwitcher";
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

type Tone = "blue" | "cyan" | "emerald" | "violet" | "amber" | "rose" | "slate";

const closedStatuses = ["completed", "approved", "paid", "filed", "closed"];
const rejectedStatuses = ["rejected", "deleted", "cancelled"];

function statusTone(status: string): Tone {
  const value = status.toLowerCase();
  if (rejectedStatuses.some((item) => value.includes(item))) return "rose";
  if (closedStatuses.some((item) => value.includes(item))) return "emerald";
  if (value.includes("pending") || value.includes("waiting")) return "amber";
  return "blue";
}

function requestHref(id: unknown) {
  const value = text(id);
  return value ? `/requests/${value}` : "/staff/requests";
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function icon(path: string) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d={path} />
    </svg>
  );
}

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

  const stats = useMemo(() => {
    const pendingRequests = requests.filter((row) => {
      const status = text(row.status).toLowerCase();
      return !closedStatuses.some((item) => status.includes(item)) && !rejectedStatuses.some((item) => status.includes(item));
    }).length;

    const approvedRequests = requests.filter((row) => {
      const status = text(row.status).toLowerCase();
      return closedStatuses.some((item) => status.includes(item));
    }).length;

    const unreadNotifications = notifications.filter((row) => !Boolean(row.is_read)).length;
    const presentAttendance = attendance.filter((row) => {
      const value = text(row.attendance_status || row.status).toLowerCase();
      return value && !value.includes("absent");
    }).length;

    const attendanceRate = attendance.length ? Math.round((presentAttendance / attendance.length) * 100) : 0;

    const activeLeave = leave.filter((row) => {
      const value = text(row.status).toLowerCase();
      return value.includes("approved") || value.includes("active") || value.includes("ongoing");
    }).length;

    return {
      pendingRequests,
      approvedRequests,
      unreadNotifications,
      attendanceRate,
      activeLeave,
      training: training.length,
      downloads: approvedRequests,
      staffFileReady: staffFiles.length > 0,
    };
  }, [attendance, leave, notifications, requests, staffFiles.length, training.length]);

  const recentRequests = requests.slice(0, 5);
  const recentNotifications = notifications.slice(0, 5);

  return (
    <StaffShell>
      <div className="mx-auto max-w-[1480px] space-y-5">
        <StaffHero
          name={profile?.fullName || "Staff Member"}
          designation={profile?.designation || profile?.role || "IET Staff Member"}
          description={`${greeting()}. This is your secure personal workspace for requests, leave, attendance, training, notifications, documents and profile services.`}
          actions={
            <div className="flex flex-col gap-3 sm:min-w-[310px]">
              <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100">Current Working Role</p>
                <ActiveRoleSwitcher compact />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-cyan-400"
                >
                  {icon("M20 11a8.1 8.1 0 1 1-2.3-5.7M20 4v7h-7")}
                  Refresh
                </button>
                <Link
                  href="/profile"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-black text-white shadow-lg ring-1 ring-white/25 transition hover:-translate-y-0.5 hover:bg-white/25"
                >
                  {icon("M20 21a8 8 0 0 0-16 0M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8")}
                  My Profile
                </Link>
              </div>
            </div>
          }
        />

        <StaffNavigation />

        {warning ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 shadow-sm">
            {warning}
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <StaffStat label="Pending" value={loading ? "—" : stats.pendingRequests} note="Requests in progress" tone="amber" />
          <StaffStat label="Approved" value={loading ? "—" : stats.approvedRequests} note="Completed requests" tone="emerald" />
          <StaffStat label="Attendance" value={loading ? "—" : `${stats.attendanceRate}%`} note="Recorded participation" tone="cyan" />
          <StaffStat label="Unread" value={loading ? "—" : stats.unreadNotifications} note="Personal notifications" tone="rose" />
          <StaffStat label="Leave" value={loading ? "—" : stats.activeLeave} note="Active leave records" tone="violet" />
          <StaffStat label="Training" value={loading ? "—" : stats.training} note="Learning records" tone="blue" />
          <StaffStat label="Downloads" value={loading ? "—" : stats.downloads} note="Printable requests" tone="emerald" />
          <StaffStat label="Staff File" value={loading ? "—" : stats.staffFileReady ? "Ready" : "Pending"} note="Personal file status" tone="slate" />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <StaffSection title="Personal Quick Actions" eyebrow="Your Digital Office">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <QuickAction href="/requests/new" title="Create Request" description="Start a new Official or Personal request." tone="blue" symbol="+" />
              <QuickAction href="/staff/requests" title="Track Requests" description="Follow your submitted requests and decisions." tone="cyan" symbol="↗" />
              <QuickAction href="/staff/leave" title="My Leave" description="Review personal leave records and status." tone="violet" symbol="L" />
              <QuickAction href="/staff/attendance" title="Attendance" description="View seminar attendance and punctuality." tone="emerald" symbol="A" />
              <QuickAction href="/staff/downloads" title="Downloads" description="Open approved printable documents." tone="amber" symbol="D" />
              <QuickAction href="/staff/notifications" title="Notifications" description="Read workflow and personal updates." tone="rose" symbol="N" />
            </div>
          </StaffSection>

          <StaffSection title="Employment Snapshot" eyebrow="Personal Profile" action={<StaffAction href="/profile" tone="slate">Open Profile</StaffAction>}>
            <div className="grid gap-3 sm:grid-cols-2">
              <ProfileField label="Full Name" value={profile?.fullName || "Not available"} />
              <ProfileField label="Department" value={profile?.department || "Not assigned"} />
              <ProfileField label="Designation" value={profile?.designation || profile?.role || "Staff"} />
              <ProfileField label="Email" value={profile?.email || "Not available"} />
              <ProfileField label="Phone" value={profile?.phone || "Not provided"} />
              <ProfileField label="Staff File" value={stats.staffFileReady ? "Registered" : "Not yet available"} />
            </div>
          </StaffSection>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <StaffSection title="Recent Requests" eyebrow="Personal Workflow" action={<StaffAction href="/staff/requests" tone="blue">View All</StaffAction>}>
            {recentRequests.length === 0 ? (
              <StaffEmpty title={loading ? "Loading requests" : "No request yet"} description="Your submitted requests will appear here." />
            ) : (
              <div className="space-y-3">
                {recentRequests.map((row, index) => {
                  const status = text(row.status, "Pending");
                  return (
                    <Link
                      key={text(row.id) || String(index)}
                      href={requestHref(row.id)}
                      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-[0.13em] text-blue-700">{text(row.request_no, "Request")}</p>
                        <h3 className="mt-1 break-words text-sm font-black text-slate-950">{text(row.title, "Untitled request")}</h3>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{text(row.current_stage, "Submitted")} · {dateText(text(row.created_at))}</p>
                      </div>
                      <StaffBadge tone={statusTone(status)}>{status}</StaffBadge>
                    </Link>
                  );
                })}
              </div>
            )}
          </StaffSection>

          <StaffSection title="Latest Notifications" eyebrow="Personal Updates" action={<StaffAction href="/staff/notifications" tone="violet">Open Inbox</StaffAction>}>
            {recentNotifications.length === 0 ? (
              <StaffEmpty title={loading ? "Loading notifications" : "No notification"} description="Workflow and personal updates will appear here." />
            ) : (
              <div className="space-y-3">
                {recentNotifications.map((row, index) => {
                  const unread = !Boolean(row.is_read);
                  return (
                    <Link
                      key={text(row.id) || String(index)}
                      href={text(row.link, "/staff/notifications")}
                      className={`block rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${unread ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="break-words text-sm font-black text-slate-950">{text(row.title, "Workflow update")}</h3>
                          <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-600">{text(row.body) || text(row.message, "Open for details.")}</p>
                          <p className="mt-2 text-[11px] font-bold text-slate-400">{dateText(text(row.created_at))}</p>
                        </div>
                        <StaffBadge tone={unread ? "blue" : "slate"}>{unread ? "Unread" : "Read"}</StaffBadge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </StaffSection>
        </section>
      </div>
    </StaffShell>
  );
}

function QuickAction({ href, title, description, tone, symbol }: { href: string; title: string; description: string; tone: Tone; symbol: string }) {
  const styles: Record<Tone, string> = {
    blue: "from-blue-800 to-blue-600",
    cyan: "from-cyan-700 to-sky-500",
    emerald: "from-emerald-700 to-teal-500",
    violet: "from-violet-800 to-purple-600",
    amber: "from-amber-600 to-orange-500",
    rose: "from-rose-700 to-red-500",
    slate: "from-slate-900 to-slate-700",
  };

  return (
    <Link href={href} className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${styles[tone]} p-4 text-white shadow-md transition hover:-translate-y-1 hover:shadow-xl`}>
      <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-white/10" />
      <div className="relative">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-lg font-black ring-1 ring-white/20">{symbol}</span>
        <h3 className="mt-4 text-sm font-black uppercase tracking-[0.08em] text-white">{title}</h3>
        <p className="mt-1 text-xs font-semibold leading-5 text-white/85">{description}</p>
      </div>
    </Link>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}
