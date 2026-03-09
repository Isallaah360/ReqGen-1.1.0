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
  dept_id: string | null;
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

  const [meEmail, setMeEmail] = useState("");
  const [meRole, setMeRole] = useState("");

  const [users, setUsers] = useState<UserRow[]>([]);
  const [depts, setDepts] = useState<DeptRow[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});

  // quick role assignment
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("Staff");
  const [selectedDeptId, setSelectedDeptId] = useState("");

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
      setMsg("Failed to verify admin access: " + meErr.message);
      setLoading(false);
      return;
    }

    const role = (me?.role || "Staff") as string;
    setMeRole(role);

    if (!["admin", "auditor"].includes(roleKey(role))) {
      router.push("/dashboard");
      return;
    }

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
    } else {
      const map: Record<string, string> = {};
      ((setRes.data || []) as SettingRow[]).forEach((r) => {
        map[r.key] = r.value;
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
    setSelectedDeptId(u?.dept_id || "");
  }, [selectedUserId, usersById]);

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
        .update({
          role: selectedRole,
          dept_id: selectedDeptId || null,
        })
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

  async function saveSetting(key: string, value: string) {
    setMsg(null);
    setSaving(true);

    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key, value: value || "" });

      if (error) throw new Error(error.message);

      setMsg(`✅ ${key} saved successfully.`);
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function saveDeptRouting(deptId: string, hodId: string | null, directorId: string | null) {
    setMsg(null);
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
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <Link
            href="/admin/users"
            className="rounded-2xl border bg-white p-5 shadow-sm hover:bg-slate-50"
          >
            <div className="text-lg font-bold text-slate-900">Users & Roles</div>
            <div className="mt-1 text-sm text-slate-600">
              Manage staff accounts, roles and department mapping.
            </div>
          </Link>

          <Link
            href="/admin/settings"
            className="rounded-2xl border bg-white p-5 shadow-sm hover:bg-slate-50"
          >
            <div className="text-lg font-bold text-slate-900">Routing Settings</div>
            <div className="mt-1 text-sm text-slate-600">
              Set Registry, DG, HR and Account routing.
            </div>
          </Link>

          <Link
            href="/admin/departments"
            className="rounded-2xl border bg-white p-5 shadow-sm hover:bg-slate-50"
          >
            <div className="text-lg font-bold text-slate-900">Department Routing</div>
            <div className="mt-1 text-sm text-slate-600">
              Assign HOD and Director for each department.
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

        {/* USER CREATION NOTICE */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Create User Account</h2>
          <p className="mt-2 text-sm text-slate-600">
            For security, new login accounts should be created manually in Supabase
            Authentication, then configured here in Admin Panel.
          </p>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="font-semibold text-slate-900">Safe workflow</div>
            <div className="mt-2">
              1. Create user in <b>Supabase → Authentication → Users → Add user</b>.
            </div>
            <div className="mt-1">
              2. Let the user sign in or register profile details.
            </div>
            <div className="mt-1">
              3. Come back here and assign role + department.
            </div>
            <div className="mt-1">
              4. User can then reset password and upload signature from Profile.
            </div>
          </div>
        </div>

        {/* QUICK ROLE ASSIGNMENT */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Quick Role Assignment</h2>
          <p className="mt-1 text-sm text-slate-600">
            Assign any global role directly here.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-4">
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

            <div>
              <label className="text-sm font-semibold text-slate-800">Department (optional)</label>
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="">-- None --</option>
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
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

        {/* GLOBAL ROUTING SETTINGS */}
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

        {/* INLINE DEPARTMENT ROUTING SUMMARY */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Department HOD / Director Routing</h2>
              <p className="mt-1 text-sm text-slate-600">
                Assign first approvers for each department.
              </p>
            </div>

            <Link
              href="/admin/departments"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Open Full Department Routing
            </Link>
          </div>

          <div className="mt-4 space-y-4">
            {depts.length === 0 ? (
              <div className="text-sm text-slate-600">No departments found.</div>
            ) : (
              depts.map((d) => (
                <DeptRoutingCard
                  key={d.id}
                  dept={d}
                  users={users}
                  onSave={saveDeptRouting}
                  saving={saving}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function DeptRoutingCard({
  dept,
  users,
  onSave,
  saving,
}: {
  dept: DeptRow;
  users: UserRow[];
  onSave: (deptId: string, hodId: string | null, directorId: string | null) => Promise<void>;
  saving: boolean;
}) {
  const [hodId, setHodId] = useState(dept.hod_user_id || "");
  const [directorId, setDirectorId] = useState(dept.director_user_id || "");

  useEffect(() => {
    setHodId(dept.hod_user_id || "");
    setDirectorId(dept.director_user_id || "");
  }, [dept.hod_user_id, dept.director_user_id]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="font-bold text-slate-900">{dept.name}</div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-semibold text-slate-800">HOD</label>
          <select
            value={hodId}
            onChange={(e) => setHodId(e.target.value)}
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
            value={directorId}
            onChange={(e) => setDirectorId(e.target.value)}
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
        onClick={() => onSave(dept.id, hodId || null, directorId || null)}
        disabled={saving}
        className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
      >
        Save Department
      </button>
    </div>
  );
}