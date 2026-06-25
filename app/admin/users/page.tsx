"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Dept = {
  id: string;
  name: string;
  is_active?: boolean | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  dept_id: string | null;
  signature_url: string | null;
  created_at?: string | null;
};

type TabKey = "overview" | "users" | "sensitive" | "signature";

const ROLES = [
  "Staff",
  "Admin",
  "Auditor",
  "Account",
  "Accounts",
  "AccountOfficer",
  "Director",
  "HOD",
  "HR",
  "Registry",
  "DG",
] as const;

const SENSITIVE_ROLE_KEYS = [
  "admin",
  "auditor",
  "account",
  "accounts",
  "accountofficer",
  "director",
  "hod",
  "hr",
  "registry",
  "dg",
];

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function requiresSignature(role: string | null | undefined) {
  return SENSITIVE_ROLE_KEYS.includes(roleKey(role));
}

function shortDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function roleBadgeClass(role: string | null | undefined) {
  const rk = roleKey(role);

  if (rk === "admin") return "bg-red-50 text-red-700 border-red-200";
  if (rk === "auditor") return "bg-purple-50 text-purple-700 border-purple-200";
  if (["account", "accounts", "accountofficer"].includes(rk)) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (["director", "hod", "dg"].includes(rk)) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }
  if (["hr", "registry"].includes(rk)) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  return "bg-slate-50 text-slate-700 border-slate-200";
}

function signatureBadgeClass(ready: boolean) {
  return ready
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-red-200 bg-red-50 text-red-700";
}

function roleLabel(role: string | null | undefined) {
  return role || "Staff";
}

function userLabel(u: ProfileRow) {
  return u.full_name || u.email || u.id;
}

export default function AdminUsersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [meRole, setMeRole] = useState<string>("Staff");

  const canAdmin = useMemo(() => {
    const rk = roleKey(meRole);
    return rk === "admin" || rk === "auditor";
  }, [meRole]);

  const canEditRoles = useMemo(() => {
    return roleKey(meRole) === "admin" || roleKey(meRole) === "auditor";
  }, [meRole]);

  const [depts, setDepts] = useState<Dept[]>([]);
  const [rows, setRows] = useState<ProfileRow[]>([]);

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [signatureFilter, setSignatureFilter] = useState("ALL");

  const [savingId, setSavingId] = useState<string | null>(null);

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

      setAuthUserId(auth.user.id);

      const { data: me, error: meErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (meErr) {
        setMsg("Failed to load your profile: " + meErr.message);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const role = (me?.role as string) || "Staff";
      setMeRole(role);

      if (!["admin", "auditor"].includes(roleKey(role))) {
        setMsg("Access denied. Only Admin/Auditor can manage users and roles.");
        setDepts([]);
        setRows([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const [deptRes, profileRes] = await Promise.all([
        supabase
          .from("departments")
          .select("id,name,is_active")
          .order("name", { ascending: true }),

        supabase
          .from("profiles")
          .select("id,full_name,email,role,dept_id,signature_url,created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (deptRes.error) {
        setMsg("Failed to load departments: " + deptRes.error.message);
        setDepts([]);
      } else {
        setDepts((deptRes.data || []) as Dept[]);
      }

      if (profileRes.error) {
        setMsg("Failed to load users: " + profileRes.error.message);
        setRows([]);
      } else {
        setRows((profileRes.data || []) as ProfileRow[]);
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

  const deptMap = useMemo(() => {
    const m: Record<string, string> = {};
    depts.forEach((d) => {
      m[d.id] = d.name;
    });
    return m;
  }, [depts]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    return rows.filter((r) => {
      const deptName = r.dept_id ? deptMap[r.dept_id] || "" : "";
      const rk = roleKey(r.role);
      const signatureReady = !!r.signature_url;

      if (roleFilter !== "ALL" && rk !== roleKey(roleFilter)) return false;
      if (deptFilter !== "ALL" && (r.dept_id || "") !== deptFilter) return false;
      if (signatureFilter === "READY" && !signatureReady) return false;
      if (signatureFilter === "MISSING" && signatureReady) return false;
      if (signatureFilter === "SENSITIVE_MISSING" && (!requiresSignature(r.role) || signatureReady)) {
        return false;
      }

      if (!s) return true;

      return (
        (r.full_name || "").toLowerCase().includes(s) ||
        (r.email || "").toLowerCase().includes(s) ||
        (r.role || "").toLowerCase().includes(s) ||
        deptName.toLowerCase().includes(s) ||
        (signatureReady ? "signature ready" : "no signature").includes(s)
      );
    });
  }, [rows, q, deptMap, roleFilter, deptFilter, signatureFilter]);

  const sensitiveUsers = useMemo(() => {
    return rows.filter((r) => requiresSignature(r.role));
  }, [rows]);

  const missingSensitiveSignatures = useMemo(() => {
    return rows.filter((r) => requiresSignature(r.role) && !r.signature_url);
  }, [rows]);

  const stats = useMemo(() => {
    const total = rows.length;
    const staff = rows.filter((r) => roleKey(r.role) === "staff").length;
    const admin = rows.filter((r) => roleKey(r.role) === "admin").length;
    const auditor = rows.filter((r) => roleKey(r.role) === "auditor").length;
    const finance = rows.filter((r) =>
      ["account", "accounts", "accountofficer"].includes(roleKey(r.role))
    ).length;
    const leadership = rows.filter((r) =>
      ["director", "hod", "dg"].includes(roleKey(r.role))
    ).length;
    const hrRegistry = rows.filter((r) =>
      ["hr", "registry"].includes(roleKey(r.role))
    ).length;
    const signatureReady = rows.filter((r) => !!r.signature_url).length;
    const signatureMissing = rows.filter((r) => !r.signature_url).length;
    const noDepartment = rows.filter((r) => !r.dept_id).length;
    const sensitive = rows.filter((r) => requiresSignature(r.role)).length;
    const sensitiveMissingSignature = rows.filter(
      (r) => requiresSignature(r.role) && !r.signature_url
    ).length;

    return {
      total,
      staff,
      admin,
      auditor,
      finance,
      leadership,
      hrRegistry,
      signatureReady,
      signatureMissing,
      noDepartment,
      sensitive,
      sensitiveMissingSignature,
    };
  }, [rows]);

  async function updateUser(id: string, patch: Partial<ProfileRow>) {
    if (!canEditRoles) {
      setMsg("❌ Only Admin/Auditor can update users.");
      return;
    }

    const currentUser = rows.find((r) => r.id === id);

    if (!currentUser) {
      setMsg("❌ User not found.");
      return;
    }

    const nextRole = patch.role || "Staff";
    const nextDeptId = patch.dept_id || null;

    if (requiresSignature(nextRole) && !currentUser.signature_url) {
      setMsg(
        `❌ ${nextRole} is a signature-sensitive role. ${userLabel(
          currentUser
        )} must upload a signature before this role can be assigned.`
      );
      return;
    }

    if (id === authUserId && roleKey(currentUser.role) === "admin" && roleKey(nextRole) !== "admin") {
      setMsg("❌ You cannot remove your own Admin role from this page.");
      return;
    }

    const adminCount = rows.filter((r) => roleKey(r.role) === "admin").length;

    if (roleKey(currentUser.role) === "admin" && roleKey(nextRole) !== "admin" && adminCount <= 1) {
      setMsg("❌ At least one Admin user must remain in the system.");
      return;
    }

    setSavingId(id);
    setMsg(null);

    try {
      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) {
        router.push("/login");
        return;
      }

      const cleanPatch = {
        role: nextRole,
        dept_id: nextDeptId,
      };

      const { error } = await supabase.from("profiles").update(cleanPatch).eq("id", id);

      if (error) throw new Error(error.message);

      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...cleanPatch } : r)));

      setMsg("✅ User role/department routing updated.");
      await load({ silent: true });
      router.refresh();
    } catch (e: any) {
      setMsg("❌ Update failed: " + (e?.message || "Unknown error"));
    } finally {
      setSavingId(null);
    }
  }

  function resetFilters() {
    setQ("");
    setRoleFilter("ALL");
    setDeptFilter("ALL");
    setSignatureFilter("ALL");
  }

  function goDashboard() {
    router.push(`/dashboard?updated=${Date.now()}`);
    router.refresh();
  }

  function goAdmin() {
    router.push(`/admin?updated=${Date.now()}`);
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-7xl py-10 text-slate-600">Loading Users & Roles...</div>
      </main>
    );
  }

  if (!canAdmin) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-6xl py-10">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="text-lg font-bold text-slate-900">Access denied</div>
            <div className="mt-1 text-sm text-slate-600">
              Only Admin/Auditor can manage users and roles.
            </div>

            {msg && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {msg}
              </div>
            )}

            <button
              onClick={goDashboard}
              className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
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
      <div className="mx-auto max-w-7xl py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Users & Roles
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Assign global roles, department routing and signature-sensitive workflow access.
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Current role: {meRole || "—"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => load({ silent: true })}
              disabled={refreshing || !!savingId}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={goAdmin}
              disabled={refreshing || !!savingId}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              Admin Panel
            </button>

            <button
              onClick={goDashboard}
              disabled={refreshing || !!savingId}
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
          Signature-sensitive roles include Admin, Auditor, Account/Accounts/AccountOfficer, Director,
          HOD, HR, Registry and DG. Users should upload signature before receiving these roles.
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          <StatCard title="Total Users" value={String(stats.total)} tone="blue" />
          <StatCard title="Staff" value={String(stats.staff)} tone="slate" />
          <StatCard title="Admin" value={String(stats.admin)} tone="red" />
          <StatCard title="Auditor" value={String(stats.auditor)} tone="purple" />
          <StatCard title="Finance" value={String(stats.finance)} tone="emerald" />
          <StatCard title="Leadership" value={String(stats.leadership)} tone="blue" />
          <StatCard title="HR/Registry" value={String(stats.hrRegistry)} tone="amber" />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WideStat title="Signature Ready" value={String(stats.signatureReady)} tone="emerald" />
          <WideStat title="Signature Missing" value={String(stats.signatureMissing)} tone="red" />
          <WideStat title="Sensitive Roles" value={String(stats.sensitive)} tone="purple" />
          <WideStat
            title="Sensitive Missing Signature"
            value={String(stats.sensitiveMissingSignature)}
            tone="amber"
          />
        </div>

        <div className="mt-6 rounded-3xl border bg-white p-2 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <TabButton label="Overview" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
            <TabButton label="All Users" active={activeTab === "users"} onClick={() => setActiveTab("users")} />
            <TabButton label="Sensitive Roles" active={activeTab === "sensitive"} onClick={() => setActiveTab("sensitive")} />
            <TabButton label="Signature Readiness" active={activeTab === "signature"} onClick={() => setActiveTab("signature")} />
          </div>
        </div>

        <div className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="xl:col-span-2">
              <label className="text-sm font-semibold text-slate-800">Search</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
                placeholder="Search name, email, role, department or signature..."
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Role</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Roles</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Department</label>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Departments</option>
                <option value="">No Department</option>
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Signature</label>
              <select
                value={signatureFilter}
                onChange={(e) => setSignatureFilter(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Signature Status</option>
                <option value="READY">Signature Ready</option>
                <option value="MISSING">Signature Missing</option>
                <option value="SENSITIVE_MISSING">Sensitive Role Missing Signature</option>
              </select>
            </div>

            <div className="flex items-end xl:col-span-5">
              <button
                onClick={resetFilters}
                disabled={refreshing || !!savingId}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {activeTab === "overview" && (
          <OverviewPanel
            rows={rows}
            sensitiveUsers={sensitiveUsers}
            missingSensitiveSignatures={missingSensitiveSignatures}
            deptMap={deptMap}
          />
        )}

        {activeTab === "sensitive" && (
          <SensitivePanel
            rows={sensitiveUsers}
            depts={depts}
            deptMap={deptMap}
            savingId={savingId}
            refreshing={refreshing}
            onSave={updateUser}
          />
        )}

        {activeTab === "signature" && (
          <SignaturePanel
            rows={rows}
            depts={depts}
            deptMap={deptMap}
            savingId={savingId}
            refreshing={refreshing}
            onSave={updateUser}
          />
        )}

        {(activeTab === "users" || activeTab === "overview") && (
          <UsersRegister
            rows={filtered}
            depts={depts}
            deptMap={deptMap}
            savingId={savingId}
            refreshing={refreshing}
            onSave={updateUser}
          />
        )}

        <div className="mt-6 rounded-3xl border border-amber-100 bg-amber-50 p-5 text-sm text-amber-900">
          <div className="font-bold">Role & Routing Note</div>
          <p className="mt-1">
            Use department routing mainly for HOD and Director workflow ownership. Admin and Auditor
            should be controlled carefully because they can access sensitive management and finance
            sections. AccountOfficer is used for finance/account payment-stage ownership.
          </p>
        </div>
      </div>
    </main>
  );
}

function OverviewPanel({
  rows,
  sensitiveUsers,
  missingSensitiveSignatures,
  deptMap,
}: {
  rows: ProfileRow[];
  sensitiveUsers: ProfileRow[];
  missingSensitiveSignatures: ProfileRow[];
  deptMap: Record<string, string>;
}) {
  const recentUsers = rows.slice(0, 8);

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Sensitive Role Readiness</h2>
        <p className="mt-1 text-sm text-slate-600">
          These are users occupying workflow-sensitive roles.
        </p>

        <div className="mt-4 grid gap-3">
          {sensitiveUsers.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              No sensitive role user found.
            </div>
          ) : (
            sensitiveUsers.slice(0, 8).map((u) => (
              <div key={u.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-extrabold text-slate-900">{userLabel(u)}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {u.email || "—"} • {u.dept_id ? deptMap[u.dept_id] || "Unknown Department" : "No Department"}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <RoleBadge role={u.role} />
                    <SignatureBadge ready={!!u.signature_url} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Attention Required</h2>
        <p className="mt-1 text-sm text-slate-600">
          Sensitive users without signature should be fixed before production pilot.
        </p>

        <div className="mt-4 grid gap-3">
          {missingSensitiveSignatures.length === 0 ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
              All sensitive-role users have signatures.
            </div>
          ) : (
            missingSensitiveSignatures.map((u) => (
              <div key={u.id} className="rounded-2xl border border-red-100 bg-red-50 p-4">
                <div className="font-extrabold text-red-900">{userLabel(u)}</div>
                <div className="mt-1 text-xs text-red-700">
                  {u.email || "—"} • Role: {roleLabel(u.role)}
                </div>
              </div>
            ))
          )}
        </div>

        <h3 className="mt-6 text-sm font-black uppercase tracking-wide text-slate-500">
          Recently Added Users
        </h3>

        <div className="mt-3 grid gap-2">
          {recentUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
              <div>
                <div className="text-sm font-bold text-slate-900">{userLabel(u)}</div>
                <div className="text-xs text-slate-500">Joined {shortDate(u.created_at)}</div>
              </div>
              <RoleBadge role={u.role} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SensitivePanel({
  rows,
  depts,
  deptMap,
  savingId,
  refreshing,
  onSave,
}: {
  rows: ProfileRow[];
  depts: Dept[];
  deptMap: Record<string, string>;
  savingId: string | null;
  refreshing: boolean;
  onSave: (id: string, patch: Partial<ProfileRow>) => Promise<void>;
}) {
  return (
    <UsersRegister
      rows={rows}
      depts={depts}
      deptMap={deptMap}
      savingId={savingId}
      refreshing={refreshing}
      onSave={onSave}
      title="Sensitive Role Users"
      subtitle="Users with workflow-sensitive roles requiring signature readiness."
    />
  );
}

function SignaturePanel({
  rows,
  depts,
  deptMap,
  savingId,
  refreshing,
  onSave,
}: {
  rows: ProfileRow[];
  depts: Dept[];
  deptMap: Record<string, string>;
  savingId: string | null;
  refreshing: boolean;
  onSave: (id: string, patch: Partial<ProfileRow>) => Promise<void>;
}) {
  const sorted = [...rows].sort((a, b) => Number(!!a.signature_url) - Number(!!b.signature_url));

  return (
    <UsersRegister
      rows={sorted}
      depts={depts}
      deptMap={deptMap}
      savingId={savingId}
      refreshing={refreshing}
      onSave={onSave}
      title="Signature Readiness"
      subtitle="Review which users have uploaded signature images."
    />
  );
}

function UsersRegister({
  rows,
  depts,
  deptMap,
  savingId,
  refreshing,
  onSave,
  title = "Users Register",
  subtitle = "Update user role and optional department routing.",
}: {
  rows: ProfileRow[];
  depts: Dept[];
  deptMap: Record<string, string>;
  savingId: string | null;
  refreshing: boolean;
  onSave: (id: string, patch: Partial<ProfileRow>) => Promise<void>;
  title?: string;
  subtitle?: string;
}) {
  return (
    <>
      <div className="mt-6 grid gap-4 xl:hidden">
        {rows.length === 0 ? (
          <EmptyState />
        ) : (
          rows.map((u) => (
            <UserCard
              key={u.id}
              u={u}
              depts={depts}
              deptMap={deptMap}
              saving={savingId === u.id}
              disabled={!!savingId || refreshing}
              onSave={onSave}
            />
          ))
        )}
      </div>

      <div className="mt-6 hidden overflow-hidden rounded-3xl border bg-white shadow-sm xl:block">
        <div className="border-b bg-slate-50 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>

        {rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1250px] w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Department Routing</th>
                  <th className="px-4 py-3 text-left">Signature</th>
                  <th className="px-4 py-3 text-left">Joined</th>
                  <th className="px-4 py-3 text-right">Save</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((u) => (
                  <UserTableRow
                    key={u.id}
                    u={u}
                    depts={depts}
                    deptMap={deptMap}
                    saving={savingId === u.id}
                    disabled={!!savingId || refreshing}
                    onSave={onSave}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function UserTableRow({
  u,
  depts,
  deptMap,
  saving,
  disabled,
  onSave,
}: {
  u: ProfileRow;
  depts: Dept[];
  deptMap: Record<string, string>;
  saving: boolean;
  disabled: boolean;
  onSave: (id: string, patch: Partial<ProfileRow>) => Promise<void>;
}) {
  const [role, setRole] = useState<string>(u.role || "Staff");
  const [deptId, setDeptId] = useState<string>(u.dept_id || "");

  useEffect(() => {
    setRole(u.role || "Staff");
    setDeptId(u.dept_id || "");
  }, [u.id, u.role, u.dept_id]);

  const changed = role !== (u.role || "Staff") || deptId !== (u.dept_id || "");

  return (
    <tr className="border-t hover:bg-slate-50">
      <td className="px-4 py-4">
        <div className="font-semibold text-slate-900">{u.full_name || "—"}</div>
        <div className="mt-1 text-xs text-slate-500">
          {u.dept_id ? deptMap[u.dept_id] || "Unknown Department" : "No department routing"}
        </div>
      </td>

      <td className="px-4 py-4 text-slate-700">{u.email || "—"}</td>

      <td className="px-4 py-4">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={disabled}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <RoleBadge role={role} />
      </td>

      <td className="px-4 py-4">
        <select
          value={deptId}
          onChange={(e) => setDeptId(e.target.value)}
          disabled={disabled}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
        >
          <option value="">— None —</option>
          {depts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <div className="mt-1 text-[11px] text-slate-500">Use mainly for HOD/Director routing.</div>
      </td>

      <td className="px-4 py-4">
        <SignatureBadge ready={!!u.signature_url} />
        {requiresSignature(role) && !u.signature_url && (
          <div className="mt-2 text-[11px] font-semibold text-red-700">
            Required for selected role
          </div>
        )}
      </td>

      <td className="px-4 py-4 text-xs text-slate-500">{shortDate(u.created_at)}</td>

      <td className="px-4 py-4 text-right">
        <button
          disabled={!changed || saving || disabled}
          onClick={() => onSave(u.id, { role, dept_id: deptId || null })}
          className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </td>
    </tr>
  );
}

function UserCard({
  u,
  depts,
  deptMap,
  saving,
  disabled,
  onSave,
}: {
  u: ProfileRow;
  depts: Dept[];
  deptMap: Record<string, string>;
  saving: boolean;
  disabled: boolean;
  onSave: (id: string, patch: Partial<ProfileRow>) => Promise<void>;
}) {
  const [role, setRole] = useState<string>(u.role || "Staff");
  const [deptId, setDeptId] = useState<string>(u.dept_id || "");

  useEffect(() => {
    setRole(u.role || "Staff");
    setDeptId(u.dept_id || "");
  }, [u.id, u.role, u.dept_id]);

  const changed = role !== (u.role || "Staff") || deptId !== (u.dept_id || "");

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-extrabold text-slate-900">{u.full_name || "—"}</div>
          <div className="mt-1 text-sm text-slate-600">{u.email || "—"}</div>
          <div className="mt-1 text-xs text-slate-500">Joined {shortDate(u.created_at)}</div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <RoleBadge role={role} />
          <SignatureBadge ready={!!u.signature_url} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-semibold text-slate-800">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={disabled}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          {requiresSignature(role) && !u.signature_url && (
            <div className="mt-2 text-xs font-semibold text-red-700">
              This selected role requires signature.
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-800">Dept Routing</label>
          <select
            value={deptId}
            onChange={(e) => setDeptId(e.target.value)}
            disabled={disabled}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
          >
            <option value="">— None —</option>
            {depts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <div className="mt-1 text-[11px] text-slate-500">
            Current: {u.dept_id ? deptMap[u.dept_id] || "Unknown Department" : "No department routing"}
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          disabled={!changed || saving || disabled}
          onClick={() => onSave(u.id, { role, dept_id: deptId || null })}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string | null | undefined }) {
  return (
    <span
      className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${roleBadgeClass(
        role || "Staff"
      )}`}
    >
      {role || "Staff"}
    </span>
  );
}

function SignatureBadge({ ready }: { ready: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${signatureBadgeClass(
        ready
      )}`}
    >
      {ready ? "Signature Ready" : "No Signature"}
    </span>
  );
}

function StatCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "blue" | "slate" | "red" | "purple" | "emerald" | "amber";
}) {
  const cls =
    tone === "red"
      ? "bg-red-50 text-red-700"
      : tone === "purple"
      ? "bg-purple-50 text-purple-700"
      : tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "amber"
      ? "bg-amber-50 text-amber-700"
      : tone === "slate"
      ? "bg-slate-50 text-slate-700"
      : "bg-blue-50 text-blue-700";

  return (
    <div className="rounded-3xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className={`mt-3 inline-flex rounded-2xl px-3 py-2 text-xl font-extrabold ${cls}`}>
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
  tone: "blue" | "slate" | "red" | "purple" | "emerald" | "amber";
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

function EmptyState() {
  return (
    <div className="rounded-2xl border-0 bg-white p-6 text-sm text-slate-600 xl:rounded-none">
      No users found.
    </div>
  );
}