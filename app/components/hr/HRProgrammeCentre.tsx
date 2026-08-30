"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import HRAccessGuard from "./HRAccessGuard";
import {
  EmptyState,
  PrimaryButton,
  SectionCard,
  SelectInput,
  StatCard,
  StatusBadge,
  StrategicHero,
  StrategicNavigation,
  StrategicShell,
  TextInput,
  type Tone,
} from "./HRStrategicUI";

type ProgrammeRow = {
  id: string;
  title: string;
  category: string | null;
  department_id: string | null;
  provider: string | null;
  venue: string | null;
  start_date: string | null;
  end_date: string | null;
  estimated_cost: number | string | null;
  approved_cost: number | string | null;
  status: string | null;
  objectives: string | null;
  created_at: string;
};

type Department = { id: string; name: string };

export type ProgrammeCentreConfig = {
  sectionKey: string;
  table: string;
  eyebrow: string;
  title: string;
  description: string;
  singular: string;
  tone: Tone;
  departmentRequired: boolean;
  categories: string[];
};

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(Number(value || 0));
}

export default function HRProgrammeCentre({ config }: { config: ProgrammeCentreConfig }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<ProgrammeRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(config.categories[0] || "General");
  const [departmentId, setDepartmentId] = useState("");
  const [provider, setProvider] = useState("");
  const [venue, setVenue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [objectives, setObjectives] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [programmeResult, departmentResult] = await Promise.all([
      supabase.from(config.table).select("id,title,category,department_id,provider,venue,start_date,end_date,estimated_cost,approved_cost,status,objectives,created_at").order("created_at", { ascending: false }),
      supabase.from("departments").select("id,name").eq("is_active", true).order("name"),
    ]);
    if (programmeResult.error) setMessage(programmeResult.error.message);
    else setRows((programmeResult.data || []) as ProgrammeRow[]);
    setDepartments((departmentResult.data || []) as Department[]);
    setLoading(false);
  }, [config.table]);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  const stats = useMemo(() => ({
    total: rows.length,
    active: rows.filter((row) => ["approved", "in_progress", "active"].includes((row.status || "").toLowerCase())).length,
    pending: rows.filter((row) => ["draft", "submitted", "pending_review", "pending_approval"].includes((row.status || "draft").toLowerCase())).length,
    completed: rows.filter((row) => (row.status || "").toLowerCase().includes("complete")).length,
    budget: rows.reduce((sum, row) => sum + Number(row.approved_cost || row.estimated_cost || 0), 0),
  }), [rows]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from(config.table).insert({
      title: title.trim(),
      category,
      department_id: departmentId || null,
      provider: provider.trim() || null,
      venue: venue.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
      estimated_cost: Number(estimatedCost || 0),
      objectives: objectives.trim() || null,
      status: "draft",
    });
    if (error) setMessage(error.message);
    else {
      setTitle(""); setProvider(""); setVenue(""); setStartDate(""); setEndDate(""); setEstimatedCost(""); setObjectives(""); setDepartmentId("");
      setShowForm(false);
      await load();
    }
    setSaving(false);
  }

  return (
    <HRAccessGuard section={config.sectionKey} permission="process">
      <StrategicShell>
        <StrategicHero
          eyebrow={config.eyebrow}
          title={config.title}
          description={config.description}
          action={<PrimaryButton tone={config.tone} onClick={() => setShowForm((value) => !value)}>{showForm ? "Close Form" : `Create ${config.singular}`}</PrimaryButton>}
        />
        <StrategicNavigation />
        {message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{message}</div> : null}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total Programmes" value={loading ? "—" : stats.total} note="All registered programmes" tone="blue" />
          <StatCard label="Active" value={loading ? "—" : stats.active} note="Approved or in progress" tone="cyan" />
          <StatCard label="Pending" value={loading ? "—" : stats.pending} note="Awaiting review or approval" tone="amber" />
          <StatCard label="Completed" value={loading ? "—" : stats.completed} note="Closed development activities" tone="emerald" />
          <StatCard label="Programme Value" value={loading ? "—" : money(stats.budget)} note="Estimated and approved value" tone="violet" />
        </section>

        {showForm ? (
          <SectionCard title={`New ${config.singular}`} eyebrow="Programme Registration">
            <form onSubmit={submit} className="grid gap-4 lg:grid-cols-2">
              <TextInput label="Programme title" value={title} onChange={setTitle} required />
              <SelectInput label="Category" value={category} onChange={setCategory} options={config.categories.map((item) => ({ value: item, label: item }))} />
              <SelectInput label="Department" value={departmentId} onChange={setDepartmentId} options={[{ value: "", label: config.departmentRequired ? "Select department" : "Institution-wide / Not specified" }, ...departments.map((item) => ({ value: item.id, label: item.name }))]} />
              <TextInput label="Training provider / facilitator" value={provider} onChange={setProvider} />
              <TextInput label="Venue / platform" value={venue} onChange={setVenue} />
              <TextInput label="Estimated cost" type="number" value={estimatedCost} onChange={setEstimatedCost} />
              <TextInput label="Start date" type="date" value={startDate} onChange={setStartDate} />
              <TextInput label="End date" type="date" value={endDate} onChange={setEndDate} />
              <label className="lg:col-span-2">
                <span className="text-sm font-black text-slate-800">Objectives and expected outcomes</span>
                <textarea value={objectives} onChange={(event) => setObjectives(event.target.value)} className="mt-2 min-h-28 w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
              </label>
              <div className="lg:col-span-2"><PrimaryButton type="submit" tone="emerald" disabled={saving}>{saving ? "Saving..." : `Save ${config.singular}`}</PrimaryButton></div>
            </form>
          </SectionCard>
        ) : null}

        <SectionCard title="Programme Register" eyebrow="Learning & Development Portfolio" action={<PrimaryButton tone="cyan" onClick={() => void load()}>Refresh Data</PrimaryButton>}>
          {rows.length === 0 ? <EmptyState title="No programmes registered" description={`Create the first ${config.singular.toLowerCase()} to begin structured HR development tracking.`} /> : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50"><tr>{["Programme", "Category", "Schedule", "Provider", "Cost", "Status"].map((label) => <th key={label} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-600">{label}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.map((row) => <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4"><p className="font-black text-slate-950">{row.title}</p><p className="mt-1 max-w-sm truncate text-xs font-semibold text-slate-500">{row.objectives || "No objectives recorded"}</p></td>
                    <td className="px-4 py-4 font-semibold text-slate-700">{row.category || "General"}</td>
                    <td className="px-4 py-4 text-xs font-bold text-slate-600">{row.start_date || "TBD"}{row.end_date ? ` → ${row.end_date}` : ""}</td>
                    <td className="px-4 py-4 font-semibold text-slate-700">{row.provider || row.venue || "Not assigned"}</td>
                    <td className="px-4 py-4 font-black text-slate-900">{money(row.approved_cost || row.estimated_cost)}</td>
                    <td className="px-4 py-4"><StatusBadge>{row.status || "Unknown"}</StatusBadge></td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </StrategicShell>
    </HRAccessGuard>
  );
}
