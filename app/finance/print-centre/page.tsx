"use client";

import Link from "next/link";
import { useState } from "react";
import { FinanceCard, FinancePageFrame, MetricCard, PrimaryButton, StatusPill } from "../_components/FinancePageFrame";

const templates = [
  { id: "summary", icon: "📊", title: "Executive Summary", text: "One-page management overview with totals and approvals." },
  { id: "voucher", icon: "🧾", title: "Payment Voucher", text: "Clean voucher layout for authorisation and filing." },
  { id: "ledger", icon: "📒", title: "Ledger Statement", text: "Account or subhead movement with opening and closing balances." },
  { id: "report", icon: "🏛️", title: "Institutional Report", text: "Official IET A4 report with logo and signature blocks." },
];

export default function PrintCentrePage() {
  const [selected, setSelected] = useState("report");
  const [period, setPeriod] = useState("Current month");

  return (
    <FinancePageFrame eyebrow="Finance Output" title="Print Centre" description="Prepare polished, controlled and printer-ready finance documents using the institutional Finance Control Centre structure." icon="🖨️" tone="cyan" badge="A4 Output">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Paper format" value="A4 Portrait" icon="📄" tone="cyan" helper="Standard institutional layout" />
        <MetricCard label="Branding" value="IET Official" icon="🏛️" tone="blue" helper="Logo and document identity" />
        <MetricCard label="Templates" value={String(templates.length)} icon="🗂️" tone="violet" helper="Available output layouts" />
        <MetricCard label="Status" value="Ready" icon="✅" tone="emerald" helper="Print workspace available" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_.72fr]">
        <FinanceCard>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-700">Template library</p><h2 className="mt-1 text-xl font-black">Choose a document</h2></div><StatusPill tone="cyan">Live preview workflow</StatusPill></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {templates.map((item) => {
              const active = selected === item.id;
              return <button key={item.id} onClick={() => setSelected(item.id)} className={`group rounded-2xl border p-4 text-left transition ${active ? "border-cyan-500 bg-cyan-50 ring-4 ring-cyan-100" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"}`}><div className="flex items-start gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xl ${active ? "bg-cyan-700 text-white" : "bg-slate-100"}`}>{item.icon}</span><span><span className="block font-black text-slate-950">{item.title}</span><span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{item.text}</span></span></div></button>;
            })}
          </div>
        </FinanceCard>

        <FinanceCard>
          <p className="text-xs font-black uppercase tracking-[0.15em] text-blue-700">Output setup</p><h2 className="mt-1 text-xl font-black">Prepare document</h2>
          <label className="mt-5 block text-sm font-black text-slate-700">Reporting period<select value={period} onChange={(e) => setPeriod(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"><option>Current month</option><option>Current quarter</option><option>Current year</option><option>Custom period</option></select></label>
          <div className="mt-5 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-4"><p className="text-sm font-black text-blue-950">Selected: {templates.find((t) => t.id === selected)?.title}</p><p className="mt-1 text-xs font-semibold leading-5 text-blue-700">Period: {period}. The final output will be generated from live Finance records.</p></div>
          <div className="mt-5 grid gap-3">
            <Link href={`/finance/reports?view=output&template=${selected}`} className="reqgen-btn reqgen-btn-violet inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-cyan-800">👁️ Open Print Workspace</Link>
            <PrimaryButton tone="blue" onClick={() => window.print()}>🖨️ Print Current Preview</PrimaryButton>
          </div>
        </FinanceCard>
      </div>
    </FinancePageFrame>
  );
}
