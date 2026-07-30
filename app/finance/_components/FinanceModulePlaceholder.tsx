"use client";

import Link from "next/link";

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  phase: string;
};

export default function FinanceModulePlaceholder({ eyebrow, title, description, phase }: Props) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-7 text-white shadow-2xl sm:p-10">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-slate-200">{description}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/finance" className="reqgen-btn reqgen-btn-blue rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15">
            Finance Control Centre
          </Link>
          <span className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-slate-950">{phase}</span>
        </div>
      </section>

      <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-blue-100 bg-white p-7 shadow-sm sm:p-10">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Module Route Activated</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">This page is ready for its full implementation phase.</h2>
        <p className="mt-3 max-w-3xl font-semibold leading-7 text-slate-600">
          Navigation is active and no longer returns a missing-page error. The complete operational workflow, database queries, permissions, reports and exports will be added during the scheduled phase.
        </p>
      </section>
    </main>
  );
}
