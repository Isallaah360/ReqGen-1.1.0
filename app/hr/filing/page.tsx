"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { HRNavigation } from "@/app/components/hr";

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

type HRView =
  | "OVERVIEW"
  | "IN_PROGRESS"
  | "HR_REVIEW"
  | "FILING"
  | "COMPLETED"
  | "REJECTED";

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
  const [activeView, setActiveView] = useState<HRView>("OVERVIEW");

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

      if (activeView === "IN_PROGRESS" && (isCompleted(r) || isRejected(r))) return false;
      if (activeView === "HR_REVIEW" && !isAtInitialHRReview(r)) return false;
      if (activeView === "FILING" && !isReadyForHRFiling(r)) return false;
      if (activeView === "COMPLETED" && !isCompleted(r)) return false;
      if (activeView === "REJECTED" && !isRejected(r)) return false;

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
  }, [rows, search, deptFilter, categoryFilter, statusFilter, activeView]);

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

  const departmentSummary = useMemo(() => {
    const map = new Map<string, { name: string; total: number; active: number; completed: number }>();

    rows.forEach((r) => {
      const key = r.dept_id || "unknown";
      const current = map.get(key) || {
        name: r.dept_name || "Unassigned Department",
        total: 0,
        active: 0,
        completed: 0,
      };

      current.total += 1;
      if (isCompleted(r)) current.completed += 1;
      else if (!isRejected(r)) current.active += 1;
      map.set(key, current);
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [rows]);

  const maxDepartmentTotal = Math.max(1, ...departmentSummary.map((d) => d.total));
  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const activeCount = rows.filter((r) => !isCompleted(r) && !isRejected(r)).length;
  const rejectedCount = rows.filter(isRejected).length;

  function resetFilters() {
    setSearch("");
    setDeptFilter("ALL");
    setCategoryFilter("ALL");
    setStatusFilter("ALL");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-7xl py-10 text-slate-600">Loading HR operations dashboard...</div>
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-3xl py-10">
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <h1 className="text-2xl font-black text-slate-950">HR Operations Access</h1>
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">
              {msg || "Access denied."}
            </div>
            <button onClick={goDashboard} className="reqgen-btn reqgen-btn-slate mt-5 rounded-xl px-5 py-3 text-sm font-black text-white">
              Back to Dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  const viewTabs: Array<{ key: HRView; label: string; count: number; cls: string }> = [
    { key: "OVERVIEW", label: "All HR Records", count: stats.total, cls: "reqgen-btn-slate" },
    { key: "IN_PROGRESS", label: "Active Workflow", count: activeCount, cls: "reqgen-btn-blue" },
    { key: "HR_REVIEW", label: "HR Review", count: stats.initialHRReview, cls: "reqgen-btn-cyan" },
    { key: "FILING", label: "Ready for Filing", count: stats.readyForHRFiling, cls: "reqgen-btn-violet" },
    { key: "COMPLETED", label: "Completed / Filed", count: stats.completed, cls: "reqgen-btn-emerald" },
    { key: "REJECTED", label: "Rejected / Closed", count: rejectedCount, cls: "reqgen-btn-rose" },
  ];

  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-12">
      <div className="mx-auto max-w-7xl py-8">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-6 text-white shadow-xl md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-indigo-100">
                Human Resources Intelligence
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">HR Operations Centre</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-indigo-100 md:text-base">
                A secure operational view of staff personal requests, HR review queues, filing readiness and departmental workload.
              </p>
              <p className="mt-3 text-xs font-bold text-indigo-200">
                Active capacity: <span className="text-white">{roleSummary(myRole, myRoles)}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button onClick={() => load({ silent: true })} disabled={refreshing} className="reqgen-btn reqgen-btn-cyan rounded-xl px-5 py-3 text-sm font-black text-white disabled:opacity-60">
                {refreshing ? "Refreshing..." : "Refresh HR Data"}
              </button>
              <button onClick={goDashboard} className="reqgen-btn reqgen-btn-slate rounded-xl px-5 py-3 text-sm font-black text-white">
                Main Dashboard
              </button>
            </div>
          </div>
        </section>

        <div className="mt-6"><HRNavigation /></div>

        {msg && <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm">{msg}</div>}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ExecutiveKpi title="Total HR Records" value={stats.total} note={`${stats.thisMonth} added this month`} tone="indigo" />
          <ExecutiveKpi title="Active Workflow" value={activeCount} note="Awaiting treatment or filing" tone="blue" />
          <ExecutiveKpi title="Ready for Filing" value={stats.readyForHRFiling} note="Final HR filing queue" tone="violet" />
          <ExecutiveKpi title="Completion Rate" value={`${completionRate}%`} note={`${stats.completed} completed / filed`} tone="emerald" />
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-wrap gap-3">
            {viewTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveView(tab.key)}
                className={`reqgen-btn ${tab.cls} inline-flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-black text-white ${activeView === tab.key ? "ring-4 ring-slate-900/10" : ""}`}
              >
                <span>{tab.label}</span>
                <span className="rounded-full border border-white/25 bg-white/20 px-2.5 py-1 text-xs font-black text-white">{tab.count}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-950">HR Workload by Category</h2>
                <p className="mt-1 text-sm text-slate-500">Live distribution of personal-request categories.</p>
              </div>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">{stats.total} records</span>
            </div>
            <div className="mt-5 space-y-4">
              <DistributionBar label="Personal Fund" value={stats.fund} total={stats.total} tone="blue" />
              <DistributionBar label="Leave" value={stats.leave} total={stats.total} tone="emerald" />
              <DistributionBar label="Contract Renewal" value={stats.contractRenewal} total={stats.total} tone="violet" />
              <DistributionBar label="Resignation" value={stats.resignation} total={stats.total} tone="rose" />
              <DistributionBar label="Others / Legacy" value={stats.others + stats.legacyOther} total={stats.total} tone="amber" />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Operational Intelligence</h2>
            <p className="mt-1 text-sm text-slate-500">Current HR queue signals requiring attention.</p>
            <div className="mt-5 grid gap-3">
              <InsightCard label="Initial HR review" value={stats.initialHRReview} note="Requests currently waiting at HR review" tone="blue" />
              <InsightCard label="Final filing queue" value={stats.readyForHRFiling} note="Approved requests ready to be filed" tone="violet" />
              <InsightCard label="Rejected / closed" value={rejectedCount} note="Records excluded from active workflow" tone="rose" />
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">Search & Filter HR Register</h2>
              <p className="mt-1 text-sm text-slate-500">Find staff personal requests by reference, requester, department, category or stage.</p>
            </div>
            <div className="text-sm font-bold text-slate-600">Showing {filteredRows.length} of {rows.length} records</div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
            <FilterField label="Search requests">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Request no, title, requester..." className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
            </FilterField>
            <FilterField label="Department">
              <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100">
                <option value="ALL">All Departments</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </FilterField>
            <FilterField label="Category">
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100">
                <option value="ALL">All Categories</option>
                <option value="Fund">Personal Fund</option>
                <option value="Leave">Leave</option>
                <option value="Contract Renewal">Contract Renewal</option>
                <option value="Resignation">Resignation</option>
                <option value="Others">Others</option>
                <option value="NonFund">Legacy Personal Other</option>
              </select>
            </FilterField>
            <FilterField label="Status">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100">
                <option value="ALL">All Statuses</option>
                <option value="InProgress">In Progress</option>
                <option value="InitialHRReview">Initial HR Review</option>
                <option value="ReadyForHRFiling">Ready for HR Filing</option>
                <option value="Completed">Completed / Paid</option>
                <option value="Rejected">Rejected</option>
              </select>
            </FilterField>
            <button onClick={resetFilters} className="reqgen-btn reqgen-btn-cyan min-h-12 rounded-xl px-5 py-3 text-sm font-black text-white xl:self-end">Reset Filters</button>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.42fr]">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-xl font-black text-slate-950">HR Personal Requests Register</h2>
              <p className="mt-1 text-sm text-slate-500">Operational queue and filing register for authorized HR users.</p>
            </div>

            {filteredRows.length === 0 ? <EmptyState /> : (
              <div className="divide-y divide-slate-100">
                {filteredRows.map((r) => (
                  <article key={r.id} className="p-5 transition hover:bg-slate-50">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-indigo-700">{r.request_no}</span>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${categoryBadgeClass(r)}`}>{categoryLabel(r)}</span>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${stageBadgeClass(r.current_stage)}`}>{stageLabel(r.current_stage)}</span>
                        </div>
                        <h3 className="mt-2 truncate text-lg font-black text-slate-950">{r.title}</h3>
                        <p className="mt-1 text-sm font-semibold text-slate-500">{r.requester_name || "Unknown requester"} · {r.dept_name || "Unassigned department"}</p>
                        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                          <InfoLine label="Created" value={shortDate(r.created_at)} />
                          <InfoLine label="HR Officer" value={r.hr_name || "—"} />
                          <InfoLine label="Amount" value={amountLabel(r)} />
                        </div>
                        <div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs font-bold leading-5 text-indigo-950">{workflowNote(r)}</div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                        <button onClick={() => openWorkflow(r.id)} className="reqgen-btn reqgen-btn-slate rounded-xl px-4 py-2.5 text-sm font-black text-white">View Workflow</button>
                        {isCompleted(r) && <button onClick={() => openTemplate(r.id)} className="reqgen-btn reqgen-btn-violet rounded-xl px-4 py-2.5 text-sm font-black text-white">Print / File</button>}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Department Workload</h2>
            <p className="mt-1 text-sm text-slate-500">Top departments by HR-related request volume.</p>
            <div className="mt-5 space-y-4">
              {departmentSummary.length === 0 ? <p className="text-sm text-slate-500">No department data available.</p> : departmentSummary.map((d) => (
                <div key={d.name}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-black text-slate-800">{d.name}</span>
                    <span className="font-black text-indigo-700">{d.total}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.max(6, Math.round((d.total / maxDepartmentTotal) * 100))}%` }} /></div>
                  <div className="mt-1 flex justify-between text-[11px] font-bold text-slate-500"><span>{d.active} active</span><span>{d.completed} completed</span></div>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="mt-6 rounded-3xl border border-indigo-100 bg-indigo-50 p-5 text-sm text-indigo-950">
          <div className="font-black">HR privacy and workflow notice</div>
          <p className="mt-1 font-medium leading-6">This centre is restricted to authorized HR, Admin and Auditor roles. Personal Fund requests pass through AccountOfficer before final HR filing; other personal-request categories return to HR Filing after DG approval.</p>
        </section>
      </div>
    </main>
  );
}

function ExecutiveKpi({ title, value, note, tone }: { title: string; value: string | number; note: string; tone: "indigo" | "blue" | "violet" | "emerald" }) {
  const cls = tone === "emerald" ? "from-emerald-500 to-emerald-700" : tone === "violet" ? "from-violet-500 to-violet-700" : tone === "blue" ? "from-blue-500 to-blue-700" : "from-indigo-500 to-indigo-700";
  return <div className={`rounded-3xl bg-gradient-to-br ${cls} p-5 text-white shadow-lg`}><div className="text-sm font-black text-white/85">{title}</div><div className="mt-3 text-4xl font-black tracking-tight">{value}</div><div className="mt-2 text-xs font-bold text-white/75">{note}</div></div>;
}

function DistributionBar({ label, value, total, tone }: { label: string; value: number; total: number; tone: "blue" | "emerald" | "violet" | "rose" | "amber" }) {
  const width = total > 0 ? Math.round((value / total) * 100) : 0;
  const cls = tone === "emerald" ? "bg-emerald-500" : tone === "violet" ? "bg-violet-500" : tone === "rose" ? "bg-rose-500" : tone === "amber" ? "bg-amber-500" : "bg-blue-500";
  return <div><div className="flex items-center justify-between text-sm"><span className="font-black text-slate-800">{label}</span><span className="font-black text-slate-600">{value} · {width}%</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${cls}`} style={{ width: `${Math.max(value ? 5 : 0, width)}%` }} /></div></div>;
}

function InsightCard({ label, value, note, tone }: { label: string; value: number; note: string; tone: "blue" | "violet" | "rose" }) {
  const cls = tone === "violet" ? "border-violet-200 bg-violet-50 text-violet-800" : tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-blue-200 bg-blue-50 text-blue-800";
  return <div className={`rounded-2xl border p-4 ${cls}`}><div className="flex items-center justify-between gap-3"><span className="text-sm font-black">{label}</span><span className="text-2xl font-black">{value}</span></div><p className="mt-1 text-xs font-bold opacity-80">{note}</p></div>;
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">{label}</span>{children}</label>;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <div><span className="text-slate-500">{label}:</span> <b className="text-slate-900">{value}</b></div>;
}

function EmptyState() {
  return <div className="p-8 text-center"><div className="text-lg font-black text-slate-800">No HR record found</div><p className="mt-1 text-sm text-slate-500">Adjust the selected queue or reset the filters.</p></div>;
}
