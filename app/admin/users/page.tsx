"use client";

import AdminNavigation from "@/app/components/admin/AdminNavigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { roleDisplayName } from "@/lib/roles";

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

type ProfileRole = {
  id: string;
  profile_id: string;
  role_key: string;
  role_name: string;
  is_primary: boolean;
  is_active: boolean;
  assigned_at: string | null;
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

  if (["account", "accounts", "accountofficer", "pvsigner", "pvcountersigner"].includes(rk)) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
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
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  if (["hr", "hrofficer1", "hrofficer2", "hrofficer3", "registry"].includes(rk)) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  return "bg-slate-50 text-slate-700 border-slate-200";
}

function signatureBadgeClass(ready: boolean) {
  return ready
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-red-200 bg-red-50 text-red-700";
}

function hasAdminAccess(profileRole: string | null | undefined, assignedRoles: ProfileRole[]) {
  const fallback = roleKey(profileRole);

  if (fallback === "admin") return true;

  return assignedRoles.some(
    (r) => r.is_active && roleKey(r.role_key) === "admin"
  );
}

function roleRequiresSignature(role: ReqgenRole | undefined) {
  return !!role?.requires_signature;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export default function AdminUsersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [meRole, setMeRole] = useState<string>("Staff");
  const [meRoles, setMeRoles] = useState<ProfileRole[]>([]);

  const canAdmin = useMemo(() => {
    return hasAdminAccess(meRole, meRoles);
  }, [meRole, meRoles]);

  const canDeleteUsers = useMemo(() => {
    return roleKey(meRole) === "admin" || meRoles.some((r) => r.is_active && roleKey(r.role_key) === "admin");
  }, [meRole, meRoles]);

  const [depts, setDepts] = useState<Dept[]>([]);
  const [roles, setRoles] = useState<ReqgenRole[]>([]);
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [profileRoles, setProfileRoles] = useState<ProfileRole[]>([]);

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [deptFilter, setDeptFilter] = useState<DeptFilter>("ALL");
  const [signatureFilter, setSignatureFilter] = useState<"ALL" | "READY" | "MISSING">("ALL");

  const [savingId, setSavingId] = useState<string | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRoleKey, setNewRoleKey] = useState("staff");
  const [newDeptId, setNewDeptId] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [manageUserId, setManageUserId] = useState<string | null>(null);
  const userPageSize = 10;

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

      const [meRes, meRolesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("role")
          .eq("id", auth.user.id)
          .maybeSingle(),

        supabase
          .from("profile_roles")
          .select("id,profile_id,role_key,role_name,is_primary,is_active,assigned_at")
          .eq("profile_id", auth.user.id)
          .eq("is_active", true),
      ]);

      if (meRes.error) {
        setMsg("Failed to load your profile: " + meRes.error.message);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const currentRole = (meRes.data?.role as string) || "Staff";
      const currentAssignedRoles = (meRolesRes.data || []) as ProfileRole[];

      setMeRole(currentRole);
      setMeRoles(currentAssignedRoles);

      if (!hasAdminAccess(currentRole, currentAssignedRoles)) {
        setMsg("Access denied. Admin privilege is required to manage users and roles.");
        setDepts([]);
        setRoles([]);
        setRows([]);
        setProfileRoles([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const [deptRes, rolesRes, profileRes, profileRolesRes] = await Promise.all([
        supabase
          .from("departments")
          .select("id,name")
          .order("name", { ascending: true }),

        supabase
          .from("reqgen_roles")
          .select(
            "id,role_key,role_name,description,is_system,is_active,requires_signature,sort_order"
          )
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("role_name", { ascending: true }),

        supabase
          .from("profiles")
          .select("id,full_name,email,role,dept_id,signature_url,created_at")
          .order("created_at", { ascending: false }),

        supabase
          .from("profile_roles")
          .select("id,profile_id,role_key,role_name,is_primary,is_active,assigned_at")
          .eq("is_active", true)
          .order("assigned_at", { ascending: true }),
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

      if (profileRolesRes.error) {
        setMsg("Failed to load user role assignments: " + profileRolesRes.error.message);
        setProfileRoles([]);
      } else {
        setProfileRoles((profileRolesRes.data || []) as ProfileRole[]);
      }

      setLoading(false);
      setRefreshing(false);
    },
    [router]
  );

  useEffect(() => {
    queueMicrotask(() => { void load(); });

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

  const rolesByProfile = useMemo(() => {
    const m: Record<string, ProfileRole[]> = {};

    profileRoles.forEach((r) => {
      if (!m[r.profile_id]) m[r.profile_id] = [];
      m[r.profile_id].push(r);
    });

    Object.keys(m).forEach((profileId) => {
      m[profileId] = m[profileId].sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;

        const ra = roleMap[roleKey(a.role_key)]?.sort_order || 999;
        const rb = roleMap[roleKey(b.role_key)]?.sort_order || 999;

        return ra - rb || a.role_name.localeCompare(b.role_name);
      });
    });

    return m;
  }, [profileRoles, roleMap]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    return rows.filter((r) => {
      const userRoles = rolesByProfile[r.id] || [];
      const activeRoleKeys = userRoles.map((ur) => roleKey(ur.role_key));
      const fallbackRole = roleKey(r.role || "staff");
      const deptName = r.dept_id ? deptMap[r.dept_id] || "" : "";
      const ready = !!r.signature_url;

      if (roleFilter !== "ALL") {
        const filterKey = roleKey(roleFilter);

        if (!activeRoleKeys.includes(filterKey) && fallbackRole !== filterKey) {
          return false;
        }
      }

      if (deptFilter !== "ALL" && r.dept_id !== deptFilter) return false;
      if (signatureFilter === "READY" && !ready) return false;
      if (signatureFilter === "MISSING" && ready) return false;

      if (!s) return true;

      const roleText = userRoles.map((ur) => `${ur.role_key} ${ur.role_name}`).join(" ");

      return (
        (r.full_name || "").toLowerCase().includes(s) ||
        (r.email || "").toLowerCase().includes(s) ||
        (r.role || "").toLowerCase().includes(s) ||
        roleText.toLowerCase().includes(s) ||
        deptName.toLowerCase().includes(s)
      );
    });
  }, [rows, q, deptMap, roleFilter, deptFilter, signatureFilter, rolesByProfile]);

  const userPageCount = Math.max(1, Math.ceil(filtered.length / userPageSize));
  const safeUserPage = Math.min(userPage, userPageCount);
  const pagedUsers = filtered.slice((safeUserPage - 1) * userPageSize, safeUserPage * userPageSize);
  const managedUser = manageUserId ? rows.find((row) => row.id === manageUserId) || null : null;

  const stats = useMemo(() => {
    const total = rows.length;

    const usersWithRole = (keys: string[]) => {
      return rows.filter((u) => {
        const assigned = rolesByProfile[u.id] || [];
        const fallback = roleKey(u.role);

        return (
          keys.includes(fallback) ||
          assigned.some((r) => r.is_active && keys.includes(roleKey(r.role_key)))
        );
      }).length;
    };

    const staff = usersWithRole(["staff"]);
    const admin = usersWithRole(["admin"]);
    const auditor = usersWithRole(["auditor"]);
    const finance = usersWithRole([
      "account",
      "accounts",
      "accountofficer",
      "pvsigner",
      "pvcountersigner",
    ]);
    const leadership = usersWithRole([
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
    ]);
    const hrRegistry = usersWithRole(["hr", "hrofficer1", "hrofficer2", "hrofficer3", "registry"]);
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
      roleAssignments: profileRoles.length,
    };
  }, [rows, rolesByProfile, profileRoles.length]);

  async function updateUserDepartment(id: string, deptId: string | null) {
    if (!canAdmin) {
      setMsg("❌ Only Admin can update users.");
      return;
    }

    setSavingId(id);
    setMsg(null);

    try {
      const { error } = await supabase.from("profiles").update({ dept_id: deptId }).eq("id", id);

      if (error) throw new Error(error.message);

      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, dept_id: deptId } : r)));

      setMsg("✅ User department routing updated successfully.");
      await load({ silent: true });
      router.refresh();
    } catch (e: unknown) {
      setMsg("❌ Department update failed: " + errorMessage(e));
    } finally {
      setSavingId(null);
    }
  }

  async function assignRole(profileId: string, roleKeyToAssign: string, makePrimary: boolean) {
    if (!canAdmin) {
      setMsg("❌ Only Admin can assign roles.");
      return;
    }

    const targetUser = rows.find((r) => r.id === profileId);
    const roleInfo = roleMap[roleKey(roleKeyToAssign)];

    if (!targetUser) {
      setMsg("❌ User not found.");
      return;
    }

    if (!roleInfo) {
      setMsg("❌ Selected role was not found in the active role catalogue.");
      return;
    }

    if (roleRequiresSignature(roleInfo) && !targetUser.signature_url) {
      setMsg(
        `❌ ${roleDisplayName(roleInfo.role_name)} requires a signature. Ask ${targetUser.full_name || "the user"
        } to upload signature first.`
      );
      return;
    }

    setSavingId(profileId);
    setMsg(null);

    try {
      const { error } = await supabase.rpc("reqgen_assign_profile_role", {
        p_profile_id: profileId,
        p_role_key: roleInfo.role_key,
        p_is_primary: makePrimary,
      });

      if (error) throw new Error(error.message);

      setMsg(
        makePrimary
          ? `✅ ${roleDisplayName(roleInfo.role_name)} assigned and set as primary role.`
          : `✅ ${roleDisplayName(roleInfo.role_name)} assigned successfully.`
      );

      await load({ silent: true });
      router.refresh();
    } catch (e: unknown) {
      setMsg("❌ Role assignment failed: " + errorMessage(e));
    } finally {
      setSavingId(null);
    }
  }

  async function setPrimaryRole(profileId: string, roleKeyToSet: string) {
    if (!canAdmin) {
      setMsg("❌ Only Admin can set primary roles.");
      return;
    }

    const roleInfo = roleMap[roleKey(roleKeyToSet)];

    setSavingId(profileId);
    setMsg(null);

    try {
      const { error } = await supabase.rpc("reqgen_set_primary_profile_role", {
        p_profile_id: profileId,
        p_role_key: roleKeyToSet,
      });

      if (error) throw new Error(error.message);

      setMsg(`✅ Primary role updated to ${roleDisplayName(roleInfo?.role_name || roleKeyToSet)}.`);

      await load({ silent: true });
      router.refresh();
    } catch (e: unknown) {
      setMsg("❌ Primary role update failed: " + errorMessage(e));
    } finally {
      setSavingId(null);
    }
  }

  async function deleteUser(profile: ProfileRow) {
    if (!canDeleteUsers) {
      setMsg("Admin privilege is required to delete a user.");
      return;
    }

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }
    if (auth.user.id === profile.id) {
      setMsg("Self-deletion is blocked.");
      return;
    }

    const label = profile.full_name || profile.email || profile.id;
    const confirmed = window.confirm(
      `Permanently delete ${label}? ReqGen will refuse the operation if immutable historical evidence exists.`
    );
    if (!confirmed) return;

    setSavingId(profile.id);
    setMsg(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session is unavailable. Please sign in again.");

      const response = await fetch(`/api/admin/users/${encodeURIComponent(profile.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = body?.details && typeof body.details === "object"
          ? ` (${Object.entries(body.details).map(([k, v]) => `${k}: ${v}`).join(", ")})`
          : "";
        throw new Error((body?.error || "User deletion failed.") + detail);
      }

      setMsg(`Deleted ${label}.`);
      await load({ silent: true });
    } catch (error: unknown) {
      setMsg(errorMessage(error));
    } finally {
      setSavingId(null);
    }
  }

  async function createUser() {
    if (!canDeleteUsers) { setMsg("Admin privilege is required to create a user."); return; }
    if (!newFullName.trim() || !newEmail.trim() || newPassword.length < 8) {
      setMsg("Enter the user's full name, a valid email and a temporary password of at least 8 characters.");
      return;
    }
    setCreatingUser(true);
    setMsg(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session is unavailable. Please sign in again.");
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fullName: newFullName, email: newEmail, password: newPassword, roleKey: newRoleKey, departmentId: newDeptId || null }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "User creation failed.");
      setMsg(`✅ ${newFullName.trim()} was created successfully.`);
      setShowCreateUser(false);
      setNewFullName(""); setNewEmail(""); setNewPassword(""); setNewRoleKey("staff"); setNewDeptId("");
      await load({ silent: true });
    } catch (error: unknown) {
      setMsg("❌ " + errorMessage(error));
    } finally {
      setCreatingUser(false);
    }
  }

  async function deactivateRole(profileId: string, roleKeyToDeactivate: string) {
    if (!canAdmin) {
      setMsg("❌ Only Admin can deactivate roles.");
      return;
    }

    const assigned = rolesByProfile[profileId] || [];
    const activeCount = assigned.filter((r) => r.is_active).length;
    const target = assigned.find((r) => roleKey(r.role_key) === roleKey(roleKeyToDeactivate));

    if (!target) {
      setMsg("❌ Role assignment not found.");
      return;
    }

    if (activeCount <= 1) {
      setMsg("❌ A user must keep at least one active role.");
      return;
    }

    const ok = window.confirm(
      `Deactivate ${roleDisplayName(target.role_name)} for this user? This keeps history but removes the role from active assignment.`
    );

    if (!ok) return;

    setSavingId(profileId);
    setMsg(null);

    try {
      const { error } = await supabase.rpc("reqgen_deactivate_profile_role", {
        p_profile_id: profileId,
        p_role_key: roleKeyToDeactivate,
      });

      if (error) throw new Error(error.message);

      setMsg(`✅ ${roleDisplayName(target.role_name)} deactivated successfully.`);

      await load({ silent: true });
      router.refresh();
    } catch (e: unknown) {
      setMsg("❌ Role deactivation failed: " + errorMessage(e));
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
    setUserPage(1);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-transparent px-4">
        <div className="mx-auto max-w-7xl py-10 text-slate-600">Loading users and roles...</div>
      </main>
    );
  }

  if (!canAdmin) {
    return (
      <main className="min-h-screen bg-transparent px-4">
        <div className="mx-auto max-w-6xl py-10">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="text-lg font-bold text-slate-900">Access denied</div>
            <div className="mt-1 text-sm text-slate-600">
              Admin privilege is required to manage users and roles.
            </div>

            {msg && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {msg}
              </div>
            )}

            <button
              onClick={goDashboard}
              className="reqgen-btn reqgen-btn-slate mt-4 rounded-xl px-4 py-2 text-sm font-black text-white"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-transparent px-4">
      <AdminNavigation />
      <div className="mx-auto max-w-7xl py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              User Management
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Manage users, department routing, active roles and signature readiness from one controlled workspace.
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              The primary role keeps older screens compatible, while active multiple roles control
              the final ReqGen workflow.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowCreateUser(true)}
              disabled={refreshing || !!savingId}
              className="reqgen-btn reqgen-btn-blue rounded-xl px-4 py-2 text-sm font-black text-white disabled:opacity-60"
            >
              + Add New User
            </button>
            <button
              onClick={() => load({ silent: true })}
              disabled={refreshing || !!savingId}
              className="reqgen-btn reqgen-btn-cyan rounded-xl px-4 py-2 text-sm font-black text-white disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={goRoles}
              disabled={refreshing || !!savingId}
              className="reqgen-btn reqgen-btn-violet rounded-xl px-4 py-2 text-sm disabled:opacity-60 font-black text-white"
            >
              Roles & Permissions
            </button>

            <button
              onClick={goAdmin}
              disabled={refreshing || !!savingId}
              className="reqgen-btn reqgen-btn-slate rounded-xl border border-slate-200 px-4 py-2 text-sm disabled:opacity-60 font-black text-white"
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
          Admin can assign multiple roles. Any role marked signature-required cannot be
          assigned until the user has uploaded a signature.
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Users" value={String(stats.total)} tone="blue" />
          <StatCard title="Role Assignments" value={String(stats.roleAssignments)} tone="purple" />
          <StatCard title="Departments" value={String(depts.length)} tone="emerald" />
          <StatCard title="Signatures Missing" value={String(stats.signatureMissing)} tone="amber" />
        </div>

        <div className="mt-6 rounded-3xl border bg-white p-5 shadow-sm">
          <div className="rg-auto-grid rg-auto-grid-5">
            <div className="xl:col-span-2">
              <label className="text-sm font-semibold text-slate-800">Search</label>
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setUserPage(1); }}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
                placeholder="Search name, email, role, department..."
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Role</label>
              <select
                value={roleFilter}
                onChange={(e) => { setRoleFilter(e.target.value); setUserPage(1); }}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Roles</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.role_key}>
                    {roleDisplayName(r.role_name)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Department</label>
              <select
                value={deptFilter}
                onChange={(e) => { setDeptFilter(e.target.value); setUserPage(1); }}
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
                onChange={(e) => { setSignatureFilter(e.target.value as "ALL" | "READY" | "MISSING"); setUserPage(1); }}
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
              className="reqgen-btn reqgen-btn-cyan rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-white"
            >
              Reset Filters
            </button>
          </div>
        </div>

        <section className="mt-6 admin-v3-card">
          <div className="admin-v3-table-scroll">
            <table className="admin-v3-table">
              <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Signature</th><th>Actions</th></tr></thead>
              <tbody>
                {pagedUsers.map((u, index) => {
                  const assigned = rolesByProfile[u.id] || [];
                  const primary = assigned.find((role) => role.is_primary) || assigned[0];
                  return (
                    <tr key={u.id}>
                      <td>{(safeUserPage - 1) * userPageSize + index + 1}</td>
                      <td><strong>{u.full_name || "Unnamed user"}</strong></td>
                      <td>{u.email || "—"}</td>
                      <td>{roleDisplayName(primary?.role_name || u.role || "Staff")}</td>
                      <td>{u.dept_id ? deptMap[u.dept_id] || "Unknown department" : "—"}</td>
                      <td><span className={`admin-v3-status ${u.signature_url ? "is-active" : "is-inactive"}`}>{u.signature_url ? "Ready" : "Missing"}</span></td>
                      <td><div className="admin-v3-row-actions"><button type="button" onClick={() => setManageUserId(u.id)}>Manage</button>{canDeleteUsers ? <button type="button" className="is-danger" disabled={!!savingId} onClick={() => void deleteUser(u)}>Delete</button> : null}</div></td>
                    </tr>
                  );
                })}
                {!pagedUsers.length ? <tr><td colSpan={7} className="admin-v3-empty">No users match the selected filters.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="admin-v3-pagination"><span>Showing {filtered.length ? (safeUserPage - 1) * userPageSize + 1 : 0} to {Math.min(safeUserPage * userPageSize, filtered.length)} of {filtered.length} users</span><div><button disabled={safeUserPage <= 1} onClick={() => setUserPage((value) => Math.max(1, value - 1))}>‹</button>{Array.from({ length: userPageCount }, (_, index) => index + 1).slice(Math.max(0, safeUserPage - 3), Math.max(5, safeUserPage + 2)).map((value) => <button key={value} className={value === safeUserPage ? "is-active" : ""} onClick={() => setUserPage(value)}>{value}</button>)}<button disabled={safeUserPage >= userPageCount} onClick={() => setUserPage((value) => Math.min(userPageCount, value + 1))}>›</button></div></div>
        </section>

        {managedUser ? (
          <div className="admin-v4-manage-backdrop" role="presentation" onMouseDown={() => !savingId && setManageUserId(null)}>
            <section className="admin-v4-manage-dialog" role="dialog" aria-modal="true" aria-labelledby="manage-user-title" onMouseDown={(event) => event.stopPropagation()}>
              <div className="admin-v4-manage-head">
                <div><h2 id="manage-user-title">Manage User</h2><p>Update department and active role assignments for {managedUser.full_name || managedUser.email || "this user"}.</p></div>
                <button className="admin-v3-secondary" type="button" onClick={() => setManageUserId(null)}>Close</button>
              </div>
              <UserRolePanel
                u={managedUser}
                roles={roles}
                depts={depts}
                deptMap={deptMap}
                userRoles={rolesByProfile[managedUser.id] || []}
                roleMap={roleMap}
                saving={savingId === managedUser.id}
                disabled={!!savingId || refreshing}
                onUpdateDepartment={updateUserDepartment}
                onAssignRole={assignRole}
                onSetPrimaryRole={setPrimaryRole}
                onDeactivateRole={deactivateRole}
                onDeleteUser={deleteUser}
                canDelete={canDeleteUsers}
              />
            </section>
          </div>
        ) : null}

        {showCreateUser ? (
          <div className="admin-v3-modal-backdrop" role="presentation" onMouseDown={() => !creatingUser && setShowCreateUser(false)}>
            <section className="admin-v3-modal" role="dialog" aria-modal="true" aria-labelledby="create-user-title" onMouseDown={(event) => event.stopPropagation()}>
              <div className="admin-v3-modal-head"><div><h2 id="create-user-title">Add New User</h2><p>Create the Auth identity, profile and primary ReqGen role in one protected transaction.</p></div><button type="button" onClick={() => setShowCreateUser(false)} disabled={creatingUser}>×</button></div>
              <div className="admin-v3-form-grid">
                <label>Full Name<input value={newFullName} onChange={(e) => setNewFullName(e.target.value)} placeholder="Full legal name" /></label>
                <label>Email<input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="name@example.com" /></label>
                <label>Temporary Password<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimum 8 characters" /></label>
                <label>Primary Role<select value={newRoleKey} onChange={(e) => setNewRoleKey(e.target.value)}>{roles.map((role) => <option key={role.id} value={role.role_key}>{roleDisplayName(role.role_name)}</option>)}</select></label>
                <label className="admin-v3-form-wide">Department<select value={newDeptId} onChange={(e) => setNewDeptId(e.target.value)}><option value="">No department</option>{depts.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}</select></label>
              </div>
              <div className="admin-v3-modal-actions"><button type="button" className="admin-v3-secondary" onClick={() => setShowCreateUser(false)} disabled={creatingUser}>Cancel</button><button type="button" className="reqgen-btn reqgen-btn-blue rounded-xl px-4 py-2 text-sm font-black text-white" onClick={() => void createUser()} disabled={creatingUser}>{creatingUser ? "Creating…" : "Create User"}</button></div>
            </section>
          </div>
        ) : null}

        <div className="mt-6 rounded-3xl border border-amber-100 bg-amber-50 p-5 text-sm text-amber-900">
          <div className="font-bold">Role Assignment Note</div>
          <p className="mt-1">
            One user can now hold multiple official capacities. When a request is treated later, the
            system will record the exact role used, such as Registrar, HR Boss, DOD, HOD, PO, DG or
            AccountOfficer, for display in request history and print templates.
          </p>
        </div>
      </div>
    </main>
  );
}

function UserRolePanel({
  u,
  roles,
  depts,
  deptMap,
  userRoles,
  roleMap,
  saving,
  disabled,
  onUpdateDepartment,
  onAssignRole,
  onSetPrimaryRole,
  onDeactivateRole,
  onDeleteUser,
  canDelete,
}: {
  u: ProfileRow;
  roles: ReqgenRole[];
  depts: Dept[];
  deptMap: Record<string, string>;
  userRoles: ProfileRole[];
  roleMap: Record<string, ReqgenRole>;
  saving: boolean;
  disabled: boolean;
  onUpdateDepartment: (id: string, deptId: string | null) => Promise<void>;
  onAssignRole: (id: string, roleKey: string, makePrimary: boolean) => Promise<void>;
  onSetPrimaryRole: (id: string, roleKey: string) => Promise<void>;
  onDeactivateRole: (id: string, roleKey: string) => Promise<void>;
  onDeleteUser: (profile: ProfileRow) => Promise<void>;
  canDelete: boolean;
}) {
  const [deptId, setDeptId] = useState<string>(u.dept_id || "");
  const [newRoleKey, setNewRoleKey] = useState<string>("");
  const [makePrimary, setMakePrimary] = useState<boolean>(false);

  useEffect(() => {
    queueMicrotask(() => setDeptId(u.dept_id || ""));
  }, [u.id, u.dept_id]);

  const ready = !!u.signature_url;
  const deptChanged = deptId !== (u.dept_id || "");
  const selectedRole = roleMap[roleKey(newRoleKey)];
  const activeRoleKeys = userRoles.map((r) => roleKey(r.role_key));
  const assignableRoles = roles.filter((r) => !activeRoleKeys.includes(roleKey(r.role_key)));

  function handleAssign() {
    if (!newRoleKey) return;

    onAssignRole(u.id, newRoleKey, makePrimary);
    setNewRoleKey("");
    setMakePrimary(false);
  }

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-lg font-extrabold text-slate-900">{u.full_name || "—"}</div>
          <div className="mt-1 text-sm text-slate-600">{u.email || "—"}</div>
          <div className="mt-1 text-xs text-slate-500">
            Joined {shortDate(u.created_at)} • Primary fallback: <b>{u.role || "Staff"}</b>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Department:{" "}
            {u.dept_id ? deptMap[u.dept_id] || "Unknown Department" : "No department routing"}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${signatureBadgeClass(
              ready
            )}`}
          >
            {ready ? "Signature Ready" : "No Signature"}
          </span>

          {!ready && (
            <span className="max-w-xs text-right text-xs font-semibold text-red-600">
              Signature-required roles cannot be assigned until signature is uploaded.
            </span>
          )}

          <button
            type="button"
            onClick={() => onDeleteUser(u)}
            disabled={disabled || saving || !canDelete}
            className="reqgen-btn reqgen-btn-rose rounded-xl px-3 py-2 text-xs font-black text-white disabled:opacity-50"
            title="Server-side safe delete; blocked when immutable history exists"
          >
            Delete User
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-extrabold text-slate-900">Active Roles</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">
                These roles are available to this user in ReqGen workflows.
              </div>
            </div>

            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">
              {userRoles.length} active
            </span>
          </div>

          {userRoles.length === 0 ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              No active role found. Assign Staff or another suitable role.
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {userRoles.map((r) => (
                <div
                  key={r.id}
                  className={`rounded-2xl border bg-white px-3 py-2 ${roleBadgeClass(r.role_key)}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black">{roleDisplayName(r.role_name)}</span>

                    {r.is_primary && (
                      <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-black">
                        PRIMARY
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {!r.is_primary && (
                      <button
                        type="button"
                        onClick={() => onSetPrimaryRole(u.id, r.role_key)}
                        disabled={disabled || saving}
                        className="reqgen-btn reqgen-btn-violet rounded-lg px-2 py-1 text-[11px] font-black text-white disabled:opacity-50"
                      >
                        Set Primary
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDeactivateRole(u.id, r.role_key)}
                      disabled={disabled || saving}
                      className="reqgen-btn reqgen-btn-rose rounded-lg px-2 py-1 text-[11px] font-black text-white disabled:opacity-50"
                    >
                      Deactivate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-extrabold text-slate-900">Assign New Role</div>

          <select
            value={newRoleKey}
            onChange={(e) => setNewRoleKey(e.target.value)}
            disabled={disabled || saving}
            className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
          >
            <option value="">Select role...</option>
            {assignableRoles.map((r) => (
              <option key={r.id} value={r.role_key}>
                {roleDisplayName(r.role_name)}
                {r.requires_signature ? " • Signature" : ""}
              </option>
            ))}
          </select>

          {selectedRole && (
            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
              {selectedRole.requires_signature ? "Signature required." : "Signature not required."}
              {selectedRole.description ? ` ${selectedRole.description}` : ""}
            </div>
          )}

          <label className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-700">
            <input
              type="checkbox"
              checked={makePrimary}
              onChange={(e) => setMakePrimary(e.target.checked)}
              disabled={disabled || saving}
            />
            Set as primary fallback role
          </label>

          <button
            type="button"
            onClick={handleAssign}
            disabled={!newRoleKey || disabled || saving}
            className="reqgen-btn reqgen-btn-blue mt-3 w-full rounded-xl px-4 py-2 text-sm font-black text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Assign Role"}
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <label className="text-sm font-bold text-slate-800">Department Routing</label>
            <select
              value={deptId}
              onChange={(e) => setDeptId(e.target.value)}
              disabled={disabled || saving}
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
              This is the user’s own department/routing group. DOD/HOD/PO assignment to departments
              is handled in the Admin routing panel.
            </div>
          </div>

          <button
            type="button"
            disabled={!deptChanged || disabled || saving}
            onClick={() => onUpdateDepartment(u.id, deptId || null)}
            className="reqgen-btn reqgen-btn-emerald rounded-xl px-4 py-2 text-sm font-black text-white disabled:opacity-50"
          >
            Save Department
          </button>
        </div>
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
