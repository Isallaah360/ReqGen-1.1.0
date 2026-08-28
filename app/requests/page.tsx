"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
  dept_id?: string | null;
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
  const [departmentNames, setDepartmentNames] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

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
          "id,request_no,title,amount,status,current_stage,created_at,request_type,personal_category,funds_state,assigned_account_officer_name,dept_id"
        )
        .eq("created_by", auth.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setMsg("Failed to load requests: " + error.message);
        setRows([]);
      } else {
        setRows((data || []) as Row[]);
      }

      const deptIds = Array.from(new Set(((data || []) as Row[]).map((row) => row.dept_id).filter(Boolean))) as string[];
      if (deptIds.length > 0) {
        const { data: departments } = await supabase.from("departments").select("id,name").in("id", deptIds);
        setDepartmentNames(Object.fromEntries((departments || []).map((department: any) => [String(department.id), String(department.name || "Unassigned")])));
      } else {
        setDepartmentNames({});
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

  useEffect(() => { setPage(1); }, [search, typeFilter, statusFilter, stageFilter, dateFilter, sortMode]);

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

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <main className="req-mock-page">
      <section className="req-mock-header">
        <div>
          <h1>Requests</h1>
          <p>Create, track and manage all institutional requests in one place.</p>
        </div>
        <button
          type="button"
          className="req-mock-primary"
          onClick={() => router.push(`/requests/new?updated=${Date.now()}`)}
          data-tip="Create and submit a new request."
        >
          <Icon name="plus" className="h-4 w-4" />
          New Request
        </button>
      </section>

      <section className="req-mock-kpis" aria-label="Request summary">
        <MockKpi label="Total Requests" value={counts.total} icon="inbox" tone="blue" note="All submitted requests" />
        <MockKpi label="Active Workflow" value={counts.active} icon="clock" tone="orange" note="Currently in progress" />
        <MockKpi label="Completed / Paid" value={counts.completed} icon="check" tone="green" note="Successfully completed" />
        <MockKpi label="Official Requests" value={counts.official} icon="briefcase" tone="purple" note={`${counts.total ? Math.round((counts.official / counts.total) * 100) : 0}% of total`} />
        <MockKpi label="Rejected / Deleted" value={counts.rejectedOrDeleted} icon="x" tone="red" note="Closed without completion" />
      </section>

      <section className="req-mock-panel">
        <div className="req-mock-tabs" role="tablist" aria-label="Request views">
          <MockTab label="All Requests" count={counts.total} active={statusFilter === "ALL" && typeFilter === "ALL"} onClick={() => { setStatusFilter("ALL"); setTypeFilter("ALL"); }} />
          <MockTab label="Active Workflow" count={counts.active} active={statusFilter === "ACTIVE"} onClick={() => setStatusFilter("ACTIVE")} />
          <MockTab label="Completed / Paid" count={counts.completed} active={statusFilter === "COMPLETED"} onClick={() => setStatusFilter("COMPLETED")} />
          <MockTab label="Rejected / Deleted" count={counts.rejectedOrDeleted} active={statusFilter === "REJECTED"} onClick={() => setStatusFilter("REJECTED")} />
          <MockTab label="Official" count={counts.official} active={typeFilter === "OFFICIAL"} onClick={() => { setStatusFilter("ALL"); setTypeFilter("OFFICIAL"); }} />
          <MockTab label="Personal Fund" count={counts.personalFund} active={typeFilter === "PERSONAL_FUND"} onClick={() => { setStatusFilter("ALL"); setTypeFilter("PERSONAL_FUND"); }} />
          <MockTab label="Personal Other" count={counts.personalOther} active={typeFilter === "PERSONAL_OTHER"} onClick={() => { setStatusFilter("ALL"); setTypeFilter("PERSONAL_OTHER"); }} />
        </div>

        <div className="req-mock-filters">
          <label className="req-mock-search">
            <Icon name="search" className="h-4 w-4" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search requests..." />
          </label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} aria-label="Filter by status">
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed / Paid</option>
            <option value="REJECTED">Rejected / Deleted</option>
          </select>
          <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value as StageFilter)} aria-label="Filter by stage">
            <option value="ALL">All Stages</option>
            <option value="PO">PO</option><option value="DOD">DOD</option><option value="DINADMIN">DIN Admin</option>
            <option value="REGISTRAR">Registrar</option><option value="HOD">HOD</option><option value="HR">HR</option>
            <option value="DG">DG</option><option value="ACCOUNT">Account Officer</option><option value="HRFILING">HR Filing</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)} aria-label="Filter by request type">
            <option value="ALL">All Request Types</option>
            <option value="OFFICIAL">Official</option>
            <option value="PERSONAL_FUND">Personal Fund</option>
            <option value="PERSONAL_OTHER">Personal Other</option>
          </select>
          <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as DateFilter)} aria-label="Filter by date">
            <option value="ALL">Date Range</option>
            <option value="7D">Last 7 Days</option><option value="30D">Last 30 Days</option><option value="90D">Last 90 Days</option><option value="THIS_YEAR">This Year</option>
          </select>
          <button type="button" className="req-mock-export" onClick={exportCsv} disabled={sortedRows.length === 0} data-tip="Export the currently filtered requests as CSV.">
            <Icon name="download" className="h-4 w-4" /> Export
          </button>
        </div>

        {msg ? <div className="req-mock-alert"><Icon name="alert" className="h-4 w-4" />{msg}</div> : null}

        <div className="req-mock-table-wrap">
          <table className="req-mock-table">
            <thead>
              <tr>
                <th>Req Code</th>
                <th>Title</th>
                <th>Department</th>
                <th>Type</th>
                <th>Amount (₦)</th>
                <th>Status</th>
                <th>Requested On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => <MockLoadingRow key={index} />)
              ) : paginatedRows.length === 0 ? (
                <tr><td colSpan={8}><div className="req-mock-empty">No requests match the selected filters.</div></td></tr>
              ) : paginatedRows.map((row) => (
                <tr key={row.id}>
                  <td><strong className="req-code">{row.request_no || "—"}</strong></td>
                  <td><span className="req-title">{row.title || "Untitled Request"}</span></td>
                  <td>{row.dept_id ? departmentNames[row.dept_id] || "Unassigned" : "Unassigned"}</td>
                  <td><RequestTypePill row={row} /></td>
                  <td><strong>{amountLabel(row)}</strong></td>
                  <td><StatusPill row={row} /></td>
                  <td>{new Date(row.created_at).toLocaleString(undefined, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                  <td>
                    <div className="req-mock-actions">
                      <button type="button" onClick={() => openRequest(row.id)} aria-label={`View ${row.request_no}`} title="View"><Icon name="eye" className="h-4 w-4" /></button>
                      <button type="button" onClick={() => printRequest(row.id)} aria-label={`Print ${row.request_no}`} title="Print"><Icon name="file" className="h-4 w-4" /></button>
                      <button type="button" onClick={() => router.push(`/requests/${row.id}/edit`)} aria-label={`Edit ${row.request_no}`} title="Edit"><Icon name="more" className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="req-mock-pagination">
          <span>Showing {sortedRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, sortedRows.length)} of {sortedRows.length} entries</span>
          <div>
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1}>‹</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
              const pageNumber = index + 1;
              return <button type="button" key={pageNumber} className={pageNumber === currentPage ? "is-active" : ""} onClick={() => setPage(pageNumber)}>{pageNumber}</button>;
            })}
            {totalPages > 5 ? <span>…</span> : null}
            {totalPages > 5 ? <button type="button" className={currentPage === totalPages ? "is-active" : ""} onClick={() => setPage(totalPages)}>{totalPages}</button> : null}
            <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage === totalPages}>›</button>
          </div>
        </div>
      </section>
    </main>
  );
}

type IconName = "workflow" | "refresh" | "download" | "plus" | "inbox" | "clock" | "check" | "x" | "briefcase" | "wallet" | "user" | "route" | "userCheck" | "building" | "shield" | "file" | "users" | "badge" | "crown" | "calculator" | "archive" | "search" | "filterX" | "alert" | "eye" | "print" | "more";

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    workflow: <><path d="M4 6h7"/><path d="M4 12h11"/><path d="M4 18h7"/></>,
    refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></>,
    download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    inbox: <><path d="M4 5h16v14H4z"/><path d="M4 13h4l2 3h4l2-3h4"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
    x: <><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/></>,
    briefcase: <><rect x="3" y="7" width="18" height="12" rx="2"/><path d="M8 7V5h8v2M3 12h18"/></>,
    wallet: <><path d="M4 6h14a2 2 0 0 1 2 2v10H4z"/><path d="M16 12h4"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    route: <><path d="M5 6h14M5 12h14M5 18h14"/></>,
    userCheck: <><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/></>,
    building: <><path d="M4 21V7l8-4 8 4v14"/><path d="M8 10h1M15 10h1"/></>,
    shield: <><path d="M12 3 5 6v5c0 4.5 2.8 7.6 7 9.5 4.2-1.9 7-5 7-9.5V6z"/></>,
    file: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></>,
    users: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0"/></>,
    badge: <><circle cx="12" cy="8" r="5"/><path d="m8 12-2 9 4-2 2 2 2-2 4 2-2-9"/></>,
    crown: <><path d="m4 8 4 4 4-7 4 7 4-4-2 11H6z"/></>,
    calculator: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h1M12 11h1M16 11h1"/></>,
    archive: <><path d="M4 7h16v14H4zM3 3h18v4H3zM9 11h6"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    filterX: <><path d="M4 5h16M7 12h10M10 19h4"/></>,
    alert: <><path d="M12 3 2 21h20z"/><path d="M12 9v5M12 18h.01"/></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/></>,
    print: <><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/></>,
    more: <><circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name]}</svg>;
}

function MockKpi({ label, value, icon, tone, note }: { label: string; value: number; icon: IconName; tone: "blue" | "orange" | "green" | "purple" | "red"; note: string }) {
  return <article className="req-mock-kpi" data-tone={tone}><span className="req-mock-kpi-icon"><Icon name={icon} className="h-5 w-5" /></span><div><span className="req-mock-kpi-label">{label}</span><strong>{value.toLocaleString()}</strong><small>{note}</small></div></article>;
}

function MockTab({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return <button type="button" role="tab" aria-selected={active} className={active ? "is-active" : ""} onClick={onClick}><span>{label}</span><b>{count.toLocaleString()}</b></button>;
}

function RequestTypePill({ row }: { row: Row }) {
  const group = requestGroup(row);
  const cls = group === "OFFICIAL" ? "official" : group === "PERSONAL_FUND" ? "fund" : "other";
  return <span className={`req-type-pill ${cls}`}>{requestTypeLabel(row)}</span>;
}

function StatusPill({ row }: { row: Row }) {
  const status = String(row.status || "").toLowerCase();
  const cls = status.includes("reject") || status.includes("delete") ? "rejected" : isCompletedRequest(row) ? "approved" : status.includes("pending") ? "pending" : "progress";
  return <span className={`req-status-pill ${cls}`}>{row.status || stageLabel(row.current_stage)}</span>;
}

function MockLoadingRow() {
  return <tr className="req-loading-row">{Array.from({ length: 8 }).map((_, index) => <td key={index}><span /></td>)}</tr>;
}
