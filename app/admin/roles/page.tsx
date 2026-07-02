"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ReqgenRole = {
  id: string;
  role_key: string;
  role_name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  requires_signature: boolean;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
};

type ProfileMini = {
  id: string;
  role: string | null;
};

type TabKey = "overview" | "active" | "inactive" | "form";

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function makeRoleKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 50);
}

function shortDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
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

export default function AdminRolesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [me, setMe] = useState<ProfileMini | null>(null);
  const [roles, setRoles] = useState<ReqgenRole[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [search, setSearch] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState("");
  const [description, setDescription] = useState("");
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [active, setActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(100);

  const rk = roleKey(me?.role);
  const canManage = rk === "admin" || rk === "auditor";

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
        return;
      }

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id,role")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (profErr) {
        setMsg("Failed to load your profile: " + profErr.message);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const myProfile = (prof || null) as ProfileMini | null;
      setMe(myProfile);

      const myRole = roleKey(myProfile?.role);

      if (!["admin", "auditor"].includes(myRole)) {
        setMsg("Access denied. Only Admin/Auditor can manage roles.");
        setRoles([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const { data, error } = await supabase
        .from("reqgen_roles")
        .select(
          "id,role_key,role_name,description,is_system,is_active,requires_signature,sort_order,created_at,updated_at"
        )
        .order("sort_order", { ascending: true })
        .order("role_name", { ascending: true });

      if (error) {
        setMsg("Failed to load roles: " + error.message);
        setRoles([]);
      } else {
        setRoles((data || []) as ReqgenRole[]);
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

  const stats = useMemo(() => {
    const total = roles.length;
    const activeCount = roles.filter((r) => r.is_active).length;
    const inactiveCount = roles.filter((r) => !r.is_active).length;
    const systemCount = roles.filter((r) => r.is_system).length;
    const customCount = roles.filter((r) => !r.is_system).length;
    const signatureCount = roles.filter((r) => r.requires_signature).length;

    return {
      total,
      activeCount,
      inactiveCount,
      systemCount,
      customCount,
      signatureCount,
    };
  }, [roles]);

  const filteredRoles = useMemo(() => {
    const s = search.trim().toLowerCase();

    return roles.filter((r) => {
      if (activeTab === "active" && !r.is_active) return false;
      if (activeTab === "inactive" && r.is_active) return false;

      if (!s) return true;

      const haystack = [
        r.role_key,
        r.role_name,
        r.description,
        r.is_system ? "system" : "custom",
        r.is_active ? "active" : "inactive",
        r.requires_signature ? "signature required" : "no signature",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(s);
    });
  }, [roles, search, activeTab]);

  function resetForm() {
    setEditId(null);
    setRoleName("");
    setDescription("");
    setRequiresSignature(false);
    setActive(true);
    setSortOrder(100);
  }

  function startCreate() {
    resetForm();
    setMsg(null);
    setActiveTab("form");
  }

  function startEdit(role: ReqgenRole) {
    setEditId(role.id);
    setRoleName(role.role_name || "");
    setDescription(role.description || "");
    setRequiresSignature(Boolean(role.requires_signature));
    setActive(Boolean(role.is_active));
    setSortOrder(Number(role.sort_order || 100));
    setMsg(null);
    setActiveTab("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveRole() {
    if (!canManage) {
      setMsg("❌ Not allowed.");
      return;
    }

    const name = roleName.trim();
    const desc = description.trim();
    const key = makeRoleKey(name);

    if (name.length < 2) {
      setMsg("❌ Role name is required.");
      return;
    }

    if (key.length < 2) {
      setMsg("❌ Role key could not be generated. Use letters and numbers.");
      return;
    }

    const existing = roles.find((r) => roleKey(r.role_name) === roleKey(name) && r.id !== editId);

    if (existing) {
      setMsg("❌ A role with this name already exists.");
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      if (!editId) {
        const payload = {
          role_key: key,
          role_name: name,
          description: desc || null,
          is_system: false,
          is_active: active,
          requires_signature: requiresSignature,
          sort_order: Number(sortOrder || 100),
        };

        const { error } = await supabase.from("reqgen_roles").insert(payload);

        if (error) throw new Error(error.message);

        setMsg("✅ Role created successfully.");
      } else {
        const current = roles.find((r) => r.id === editId);

        if (!current) {
          throw new Error("Selected role not found.");
        }

        const payload: Partial<ReqgenRole> = {
          role_name: name,
          description: desc || null,
          is_active: active,
          requires_signature: requiresSignature,
          sort_order: Number(sortOrder || 100),
        };

        if (!current.is_system) {
          payload.role_key = key;
        }

        const { error } = await supabase
          .from("reqgen_roles")
          .update(payload)
          .eq("id", editId);

        if (error) throw new Error(error.message);

        setMsg("✅ Role updated successfully.");
      }

      resetForm();
      setActiveTab(active ? "active" : "inactive");
      await loadAll({ silent: true });
      router.refresh();
    } catch (e: any) {
      setMsg("❌ Save failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(role: ReqgenRole, nextActive: boolean) {
    if (!canManage) {
      setMsg("❌ Not allowed.");
      return;
    }

    const ok = confirm(
      `Set role "${role.role_name}" to ${nextActive ? "Active" : "Inactive"}?`
    );

    if (!ok) return;

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase
        .from("reqgen_roles")
        .update({ is_active: nextActive })
        .eq("id", role.id);

      if (error) throw new Error(error.message);

      setMsg(nextActive ? "✅ Role activated." : "✅ Role deactivated.");
      await loadAll({ silent: true });
      router.refresh();
    } catch (e: any) {
      setMsg("❌ Failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteRole(role: ReqgenRole) {
    if (!canManage) {
      setMsg("❌ Not allowed.");
      return;
    }

    if (role.is_system) {
      setMsg("❌ System roles cannot be deleted. Deactivate if necessary.");
      return;
    }

    const ok = confirm(
      `Delete custom role "${role.role_name}" permanently?\n\nOnly unused custom roles should be deleted.`
    );

    if (!ok) return;

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase.from("reqgen_roles").delete().eq("id", role.id);

      if (error) throw new Error(error.message);

      setMsg("✅ Custom role deleted successfully.");

      if (editId === role.id) {
        resetForm();
      }

      await loadAll({ silent: true });
      router.refresh();
    } catch (e: any) {
      setMsg(
        "❌ Delete failed: " +
          (e?.message || "Unknown error") +
          ". If the role is already in use, deactivate it instead."
      );
    } finally {
      setSaving(false);
    }
  }

  function goAdmin() {
    router.push(`/admin?updated=${Date.now()}`);
    router.refresh();
  }

  function goUsers() {
    router.push(`/admin/users?updated=${Date.now()}`);
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-7xl py-10 text-slate-600">
          Loading roles...
        </div>
      </main>
    );
  }

  if (!canManage) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-3xl py-10">
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <h1 className="text-xl font-extrabold text-slate-900">Access denied</h1>
            <p className="mt-2 text-sm text-slate-600">
              Only Admin/Auditor can manage roles and permissions.
            </p>

            {msg && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {msg}
              </div>
            )}

            <button
              onClick={() => router.push(`/dashboard?updated=${Date.now()}`)}
              className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
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
              Roles & Permissions
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Create, edit, activate, deactivate and safely manage ReqGen roles.
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Role catalogue controls what appears in Admin user role assignment.
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
              onClick={startCreate}
              disabled={refreshing || saving}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              Add Role
            </button>

            <button
              onClick={goUsers}
              disabled={refreshing || saving}
              className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
            >
              Users & Roles
            </button>

            <button
              onClick={goAdmin}
              disabled={refreshing || saving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              Back to Admin
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm">
            {msg}
          </div>
        )}

        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-900">
          System roles are protected. They can be edited or deactivated where necessary, but cannot be permanently deleted.
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Total Roles" value={String(stats.total)} tone="blue" />
          <StatCard title="Active" value={String(stats.activeCount)} tone="emerald" />
          <StatCard title="Inactive" value={String(stats.inactiveCount)} tone="amber" />
          <StatCard title="System Roles" value={String(stats.systemCount)} tone="purple" />
          <StatCard title="Custom Roles" value={String(stats.customCount)} tone="slate" />
          <StatCard title="Signature Required" value={String(stats.signatureCount)} tone="red" />
        </div>

        <div className="mt-6 rounded-3xl border bg-white p-2 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <TabButton label="Overview" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
            <TabButton label="Active Roles" active={activeTab === "active"} onClick={() => setActiveTab("active")} />
            <TabButton label="Inactive Roles" active={activeTab === "inactive"} onClick={() => setActiveTab("inactive")} />
            <TabButton label={editId ? "Edit Role" : "Add Role"} active={activeTab === "form"} onClick={() => setActiveTab("form")} />
          </div>
        </div>

        {(activeTab === "overview" || activeTab === "active" || activeTab === "inactive") && (
          <div className="mt-6 rounded-3xl border bg-white p-5 shadow-sm">
            <label className="text-sm font-semibold text-slate-800">Search Roles</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search role name, key, description, status..."
              className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
            />
          </div>
        )}

        {activeTab === "form" && (
          <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editId ? "Edit Role" : "Add New Role"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Create or update a role used by the Admin user assignment page.
                </p>
              </div>

              {editId && (
                <button
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-slate-800">Role Name</label>
                <input
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  disabled={saving}
                  placeholder="e.g. DINAdmin"
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
                />
                <div className="mt-1 text-xs font-semibold text-slate-500">
                  Generated key: {makeRoleKey(roleName) || "—"}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800">Sort Order</label>
                <input
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value || 100))}
                  disabled={saving}
                  type="number"
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-slate-800">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={saving}
                  placeholder="Briefly describe what this role does..."
                  className="mt-1 min-h-[110px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={requiresSignature}
                    onChange={(e) => setRequiresSignature(e.target.checked)}
                    disabled={saving}
                  />
                  Requires Signature
                </label>
                <p className="mt-2 text-xs text-slate-600">
                  Use this for workflow-sensitive roles such as Director, HOD, DG, HR, Auditor, Admin and AccountOfficer.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    disabled={saving}
                  />
                  Active
                </label>
                <p className="mt-2 text-xs text-slate-600">
                  Inactive roles will not appear in user role assignment dropdowns.
                </p>
              </div>
            </div>

            <button
              onClick={saveRole}
              disabled={saving}
              className="mt-5 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : editId ? "Update Role" : "Create Role"}
            </button>
          </div>
        )}

        {(activeTab === "overview" || activeTab === "active" || activeTab === "inactive") && (
          <div className="mt-6 overflow-hidden rounded-3xl border bg-white shadow-sm">
            <div className="border-b bg-slate-50 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Role Register</h2>
              <p className="mt-1 text-sm text-slate-600">
                System and custom roles available for ReqGen user assignment.
              </p>
            </div>

            {filteredRoles.length === 0 ? (
              <div className="p-6 text-sm text-slate-700">No roles found.</div>
            ) : (
              <>
                <div className="grid gap-4 p-4 xl:hidden">
                  {filteredRoles.map((role) => (
                    <RoleCard
                      key={role.id}
                      role={role}
                      saving={saving}
                      onEdit={() => startEdit(role)}
                      onToggle={() => toggleActive(role, !role.is_active)}
                      onDelete={() => deleteRole(role)}
                    />
                  ))}
                </div>

                <div className="hidden overflow-x-auto xl:block">
                  <table className="min-w-[1150px] w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                        <th className="px-4 py-3 text-left">Role</th>
                        <th className="px-4 py-3 text-left">Key</th>
                        <th className="px-4 py-3 text-left">Description</th>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">Signature</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Updated</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredRoles.map((role) => (
                        <tr key={role.id} className="border-t hover:bg-slate-50">
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${roleBadgeClass(
                                role.role_name
                              )}`}
                            >
                              {role.role_name}
                            </span>
                          </td>

                          <td className="px-4 py-4 font-mono text-xs font-bold text-slate-700">
                            {role.role_key}
                          </td>

                          <td className="px-4 py-4 text-slate-700">
                            {role.description || "—"}
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-bold ${
                                role.is_system
                                  ? "border-purple-200 bg-purple-50 text-purple-700"
                                  : "border-slate-200 bg-slate-50 text-slate-700"
                              }`}
                            >
                              {role.is_system ? "System" : "Custom"}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-bold ${
                                role.requires_signature
                                  ? "border-blue-200 bg-blue-50 text-blue-700"
                                  : "border-slate-200 bg-slate-50 text-slate-700"
                              }`}
                            >
                              {role.requires_signature ? "Required" : "Not Required"}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <StatusBadge active={role.is_active} />
                          </td>

                          <td className="px-4 py-4 text-slate-600">
                            {shortDate(role.updated_at)}
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => startEdit(role)}
                                disabled={saving}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50"
                              >
                                Edit
                              </button>

                              <button
                                onClick={() => toggleActive(role, !role.is_active)}
                                disabled={saving}
                                className={`rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
                                  role.is_active
                                    ? "bg-amber-600 hover:bg-amber-700"
                                    : "bg-emerald-600 hover:bg-emerald-700"
                                }`}
                              >
                                {role.is_active ? "Deactivate" : "Activate"}
                              </button>

                              <button
                                onClick={() => deleteRole(role)}
                                disabled={saving || role.is_system}
                                className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
          <div className="font-bold">Roles Management Note</div>
          <p className="mt-1">
            Roles control access, approval responsibilities and sensitive workflow actions. Use deactivation instead of deletion when a role may already exist in user history or request records.
          </p>
        </div>
      </div>
    </main>
  );
}

function RoleCard({
  role,
  saving,
  onEdit,
  onToggle,
  onDelete,
}: {
  role: ReqgenRole;
  saving: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${roleBadgeClass(role.role_name)}`}>
            {role.role_name}
          </span>
          <div className="mt-2 font-mono text-xs font-bold text-slate-500">
            {role.role_key}
          </div>
        </div>

        <StatusBadge active={role.is_active} />
      </div>

      <p className="mt-4 text-sm text-slate-700">
        {role.description || "No description supplied."}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <InfoMetric title="Type" value={role.is_system ? "System" : "Custom"} />
        <InfoMetric title="Signature" value={role.requires_signature ? "Required" : "Not Required"} />
        <InfoMetric title="Updated" value={shortDate(role.updated_at)} />
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          onClick={onEdit}
          disabled={saving}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50"
        >
          Edit
        </button>

        <button
          onClick={onToggle}
          disabled={saving}
          className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
            role.is_active
              ? "bg-amber-600 hover:bg-amber-700"
              : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {role.is_active ? "Deactivate" : "Activate"}
        </button>

        <button
          onClick={onDelete}
          disabled={saving || role.is_system}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-bold ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
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
  tone: "blue" | "emerald" | "amber" | "purple" | "slate" | "red";
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
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      <div className={`mt-3 inline-flex rounded-2xl px-3 py-2 text-xl font-extrabold ${cls}`}>
        {value}
      </div>
    </div>
  );
}