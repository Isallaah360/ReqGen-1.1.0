"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  signature_url: string | null;
};

type DeptRow = {
  id: string;
  name: string;
  hod_user_id: string | null;
  director_user_id: string | null;
  is_active: boolean | null;
};

type SettingRow = {
  key: string;
  value: string | null;
};

type BankAccount = {
  id: string;
  code: string | null;
  name: string;
  bank_name: string | null;
  account_number: string | null;
  is_active: boolean | null;
  total_fund: number | null;
  allocated_amount: number | null;
  reserved_amount: number | null;
  expenditure: number | null;
  unallocated_balance: number | null;
  available_balance: number | null;
};

type SubheadRow = {
  id: string;
  dept_id: string | null;
  bank_account_id: string | null;
  code: string | null;
  name: string;
  approved_allocation: number | null;
  reserved_amount: number | null;
  expenditure: number | null;
  balance: number | null;
  is_active: boolean | null;
};

type TabKey = "control" | "roles" | "global" | "departments" | "signatures";

const GLOBAL_KEYS = ["REGISTRY_USER_ID", "DG_USER_ID", "HR_USER_ID"] as const;

const ROLE_OPTIONS = [
  "Staff",
  "Admin",
  "Auditor",
  "Registry",
  "HR",
  "DG",
  "AccountOfficer",
  "Director",
  "HOD",
];

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function requiresSignature(role: string) {
  const rk = roleKey(role);
  return [
    "admin",
    "auditor",
    "registry",
    "hr",
    "dg",
    "accountofficer",
    "director",
    "hod",
  ].includes(rk);
}

function officerLabel(key: string) {
  if (key === "REGISTRY_USER_ID") return "Registry Officer";
  if (key === "DG_USER_ID") return "Director General";
  if (key === "HR_USER_ID") return "HR Officer";
  return key;
}

function roleBadgeClass(role: string | null | undefined) {
  const rk = roleKey(role);

  if (rk === "admin") return "border-red-200 bg-red-50 text-red-700";
  if (rk === "auditor") return "border-purple-200 bg-purple-50 text-purple-700";
  if (["account", "accounts", "accountofficer"].includes(rk)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (["director", "hod", "dg"].includes(rk)) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (["hr", "registry"].includes(rk)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function naira(n: number | null | undefined) {
  return "₦" + Math.round(Number(n || 0)).toLocaleString();
}

function maskAccountNumber(value: string | null | undefined) {
  const raw = (value || "").trim();

  if (!raw) return "—";
  if (raw.length <= 4) return raw;

  return `${"*".repeat(Math.max(raw.length - 4, 0))}${raw.slice(-4)}`;
}

function bankLabel(bank: BankAccount) {
  return `${bank.code ? `${bank.code} — ` : ""}${bank.name}`;
}

export default function AdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingTarget, setSavingTarget] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("control");

  const [meEmail, setMeEmail] = useState("");
  const [meRole, setMeRole] = useState("");

  const [users, setUsers] = useState<UserRow[]>([]);
  const [depts, setDepts] = useState<DeptRow[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [subheads, setSubheads] = useState<SubheadRow[]>([]);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("Staff");

  const usersById = useMemo(() => {
    const m = new Map<string, UserRow>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  const signatureReadyUsers = useMemo(() => {
    return users.filter((u) => !!u.signature_url);
  }, [users]);

  const departmentRoutingUsers = useMemo(() => {
    return users.filter((u) => {
      const rk = roleKey(u.role);
      return !!u.signature_url && ["admin", "director", "hod", "dg"].includes(rk);
    });
  }, [users]);

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const signatureReadyCount = users.filter((u) => !!u.signature_url).length;
    const needsSignature = Math.max(totalUsers - signatureReadyCount, 0);

    const departments = depts.length;
    const activeDepartments = depts.filter((d) => d.is_active !== false).length;
    const inactiveDepartments = depts.filter((d) => d.is_active === false).length;
    const routedDepartments = depts.filter((d) => d.hod_user_id || d.director_user_id).length;
    const unroutedDepartments = depts.filter((d) => !d.hod_user_id && !d.director_user_id).length;

    const totalBanks = banks.length;
    const activeBanks = banks.filter((b) => b.is_active !== false).length;
    const bankTotalFund = banks.reduce((sum, b) => sum + Number(b.total_fund || 0), 0);
    const bankAllocated = banks.reduce((sum, b) => sum + Number(b.allocated_amount || 0), 0);
    const bankUnallocated = banks.reduce((sum, b) => sum + Number(b.unallocated_balance || 0), 0);
    const bankAvailable = banks.reduce((sum, b) => sum + Number(b.available_balance || 0), 0);
    const overAllocatedBanks = banks.filter((b) => Number(b.unallocated_balance || 0) < 0).length;

    const totalSubheads = subheads.length;
    const activeSubheads = subheads.filter((s) => s.is_active !== false).length;
    const subheadsNoBank = subheads.filter((s) => !s.bank_account_id).length;
    const subheadAllocation = subheads.reduce(
      (sum, s) => sum + Number(s.approved_allocation || 0),
      0
    );
    const subheadReserved = subheads.reduce((sum, s) => sum + Number(s.reserved_amount || 0), 0);
    const subheadExpenditure = subheads.reduce((sum, s) => sum + Number(s.expenditure || 0), 0);
    const subheadBalance = subheads.reduce((sum, s) => sum + Number(s.balance || 0), 0);
    const negativeSubheads = subheads.filter((s) => Number(s.balance || 0) < 0).length;

    const roleCounts = users.reduce<Record<string, number>>((acc, u) => {
      const label = u.role || "Staff";
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});

    const criticalAlerts =
      needsSignature +
      unroutedDepartments +
      subheadsNoBank +
      overAllocatedBanks +
      negativeSubheads;

    return {
      totalUsers,
      signatureReadyCount,
      needsSignature,
      departments,
      activeDepartments,
      inactiveDepartments,
      routedDepartments,
      unroutedDepartments,
      totalBanks,
      activeBanks,
      bankTotalFund,
      bankAllocated,
      bankUnallocated,
      bankAvailable,
      overAllocatedBanks,
      totalSubheads,
      activeSubheads,
      subheadsNoBank,
      subheadAllocation,
      subheadReserved,
      subheadExpenditure,
      subheadBalance,
      negativeSubheads,
      roleCounts,
      criticalAlerts,
    };
  }, [users, depts, banks, subheads]);

  const loadAll = useCallback(
    async (options?: { silent?: boolean }) => {
      if (options?.silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMsg(null);

      const { data: authData, error: authErr } = await supabase.auth.getUser();

      if (authErr) {
        setMsg("Auth error: " + authErr.message);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const user = authData.user;

      if (!user) {
        router.push("/login");
        return;
      }

      setMeEmail(user.email || "");

      const { data: me, error: meErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (meErr) {
        setMsg("Failed to verify admin: " + meErr.message);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const role = (me?.role || "Staff") as string;
      setMeRole(role);

      if (roleKey(role) !== "admin") {
        router.push(`/dashboard?updated=${Date.now()}`);
        router.refresh();
        return;
      }

      await supabase.rpc("reqgen_recalculate_all_iet_accounts");

      const [usersRes, deptsRes, settingsRes, banksRes, subheadsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,email,full_name,role,signature_url")
          .order("full_name", { ascending: true }),

        supabase
          .from("departments")
          .select("id,name,hod_user_id,director_user_id,is_active")
          .order("name", { ascending: true }),

        supabase.from("app_settings").select("key,value"),

        supabase
          .from("iet_accounts")
          .select(
            "id,code,name,bank_name,account_number,is_active,total_fund,allocated_amount,reserved_amount,expenditure,unallocated_balance,available_balance"
          )
          .order("name", { ascending: true }),

        supabase
          .from("subheads")
          .select(
            "id,dept_id,bank_account_id,code,name,approved_allocation,reserved_amount,expenditure,balance,is_active"
          )
          .order("name", { ascending: true }),
      ]);

      if (usersRes.error) {
        setMsg("Failed to load users: " + usersRes.error.message);
        setUsers([]);
      } else {
        setUsers((usersRes.data || []) as UserRow[]);
      }

      if (deptsRes.error) {
        setMsg("Failed to load departments: " + deptsRes.error.message);
        setDepts([]);
      } else {
        setDepts((deptsRes.data || []) as DeptRow[]);
      }

      if (settingsRes.error) {
        setMsg("Failed to load app settings: " + settingsRes.error.message);
        setSettings({});
      } else {
        const map: Record<string, string> = {};
        ((settingsRes.data || []) as SettingRow[]).forEach((r) => {
          map[r.key] = r.value || "";
        });
        setSettings(map);
      }

      if (banksRes.error) {
        setMsg("Failed to load IET banks: " + banksRes.error.message);
        setBanks([]);
      } else {
        setBanks(
          ((banksRes.data || []) as BankAccount[]).map((b) => ({
            ...b,
            total_fund: Number(b.total_fund || 0),
            allocated_amount: Number(b.allocated_amount || 0),
            reserved_amount: Number(b.reserved_amount || 0),
            expenditure: Number(b.expenditure || 0),
            unallocated_balance: Number(b.unallocated_balance || 0),
            available_balance: Number(b.available_balance || 0),
          }))
        );
      }

      if (subheadsRes.error) {
        setMsg("Failed to load subheads: " + subheadsRes.error.message);
        setSubheads([]);
      } else {
        setSubheads(
          ((subheadsRes.data || []) as SubheadRow[]).map((s) => ({
            ...s,
            approved_allocation: Number(s.approved_allocation || 0),
            reserved_amount: Number(s.reserved_amount || 0),
            expenditure: Number(s.expenditure || 0),
            balance: Number(s.balance || 0),
          }))
        );
      }

      setLoading(false);
      setRefreshing(false);
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

  useEffect(() => {
    if (!selectedUserId) return;
    const u = usersById.get(selectedUserId);
    setSelectedRole(u?.role || "Staff");
  }, [selectedUserId, usersById]);

  async function saveUserRole() {
    setMsg(null);

    if (!selectedUserId) {
      setMsg("❌ Please select a user.");
      return;
    }

    const user = usersById.get(selectedUserId);

    if (!user) {
      setMsg("❌ Selected user not found.");
      return;
    }

    if (requiresSignature(selectedRole) && !user.signature_url) {
      setMsg(`❌ ${selectedRole} role requires a signature. User must upload signature first.`);
      return;
    }

    setSaving(true);
    setSavingTarget("role");

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: selectedRole })
        .eq("id", selectedUserId);

      if (error) throw new Error(error.message);

      setMsg("✅ User role updated successfully.");
      await loadAll({ silent: true });
      router.refresh();
    } catch (e: any) {
      setMsg("❌ Role update failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
      setSavingTarget(null);
    }
  }

  async function saveDept(deptId: string, hodId: string | null, directorId: string | null) {
    setMsg(null);

    if (hodId) {
      const hodUser = usersById.get(hodId);

      if (hodUser && !hodUser.signature_url) {
        setMsg("❌ HOD must have a signature before assignment.");
        return;
      }
    }

    if (directorId) {
      const directorUser = usersById.get(directorId);

      if (directorUser && !directorUser.signature_url) {
        setMsg("❌ Director must have a signature before assignment.");
        return;
      }
    }

    setSaving(true);
    setSavingTarget(`dept-${deptId}`);

    try {
      const { error } = await supabase
        .from("departments")
        .update({
          hod_user_id: hodId || null,
          director_user_id: directorId || null,
        })
        .eq("id", deptId);

      if (error) throw new Error(error.message);

      setMsg("✅ Department routing saved.");
      await loadAll({ silent: true });
      router.refresh();
    } catch (e: any) {
      setMsg("❌ Department save failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
      setSavingTarget(null);
    }
  }

  async function saveSetting(key: string, value: string) {
    setMsg(null);

    if (!value) {
      setMsg("❌ Please select a user.");
      return;
    }

    const user = usersById.get(value);

    if (!user) {
      setMsg("❌ Selected user not found.");
      return;
    }

    if (!user.signature_url) {
      setMsg("❌ Selected officer must have a signature before assignment.");
      return;
    }

    setSaving(true);
    setSavingTarget(key);

    try {
      const { error } = await supabase.from("app_settings").upsert({ key, value });

      if (error) throw new Error(error.message);

      setMsg("✅ Global officer saved.");
      await loadAll({ silent: true });
      router.refresh();
    } catch (e: any) {
      setMsg("❌ Global officer save failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
      setSavingTarget(null);
    }
  }

  function go(path: string) {
    router.push(`${path}?updated=${Date.now()}`);
    router.refresh();
  }

  function officerName(id: string | null | undefined) {
    if (!id) return "Not assigned";
    const u = usersById.get(id);
    return u?.full_name || u?.email || "Unknown user";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-7xl py-10 text-slate-600">Loading Admin Control Center...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-7xl py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Admin Control Center
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Logged in as <b className="text-slate-900">{meEmail || "—"}</b> • Role{" "}
              <b className="text-slate-900">{meRole}</b>
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Manage institution structure, users, workflow routing, IET bank funding, subheads,
              security and audit controls.
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
              onClick={() => go("/admin/users")}
              disabled={refreshing || saving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              Users & Roles
            </button>

            <button
              onClick={() => go("/dashboard")}
              disabled={refreshing || saving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              Dashboard
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm">
            {msg}
          </div>
        )}

        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-900">
          This panel refreshes automatically when you return to it. Admin changes to roles, routing,
          departments, IET Banks and finance control pages should be tested immediately after saving.
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Total Users" value={String(stats.totalUsers)} tone="blue" />
          <StatCard title="Signature Ready" value={String(stats.signatureReadyCount)} tone="emerald" />
          <StatCard title="Needs Signature" value={String(stats.needsSignature)} tone="amber" />
          <StatCard title="Departments" value={String(stats.departments)} tone="slate" />
          <StatCard title="Routed Depts" value={String(stats.routedDepartments)} tone="purple" />
          <StatCard title="Admin Alerts" value={String(stats.criticalAlerts)} tone="red" />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WideStat title="IET Bank Fund" value={naira(stats.bankTotalFund)} tone="blue" />
          <WideStat title="Allocated to Subheads" value={naira(stats.bankAllocated)} tone="purple" />
          <WideStat title="Unallocated Bank Balance" value={naira(stats.bankUnallocated)} tone="emerald" />
          <WideStat title="Bank Available Balance" value={naira(stats.bankAvailable)} tone="emerald" />
        </div>

        <div className="mt-6 rounded-3xl border bg-white p-2 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <TabButton label="Control Center" active={activeTab === "control"} onClick={() => setActiveTab("control")} />
            <TabButton label="Quick Roles" active={activeTab === "roles"} onClick={() => setActiveTab("roles")} />
            <TabButton label="Global Routing" active={activeTab === "global"} onClick={() => setActiveTab("global")} />
            <TabButton label="Department Routing" active={activeTab === "departments"} onClick={() => setActiveTab("departments")} />
            <TabButton label="Signature Readiness" active={activeTab === "signatures"} onClick={() => setActiveTab("signatures")} />
          </div>
        </div>

        {activeTab === "control" && (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <ControlCard
                title="Departments"
                description="Create, edit, activate, deactivate and safely manage departments."
                metric={`${stats.activeDepartments} active / ${stats.inactiveDepartments} inactive`}
                tone="blue"
                primaryLabel="Manage Departments"
                onPrimary={() => go("/finance/departments")}
              />

              <ControlCard
                title="Users & Roles"
                description="Assign roles, review users and control staff workflow access."
                metric={`${stats.totalUsers} users`}
                tone="purple"
                primaryLabel="Open Users"
                onPrimary={() => go("/admin/users")}
              />

              <ControlCard
                title="Routing Settings"
                description="Assign Registry, DG, HR, Director and HOD workflow officers."
                metric={`${stats.routedDepartments}/${stats.departments} departments routed`}
                tone="amber"
                primaryLabel="Open Routing"
                onPrimary={() => setActiveTab("departments")}
              />

              <ControlCard
                title="IET Bank Accounts"
                description="Set total bank funds and monitor bank allocation balances."
                metric={naira(stats.bankTotalFund)}
                tone="emerald"
                primaryLabel="Manage Banks"
                onPrimary={() => go("/finance/manage-accounts")}
              />

              <ControlCard
                title="Subheads"
                description="Create subheads from departments and allocate from IET Banks."
                metric={`${stats.activeSubheads}/${stats.totalSubheads} active`}
                tone="blue"
                primaryLabel="Manage Subheads"
                onPrimary={() => go("/finance/subheads")}
              />

              <ControlCard
                title="Audit & Reconciliation"
                description="Review bank funding, ledger, subheads, vouchers and exceptions."
                metric={`${stats.overAllocatedBanks + stats.negativeSubheads} finance alerts`}
                tone="red"
                primaryLabel="Open Audit"
                onPrimary={() => go("/finance/audit")}
              />

              <ControlCard
                title="Security"
                description="Review MFA, access control, backup practice and governance checklist."
                metric="Admin/Auditor"
                tone="purple"
                primaryLabel="Security Checklist"
                onPrimary={() => go("/admin/security")}
              />

              <ControlCard
                title="Payment Voucher Settings"
                description="Control voucher signing, payment settings and finance readiness."
                metric="PV Control"
                tone="amber"
                primaryLabel="PV Settings"
                onPrimary={() => go("/payment-vouchers/settings")}
              />
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <div className="rounded-3xl border bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Finance Control Snapshot</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Bank and subhead integrity indicators for management action.
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <InfoMetric title="Total Subhead Allocation" value={naira(stats.subheadAllocation)} />
                  <InfoMetric title="Reserved Amount" value={naira(stats.subheadReserved)} />
                  <InfoMetric title="Expenditure" value={naira(stats.subheadExpenditure)} />
                  <InfoMetric title="Subhead Balance" value={naira(stats.subheadBalance)} />
                  <InfoMetric title="Subheads Without Bank" value={String(stats.subheadsNoBank)} />
                  <InfoMetric title="Over-Allocated Banks" value={String(stats.overAllocatedBanks)} />
                </div>
              </div>

              <div className="rounded-3xl border bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Role Distribution</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Current user-role spread in ReqGen.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {Object.entries(stats.roleCounts).map(([role, count]) => (
                    <span
                      key={role}
                      className={`rounded-full border px-3 py-2 text-xs font-bold ${roleBadgeClass(role)}`}
                    >
                      {role}: {count}
                    </span>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                  Signature-sensitive roles should only be assigned after the user uploads a signature.
                </div>
              </div>
            </div>

            <BankPreview banks={banks} />
          </>
        )}

        {activeTab === "roles" && (
          <QuickRolePanel
            users={users}
            selectedUserId={selectedUserId}
            selectedRole={selectedRole}
            saving={saving}
            savingTarget={savingTarget}
            setSelectedUserId={setSelectedUserId}
            setSelectedRole={setSelectedRole}
            saveUserRole={saveUserRole}
            goUsersRoles={() => go("/admin/users")}
          />
        )}

        {activeTab === "global" && (
          <GlobalRoutingPanel
            settings={settings}
            setSettings={setSettings}
            saving={saving}
            savingTarget={savingTarget}
            signatureReadyUsers={signatureReadyUsers}
            officerName={officerName}
            saveSetting={saveSetting}
          />
        )}

        {activeTab === "departments" && (
          <DepartmentRoutingPanel
            depts={depts}
            setDepts={setDepts}
            saving={saving}
            savingTarget={savingTarget}
            routingUsers={departmentRoutingUsers}
            officerName={officerName}
            saveDept={saveDept}
          />
        )}

        {activeTab === "signatures" && <SignatureReadinessPanel users={users} />}

        <div className="mt-6 rounded-3xl border border-amber-100 bg-amber-50 p-5 text-sm text-amber-900">
          <div className="font-bold">Admin Control Note</div>
          <p className="mt-1">
            Admin can control the operational foundation of ReqGen, but finance amounts should remain
            traceable. IET Bank funding should flow into subheads, then reservations and expenditure
            should reconcile through Audit & Reconciliation.
          </p>
        </div>
      </div>
    </main>
  );
}

function QuickRolePanel({
  users,
  selectedUserId,
  selectedRole,
  saving,
  savingTarget,
  setSelectedUserId,
  setSelectedRole,
  saveUserRole,
  goUsersRoles,
}: {
  users: UserRow[];
  selectedUserId: string;
  selectedRole: string;
  saving: boolean;
  savingTarget: string | null;
  setSelectedUserId: (v: string) => void;
  setSelectedRole: (v: string) => void;
  saveUserRole: () => void;
  goUsersRoles: () => void;
}) {
  return (
    <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Quick Role Assignment</h2>
          <p className="mt-1 text-sm text-slate-600">
            Critical workflow roles require signature readiness before assignment.
          </p>
        </div>

        <button
          onClick={goUsersRoles}
          disabled={saving}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
        >
          Advanced Users Page
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="text-sm font-semibold text-slate-800">Select User</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            disabled={saving}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 disabled:bg-slate-50"
          >
            <option value="">-- Select user --</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {(u.full_name || u.email || u.id) +
                  (u.role ? ` (${u.role})` : "") +
                  (u.signature_url ? " • Signature Ready" : " • No Signature")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-800">Role</label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            disabled={saving}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 disabled:bg-slate-50"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <span
            className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${roleBadgeClass(
              selectedRole
            )}`}
          >
            {selectedRole}
          </span>
        </div>
      </div>

      <button
        onClick={saveUserRole}
        disabled={saving}
        className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {savingTarget === "role" ? "Saving Role..." : "Save Role"}
      </button>
    </div>
  );
}

function GlobalRoutingPanel({
  settings,
  setSettings,
  saving,
  savingTarget,
  signatureReadyUsers,
  officerName,
  saveSetting,
}: {
  settings: Record<string, string>;
  setSettings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  saving: boolean;
  savingTarget: string | null;
  signatureReadyUsers: UserRow[];
  officerName: (id: string | null | undefined) => string;
  saveSetting: (key: string, value: string) => void;
}) {
  return (
    <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Global Routing Officers</h2>
      <p className="mt-1 text-sm text-slate-600">
        Registry, DG and HR must always be assigned to signature-ready users.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {GLOBAL_KEYS.map((k) => (
          <div key={k} className="rounded-2xl border border-slate-200 p-4">
            <div className="text-sm font-bold text-slate-900">{officerLabel(k)}</div>
            <div className="mt-1 text-xs text-slate-500">
              Current: {officerName(settings[k])}
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <select
                value={settings[k] || ""}
                onChange={(e) => setSettings((s) => ({ ...s, [k]: e.target.value }))}
                disabled={saving}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 disabled:bg-slate-50"
              >
                <option value="">-- Select user --</option>
                {signatureReadyUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email || u.id}
                  </option>
                ))}
              </select>

              <button
                onClick={() => saveSetting(k, settings[k] || "")}
                disabled={saving}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {savingTarget === k ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DepartmentRoutingPanel({
  depts,
  setDepts,
  saving,
  savingTarget,
  routingUsers,
  officerName,
  saveDept,
}: {
  depts: DeptRow[];
  setDepts: React.Dispatch<React.SetStateAction<DeptRow[]>>;
  saving: boolean;
  savingTarget: string | null;
  routingUsers: UserRow[];
  officerName: (id: string | null | undefined) => string;
  saveDept: (deptId: string, hodId: string | null, directorId: string | null) => void;
}) {
  return (
    <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Department Routing</h2>
      <p className="mt-1 text-sm text-slate-600">
        If Director is assigned, request starts with Director then moves to HOD. If no Director is
        assigned, request starts at HOD.
      </p>

      <div className="mt-4 grid gap-4">
        {depts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 p-5 text-sm text-slate-600">
            No departments found.
          </div>
        ) : (
          depts.map((d) => (
            <div key={d.id} className="rounded-2xl border border-slate-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-900">{d.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Director: {officerName(d.director_user_id)} • HOD: {officerName(d.hod_user_id)}
                  </div>
                </div>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${
                    d.is_active === false
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {d.is_active === false ? "Inactive" : "Active"}
                </span>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-800">Director</label>
                  <select
                    value={d.director_user_id || ""}
                    disabled={saving}
                    onChange={(e) =>
                      setDepts((prev) =>
                        prev.map((x) =>
                          x.id === d.id ? { ...x, director_user_id: e.target.value || null } : x
                        )
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 disabled:bg-slate-50"
                  >
                    <option value="">-- None --</option>
                    {routingUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.email || u.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-800">HOD</label>
                  <select
                    value={d.hod_user_id || ""}
                    disabled={saving}
                    onChange={(e) =>
                      setDepts((prev) =>
                        prev.map((x) =>
                          x.id === d.id ? { ...x, hod_user_id: e.target.value || null } : x
                        )
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 disabled:bg-slate-50"
                  >
                    <option value="">-- None --</option>
                    {routingUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.email || u.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={() => saveDept(d.id, d.hod_user_id, d.director_user_id)}
                disabled={saving}
                className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
              >
                {savingTarget === `dept-${d.id}` ? "Saving..." : "Save Department Routing"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SignatureReadinessPanel({ users }: { users: UserRow[] }) {
  return (
    <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Signature Readiness</h2>
      <p className="mt-1 text-sm text-slate-600">
        Users without signature should not handle workflow-sensitive roles.
      </p>

      <div className="mt-4 grid gap-3 xl:hidden">
        {users.map((u) => {
          const ready = !!u.signature_url;

          return (
            <div key={u.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="font-bold text-slate-900">{u.full_name || "—"}</div>
              <div className="mt-1 text-sm text-slate-600">{u.email || "—"}</div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${roleBadgeClass(
                    u.role || "Staff"
                  )}`}
                >
                  {u.role || "Staff"}
                </span>

                {ready ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    Signature Ready
                  </span>
                ) : (
                  <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                    No Signature
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 hidden overflow-x-auto xl:block">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-left text-sm text-slate-600">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Signature</th>
              <th className="py-2 pr-4">Ready</th>
            </tr>
          </thead>

          <tbody>
            {users.map((u) => {
              const ready = !!u.signature_url;

              return (
                <tr key={u.id} className="border-b border-slate-100 text-sm text-slate-800">
                  <td className="py-2 pr-4 font-semibold">{u.full_name || "—"}</td>
                  <td className="py-2 pr-4">{u.email || "—"}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${roleBadgeClass(
                        u.role || "Staff"
                      )}`}
                    >
                      {u.role || "Staff"}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{u.signature_url ? "✅ Present" : "❌ Missing"}</td>
                  <td className="py-2 pr-4">
                    {ready ? (
                      <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                        Ready
                      </span>
                    ) : (
                      <span className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                        Not Ready
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BankPreview({ banks }: { banks: BankAccount[] }) {
  if (banks.length === 0) return null;

  return (
    <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">IET Banks Preview</h2>
      <p className="mt-1 text-sm text-slate-600">
        Quick view of configured IET bank funding sources.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {banks.slice(0, 6).map((bank) => (
          <div key={bank.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="font-extrabold text-slate-900">{bankLabel(bank)}</div>
            <div className="mt-1 text-xs text-slate-500">
              {bank.bank_name || "Bank"} • {maskAccountNumber(bank.account_number)}
            </div>

            <div className="mt-3 grid gap-2 text-sm">
              <InfoLine label="Total Fund" value={naira(bank.total_fund)} />
              <InfoLine label="Allocated" value={naira(bank.allocated_amount)} />
              <InfoLine label="Available" value={naira(bank.available_balance)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ControlCard({
  title,
  description,
  metric,
  tone,
  primaryLabel,
  onPrimary,
}: {
  title: string;
  description: string;
  metric: string;
  tone: "blue" | "emerald" | "amber" | "purple" | "red";
  primaryLabel: string;
  onPrimary: () => void;
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : tone === "amber"
      ? "bg-amber-50 text-amber-700 border-amber-100"
      : tone === "purple"
      ? "bg-purple-50 text-purple-700 border-purple-100"
      : tone === "red"
      ? "bg-red-50 text-red-700 border-red-100"
      : "bg-blue-50 text-blue-700 border-blue-100";

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className={`inline-flex rounded-2xl border px-3 py-2 text-xs font-black ${cls}`}>
        {metric}
      </div>

      <h3 className="mt-4 text-lg font-extrabold text-slate-900">{title}</h3>
      <p className="mt-2 min-h-[48px] text-sm text-slate-600">{description}</p>

      <button
        onClick={onPrimary}
        className="mt-4 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
      >
        {primaryLabel}
      </button>
    </div>
  );
}

function StatCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "blue" | "emerald" | "amber" | "slate" | "purple" | "red";
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "amber"
      ? "bg-amber-50 text-amber-700"
      : tone === "purple"
      ? "bg-purple-50 text-purple-700"
      : tone === "red"
      ? "bg-red-50 text-red-700"
      : tone === "slate"
      ? "bg-slate-50 text-slate-700"
      : "bg-blue-50 text-blue-700";

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      <div className={`mt-2 inline-flex rounded-2xl px-3 py-2 text-2xl font-extrabold ${cls}`}>
        {value}
      </div>
    </div>
  );
}

function WideStat({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "blue" | "emerald" | "amber" | "slate" | "purple" | "red";
}) {
  return <StatCard title={title} value={value} tone={tone} />;
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

function InfoMetric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="mt-2 text-lg font-extrabold text-slate-900">{value}</div>
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