"use client";

import { HRAccessGuard, HRNavigation } from "@/app/components/hr";

const plannedModules = [
  {
    title: "Wednesday Weekly Seminar",
    description: "Attendance, punctuality, participation trends and institutional learning records.",
    accent: "from-orange-500 to-amber-500",
    icon: "W",
  },
  {
    title: "Staff Capacity Building",
    description: "Training needs, programmes, certification, completion and development impact.",
    accent: "from-cyan-500 to-blue-500",
    icon: "S",
  },
  {
    title: "Department Capacity Building",
    description: "Departmental gaps, interventions, improvement plans and reassessment.",
    accent: "from-indigo-500 to-violet-500",
    icon: "D",
  },
  {
    title: "Department KPI",
    description: "Targets, evidence, weighted performance scores and corrective actions.",
    accent: "from-fuchsia-500 to-purple-500",
    icon: "K",
  },
  {
    title: "Annual Staff 360° Assessment",
    description: "Controlled multi-source assessment, moderation and staff development planning.",
    accent: "from-rose-500 to-red-500",
    icon: "360°",
  },
];

export default function HRBossDashboard() {
  return (
    <HRAccessGuard bossOnly>
      <main className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-[1500px] space-y-6">
          <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-800 p-8 text-white shadow-2xl lg:p-10">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
            <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">Restricted Directorate Workspace</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight lg:text-5xl">HR Directorate Command Centre</h1>
              <p className="mt-4 max-w-4xl text-sm font-semibold leading-7 text-blue-100 lg:text-base">
                The centralized entrance to HR governance, officer delegation, personnel filing, registrar operations,
                staff development and performance intelligence. HR Officers receive only explicitly assigned access.
              </p>
            </div>
          </section>

          <HRNavigation />

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] lg:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-700">Captured for Development</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Strategic HR Functions</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Approved HR domains reserved for the next implementation stages.</p>
              </div>
              <span className="w-fit rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-amber-800">Planned Modules</span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {plannedModules.map((module) => (
                <article key={module.title} className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-1 hover:border-blue-200 hover:bg-white hover:shadow-xl">
                  <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${module.accent}`} />
                  <div className={`mt-2 grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${module.accent} text-xs font-black text-white shadow-lg`}>
                    {module.icon}
                  </div>
                  <h3 className="mt-4 text-sm font-black uppercase leading-tight tracking-wide text-slate-950">{module.title}</h3>
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{module.description}</p>
                  <span className="mt-4 inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700">Planned</span>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-6 shadow-sm">
            <h2 className="font-black uppercase tracking-wide text-amber-950">Mandatory HR Review Chain</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-amber-900">
              HR Officer → HR Boss Review → DG. Assigned officers process and recommend; the official HR position remains with the HR Boss unless Admin changes the governance policy.
            </p>
          </section>
        </div>
      </main>
    </HRAccessGuard>
  );
}
