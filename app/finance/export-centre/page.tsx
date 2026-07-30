"use client";

import Link from "next/link";
import { useState } from "react";
import { FinanceCard, FinancePageFrame, MetricCard, PrimaryButton, StatusPill } from "../_components/FinancePageFrame";

export default function ExportCentrePage() {
  const [format, setFormat] = useState("Excel Workbook");
  const [dataset, setDataset] = useState("Transactions Register");
  const [busy, setBusy] = useState(false);

  function beginExport() {
    setBusy(true);
    window.setTimeout(() => setBusy(false), 900);
  }

  return (
    <FinancePageFrame eyebrow="Finance Output" title="Export Centre" description="Package Finance Control Centre records into clear, structured files for analysis, audit and management review." icon="📤" tone="emerald" badge="Controlled Export">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Primary format" value="Excel" icon="📗" tone="emerald" helper="Structured workbook output" />
        <MetricCard label="Alternative" value="CSV" icon="📑" tone="cyan" helper="Portable raw records" />
        <MetricCard label="Coverage" value="Finance-wide" icon="🗃️" tone="violet" helper="Registers, ledgers and reports" />
        <MetricCard label="Control" value="Auditable" icon="🛡️" tone="blue" helper="Export activity can be traced" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[.72fr_1fr]">
        <FinanceCard>
          <p className="text-xs font-black uppercase tracking-[0.15em] text-emerald-700">Export configuration</p><h2 className="mt-1 text-xl font-black">Build export package</h2>
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-black text-slate-700">Dataset<select value={dataset} onChange={(e) => setDataset(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"><option>Transactions Register</option><option>Voucher Register</option><option>Account Ledger</option><option>Subhead Ledger</option><option>Monthly Report</option><option>Annual Report</option></select></label>
            <label className="block text-sm font-black text-slate-700">File format<select value={format} onChange={(e) => setFormat(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"><option>Excel Workbook</option><option>CSV File</option><option>PDF Report</option></select></label>
            <PrimaryButton tone="emerald" disabled={busy} onClick={beginExport}>{busy ? "⏳ Preparing..." : "📤 Prepare Export"}</PrimaryButton>
          </div>
        </FinanceCard>

        <FinanceCard>
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.15em] text-blue-700">Export catalogue</p><h2 className="mt-1 text-xl font-black">Available records</h2></div><StatusPill tone="emerald">Live modules</StatusPill></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["Transactions", "Complete posting history", "/finance/transactions", "💳"],
              ["Vouchers", "Draft, prepared and posted vouchers", "/finance/vouchers", "🧾"],
              ["Account Ledger", "Account movements and balances", "/finance/account-ledger", "📘"],
              ["Subhead Ledger", "Budget-line expenditure history", "/finance/subhead-ledger", "📒"],
            ].map(([title, text, href, icon]) => <Link key={title} href={href} className="group border border-slate-200 bg-slate-700 p-4 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-md font-black text-white rounded-xl shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"><span className="text-xl">{icon}</span><p className="mt-3 font-black text-slate-950">{title}</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{text}</p></Link>)}
          </div>
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">Selected package: {dataset} · {format}</div>
        </FinanceCard>
      </div>
    </FinancePageFrame>
  );
}
