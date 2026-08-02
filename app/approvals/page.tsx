"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { WorkflowAction, WorkflowHero, WorkflowIcon, WorkflowPageStyles } from "@/app/components/ui/WorkflowUI";

type RequestRow = {
  id: string;
  request_no: string;
  title: string;
  status: string;
  current_stage: string;
  current_owner: string | null;
  amount: number;
  created_at: string;
  request_type: string | null;
  personal_category: string | null;
  funds_state: string | null;
  assigned_account_officer_name: string | null;
};

type ProfileRole = {
  id: string;
  profile_id: string;
  role_key: string;
  role_name: string;
  is_primary: boolean;
  is_active: boolean;
};

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
  | "HRFILING";

type TypeFilter = "ALL" | "OFFICIAL" | "PERSONAL_FUND" | "PERSONAL_NONFUND";
type QueueTab = "ALL" | "OFFICIAL" | "PERSONAL_FUND" | "PERSONAL_NONFUND";
type SortMode = "NEWEST" | "OLDEST" | "HIGHEST" | "LOWEST" | "TITLE";

function naira(value: number | null | undefined) {
  return "₦" + Math.round(Number(value || 0)).toLocaleString();
}

function roleKey(role: string | null | undefined) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
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
    .replace(/\s+/g, "");
}

function statusClass(status: string | null | undefined) {
  const s = String(status || "").toLowerCase();

  if (s.includes("reject") || s.includes("delete") || s.includes("cancel")) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (s.includes("paid") || s.includes("complete") || s.includes("approved")) {
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

  return stage || "—";
}

function requestTypeLabel(row: RequestRow) {
  const rt = String(row.request_type || "").trim();
  const cat = String(row.personal_category || "").trim();

  if (rt === "Official") return "Official";

  if (rt === "Personal") {
    if (categoryKey(cat) === "FUND") return "Personal Fund";
    if (cat === "NonFund") return "Personal Other";
    if (cat) return `Personal ${cat}`;
    return "Personal Other";
  }

  return rt || "—";
}

function requestGroup(row: RequestRow): TypeFilter {
  const rt = String(row.request_type || "").trim().toUpperCase();
  const cat = categoryKey(row.personal_category);

  if (rt === "OFFICIAL") return "OFFICIAL";
  if (rt === "PERSONAL" && cat === "FUND") return "PERSONAL_FUND";
  if (rt === "PERSONAL") return "PERSONAL_NONFUND";

  return "ALL";
}

function isActiveApproval(row: RequestRow) {
  const status = String(row.status || "").toLowerCase();
  const stage = stageKey(row.current_stage);

  return (
    !!row.current_owner &&
    stage !== "COMPLETED" &&
    stage !== "REJECTED" &&
    stage !== "DELETED" &&
    stage !== "CANCELLED" &&
    !status.includes("reject") &&
    !status.includes("delete") &&
    !status.includes("cancel") &&
    !status.includes("paid") &&
    !status.includes("complete") &&
    !status.includes("closed")
  );
}

function workflowNote(row: RequestRow) {
  const rt = String(row.request_type || "").trim().toUpperCase();
  const cat = categoryKey(row.personal_category);
  const st = stageKey(row.current_stage);

  if (rt === "OFFICIAL") {
    if (st === "PO") return "ASAP-ALLI Official review by Programme Officer.";
    if (st === "DOD") return "Official request awaiting Director of Department review.";
    if (st === "DINADMIN") return "DIN Official review before Registrar.";
    if (st === "REGISTRAR") return "DIN Official review by Registrar as HOD of all DIN Departments.";
    if (st === "HOD") return "HOD review. Subhead must be assigned before DG approval.";
    if (st === "DG") return "DG approval. Select AccountOfficer before approving.";
    if (st === "ACCOUNT") return "AccountOfficer treatment/payment stage.";
    return "Official workflow approval.";
  }

  if (rt === "PERSONAL" && cat === "FUND") {
    if (st === "DOD") return "Personal Fund awaiting Director of Department review.";
    if (st === "HOD") return "ASAP-ALLI Personal Fund awaiting HOD review before HR.";
    if (st === "HR") return "Personal Fund HR review.";
    if (st === "DG") return "Personal Fund DG approval. Select AccountOfficer before approving.";
    if (st === "ACCOUNT") return "Treat/pay, then send back to HR Filing.";
    if (st === "HRFILING") return "Final HR Filing after payment.";
    return "Personal Fund workflow.";
  }

  if (rt === "PERSONAL") {
    if (st === "DOD") return "Personal request awaiting Director of Department review.";
    if (st === "HOD") return "ASAP-ALLI Personal request awaiting HOD review before HR.";
    if (st === "HR") return "Personal request HR review.";
    if (st === "DG") return "DG approval before HR Filing.";
    if (st === "HRFILING") return "Final HR Filing.";
    return "Personal request workflow.";
  }

  return "Request awaiting your action.";
}

function amountLabel(row: RequestRow) {
  const rt = String(row.request_type || "").trim().toUpperCase();
  const cat = categoryKey(row.personal_category);

  if (rt === "PERSONAL" && cat !== "FUND") return "Not Applicable";

  return naira(row.amount);
}

function roleSummary(profileRole: string | null, roles: ProfileRole[]) {
  const active = roles.filter((r) => r.is_active);

  if (active.length === 0) return profileRole || "Staff";

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

export default function ApprovalsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [meRole, setMeRole] = useState<string | null>(null);
  const [meRoles, setMeRoles] = useState<ProfileRole[]>([]);
  const [activeRole, setActiveRole] = useState<string>("staff");

  const [search, setSearch] = useState("");
  const [queueTab, setQueueTab] = useState<QueueTab>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [stageFilter, setStageFilter] = useState<StageFilter>("ALL");
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
      const user = auth.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const [profileRes, rolesRes, activeRoleRes, requestRes, notificationRes] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),

        supabase
          .from("profile_roles")
          .select("id,profile_id,role_key,role_name,is_primary,is_active")
          .eq("profile_id", user.id)
          .eq("is_active", true),

        supabase.rpc("get_my_active_role"),

        supabase
          .from("requests")
          .select(
            "id,request_no,title,status,current_stage,current_owner,amount,created_at,request_type,personal_category,funds_state,assigned_account_officer_name"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("is_read", false),
      ]);

      if (profileRes.error) {
        setMsg("Failed to load your profile: " + profileRes.error.message);
        setMeRole(null);
      } else {
        setMeRole((profileRes.data?.role as string) || "Staff");
      }

      if (rolesRes.error) {
        setMeRoles([]);
      } else {
        setMeRoles((rolesRes.data || []) as ProfileRole[]);
      }

      const rawActiveRole = activeRoleRes.data as unknown;
      let resolvedActiveRole = "";

      if (typeof rawActiveRole === "string") {
        resolvedActiveRole = rawActiveRole;
      } else if (Array.isArray(rawActiveRole)) {
        const first = rawActiveRole[0] as Record<string, unknown> | undefined;
        resolvedActiveRole = String(
          first?.active_role_key ||
          first?.role_key ||
          first?.get_my_active_role ||
          ""
        );
      } else if (rawActiveRole && typeof rawActiveRole === "object") {
        const item = rawActiveRole as Record<string, unknown>;
        resolvedActiveRole = String(
          item.active_role_key ||
          item.role_key ||
          item.get_my_active_role ||
          ""
        );
      }

      const effectiveRole = roleKey(
        resolvedActiveRole ||
        (profileRes.data?.role as string) ||
        "staff"
      );

      setActiveRole(effectiveRole);

      if (requestRes.error) {
        setMsg("Failed to load approvals: " + requestRes.error.message);
        setRows([]);
      } else {
        const stageForRole: Record<string, string[]> = {
          po: ["PO"],
          dod: ["DOD"],
          director: ["DOD"],
          dinadmin: ["DINADMIN"],
          registrar: ["REGISTRAR"],
          registry: ["REGISTRAR"],
          hod: ["HOD"],
          hr: ["HR", "HRFILING"],
          hrboss: ["HR", "HRFILING"],
          hrofficer: ["HR", "HRFILING"],
          dg: ["DG"],
          account: ["ACCOUNT"],
          accounts: ["ACCOUNT"],
          accountofficer: ["ACCOUNT"],
        };

        const allowedStages = stageForRole[effectiveRole] || [];
        const canSeeAll = ["admin", "auditor"].includes(effectiveRole);

        const actionableRows = ((requestRes.data || []) as RequestRow[])
          .filter(isActiveApproval)
          .filter((row) => {
            if (canSeeAll) return true;
            if (row.current_owner === user.id) return true;
            return allowedStages.includes(stageKey(row.current_stage));
          });

        setRows(actionableRows);
      }

      if (!notificationRes.error) {
        setUnreadCount(notificationRes.count || 0);
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

  useEffect(() => {
    const channel = supabase
      .channel("approvals-inbox-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "requests" },
        () => void load({ silent: true })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => void load({ silent: true })
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = rows.filter((row) => {
      const rowGroup = requestGroup(row);
      const rowStage = stageKey(row.current_stage);

      if (queueTab !== "ALL" && rowGroup !== queueTab) return false;
      if (typeFilter !== "ALL" && rowGroup !== typeFilter) return false;
      if (stageFilter !== "ALL" && rowStage !== stageFilter) return false;

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

    return filtered.slice().sort((a, b) => {
      if (sortMode === "OLDEST") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortMode === "HIGHEST") return Number(b.amount || 0) - Number(a.amount || 0);
      if (sortMode === "LOWEST") return Number(a.amount || 0) - Number(b.amount || 0);
      if (sortMode === "TITLE") return String(a.title || "").localeCompare(String(b.title || ""));
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [rows, search, queueTab, typeFilter, stageFilter, sortMode]);

  const counts = useMemo(() => {
    const total = rows.length;

    const official = rows.filter((r) => requestGroup(r) === "OFFICIAL").length;
    const personalFund = rows.filter((r) => requestGroup(r) === "PERSONAL_FUND").length;
    const personalNonFund = rows.filter((r) => requestGroup(r) === "PERSONAL_NONFUND").length;

    const totalAmount = rows.reduce((sum, r) => {
      const group = requestGroup(r);

      if (group === "PERSONAL_NONFUND") return sum;

      return sum + Number(r.amount || 0);
    }, 0);

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
      official,
      personalFund,
      personalNonFund,
      totalAmount,
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

  function resetFilters() {
    setSearch("");
    setQueueTab("ALL");
    setTypeFilter("ALL");
    setStageFilter("ALL");
    setSortMode("NEWEST");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <WorkflowPageStyles />
      <div className="workflow-shell mx-auto max-w-7xl space-y-5">
        <WorkflowHero
          eyebrow="Approval Operations"
          title="Approvals Inbox"
          description="Review requests assigned to your active role, verify supporting evidence and move each workflow forward securely."
          icon="approval"
          meta={<>Active role: <b>{activeRole || roleKey(meRole) || "staff"}</b>{unreadCount > 0 ? <> • <b>{unreadCount} new assignment(s)</b></> : null}</>}
          actions={
            <>
              <WorkflowAction icon="refresh" tone="white" onClick={() => load({ silent: true })} disabled={refreshing || loading}>
                {refreshing ? "Refreshing..." : "Refresh"}
              </WorkflowAction>
              <WorkflowAction icon="dashboard" tone="cyan" onClick={() => router.push(`/dashboard?updated=${Date.now()}`)}>Dashboard</WorkflowAction>
            </>
          }
        />

        <div className="mt-5 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
          <CountCard label="My Pending" value={counts.total} tone="red" />
          <CountCard label="Official" value={counts.official} tone="blue" />
          <CountCard label="Personal Fund" value={counts.personalFund} tone="purple" />
          <CountCard label="Personal Other" value={counts.personalNonFund} tone="emerald" />
          <CountCard label="Account" value={counts.account} tone="purple" />
          <CountCard label="HR Filing" value={counts.hrFiling} tone="emerald" />
          <CountCard label="Total Amount" value={naira(counts.totalAmount)} tone="purple" />
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Approval queue tabs">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <QueueTabButton active={queueTab === "ALL"} label="All Pending" count={counts.total} tone="slate" onClick={() => setQueueTab("ALL")} />
            <QueueTabButton active={queueTab === "OFFICIAL"} label="Official" count={counts.official} tone="blue" onClick={() => setQueueTab("OFFICIAL")} />
            <QueueTabButton active={queueTab === "PERSONAL_FUND"} label="Personal Fund" count={counts.personalFund} tone="violet" onClick={() => setQueueTab("PERSONAL_FUND")} />
            <QueueTabButton active={queueTab === "PERSONAL_NONFUND"} label="Personal Other" count={counts.personalNonFund} tone="emerald" onClick={() => setQueueTab("PERSONAL_NONFUND")} />
          </div>
        </section>

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

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Queue Controls</div>
              <h2 className="mt-1 text-xl font-black text-slate-950">Find the approval requiring your action</h2>
            </div>
            <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">
              {filteredRows.length.toLocaleString()} of {rows.length.toLocaleString()} item(s)
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
            <div className="xl:col-span-4">
              <label className="text-sm font-black text-slate-800">Search approvals</label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <WorkflowIcon name="search" className="h-4 w-4" />
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Request no, title, stage or officer..."
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="xl:col-span-2">
              <label className="text-sm font-black text-slate-800">Request Type</label>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)} className="mt-1 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                <option value="ALL">All Types</option>
                <option value="OFFICIAL">Official</option>
                <option value="PERSONAL_FUND">Personal Fund</option>
                <option value="PERSONAL_NONFUND">Personal Other</option>
              </select>
            </div>

            <div className="xl:col-span-2">
              <label className="text-sm font-black text-slate-800">Workflow Stage</label>
              <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as StageFilter)} className="mt-1 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                <option value="ALL">All Stages</option>
                <option value="PO">PO</option><option value="DOD">DOD</option><option value="DINADMIN">DIN Admin</option><option value="REGISTRAR">Registrar</option><option value="HOD">HOD</option><option value="HR">HR</option><option value="DG">DG</option><option value="ACCOUNT">AccountOfficer</option><option value="HRFILING">HR Filing</option>
              </select>
            </div>

            <div className="xl:col-span-2">
              <label className="text-sm font-black text-slate-800">Sort By</label>
              <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} className="mt-1 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                <option value="NEWEST">Newest First</option><option value="OLDEST">Oldest First</option><option value="HIGHEST">Highest Amount</option><option value="LOWEST">Lowest Amount</option><option value="TITLE">Title A-Z</option>
              </select>
            </div>

            <div className="flex items-end xl:col-span-2">
              <button type="button" onClick={resetFilters} className="reqgen-btn reqgen-btn-cyan h-12 w-full rounded-xl px-4 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-cyan-200">
                Reset Filters
              </button>
            </div>
          </div>
        </section>

        {msg && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm">
            {msg}
          </div>
        )}

        {loading ? (
          <div className="mt-6 rounded-2xl border bg-white p-6 text-slate-600 shadow-sm">
            Loading approvals...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
            <div className="text-base font-bold text-slate-900">No pending approvals.</div>
            <p className="mt-1 text-sm text-slate-600">
              There is currently no request assigned to you for action using the selected filters.
            </p>
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
              <article key={r.id} className="border-t px-4 py-4 transition hover:bg-slate-50">
                <div className="grid gap-3 md:grid-cols-12 md:items-center">
                  <div className="font-extrabold text-slate-900 md:col-span-2">
                    {r.request_no || "—"}
                  </div>

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

                <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs font-semibold text-slate-500">Created: {new Date(r.created_at).toLocaleString()}</div>
                  <button type="button" onClick={() => openRequest(r.id)} className="reqgen-btn reqgen-btn-blue inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-200">
                    <WorkflowIcon name="view" className="h-4 w-4" /> Review Request
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
          This inbox refreshes automatically when you return to the page. Use Refresh if you want to
          check immediately after another officer takes action.
        </div>
      </div>
    </main>
  );
}

function QueueTabButton({ active, label, count, tone, onClick }: { active: boolean; label: string; count: number; tone: "slate" | "blue" | "violet" | "emerald"; onClick: () => void }) {
  const toneClass = tone === "blue" ? "from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 focus:ring-blue-200" : tone === "violet" ? "from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 focus:ring-violet-200" : tone === "emerald" ? "from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 focus:ring-emerald-200" : "from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black focus:ring-slate-200";

  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-gradient-to-r px-5 py-3 text-left font-black text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 ${toneClass} ${active ? "ring-4 ring-white ring-offset-2 ring-offset-slate-300" : ""}`}>
      <span className="text-sm font-black text-white sm:text-base" style={{ color: "#ffffff" }}>{label}</span>
      <span className="inline-flex min-w-9 items-center justify-center rounded-xl border border-white/40 bg-white/20 px-2.5 py-1 text-sm font-black text-white backdrop-blur-sm">{count.toLocaleString()}</span>
    </button>
  );
}

function CountCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "slate" | "blue" | "emerald" | "red" | "purple";
}) {
  const cls =
    tone === "blue"
      ? "border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-800"
      : tone === "emerald"
        ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-800"
        : tone === "red"
          ? "border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50 text-rose-800"
          : tone === "purple"
            ? "border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 text-violet-800"
            : "border-slate-200 bg-white text-slate-800";

  const icon = label.includes("Amount")
    ? "money"
    : label.includes("Pending")
      ? "approval"
      : label.includes("Official")
        ? "request"
        : label.includes("Filing")
          ? "timeline"
          : "shield";

  return (
    <div className={`group relative overflow-hidden rounded-2xl border p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${cls}`}>
      <div className="pointer-events-none absolute -right-7 -top-7 h-24 w-24 rounded-full bg-white/70 blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-wide opacity-75">{label}</div>
          <div className="mt-2 text-3xl font-black leading-none">
            {typeof value === "number" ? Number(value || 0).toLocaleString() : value}
          </div>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-current/10 bg-white/70 shadow-sm transition group-hover:scale-105">
          <WorkflowIcon name={icon} className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function MiniStageCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</div>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <WorkflowIcon name="timeline" className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-1 text-xl font-black text-slate-900">
        {Number(value || 0).toLocaleString()}
      </div>
    </div>
  );
}
