"use client";

import Link from "next/link";

export default function FinanceHome() {
  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-5xl py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Finance</h1>
            <p className="mt-2 text-sm text-slate-600">
              Manage departments, subheads, allocations, accounts and finance reports.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card title="Departments" desc="Create, edit and delete departments." href="/finance/departments" />
          <Card title="Subheads" desc="Create subheads, assign to departments and allocate budgets." href="/finance/subheads" />
          <Card title="Manage Accounts" desc="Create IET bank accounts and assign them to Accounting Officers." href="/finance/manage-accounts" />
          <Card title="Reports" desc="Mini government finance dashboard (budget / expenditure / balance)." href="/finance/reports" />
        </div>
      </div>
    </main>
  );
}

function Card({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <Link href={href} className="rounded-2xl border bg-white p-6 shadow-sm hover:bg-slate-50 transition">
      <div className="text-lg font-bold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-600">{desc}</div>
      <div className="mt-3 text-sm font-semibold text-blue-700">Open →</div>
    </Link>
  );
}