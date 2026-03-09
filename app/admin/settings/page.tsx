"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
};

type SettingRow = { key: string; value: string };

const SETTING_KEYS = [
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

export default function AdminSettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [meRole, setMeRole] = useState("");

  const [users, setUsers] = useState<UserRow[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const canAdmin = useMemo(() => {
    const rk = roleKey(meRole);
    return rk === "admin" || rk === "auditor";
  }, [meRole]);

  async function loadAll() {
    setLoading(true);
    setMsg(null);

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: me, error: meErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (meErr) {
      setMsg("Failed to verify access: " + meErr.message);
      setLoading(false);
      return;
    }

    setMeRole((me?.role || "Staff") as string);

    if (!["admin", "auditor"].includes(roleKey((me?.role || "Staff") as string))) {
      router.push("/dashboard");
      return;
    }

    const [profsRes, settingsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,email,full_name,role")
        .order("full_name", { ascending: true }),
      supabase.from("app_settings").select("key,value"),
    ]);

    if (profsRes.error) setMsg("Failed to load users: " + profsRes.error.message);
    else setUsers((profsRes.data || []) as UserRow[]);

    if (settingsRes.error) setMsg("Failed to load settings: " + settingsRes.error.message);
    else {
      const map: Record<string, string> = {};
      (settingsRes.data || []).forEach((r: any) => {
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

  async function saveSetting(key: string, value: string) {
    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase.from("app_settings").upsert({
        key,
        value: value || "",
      });

      if (error) throw new Error(error.message);

      setMsg(`✅ ${key} saved successfully.`);
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-5xl py-10 text-slate-600">Loading...</div>
      </main>
    );
  }

  if (!canAdmin) return null;

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-5xl py-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Routing Settings
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Set the global routing officers for notifications and approvals.
            </p>
          </div>

          <button
            onClick={() => router.push("/admin")}
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

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          {SETTING_KEYS.map((k) => (
            <div key={k} className="mt-4 first:mt-0">
              <div className="text-sm font-semibold text-slate-800">{k}</div>
              <div className="mt-2 flex flex-col gap-2 md:flex-row">
                <select
                  value={settings[k] || ""}
                  onChange={(e) => setSettings((prev) => ({ ...prev, [k]: e.target.value }))}
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
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  Save
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}