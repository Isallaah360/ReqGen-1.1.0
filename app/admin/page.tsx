"use client";

import { useEffect, useMemo, useState } from "react";
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

const GLOBAL_KEYS = [
  "REGISTRY_USER_ID",
  "DG_USER_ID",
  "HR_USER_ID",
] as const;

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

function roleKey(role: string) {
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

export default function AdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  async function loadAll() {
    setLoading(true);
    setMsg(null);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
      setMsg("Auth error: " + authErr.message);
      setLoading(false);
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
      return;
    }

    const role = (me?.role || "Staff") as string;
    setMeRole(role);

    if (roleKey(role) !== "admin") {
      router.push("/dashboard");
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
    } else {
      setUsers((usersRes.data || []) as UserRow[]);
    }

    if (deptsRes.error) {
      setMsg("Failed to load departments: " + deptsRes.error.message);
    } else {
      setDepts((deptsRes.data || []) as DeptRow[]);
    }

    if (!settingsRes.error && settingsRes.data) {
      const map: Record<string, string> = {};
      (settingsRes.data as SettingRow[]).forEach((r) => {
        map[r.key] = r.value || "";
      });
      setSettings(map);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: selectedRole })
        .eq("id", selectedUserId);

      if (error) throw new Error(error.message);

      setMsg("✅ User role updated successfully.");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Role update failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
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
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Department save failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
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
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key, value });

      if (error) throw new Error(error.message);

      setMsg("✅ Global officer saved.");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Global officer save failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  const signatureReadyCount = users.filter((u) => !!u.signature_url).length;
  const totalUsers = users.length;

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

          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Back
          </button>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
            {msg}
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <StatCard title="Total Users" value={String(totalUsers)} />
          <StatCard title="Signature Ready" value={String(signatureReadyCount)} />
          <StatCard
            title="Needs Signature"
            value={String(Math.max(totalUsers - signatureReadyCount, 0))}
          />
        </div>

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Quick Role Assignment</h2>
          <p className="mt-1 text-sm text-slate-600">
            Critical workflow roles require signature readiness before assignment.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-800">Select User</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900"
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
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={saveUserRole}
            disabled={saving}
            className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Role"}
          </button>
        </div>

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Global Routing Officers</h2>
          <p className="mt-1 text-sm text-slate-600">
            Registry, DG and HR must always be assigned to signature-ready users.
          </p>

          {GLOBAL_KEYS.map((k) => (
            <div key={k} className="mt-4">
              <div className="text-sm font-semibold text-slate-800">{k}</div>

              <div className="mt-2 flex flex-col gap-2 md:flex-row">
                <select
                  value={settings[k] || ""}
                  onChange={(e) => setSettings((s) => ({ ...s, [k]: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900"
                >
                  <option value="">-- Select user --</option>
                  {users
                    .filter((u) => !!u.signature_url)
                    .map((u) => (
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
                  Save
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Department Routing</h2>
          <p className="mt-1 text-sm text-slate-600">
            If Director is assigned, request starts with Director then moves to HOD.
            If no Director is assigned, request starts at HOD.
          </p>

          <div className="mt-4 space-y-4">
            {depts.map((d) => (
              <div key={d.id} className="rounded-2xl border border-slate-200 p-5">
                <div className="font-bold text-slate-900">{d.name}</div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-slate-800">Director</label>
                    <select
                      value={d.director_user_id || ""}
                      onChange={(e) =>
                        setDepts((prev) =>
                          prev.map((x) =>
                            x.id === d.id
                              ? { ...x, director_user_id: e.target.value || null }
                              : x
                          )
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900"
                    >
                      <option value="">-- None --</option>
                      {users
                        .filter((u) => !!u.signature_url)
                        .map((u) => (
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
                      onChange={(e) =>
                        setDepts((prev) =>
                          prev.map((x) =>
                            x.id === d.id ? { ...x, hod_user_id: e.target.value || null } : x
                          )
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900"
                    >
                      <option value="">-- None --</option>
                      {users
                        .filter((u) => !!u.signature_url)
                        .map((u) => (
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
                  Save Department Routing
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Signature Readiness</h2>
          <p className="mt-1 text-sm text-slate-600">
            Users without signature should not handle workflow-sensitive roles.
          </p>

          <div className="mt-4 overflow-x-auto">
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
                      <td className="py-2 pr-4">{u.role || "Staff"}</td>
                      <td className="py-2 pr-4">
                        {u.signature_url ? "✅ Present" : "❌ Missing"}
                      </td>
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
      </div>
    </main>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-extrabold text-slate-900">{value}</div>
    </div>
  );
}