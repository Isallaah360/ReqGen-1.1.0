"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  ClipboardCheck,
  FileOutput,
  Gauge,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
  UsersRound,
  UserRoundCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Metric = {
  label: string;
  value: number;
  note: string;
  icon: LucideIcon;
  tone: string;
  href: string;
};

type SourceCount = {
  value: number;
  available: boolean;
};

const ZERO: SourceCount = { value: 0, available: false };

async function countSource(table: string, filters?: Array<[string, string | number | boolean]>) {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  for (const [column, value] of filters || []) query = query.eq(column, value);
  const result = await query;
  if (result.error) return ZERO;
  return { value: result.count || 0, available: true };
}

export default function RegistrarGovernanceOverview() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [coverage, setCoverage] = useState(0);
  const [counts, setCounts] = useState({
    programmes: 0,
    departmentProgrammes: 0,
    seminars: 0,
    kpis: 0,
    assessments: 0,
    assignments: 0,
    audit: 0,
    compliance: 0,
  });

  const load = useCallback(async (manual = false) => {
    if (manual) { setRefreshing(true); } else { setLoading(true); }
    const results = await Promise.all([
      countSource("hr_staff_training_programmes"),
      countSource("hr_department_capacity_programmes"),
      countSource("hr_seminar_sessions"),
      countSource("hr_department_kpis"),
      countSource("hr_assessment_cycles"),
      countSource("hr_request_assignments"),
      countSource("hr_assignment_history"),
      countSource("hr_compliance_events"),
    ]);

    setCounts({
      programmes: results[0].value,
      departmentProgrammes: results[1].value,
      seminars: results[2].value,
      kpis: results[3].value,
      assessments: results[4].value,
      assignments: results[5].value,
      audit: results[6].value,
      compliance: results[7].value,
    });
    setCoverage(results.filter((item) => item.available).length);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("registrar-governance-overview")
      .on("postgres_changes", { event: "*", schema: "public", table: "hr_request_assignments" }, () => void load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "hr_seminar_sessions" }, () => void load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "hr_department_kpis" }, () => void load(true))
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const metrics = useMemo<Metric[]>(
    () => [
      {
        label: "Officer Workload",
        value: counts.assignments,
        note: "Delegated HR assignments",
        icon: UserRoundCheck,
        tone: "from-blue-700 to-indigo-900",
        href: "/hr/registrar/officer-performance",
      },
      {
        label: "Staff Capacity",
        value: counts.programmes,
        note: "Learning programmes",
        icon: GraduationCap,
        tone: "from-violet-600 to-fuchsia-800",
        href: "/hr/registrar/capacity-building/staff",
      },
      {
        label: "Department Capacity",
        value: counts.departmentProgrammes,
        note: "Institutional improvement programmes",
        icon: UsersRound,
        tone: "from-cyan-600 to-blue-800",
        href: "/hr/registrar/capacity-building/departments",
      },
      {
        label: "Weekly Seminar",
        value: counts.seminars,
        note: "Recorded seminar sessions",
        icon: BookOpenCheck,
        tone: "from-emerald-600 to-teal-800",
        href: "/hr/registrar/weekly-seminar",
      },
      {
        label: "Department KPI",
        value: counts.kpis,
        note: "Performance indicators",
        icon: Gauge,
        tone: "from-amber-500 to-orange-700",
        href: "/hr/registrar/department-kpi",
      },
      {
        label: "Annual 360°",
        value: counts.assessments,
        note: "Assessment cycles",
        icon: Activity,
        tone: "from-rose-600 to-red-800",
        href: "/hr/registrar/assessments/annual-360",
      },
      {
        label: "Audit Evidence",
        value: counts.audit,
        note: "Authority and activity events",
        icon: ShieldCheck,
        tone: "from-slate-700 to-slate-950",
        href: "/hr/audit",
      },
      {
        label: "Compliance Events",
        value: counts.compliance,
        note: "Controls and exceptions",
        icon: ClipboardCheck,
        tone: "from-teal-600 to-cyan-800",
        href: "/hr/registrar/compliance",
      },
    ],
    [counts]
  );

  return (
    <section className="space-y-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-700">Live Governance Intelligence</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">Registrar Governance Command View</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
            A live summary of strategic HR administration, workforce development, performance governance, compliance and controlled output.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-800 ring-1 ring-cyan-200">
            {coverage}/8 sources connected
          </span>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh Intelligence"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, note, icon: Icon, tone, href }) => (
          <Link
            key={label}
            href={href}
            className={`group rounded-3xl bg-gradient-to-br ${tone} p-5 text-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/75">{label}</p>
                <p className="mt-3 text-3xl font-black text-white">{loading ? "—" : value}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-white/75">{note}</p>
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                <Icon className="h-6 w-6 text-white" />
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/hr/registrar/analytics" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-blue-800">
          <BarChart3 className="h-5 w-5" /> Open HR Analytics
        </Link>
        <Link href="/hr/registrar/reports" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-violet-800">
          <ClipboardCheck className="h-5 w-5" /> Management Reports
        </Link>
        <Link href="/hr/registrar/output" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-emerald-800">
          <FileOutput className="h-5 w-5" /> Print & Output Centre
        </Link>
      </div>
    </section>
  );
}
