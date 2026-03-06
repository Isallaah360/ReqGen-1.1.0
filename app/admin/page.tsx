"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  dept_id?: string | null;
};

type DeptRow = {
  id: string;
  name: string;
  hod_user_id: string | null;
  director_user_id: string | null;
};

type SettingRow = { key: string; value: string };

const ROLE_OPTIONS = [
  "Staff",
  "Admin",
  "Auditor",
  "AccountOfficer",
  "Director",
  "HOD",
  "HR",
  "Registry",
  "DG",
] as const;

const GLOBAL_KEYS = [
  "HOD_USER_ID",
  "DIRECTOR_USER_ID",
  "REGISTRY_USER_ID",
  "DG_USER_ID",
  "ACCOUNT_USER_ID",
  "HR_USER_ID",
] as const;

function roleKey(role: string) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function userLabel(u: UserRow) {
  const name = u.full_name?.trim() || "Unnamed User";
  const email = u.email?.trim() || u.id;
  const role = u.role?.trim() || "Staff";
  return `${name} • ${email} (${role})`;
}

export default function AdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [meEmail, setMeEmail] = useState<string>("");
  const [meRole, setMeRole] = useState<string>("");

  const [users, setUsers] = useState<UserRow[]>([]);
  const [depts, setDepts] = useState<DeptRow[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});

  // Role assignment
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("Staff");

  const [savingRole, setSavingRole] = useState(false);
  const [saving, setSaving] = useState(false);

  const canAdmin = useMemo(() => {
    const rk = roleKey(meRole);
    return rk === "admin" || rk === "auditor";
  }, [meRole]);

  const usersById = useMemo(() => {
    const m = new Map<string, UserRow>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  async function loadAll() {
    setLoading(true);
    setMsg(null);

    // 1) Auth
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

    // 2) Admin/Auditor gate
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

    if (!["admin", "auditor"].includes(roleKey(role))) {
      router.push("/dashboard");
      return;
    }

    // 3) Load all admin data in parallel
    const [profsRes, deptRes, setRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,email,full_name,role,dept_id")
        .order("full_name", { ascending: true }),
      supabase
        .from("departments")
        .select("id,name,hod_user_id,director_user_id")
        .order("name", { ascending: true }),
      supabase.from("app_settings").select("key,value"),
    ]);

    if (profsRes.error) {
      setMsg("Failed to load users: " + profsRes.error.message);
    } else {
      setUsers((profsRes.data || []) as UserRow[]);
    }

    if (deptRes.error) {
      setMsg("Failed to load departments: " + deptRes.error.message);
    } else {
      setDepts((deptRes.data || []) as DeptRow[]);
    }

    if (setRes.error) {
      setMsg("Failed to load settings: " + setRes.error.message);
    } else if (setRes.data) {
      const map: Record<string, string> = {};
      (setRes.data as SettingRow[]).forEach((r) => (map[r.key] = r.value));
      setSettings(map);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When a user is selected, auto-load current role
  useEffect(() => {
    if (!selectedUserId) return;
    const u = usersById.get(selectedUserId);
    setSelectedRole(u?.role || "Staff");
  }, [selectedUserId, usersById]);

  async function saveDept(deptId: string, hodId: string | null, dirId: string | null) {
    setMsg(null);
    setSaving(true);

    try {
      const { error } = await supabase
        .from("departments")
        .update({
          hod_user_id: hodId || null,
          director_user_id: dirId || null,
        })
        .eq("id", deptId);

      if (error) throw new Error(error.message);

      setMsg("✅ Department routing saved.");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function saveSetting(key: string, value: string) {
    setMsg(null);
    setSaving(true);

    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key, value: value || "" });

      if (error) throw new Error(error.message);

      setMsg("✅ Setting saved.");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function saveUserRole() {
    setMsg(null);

    if (!selectedUserId) {
      setMsg("❌ Please select a user.");
      return;
    }

    setSavingRole(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: selectedRole })
        .eq("id", selectedUserId);

      if (error) throw new Error(error.message);

      setMsg("✅ Role updated successfully.");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Role update failed: " + (e?.message || "Unknown error"));
    } finally {
      setSavingRole(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-6xl py-10 text-slate-600">Loading...</div>
      </main>
    );
  }

  if (!canAdmin) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-4xl py-10">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="text-lg font-bold text-slate-900">Access denied</div>
            <div className="mt-1 text-sm text-slate-600">
              Only Admin or Auditor can access this page.
            </div>
            <button
              onClick={() => router.push("/dashboard")}
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

        {/* QUICK LINKS */}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Link
            href="/admin/users"
            className="rounded-2xl border bg-white p-5 shadow-sm hover:bg-slate-50"
          >
            <div className="text-lg font-bold text-slate-900">Users & Roles</div>
            <div className="mt-1 text-sm text-slate-600">
              Manage staff accounts, roles and dept routing.
            </div>
          </Link>

          <Link
            href="/admin/settings"
            className="rounded-2xl border bg-white p-5 shadow-sm hover:bg-slate-50"
          >
            <div className="text-lg font-bold text-slate-900">Routing Settings</div>
            <div className="mt-1 text-sm text-slate-600">
              Set HOD, Director, Registry, DG, HR and Account routing.
            </div>
          </Link>

          <Link
            href="/finance"
            className="rounded-2xl border bg-white p-5 shadow-sm hover:bg-slate-50"
          >
            <div className="text-lg font-bold text-slate-900">Finance Section</div>
            <div className="mt-1 text-sm text-slate-600">
              Manage departments, subheads, accounts and reports.
            </div>
          </Link>
        </div>

        {/* ROLE ASSIGNMENT */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Quick Role Assignment</h2>
          <p className="mt-1 text-sm text-slate-600">
            Assign any global role directly here.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-800">Select User</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="">-- Select user --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {userLabel(u)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
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
            disabled={savingRole}
            className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
          >
            {savingRole ? "Saving..." : "Save Role"}
          </button>
        </div>

        {/* GLOBAL OFFICERS */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Global Routing Officers</h2>
          <p className="mt-1 text-sm text-slate-600">
            Stored in <b>app_settings</b>. These drive routing and notifications.
          </p>

          {GLOBAL_KEYS.map((k) => (
            <div key={k} className="mt-4">
              <div className="text-sm font-semibold text-slate-800">{k}</div>
              <div className="mt-2 flex flex-col gap-2 md:flex-row">
                <select
                  value={settings[k] || ""}
                  onChange={(e) => setSettings((s) => ({ ...s, [k]: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="">-- Select user --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {userLabel(u)}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => saveSetting(k, settings[k] || "")}
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                >
                  Save
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* DEPARTMENT ROUTING */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Departments Routing</h2>
          <p className="mt-1 text-sm text-slate-600">
            Set HOD and Director per department.
          </p>

          <div className="mt-4 space-y-4">
            {depts.map((d) => (
              <div key={d.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="font-bold text-slate-900">{d.name}</div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
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
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                    >
                      <option value="">-- None --</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {userLabel(u)}
                        </option>
                      ))}
                    </select>
                  </div>

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
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                    >
                      <option value="">-- None --</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {userLabel(u)}
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
                  Save Department
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}