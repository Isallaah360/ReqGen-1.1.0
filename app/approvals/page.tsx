"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
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
      const user = auth.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const [profileRes, rolesRes, requestRes, notificationRes] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),

        supabase
          .from("profile_roles")
          .select("id,profile_id,role_key,role_name,is_primary,is_active")
          .eq("profile_id", user.id)
          .eq("is_active", true),

        supabase
          .from("requests")
          .select(
            "id,request_no,title,status,current_stage,current_owner,amount,created_at,request_type,personal_category,funds_state,assigned_account_officer_name"
          )
          .eq("current_owner", user.id)
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

      if (requestRes.error) {
        setMsg("Failed to load approvals: " + requestRes.error.message);
        setRows([]);
      } else {
        setRows(((requestRes.data || []) as RequestRow[]).filter(isActiveApproval));
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

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const rowGroup = requestGroup(row);
      const rowStage = stageKey(row.current_stage);

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
  }, [rows, search, typeFilter, stageFilter]);

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
    setTypeFilter("ALL");
    setStageFilter("ALL");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-7xl py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Approvals Inbox
            </h1>

            <p className="mt-2 text-sm text-slate-600">
              Requests currently assigned to you for action.
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                  {unreadCount} new
                </span>
              )}
            </p>

            <p className="mt-1 text-xs font-semibold text-slate-500">
              Active capacity:{" "}
              <b className="text-slate-800">{roleSummary(meRole, meRoles)}</b>
            </p>

            <p className="mt-1 text-xs font-semibold text-slate-500">
              Final workflows supported: PO, DOD, DIN Admin, Registrar, HOD, HR, DG,
              AccountOfficer and HR Filing.
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
              onClick={() => router.push(`/dashboard?updated=${Date.now()}`)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-sm hover:bg-slate-100"
            >
              Dashboard
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
          <CountCard label="My Pending" value={counts.total} tone="red" />
          <CountCard label="Official" value={counts.official} tone="blue" />
          <CountCard label="Personal Fund" value={counts.personalFund} tone="purple" />
          <CountCard label="Personal Other" value={counts.personalNonFund} tone="emerald" />
          <CountCard label="Account" value={counts.account} tone="purple" />
          <CountCard label="HR Filing" value={counts.hrFiling} tone="emerald" />
          <CountCard label="Total Amount" value={naira(counts.totalAmount)} tone="purple" />
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
                <option value="PERSONAL_NONFUND">
                  Personal Leave/Contract/Resignation/Others
                </option>
              </select>
            </div>

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
              </select>
            </div>
          </div>

          <div className="mt-3 flex justify-end">
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
              <button
                key={r.id}
                type="button"
                onClick={() => openRequest(r.id)}
                className="block w-full border-t px-4 py-4 text-left hover:bg-slate-50"
              >
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

                <div className="mt-1 text-xs font-semibold text-slate-500">
                  Created: {new Date(r.created_at).toLocaleString()}
                </div>
              </button>
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
        {typeof value === "number" ? Number(value || 0).toLocaleString() : value}
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