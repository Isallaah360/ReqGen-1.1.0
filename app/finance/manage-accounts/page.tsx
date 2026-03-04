"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Acc = {
  id: string;
  name: string;
  code: string | null;
  bucket: string | null;
  created_at?: string | null;
};

export default function ManageAccountsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [myRole, setMyRole] = useState<string>("");

  const [rows, setRows] = useState<Acc[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [bucket, setBucket] = useState("GENERAL_ADMIN");

  const canManage = useMemo(() => ["Admin", "Auditor"].includes(myRole), [myRole]);

  async function loadAll() {
    setLoading(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .single();

    if (profErr) {
      setMsg("Failed to load role: " + profErr.message);
      setLoading(false);
      return;
    }

    const role = (prof?.role || "Staff") as string;
    setMyRole(role);

    if (!["Admin", "Auditor"].includes(role)) {
      router.push("/dashboard");
      return;
    }

    const { data, error } = await supabase
      .from("iet_accounts")
      .select("id,name,code,bucket,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setMsg("Failed to load accounts: " + error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data || []) as any);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function normCode(v: string) {
    return v
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  async function createAccount() {
    if (!canManage) return;
    if (name.trim().length < 3) {
      setMsg("❌ Account name is too short.");
      return;
    }

    const c = normCode(code || name);

    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase.from("iet_accounts").insert({
        name: name.trim(),
        code: c,
        bucket,
      });
      if (error) throw new Error(error.message);

      setName("");
      setCode("");
      setBucket("GENERAL_ADMIN");
      setMsg("✅ Account created.");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Create failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function removeAccount(id: string) {
    if (!canManage) return;
    const ok = confirm("Delete this account bucket?");
    if (!ok) return;

    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase.from("iet_accounts").delete().eq("id", id);
      if (error) throw new Error(error.message);

      setMsg("✅ Deleted.");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Delete failed: " + (e?.message || "Unknown error"));
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

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-5xl py-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Manage Accounts</h1>
            <p className="mt-2 text-sm text-slate-600">Create and manage IET account buckets (General Admin, DIN, ASAP-ALLI).</p>
          </div>

          <button
            onClick={() => router.push("/finance/reports")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Reports
          </button>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
            {msg}
          </div>
        )}

        {!canManage ? (
          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm text-slate-700">
            You don’t have permission to manage accounts.
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Create Account Bucket</h2>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-semibold text-slate-800">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500"
                  placeholder="e.g. DIN Account"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800">Code</label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500"
                  placeholder="e.g. DIN"
                />
                <div className="mt-1 text-xs text-slate-500">
                  If empty, code will be generated from name.
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800">Bucket</label>
                <select
                  value={bucket}
                  onChange={(e) => setBucket(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500"
                >
                  <option value="GENERAL_ADMIN">GENERAL_ADMIN</option>
                  <option value="DIN">DIN</option>
                  <option value="ASAP_ALLI">ASAP_ALLI</option>
                </select>
              </div>
            </div>

            <button
              onClick={createAccount}
              disabled={saving}
              className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Create Account"}
            </button>
          </div>
        )}

        {/* List */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-end justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900">Existing Buckets</h2>
            <button
              onClick={() => router.push("/finance/assign-account")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Assign to Officers
            </button>
          </div>

          {rows.length === 0 ? (
            <div className="mt-4 text-sm text-slate-700">No accounts yet.</div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-12 bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600">
                <div className="col-span-4">Name</div>
                <div className="col-span-3">Code</div>
                <div className="col-span-3">Bucket</div>
                <div className="col-span-2 text-right">Action</div>
              </div>

              {rows.map((a) => (
                <div key={a.id} className="grid grid-cols-12 border-t px-4 py-3 text-sm">
                  <div className="col-span-4 font-semibold text-slate-900">{a.name}</div>
                  <div className="col-span-3 text-slate-800">{a.code || "—"}</div>
                  <div className="col-span-3 text-slate-800">{a.bucket || "—"}</div>
                  <div className="col-span-2 text-right">
                    {canManage && (
                      <button
                        onClick={() => removeAccount(a.id)}
                        className="rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}