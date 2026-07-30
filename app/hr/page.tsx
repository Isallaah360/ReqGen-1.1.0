"use client";

import Link from "next/link";
import { HRAccessGuard, HRNavigation } from "@/app/components/hr";

type HRModule = {
  title: string;
  description: string;
  href?: string;
  tone: string;
  status?: "available" | "planned";
};

const operationalModules: HRModule[] = [
  {
    title: "Officer Assignment Centre",
    description: "Assign multiple HR functions and permission levels to HR Officers.",
    href: "/hr/assignments",
    tone: "bg-violet-600 hover:bg-violet-700",
  },
  {
    title: "My HR Work",
    description: "View officer assignments, active tasks, returned work and completed submissions.",
    href: "/hr/my-work",
    tone: "bg-cyan-600 hover:bg-cyan-700",
  },
  {
    title: "HR Boss Review",
    description: "Review officer recommendations, return corrections and finalize the HR position.",
    href: "/hr/review",
    tone: "bg-amber-600 hover:bg-amber-700",
  },
  {
    title: "HR Filing Centre",
    description: "Monitor HR-bound requests, filing stages and official workflow movement.",
    href: "/hr/filing",
    tone: "bg-emerald-600 hover:bg-emerald-700",
  },
  {
    title: "Staff Files",
    description: "Open the staff-related filing and personnel workflow workspace.",
    href: "/hr/staff",
    tone: "bg-blue-600 hover:bg-blue-700",
  },
  {
    title: "Leave Records",
    description: "Review leave-related HR records and their current workflow status.",
    href: "/hr/leave",
    tone: "bg-teal-600 hover:bg-teal-700",
  },
  {
    title: "HR Archive",
    description: "Access completed, closed and archived HR workflow records.",
    href: "/hr/archive",
    tone: "bg-indigo-600 hover:bg-indigo-700",
  },
  {
    title: "Registrar Centre",
    description: "Control staff records, file movement, classification and archive operations.",
    href: "/hr/registrar",
    tone: "bg-blue-800 hover:bg-blue-900",
  },
  {
    title: "HR Audit Trail",
    description: "Review assignment, delegation, decision and HR workflow activity history.",
    href: "/hr/audit",
    tone: "bg-slate-700 hover:bg-slate-800",
  },
];

const plannedModules: HRModule[] = [
  {
    title: "Wednesday Weekly Seminar",
    description: "Attendance, punctuality, departmental participation and staff analysis.",
    tone: "bg-orange-600",
    status: "planned",
  },
  {
    title: "Staff Capacity Building",
    description: "Training needs, programmes, attendance, completion and impact measurement.",
    tone: "bg-sky-600",
    status: "planned",
  },
  {
    title: "Department Capacity Building",
    description: "Departmental gaps, interventions, improvement plans and impact assessment.",
    tone: "bg-indigo-600",
    status: "planned",
  },
  {
    title: "Department KPI",
    description: "Performance indicators, targets, evidence, scoring and corrective actions.",
    tone: "bg-fuchsia-600",
    status: "planned",
  },
  {
    title: "Annual Staff 360° Assessment",
    description: "Controlled multi-source staff assessment, moderation and development planning.",
    tone: "bg-rose-600",
    status: "planned",
  },
];

function ModuleCard({ module }: { module: HRModule }) {
  const content = (
    <>
      <div className={`h-2 rounded-full ${module.tone.split(" ")[0]}`} />
      <div className="mt-5 flex items-start justify-between gap-3">
        <h2 className="text-lg font-black text-slate-950">{module.title}</h2>
        {module.status === "planned" && (
          <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-amber-800">
            Planned
          </span>
        )}
      </div>
      <p className="mt-2 min-h-16 text-sm font-medium leading-6 text-slate-600">
        {module.description}
      </p>
      {module.href ? (
        <span className={`mt-5 inline-flex rounded-xl px-4 py-3 text-sm font-extrabold text-white shadow-sm transition ${module.tone}`}>
          Open Centre
        </span>
      ) : (
        <span className="mt-5 inline-flex rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-extrabold text-slate-500">
          Captured for Development
        </span>
      )}
    </>
  );

  if (!module.href) {
    return <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">{content}</article>;
  }

  return (
    <Link
      href={module.href}
      className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-cyan-300 hover:shadow-xl"
    >
      {content}
    </Link>
  );
}

export default function HRBossDashboard() {
  return (
    <HRAccessGuard bossOnly>
      <main className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-800 p-8 text-white shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-200">
              Restricted Directorate Workspace
            </p>
            <h1 className="mt-3 text-3xl font-black lg:text-5xl">HR Directorate Command Centre</h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold text-blue-100 lg:text-base">
              The single centralized entrance to all HR functions. This command centre is reserved for the HR Boss and Admin; HR Officers receive only assigned operational access.
            </p>
          </section>

          <HRNavigation />

          <section>
            <div className="mb-4">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-700">Operational Workspaces</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">Available HR Functions</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {operationalModules.map((module) => <ModuleCard key={module.title} module={module} />)}
            </div>
          </section>

          <section>
            <div className="mb-4">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-700">Approved HR Roadmap</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">Captured for Proper Development</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {plannedModules.map((module) => <ModuleCard key={module.title} module={module} />)}
            </div>
          </section>

          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="font-black text-amber-950">Mandatory HR review chain</h2>
            <p className="mt-2 text-sm font-semibold text-amber-900">
              HR Officer → HR Boss review → DG. Assigned officers process and recommend; the official HR position remains with the HR Boss unless Admin changes the governance policy.
            </p>
          </section>
        </div>
      </main>
    </HRAccessGuard>
  );
}
