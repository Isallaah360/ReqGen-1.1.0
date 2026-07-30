"use client";
import Link from "next/link";
import { HRAccessGuard, HRNavigation } from "@/app/components/hr";

const modules = [
  ["Officer Assignment Centre", "Assign multiple HR roles and permissions to officers.", "/hr/assignments", "bg-violet-600"],
  ["Registrar Centre", "Control staff records, file movement and archive operations.", "/hr/registrar", "bg-blue-700"],
  ["HR Filing Centre", "Review summarized HR-bound requests and filing stages.", "/hr/filing", "bg-emerald-600"],
  ["Wednesday Weekly Seminar", "Attendance, punctuality and institutional participation analytics.", "/hr/weekly-seminar", "bg-orange-600"],
  ["Staff Capacity Building", "Training needs, programmes, completion and impact.", "/hr/capacity-building/staff", "bg-cyan-600"],
  ["Department Capacity Building", "Departmental gaps, interventions and improvement plans.", "/hr/capacity-building/departments", "bg-indigo-600"],
  ["Department KPI", "Department performance indicators, targets and evidence.", "/hr/department-kpi", "bg-fuchsia-600"],
  ["Annual Staff 360° Assessment", "Controlled multi-source staff performance assessment.", "/hr/assessments/annual-360", "bg-rose-600"],
];

export default function HRBossDashboard() {
  return <HRAccessGuard bossOnly><main className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8"><div className="mx-auto max-w-7xl space-y-6">
    <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-800 p-8 text-white shadow-2xl">
      <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">Restricted Directorate Workspace</p>
      <h1 className="mt-3 text-3xl font-black lg:text-5xl">HR Directorate Command Centre</h1>
      <p className="mt-4 max-w-3xl text-sm font-semibold text-blue-100 lg:text-base">Strictly reserved for the HR Boss and Admin. HR Officers gain only the operational sections and actions explicitly assigned to them.</p>
    </section>
    <HRNavigation />
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{modules.map(([title, desc, href, color]) => <article key={href} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`h-2 rounded-full ${color}`} /><h2 className="mt-5 text-lg font-black text-slate-950">{title}</h2><p className="mt-2 min-h-16 text-sm font-medium leading-6 text-slate-600">{desc}</p><Link href={href} className={`mt-5 inline-flex rounded-xl px-4 py-3 text-sm font-extrabold text-white shadow-sm ${color}`}>Open Centre</Link></article>)}</section>
    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-black text-amber-950">Mandatory HR review chain</h2><p className="mt-2 text-sm font-semibold text-amber-900">HR Officer → HR Boss review → DG. Assigned officers process and recommend; the official HR position remains with the HR Boss unless Admin changes the governance policy.</p></section>
  </div></main></HRAccessGuard>;
}
