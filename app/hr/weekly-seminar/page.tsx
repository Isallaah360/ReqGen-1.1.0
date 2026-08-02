"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { HRAccessGuard, HRNavigation } from "@/app/components/hr";
import { supabase } from "@/lib/supabaseClient";

type Session = {
  id: string;
  session_date: string;
  title: string;
  topic: string | null;
  facilitator_name: string | null;
  venue: string;
  scheduled_start: string;
  scheduled_end: string;
  status: "planned" | "open" | "closed" | "verified" | "cancelled";
  objectives: string | null;
  minutes: string | null;
  recommendations: string | null;
  follow_up_actions: string | null;
  created_at: string;
};

type Attendance = {
  id: string;
  session_id: string;
  staff_id: string;
  department_id: string | null;
  time_in: string | null;
  attendance_status: string;
  late_minutes: number;
  absence_reason: string | null;
  remarks: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  dept_id: string | null;
};

type Department = { id: string; name: string | null };
type Settings = {
  scheduled_start: string;
  scheduled_end: string;
  late_after: string;
  very_late_after: string;
  venue: string;
};

type Tone = "blue" | "emerald" | "amber" | "rose" | "violet" | "cyan" | "slate";

const tones: Record<Tone, string> = {
  blue: "from-blue-700 to-indigo-700",
  emerald: "from-emerald-600 to-teal-700",
  amber: "from-amber-500 to-orange-600",
  rose: "from-rose-600 to-red-700",
  violet: "from-violet-600 to-purple-700",
  cyan: "from-cyan-600 to-blue-700",
  slate: "from-slate-700 to-slate-950",
};

function Icon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    check: <><path d="m5 12 4 4L19 6"/></>,
    alert: <><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5M12 18h.01"/></>,
    chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/></>,
    refresh: <><path d="M20 11a8 8 0 1 0 2 5"/><path d="M20 4v7h-7"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    search: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></>,
    play: <><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/></>,
    stop: <><rect x="7" y="7" width="10" height="10" rx="1"/></>,
    shield: <><path d="M12 3 4.5 6v5.2c0 4.8 3 8.1 7.5 9.8 4.5-1.7 7.5-5 7.5-9.8V6L12 3Z"/><path d="m9 12 2 2 4-4"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{icons[name] || icons.calendar}</svg>;
}

function Stat({ title, value, note, tone, icon }: { title: string; value: string | number; note: string; tone: Tone; icon: string }) {
  return (
    <article className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${tones[tone]} p-5 text-white shadow-lg`}>
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/75">{title}</p>
          <p className="mt-3 text-3xl font-black">{value}</p>
          <p className="mt-2 text-xs font-semibold text-white/75">{note}</p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20"><Icon name={icon} /></span>
      </div>
    </article>
  );
}

function label(value: string | null | undefined) {
  return (value || "Not set").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function dateLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

function timeLabel(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true });
}

function badge(status: string) {
  const base = "inline-flex rounded-full border px-3 py-1 text-xs font-black";
  if (status === "on_time" || status === "verified") return `${base} border-emerald-200 bg-emerald-50 text-emerald-700`;
  if (status === "late" || status === "open") return `${base} border-amber-200 bg-amber-50 text-amber-800`;
  if (status === "very_late" || status === "cancelled") return `${base} border-rose-200 bg-rose-50 text-rose-700`;
  if (["excused", "official_assignment", "approved_leave"].includes(status)) return `${base} border-violet-200 bg-violet-50 text-violet-700`;
  return `${base} border-slate-200 bg-slate-100 text-slate-700`;
}

export default function WeeklySeminarPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sessionFormOpen, setSessionFormOpen] = useState(false);
  const [sessionDate, setSessionDate] = useState("");
  const [topic, setTopic] = useState("");
  const [facilitator, setFacilitator] = useState("");
  const [venue, setVenue] = useState("IET Headquarters");
  const [staffId, setStaffId] = useState("");
  const [manualStatus, setManualStatus] = useState("present_now");
  const [remarks, setRemarks] = useState("");

  const load = useCallback(async (soft = false) => {
    soft ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [sessionResult, attendanceResult, profileResult, departmentResult, settingsResult] = await Promise.all([
        supabase.from("hr_seminar_sessions").select("*").order("session_date", { ascending: false }).limit(60),
        supabase.from("hr_seminar_attendance").select("*").order("recorded_at", { ascending: false }).limit(3000),
        supabase.from("profiles").select("id,full_name,email,dept_id").order("full_name"),
        supabase.from("departments").select("id,name").order("name"),
        supabase.from("hr_seminar_settings").select("scheduled_start,scheduled_end,late_after,very_late_after,venue").eq("is_active", true).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (sessionResult.error) throw sessionResult.error;
      if (attendanceResult.error) throw attendanceResult.error;
      if (profileResult.error) throw profileResult.error;
      if (departmentResult.error) throw departmentResult.error;
      setSessions((sessionResult.data || []) as Session[]);
      setAttendance((attendanceResult.data || []) as Attendance[]);
      setProfiles((profileResult.data || []) as Profile[]);
      setDepartments((departmentResult.data || []) as Department[]);
      setSettings((settingsResult.data || null) as Settings | null);
      setVenue(settingsResult.data?.venue || "IET Headquarters");
      setSelectedSessionId((current) => current || sessionResult.data?.[0]?.id || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load Weekly Seminar Centre.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectedSession = useMemo(() => sessions.find((item) => item.id === selectedSessionId) || null, [sessions, selectedSessionId]);
  const profileMap = useMemo(() => new Map(profiles.map((item) => [item.id, item])), [profiles]);
  const departmentMap = useMemo(() => new Map(departments.map((item) => [item.id, item.name || "Unassigned"])), [departments]);
  const sessionAttendance = useMemo(() => attendance.filter((item) => item.session_id === selectedSessionId), [attendance, selectedSessionId]);
  const attendanceMap = useMemo(() => new Map(sessionAttendance.map((item) => [item.staff_id, item])), [sessionAttendance]);

  const filteredStaff = useMemo(() => profiles.filter((profile) => {
    const record = attendanceMap.get(profile.id);
    const text = `${profile.full_name || ""} ${profile.email || ""} ${departmentMap.get(profile.dept_id || "") || ""}`.toLowerCase();
    const matchesSearch = !search.trim() || text.includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || (statusFilter === "unrecorded" ? !record : record?.attendance_status === statusFilter);
    return matchesSearch && matchesStatus;
  }), [profiles, attendanceMap, departmentMap, search, statusFilter]);

  const stats = useMemo(() => {
    const presentStatuses = new Set(["on_time", "late", "very_late"]);
    const present = sessionAttendance.filter((row) => presentStatuses.has(row.attendance_status)).length;
    const onTime = sessionAttendance.filter((row) => row.attendance_status === "on_time").length;
    const late = sessionAttendance.filter((row) => ["late", "very_late"].includes(row.attendance_status)).length;
    const excused = sessionAttendance.filter((row) => ["excused", "official_assignment", "approved_leave"].includes(row.attendance_status)).length;
    const absent = Math.max(0, profiles.length - present - excused);
    const rate = profiles.length ? Math.round((present / profiles.length) * 100) : 0;
    const punctuality = present ? Math.round((onTime / present) * 100) : 0;
    return { expected: profiles.length, present, onTime, late, excused, absent, rate, punctuality };
  }, [profiles.length, sessionAttendance]);

  const departmentStats = useMemo(() => {
    const rows = new Map<string, { name: string; expected: number; present: number; onTime: number }>();
    profiles.forEach((profile) => {
      const id = profile.dept_id || "unassigned";
      const current = rows.get(id) || { name: departmentMap.get(id) || "Unassigned", expected: 0, present: 0, onTime: 0 };
      current.expected += 1;
      const record = attendanceMap.get(profile.id);
      if (record && ["on_time", "late", "very_late"].includes(record.attendance_status)) current.present += 1;
      if (record?.attendance_status === "on_time") current.onTime += 1;
      rows.set(id, current);
    });
    return Array.from(rows.values()).sort((a, b) => b.present - a.present).slice(0, 8);
  }, [profiles, attendanceMap, departmentMap]);

  async function createSession(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(null); setSuccess(null);
    try {
      if (!sessionDate) throw new Error("Select the seminar date.");
      const day = new Date(`${sessionDate}T12:00:00`).getDay();
      if (day !== 3) throw new Error("Weekly Seminar sessions should be scheduled on Wednesday.");
      const { data, error: insertError } = await supabase.from("hr_seminar_sessions").insert({
        session_date: sessionDate,
        title: "Wednesday Weekly Seminar",
        topic: topic.trim() || null,
        facilitator_name: facilitator.trim() || null,
        venue: venue.trim() || "IET Headquarters",
        scheduled_start: settings?.scheduled_start || "10:00",
        scheduled_end: settings?.scheduled_end || "12:00",
      }).select("id").single();
      if (insertError) throw insertError;
      setSelectedSessionId(data.id);
      setSessionFormOpen(false); setSessionDate(""); setTopic(""); setFacilitator("");
      setSuccess("Wednesday Seminar session created successfully.");
      await load(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create seminar session."); }
    finally { setSaving(false); }
  }

  async function setSessionStatus(status: Session["status"]) {
    if (!selectedSession) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      const { error: rpcError } = await supabase.rpc("hr_set_seminar_session_status", { p_session_id: selectedSession.id, p_status: status });
      if (rpcError) throw rpcError;
      setSuccess(`Session marked as ${label(status)}.`);
      await load(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update session status."); }
    finally { setSaving(false); }
  }

  async function recordAttendance(event: FormEvent) {
    event.preventDefault();
    if (!selectedSession || !staffId) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      const status = manualStatus === "present_now" ? null : manualStatus;
      const { error: rpcError } = await supabase.rpc("hr_record_seminar_attendance", {
        p_session_id: selectedSession.id,
        p_staff_id: staffId,
        p_time_in: new Date().toISOString(),
        p_status: status,
        p_remarks: remarks.trim() || null,
        p_absence_reason: ["absent", "excused", "official_assignment", "approved_leave"].includes(manualStatus) ? remarks.trim() || null : null,
      });
      if (rpcError) throw rpcError;
      setStaffId(""); setRemarks(""); setManualStatus("present_now");
      setSuccess("Attendance recorded successfully.");
      await load(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to record attendance."); }
    finally { setSaving(false); }
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-7xl animate-pulse space-y-6"><div className="h-48 rounded-[2rem] bg-slate-300 blur-[1px]"/><div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 rounded-3xl bg-slate-200"/>)}</div><div className="h-96 rounded-3xl bg-slate-200"/></div></div>;
  }

  return (
    <HRAccessGuard section="weekly_seminar" permission="process">
      <main className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-violet-950 to-blue-800 p-7 text-white shadow-2xl lg:p-9">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-fuchsia-400/15 blur-3xl" />
            <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-violet-200">HR Learning & Participation</p>
                <h1 className="mt-3 text-3xl font-black tracking-tight lg:text-5xl">Wednesday Weekly Seminar Centre</h1>
                <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-violet-100 lg:text-base">Manage the weekly 10:00 AM–12:00 PM seminar, staff attendance, punctuality, departmental participation and verified HR learning records.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => setSessionFormOpen(true)} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-orange-400"><Icon name="plus"/>New Session</button>
                <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-cyan-400 disabled:opacity-60"><Icon name="refresh"/>{refreshing ? "Refreshing..." : "Refresh Data"}</button>
              </div>
            </div>
          </section>

          <HRNavigation />

          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-800">{error}</div>}
          {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">{success}</div>}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat title="Expected Staff" value={stats.expected} note="Available IET HQ staff" tone="blue" icon="users" />
            <Stat title="Present" value={stats.present} note={`${stats.rate}% attendance rate`} tone="emerald" icon="check" />
            <Stat title="On Time" value={stats.onTime} note={`${stats.punctuality}% punctuality rate`} tone="cyan" icon="clock" />
            <Stat title="Late / Very Late" value={stats.late} note={`${stats.absent} currently unrecorded`} tone="amber" icon="alert" />
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Session Control</p><h2 className="mt-2 text-2xl font-black text-slate-950">Seminar sessions</h2></div>
                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">{sessions.length} records</span>
              </div>
              <select value={selectedSessionId} onChange={(e) => setSelectedSessionId(e.target.value)} className="mt-5 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 font-black text-slate-800 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-100">
                <option value="">Select seminar session</option>
                {sessions.map((session) => <option key={session.id} value={session.id}>{dateLabel(session.session_date)} — {session.topic || "Topic not entered"}</option>)}
              </select>
              {selectedSession ? <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-lg font-black text-slate-950">{selectedSession.topic || selectedSession.title}</p><p className="mt-1 text-sm font-semibold text-slate-600">{dateLabel(selectedSession.session_date)} · {selectedSession.scheduled_start.slice(0,5)}–{selectedSession.scheduled_end.slice(0,5)}</p><p className="mt-1 text-sm font-semibold text-slate-500">{selectedSession.venue} · {selectedSession.facilitator_name || "Facilitator not assigned"}</p></div><span className={badge(selectedSession.status)}>{label(selectedSession.status)}</span></div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {selectedSession.status === "planned" && <button disabled={saving} onClick={() => void setSessionStatus("open")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow hover:bg-emerald-700"><Icon name="play"/>Open Attendance</button>}
                  {selectedSession.status === "open" && <button disabled={saving} onClick={() => void setSessionStatus("closed")} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-black text-white shadow hover:bg-rose-700"><Icon name="stop"/>Close Attendance</button>}
                  {selectedSession.status === "closed" && <button disabled={saving} onClick={() => void setSessionStatus("verified")} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white shadow hover:bg-violet-700"><Icon name="shield"/>Verify Session</button>}
                </div>
              </div> : <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-500">Create or select a Wednesday seminar session.</p>}
              <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4"><p className="text-sm font-black text-blue-950">Attendance policy</p><p className="mt-2 text-sm font-semibold leading-6 text-blue-800">Scheduled {settings?.scheduled_start?.slice(0,5) || "10:00"}–{settings?.scheduled_end?.slice(0,5) || "12:00"}. Late after {settings?.late_after?.slice(0,5) || "10:05"}; very late after {settings?.very_late_after?.slice(0,5) || "10:20"}.</p></div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Attendance Entry</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Record staff attendance</h2>
              <form onSubmit={recordAttendance} className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2"><span className="text-sm font-black text-slate-800">Staff Member</span><select required disabled={!selectedSession || !["planned","open"].includes(selectedSession.status)} value={staffId} onChange={(e) => setStaffId(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 font-semibold"><option value="">Select staff member</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name || profile.email} — {departmentMap.get(profile.dept_id || "") || "Unassigned"}</option>)}</select></label>
                <label><span className="text-sm font-black text-slate-800">Attendance Status</span><select value={manualStatus} onChange={(e) => setManualStatus(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 font-semibold"><option value="present_now">Present Now (auto classify)</option><option value="excused">Excused</option><option value="official_assignment">Official Assignment</option><option value="approved_leave">Approved Leave</option><option value="absent">Absent</option></select></label>
                <label><span className="text-sm font-black text-slate-800">Remarks / Reason</span><input value={remarks} onChange={(e) => setRemarks(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 font-semibold" placeholder="Optional note"/></label>
                <button disabled={saving || !selectedSession || !staffId || !["planned","open"].includes(selectedSession.status)} className="sm:col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-black text-white shadow-lg hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><Icon name="check"/>{saving ? "Recording..." : "Record Attendance"}</button>
              </form>
            </article>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Live Attendance Register</p><h2 className="mt-2 text-2xl font-black text-slate-950">Staff attendance status</h2></div><div className="grid gap-3 sm:grid-cols-2"><div className="relative"><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} className="min-h-11 rounded-xl border border-slate-300 pl-10 pr-4 font-semibold" placeholder="Search staff or department"/></div><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="min-h-11 rounded-xl border border-slate-300 px-4 font-semibold"><option value="all">All statuses</option><option value="unrecorded">Unrecorded</option><option value="on_time">On Time</option><option value="late">Late</option><option value="very_late">Very Late</option><option value="excused">Excused</option><option value="official_assignment">Official Assignment</option><option value="approved_leave">Approved Leave</option><option value="absent">Absent</option></select></div></div></div>
              <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">Staff</th><th className="px-5 py-4">Department</th><th className="px-5 py-4">Time In</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Late</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredStaff.map((profile) => { const record = attendanceMap.get(profile.id); return <tr key={profile.id} className="hover:bg-slate-50"><td className="px-5 py-4"><p className="font-black text-slate-950">{profile.full_name || "Unnamed Staff"}</p><p className="mt-1 text-xs font-semibold text-slate-500">{profile.email}</p></td><td className="px-5 py-4 font-semibold text-slate-700">{departmentMap.get(profile.dept_id || "") || "Unassigned"}</td><td className="px-5 py-4 font-black text-slate-700">{timeLabel(record?.time_in || null)}</td><td className="px-5 py-4"><span className={badge(record?.attendance_status || "unrecorded")}>{label(record?.attendance_status || "unrecorded")}</span></td><td className="px-5 py-4 font-black text-slate-700">{record?.late_minutes ? `${record.late_minutes} min` : "—"}</td></tr>; })}{filteredStaff.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center font-semibold text-slate-500">No staff records match the current filters.</td></tr>}</tbody></table></div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Department Participation</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Attendance by department</h2>
              <div className="mt-5 space-y-4">{departmentStats.map((item) => { const rate = item.expected ? Math.round((item.present / item.expected) * 100) : 0; return <div key={item.name}><div className="mb-2 flex items-center justify-between gap-3"><div><p className="text-sm font-black text-slate-900">{item.name}</p><p className="text-xs font-semibold text-slate-500">{item.present}/{item.expected} present · {item.onTime} on time</p></div><span className="text-sm font-black text-violet-700">{rate}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500" style={{ width: `${rate}%` }}/></div></div>; })}{departmentStats.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Department analytics will appear after attendance is recorded.</p>}</div>
            </article>
          </section>
        </div>

        {sessionFormOpen && <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/65 p-4 backdrop-blur-sm"><form onSubmit={createSession} className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="bg-gradient-to-r from-violet-700 to-blue-700 px-6 py-5 text-white"><p className="text-xs font-black uppercase tracking-widest text-violet-200">New Wednesday Session</p><h2 className="mt-2 text-2xl font-black">Create Weekly Seminar</h2></div><div className="grid gap-5 p-6 sm:grid-cols-2"><label><span className="text-sm font-black text-slate-800">Session Date</span><input required type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 font-semibold"/></label><label><span className="text-sm font-black text-slate-800">Venue</span><input value={venue} onChange={(e) => setVenue(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 font-semibold"/></label><label className="sm:col-span-2"><span className="text-sm font-black text-slate-800">Seminar Topic</span><input value={topic} onChange={(e) => setTopic(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 font-semibold" placeholder="Enter the seminar topic"/></label><label className="sm:col-span-2"><span className="text-sm font-black text-slate-800">Facilitator</span><input value={facilitator} onChange={(e) => setFacilitator(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 font-semibold" placeholder="Name of facilitator or department"/></label></div><div className="flex justify-end gap-3 border-t p-6"><button type="button" onClick={() => setSessionFormOpen(false)} className="rounded-xl bg-slate-700 px-5 py-3 font-black text-white shadow hover:bg-slate-800">Cancel</button><button disabled={saving} className="rounded-xl bg-violet-600 px-6 py-3 font-black text-white shadow-lg hover:bg-violet-700 disabled:opacity-60">{saving ? "Creating..." : "Create Session"}</button></div></form></div>}
      </main>
    </HRAccessGuard>
  );
}
