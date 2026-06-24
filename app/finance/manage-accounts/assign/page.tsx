"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

type Account = {
  id: string;
  code: string | null;
  name: string;
  bank_name: string | null;
  account_number: string | null;
  is_active: boolean | null;
};

type AssignmentRow = {
  id: string;
  account_id: string;
  officer_user_id: string;
  created_at: string;
};

type TabKey = "overview" | "assignments" | "form";

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

function maskAccountNumber(value: string | null | undefined) {
  const raw = (value || "").trim();

  if (!raw) return "—";
  if (raw.length <= 4) return raw;

  return `${"*".repeat(Math.max(raw.length - 4, 0))}${raw.slice(-4)}`;
}

function accountLabel(a: Account | undefined) {
  if (!a) return "Unknown Account";

  return `${a.code ? `${a.code} — ` : ""}${a.name}`;
}

function accountSubLabel(a: Account | undefined) {
  if (!a) return "Account record not found";

  return `${a.bank_name || "Bank not set"} • ${maskAccountNumber(a.account_number)}${
    a.is_active === false ? " • Inactive" : ""
  }`;
}

function officerLabel(o: Profile | undefined) {
  if (!o) return "Unknown Officer";
  return o.full_name || o.email || o.id;
}

function officerSubLabel(o: Profile | undefined) {
  if (!o) return "Officer record not found";
  return `${o.email || "No email"} • ${o.role || "Role not set"}`;
}

export default function AssignAccountOfficerPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [myRole, setMyRole] = useState<string>("Staff");
  const rk = roleKey(myRole);
  const canManage = rk === "admin" || rk === "auditor";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [officers, setOfficers] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);

  const [accountId, setAccountId] = useState<string>("");
  const [officerId, setOfficerId] = useState<string>("");

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [search, setSearch] = useState("");

  const loadAll = useCallback(
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
        return null;
      }

      const { data: prof, error: profileErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (profileErr) {
        setMsg("Failed to load role: " + profileErr.message);
        setLoading(false);
        setRefreshing(false);
        return null;
      }

      const role = (prof?.role || "Staff") as string;
      setMyRole(role);

      if (!["admin", "auditor"].includes(roleKey(role))) {
        router.push(`/dashboard?updated=${Date.now()}`);
        router.refresh();
        return null;
      }

      const [accountRes, officerRes, assignmentRes] = await Promise.all([
        supabase
          .from("iet_accounts")
          .select("id,code,name,bank_name,account_number,is_active")
          .order("is_active", { ascending: false })
          .order("name", { ascending: true }),

        supabase
          .from("profiles")
          .select("id,full_name,email,role")
          .in("role", ["AccountOfficer", "Account", "Accounts"])
          .order("full_name", { ascending: true }),

        supabase
          .from("iet_account_officer_assignments")
          .select("id,account_id,officer_user_id,created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (accountRes.error) {
        setMsg("Failed to load accounts: " + accountRes.error.message);
        setAccounts([]);
      } else {
        setAccounts(
          ((accountRes.data || []) as Account[]).map((a) => ({
            ...a,
            is_active: a.is_active !== false,
          }))
        );
      }

      if (officerRes.error) {
        setMsg("Failed to load officers: " + officerRes.error.message);
        setOfficers([]);
      } else {
        setOfficers((officerRes.data || []) as Profile[]);
      }

      if (assignmentRes.error) {
        setMsg("Failed to load assignments: " + assignmentRes.error.message);
        setAssignments([]);
      } else {
        setAssignments((assignmentRes.data || []) as AssignmentRow[]);
      }

      setLoading(false);
      setRefreshing(false);

      return true;
    },
    [router]
  );

  useEffect(() => {
    loadAll();

    const refreshOnFocus = () => {
      loadAll({ silent: true });
    };

    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") {
        loadAll({ silent: true });
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisible);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [loadAll]);

  const accountMap = useMemo(() => {
    const m: Record<string, Account> = {};
    accounts.forEach((a) => {
      m[a.id] = a;
    });
    return m;
  }, [accounts]);

  const officerMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    officers.forEach((o) => {
      m[o.id] = o;
    });
    return m;
  }, [officers]);

  const assignedAccountIds = useMemo(() => {
    return new Set(assignments.map((a) => a.account_id));
  }, [assignments]);

  const availableActiveAccounts = useMemo(() => {
    return accounts.filter((a) => a.is_active !== false);
  }, [accounts]);

  const unassignedActiveAccounts = useMemo(() => {
    return availableActiveAccounts.filter((a) => !assignedAccountIds.has(a.id));
  }, [availableActiveAccounts, assignedAccountIds]);

  const filteredAssignments = useMemo(() => {
    const s = search.trim().toLowerCase();

    return assignments.filter((x) => {
      if (!s) return true;

      const a = accountMap[x.account_id];
      const o = officerMap[x.officer_user_id];

      const haystack = [
        accountLabel(a),
        accountSubLabel(a),
        officerLabel(o),
        officerSubLabel(o),
        x.created_at,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(s);
    });
  }, [assignments, accountMap, officerMap, search]);

  const stats = useMemo(() => {
    return {
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter((a) => a.is_active !== false).length,
      officers: officers.length,
      assignments: assignments.length,
      unassignedActive: unassignedActiveAccounts.length,
    };
  }, [accounts, officers, assignments, unassignedActiveAccounts]);

  function resetForm() {
    setAccountId("");
    setOfficerId("");
  }

  async function assign() {
    if (!canManage) {
      setMsg("Not allowed.");
      return;
    }

    if (!accountId) {
      setMsg("❌ Please select an account.");
      return;
    }

    if (!officerId) {
      setMsg("❌ Please select an officer.");
      return;
    }

    const account = accountMap[accountId];

    if (account?.is_active === false) {
      setMsg("❌ This account is inactive. Activate it before assigning an officer.");
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase
        .from("iet_account_officer_assignments")
        .upsert(
          {
            account_id: accountId,
            officer_user_id: officerId,
          } as any,
          { onConflict: "account_id" }
        );

      if (error) throw new Error(error.message);

      setMsg("✅ Account officer assigned successfully.");
      resetForm();
      setActiveTab("assignments");
      await loadAll({ silent: true });
      router.refresh();
    } catch (e: any) {
      setMsg("❌ Assign failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignment(id: string) {
    if (!canManage) {
      setMsg("Not allowed.");
      return;
    }

    const ok = confirm("Remove this account officer assignment?");

    if (!ok) return;

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase
        .from("iet_account_officer_assignments")
        .delete()
        .eq("id", id);

      if (error) throw new Error(error.message);

      setMsg("✅ Assignment removed.");
      await loadAll({ silent: true });
      router.refresh();
    } catch (e: any) {
      setMsg("❌ Remove failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  function backToManageAccounts() {
    router.push(`/finance/manage-accounts?updated=${Date.now()}`);
    router.refresh();
  }

  function backToFinance() {
    router.push(`/finance?updated=${Date.now()}`);
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-6xl py-10 text-slate-600">
          Loading Account Assignments...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-6xl py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Finance • Account Officer Assignment
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Assign one Accounting Officer to each active IET bank account.
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Role: {myRole || "—"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => loadAll({ silent: true })}
              disabled={refreshing || saving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={() => setActiveTab("form")}
              disabled={!canManage || refreshing || saving}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              Assign Officer
            </button>

            <button
              onClick={backToManageAccounts}
              disabled={refreshing || saving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              Manage Accounts
            </button>

            <button
              onClick={backToFinance}
              disabled={refreshing || saving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              Back to Finance
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm">
            {msg}
          </div>
        )}

        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-900">
          Rule: one officer per bank account. Reassigning an account replaces the old officer because the assignment uses account-level uniqueness.
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard title="Total Accounts" value={String(stats.totalAccounts)} tone="blue" />
          <StatCard title="Active Accounts" value={String(stats.activeAccounts)} tone="emerald" />
          <StatCard title="Officers" value={String(stats.officers)} tone="purple" />
          <StatCard title="Assignments" value={String(stats.assignments)} tone="amber" />
          <StatCard title="Unassigned Active" value={String(stats.unassignedActive)} tone="slate" />
        </div>

        <div className="mt-6 rounded-3xl border bg-white p-2 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <TabButton label="Overview" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
            <TabButton label="Assignments" active={activeTab === "assignments"} onClick={() => setActiveTab("assignments")} />
            <TabButton label="Assign Officer" active={activeTab === "form"} onClick={() => setActiveTab("form")} />
          </div>
        </div>

        {activeTab === "form" && (
          <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Assign Officer</h2>
            <p className="mt-1 text-sm text-slate-600">
              Select an active bank account and assign it to an Accounting Officer.
            </p>

            {!canManage && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                View only. Only Admin and Auditor can assign bank accounts to officers.
              </div>
            )}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-slate-800">Account</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  disabled={!canManage || saving}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
                >
                  <option value="">-- Select Account --</option>
                  {availableActiveAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {`${a.code ? `${a.code} — ` : ""}${a.name} (${a.bank_name || "Bank"} ${maskAccountNumber(
                        a.account_number
                      )})${assignedAccountIds.has(a.id) ? " • Already assigned" : ""}`}
                    </option>
                  ))}
                </select>

                <div className="mt-1 text-xs text-slate-500">
                  Only active accounts are shown. Selecting an already-assigned account will reassign it.
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800">Officer</label>
                <select
                  value={officerId}
                  onChange={(e) => setOfficerId(e.target.value)}
                  disabled={!canManage || saving}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
                >
                  <option value="">-- Select Officer --</option>
                  {officers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {`${o.full_name || o.email || o.id} (${o.role || "AccountOfficer"})`}
                    </option>
                  ))}
                </select>

                {officers.length === 0 && (
                  <div className="mt-2 text-xs text-red-600">
                    No AccountOfficer/Account users found. Set the user role in Admin first.
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={assign}
              disabled={!canManage || saving}
              className="mt-5 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Working..." : "Assign Officer"}
            </button>
          </div>
        )}

        {(activeTab === "overview" || activeTab === "assignments") && (
          <>
            <div className="mt-6 rounded-3xl border bg-white p-5 shadow-sm">
              <label className="text-sm font-semibold text-slate-800">
                Search Assignments
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by account, bank, officer, email or account number..."
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div className="mt-6 overflow-hidden rounded-3xl border bg-white shadow-sm">
              <div className="border-b bg-slate-50 px-6 py-4">
                <h2 className="text-lg font-bold text-slate-900">Current Assignments</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Existing officer-to-bank-account routing records.
                </p>
              </div>

              {filteredAssignments.length === 0 ? (
                <div className="p-6 text-sm text-slate-700">
                  No assignment found.
                </div>
              ) : (
                <>
                  <div className="grid gap-4 p-4 xl:hidden">
                    {filteredAssignments.map((assignment) => (
                      <AssignmentCard
                        key={assignment.id}
                        assignment={assignment}
                        account={accountMap[assignment.account_id]}
                        officer={officerMap[assignment.officer_user_id]}
                        canManage={canManage}
                        saving={saving}
                        onRemove={() => removeAssignment(assignment.id)}
                      />
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto xl:block">
                    <table className="min-w-[1100px] w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                          <th className="px-4 py-3 text-left">Bank Account</th>
                          <th className="px-4 py-3 text-left">Bank / Number</th>
                          <th className="px-4 py-3 text-left">Officer</th>
                          <th className="px-4 py-3 text-left">Officer Email / Role</th>
                          <th className="px-4 py-3 text-left">Assigned</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredAssignments.map((assignment) => {
                          const account = accountMap[assignment.account_id];
                          const officer = officerMap[assignment.officer_user_id];

                          return (
                            <tr key={assignment.id} className="border-t hover:bg-slate-50">
                              <td className="px-4 py-4">
                                <div className="font-extrabold text-slate-900">
                                  {accountLabel(account)}
                                </div>
                                {account?.is_active === false && (
                                  <div className="mt-1 text-xs font-bold text-red-600">
                                    Inactive account
                                  </div>
                                )}
                              </td>

                              <td className="px-4 py-4 text-slate-700">
                                {accountSubLabel(account)}
                              </td>

                              <td className="px-4 py-4 font-semibold text-slate-900">
                                {officerLabel(officer)}
                              </td>

                              <td className="px-4 py-4 text-slate-700">
                                {officerSubLabel(officer)}
                              </td>

                              <td className="px-4 py-4 text-slate-600">
                                {shortDate(assignment.created_at)}
                              </td>

                              <td className="px-4 py-4 text-right">
                                <button
                                  onClick={() => removeAssignment(assignment.id)}
                                  disabled={!canManage || saving}
                                  className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {activeTab === "overview" && unassignedActiveAccounts.length > 0 && (
          <div className="mt-6 rounded-3xl border border-amber-100 bg-amber-50 p-5 text-sm text-amber-900">
            <div className="font-bold">Unassigned Active Accounts</div>
            <p className="mt-1">
              {unassignedActiveAccounts.length} active account(s) do not currently have an assigned officer.
              Open the Assign Officer tab to complete the routing.
            </p>
          </div>
        )}

        <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
          <div className="font-bold">Account Assignment Note</div>
          <p className="mt-1">
            These assignments control which Accounting Officer is responsible for each IET bank account.
            Keep the routing updated so payment processing and finance accountability remain clear.
          </p>
        </div>
      </div>
    </main>
  );
}

function AssignmentCard({
  assignment,
  account,
  officer,
  canManage,
  saving,
  onRemove,
}: {
  assignment: AssignmentRow;
  account: Account | undefined;
  officer: Profile | undefined;
  canManage: boolean;
  saving: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-extrabold text-slate-900">
            {accountLabel(account)}
          </div>
          <div className="mt-1 text-sm text-slate-600">{accountSubLabel(account)}</div>
        </div>

        {account?.is_active === false ? (
          <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
            Inactive Account
          </span>
        ) : (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            Active Account
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InfoMetric title="Officer" value={officerLabel(officer)} />
        <InfoMetric title="Officer Detail" value={officerSubLabel(officer)} />
        <InfoMetric title="Assigned Date" value={shortDate(assignment.created_at)} />
        <InfoMetric title="Rule" value="1 officer per account" />
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={onRemove}
          disabled={!canManage || saving}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          Remove Assignment
        </button>
      </div>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
        active ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-700 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}

function StatCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "blue" | "emerald" | "amber" | "purple" | "slate";
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "amber"
      ? "bg-amber-50 text-amber-700"
      : tone === "purple"
      ? "bg-purple-50 text-purple-700"
      : tone === "slate"
      ? "bg-slate-50 text-slate-700"
      : "bg-blue-50 text-blue-700";

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      <div className={`mt-3 inline-flex rounded-2xl px-3 py-2 text-xl font-extrabold ${cls}`}>
        {value}
      </div>
    </div>
  );
}

function InfoMetric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="mt-2 text-sm font-extrabold text-slate-900">{value}</div>
    </div>
  );
}