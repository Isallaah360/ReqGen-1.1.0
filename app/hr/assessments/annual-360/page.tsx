"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { HRAccessGuard } from "@/app/components/hr";
import { EmptyState, PrimaryButton, SectionCard, SelectInput, StatCard, StatusBadge, StrategicHero, StrategicNavigation, StrategicShell, TextInput } from "@/app/components/hr/HRStrategicUI";
import { supabase } from "@/lib/supabaseClient";

type Cycle = { id: string; title: string; cycle_year: number; start_date: string | null; end_date: string | null; status: string; minimum_assessors: number; created_at: string };
type Assignment = { id: string; cycle_id: string; staff_id: string; assessor_id: string; relationship: string; status: string; submitted_at: string | null };
type Profile = { id: string; full_name: string | null; email: string | null };

export default function Annual360Page() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState(`Annual Staff 360° Assessment ${new Date().getFullYear()}`);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minimumAssessors, setMinimumAssessors] = useState("3");

  const load = useCallback(async () => {
    setLoading(true);
    const [cycleResult, assignmentResult, profileResult] = await Promise.all([
      supabase.from("hr_assessment_cycles").select("id,title,cycle_year,start_date,end_date,status,minimum_assessors,created_at").order("cycle_year", { ascending: false }),
      supabase.from("hr_assessment_assignments").select("id,cycle_id,staff_id,assessor_id,relationship,status,submitted_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("profiles").select("id,full_name,email").limit(500),
    ]);
    if (cycleResult.error) setMessage(cycleResult.error.message); else setCycles((cycleResult.data || []) as Cycle[]);
    setAssignments((assignmentResult.data || []) as Assignment[]);
    setProfiles((profileResult.data || []) as Profile[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => ({
    cycles: cycles.length,
    active: cycles.filter((item) => item.status === "active").length,
    assigned: assignments.length,
    submitted: assignments.filter((item) => item.status === "submitted").length,
    pending: assignments.filter((item) => item.status !== "submitted").length,
  }), [cycles, assignments]);

  const profileMap = useMemo(() => new Map(profiles.map((item) => [item.id, item.full_name || item.email || "Unknown user"])), [profiles]);
  const cycleMap = useMemo(() => new Map(cycles.map((item) => [item.id, item.title])), [cycles]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage(null);
    const { error } = await supabase.from("hr_assessment_cycles").insert({ title: title.trim(), cycle_year: Number(year), start_date: startDate || null, end_date: endDate || null, minimum_assessors: Number(minimumAssessors), status: "draft" });
    if (error) setMessage(error.message); else { setShowForm(false); await load(); }
    setSaving(false);
  }

  return (
    <HRAccessGuard section="annual_360_assessment" permission="manage">
      <StrategicShell>
        <StrategicHero eyebrow="Staff Performance & Development" title="Annual Staff 360° Assessment Centre" description="Coordinate controlled multi-source staff assessments, monitor completion, moderate outcomes and convert evidence into development plans and leadership-readiness insights." action={<PrimaryButton tone="violet" onClick={() => setShowForm((value) => !value)}>{showForm ? "Close Form" : "Create Assessment Cycle"}</PrimaryButton>} />
        <StrategicNavigation />
        {message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{message}</div> : null}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Assessment Cycles" value={loading ? "—" : stats.cycles} note="All annual cycles" tone="blue" />
          <StatCard label="Active Cycles" value={loading ? "—" : stats.active} note="Currently open assessments" tone="cyan" />
          <StatCard label="Assigned Reviews" value={loading ? "—" : stats.assigned} note="Assessor assignments issued" tone="violet" />
          <StatCard label="Submitted" value={loading ? "—" : stats.submitted} note="Completed assessments" tone="emerald" />
          <StatCard label="Outstanding" value={loading ? "—" : stats.pending} note="Pending assessment responses" tone="amber" />
        </section>
        {showForm ? <SectionCard title="New Annual Assessment Cycle" eyebrow="Assessment Governance"><form onSubmit={submit} className="grid gap-4 lg:grid-cols-2">
          <TextInput label="Cycle title" value={title} onChange={setTitle} required />
          <TextInput label="Cycle year" type="number" value={year} onChange={setYear} />
          <TextInput label="Opening date" type="date" value={startDate} onChange={setStartDate} />
          <TextInput label="Closing date" type="date" value={endDate} onChange={setEndDate} />
          <TextInput label="Minimum assessors per staff" type="number" value={minimumAssessors} onChange={setMinimumAssessors} />
          <div className="self-end"><PrimaryButton type="submit" tone="emerald" disabled={saving}>{saving ? "Saving..." : "Save Assessment Cycle"}</PrimaryButton></div>
        </form></SectionCard> : null}
        <section className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
          <SectionCard title="Assessment Cycles" eyebrow="Annual Governance">
            {cycles.length === 0 ? <EmptyState title="No assessment cycle created" description="Create the first controlled Annual Staff 360° cycle." /> : <div className="space-y-3">{cycles.map((cycle) => <article key={cycle.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-black text-slate-950">{cycle.title}</p><p className="mt-1 text-xs font-semibold text-slate-500">{cycle.start_date || "TBD"} → {cycle.end_date || "TBD"} · Minimum {cycle.minimum_assessors} assessors</p></div><StatusBadge value={cycle.status} /></div></article>)}</div>}
          </SectionCard>
          <SectionCard title="Assessment Assignment Monitor" eyebrow="Completion Tracking">
            {assignments.length === 0 ? <EmptyState title="No assessor assignments yet" description="Assignments will appear when staff and assessors are allocated to an assessment cycle." /> : <div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50"><tr>{["Cycle", "Staff", "Assessor", "Relationship", "Status"].map((label) => <th key={label} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-600">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 bg-white">{assignments.map((item) => <tr key={item.id}><td className="px-4 py-4 font-semibold text-slate-700">{cycleMap.get(item.cycle_id) || "Unknown cycle"}</td><td className="px-4 py-4 font-black text-slate-900">{profileMap.get(item.staff_id) || "Unknown staff"}</td><td className="px-4 py-4 font-semibold text-slate-700">{profileMap.get(item.assessor_id) || "Unknown assessor"}</td><td className="px-4 py-4 capitalize text-slate-600">{item.relationship.replace(/_/g, " ")}</td><td className="px-4 py-4"><StatusBadge value={item.status} /></td></tr>)}</tbody></table></div>}
          </SectionCard>
        </section>
      </StrategicShell>
    </HRAccessGuard>
  );
}
