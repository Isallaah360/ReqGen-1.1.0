"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, PrimaryButton, SectionCard, SelectInput, StatCard, StatusBadge, StrategicHero, StrategicNavigation, StrategicShell, TextInput } from "@/app/components/hr/HRStrategicUI";
import { supabase } from "@/lib/supabaseClient";

type Department = { id: string; name: string };
type Kpi = { id: string; department_id: string; title: string; cycle_year: number; period: string; unit: string; weight: number | string; target_value: number | string; actual_value: number | string; score: number | string | null; status: string; created_at: string };

function percent(value: number | string | null | undefined) { return `${Math.round(Number(value || 0))}%`; }

export default function DepartmentKpiPage() {
  const [rows, setRows] = useState<Kpi[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [departmentId, setDepartmentId] = useState("");
  const [title, setTitle] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [period, setPeriod] = useState("Annual");
  const [unit, setUnit] = useState("Percentage");
  const [weight, setWeight] = useState("10");
  const [target, setTarget] = useState("100");

  const load = useCallback(async () => {
    setLoading(true);
    const [kpiResult, deptResult] = await Promise.all([
      supabase.from("hr_department_kpis").select("id,department_id,title,cycle_year,period,unit,weight,target_value,actual_value,score,status,created_at").order("created_at", { ascending: false }),
      supabase.from("departments").select("id,name").eq("is_active", true).order("name"),
    ]);
    if (kpiResult.error) setMessage(kpiResult.error.message); else setRows((kpiResult.data || []) as Kpi[]);
    setDepartments((deptResult.data || []) as Department[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const deptMap = useMemo(() => new Map(departments.map((item) => [item.id, item.name])), [departments]);
  const stats = useMemo(() => ({
    total: rows.length,
    departments: new Set(rows.map((row) => row.department_id)).size,
    approved: rows.filter((row) => row.status === "approved").length,
    underTarget: rows.filter((row) => Number(row.actual_value || 0) < Number(row.target_value || 0)).length,
    average: rows.length ? rows.reduce((sum, row) => sum + Number(row.score || 0), 0) / rows.length : 0,
  }), [rows]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage(null);
    const { error } = await supabase.from("hr_department_kpis").insert({ department_id: departmentId, title: title.trim(), cycle_year: Number(year), period, unit, weight: Number(weight), target_value: Number(target), actual_value: 0, status: "draft" });
    if (error) setMessage(error.message); else { setTitle(""); setDepartmentId(""); setShowForm(false); await load(); }
    setSaving(false);
  }

  return (
    <>
      <StrategicShell>
        <StrategicHero eyebrow="Performance Management" title="Department KPI Centre" description="Define measurable departmental targets, review supporting evidence, track weighted performance and identify areas requiring corrective action." action={<PrimaryButton tone="violet" onClick={() => setShowForm((value) => !value)}>{showForm ? "Close Form" : "Create KPI"}</PrimaryButton>} />
        <StrategicNavigation />
        {message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{message}</div> : null}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="KPI Records" value={loading ? "—" : stats.total} note="All configured indicators" tone="blue" />
          <StatCard label="Departments" value={loading ? "—" : stats.departments} note="Departments with KPI records" tone="cyan" />
          <StatCard label="Approved" value={loading ? "—" : stats.approved} note="Validated KPI definitions" tone="emerald" />
          <StatCard label="Below Target" value={loading ? "—" : stats.underTarget} note="Indicators requiring attention" tone="rose" />
          <StatCard label="Average Score" value={loading ? "—" : percent(stats.average)} note="Combined KPI performance" tone="violet" />
        </section>
        {showForm ? <SectionCard title="New Department KPI" eyebrow="KPI Definition"><form onSubmit={submit} className="grid gap-4 lg:grid-cols-2">
          <SelectInput label="Department" value={departmentId} onChange={setDepartmentId} options={[{ value: "", label: "Select department" }, ...departments.map((item) => ({ value: item.id, label: item.name }))]} />
          <TextInput label="KPI title" value={title} onChange={setTitle} required />
          <TextInput label="Cycle year" type="number" value={year} onChange={setYear} />
          <SelectInput label="Period" value={period} onChange={setPeriod} options={["Monthly", "Quarterly", "Annual"].map((item) => ({ value: item, label: item }))} />
          <SelectInput label="Measurement unit" value={unit} onChange={setUnit} options={["Percentage", "Count", "Days", "Hours", "Currency", "Score"].map((item) => ({ value: item, label: item }))} />
          <TextInput label="Weight (%)" type="number" value={weight} onChange={setWeight} />
          <TextInput label="Target value" type="number" value={target} onChange={setTarget} />
          <div className="self-end"><PrimaryButton type="submit" tone="emerald" disabled={saving}>{saving ? "Saving..." : "Save KPI"}</PrimaryButton></div>
        </form></SectionCard> : null}
        <SectionCard title="Department KPI Register" eyebrow="Performance Portfolio" action={<PrimaryButton tone="cyan" onClick={() => void load()}>Refresh Data</PrimaryButton>}>
          {rows.length === 0 ? <EmptyState title="No KPI records configured" description="Create departmental indicators to begin performance measurement and evidence-based review." /> : <div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50"><tr>{["Department", "KPI", "Cycle", "Weight", "Target", "Actual", "Score", "Status"].map((label) => <th key={label} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-600">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 bg-white">{rows.map((row) => <tr key={row.id} className="hover:bg-slate-50"><td className="px-4 py-4 font-black text-slate-900">{deptMap.get(row.department_id) || "Unknown"}</td><td className="px-4 py-4 font-semibold text-slate-800">{row.title}</td><td className="px-4 py-4 text-slate-600">{row.period} {row.cycle_year}</td><td className="px-4 py-4 font-black text-slate-900">{percent(row.weight)}</td><td className="px-4 py-4 font-semibold">{row.target_value}</td><td className="px-4 py-4 font-semibold">{row.actual_value}</td><td className="px-4 py-4 font-black text-blue-700">{percent(row.score)}</td><td className="px-4 py-4"><StatusBadge>{row.status || "Unknown"}</StatusBadge></td></tr>)}</tbody></table></div>}
        </SectionCard>
      </StrategicShell>
    </>
  );
}
