"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminNavigation from "@/app/components/admin/AdminNavigation";

type CheckStatus = "pending" | "passed" | "failed" | "blocked";

type WorkflowCheck = {
  id: string;
  group: string;
  title: string;
  description: string;
  expected: string;
  status: CheckStatus;
  note: string;
};

type SourceCheck = {
  key: string;
  label: string;
  ok: boolean;
  count: number;
  message: string;
};

const DEFAULT_CHECKS: WorkflowCheck[] = [
  {
    id: "request-create",
    group: "Request lifecycle",
    title: "Create and submit request",
    description: "Create a representative request and submit it into the workflow.",
    expected: "The request receives a request number, owner, stage, history entry and notification.",
    status: "pending",
    note: "",
  },
  {
    id: "request-routing",
    group: "Request lifecycle",
    title: "Routing and ownership",
    description: "Move the request through each configured approval stage.",
    expected: "Only the current owner can act, and the next owner receives the request immediately.",
    status: "pending",
    note: "",
  },
  {
    id: "approval-action",
    group: "Approvals",
    title: "Approval Operations Centre",
    description: "Open the request from the Approval Operations Centre and complete an authorized action.",
    expected: "The action succeeds once, records a history event and removes the item from the actor's queue.",
    status: "pending",
    note: "",
  },
  {
    id: "action-counter",
    group: "Action Centre",
    title: "Realtime counters",
    description: "Generate a new assignment and notification while the target user's session is open.",
    expected: "Waiting-for-action and unread counters update without a manual page refresh and do not duplicate.",
    status: "pending",
    note: "",
  },
  {
    id: "notification-read",
    group: "Action Centre",
    title: "Read-state synchronization",
    description: "Open one notification, then mark all remaining notifications as read.",
    expected: "The database and all visible counters immediately reflect the new read state.",
    status: "pending",
    note: "",
  },
  {
    id: "hr-review",
    group: "HR workflow",
    title: "HR officer and HR Boss review",
    description: "Assign an HR task to an officer, submit it, return it once, then approve it.",
    expected: "The officer sees only assigned work; HR Boss review, return, resubmission and audit history are preserved.",
    status: "pending",
    note: "",
  },
  {
    id: "personal-fund",
    group: "HR workflow",
    title: "Personal Fund limited context",
    description: "Process a Personal Fund request at HR stage.",
    expected: "HR sees the request amount and limited subhead balance summary only, with no Finance operations or ledgers.",
    status: "pending",
    note: "",
  },
  {
    id: "finance-reservation",
    group: "Finance workflow",
    title: "Subhead reservation and release",
    description: "Approve, reject and cancel representative fund requests.",
    expected: "Reserved, expenditure and available balances change exactly once and remain internally consistent.",
    status: "pending",
    note: "",
  },
  {
    id: "voucher-flow",
    group: "Finance workflow",
    title: "Payment Voucher lifecycle",
    description: "Generate, authorize, disburse, print and complete a voucher.",
    expected: "Voucher status, signatories, transaction linkage, audit history and original print template remain correct.",
    status: "pending",
    note: "",
  },
  {
    id: "registry-privacy",
    group: "Registry",
    title: "Registry privacy boundary",
    description: "Track summarized request movement using the Registry active role.",
    expected: "Registry sees movement metadata only and cannot retrieve request content, HR records or financial details.",
    status: "pending",
    note: "",
  },
  {
    id: "role-switch",
    group: "Security",
    title: "Strict active-role switch",
    description: "Switch a multi-role user between Admin, Registry, HR and Finance contexts.",
    expected: "Navbar, routes, data queries and actions change immediately to the selected active role.",
    status: "pending",
    note: "",
  },
  {
    id: "audit-event",
    group: "Audit",
    title: "Who did what",
    description: "Perform representative sensitive actions in every major module.",
    expected: "Audit identifies actor, active role, action, module, record and timestamp.",
    status: "pending",
    note: "",
  },
];

function statusClass(status: CheckStatus) {
  if (status === "passed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "failed") return "border-rose-200 bg-rose-50 text-rose-800";
  if (status === "blocked") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function WorkflowTestPage() {
  const [checks, setChecks] = useState<WorkflowCheck[]>(DEFAULT_CHECKS);
  const [sources, setSources] = useState<SourceCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("reqgen-phase-b-checks");
      if (saved) {
        const parsed = JSON.parse(saved) as WorkflowCheck[];
        queueMicrotask(() => setChecks(parsed));
      }
    } catch {
      // Keep the authoritative default checklist when local storage is unavailable.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("reqgen-phase-b-checks", JSON.stringify(checks));
  }, [checks]);

  const runDiagnostics = useCallback(async () => {
    setLoading(true);
    const definitions = [
      { key: "requests", label: "Requests", table: "requests" },
      { key: "history", label: "Request History", table: "request_history" },
      { key: "notifications", label: "Notifications", table: "notifications" },
      { key: "profiles", label: "Profiles", table: "profiles" },
      { key: "roles", label: "Assigned Roles", table: "profile_roles" },
      { key: "subheads", label: "Subheads", table: "subheads" },
      { key: "finance", label: "Finance Transactions", table: "finance_transactions" },
      { key: "vouchers", label: "Payment Vouchers", table: "payment_vouchers" },
      { key: "hrAssignments", label: "HR Request Assignments", table: "hr_request_assignments" },
      { key: "audit", label: "Audit", table: "enterprise_audit_events" },
    ];

    const results = await Promise.all(
      definitions.map(async (definition) => {
        const { count, error } = await supabase
          .from(definition.table)
          .select("*", { count: "exact", head: true });

        return {
          key: definition.key,
          label: definition.label,
          ok: !error,
          count: count ?? 0,
          message: error ? "Unavailable to this active role or not installed" : "Connected",
        } satisfies SourceCheck;
      })
    );

    setSources(results);
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void runDiagnostics());
  }, [runDiagnostics]);

  const groups = useMemo(() => Array.from(new Set(checks.map((item) => item.group))), [checks]);
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return checks.filter((item) => {
      const matchesGroup = filter === "all" || item.group === filter;
      const matchesSearch = !query || `${item.title} ${item.description} ${item.expected} ${item.note}`.toLowerCase().includes(query);
      return matchesGroup && matchesSearch;
    });
  }, [checks, filter, search]);

  const summary = useMemo(() => ({
    total: checks.length,
    passed: checks.filter((item) => item.status === "passed").length,
    failed: checks.filter((item) => item.status === "failed").length,
    blocked: checks.filter((item) => item.status === "blocked").length,
  }), [checks]);

  function updateCheck(id: string, patch: Partial<WorkflowCheck>) {
    setChecks((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function resetChecklist() {
    setChecks(DEFAULT_CHECKS);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe_0,_transparent_28%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <AdminNavigation />

        <section className="rg-module-header">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">Production Readiness</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">End-to-End Workflow Test Centre</h1>
              <p className="mt-3 text-sm font-semibold leading-7 text-blue-100 sm:text-base">
                Validate request routing, approvals, Action Centre counters, HR review, Finance processing, Registry privacy, active-role isolation and audit evidence before pilot deployment.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => void runDiagnostics()} className="reqgen-btn reqgen-btn-cyan rounded-xl px-4 py-3 text-sm font-black text-white">
                {loading ? "Checking Sources..." : "Run Diagnostics"}
              </button>
              <Link href="/approvals/action-centre" className="reqgen-btn reqgen-btn-violet rounded-xl px-4 py-3 text-sm font-black text-white">
                Open Action Centre
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Total Tests", summary.total, "blue"],
            ["Passed", summary.passed, "emerald"],
            ["Failed", summary.failed, "rose"],
            ["Blocked", summary.blocked, "amber"],
          ].map(([label, value, tone]) => (
            <div key={String(label)} className={`rounded-2xl border bg-white/85 p-5 shadow-lg backdrop-blur ${tone === "emerald" ? "border-emerald-200" : tone === "rose" ? "border-rose-200" : tone === "amber" ? "border-amber-200" : "border-blue-200"}`}>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-xl backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Live source readiness</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Workflow Data Connections</h2>
            </div>
            <p className="text-xs font-bold text-slate-500">A restricted result can be correct when testing a non-Admin active role.</p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {sources.map((source) => (
              <div key={source.key} className={`rounded-2xl border p-4 ${source.ok ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-slate-900">{source.label}</span>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${source.ok ? "bg-emerald-700 text-white" : "bg-amber-600 text-white"}`}>
                    {source.ok ? "Ready" : "Check"}
                  </span>
                </div>
                <p className="mt-3 text-2xl font-black text-slate-950">{source.ok ? source.count : "—"}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{source.message}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-xl backdrop-blur">
          <div className="grid gap-3 lg:grid-cols-[1fr_260px_auto]">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search test, expectation or note..." className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
            <select value={filter} onChange={(event) => setFilter(event.target.value)} className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
              <option value="all">All Test Groups</option>
              {groups.map((group) => <option key={group} value={group}>{group}</option>)}
            </select>
            <button type="button" onClick={resetChecklist} className="reqgen-btn reqgen-btn-slate rounded-xl px-4 py-3 text-sm font-black text-white">Reset Checklist</button>
          </div>

          <div className="mt-5 space-y-4">
            {visible.map((item, index) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-xs font-black text-white">{String(index + 1).padStart(2, "0")}</span>
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-blue-800">{item.group}</span>
                      <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wide ${statusClass(item.status)}`}>{item.status}</span>
                    </div>
                    <h3 className="mt-3 text-lg font-black text-slate-950">{item.title}</h3>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{item.description}</p>
                    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">Expected result</p>
                      <p className="mt-1 text-sm font-bold leading-6 text-slate-800">{item.expected}</p>
                    </div>
                  </div>

                  <div className="grid w-full gap-3 xl:w-[360px]">
                    <select value={item.status} onChange={(event) => updateCheck(item.id, { status: event.target.value as CheckStatus })} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                      <option value="pending">Pending</option>
                      <option value="passed">Passed</option>
                      <option value="failed">Failed</option>
                      <option value="blocked">Blocked</option>
                    </select>
                    <textarea value={item.note} onChange={(event) => updateCheck(item.id, { note: event.target.value })} rows={3} placeholder="Tester note, evidence or defect reference..." className="resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
