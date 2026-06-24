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

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const signatureReadyCount = users.filter((u) => !!u.signature_url).length;
    const needsSignature = Math.max(totalUsers - signatureReadyCount, 0);
    const departments = depts.length;
    const activeDepartments = depts.filter((d) => d.is_active !== false).length;
    const routedDepartments = depts.filter((d) => d.hod_user_id || d.director_user_id).length;

    return {
      totalUsers,
      signatureReadyCount,
      needsSignature,
      departments,
      activeDepartments,
      routedDepartments,
    };
  }, [users, depts]);

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

      const [usersRes, deptsRes, settingsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,email,full_name,role,signature_url")
          .order("full_name", { ascending: true }),

        supabase
          .from("departments")
          .select("id,name,hod_user_id,director_user_id,is_active")
          .order("name", { ascending: true }),

        supabase.from("app_settings").select("key,value"),
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

  function goDashboard() {
    router.push(`/dashboard?updated=${Date.now()}`);
    router.refresh();
  }

  function goUsersRoles() {
    router.push(`/admin/users?updated=${Date.now()}`);
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
        <div className="mx-auto max-w-6xl py-10 text-slate-600">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-6xl py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Admin Panel
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Logged in as <b className="text-slate-900">{meEmail || "—"}</b> • Role{" "}
              <b className="text-slate-900">{meRole}</b>
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
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              Users & Roles
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
          This Admin Panel refreshes automatically when you return to it. Role, routing and global officer changes are reloaded immediately.
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Total Users" value={String(stats.totalUsers)} tone="blue" />
          <StatCard title="Signature Ready" value={String(stats.signatureReadyCount)} tone="emerald" />
          <StatCard title="Needs Signature" value={String(stats.needsSignature)} tone="amber" />
          <StatCard title="Departments" value={String(stats.departments)} tone="slate" />
          <StatCard title="Active Depts" value={String(stats.activeDepartments)} tone="blue" />
          <StatCard title="Routed Depts" value={String(stats.routedDepartments)} tone="purple" />
        </div>

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

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Department Routing</h2>
          <p className="mt-1 text-sm text-slate-600">
            If Director is assigned, request starts with Director then moves to HOD.
            If no Director is assigned, request starts at HOD.
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
                        Director: {officerName(d.director_user_id)} • HOD:{" "}
                        {officerName(d.hod_user_id)}
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
                        {signatureReadyUsers.map((u) => (
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

        <div className="mt-6 rounded-3xl border border-amber-100 bg-amber-50 p-5 text-sm text-amber-900">
          <div className="font-bold">Admin Control Note</div>
          <p className="mt-1">
            Signature readiness protects workflow integrity. Assign Registry, HR, DG, HOD, Director,
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
  tone: "blue" | "emerald" | "amber" | "slate" | "purple";
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
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      <div className={`mt-2 inline-flex rounded-2xl px-3 py-2 text-2xl font-extrabold ${cls}`}>
        {value}
      </div>
    </div>
  );
}