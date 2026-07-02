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

const GLOBAL_KEYS = [
  "REGISTRY_USER_ID",
  "DG_USER_ID",
  "HR_USER_ID",
  "DIN_ADMIN_USER_ID",
] as const;

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function officerLabel(key: string) {
  if (key === "REGISTRY_USER_ID") return "Registry Officer";
  if (key === "DG_USER_ID") return "Director General";
  if (key === "HR_USER_ID") return "HR Officer";
  if (key === "DIN_ADMIN_USER_ID") return "DIN Admin Officer";
  return key;
}

function officerPurpose(key: string) {
  if (key === "REGISTRY_USER_ID") {
    return "Registry reminder/monitoring support. Registry should not view confidential request details.";
  }

  if (key === "DG_USER_ID") {
    return "Final executive approval officer for request workflows.";
  }

  if (key === "HR_USER_ID") {
    return "Human Resources review and HR filing officer.";
  }

  if (key === "DIN_ADMIN_USER_ID") {
    return "Required reviewer for all DIN department requests before HOD stage.";
  }

  return "Global workflow officer.";
}

function roleBadgeClass(role: string | null | undefined) {
  const rk = roleKey(role);

  if (rk === "admin") return "border-red-200 bg-red-50 text-red-700";
  if (rk === "auditor") return "border-purple-200 bg-purple-50 text-purple-700";
  if (["account", "accounts", "accountofficer"].includes(rk)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (["director", "hod", "dg", "dinadmin"].includes(rk)) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (["hr", "registry"].includes(rk)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function signatureBadgeClass(ready: boolean) {
  return ready
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-red-200 bg-red-50 text-red-700";
}

export default function AdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingTarget, setSavingTarget] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [meEmail, setMeEmail] = useState("");
  const [meRole, setMeRole] = useState("");

  const [users, setUsers] = useState<UserRow[]>([]);
  const [depts, setDepts] = useState<DeptRow[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [roles, setRoles] = useState<ReqgenRole[]>([]);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("Staff");

  const usersById = useMemo(() => {
    const m = new Map<string, UserRow>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  const roleMap = useMemo(() => {
    const m: Record<string, ReqgenRole> = {};

    roles.forEach((r) => {
      m[roleKey(r.role_name)] = r;
      m[roleKey(r.role_key)] = r;
    });

    return m;
  }, [roles]);

  const signatureReadyUsers = useMemo(() => {
    return users.filter((u) => !!u.signature_url);
  }, [users]);

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const signatureReadyCount = users.filter((u) => !!u.signature_url).length;
    const needsSignature = Math.max(totalUsers - signatureReadyCount, 0);
    const departments = depts.length;
    const activeDepartments = depts.filter((d) => d.is_active !== false).length;
    const routedDepartments = depts.filter((d) => d.hod_user_id || d.director_user_id).length;
    const totalRoles = roles.length;
    const activeRoles = roles.filter((r) => r.is_active).length;
    const dinDepartments = depts.filter((d) => d.name.toLowerCase().includes("din")).length;
    const dinAdminSet = !!settings.DIN_ADMIN_USER_ID;

    return {
      totalUsers,
      signatureReadyCount,
      needsSignature,
      departments,
      activeDepartments,
      routedDepartments,
      totalRoles,
      activeRoles,
      dinDepartments,
      dinAdminSet,
    };
  }, [users, depts, roles, settings]);

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

      const [usersRes, deptsRes, settingsRes, rolesRes] = await Promise.all([
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
          .from("reqgen_roles")
          .select("id,role_key,role_name,description,is_system,is_active,requires_signature,sort_order")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("role_name", { ascending: true }),
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

      if (rolesRes.error) {
        setMsg("Failed to load role catalogue: " + rolesRes.error.message);
        setRoles([]);
      } else {
        setRoles((rolesRes.data || []) as ReqgenRole[]);
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

    const roleInfo = roleMap[roleKey(selectedRole)];
    const requiresSignature = !!roleInfo?.requires_signature;

    if (requiresSignature && !user.signature_url) {
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

  function goDashboard() {
    router.push(`/dashboard?updated=${Date.now()}`);
    router.refresh();
  }

  function goUsersRoles() {
    router.push(`/admin/users?updated=${Date.now()}`);
    router.refresh();
  }

  function goRoles() {
    router.push(`/admin/roles?updated=${Date.now()}`);
    router.refresh();
  }

  function goSecurity() {
    router.push(`/admin/security?updated=${Date.now()}`);
    router.refresh();
  }

  function officerName(id: string | null | undefined) {
    if (!id) return "Not assigned";
    const u = usersById.get(id);
    return u?.full_name || u?.email || "Unknown user";
  }

  function officerRole(id: string | null | undefined) {
    if (!id) return "—";
    const u = usersById.get(id);
    return u?.role || "Staff";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-7xl py-10 text-slate-600">Loading Admin Panel...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-7xl py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Admin Panel
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Logged in as <b className="text-slate-900">{meEmail || "—"}</b> • Role{" "}
              <b className="text-slate-900">{meRole}</b>
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Manage roles, routing officers, department approval paths and signature readiness.
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
              onClick={goUsersRoles}
              disabled={refreshing || saving}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              Users & Roles
            </button>

            <button
              onClick={goRoles}
              disabled={refreshing || saving}
              className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
            >
              Roles & Permissions
            </button>

            <button
              onClick={goSecurity}
              disabled={refreshing || saving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              Security
            </button>

            <button
              onClick={goDashboard}
              disabled={refreshing || saving}
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
          DIN routing is now controlled through the DIN Admin global officer. All DIN department requests must pass through DIN Admin before HOD.
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Total Users" value={String(stats.totalUsers)} tone="blue" />
          <StatCard title="Signature Ready" value={String(stats.signatureReadyCount)} tone="emerald" />
          <StatCard title="Needs Signature" value={String(stats.needsSignature)} tone="amber" />
          <StatCard title="Departments" value={String(stats.departments)} tone="slate" />
          <StatCard title="Active Roles" value={String(stats.activeRoles)} tone="purple" />
          <StatCard title="DIN Depts" value={String(stats.dinDepartments)} tone="blue" />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MiniCard title="Active Departments" value={String(stats.activeDepartments)} />
          <MiniCard title="Routed Departments" value={String(stats.routedDepartments)} />
          <MiniCard title="Role Catalogue" value={`${stats.activeRoles}/${stats.totalRoles}`} />
          <MiniCard title="DIN Admin Status" value={stats.dinAdminSet ? "Assigned" : "Not Set"} />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border bg-white p-6 shadow-sm xl:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Quick Role Assignment</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Roles are loaded from the ReqGen role catalogue. Signature-required roles can only be assigned to signature-ready users.
                </p>
              </div>

              <button
                onClick={goUsersRoles}
                disabled={saving || refreshing}
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
                  {roles.map((r) => (
                    <option key={r.id} value={r.role_name}>
                      {r.role_name}
                      {r.requires_signature ? " • Signature" : ""}
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

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Role Catalogue</h2>
            <p className="mt-1 text-sm text-slate-600">
              Add, edit, activate or deactivate roles from the dedicated role management page.
            </p>

            <div className="mt-4 space-y-2">
              {roles.slice(0, 8).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${roleBadgeClass(r.role_name)}`}>
                    {r.role_name}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {r.requires_signature ? "Signature" : "No signature"}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={goRoles}
              disabled={saving || refreshing}
              className="mt-4 w-full rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
            >
              Open Roles & Permissions
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Global Routing Officers</h2>
          <p className="mt-1 text-sm text-slate-600">
            Registry, DG, HR and DIN Admin must always be assigned to signature-ready users.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {GLOBAL_KEYS.map((k) => (
              <div key={k} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-slate-900">{officerLabel(k)}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Current: {officerName(settings[k])}
                    </div>
                  </div>

                  <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${roleBadgeClass(officerRole(settings[k]))}`}>
                    {officerRole(settings[k])}
                  </span>
                </div>

                <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {officerPurpose(k)}
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
                        {(u.full_name || u.email || u.id) + (u.role ? ` (${u.role})` : "")}
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

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Department Routing</h2>
          <p className="mt-1 text-sm text-slate-600">
            If Director is assigned, request starts with Director. If no Director is assigned, request starts at the next configured officer. DIN departments must pass through DIN Admin before HOD.
          </p>

          <div className="mt-4 grid gap-4">
            {depts.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 p-5 text-sm text-slate-600">
                No departments found.
              </div>
            ) : (
              depts.map((d) => {
                const isDin = d.name.toLowerCase().includes("din");

                return (
                  <div key={d.id} className="rounded-2xl border border-slate-200 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-bold text-slate-900">{d.name}</div>
                          {isDin && (
                            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                              DIN Routing
                            </span>
                          )}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          Director: {officerName(d.director_user_id)} • HOD:{" "}
                          {officerName(d.hod_user_id)}
                        </div>

                        {isDin && (
                          <div className="mt-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
                            DIN flow: Director → DIN Admin → HOD. If no Director, request starts with DIN Admin.
                          </div>
                        )}
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
                                x.id === d.id
                                  ? { ...x, director_user_id: e.target.value || null }
                                  : x
                              )
                            )
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 disabled:bg-slate-50"
                        >
                          <option value="">-- None --</option>
                          {signatureReadyUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {(u.full_name || u.email || u.id) + (u.role ? ` (${u.role})` : "")}
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
                          {signatureReadyUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {(u.full_name || u.email || u.id) + (u.role ? ` (${u.role})` : "")}
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
                );
              })
            )}
          </div>
        </div>

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

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${signatureBadgeClass(
                        ready
                      )}`}
                    >
                      {ready ? "Signature Ready" : "No Signature"}
                    </span>
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
                        <span
                          className={`rounded-lg border px-2 py-1 text-xs font-semibold ${signatureBadgeClass(
                            ready
                          )}`}
                        >
                          {ready ? "Ready" : "Not Ready"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-amber-100 bg-amber-50 p-5 text-sm text-amber-900">
          <div className="font-bold">Admin Control Note</div>
          <p className="mt-1">
            Signature readiness protects workflow integrity. Assign Registry, HR, DG, DINAdmin, HOD, Director,
            AccountOfficer, Admin and Auditor roles only to users with uploaded signatures and verified operational responsibility.
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

function MiniCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-2 text-lg font-extrabold text-slate-900">{value}</div>
    </div>
  );
}