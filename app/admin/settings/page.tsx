"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Profile = { id: string; full_name: string | null; role: string | null };
type SettingKey =
  | "HOD_USER_ID"
  | "DIRECTOR_USER_ID"
  | "REGISTRY_USER_ID"
  | "DG_USER_ID"
  | "HR_USER_ID"
  | "ACCOUNT_USER_ID";

type Row = { key: SettingKey; value: string | null };

function roleKey(role: string) {
  return (role || "").trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "");
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [meRole, setMeRole] = useState<string>("Staff");
  const [users, setUsers] = useState<Profile[]>([]);
  const [rows, setRows] = useState<Row[]>([
    { key: "HOD_USER_ID", value: null },
    { key: "DIRECTOR_USER_ID", value: null },
    { key: "REGISTRY_USER_ID", value: null },
    { key: "DG_USER_ID", value: null },
    { key: "HR_USER_ID", value: null },
    { key: "ACCOUNT_USER_ID", value: null },
  ]);

  const canAdmin = useMemo(() => ["admin", "auditor"].includes(roleKey(meRole)), [meRole]);

  async function load() {
    setLoading(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }

    // role
    const { data: prof } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
    const r = (prof?.role || "Staff") as string;
    setMeRole(r);

    if (!["admin", "auditor"].includes(roleKey(r))) {
      router.push("/dashboard");
      return;
    }

    // users
    const { data: u } = await supabase.from("profiles").select("id,full_name,role").order("full_name");
    setUsers((u || []) as any);

    // settings
    const keys = rows.map((x) => x.key);
    const { data: s, error } = await supabase.from("app_settings").select("key,value").in("key", keys);
    if (error) {
      setMsg("Failed to load settings: " + error.message);
    } else {
      const map: Record<string, string | null> = {};
      (s || []).forEach((x: any) => (map[x.key] = x.value));
      setRows((prev) => prev.map((p) => ({ ...p, value: map[p.key] ?? null })));
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveKey(key: SettingKey, value: string | null) {
    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase.from("app_settings").upsert({ key, value });
      if (error) throw new Error(error.message);
      setMsg("✅ Saved " + key);
      await load();
    } catch (e: any) {
      setMsg("❌ Save failed: " + (e?.message || "Unknown"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-4xl py-10 text-slate-600">Loading...</div>
      </main>
    );
  }

  if (!canAdmin) return null;

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-4xl py-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">System Routing Settings</h1>
            <p className="mt-2 text-sm text-slate-600">
              Set who receives requests at each stage (HOD, Director, Registry, DG, HR, Account).
            </p>
          </div>

          <button
            onClick={() => router.push("/admin")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            ← Back
          </button>
        </div>

        {msg && <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">{msg}</div>}

        <div className="mt-6 space-y-4">
          {rows.map((r) => (
            <div key={r.key} className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-sm font-bold text-slate-900">{r.key}</div>

              <div className="mt-3 grid gap-3 md:grid-cols-3 items-end">
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-600">Select User</label>
                  <select
                    value={r.value || ""}
                    onChange={(e) => {
                      const v = e.target.value || null;
                      setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, value: v } : x)));
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                  >
                    <option value="">-- Select --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {(u.full_name || "Unnamed") + " • " + (u.role || "Staff")}
                      </option>
                    ))}
                  </select>

                  <div className="mt-2 text-xs text-slate-500">
                    Current: <b>{r.value || "Not set"}</b>
                  </div>
                </div>

                <button
                  disabled={saving}
                  onClick={() => saveKey(r.key, r.value)}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 text-xs text-slate-500">
          After setting <b>HOD_USER_ID</b>, new requests will submit successfully.
        </div>
      </div>
    </main>
  );
}