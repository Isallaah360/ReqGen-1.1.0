"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, PrimaryButton, SectionCard, StatCard, StrategicHero, StrategicNavigation, StrategicShell } from "@/app/components/hr/HRStrategicUI";
import { supabase } from "@/lib/supabaseClient";

type CountRow = { status?: string | null; category?: string | null; department_id?: string | null; score?: number | string | null };

type DataSet = {
  staffProgrammes: CountRow[];
  departmentProgrammes: CountRow[];
  kpis: CountRow[];
  assessmentCycles: CountRow[];
  assessmentAssignments: CountRow[];
  seminarSessions: CountRow[];
  seminarAttendance: CountRow[];
};

const emptyData: DataSet = { staffProgrammes: [], departmentProgrammes: [], kpis: [], assessmentCycles: [], assessmentAssignments: [], seminarSessions: [], seminarAttendance: [] };

export default function HrReportsPage() {
  const [data, setData] = useState<DataSet>(emptyData);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setMessage(null);
    const results = await Promise.all([
      supabase.from("hr_staff_training_programmes").select("status,category,department_id"),
      supabase.from("hr_department_capacity_programmes").select("status,category,department_id"),
      supabase.from("hr_department_kpis").select("status,department_id,score"),
      supabase.from("hr_assessment_cycles").select("status"),
      supabase.from("hr_assessment_assignments").select("status"),
      supabase.from("hr_seminar_sessions").select("status"),
      supabase.from("hr_seminar_attendance").select("attendance_status:status"),
    ]);
    const firstError = results.find((item) => item.error)?.error;
    if (firstError) setMessage(firstError.message);
    setData({
      staffProgrammes: (results[0].data || []) as CountRow[], departmentProgrammes: (results[1].data || []) as CountRow[], kpis: (results[2].data || []) as CountRow[], assessmentCycles: (results[3].data || []) as CountRow[], assessmentAssignments: (results[4].data || []) as CountRow[], seminarSessions: (results[5].data || []) as CountRow[], seminarAttendance: (results[6].data || []) as CountRow[],
    });
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const analytics = useMemo(() => {
    const trainingTotal = data.staffProgrammes.length + data.departmentProgrammes.length;
    const completedTraining = [...data.staffProgrammes, ...data.departmentProgrammes].filter((row) => (row.status || "").includes("complete")).length;
    const avgKpi = data.kpis.length ? data.kpis.reduce((sum, row) => sum + Number(row.score || 0), 0) / data.kpis.length : 0;
    const assessmentsSubmitted = data.assessmentAssignments.filter((row) => row.status === "submitted").length;
    const present = data.seminarAttendance.filter((row) => ["on_time", "late", "very_late", "present"].includes(row.status || "")).length;
    const attendanceRate = data.seminarAttendance.length ? (present / data.seminarAttendance.length) * 100 : 0;
    return { trainingTotal, completedTraining, avgKpi, assessmentsSubmitted, attendanceRate };
  }, [data]);

  const exportSummary = () => {
    const rows = [
      ["Metric", "Value"], ["Staff training programmes", String(data.staffProgrammes.length)], ["Department capacity programmes", String(data.departmentProgrammes.length)], ["Department KPIs", String(data.kpis.length)], ["Average KPI score", analytics.avgKpi.toFixed(1)], ["Assessment cycles", String(data.assessmentCycles.length)], ["Submitted assessments", String(analytics.assessmentsSubmitted)], ["Seminar sessions", String(data.seminarSessions.length)], ["Seminar attendance rate", analytics.attendanceRate.toFixed(1)],
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `hr-strategic-summary-${new Date().toISOString().slice(0,10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <StrategicShell>
        <StrategicHero eyebrow="HR Decision Intelligence" title="HR Reports & Analytics Centre" description="Consolidated management intelligence covering capacity building, departmental performance, annual assessments and Wednesday seminar participation." action={<div className="flex flex-wrap gap-2"><PrimaryButton tone="cyan" onClick={() => void load()}>Refresh Reports</PrimaryButton><PrimaryButton tone="emerald" onClick={exportSummary}>Export Summary</PrimaryButton><PrimaryButton tone="violet" onClick={() => window.open('/output?report=hr_staff', '_blank', 'noopener,noreferrer')}>Print Report</PrimaryButton></div>} />
        <StrategicNavigation />
        {message ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">Some data sources could not be loaded: {message}</div> : null}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Development Programmes" value={loading ? "—" : analytics.trainingTotal} note="Staff and department programmes" tone="blue" />
          <StatCard label="Completed Programmes" value={loading ? "—" : analytics.completedTraining} note="Closed learning interventions" tone="emerald" />
          <StatCard label="Average KPI Score" value={loading ? "—" : `${analytics.avgKpi.toFixed(1)}%`} note="Department performance average" tone="violet" />
          <StatCard label="360° Submissions" value={loading ? "—" : analytics.assessmentsSubmitted} note="Completed assessor responses" tone="cyan" />
          <StatCard label="Seminar Attendance" value={loading ? "—" : `${analytics.attendanceRate.toFixed(1)}%`} note="Recorded participation rate" tone="amber" />
        </section>
        <section className="grid gap-5 xl:grid-cols-2">
          <SectionCard title="Strategic HR Portfolio" eyebrow="Programme Distribution">
            <div className="space-y-4">
              {[
                ["Staff Capacity Building", data.staffProgrammes.length, "bg-violet-600"], ["Department Capacity Building", data.departmentProgrammes.length, "bg-cyan-600"], ["Department KPIs", data.kpis.length, "bg-blue-600"], ["Assessment Cycles", data.assessmentCycles.length, "bg-emerald-600"], ["Weekly Seminar Sessions", data.seminarSessions.length, "bg-orange-500"],
              ].map(([label, value, color]) => <div key={String(label)}><div className="mb-2 flex items-center justify-between"><span className="text-sm font-black text-slate-800">{label}</span><span className="text-sm font-black text-slate-950">{value}</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(6, Number(value) * 8))}%` }} /></div></div>)}
            </div>
          </SectionCard>
          <SectionCard title="Management Attention" eyebrow="Decision Support">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Programmes awaiting completion", analytics.trainingTotal - analytics.completedTraining, "border-amber-200 bg-amber-50 text-amber-900"], ["KPI indicators below 70%", data.kpis.filter((row) => Number(row.score || 0) < 70).length, "border-rose-200 bg-rose-50 text-rose-900"], ["Outstanding 360° responses", Math.max(0, data.assessmentAssignments.length - analytics.assessmentsSubmitted), "border-violet-200 bg-violet-50 text-violet-900"], ["Seminar attendance records", data.seminarAttendance.length, "border-blue-200 bg-blue-50 text-blue-900"],
              ].map(([label, value, style]) => <article key={String(label)} className={`rounded-2xl border p-4 ${style}`}><p className="text-xs font-black uppercase tracking-wide">{label}</p><p className="mt-3 text-3xl font-black">{value}</p></article>)}
            </div>
          </SectionCard>
        </section>
        {analytics.trainingTotal === 0 && data.kpis.length === 0 && data.assessmentCycles.length === 0 ? <EmptyState title="No strategic HR records yet" description="Create programmes, KPI records and assessment cycles to populate HR decision intelligence." /> : null}
      </StrategicShell>
    </>
  );
}
