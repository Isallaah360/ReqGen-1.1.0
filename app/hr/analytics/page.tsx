"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import HRAccessGuard from "@/app/components/hr/HRAccessGuard";
import { InsightCard, MetricBar } from "@/app/components/hr/HRAnalyticsUI";
import { PrimaryButton, SectionCard, StatCard, StrategicHero, StrategicNavigation, StrategicShell } from "@/app/components/hr/HRStrategicUI";

type Row = Record<string, unknown>;

export default function HRAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, Row[]>>({});
  const [warning, setWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setWarning(null);
    const sources = [
      ["training", "hr_staff_training_programmes", "id,status,approved_cost,estimated_cost"],
      ["department", "hr_department_capacity_programmes", "id,status,approved_cost,estimated_cost"],
      ["kpi", "hr_department_kpis", "id,department_id,target_value,actual_value,status"],
      ["assessment", "hr_assessment_assignments", "id,status"],
      ["seminar", "hr_seminar_attendance", "id,attendance_status,late_minutes"],
    ] as const;
    const results = await Promise.all(sources.map(async ([key, table, select]) => {
      const result = await supabase.from(table).select(select);
      return [key, result.data || [], result.error] as const;
    }));
    const next: Record<string, Row[]> = {};
    const errors: string[] = [];
    results.forEach(([key, rows, error]) => { next[key] = rows as Row[]; if (error) errors.push(error.message); });
    setData(next); if (errors.length) setWarning("Some analytics sources are not yet available to the current role."); setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => {
    const training = data.training || []; const department = data.department || []; const kpi = data.kpi || []; const assessments = data.assessment || []; const seminar = data.seminar || [];
    const completed = [...training, ...department].filter((row) => String(row.status || "").toLowerCase().includes("complete")).length;
    const programmeValue = [...training, ...department].reduce((sum, row) => sum + Number(row.approved_cost || row.estimated_cost || 0), 0);
    const kpiScores = kpi.map((row) => Number(row.target_value || 0) > 0 ? (Number(row.actual_value || 0) / Number(row.target_value || 1)) * 100 : 0);
    const averageKpi = kpiScores.length ? kpiScores.reduce((a, b) => a + b, 0) / kpiScores.length : 0;
    const attended = seminar.filter((row) => !["absent"].includes(String(row.attendance_status || "").toLowerCase())).length;
    const attendanceRate = seminar.length ? (attended / seminar.length) * 100 : 0;
    return { programmes: training.length + department.length, completed, programmeValue, averageKpi, assessments: assessments.length, attendanceRate };
  }, [data]);

  return <HRAccessGuard bossOnly><StrategicShell>
    <StrategicHero eyebrow="HR Performance & Insights" title="HR Executive Analytics" description="A consolidated management view of learning, performance, attendance and assessment outcomes across the IET workforce." action={<PrimaryButton tone="cyan" onClick={() => void load()}>Refresh Intelligence</PrimaryButton>} />
    <StrategicNavigation />
    {warning ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{warning}</div> : null}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <StatCard label="Development Programmes" value={loading ? "—" : stats.programmes} note="Staff and department programmes" tone="blue" />
      <StatCard label="Completed" value={loading ? "—" : stats.completed} note="Closed interventions" tone="emerald" />
      <StatCard label="Programme Value" value={loading ? "—" : new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(stats.programmeValue)} note="Approved and estimated value" tone="violet" />
      <StatCard label="Average KPI" value={loading ? "—" : `${stats.averageKpi.toFixed(1)}%`} note="Achievement across active KPIs" tone="cyan" />
      <StatCard label="360° Assignments" value={loading ? "—" : stats.assessments} note="Assessment participation" tone="amber" />
      <StatCard label="Seminar Attendance" value={loading ? "—" : `${stats.attendanceRate.toFixed(1)}%`} note="Recorded attendance rate" tone="rose" />
    </section>
    <section className="grid gap-6 lg:grid-cols-2">
      <SectionCard title="Performance Portfolio" eyebrow="Visual Intelligence">
        <div className="space-y-4"><MetricBar label="KPI Achievement" value={stats.averageKpi} maximum={100} note="Average target achievement" /><MetricBar label="Weekly Seminar Attendance" value={stats.attendanceRate} maximum={100} note="Participation across captured sessions" /><MetricBar label="Programme Completion" value={stats.programmes ? (stats.completed / stats.programmes) * 100 : 0} maximum={100} note="Completed development interventions" /></div>
      </SectionCard>
      <SectionCard title="Management Insights" eyebrow="Decision Support">
        <div className="grid gap-3"><InsightCard title="Development Coverage" description={`${stats.programmes} strategic development programmes are currently recorded across staff and departments.`} tone="blue" /><InsightCard title="KPI Attention" description={stats.averageKpi < 70 ? "Average KPI achievement is below 70%; management review is recommended." : "Average KPI achievement is within a healthy performance range."} tone={stats.averageKpi < 70 ? "amber" : "emerald"} /><InsightCard title="Attendance Attention" description={stats.attendanceRate < 80 ? "Weekly Seminar attendance is below the expected participation threshold." : "Weekly Seminar participation is currently strong."} tone={stats.attendanceRate < 80 ? "rose" : "emerald"} /></div>
      </SectionCard>
    </section>
  </StrategicShell></HRAccessGuard>;
}
