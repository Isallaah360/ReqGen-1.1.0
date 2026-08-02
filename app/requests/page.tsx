"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ActionButton } from "@/app/components/ui/ReqGenUI";

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
type DateFilter = "ALL" | "7D" | "30D" | "90D" | "THIS_YEAR";
type SortMode = "NEWEST" | "OLDEST" | "AMOUNT_HIGH" | "AMOUNT_LOW" | "TITLE";

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
  const [dateFilter, setDateFilter] = useState<DateFilter>("ALL");
  const [sortMode, setSortMode] = useState<SortMode>("NEWEST");

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

      if (dateFilter !== "ALL") {
        const created = new Date(row.created_at).getTime();
        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;
        if (dateFilter === "7D" && created < now - 7 * day) return false;
        if (dateFilter === "30D" && created < now - 30 * day) return false;
        if (dateFilter === "90D" && created < now - 90 * day) return false;
        if (dateFilter === "THIS_YEAR" && new Date(row.created_at).getFullYear() !== new Date().getFullYear()) return false;
      }

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
  }, [rows, search, typeFilter, statusFilter, stageFilter, dateFilter]);

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      if (sortMode === "OLDEST") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortMode === "AMOUNT_HIGH") return Number(b.amount || 0) - Number(a.amount || 0);
      if (sortMode === "AMOUNT_LOW") return Number(a.amount || 0) - Number(b.amount || 0);
      if (sortMode === "TITLE") return String(a.title || "").localeCompare(String(b.title || ""));
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return copy;
  }, [filteredRows, sortMode]);

  const activeFilterCount = useMemo(() => {
    return [
      search.trim() ? 1 : 0,
      typeFilter !== "ALL" ? 1 : 0,
      statusFilter !== "ALL" ? 1 : 0,
      stageFilter !== "ALL" ? 1 : 0,
      dateFilter !== "ALL" ? 1 : 0,
    ].reduce((sum, value) => sum + value, 0);
  }, [search, typeFilter, statusFilter, stageFilter, dateFilter]);

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
    setDateFilter("ALL");
    setSortMode("NEWEST");
  }


  function exportCsv() {
    const escape = (value: unknown) => {
      const text = String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    };

    const header = [
      "Request No",
      "Title",
      "Type",
      "Stage",
      "Status",
      "Amount",
      "Funds State",
      "Account Officer",
      "Created At",
    ];

    const body = sortedRows.map((row) => [
      row.request_no,
      row.title,
      requestTypeLabel(row),
      stageLabel(row.current_stage),
      row.status,
      requestGroup(row) === "PERSONAL_OTHER" ? "Not Applicable" : Number(row.amount || 0),
      row.funds_state || "",
      row.assigned_account_officer_name || "",
      new Date(row.created_at).toLocaleString(),
    ]);

    const csv = [header, ...body].map((line) => line.map(escape).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `reqgen-my-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-slate-50/80 pb-14">
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 text-white">
        <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute -right-16 -top-20 h-80 w-80 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-40 w-96 -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl animate-[fadeUp_.55s_ease-out]">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-cyan-100 backdrop-blur">
                <Icon name="workflow" className="h-4 w-4" />
                Request Operations
              </div>
              <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                Request Management Centre
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
                Create, track and monitor your official and personal requests through every authorised approval stage.
              </p>
            </div>

            <div className="grid w-full grid-cols-1 gap-3 animate-[fadeUp_.65s_ease-out] sm:grid-cols-3 lg:w-auto">
              <ActionButton
                type="button"
                tone="ghost"
                onClick={() => load({ silent: true })}
                disabled={refreshing || loading}
                icon={<Icon name="refresh" className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />}
              >
                {refreshing ? "Refreshing" : "Refresh"}
              </ActionButton>

              <ActionButton
                type="button"
                tone="violet"
                onClick={exportCsv}
                disabled={sortedRows.length === 0}
                icon={<Icon name="download" className="h-4 w-4" />}
              >
                Export CSV
              </ActionButton>

              <ActionButton
                type="button"
                tone="secondary"
                className="!border-orange-500 !bg-orange-500 !text-white [&_*]:!text-white !shadow-lg !shadow-orange-950/20 hover:!border-orange-400 hover:!bg-orange-400 focus-visible:!ring-orange-200"
                onClick={() => router.push(`/requests/new?updated=${Date.now()}`)}
                icon={<Icon name="plus" className="h-4 w-4" />}
              >
                New Request
              </ActionButton>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <section className="relative -mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Requests" value={counts.total} tone="blue" icon="inbox" delay="0ms" />
          <StatCard label="Active Workflow" value={counts.active} tone="cyan" icon="clock" delay="70ms" />
          <StatCard label="Completed / Paid" value={counts.completed} tone="emerald" icon="check" delay="140ms" />
          <StatCard label="Rejected / Deleted" value={counts.rejectedOrDeleted} tone="rose" icon="x" delay="210ms" />
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-3">
          <CategoryCard label="Official Requests" value={counts.official} tone="blue" icon="briefcase" />
          <CategoryCard label="Personal Fund" value={counts.personalFund} tone="violet" icon="wallet" />
          <CategoryCard label="Personal Other" value={counts.personalOther} tone="emerald" icon="user" />
        </section>

        <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                  <Icon name="route" className="h-4 w-4" />
                  Live Workflow Distribution
                </div>
                <h2 className="mt-1 text-xl font-black text-slate-950">Current approval stages</h2>
              </div>
              <div className="text-sm font-semibold text-slate-500">{counts.active.toLocaleString()} request(s) currently in progress</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3 lg:grid-cols-9">
            <StageTile label="PO" value={counts.po} icon="userCheck" />
            <StageTile label="DOD" value={counts.dod} icon="building" />
            <StageTile label="DIN Admin" value={counts.dinAdmin} icon="shield" />
            <StageTile label="Registrar" value={counts.registrar} icon="file" />
            <StageTile label="HOD" value={counts.hod} icon="users" />
            <StageTile label="HR" value={counts.hr} icon="badge" />
            <StageTile label="DG" value={counts.dg} icon="crown" />
            <StageTile label="Account" value={counts.account} icon="calculator" />
            <StageTile label="HR Filing" value={counts.hrFiling} icon="archive" />
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatusTab label="All Requests" value={counts.total} active={statusFilter === "ALL"} tone="slate" onClick={() => setStatusFilter("ALL")} />
            <StatusTab label="Active Workflow" value={counts.active} active={statusFilter === "ACTIVE"} tone="blue" onClick={() => setStatusFilter("ACTIVE")} />
            <StatusTab label="Completed / Paid" value={counts.completed} active={statusFilter === "COMPLETED"} tone="emerald" onClick={() => setStatusFilter("COMPLETED")} />
            <StatusTab label="Rejected / Deleted" value={counts.rejectedOrDeleted} active={statusFilter === "REJECTED"} tone="rose" onClick={() => setStatusFilter("REJECTED")} />
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.55fr)_repeat(5,minmax(140px,1fr))_auto] xl:items-end">
            <div className="min-w-0">
              <label className="flex items-center gap-2 text-sm font-black text-slate-800">
                <Icon name="search" className="h-4 w-4 text-blue-600" /> Search requests
              </label>
              <div className="relative mt-2">
                <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Request number, title, stage, type or officer..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            <FilterSelect label="Request Type" value={typeFilter} onChange={(value) => setTypeFilter(value as TypeFilter)} options={[
              ["ALL", "All Types"], ["OFFICIAL", "Official"], ["PERSONAL_FUND", "Personal Fund"], ["PERSONAL_OTHER", "Personal Other"]
            ]} />
            <FilterSelect label="Status" value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} options={[
              ["ALL", "All Statuses"], ["ACTIVE", "Active / In Progress"], ["COMPLETED", "Completed / Paid"], ["REJECTED", "Rejected / Deleted"]
            ]} />
            <FilterSelect label="Stage" value={stageFilter} onChange={(value) => setStageFilter(value as StageFilter)} options={[
              ["ALL", "All Stages"], ["PO", "PO"], ["DOD", "DOD"], ["DINADMIN", "DIN Admin"], ["REGISTRAR", "Registrar"], ["HOD", "HOD"], ["HR", "HR"], ["DG", "DG"], ["ACCOUNT", "Account Officer"], ["HRFILING", "HR Filing"], ["COMPLETED", "Completed"]
            ]} />
            <FilterSelect label="Date" value={dateFilter} onChange={(value) => setDateFilter(value as DateFilter)} options={[
              ["ALL", "All Dates"], ["7D", "Last 7 Days"], ["30D", "Last 30 Days"], ["90D", "Last 90 Days"], ["THIS_YEAR", "This Year"]
            ]} />
            <FilterSelect label="Sort By" value={sortMode} onChange={(value) => setSortMode(value as SortMode)} options={[
              ["NEWEST", "Newest First"], ["OLDEST", "Oldest First"], ["AMOUNT_HIGH", "Highest Amount"], ["AMOUNT_LOW", "Lowest Amount"], ["TITLE", "Title A-Z"]
            ]} />
            <button type="button" onClick={resetFilters} className="reqgen-btn reqgen-btn-cyan inline-flex h-[46px] min-w-[120px] items-center justify-center gap-2 rounded-xl border border-cyan-600 bg-cyan-600 px-4 text-sm font-extrabold !text-white shadow-lg shadow-cyan-950/20 transition hover:-translate-y-0.5 hover:border-cyan-500 hover:bg-cyan-500 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200 [&_*]:!text-white">
              <Icon name="filterX" className="h-4 w-4" /> Reset{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>
          </div>
        </section>

        {msg && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
            {msg}
          </div>
        )}

        {loading ? (
          <RequestsSkeleton />
        ) : sortedRows.length === 0 ? (
          <section className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Icon name="inbox" className="h-8 w-8" />
            </div>
            <h3 className="mt-5 text-xl font-black text-slate-900">No requests found</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">No record matches the selected filters. Reset the filters or create a new request.</p>
            <button type="button" onClick={resetFilters} className="reqgen-btn reqgen-btn-cyan mt-5 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800">Reset Filters</button>
          </section>
        ) : (
          <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Request Register</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Your submitted requests</h2>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">{sortedRows.length.toLocaleString()} record(s)</div>
            </div>

            <div className="hidden grid-cols-12 border-b border-slate-100 bg-slate-50 px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500 lg:grid">
              <div className="col-span-2">Request</div><div className="col-span-3">Title & Workflow</div><div className="col-span-2">Type</div><div className="col-span-1">Stage</div><div className="col-span-1">Status</div><div className="col-span-1 text-right">Amount</div><div className="col-span-2 text-right">Actions</div>
            </div>

            <div className="divide-y divide-slate-100">
              {sortedRows.map((r, index) => (
                <article key={r.id} className="group px-5 py-5 transition hover:bg-blue-50/40 sm:px-6" style={{ animation: `fadeUp .45s ease-out ${Math.min(index * 35, 350)}ms both` }}>
                  <div className="grid gap-4 lg:grid-cols-12 lg:items-center">
                    <div className="lg:col-span-2">
                      <button type="button" onClick={() => openRequest(r.id)} className="flex items-center gap-3 text-left">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 transition group-hover:scale-105 group-hover:bg-blue-700 group-hover:text-white"><Icon name="file" className="h-5 w-5" /></span>
                        <span><span className="block text-sm font-black text-slate-950 hover:text-blue-700">{r.request_no || "—"}</span><span className="mt-0.5 block text-[11px] font-semibold text-slate-500">{new Date(r.created_at).toLocaleDateString()}</span></span>
                      </button>
                    </div>
                    <div className="min-w-0 lg:col-span-3">
                      <h3 className="truncate text-sm font-black text-slate-900">{r.title || "—"}</h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{workflowNote(r)}</p>
                      {r.assigned_account_officer_name && <p className="mt-1 text-[11px] font-bold text-purple-700">Officer: {r.assigned_account_officer_name}</p>}
                    </div>
                    <div className="lg:col-span-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800"><Icon name={requestGroup(r) === "OFFICIAL" ? "briefcase" : "user"} className="h-3.5 w-3.5" />{requestTypeLabel(r)}</span></div>
                    <div className="lg:col-span-1"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${stageClass(r.current_stage)}`}>{stageLabel(r.current_stage)}</span></div>
                    <div className="lg:col-span-1"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${statusClass(r.status)}`}>{r.status || "—"}</span></div>
                    <div className="text-sm font-black text-slate-950 lg:col-span-1 lg:text-right">{amountLabel(r)}</div>
                    <div className="flex flex-wrap gap-2 lg:col-span-2 lg:justify-end">
                      <button type="button" onClick={() => openRequest(r.id)} className="reqgen-btn reqgen-btn-blue inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-800"><Icon name="eye" className="h-3.5 w-3.5" /> View</button>
                      <button type="button" onClick={() => printRequest(r.id)} className="reqgen-btn reqgen-btn-violet inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-purple-200 hover:bg-purple-50 hover:text-purple-800"><Icon name="print" className="h-3.5 w-3.5" /> Print</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>

      <style jsx global>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </main>
  );
}

type IconName = "workflow" | "refresh" | "download" | "plus" | "inbox" | "clock" | "check" | "x" | "briefcase" | "wallet" | "user" | "route" | "userCheck" | "building" | "shield" | "file" | "users" | "badge" | "crown" | "calculator" | "archive" | "search" | "filterX" | "alert" | "eye" | "print";

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    workflow: <><path d="M4 6h7"/><path d="M4 12h11"/><path d="M4 18h7"/><path d="m15 6 2 2 3-3"/><path d="m17 16 3 3"/><path d="m20 16-3 3"/></>,
    refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></>,
    download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>, inbox: <><path d="M4 5h16v14H4z"/><path d="M4 13h4l2 3h4l2-3h4"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>, x: <><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/></>,
    briefcase: <><rect x="3" y="7" width="18" height="12" rx="2"/><path d="M8 7V5h8v2M3 12h18"/></>, wallet: <><path d="M4 6h14a2 2 0 0 1 2 2v10H4z"/><path d="M4 6a2 2 0 0 1 2-2h11"/><path d="M16 12h4"/></>, user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    route: <><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3"/></>, userCheck: <><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="m16 12 2 2 3-4"/></>, building: <><path d="M4 21V7l8-4 8 4v14"/><path d="M8 10h1M8 14h1M15 10h1M15 14h1M10 21v-4h4v4"/></>, shield: <><path d="M12 3 5 6v5c0 4.5 2.8 7.6 7 9.5 4.2-1.9 7-5 7-9.5V6z"/><path d="m9 12 2 2 4-5"/></>, file: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></>, users: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 15a5 5 0 0 1 7 4"/></>, badge: <><circle cx="12" cy="8" r="5"/><path d="m8 12-2 9 6-3 6 3-2-9"/></>, crown: <><path d="m4 8 4 4 4-7 4 7 4-4-2 11H6z"/></>, calculator: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h1M12 11h1M16 11h1M8 15h1M12 15h1M16 15h1"/></>, archive: <><path d="M4 7h16v14H4zM3 3h18v4H3zM9 11h6"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>, filterX: <><path d="M4 5h16M7 12h10M10 19h4"/><path d="m18 15 4 4M22 15l-4 4"/></>, alert: <><path d="M12 3 2 21h20z"/><path d="M12 9v5M12 18h.01"/></>, eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/></>, print: <><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name]}</svg>;
}

function StatCard({ label, value, tone, icon, delay }: { label: string; value: number; tone: "blue" | "cyan" | "emerald" | "rose"; icon: IconName; delay: string }) {
  const styles = { blue: "border-blue-200 bg-blue-50 text-blue-800", cyan: "border-cyan-200 bg-cyan-50 text-cyan-800", emerald: "border-emerald-200 bg-emerald-50 text-emerald-800", rose: "border-rose-200 bg-rose-50 text-rose-800" }[tone];
  return <div className={`rounded-2xl border p-4 shadow-lg shadow-slate-900/5 backdrop-blur transition hover:-translate-y-1 hover:shadow-xl ${styles}`} style={{ animation: `fadeUp .5s ease-out ${delay} both` }}><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider opacity-75">{label}</p><p className="mt-2 text-3xl font-black leading-none">{Number(value || 0).toLocaleString()}</p></div><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/75 shadow-sm"><Icon name={icon} className="h-6 w-6" /></span></div></div>;
}

function CategoryCard({ label, value, tone, icon }: { label: string; value: number; tone: "blue" | "violet" | "emerald"; icon: IconName }) {
  const styles = { blue: "from-blue-600 to-blue-700", violet: "from-violet-600 to-purple-700", emerald: "from-emerald-600 to-teal-700" }[tone];
  return <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${styles} p-5 text-white shadow-lg`}><div className="absolute -right-5 -top-5 h-24 w-24 rounded-full bg-white/10 blur-xl"/><div className="relative flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-white/75">{label}</p><p className="mt-2 text-3xl font-black">{value.toLocaleString()}</p></div><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur"><Icon name={icon} className="h-6 w-6" /></span></div></div>;
}

function StageTile({ label, value, icon }: { label: string; value: number; icon: IconName }) {
  return <div className="bg-white px-3 py-4 text-center transition hover:bg-blue-50"><span className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Icon name={icon} className="h-4 w-4" /></span><p className="mt-2 text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-slate-950">{value.toLocaleString()}</p></div>;
}

function StatusTab({ label, value, active, tone, onClick }: { label: string; value: number; active: boolean; tone: "slate" | "blue" | "emerald" | "rose"; onClick: () => void }) {
  const tones = {
    slate: "bg-slate-700 hover:bg-slate-600 focus-visible:ring-slate-200",
    blue: "bg-blue-700 hover:bg-blue-600 focus-visible:ring-blue-200",
    emerald: "bg-emerald-700 hover:bg-emerald-600 focus-visible:ring-emerald-200",
    rose: "bg-rose-700 hover:bg-rose-600 focus-visible:ring-rose-200",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left !text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 [&_*]:!text-white ${tones} ${active ? "border-white/60 shadow-xl ring-2 ring-white/80 ring-offset-2 ring-offset-slate-100" : "border-transparent"}`}
    >
      <span className="text-sm font-black !text-white">{label}</span>
      <span className="rounded-lg border border-white/20 bg-white/20 px-2.5 py-1 text-sm font-black !text-white shadow-sm">{value.toLocaleString()}</span>
    </button>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return <div className="min-w-0 w-full"><label className="block text-sm font-black text-slate-800">{label}</label><select value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 h-[46px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100">{options.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>;
}

function RequestsSkeleton() {
  return <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="h-20 animate-pulse border-b border-slate-100 bg-slate-100/80 blur-[1px]"/><div className="space-y-1 p-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="grid animate-pulse gap-4 rounded-2xl p-4 lg:grid-cols-12"><div className="h-11 rounded-xl bg-slate-200 lg:col-span-2"/><div className="h-11 rounded-xl bg-slate-200 lg:col-span-3"/><div className="h-8 rounded-full bg-slate-200 lg:col-span-2"/><div className="h-8 rounded-full bg-slate-200 lg:col-span-1"/><div className="h-8 rounded-full bg-slate-200 lg:col-span-1"/><div className="h-8 rounded-xl bg-slate-200 lg:col-span-1"/><div className="h-10 rounded-xl bg-slate-200 lg:col-span-2"/></div>)}</div></div>;
}
