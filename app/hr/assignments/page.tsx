"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, CheckCircle2, PauseCircle, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { HRAccessGuard, HRNavigation } from "@/app/components/hr";

type Officer = { id: string; full_name: string | null; email: string | null; role: string | null };
type Assignment = { id: string; officer_id: string; section_key: string; permission_key: string; is_active: boolean; created_at?: string | null };

const sections = [
  ["filing", "HR Filing & Personal Requests"],
  ["leave", "Leave Management"],
  ["staff_filing", "Staff Files"],
  ["registrar", "Registrar Centre"],
  ["archive", "HR Archive"],
  ["weekly_seminar", "Wednesday Weekly Seminar"],
  ["staff_capacity_building", "Staff Capacity Building"],
  ["department_capacity_building", "Department Capacity Building"],
  ["department_kpi", "Department KPI"],
  ["annual_360_assessment", "Annual Staff 360° Assessment"],
] as const;

const permissions = [
  ["view", "View Only"],
  ["process", "Process Records"],
  ["recommend", "Make Recommendation"],
  ["submit_to_hr_boss", "Submit to HR Boss"],
  ["file", "Complete Filing"],
  ["archive", "Archive Records"],
  ["manage", "Full Section Management"],
] as const;

const label = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

export default function HRAssignmentsPage() {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [officerId, setOfficerId] = useState("");
  const [section, setSection] = useState("filing");
  const [permission, setPermission] = useState("process");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: profiles, error: profileError }, { data: current, error: assignmentError }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email,role").order("full_name"),
      supabase.from("hr_officer_assignments").select("id,officer_id,section_key,permission_key,is_active,created_at").order("created_at", { ascending: false }),
    ]);
    setOfficers((profiles || []) as Officer[]);
    setAssignments((current || []) as Assignment[]);
    setMessage(profileError?.message || assignmentError?.message || null);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const names = useMemo(() => new Map(officers.map((officer) => [officer.id, officer.full_name || officer.email || officer.id])), [officers]);
  const activeCount = assignments.filter((item) => item.is_active).length;
  const assignedOfficers = new Set(assignments.filter((item) => item.is_active).map((item) => item.officer_id)).size;
  const domainCount = new Set(assignments.filter((item) => item.is_active).map((item) => item.section_key)).size;

  async function assign() {
    if (!officerId) return;
    setBusy(true);
    setMessage(null);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("hr_officer_assignments").upsert({
      officer_id: officerId,
      section_key: section,
      permission_key: permission,
      is_active: true,
      assigned_by: auth.user?.id,
    }, { onConflict: "officer_id,section_key,permission_key" });
    setBusy(false);
    setMessage(error ? error.message : "HR authority assigned successfully.");
    if (!error) await load();
  }

  async function toggle(item: Assignment) {
    const { error } = await supabase.from("hr_officer_assignments").update({ is_active: !item.is_active }).eq("id", item.id);
    setMessage(error ? error.message : item.is_active ? "Assignment suspended." : "Assignment restored.");
    if (!error) await load();
  }

  return (
    <HRAccessGuard bossOnly>
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/40 to-blue-50/40 px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="rounded-[2rem] bg-gradient-to-br from-violet-950 via-indigo-900 to-blue-800 p-8 text-white shadow-2xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div><p className="text-xs font-black uppercase tracking-[.25em] text-violet-200">Enterprise HR Authority Model</p><h1 className="mt-3 text-3xl font-black lg:text-5xl">Officer Assignment Centre</h1><p className="mt-4 max-w-3xl font-semibold leading-7 text-violet-100">Assign multiple HR domains and precise permission levels to each officer. Access becomes effective only when the officer switches to the matching active HR role.</p></div>
              <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-black text-white shadow-lg hover:bg-cyan-400"><RefreshCw className="h-5 w-5" />Refresh</button>
            </div>
          </section>

          <HRNavigation />

          {message ? <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900">{message}</div> : null}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Assigned Officers", assignedOfficers, Users, "from-blue-600 to-indigo-700"],
              ["Active Authorities", activeCount, ShieldCheck, "from-emerald-600 to-teal-700"],
              ["HR Domains Covered", domainCount, BriefcaseBusiness, "from-violet-600 to-purple-700"],
              ["Suspended", assignments.filter((item) => !item.is_active).length, PauseCircle, "from-amber-500 to-orange-600"],
            ].map(([title, value, Icon, tone]) => <article key={String(title)} className={`rounded-3xl bg-gradient-to-br ${tone} p-5 text-white shadow-lg`}><div className="flex justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-white/75">{title as string}</p><p className="mt-3 text-3xl font-black">{String(value)}</p></div><Icon className="h-7 w-7" /></div></article>)}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5"><p className="text-xs font-black uppercase tracking-[.18em] text-violet-700">Grant HR Authority</p><h2 className="mt-1 text-2xl font-black text-slate-950">Create or restore an officer assignment</h2></div>
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_auto]">
              <label><span className="mb-2 block text-xs font-black uppercase text-slate-500">HR Officer</span><select value={officerId} onChange={(event) => setOfficerId(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-bold outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"><option value="">Select officer</option>{officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.full_name || officer.email}</option>)}</select></label>
              <label><span className="mb-2 block text-xs font-black uppercase text-slate-500">HR Domain</span><select value={section} onChange={(event) => setSection(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-bold outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100">{sections.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
              <label><span className="mb-2 block text-xs font-black uppercase text-slate-500">Permission Level</span><select value={permission} onChange={(event) => setPermission(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-bold outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100">{permissions.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
              <button disabled={busy || !officerId} onClick={() => void assign()} className="min-h-12 self-end rounded-xl bg-gradient-to-r from-violet-700 to-indigo-600 px-6 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 disabled:opacity-50">{busy ? "Assigning..." : "Assign Authority"}</button>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4"><h2 className="text-xl font-black text-slate-950">HR Officer Authority Register</h2><p className="mt-1 text-sm font-semibold text-slate-500">Independent assignments can be suspended or restored without removing other responsibilities.</p></div>
            <div className="hidden overflow-x-auto md:block"><table className="min-w-full text-left text-sm"><thead className="bg-slate-950 text-white"><tr><th className="p-4">Officer</th><th className="p-4">HR Domain</th><th className="p-4">Permission</th><th className="p-4">Status</th><th className="p-4">Action</th></tr></thead><tbody>{assignments.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="p-4 font-black text-slate-900">{names.get(item.officer_id) || item.officer_id}</td><td className="p-4 font-bold">{label(item.section_key)}</td><td className="p-4">{label(item.permission_key)}</td><td className="p-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${item.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{item.is_active ? "Active" : "Suspended"}</span></td><td className="p-4"><button onClick={() => void toggle(item)} className={`rounded-xl px-4 py-2 text-xs font-black text-white ${item.is_active ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>{item.is_active ? "Suspend" : "Restore"}</button></td></tr>)}</tbody></table></div>
            <div className="grid gap-3 p-4 md:hidden">{assignments.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="font-black text-slate-950">{names.get(item.officer_id) || item.officer_id}</p><p className="mt-2 text-sm font-bold text-violet-700">{label(item.section_key)}</p><p className="mt-1 text-sm text-slate-600">{label(item.permission_key)}</p><div className="mt-4 flex items-center justify-between gap-3"><span className={`rounded-full px-3 py-1 text-xs font-black ${item.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{item.is_active ? "Active" : "Suspended"}</span><button onClick={() => void toggle(item)} className={`rounded-xl px-4 py-2 text-xs font-black text-white ${item.is_active ? "bg-rose-600" : "bg-emerald-600"}`}>{item.is_active ? "Suspend" : "Restore"}</button></div></article>)}</div>
          </section>
        </div>
      </main>
    </HRAccessGuard>
  );
}
