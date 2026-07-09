"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  account_name: string | null;
  dept_id: string | null;
  dept_name: string | null;
  request_type: string | null;
  personal_category: string | null;
};

type ProfileRole = {
  id: string;
  profile_id: string;
  role_key: string;
  role_name: string;
  is_primary: boolean;
  is_active: boolean;
};

type CategoryFilter =
  | "ALL"
  | "Fund"
  | "Leave"
  | "Contract Renewal"
  | "Resignation"
  | "Others"
  | "NonFund";

type StatusFilter =
  | "ALL"
  | "InProgress"
  | "InitialHRReview"
  | "ReadyForHRFiling"
  | "Completed"
  | "Rejected";

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function normalize(v: string | null | undefined) {
  return (v || "").toLowerCase().replace(/[^a-z]/g, "");
}

function stageKey(stage: string | null | undefined) {
  return (stage || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function categoryKey(v: string | null | undefined) {
  return (v || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function shortDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function naira(n: number | null | undefined) {
  return "₦" + Math.round(Number(n || 0)).toLocaleString();
}

function hasAnyRole(roleSet: Set<string>, roles: string[]) {
  return roles.some((r) => roleSet.has(roleKey(r)));
}

function isPersonal(r: ReqRow) {
  return normalize(r.request_type) === "personal";
}

function isPersonalFund(r: ReqRow) {
  return isPersonal(r) && categoryKey(r.personal_category) === "FUND";
}

function isCompleted(r: ReqRow) {
  const s = (r.status || "").toLowerCase();
  const stg = stageKey(r.current_stage);

  return (
    stg === "COMPLETED" ||
    s.includes("complete") ||
    s.includes("paid") ||
    s.includes("closed")
  );
}

function isRejected(r: ReqRow) {
  const s = (r.status || "").toLowerCase();
  const stg = stageKey(r.current_stage);

  return (
    stg === "REJECTED" ||
    stg === "DELETED" ||
    stg === "CANCELLED" ||
    s.includes("reject") ||
    s.includes("delete") ||
    s.includes("cancel")
  );
}

function isReadyForHRFiling(r: ReqRow) {
  const stage = stageKey(r.current_stage);
  const status = (r.status || "").toLowerCase();

  return stage === "HRFILING" || status.includes("filing");
}

function isAtInitialHRReview(r: ReqRow) {
  return stageKey(r.current_stage) === "HR";
}

function categoryLabel(r: ReqRow) {
  if (isPersonalFund(r)) return "Personal Fund";

  const cat = String(r.personal_category || "").trim();

  if (!cat || categoryKey(cat) === "NONFUND") return "Personal Other";

  return `Personal ${cat}`;
}

function categoryShortLabel(r: ReqRow) {
  if (isPersonalFund(r)) return "Fund";

  const cat = String(r.personal_category || "").trim();

  if (!cat || categoryKey(cat) === "NONFUND") return "Other";

  return cat;
}

function statusBadgeClass(status: string | null | undefined) {
  const s = (status || "").toLowerCase();

  if (s.includes("paid") || s.includes("complete") || s.includes("closed")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (s.includes("reject") || s.includes("delete") || s.includes("cancel")) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (s.includes("filing")) {
    return "border-purple-200 bg-purple-50 text-purple-700";
  }

  if (s.includes("review") || s.includes("approve") || s.includes("pending")) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function stageBadgeClass(stage: string | null | undefined) {
  const s = stageKey(stage);

  if (s === "COMPLETED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s === "ACCOUNT") return "border-amber-200 bg-amber-50 text-amber-700";
  if (s === "HRFILING") return "border-purple-200 bg-purple-50 text-purple-700";
  if (s === "DG") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  if (s === "HR") return "border-blue-200 bg-blue-50 text-blue-700";
  if (s === "DOD") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s === "HOD") return "border-cyan-200 bg-cyan-50 text-cyan-700";

  if (["REJECTED", "DELETED", "CANCELLED"].includes(s)) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function stageLabel(stage: string | null | undefined) {
  const s = stageKey(stage);

  if (s === "HRFILING") return "HR Filing";
  if (s === "ACCOUNT") return "AccountOfficer";
  if (s === "DOD") return "DOD";
  if (s === "HOD") return "HOD";
  if (s === "HR") return "HR";
  if (s === "DG") return "DG";
  if (s === "COMPLETED") return "Completed";

  return stage || "—";
}

function categoryBadgeClass(r: ReqRow) {
  const cat = categoryKey(r.personal_category);

  if (cat === "FUND") return "border-blue-200 bg-blue-50 text-blue-700";
  if (cat === "LEAVE") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (cat === "CONTRACTRENEWAL") return "border-purple-200 bg-purple-50 text-purple-700";
  if (cat === "RESIGNATION") return "border-red-200 bg-red-50 text-red-700";
  if (cat === "OTHERS") return "border-amber-200 bg-amber-50 text-amber-800";

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function workflowNote(r: ReqRow) {
  const stg = stageKey(r.current_stage);

  if (isPersonalFund(r)) {
    if (stg === "DOD") return "Personal Fund is with DOD before HR.";
    if (stg === "HOD") return "ASAP-ALLI Personal Fund is with HOD before HR.";
    if (stg === "HR") return "Personal Fund is at initial HR review.";
    if (stg === "DG") return "Personal Fund is with DG before AccountOfficer.";
    if (stg === "ACCOUNT") return "Personal Fund is with AccountOfficer for payment.";
    if (stg === "HRFILING") return "Personal Fund has returned to HR for final filing.";
    if (stg === "COMPLETED") return "Personal Fund request is completed and filed.";

    return "Personal Fund route: DOD/HOD → HR → DG → AccountOfficer → HR Filing → Completed.";
  }

  if (stg === "DOD") return "Personal request is with DOD before HR.";
  if (stg === "HOD") return "ASAP-ALLI Personal request is with HOD before HR.";
  if (stg === "HR") return "Personal request is at initial HR review.";
  if (stg === "DG") return "Personal request is with DG before HR Filing.";
  if (stg === "HRFILING") return "Personal request has returned to HR for final filing.";
  if (stg === "COMPLETED") return "Personal request is completed and filed.";

  return "Personal route: DOD/HOD → HR → DG → HR Filing → Completed.";
}

function amountLabel(r: ReqRow) {
  if (!isPersonalFund(r)) return "Not Applicable";
  return naira(r.amount);
}

function roleSummary(fallbackRole: string, roles: ProfileRole[]) {
  const active = roles.filter((r) => r.is_active);

  if (active.length === 0) return fallbackRole || "Staff";

  return active
    .slice()
    .sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return a.role_name.localeCompare(b.role_name);
    })
    .map((r) => r.role_name)
    .join(", ");
}

export default function HRFilingPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [myRole, setMyRole] = useState<string>("Staff");
  const [myRoles, setMyRoles] = useState<ProfileRole[]>([]);
  const [rows, setRows] = useState<ReqRow[]>([]);

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const roleSet = useMemo(() => {
    const set = new Set<string>();

    if (myRole) set.add(roleKey(myRole));

    myRoles.forEach((r) => {
      if (r.is_active) set.add(roleKey(r.role_key));
    });

    return set;
  }, [myRole, myRoles]);

  const canAccess = useMemo(() => {
    return hasAnyRole(roleSet, [
      "admin",
      "auditor",
      "hr",
      "hrofficer1",
      "hrofficer2",
      "hrofficer3",
    ]);
  }, [roleSet]);

  function openWorkflow(id: string) {
    router.push(`/requests/${id}?updated=${Date.now()}`);
    router.refresh();
  }

  function openTemplate(id: string) {
    router.push(`/requests/${id}/print?updated=${Date.now()}`);
    router.refresh();
  }

  function goDashboard() {
    router.push(`/dashboard?updated=${Date.now()}`);
    router.refresh();
  }

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

      const [profRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle(),

        supabase
          .from("profile_roles")
          .select("id,profile_id,role_key,role_name,is_primary,is_active")
          .eq("profile_id", auth.user.id)
          .eq("is_active", true),
      ]);

      if (profRes.error) {
        setMsg("Failed to load your profile: " + profRes.error.message);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const fallbackRole = (profRes.data?.role || "Staff") as string;
      const activeRoles = (rolesRes.data || []) as ProfileRole[];

      setMyRole(fallbackRole);
      setMyRoles(activeRoles);

      const nextRoleSet = new Set<string>();

      if (fallbackRole) nextRoleSet.add(roleKey(fallbackRole));

      activeRoles.forEach((r) => {
        if (r.is_active) nextRoleSet.add(roleKey(r.role_key));
      });

      const allowed = hasAnyRole(nextRoleSet, [
        "admin",
        "auditor",
        "hr",
        "hrofficer1",
        "hrofficer2",
        "hrofficer3",
      ]);

      if (!allowed) {
        setMsg("Access denied. Only HR, HR Officers, Admin and Auditor can access HR Filing.");
        setRows([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const { data, error } = await supabase.rpc("get_hr_filing_requests");

      if (error) {
        setMsg("Failed to load HR filing requests: " + error.message);
        setRows([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setRows(((data || []) as ReqRow[]).filter(isPersonal));
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
      if (!isPersonal(r)) return false;

      if (deptFilter !== "ALL" && r.dept_id !== deptFilter) return false;

      if (categoryFilter !== "ALL") {
        if (categoryKey(r.personal_category) !== categoryKey(categoryFilter)) return false;
      }

      if (statusFilter === "Completed" && !isCompleted(r)) return false;
      if (statusFilter === "ReadyForHRFiling" && !isReadyForHRFiling(r)) return false;
      if (statusFilter === "InitialHRReview" && !isAtInitialHRReview(r)) return false;

      if (statusFilter === "InProgress") {
        if (isCompleted(r) || isRejected(r)) return false;
      }

      if (statusFilter === "Rejected" && !isRejected(r)) return false;

      if (s) {
        const haystack = [
          r.request_no,
          r.title,
          r.details,
          r.requester_name,
          r.checked_by_name,
          r.hr_name,
          r.dg_name,
          r.account_name,
          r.dept_name,
          r.status,
          r.current_stage,
          r.personal_category,
          workflowNote(r),
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(s)) return false;
      }

      return true;
    });
  }, [rows, search, deptFilter, categoryFilter, statusFilter]);

  const stats = useMemo(() => {
    const personalRows = rows.filter(isPersonal);

    const total = personalRows.length;
    const fund = personalRows.filter(isPersonalFund).length;
    const leave = personalRows.filter((r) => categoryKey(r.personal_category) === "LEAVE").length;
    const contractRenewal = personalRows.filter(
      (r) => categoryKey(r.personal_category) === "CONTRACTRENEWAL"
    ).length;
    const resignation = personalRows.filter(
      (r) => categoryKey(r.personal_category) === "RESIGNATION"
    ).length;
    const others = personalRows.filter((r) => categoryKey(r.personal_category) === "OTHERS").length;
    const legacyOther = personalRows.filter(
      (r) => !r.personal_category || categoryKey(r.personal_category) === "NONFUND"
    ).length;

    const readyForHRFiling = personalRows.filter(isReadyForHRFiling).length;
    const initialHRReview = personalRows.filter(isAtInitialHRReview).length;
    const completed = personalRows.filter(isCompleted).length;

    const thisMonth = personalRows.filter((r) => {
      const d = new Date(r.created_at);
      const now = new Date();

      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;

    return {
      total,
      fund,
      leave,
      contractRenewal,
      resignation,
      others,
      legacyOther,
      readyForHRFiling,
      initialHRReview,
      completed,
      thisMonth,
    };
  }, [rows]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-7xl py-10 text-slate-600">
          Loading HR filing requests...
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
              onClick={goDashboard}
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
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">HR Filing</h1>
            <p className="mt-2 text-sm text-slate-600">
              HR register for Staff Personal Fund, Leave, Contract Renewal, Resignation and Others.
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Active capacity: <b className="text-slate-800">{roleSummary(myRole, myRoles)}</b>
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Personal Fund returns to HR Filing after AccountOfficer treatment. Other Personal
              requests return to HR Filing after DG approval.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => load({ silent: true })}
              disabled={refreshing}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={goDashboard}
              disabled={refreshing}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 disabled:opacity-60"
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

        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-900">
          This HR Filing page refreshes automatically when you return to it, so completed requests
          and filing-ready items stay current.
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-11">
          <StatCard title="Total Personal" value={String(stats.total)} tone="blue" />
          <StatCard title="Fund" value={String(stats.fund)} tone="blue" />
          <StatCard title="Leave" value={String(stats.leave)} tone="emerald" />
          <StatCard title="Contract" value={String(stats.contractRenewal)} tone="purple" />
          <StatCard title="Resignation" value={String(stats.resignation)} tone="red" />
          <StatCard title="Others" value={String(stats.others)} tone="amber" />
          <StatCard title="Legacy Other" value={String(stats.legacyOther)} tone="slate" />
          <StatCard title="HR Review" value={String(stats.initialHRReview)} tone="blue" />
          <StatCard title="HR Filing" value={String(stats.readyForHRFiling)} tone="amber" />
          <StatCard title="Completed" value={String(stats.completed)} tone="emerald" />
          <StatCard title="This Month" value={String(stats.thisMonth)} tone="slate" />
        </div>

        <div className="mt-6 rounded-3xl border bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
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
              <label className="text-sm font-semibold text-slate-800">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Personal Categories</option>
                <option value="Fund">Personal Fund</option>
                <option value="Leave">Leave</option>
                <option value="Contract Renewal">Contract Renewal</option>
                <option value="Resignation">Resignation</option>
                <option value="Others">Others</option>
                <option value="NonFund">Legacy Personal Other</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="InProgress">In Progress</option>
                <option value="InitialHRReview">Initial HR Review</option>
                <option value="ReadyForHRFiling">Ready for HR Filing</option>
                <option value="Completed">Completed / Paid</option>
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
                    <div className="text-lg font-extrabold text-slate-900">{r.request_no}</div>
                    <div className="mt-1 font-semibold text-slate-800">{r.title}</div>
                    <div className="mt-1 text-sm text-slate-500">{r.dept_name || "—"}</div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${categoryBadgeClass(
                        r
                      )}`}
                    >
                      {categoryLabel(r)}
                    </span>

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
                      {stageLabel(r.current_stage)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-900">
                  {workflowNote(r)}
                </div>

                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <InfoLine label="Requester" value={r.requester_name || "—"} />
                  <InfoLine label="Amount" value={amountLabel(r)} />
                  <InfoLine label="DOD/HOD" value={r.checked_by_name || "—"} />
                  <InfoLine label="HR Review" value={r.hr_name || "—"} />
                  <InfoLine label="DG" value={r.dg_name || "—"} />
                  <InfoLine
                    label="Account"
                    value={isPersonalFund(r) ? r.account_name || "—" : "Not Applicable"}
                  />
                  <InfoLine label="Created" value={shortDate(r.created_at)} />
                  <InfoLine label="Stage" value={stageLabel(r.current_stage)} />
                </div>

                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="font-semibold text-slate-900">Details</div>
                  <div className="mt-1 line-clamp-3 whitespace-pre-wrap">{r.details}</div>
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    onClick={() => openWorkflow(r.id)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    View Workflow
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

        <div className="mt-6 hidden overflow-hidden rounded-3xl border bg-white shadow-sm xl:block">
          <div className="border-b bg-slate-50 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-900">Personal Requests Register</h2>
            <p className="mt-1 text-sm text-slate-600">
              HR register for Personal Fund, Leave, Contract Renewal, Resignation and Others.
            </p>
          </div>

          {filteredRows.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1320px]">
                <div className="grid grid-cols-[1.25fr_2fr_1.45fr_1fr_1fr_1fr_1fr_1.45fr_1fr_0.85fr_1fr] bg-slate-100 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <div>Request No</div>
                  <div>Title</div>
                  <div>Department</div>
                  <div>Category</div>
                  <div>Amount</div>
                  <div>Status</div>
                  <div>Stage</div>
                  <div>Requester</div>
                  <div>HR</div>
                  <div>Date</div>
                  <div className="text-right">Action</div>
                </div>

                {filteredRows.map((r) => (
                  <div
                    key={r.id}
                    className="grid grid-cols-[1.25fr_2fr_1.45fr_1fr_1fr_1fr_1fr_1.45fr_1fr_0.85fr_1fr] items-center border-t px-6 py-4 text-sm hover:bg-slate-50"
                  >
                    <div className="font-extrabold text-slate-900">{r.request_no}</div>

                    <div>
                      <div className="font-semibold text-slate-900">{r.title}</div>
                      <div className="mt-1 line-clamp-1 text-xs text-slate-500">{r.details}</div>
                    </div>

                    <div className="text-slate-700">{r.dept_name || "—"}</div>

                    <div>
                      <span
                        className={`rounded-full border px-2 py-1 text-[11px] font-bold ${categoryBadgeClass(
                          r
                        )}`}
                      >
                        {categoryShortLabel(r)}
                      </span>
                    </div>

                    <div className="font-semibold text-slate-900">{amountLabel(r)}</div>

                    <div>
                      <span
                        className={`rounded-full border px-2 py-1 text-[11px] font-bold ${statusBadgeClass(
                          r.status
                        )}`}
                      >
                        {r.status || "—"}
                      </span>
                    </div>

                    <div>
                      <span
                        className={`rounded-full border px-2 py-1 text-[11px] font-bold ${stageBadgeClass(
                          r.current_stage
                        )}`}
                      >
                        {stageLabel(r.current_stage)}
                      </span>
                    </div>

                    <div className="text-slate-700">{r.requester_name || "—"}</div>

                    <div className="text-slate-700">{r.hr_name || "—"}</div>

                    <div className="text-slate-600">{shortDate(r.created_at)}</div>

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openWorkflow(r.id)}
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
          <div className="font-bold">HR Personal Requests Note</div>
          <p className="mt-1">
            This page shows Staff Personal requests because every Personal request passes through
            HR. Personal Fund requests move to AccountOfficer after DG approval before returning to
            HR Filing. Leave, Contract Renewal, Resignation and Others move from DG directly to HR
            Filing.
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
  tone: "blue" | "emerald" | "purple" | "slate" | "amber" | "red";
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "purple"
        ? "bg-purple-50 text-purple-700"
        : tone === "amber"
          ? "bg-amber-50 text-amber-700"
          : tone === "red"
            ? "bg-red-50 text-red-700"
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
      No Personal request found for the selected filter.
    </div>
  );
}