"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Row = {
  id: string;
  request_no: string;
  title: string;
  amount: number;
  status: string;
  current_stage: string;
  created_at: string;
  request_type?: string | null;
  personal_category?: string | null;
  funds_state?: string | null;
  assigned_account_officer_name?: string | null;
};

type TypeFilter = "ALL" | "OFFICIAL" | "PERSONAL_FUND" | "PERSONAL_OTHER";

type StatusFilter = "ALL" | "ACTIVE" | "COMPLETED" | "REJECTED";

type StageFilter =
  | "ALL"
  | "PO"
  | "DOD"
  | "DINADMIN"
  | "REGISTRAR"
  | "HOD"
  | "HR"
  | "DG"
  | "ACCOUNT"
  | "HRFILING"
  | "COMPLETED";

function naira(value: number | null | undefined) {
  return "₦" + Math.round(Number(value || 0)).toLocaleString();
}

function stageKey(stage: string | null | undefined) {
  return String(stage || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function categoryKey(category: string | null | undefined) {
  return String(category || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function statusClass(status: string | null | undefined) {
  const s = String(status || "").toLowerCase();

  if (s.includes("reject") || s.includes("delete") || s.includes("cancel")) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (s.includes("paid") || s.includes("complete") || s.includes("closed")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (s.includes("approved")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (s.includes("filing")) {
    return "border-purple-200 bg-purple-50 text-purple-700";
  }

  if (s.includes("submit") || s.includes("review") || s.includes("pending")) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function stageClass(stage: string | null | undefined) {
  const s = stageKey(stage);

  if (s === "PO") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  if (s === "DOD") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s === "DINADMIN") return "border-blue-200 bg-blue-50 text-blue-700";
  if (s === "REGISTRAR") return "border-cyan-200 bg-cyan-50 text-cyan-700";
  if (s === "HOD") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s === "ACCOUNT") return "border-purple-200 bg-purple-50 text-purple-700";
  if (s === "DG") return "border-amber-200 bg-amber-50 text-amber-800";

  if (s === "HR" || s === "HRFILING") {
    return "border-pink-200 bg-pink-50 text-pink-700";
  }

  if (s === "COMPLETED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (s.includes("REJECT") || s.includes("DELETE") || s.includes("CANCEL")) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function stageLabel(stage: string | null | undefined) {
  const s = stageKey(stage);

  if (s === "PO") return "PO";
  if (s === "DOD") return "DOD";
  if (s === "DINADMIN") return "DIN Admin";
  if (s === "REGISTRAR") return "Registrar";
  if (s === "HOD") return "HOD";
  if (s === "HR") return "HR";
  if (s === "DG") return "DG";
  if (s === "ACCOUNT") return "AccountOfficer";
  if (s === "HRFILING") return "HR Filing";
  if (s === "COMPLETED") return "Completed";

  return stage || "—";
}

function requestTypeLabel(row: Row) {
  const rt = String(row.request_type || "").trim();
  const cat = String(row.personal_category || "").trim();

  if (rt === "Official") return "Official";

  if (rt === "Personal") {
    if (categoryKey(cat) === "FUND") return "Personal Fund";
    if (categoryKey(cat) === "NONFUND") return "Personal Other";
    if (cat) return `Personal ${cat}`;
    return "Personal Other";
  }

  return rt || "—";
}

function requestGroup(row: Row): TypeFilter {
  const rt = String(row.request_type || "").trim().toUpperCase();
  const cat = categoryKey(row.personal_category);

  if (rt === "OFFICIAL") return "OFFICIAL";
  if (rt === "PERSONAL" && cat === "FUND") return "PERSONAL_FUND";
  if (rt === "PERSONAL") return "PERSONAL_OTHER";

  return "ALL";
}

function isActiveRequest(row: Row) {
  const s = String(row.status || "").toLowerCase();
  const st = stageKey(row.current_stage);

  return (
    st !== "COMPLETED" &&
    st !== "REJECTED" &&
    st !== "DELETED" &&
    st !== "CANCELLED" &&
    !s.includes("reject") &&
    !s.includes("delete") &&
    !s.includes("cancel") &&
    !s.includes("paid") &&
    !s.includes("complete") &&
    !s.includes("closed")
  );
}

function isCompletedRequest(row: Row) {
  const s = String(row.status || "").toLowerCase();
  const st = stageKey(row.current_stage);

  return (
    st === "COMPLETED" ||
    s.includes("paid") ||
    s.includes("complete") ||
    s.includes("closed")
  );
}

function isRejectedOrDeletedRequest(row: Row) {
  const s = String(row.status || "").toLowerCase();
  const st = stageKey(row.current_stage);

  return (
    st === "REJECTED" ||
    st === "DELETED" ||
    st === "CANCELLED" ||
    s.includes("reject") ||
    s.includes("delete") ||
    s.includes("cancel")
  );
}

function amountLabel(row: Row) {
  const group = requestGroup(row);

  if (group === "PERSONAL_OTHER") return "Not Applicable";

  return naira(row.amount);
}

function workflowNote(row: Row) {
  const group = requestGroup(row);
  const stage = stageKey(row.current_stage);

  if (group === "OFFICIAL") {
    if (stage === "PO") return "Official ASAP-ALLI request is with Programme Officer.";
    if (stage === "DOD") return "Official request is with Director of Department.";
    if (stage === "DINADMIN") return "Official DIN request is with DIN Admin before Registrar.";
    if (stage === "REGISTRAR") return "DIN Official request is with Registrar as HOD of all DIN Departments.";
    if (stage === "HOD") return "Official request is with HOD. Subhead may be assigned at this stage.";
    if (stage === "DG") return "Official request is with DG for approval and AccountOfficer selection.";
    if (stage === "ACCOUNT") return "Official request is with AccountOfficer for treatment/payment.";
    if (stage === "COMPLETED") return "Official request is completed.";
    return "Official request workflow.";
  }

  if (group === "PERSONAL_FUND") {
    if (stage === "DOD") return "Personal Fund request is with Director of Department.";
    if (stage === "HOD") return "ASAP-ALLI Personal Fund request is with HOD before HR.";
    if (stage === "HR") return "Personal Fund request is with HR.";
    if (stage === "DG") return "Personal Fund request is with DG for approval and AccountOfficer selection.";
    if (stage === "ACCOUNT") return "Personal Fund request is with AccountOfficer for payment.";
    if (stage === "HRFILING") return "Personal Fund request is back with HR for final filing.";
    if (stage === "COMPLETED") return "Personal Fund request is completed and filed.";
    return "Personal Fund workflow.";
  }

  if (group === "PERSONAL_OTHER") {
    if (stage === "DOD") return "Personal request is with Director of Department.";
    if (stage === "HOD") return "ASAP-ALLI Personal request is with HOD before HR.";
    if (stage === "HR") return "Personal request is with HR.";
    if (stage === "DG") return "Personal request is with DG before HR Filing.";
    if (stage === "HRFILING") return "Personal request is with HR for final filing.";
    if (stage === "COMPLETED") return "Personal request is completed and filed.";
    return "Personal request workflow.";
  }

  return "Request workflow.";
}

export default function MyRequestsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [stageFilter, setStageFilter] = useState<StageFilter>("ALL");

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (options?.silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMsg(null);

      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("requests")
        .select(
          "id,request_no,title,amount,status,current_stage,created_at,request_type,personal_category,funds_state,assigned_account_officer_name"
        )
        .eq("created_by", auth.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setMsg("Failed to load requests: " + error.message);
        setRows([]);
      } else {
        setRows((data || []) as Row[]);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [router]
  );

  useEffect(() => {
    load();

    const refreshOnFocus = () => {
      load({ silent: true });
    };

    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") {
        load({ silent: true });
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisible);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [load]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const group = requestGroup(row);
      const st = stageKey(row.current_stage);

      if (typeFilter !== "ALL" && group !== typeFilter) return false;
      if (stageFilter !== "ALL" && st !== stageFilter) return false;

      if (statusFilter === "ACTIVE" && !isActiveRequest(row)) return false;
      if (statusFilter === "COMPLETED" && !isCompletedRequest(row)) return false;
      if (statusFilter === "REJECTED" && !isRejectedOrDeletedRequest(row)) return false;

      if (!q) return true;

      const haystack = [
        row.request_no,
        row.title,
        row.status,
        row.current_stage,
        row.request_type,
        row.personal_category,
        row.funds_state,
        row.assigned_account_officer_name,
        workflowNote(row),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, search, typeFilter, statusFilter, stageFilter]);

  const counts = useMemo(() => {
    const total = rows.length;

    const active = rows.filter(isActiveRequest).length;
    const completed = rows.filter(isCompletedRequest).length;
    const rejectedOrDeleted = rows.filter(isRejectedOrDeletedRequest).length;

    const official = rows.filter((r) => requestGroup(r) === "OFFICIAL").length;
    const personalFund = rows.filter((r) => requestGroup(r) === "PERSONAL_FUND").length;
    const personalOther = rows.filter((r) => requestGroup(r) === "PERSONAL_OTHER").length;

    const po = rows.filter((r) => stageKey(r.current_stage) === "PO").length;
    const dod = rows.filter((r) => stageKey(r.current_stage) === "DOD").length;
    const dinAdmin = rows.filter((r) => stageKey(r.current_stage) === "DINADMIN").length;
    const registrar = rows.filter((r) => stageKey(r.current_stage) === "REGISTRAR").length;
    const hod = rows.filter((r) => stageKey(r.current_stage) === "HOD").length;
    const hr = rows.filter((r) => stageKey(r.current_stage) === "HR").length;
    const dg = rows.filter((r) => stageKey(r.current_stage) === "DG").length;
    const account = rows.filter((r) => stageKey(r.current_stage) === "ACCOUNT").length;
    const hrFiling = rows.filter((r) => stageKey(r.current_stage) === "HRFILING").length;

    return {
      total,
      active,
      completed,
      rejectedOrDeleted,
      official,
      personalFund,
      personalOther,
      po,
      dod,
      dinAdmin,
      registrar,
      hod,
      hr,
      dg,
      account,
      hrFiling,
    };
  }, [rows]);

  function openRequest(requestId: string) {
    router.push(`/requests/${requestId}?updated=${Date.now()}`);
    router.refresh();
  }

  function printRequest(requestId: string) {
    router.push(`/requests/${requestId}/print?updated=${Date.now()}`);
    router.refresh();
  }

  function resetFilters() {
    setSearch("");
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setStageFilter("ALL");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-7xl py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              My Requests
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              All requests you created. This page refreshes automatically when you return to it.
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Final routing supports PO, DOD, DIN Admin, Registrar, HOD, HR, DG, AccountOfficer and HR Filing.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => load({ silent: true })}
              disabled={refreshing || loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-sm hover:bg-slate-100 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              onClick={() => router.push(`/requests/new?updated=${Date.now()}`)}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              New Request
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
          <CountCard label="Total Requests" value={counts.total} tone="slate" />
          <CountCard label="Active" value={counts.active} tone="blue" />
          <CountCard label="Completed / Paid" value={counts.completed} tone="emerald" />
          <CountCard label="Rejected / Deleted" value={counts.rejectedOrDeleted} tone="red" />
          <CountCard label="Official" value={counts.official} tone="blue" />
          <CountCard label="Personal Fund" value={counts.personalFund} tone="purple" />
          <CountCard label="Personal Other" value={counts.personalOther} tone="emerald" />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-9">
          <MiniStageCard label="PO" value={counts.po} />
          <MiniStageCard label="DOD" value={counts.dod} />
          <MiniStageCard label="DIN Admin" value={counts.dinAdmin} />
          <MiniStageCard label="Registrar" value={counts.registrar} />
          <MiniStageCard label="HOD" value={counts.hod} />
          <MiniStageCard label="HR" value={counts.hr} />
          <MiniStageCard label="DG" value={counts.dg} />
          <MiniStageCard label="Account" value={counts.account} />
          <MiniStageCard label="HR Filing" value={counts.hrFiling} />
        </div>

        <div className="mt-5 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="text-sm font-bold text-slate-800">Search</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search request no, title, stage, type..."
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-800">Request Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Types</option>
                <option value="OFFICIAL">Official</option>
                <option value="PERSONAL_FUND">Personal Fund</option>
                <option value="PERSONAL_OTHER">Personal Leave/Contract/Resignation/Others</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-bold text-slate-800">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active / In Progress</option>
                <option value="COMPLETED">Completed / Paid</option>
                <option value="REJECTED">Rejected / Deleted</option>
              </select>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label className="text-sm font-bold text-slate-800">Stage</label>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value as StageFilter)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Stages</option>
                <option value="PO">PO</option>
                <option value="DOD">DOD</option>
                <option value="DINADMIN">DIN Admin</option>
                <option value="REGISTRAR">Registrar</option>
                <option value="HOD">HOD</option>
                <option value="HR">HR</option>
                <option value="DG">DG</option>
                <option value="ACCOUNT">AccountOfficer</option>
                <option value="HRFILING">HR Filing</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-100"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm">
            {msg}
          </div>
        )}

        {loading ? (
          <div className="mt-6 rounded-2xl border bg-white p-6 text-slate-600 shadow-sm">
            Loading requests...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="mt-6 rounded-2xl border bg-white p-6 text-slate-700 shadow-sm">
            No requests found using the selected filters.
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="hidden grid-cols-12 bg-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600 md:grid">
              <div className="col-span-2">Request No</div>
              <div className="col-span-3">Title</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Stage</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1 text-right">Amount</div>
            </div>

            {filteredRows.map((r) => (
              <div key={r.id} className="border-t px-4 py-4">
                <div className="grid gap-3 md:grid-cols-12 md:items-center">
                  <button
                    type="button"
                    onClick={() => openRequest(r.id)}
                    className="text-left font-extrabold text-slate-900 hover:underline md:col-span-2"
                  >
                    {r.request_no || "—"}
                  </button>

                  <div className="break-words text-sm font-semibold text-slate-800 md:col-span-3">
                    {r.title || "—"}
                  </div>

                  <div className="text-sm font-semibold text-slate-700 md:col-span-2">
                    {requestTypeLabel(r)}
                  </div>

                  <div className="md:col-span-2">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${stageClass(
                        r.current_stage
                      )}`}
                    >
                      {stageLabel(r.current_stage)}
                    </span>
                  </div>

                  <div className="md:col-span-2">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClass(
                        r.status
                      )}`}
                    >
                      {r.status || "—"}
                    </span>
                  </div>

                  <div className="text-sm font-extrabold text-slate-900 md:col-span-1 md:text-right">
                    {amountLabel(r)}
                  </div>
                </div>

                <div className="mt-2 text-xs font-semibold text-slate-500">
                  {workflowNote(r)}
                </div>

                {r.funds_state && (
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    Funds State: {r.funds_state}
                  </div>
                )}

                {r.assigned_account_officer_name && (
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    Selected AccountOfficer: {r.assigned_account_officer_name}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openRequest(r.id)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 hover:bg-slate-50"
                  >
                    View
                  </button>

                  <button
                    type="button"
                    onClick={() => printRequest(r.id)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 hover:bg-slate-50"
                  >
                    Print
                  </button>
                </div>

                <div className="mt-2 text-xs font-semibold text-slate-500">
                  Created: {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function CountCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "blue" | "emerald" | "red" | "purple";
}) {
  const cls =
    tone === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-800"
      : tone === "emerald"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : tone === "red"
          ? "border-red-200 bg-red-50 text-red-800"
          : tone === "purple"
            ? "border-purple-200 bg-purple-50 text-purple-800"
            : "border-slate-200 bg-white text-slate-800";

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${cls}`}>
      <div className="text-xs font-black uppercase tracking-wide opacity-75">{label}</div>
      <div className="mt-2 text-3xl font-black leading-none">
        {Number(value || 0).toLocaleString()}
      </div>
    </div>
  );
}

function MiniStageCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-black text-slate-900">
        {Number(value || 0).toLocaleString()}
      </div>
    </div>
  );
}