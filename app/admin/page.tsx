"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type UserRow = { id: string; email: string };
type DeptRow = { id: string; name: string; hod_user_id: string | null; director_user_id: string | null };
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

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        router.push("/login");
        return;
      }

      // Users list from profiles
      const { data: profs, error: profErr } = await supabase
        .from("profiles")
        .select("id,email")
        .order("email", { ascending: true });

      if (profErr) setMsg("Failed to load users: " + profErr.message);
      else setUsers((profs || []) as UserRow[]);

      const { data: deptRows, error: deptErr } = await supabase
        .from("departments")
        .select("id,name,hod_user_id,director_user_id")
        .order("name", { ascending: true });

      if (deptErr) setMsg("Failed to load departments: " + deptErr.message);
      else setDepts((deptRows || []) as DeptRow[]);

      const { data: setRows, error: setErr } = await supabase.from("app_settings").select("key,value");

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
    const { error } = await supabase.from("app_settings").upsert({ key, value });
    if (error) setMsg("❌ Failed: " + error.message);
    else setMsg("✅ Setting saved.");
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
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Admin Panel</h1>
        <p className="mt-2 text-sm text-slate-600">
          Assign global officers, Directors, and HODs.
        </p>

        {msg && (
          <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
            {msg}
          </div>
        )}

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Global Officers</h2>
          <p className="mt-1 text-sm text-slate-600">Registry, DG, Account, HR roles are stored in app_settings.</p>

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
                      {u.email}
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
                          {u.email}
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
                          {u.email}
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