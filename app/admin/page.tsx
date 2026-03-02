"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type UserRow = { id: string; email: string | null; role?: string | null };
type DeptRow = {
  id: string;
  name: string;
  hod_user_id: string | null;
  director_user_id: string | null;
};
type SettingRow = { key: string; value: string };

export default function AdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [meEmail, setMeEmail] = useState<string>("");
  const [meRole, setMeRole] = useState<string>("");

  const [users, setUsers] = useState<UserRow[]>([]);
  const [depts, setDepts] = useState<DeptRow[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});

  // Role assignment section
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("Staff");
  const [savingRole, setSavingRole] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);

      // Auth check
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        router.push("/login");
        return;
      }

      setMeEmail(user.email || "");

      // ✅ Admin check (must be Admin)
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

      const role = me?.role || "Staff";
      setMeRole(role);

      if (role !== "Admin") {
        router.push("/dashboard");
        return;
      }

      // Users list from profiles (for dropdowns)
      const { data: profs, error: profErr } = await supabase
        .from("profiles")
        .select("id,email,role")
        .order("email", { ascending: true });

      if (profErr) setMsg("Failed to load users: " + profErr.message);
      else setUsers((profs || []) as UserRow[]);

      // Departments routing
      const { data: deptRows, error: deptErr } = await supabase
        .from("departments")
        .select("id,name,hod_user_id,director_user_id")
        .order("name", { ascending: true });

      if (deptErr) setMsg("Failed to load departments: " + deptErr.message);
      else setDepts((deptRows || []) as DeptRow[]);

      // Global settings
      const { data: setRows, error: setErr } = await supabase
        .from("app_settings")
        .select("key,value");

      if (!setErr && setRows) {
        const map: Record<string, string> = {};
        (setRows as SettingRow[]).forEach((r) => (map[r.key] = r.value));
        setSettings(map);
      }

      setLoading(false);
    }

    load();
  }, [router]);

  async function saveDept(deptId: string, hodId: string | null, dirId: string | null) {
    setMsg(null);

    const { error } = await supabase
      .from("departments")
      .update({ hod_user_id: hodId || null, director_user_id: dirId || null })
      .eq("id", deptId);

    if (error) setMsg("❌ Failed: " + error.message);
    else setMsg("✅ Department routing saved.");
  }

  async function saveSetting(key: string, value: string) {
    setMsg(null);

    const { error } = await supabase
      .from("app_settings")
      .upsert({ key, value: value || "" });

    if (error) setMsg("❌ Failed: " + error.message);
    else setMsg("✅ Setting saved.");
  }

  async function saveUserRole() {
    setMsg(null);

    if (!selectedUserId) {
      setMsg("❌ Please select a user.");
      return;
    }

    try {
      setSavingRole(true);

      const { error } = await supabase
        .from("profiles")
        .update({ role: selectedRole })
        .eq("id", selectedUserId);

      if (error) throw new Error(error.message);

      // refresh users list in UI
      setUsers((prev) =>
        prev.map((u) => (u.id === selectedUserId ? { ...u, role: selectedRole } : u))
      );

      setMsg("✅ Role updated successfully.");
    } catch (e: any) {
      setMsg("❌ Role update failed: " + (e?.message || "Unknown error"));
    } finally {
      setSavingRole(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-5xl py-10 text-slate-600">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-5xl py-10">
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

        {/* ✅ Role Assignment */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">User Role Assignment</h2>
          <p className="mt-1 text-sm text-slate-600">
            Set a user as Admin (full access) or Staff (normal). Officers can still be
            assigned via Global Officers/Departments.
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
                    {u.email || u.id} {u.role ? `(${u.role})` : ""}
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
                <option value="Staff">Staff</option>
                <option value="Admin">Admin</option>
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

        {/* ✅ Global Officers */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Global Officers</h2>
          <p className="mt-1 text-sm text-slate-600">
            Registry, DG, Account, HR roles are stored in <b>app_settings</b>.
          </p>

          {["REGISTRY_USER_ID", "DG_USER_ID", "ACCOUNT_USER_ID", "HR_USER_ID"].map((k) => (
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
                      {u.email || u.id}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => saveSetting(k, settings[k] || "")}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ✅ Department Routing */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Departments Routing</h2>

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
                          {u.email || u.id}
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
                            x.id === d.id ? { ...x, director_user_id: e.target.value || null } : x
                          )
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                    >
                      <option value="">-- None --</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.email || u.id}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => saveDept(d.id, d.hod_user_id, d.director_user_id)}
                  className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
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