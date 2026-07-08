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

type ProfileRole = {
  id: string;
  profile_id: string;
  role_key: string;
  role_name: string;
  is_primary: boolean;
  is_active: boolean;
  assigned_at: string | null;
};

type DeptRow = {
  id: string;
  name: string;
  hod_user_id: string | null;
  director_user_id: string | null;
  po_id: string | null;
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
  "REGISTRAR_USER_ID",
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

function hasAdminAccess(profileRole: string | null | undefined, assignedRoles: ProfileRole[]) {
  const fallback = roleKey(profileRole);

  if (fallback === "admin" || fallback === "auditor") return true;

  return assignedRoles.some(
    (r) => r.is_active && ["admin", "auditor"].includes(roleKey(r.role_key))
  );
}

function officerLabel(key: string) {
  if (key === "REGISTRAR_USER_ID") return "Registrar";
  if (key === "REGISTRY_USER_ID") return "Registry Officer";
  if (key === "DG_USER_ID") return "Director General";
  if (key === "HR_USER_ID") return "HR Boss";
  if (key === "DIN_ADMIN_USER_ID") return "DIN Admin Officer";
  return key;
}

function officerPurpose(key: string) {
  if (key === "REGISTRAR_USER_ID") {
    return "Registrar acts as HOD of all DIN Departments for Official request routing.";
  }

  if (key === "REGISTRY_USER_ID") {
    return "Registry is for DG reminder/monitoring support only. Registry is not an approval-stage owner.";
  }

  if (key === "DG_USER_ID") {
    return "Final executive approval officer for request workflows.";
  }

  if (key === "HR_USER_ID") {
    return "Human Resources Boss for Personal request review and HR Filing ownership.";
  }

  if (key === "DIN_ADMIN_USER_ID") {
    return "Reviewer for DIN Official requests before Registrar/DG stage.";
  }

  return "Global workflow officer.";
}

function roleBadgeClass(role: string | null | undefined) {
  const rk = roleKey(role);

  if (rk === "admin") return "border-red-200 bg-red-50 text-red-700";
  if (rk === "auditor") return "border-purple-200 bg-purple-50 text-purple-700";

  if (["account", "accounts", "accountofficer", "pvsigner", "pvcountersigner"].includes(rk)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    [
      "director",
      "dod",
      "hod",
      "dg",
      "registrar",
      "dinadmin",
      "dinadmin1",
      "dinadmin2",
      "dinadmin3",
      "po",
      "gensec",
    ].includes(rk)
  ) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (["hr", "hrofficer1", "hrofficer2", "hrofficer3", "registry"].includes(rk)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function signatureBadgeClass(ready: boolean) {
  return ready
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-red-200 bg-red-50 text-red-700";
}

function userDisplayName(user: UserRow | undefined) {
  if (!user) return "Unknown user";
  return user.full_name || user.email || user.id;
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
  const [meRoles, setMeRoles] = useState<ProfileRole[]>([]);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [profileRoles, setProfileRoles] = useState<ProfileRole[]>([]);
  const [depts, setDepts] = useState<DeptRow[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [roles, setRoles] = useState<ReqgenRole[]>([]);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRoleKey, setSelectedRoleKey] = useState("staff");
  const [makePrimaryRole, setMakePrimaryRole] = useState(false);

  const canAdmin = useMemo(() => {
    return hasAdminAccess(meRole, meRoles);
  }, [meRole, meRoles]);

  const usersById = useMemo(() => {
    const m = new Map<string, UserRow>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  const rolesByProfile = useMemo(() => {
    const m: Record<string, ProfileRole[]> = {};

    profileRoles.forEach((r) => {
      if (!m[r.profile_id]) m[r.profile_id] = [];
      m[r.profile_id].push(r);
    });

    return m;
  }, [profileRoles]);

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
    const routedDepartments = depts.filter(
      (d) => d.hod_user_id || d.director_user_id || d.po_id
    ).length;
    const totalRoles = roles.length;
    const activeRoles = roles.filter((r) => r.is_active).length;
    const dinDepartments = depts.filter((d) => d.name.toLowerCase().includes("din")).length;
    const asapDepartments = depts.filter((d) => {
      const n = d.name.toLowerCase();
      return n.includes("asap") || n.includes("alli");
    }).length;

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
      asapDepartments,
      registrarSet: !!settings.REGISTRAR_USER_ID,
      dgSet: !!settings.DG_USER_ID,
      hrSet: !!settings.HR_USER_ID,
      dinAdminSet: !!settings.DIN_ADMIN_USER_ID,
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

      const [meRes, meRolesRes] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", user.id).single(),

        supabase
          .from("profile_roles")
          .select("id,profile_id,role_key,role_name,is_primary,is_active,assigned_at")
          .eq("profile_id", user.id)
          .eq("is_active", true),
      ]);

      if (meRes.error) {
        setMsg("Failed to verify admin/auditor access: " + meRes.error.message);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const role = (meRes.data?.role || "Staff") as string;
      const activeMeRoles = (meRolesRes.data || []) as ProfileRole[];

      setMeRole(role);
      setMeRoles(activeMeRoles);

      if (!hasAdminAccess(role, activeMeRoles)) {
        router.push(`/dashboard?updated=${Date.now()}`);
        router.refresh();
        return;
      }

      const [usersRes, userRolesRes, deptsRes, settingsRes, rolesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,email,full_name,role,signature_url")
          .order("full_name", { ascending: true }),

        supabase
          .from("profile_roles")
          .select("id,profile_id,role_key,role_name,is_primary,is_active,assigned_at")
          .eq("is_active", true)
          .order("assigned_at", { ascending: true }),

        supabase
          .from("departments")
          .select("id,name,hod_user_id,director_user_id,po_id,is_active")
          .order("name", { ascending: true }),

        supabase.from("app_settings").select("key,value"),

        supabase
          .from("reqgen_roles")
          .select(
            "id,role_key,role_name,description,is_system,is_active,requires_signature,sort_order"
          )
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

      if (userRolesRes.error) {
        setMsg("Failed to load assigned user roles: " + userRolesRes.error.message);
        setProfileRoles([]);
      } else {
        setProfileRoles((userRolesRes.data || []) as ProfileRole[]);
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

  async function saveQuickRole() {
    setMsg(null);

    if (!selectedUserId) {
      setMsg("❌ Please select a user.");
      return;
    }

    if (!selectedRoleKey) {
      setMsg("❌ Please select a role.");
      return;
    }

    const user = usersById.get(selectedUserId);

    if (!user) {
      setMsg("❌ Selected user not found.");
      return;
    }

    const roleInfo = roleMap[roleKey(selectedRoleKey)];
    const requiresSignature = !!roleInfo?.requires_signature;

    if (!roleInfo) {
      setMsg("❌ Selected role was not found.");
      return;
    }

    if (requiresSignature && !user.signature_url) {
      setMsg(
        `❌ ${roleInfo.role_name} requires a signature. ${userDisplayName(
          user
        )} must upload signature first.`
      );
      return;
    }

    setSaving(true);
    setSavingTarget("role");

    try {
      const { error } = await supabase.rpc("reqgen_assign_profile_role", {
        p_profile_id: selectedUserId,
        p_role_key: roleInfo.role_key,
        p_is_primary: makePrimaryRole,
      });

      if (error) throw new Error(error.message);

      setMsg(
        makePrimaryRole
          ? `✅ ${roleInfo.role_name} assigned and set as primary role.`
          : `✅ ${roleInfo.role_name} assigned successfully.`
      );

      setMakePrimaryRole(false);
      await loadAll({ silent: true });
      router.refresh();
    } catch (e: any) {
      setMsg("❌ Role assignment failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
      setSavingTarget(null);
    }
  }

  async function saveDept(
    deptId: string,
    hodId: string | null,
    directorId: string | null,
    poId: string | null
  ) {
    setMsg(null);

    const checks: Array<{ label: string; id: string | null }> = [
      { label: "DOD", id: directorId },
      { label: "HOD", id: hodId },
      { label: "PO", id: poId },
    ];

    for (const check of checks) {
      if (!check.id) continue;

      const officer = usersById.get(check.id);

      if (officer && !officer.signature_url) {
        setMsg(`❌ ${check.label} must have a signature before assignment.`);
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
          po_id: poId || null,
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

      setMsg(`✅ ${officerLabel(key)} saved.`);
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
    return userDisplayName(u);
  }

  function officerRoleSummary(id: string | null | undefined) {
    if (!id) return "—";

    const assigned = rolesByProfile[id] || [];

    if (assigned.length === 0) {
      const u = usersById.get(id);
      return u?.role || "Staff";
    }

    return assigned
      .slice()
      .sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        return a.role_name.localeCompare(b.role_name);
      })
      .map((r) => r.role_name)
      .join(", ");
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
              Admin Routing Panel
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Logged in as <b className="text-slate-900">{meEmail || "—"}</b> • Primary role{" "}
              <b className="text-slate-900">{meRole || "Staff"}</b>
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Manage global officers, department DOD/HOD/PO routing, multiple roles and signature readiness.
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
              Users & Multiple Roles
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
          Final routing uses DOD, HOD, PO, Registrar, HR Boss, DG, DIN Admin and AccountOfficer.
          Registry is not an approval-stage officer; Registry is for monitoring and DG reminder support.
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Total Users" value={String(stats.totalUsers)} tone="blue" />
          <StatCard title="Signature Ready" value={String(stats.signatureReadyCount)} tone="emerald" />
          <StatCard title="Needs Signature" value={String(stats.needsSignature)} tone="amber" />
          <StatCard title="Departments" value={String(stats.departments)} tone="slate" />
          <StatCard title="Active Roles" value={String(stats.activeRoles)} tone="purple" />
          <StatCard title="DIN Depts" value={String(stats.dinDepartments)} tone="blue" />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <MiniCard title="Active Departments" value={String(stats.activeDepartments)} />
          <MiniCard title="Routed Departments" value={String(stats.routedDepartments)} />
          <MiniCard title="ASAP/ALLI Depts" value={String(stats.asapDepartments)} />
          <MiniCard title="Registrar" value={stats.registrarSet ? "Assigned" : "Not Set"} />
          <MiniCard title="DG / HR" value={stats.dgSet && stats.hrSet ? "Assigned" : "Incomplete"} />
          <MiniCard title="DIN Admin" value={stats.dinAdminSet ? "Assigned" : "Not Set"} />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border bg-white p-6 shadow-sm xl:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Quick Multiple-Role Assignment</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Use this for quick additions. Use the advanced Users page for full role management.
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
                  {users.map((u) => {
                    const assigned = rolesByProfile[u.id] || [];
                    const roleText =
                      assigned.length > 0
                        ? assigned.map((r) => r.role_name).join(", ")
                        : u.role || "Staff";

                    return (
                      <option key={u.id} value={u.id}>
                        {(u.full_name || u.email || u.id) +
                          ` (${roleText})` +
                          (u.signature_url ? " • Signature Ready" : " • No Signature")}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800">Role to Add</label>
                <select
                  value={selectedRoleKey}
                  onChange={(e) => setSelectedRoleKey(e.target.value)}
                  disabled={saving}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 disabled:bg-slate-50"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.role_key}>
                      {r.role_name}
                      {r.requires_signature ? " • Signature" : ""}
                    </option>
                  ))}
                </select>

                <span
                  className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${roleBadgeClass(
                    selectedRoleKey
                  )}`}
                >
                  {roleMap[roleKey(selectedRoleKey)]?.role_name || selectedRoleKey}
                </span>
              </div>
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={makePrimaryRole}
                onChange={(e) => setMakePrimaryRole(e.target.checked)}
                disabled={saving}
              />
              Set this role as primary fallback role
            </label>

            <button
              onClick={saveQuickRole}
              disabled={saving}
              className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {savingTarget === "role" ? "Saving Role..." : "Assign Role"}
            </button>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Role Catalogue</h2>
            <p className="mt-1 text-sm text-slate-600">
              These active roles are available for assignment.
            </p>

            <div className="mt-4 space-y-2">
              {roles.slice(0, 9).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                >
                  <span
                    className={`rounded-full border px-2 py-1 text-[11px] font-bold ${roleBadgeClass(
                      r.role_key
                    )}`}
                  >
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
            These officers are used by the final routing functions. Assign only signature-ready users.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {GLOBAL_KEYS.map((k) => (
              <div key={k} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-slate-900">{officerLabel(k)}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Current: {officerName(settings[k])}
                    </div>
                  </div>

                  <span
                    className={`rounded-full border px-2 py-1 text-[11px] font-bold ${roleBadgeClass(
                      officerRoleSummary(settings[k])
                    )}`}
                  >
                    Assigned
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
                        {userDisplayName(u)} ({officerRoleSummary(u.id)})
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
            DOD is stored as department Director. PO is used mainly for ASAP-ALLI Official route.
            HOD is used for General Admin and ASAP-ALLI route stages.
          </p>

          <div className="mt-4 grid gap-4">
            {depts.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 p-5 text-sm text-slate-600">
                No departments found.
              </div>
            ) : (
              depts.map((d) => {
                const lowerName = d.name.toLowerCase();
                const isDin = lowerName.includes("din");
                const isAsap = lowerName.includes("asap") || lowerName.includes("alli");
                const isWelfare = lowerName.includes("welfare");
                const isLiaison = lowerName.includes("liaison");

                return (
                  <div key={d.id} className="rounded-2xl border border-slate-200 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-bold text-slate-900">{d.name}</div>

                          {isDin && (
                            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                              DIN
                            </span>
                          )}

                          {isAsap && (
                            <span className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">
                              ASAP/ALLI
                            </span>
                          )}

                          {isWelfare && (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                              Welfare
                            </span>
                          )}

                          {isLiaison && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                              Liaison
                            </span>
                          )}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          DOD: {officerName(d.director_user_id)} • HOD:{" "}
                          {officerName(d.hod_user_id)} • PO: {officerName(d.po_id)}
                        </div>

                        {isDin && (
                          <div className="mt-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
                            DIN Official flow: DOD → DIN Admin → Registrar → DG → AccountOfficer.
                            DIN Personal flow: DOD → HR → DG → AccountOfficer/HR Filing.
                          </div>
                        )}

                        {isAsap && (
                          <div className="mt-2 rounded-xl bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-800">
                            ASAP-ALLI Official flow: PO → DOD → HOD → DG → AccountOfficer.
                            ASAP-ALLI Personal flow: DOD → HOD → HR → DG → AccountOfficer/HR Filing.
                          </div>
                        )}

                        {(isWelfare || isLiaison) && (
                          <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                            Official flow: DOD → DG → AccountOfficer. Personal flow: DOD → HR → DG
                            → AccountOfficer/HR Filing.
                          </div>
                        )}
                      </div>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${d.is_active === false
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                      >
                        {d.is_active === false ? "Inactive" : "Active"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <OfficerSelect
                        label="DOD / Director of Department"
                        value={d.director_user_id || ""}
                        users={signatureReadyUsers}
                        usersById={usersById}
                        rolesByProfile={rolesByProfile}
                        disabled={saving}
                        onChange={(value) =>
                          setDepts((prev) =>
                            prev.map((x) =>
                              x.id === d.id ? { ...x, director_user_id: value || null } : x
                            )
                          )
                        }
                      />

                      <OfficerSelect
                        label="HOD"
                        value={d.hod_user_id || ""}
                        users={signatureReadyUsers}
                        usersById={usersById}
                        rolesByProfile={rolesByProfile}
                        disabled={saving}
                        onChange={(value) =>
                          setDepts((prev) =>
                            prev.map((x) =>
                              x.id === d.id ? { ...x, hod_user_id: value || null } : x
                            )
                          )
                        }
                      />

                      <OfficerSelect
                        label="PO / Programme Officer"
                        value={d.po_id || ""}
                        users={signatureReadyUsers}
                        usersById={usersById}
                        rolesByProfile={rolesByProfile}
                        disabled={saving}
                        onChange={(value) =>
                          setDepts((prev) =>
                            prev.map((x) => (x.id === d.id ? { ...x, po_id: value || null } : x))
                          )
                        }
                      />
                    </div>

                    <button
                      onClick={() => saveDept(d.id, d.hod_user_id, d.director_user_id, d.po_id)}
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
            Users without signature should not hold workflow-sensitive roles because their signatures
            must appear in approvals and print templates.
          </p>

          <div className="mt-4 hidden overflow-x-auto xl:block">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-left text-sm text-slate-600">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Primary Role</th>
                  <th className="py-2 pr-4">Active Roles</th>
                  <th className="py-2 pr-4">Signature</th>
                  <th className="py-2 pr-4">Ready</th>
                </tr>
              </thead>

              <tbody>
                {users.map((u) => {
                  const ready = !!u.signature_url;
                  const assigned = rolesByProfile[u.id] || [];

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
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {assigned.length === 0 ? (
                            <span className="text-xs text-slate-500">No active assigned role</span>
                          ) : (
                            assigned.map((r) => (
                              <span
                                key={r.id}
                                className={`rounded-full border px-2 py-1 text-[11px] font-bold ${roleBadgeClass(
                                  r.role_key
                                )}`}
                              >
                                {r.role_name}
                                {r.is_primary ? " • Primary" : ""}
                              </span>
                            ))
                          )}
                        </div>
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

          <div className="mt-4 grid gap-3 xl:hidden">
            {users.map((u) => {
              const ready = !!u.signature_url;
              const assigned = rolesByProfile[u.id] || [];

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

                  <div className="mt-3 flex flex-wrap gap-1">
                    {assigned.map((r) => (
                      <span
                        key={r.id}
                        className={`rounded-full border px-2 py-1 text-[11px] font-bold ${roleBadgeClass(
                          r.role_key
                        )}`}
                      >
                        {r.role_name}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-amber-100 bg-amber-50 p-5 text-sm text-amber-900">
          <div className="font-bold">Admin Control Note</div>
          <p className="mt-1">
            Assign workflow-sensitive roles only to users with uploaded signatures and verified
            operational responsibility. Registrar is used for DIN Official requests. HR Boss is used
            for Personal requests. Registry is for monitoring and DG reminders, not approval.
          </p>
        </div>
      </div>
    </main>
  );
}

function OfficerSelect({
  label,
  value,
  users,
  usersById,
  rolesByProfile,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  users: UserRow[];
  usersById: Map<string, UserRow>;
  rolesByProfile: Record<string, ProfileRole[]>;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  function roleSummary(id: string) {
    const assigned = rolesByProfile[id] || [];

    if (assigned.length > 0) {
      return assigned.map((r) => r.role_name).join(", ");
    }

    return usersById.get(id)?.role || "Staff";
  }

  return (
    <div>
      <label className="text-sm font-semibold text-slate-800">{label}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 disabled:bg-slate-50"
      >
        <option value="">-- None --</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {userDisplayName(u)} ({roleSummary(u.id)})
          </option>
        ))}
      </select>
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

function MiniCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-2 text-lg font-extrabold text-slate-900">{value}</div>
    </div>
  );
}