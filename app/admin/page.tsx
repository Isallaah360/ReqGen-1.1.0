"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type UserRow = { id: string; email: string };
type DeptRow = {
  id: string;
  name: string;
  hod_user_id: string | null;
  director_user_id: string | null;
};
type SettingRow = { key: string; value: string };

export default function AdminPage() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [depts, setDepts] = useState<DeptRow[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);

      // 1) Must be logged in
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        router.push("/login");
        return;
      }

      // 2) Must be admin
      const { data: me, error: meErr } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (meErr) {
        setMsg("Failed to confirm admin: " + meErr.message);
        setLoading(false);
        return;
      }

      if (!me?.is_admin) {
        router.push("/dashboard");
        return;
      }

      // 3) Load users from profiles
      const { data: profs, error: profErr } = await supabase
        .from("profiles")
        .select("id,email")
        .order("email", { ascending: true });

      if (profErr) {
        setMsg("Failed to load users: " + profErr.message);
      } else {
        setUsers((profs || []) as UserRow[]);
      }

      // 4) Load departments
      const { data: deptRows, error: deptErr } = await supabase
        .from("departments")
        .select("id,name,hod_user_id,director_user_id")
        .order("name", { ascending: true });

      if (deptErr) {
        setMsg("Failed to load departments: " + deptErr.message);
      } else {
        setDepts((deptRows || []) as DeptRow[]);
      }

      // 5) Load global settings
      const { data: setRows, error: setErr } = await supabase
        .from("app_settings")
        .select("key,value");

      if (setErr) {
        setMsg("Failed to load app settings: " + setErr.message);
      } else if (setRows) {
        const map: Record<string, string> = {};
        (setRows as SettingRow[]).forEach((r) => (map[r.key] = r.value));
        setSettings(map);
      }

      setLoading(false);
    }

    load();
  }, [router]);

  async function saveDept(
    deptId: string,
    hodId: string | null,
    dirId: string | null
  ) {
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

    const { error } = await supabase.from("app_settings").upsert({ key, value });

    if (error) setMsg("❌ Failed: " + error.message);
    else setMsg("✅ Setting saved.");
  }

  if (loading) return <p className="text-gray-600">Loading...</p>;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
      <p className="mt-2 text-sm text-gray-600">
        Assign HODs, Directors, and global officers.
      </p>

      {msg && (
        <div className="mt-4 rounded-xl bg-gray-100 px-3 py-2 text-sm">
          {msg}
        </div>
      )}

      <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">Global Officers</h2>

        {["REGISTRY_USER_ID", "DG_USER_ID", "ACCOUNT_USER_ID", "HR_USER_ID"].map(
          (k) => (
            <div key={k} className="mt-4">
              <div className="text-sm font-medium">{k}</div>
              <div className="mt-1 flex gap-2">
                <select
                  value={settings[k] || ""}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, [k]: e.target.value }))
                  }
                  className="w-full rounded-xl border px-3 py-2"
                >
                  <option value="">-- Select user --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => saveSetting(k, settings[k] || "")}
                  className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                >
                  Save
                </button>
              </div>
            </div>
          )
        )}
      </div>

      <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">Departments Routing</h2>

        <div className="mt-4 space-y-4">
          {depts.map((d) => (
            <div key={d.id} className="rounded-xl border p-4">
              <div className="font-semibold">{d.name}</div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">HOD</label>
                  <select
                    value={d.hod_user_id || ""}
                    onChange={(e) =>
                      setDepts((prev) =>
                        prev.map((x) =>
                          x.id === d.id
                            ? { ...x, hod_user_id: e.target.value || null }
                            : x
                        )
                      )
                    }
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                  >
                    <option value="">-- None --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Director</label>
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
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                  >
                    <option value="">-- None --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={() =>
                  saveDept(d.id, d.hod_user_id, d.director_user_id)
                }
                className="mt-3 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                Save Department
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}