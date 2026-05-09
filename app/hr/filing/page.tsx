"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ReqRow = {
  id: string;
  request_no: string;
  title: string;
  details: string;
  amount: number | null;
  status: string | null;
  current_stage: string | null;
  created_at: string;
  requester_name: string | null;
  checked_by_name: string | null;
  hr_name: string | null;
  dg_name: string | null;
  dept_id: string | null;
  dept_name: string | null;
  request_type: string | null;
  personal_category: string | null;
};

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function shortDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function statusBadgeClass(status: string | null | undefined) {
  const s = (status || "").toLowerCase();

  if (s.includes("complete")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (s.includes("reject")) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (s.includes("filing")) {
    return "border-purple-200 bg-purple-50 text-purple-700";
  }

  if (s.includes("review") || s.includes("approve")) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function stageBadgeClass(stage: string | null | undefined) {
  const s = (stage || "").toLowerCase();

  if (s.includes("completed")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (s.includes("hr filing")) {
    return "border-purple-200 bg-purple-50 text-purple-700";
  }

  if (s.includes("dg")) {
    return "border-indigo-200 bg-indigo-50 text-indigo-700";
  }

  if (s.includes("hr")) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function normalize(v: string | null | undefined) {
  return (v || "").toLowerCase().replace(/[^a-z]/g, "");
}

function isPersonalNonFund(r: ReqRow) {
  return normalize(r.request_type) === "personal" && normalize(r.personal_category) === "nonfund";
}

function isCompleted(r: ReqRow) {
  return (r.status || "").toLowerCase().includes("complete");
}

function isReadyForFiling(r: ReqRow) {
  const stage = normalize(r.current_stage);
  const status = (r.status || "").toLowerCase();
  return stage === "hrfiling" || status.includes("filing");
}

export default function HRFilingPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [myRole, setMyRole] = useState<string>("Staff");
  const rk = roleKey(myRole);
  const canAccess = ["admin", "auditor", "hr"].includes(rk);

  const [rows, setRows] = useState<ReqRow[]>([]);

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  function openTemplate(id: string) {
    router.push(`/requests/${id}/print`);
  }

  async function load() {
    setLoading(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      router.push("/login");
      return;
    }

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (profErr) {
      setMsg("Failed to load your profile: " + profErr.message);
      setLoading(false);
      return;
    }

    const role = (prof?.role || "Staff") as string;
    setMyRole(role);

    if (!["admin", "auditor", "hr"].includes(roleKey(role))) {
      setMsg("Access denied. Only HR, Admin and Auditor can access HR Filing.");
      setRows([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.rpc("get_hr_filing_requests");

    if (error) {
      setMsg("Failed to load HR filing requests: " + error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data || []) as ReqRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const departments = useMemo(() => {
    const map = new Map<string, string>();

    rows.forEach((r) => {
      if (r.dept_id) {
        map.set(r.dept_id, r.dept_name || "Unknown Department");
      }
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const s = search.trim().toLowerCase();

    return rows.filter((r) => {
      if (!isPersonalNonFund(r)) return false;

      if (deptFilter !== "ALL" && r.dept_id !== deptFilter) return false;

      if (statusFilter === "Completed" && !isCompleted(r)) return false;

      if (statusFilter === "ReadyForFiling" && !isReadyForFiling(r)) return false;

      if (statusFilter === "InProgress") {
        const completed = isCompleted(r);
        const rejected = (r.status || "").toLowerCase().includes("reject");
        if (completed || rejected) return false;
      }

      if (statusFilter === "Rejected") {
        if (!(r.status || "").toLowerCase().includes("reject")) return false;
      }

      if (s) {
        const haystack = [
          r.request_no,
          r.title,
          r.details,
          r.requester_name,
          r.checked_by_name,
          r.hr_name,
          r.dg_name,
          r.dept_name,
          r.status,
          r.current_stage,
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(s)) return false;
      }

      return true;
    });
  }, [rows, search, deptFilter, statusFilter]);

  const stats = useMemo(() => {
    const personalNonFundRows = rows.filter(isPersonalNonFund);

    const total = personalNonFundRows.length;
    const completed = personalNonFundRows.filter(isCompleted).length;
    const readyForFiling = personalNonFundRows.filter(isReadyForFiling).length;

    const thisMonth = personalNonFundRows.filter((r) => {
      const d = new Date(r.created_at);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;

    return { total, completed, readyForFiling, thisMonth };
  }, [rows]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-7xl py-10 text-slate-600">
          Loading HR filing...
        </div>
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-3xl py-10">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h1 className="text-xl font-extrabold text-slate-900">HR Filing Access</h1>
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {msg || "Access denied."}
            </div>

            <button
              onClick={() => router.push("/dashboard")}
              className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-7xl py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              HR Filing
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Personal NonFund requests for HR review, DG approval, final filing and records.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={load}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
            >
              Refresh
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
            >
              Dashboard
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
            {msg}
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <StatCard title="Total Personal NonFund" value={String(stats.total)} tone="blue" />
          <StatCard title="Ready for Filing" value={String(stats.readyForFiling)} tone="purple" />
          <StatCard title="Completed / Filed" value={String(stats.completed)} tone="emerald" />
          <StatCard title="This Month" value={String(stats.thisMonth)} tone="slate" />
        </div>

        <div className="mt-6 rounded-3xl border bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-semibold text-slate-800">Search</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search request no, title, requester..."
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Department</label>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Personal NonFund</option>
                <option value="InProgress">In Progress</option>
                <option value="ReadyForFiling">Ready for HR Filing</option>
                <option value="Completed">Completed / Filed</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:hidden">
          {filteredRows.length === 0 ? (
            <EmptyState />
          ) : (
            filteredRows.map((r) => (
              <div key={r.id} className="rounded-3xl border bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-extrabold text-slate-900">
                      {r.request_no}
                    </div>
                    <div className="mt-1 font-semibold text-slate-800">{r.title}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {r.dept_name || "—"}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${statusBadgeClass(
                        r.status
                      )}`}
                    >
                      {r.status || "—"}
                    </span>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${stageBadgeClass(
                        r.current_stage
                      )}`}
                    >
                      {r.current_stage || "—"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <InfoLine label="Requester" value={r.requester_name || "—"} />
                  <InfoLine label="HOD/Director" value={r.checked_by_name || "—"} />
                  <InfoLine label="HR Review" value={r.hr_name || "—"} />
                  <InfoLine label="DG" value={r.dg_name || "—"} />
                  <InfoLine label="Created" value={shortDate(r.created_at)} />
                  <InfoLine label="Stage" value={r.current_stage || "—"} />
                </div>

                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="font-semibold text-slate-900">Details</div>
                  <div className="mt-1 line-clamp-3 whitespace-pre-wrap">{r.details}</div>
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    onClick={() => openTemplate(r.id)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    View Template
                  </button>

                  {isCompleted(r) && (
                    <button
                      onClick={() => openTemplate(r.id)}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Print / File
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 hidden xl:block rounded-3xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-slate-50 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-900">
              Personal NonFund Filing Register
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              HR filing register for non-financial personal requests.
            </p>
          </div>

          {filteredRows.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1240px]">
                <div className="grid grid-cols-15 bg-slate-100 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <div className="col-span-2">Request No</div>
                  <div className="col-span-3">Title</div>
                  <div className="col-span-2">Department</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1">Stage</div>
                  <div className="col-span-2">Requester</div>
                  <div className="col-span-1">HR</div>
                  <div className="col-span-1">DG</div>
                  <div className="col-span-1">Date</div>
                  <div className="col-span-1 text-right">Action</div>
                </div>

                {filteredRows.map((r) => (
                  <div
                    key={r.id}
                    className="grid grid-cols-15 items-center border-t px-6 py-4 text-sm hover:bg-slate-50"
                  >
                    <div className="col-span-2 font-extrabold text-slate-900">
                      {r.request_no}
                    </div>

                    <div className="col-span-3">
                      <div className="font-semibold text-slate-900">{r.title}</div>
                      <div className="mt-1 line-clamp-1 text-xs text-slate-500">
                        {r.details}
                      </div>
                    </div>

                    <div className="col-span-2 text-slate-700">
                      {r.dept_name || "—"}
                    </div>

                    <div className="col-span-1">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${statusBadgeClass(
                          r.status
                        )}`}
                      >
                        {r.status || "—"}
                      </span>
                    </div>

                    <div className="col-span-1">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${stageBadgeClass(
                          r.current_stage
                        )}`}
                      >
                        {r.current_stage || "—"}
                      </span>
                    </div>

                    <div className="col-span-2 text-slate-700">
                      {r.requester_name || "—"}
                    </div>

                    <div className="col-span-1 text-slate-700">
                      {r.hr_name || "—"}
                    </div>

                    <div className="col-span-1 text-slate-700">
                      {r.dg_name || "—"}
                    </div>

                    <div className="col-span-1 text-slate-600">
                      {shortDate(r.created_at)}
                    </div>

                    <div className="col-span-1 flex justify-end gap-2">
                      <button
                        onClick={() => openTemplate(r.id)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                      >
                        View
                      </button>

                      {isCompleted(r) && (
                        <button
                          onClick={() => openTemplate(r.id)}
                          className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          Print
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
          <div className="font-bold">HR Filing Note</div>
          <p className="mt-1">
            This page shows Personal NonFund requests at every HR filing stage. Personal Fund requests
            are handled through Account and printed from the Finance page after payment.
          </p>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "blue" | "emerald" | "purple" | "slate";
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "purple"
      ? "bg-purple-50 text-purple-700"
      : tone === "slate"
      ? "bg-slate-50 text-slate-700"
      : "bg-blue-50 text-blue-700";

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      <div className={`mt-3 inline-flex rounded-2xl px-3 py-2 text-2xl font-extrabold ${cls}`}>
        {value}
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-500">{label}:</span>{" "}
      <b className="text-slate-900">{value}</b>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border bg-white p-6 text-sm text-slate-700 shadow-sm xl:rounded-none xl:border-0 xl:shadow-none">
      No Personal NonFund request found for the selected filter.
    </div>
  );
}