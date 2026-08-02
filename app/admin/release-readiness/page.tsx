"use client";

import { useMemo, useState } from "react";
import AdminNavigation from "@/app/components/admin/AdminNavigation";
import {
  ActionButton,
  EnterpriseHero,
  EnterpriseShell,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/app/components/enterprise/EnterpriseUI";

type CheckStatus = "pending" | "passed" | "failed" | "blocked";
type Check = {
  id: string;
  category: string;
  title: string;
  description: string;
  status: CheckStatus;
};

const initialChecks: Check[] = [
  { id: "mobile-360", category: "Mobile", title: "360px phone layout", description: "Navbar, cards, forms, tables and dropdowns remain usable without accidental clipping.", status: "pending" },
  { id: "mobile-390", category: "Mobile", title: "390px phone layout", description: "Primary phone layout remains balanced with touch-friendly controls.", status: "pending" },
  { id: "tablet-768", category: "Mobile", title: "768px tablet layout", description: "Two-column and table layouts adapt without broken spacing.", status: "pending" },
  { id: "desktop-1024", category: "Desktop", title: "1024px compact desktop", description: "Navigation and operational registers fit without destructive truncation.", status: "pending" },
  { id: "print-request", category: "Print", title: "Request document print", description: "A4 output, IET identity and page breaks are correct.", status: "pending" },
  { id: "print-voucher", category: "Print", title: "Payment Voucher print", description: "Approved original voucher structure remains exact and printable.", status: "pending" },
  { id: "print-reports", category: "Print", title: "Reports selected-section print", description: "The selected report section prints without empty or unrelated pages.", status: "pending" },
  { id: "print-hr-registry", category: "Print", title: "HR and Registry outputs", description: "Tables, headers and confidentiality markings remain readable on A4.", status: "pending" },
  { id: "perf-queries", category: "Performance", title: "Supabase query review", description: "Large registers use explicit columns, limits and pagination where appropriate.", status: "pending" },
  { id: "perf-realtime", category: "Performance", title: "Realtime subscriptions", description: "Only required pages subscribe and every channel is removed on unmount.", status: "pending" },
  { id: "perf-loading", category: "Performance", title: "Loading and error states", description: "No endless spinner, blank page or raw database error is exposed.", status: "pending" },
  { id: "perf-assets", category: "Performance", title: "Images and static assets", description: "Navbar PNGs and institutional logos are appropriately sized and optimized.", status: "pending" },
];

const tones: Record<CheckStatus, "slate" | "emerald" | "rose" | "amber"> = {
  pending: "slate",
  passed: "emerald",
  failed: "rose",
  blocked: "amber",
};

export default function ReleaseReadinessPage() {
  const [checks, setChecks] = useState<Check[]>(initialChecks);
  const [filter, setFilter] = useState("All");

  const categories = ["All", ...Array.from(new Set(checks.map((item) => item.category)))];
  const visible = filter === "All" ? checks : checks.filter((item) => item.category === filter);
  const summary = useMemo(() => ({
    passed: checks.filter((item) => item.status === "passed").length,
    failed: checks.filter((item) => item.status === "failed").length,
    blocked: checks.filter((item) => item.status === "blocked").length,
    pending: checks.filter((item) => item.status === "pending").length,
  }), [checks]);

  function updateStatus(id: string, status: CheckStatus) {
    setChecks((current) => current.map((item) => item.id === id ? { ...item, status } : item));
  }

  function reset() {
    setChecks(initialChecks);
  }

  return (
    <EnterpriseShell>
      <div className="mx-auto max-w-[1500px] space-y-6">
        <AdminNavigation />
        <EnterpriseHero
          eyebrow="ReqGen Production Assurance"
          title="Mobile, Print & Performance Readiness"
          description="A practical acceptance workspace for verifying responsive layouts, institutional print outputs and production performance before pilot deployment."
          actions={<ActionButton tone="cyan" onClick={reset}>Reset Checklist</ActionButton>}
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Passed" value={summary.passed} note="Verified acceptance checks" tone="emerald" />
          <StatCard label="Pending" value={summary.pending} note="Checks awaiting testing" tone="blue" />
          <StatCard label="Blocked" value={summary.blocked} note="Waiting for dependency or fix" tone="amber" />
          <StatCard label="Failed" value={summary.failed} note="Corrections required before pilot" tone="rose" />
        </section>

        <SectionCard title="Acceptance Checklist" eyebrow="Phase D controls">
          <div className="mb-5 flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setFilter(category)}
                className={`min-h-10 rounded-xl px-4 text-xs font-black text-white shadow-md transition hover:-translate-y-0.5 ${filter === category ? "bg-blue-700 ring-4 ring-blue-200" : "bg-slate-700 hover:bg-slate-800"}`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {visible.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone="blue">{item.category}</StatusBadge>
                      <StatusBadge tone={tones[item.status]}>{item.status}</StatusBadge>
                    </div>
                    <h3 className="mt-3 text-base font-black text-slate-950">{item.title}</h3>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{item.description}</p>
                  </div>
                  <select
                    value={item.status}
                    onChange={(event) => updateStatus(item.id, event.target.value as CheckStatus)}
                    className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="pending">Pending</option>
                    <option value="passed">Passed</option>
                    <option value="failed">Failed</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Automated Audit Commands" eyebrow="Local verification">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {["npm run audit:responsive", "npm run audit:print", "npm run audit:performance", "npm run audit:phase-d"].map((command) => (
              <code key={command} className="overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-cyan-200">{command}</code>
            ))}
          </div>
        </SectionCard>
      </div>
    </EnterpriseShell>
  );
}
