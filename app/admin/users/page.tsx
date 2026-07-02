"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Dept = {
  id: string;
  name: string;
};

type ReqgenRole = {
  id: string;
  role_key: string;
  role_name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  requires_signature: boolean;
  sort_order: number;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  dept_id: string | null;
  signature_url?: string | null;
  created_at?: string | null;
};

type RoleFilter = "ALL" | string;
type DeptFilter = "ALL" | string;

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

function roleBadgeClass(role: string | null | undefined) {
  const rk = roleKey(role);

  if (rk === "admin") return "bg-red-50 text-red-700 border-red-200";
  if (rk === "auditor") return "bg-purple-50 text-purple-700 border-purple-200";
  if (["account", "accounts", "accountofficer"].includes(rk)) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (["director", "hod", "dg", "dinadmin"].includes(rk)) {
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

export default function AdminUsersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [meRole, setMeRole] = useState<string>("Staff");

  const canAdmin = useMemo(() => {
    const rk = roleKey(meRole);
    return rk === "admin" || rk === "auditor";
  }, [meRole]);

  const [depts, setDepts] = useState<Dept[]>([]);
  const [roles, setRoles] = useState<ReqgenRole[]>([]);
  const [rows, setRows] = useState<ProfileRow[]>([]);

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [deptFilter, setDeptFilter] = useState<DeptFilter>("ALL");
  const [signatureFilter, setSignatureFilter] = useState<"ALL" | "READY" | "MISSING">("ALL");

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
        setRoles([]);
        setRows([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const [deptRes, rolesRes, profileRes] = await Promise.all([
        supabase
          .from("departments")
          .select("id,name")
          .order("name", { ascending: true }),

        supabase
          .from("reqgen_roles")
          .select("id,role_key,role_name,description,is_system,is_active,requires_signature,sort_order")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("role_name", { ascending: true }),

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

      if (rolesRes.error) {
        setMsg("Failed to load roles: " + rolesRes.error.message);
        setRoles([]);
      } else {
        setRoles((rolesRes.data || []) as ReqgenRole[]);
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

  const roleMap = useMemo(() => {
    const m: Record<string, ReqgenRole> = {};
    roles.forEach((r) => {
      m[roleKey(r.role_name)] = r;
      m[roleKey(r.role_key)] = r;
    });
    return m;
  }, [roles]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    return rows.filter((r) => {
      const rk = roleKey(r.role || "Staff");
      const deptName = r.dept_id ? deptMap[r.dept_id] || "" : "";
      const ready = !!r.signature_url;

      if (roleFilter !== "ALL" && rk !== roleKey(roleFilter)) return false;
      if (deptFilter !== "ALL" && r.dept_id !== deptFilter) return false;
      if (signatureFilter === "READY" && !ready) return false;
      if (signatureFilter === "MISSING" && ready) return false;

      if (!s) return true;

      return (
        (r.full_name || "").toLowerCase().includes(s) ||
        (r.email || "").toLowerCase().includes(s) ||
        (r.role || "").toLowerCase().includes(s) ||
        deptName.toLowerCase().includes(s)
      );
    });
  }, [rows, q, deptMap, roleFilter, deptFilter, signatureFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const staff = rows.filter((r) => roleKey(r.role) === "staff").length;
    const admin = rows.filter((r) => roleKey(r.role) === "admin").length;
    const auditor = rows.filter((r) => roleKey(r.role) === "auditor").length;
    const finance = rows.filter((r) =>
      ["account", "accounts", "accountofficer"].includes(roleKey(r.role))
    ).length;
    const leadership = rows.filter((r) =>
      ["director", "hod", "dg", "dinadmin"].includes(roleKey(r.role))
    ).length;
    const hrRegistry = rows.filter((r) =>
      ["hr", "registry"].includes(roleKey(r.role))
    ).length;
    const signatureReady = rows.filter((r) => !!r.signature_url).length;
    const signatureMissing = Math.max(total - signatureReady, 0);

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
    };
  }, [rows]);

  async function updateUser(id: string, patch: Partial<ProfileRow>) {
    if (!canAdmin) {
      setMsg("❌ Only Admin/Auditor can update users and roles.");
      return;
    }

    const targetUser = rows.find((r) => r.id === id);

    if (!targetUser) {
      setMsg("❌ User not found.");
      return;
    }

    const nextRole = patch.role || "Staff";
    const roleInfo = roleMap[roleKey(nextRole)];
    const requiresSignature = !!roleInfo?.requires_signature;

    if (requiresSignature && !targetUser.signature_url) {
      setMsg(`❌ ${nextRole} requires signature readiness. Ask the user to upload signature first.`);
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

      const cleanPatch: Partial<ProfileRow> = {
        role: nextRole,
        dept_id: patch.dept_id || null,
      };

      const { error } = await supabase
        .from("profiles")
        .update(cleanPatch)
        .eq("id", id);

      if (error) throw new Error(error.message);

      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...cleanPatch } : r))
      );

      setMsg("✅ User role/routing updated successfully.");
      await load({ silent: true });
      router.refresh();
    } catch (e: any) {
      setMsg("❌ Update failed: " + (e?.message || "Unknown error"));
    } finally {
      setSavingId(null);
    }
  }

  function goDashboard() {
    router.push(`/dashboard?updated=${Date.now()}`);
    router.refresh();
  }

  function goAdmin() {
    router.push(`/admin?updated=${Date.now()}`);
    router.refresh();
  }

  function goRoles() {
    router.push(`/admin/roles?updated=${Date.now()}`);
    router.refresh();
  }

  function resetFilters() {
    setQ("");
    setRoleFilter("ALL");
    setDeptFilter("ALL");
    setSignatureFilter("ALL");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-7xl py-10 text-slate-600">Loading users and roles...</div>
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
              Assign user roles, route users to departments and verify signature readiness for workflow-sensitive roles.
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Roles are now loaded from the ReqGen roles catalogue.
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
              onClick={goRoles}
              disabled={refreshing || !!savingId}
              className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
            >
              Roles & Permissions
            </button>

            <button
              onClick={goAdmin}
              disabled={refreshing || !!savingId}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              Back
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm">
            {msg}
          </div>
        )}

        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-900">
          Admin and Auditor can assign roles from the database-managed role list. Roles marked as signature-required cannot be assigned until the user uploads a signature.
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-8">
          <StatCard title="Total Users" value={String(stats.total)} tone="blue" />
          <StatCard title="Staff" value={String(stats.staff)} tone="slate" />
          <StatCard title="Admin" value={String(stats.admin)} tone="red" />
          <StatCard title="Auditor" value={String(stats.auditor)} tone="purple" />
          <StatCard title="Finance" value={String(stats.finance)} tone="emerald" />
          <StatCard title="Leadership" value={String(stats.leadership)} tone="blue" />
          <StatCard title="HR/Registry" value={String(stats.hrRegistry)} tone="amber" />
          <StatCard title="No Signature" value={String(stats.signatureMissing)} tone="red" />
        </div>

        <div className="mt-6 rounded-3xl border bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="xl:col-span-2">
              <label className="text-sm font-semibold text-slate-800">Search</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
                placeholder="Search name, email, role, department..."
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Role</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Roles</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.role_name}>
                    {r.role_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Department</label>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Departments</option>
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
                onChange={(e) => setSignatureFilter(e.target.value as "ALL" | "READY" | "MISSING")}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All</option>
                <option value="READY">Signature Ready</option>
                <option value="MISSING">No Signature</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={resetFilters}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Reset Filters
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:hidden">
          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            filtered.map((u) => (
              <UserCard
                key={u.id}
                u={u}
                roles={roles}
                depts={depts}
                deptMap={deptMap}
                roleMap={roleMap}
                saving={savingId === u.id}
                disabled={!!savingId || refreshing}
                onSave={updateUser}
              />
            ))
          )}
        </div>

        <div className="mt-6 hidden overflow-hidden rounded-3xl border bg-white shadow-sm xl:block">
          <div className="border-b bg-slate-50 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-900">User Role Register</h2>
            <p className="mt-1 text-sm text-slate-600">
              Assign primary role and department routing for each staff member.
            </p>
          </div>

          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1180px] w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Department Routing</th>
                    <th className="px-4 py-3 text-left">Signature</th>
                    <th className="px-4 py-3 text-left">Joined</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((u) => (
                    <UserTableRow
                      key={u.id}
                      u={u}
                      roles={roles}
                      depts={depts}
                      deptMap={deptMap}
                      roleMap={roleMap}
                      saving={savingId === u.id}
                      disabled={!!savingId || refreshing}
                      onSave={updateUser}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-3xl border border-amber-100 bg-amber-50 p-5 text-sm text-amber-900">
          <div className="font-bold">Role & Routing Note</div>
          <p className="mt-1">
            Use department routing mainly for HOD, Director and DIN Admin workflow ownership. Admin,
            Auditor, DG, HR, Registry and AccountOfficer are workflow-sensitive roles and should be assigned
            only to verified staff with clear operational responsibility.
          </p>
        </div>
      </div>
    </main>
  );
}

function UserTableRow({
  u,
  roles,
  depts,
  deptMap,
  roleMap,
  saving,
  disabled,
  onSave,
}: {
  u: ProfileRow;
  roles: ReqgenRole[];
  depts: Dept[];
  deptMap: Record<string, string>;
  roleMap: Record<string, ReqgenRole>;
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
  const ready = !!u.signature_url;
  const currentRoleInfo = roleMap[roleKey(role)];
  const signatureRequired = !!currentRoleInfo?.requires_signature;

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
          className="w-full min-w-[170px] rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
        >
          {roles.map((r) => (
            <option key={r.id} value={r.role_name}>
              {r.role_name}
              {r.requires_signature ? " • Signature" : ""}
            </option>
          ))}
        </select>

        <span
          className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${roleBadgeClass(
            role
          )}`}
        >
          {role}
        </span>
      </td>

      <td className="px-4 py-4">
        <select
          value={deptId}
          onChange={(e) => setDeptId(e.target.value)}
          disabled={disabled}
          className="w-full min-w-[220px] rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
        >
          <option value="">— None —</option>
          {depts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <div className="mt-1 text-[11px] text-slate-500">
          Use for department-based routing.
        </div>
      </td>

      <td className="px-4 py-4">
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${signatureBadgeClass(
            ready
          )}`}
        >
          {ready ? "Signature Ready" : "No Signature"}
        </span>

        {signatureRequired && !ready && (
          <div className="mt-1 text-[11px] font-semibold text-red-600">
            Required for {role}
          </div>
        )}
      </td>

      <td className="px-4 py-4 text-xs text-slate-500">{shortDate(u.created_at)}</td>

      <td className="px-4 py-4 text-right">
        <button
          disabled={!changed || saving || disabled}
          onClick={() => onSave(u.id, { role, dept_id: deptId || null })}
          className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </td>
    </tr>
  );
}

function UserCard({
  u,
  roles,
  depts,
  deptMap,
  roleMap,
  saving,
  disabled,
  onSave,
}: {
  u: ProfileRow;
  roles: ReqgenRole[];
  depts: Dept[];
  deptMap: Record<string, string>;
  roleMap: Record<string, ReqgenRole>;
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
  const ready = !!u.signature_url;
  const currentRoleInfo = roleMap[roleKey(role)];
  const signatureRequired = !!currentRoleInfo?.requires_signature;

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-extrabold text-slate-900">{u.full_name || "—"}</div>
          <div className="mt-1 text-sm text-slate-600">{u.email || "—"}</div>
          <div className="mt-1 text-xs text-slate-500">Joined {shortDate(u.created_at)}</div>
        </div>

        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${roleBadgeClass(role)}`}>
          {role}
        </span>
      </div>

      <div className="mt-3">
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${signatureBadgeClass(
            ready
          )}`}
        >
          {ready ? "Signature Ready" : "No Signature"}
        </span>

        {signatureRequired && !ready && (
          <div className="mt-2 text-xs font-semibold text-red-600">
            This selected role requires signature readiness.
          </div>
        )}
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
            {roles.map((r) => (
              <option key={r.id} value={r.role_name}>
                {r.role_name}
                {r.requires_signature ? " • Signature" : ""}
              </option>
            ))}
          </select>
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

function EmptyState() {
  return (
    <div className="rounded-2xl border-0 bg-white p-6 text-sm text-slate-600 xl:rounded-none">
      No users found.
    </div>
  );
}