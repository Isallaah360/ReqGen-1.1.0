"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

type IetAccount = {
  id: string;
  code: string | null;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function roleKey(role: string | null | undefined) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

export default function ManageAccountsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [myRole, setMyRole] = useState<string>("Staff");
  const canManage = useMemo(() => ["admin", "auditor"].includes(roleKey(myRole)), [myRole]);

  const [accounts, setAccounts] = useState<IetAccount[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);

  // Create/Edit Account
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  // Promote to Accounting Officer
  const [promoteUserId, setPromoteUserId] = useState<string>("");

  async function loadAll() {
    setLoading(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }

    // Role
    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle();

    setMyRole((prof?.role || "Staff") as string);

    if (!["admin", "auditor"].includes(roleKey(prof?.role))) {
      router.push("/dashboard");
      return;
    }

    // Accounts
    const { data: a, error: aErr } = await supabase
      .from("iet_accounts")
      .select("id,code,name,is_active,created_at,updated_at")
      .order("created_at", { ascending: false });

    if (aErr) {
      setMsg("Failed to load IET accounts: " + aErr.message);
      setAccounts([]);
    } else {
      setAccounts((a || []) as IetAccount[]);
    }

    // Users
    const { data: u, error: uErr } = await supabase
      .from("profiles")
      .select("id,full_name,email,role")
      .order("full_name", { ascending: true });

    if (uErr) {
      setMsg("Failed to load users: " + uErr.message);
      setUsers([]);
    } else {
      setUsers((u || []) as Profile[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function saveAccount() {
    if (!canManage) return;

    const c = code.trim().toUpperCase();
    const n = name.trim();

    if (!n) return setMsg("❌ Account name is required.");
    if (!c) return setMsg("❌ Account code is required (e.g. GENADMIN).");

    setSaving(true);
    setMsg(null);

    try {
      if (editId) {
        const { error } = await supabase
          .from("iet_accounts")
          .update({ code: c, name: n })
          .eq("id", editId);

        if (error) throw new Error(error.message);
        setMsg("✅ Account updated.");
      } else {
        const { error } = await supabase.from("iet_accounts").insert({
          code: c,
          name: n,
          is_active: true,
        });

        if (error) throw new Error(error.message);
        setMsg("✅ Account created.");
      }

      setCode("");
      setName("");
      setEditId(null);
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Save failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(a: IetAccount) {
    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase
        .from("iet_accounts")
        .update({ is_active: !a.is_active })
        .eq("id", a.id);

      if (error) throw new Error(error.message);
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Update failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount(id: string) {
    if (!confirm("Delete this IET Account bucket?")) return;

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

  async function promoteToAccountingOfficer() {
    if (!promoteUserId) return setMsg("❌ Select a user to promote.");

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: "AccountOfficer" })
        .eq("id", promoteUserId);

      if (error) throw new Error(error.message);

      setMsg("✅ User promoted to Accounting Officer.");
      setPromoteUserId("");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Promote failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  const accountingOfficers = useMemo(() => {
    return users.filter((u) => ["accountofficer", "accounts", "account"].includes(roleKey(u.role)));
  }, [users]);

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
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Accounts Setup</h1>
            <p className="mt-2 text-sm text-slate-600">
              Create IET Accounts and assign to Accounting Officers.
            </p>
          </div>

          <Link
            href="/finance/manage-accounts/assign"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Assign Accounts →
          </Link>
        </div>

        {msg && <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">{msg}</div>}

        {/* Create/Edit Account */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">{editId ? "Edit Account" : "Create Account"}</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-800">Code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                placeholder="e.g. GENADMIN"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                placeholder="e.g. General Admin"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={saveAccount}
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : editId ? "Update" : "Create"}
            </button>

            {editId && (
              <button
                onClick={() => {
                  setEditId(null);
                  setCode("");
                  setName("");
                }}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Promote Users to Accounting Officer */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Create Accounting Officers (from registered staff)</h2>
          <p className="mt-1 text-sm text-slate-600">
            Select any registered user and promote to <b>AccountOfficer</b>.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-3 items-end">
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-800">User</label>
              <select
                value={promoteUserId}
                onChange={(e) => setPromoteUserId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="">-- Select User --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(u.full_name || u.email || u.id) + (u.role ? ` • ${u.role}` : "")}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={promoteToAccountingOfficer}
              disabled={saving}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Working..." : "Promote"}
            </button>
          </div>

          <div className="mt-4 text-sm text-slate-700">
            Current Accounting Officers: <b>{accountingOfficers.length}</b>
          </div>
        </div>

        {/* Accounts Table */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">All IET Accounts</h2>

          {accounts.length === 0 ? (
            <div className="mt-4 text-sm text-slate-700">No accounts yet.</div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-12 bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600">
                <div className="col-span-2">Code</div>
                <div className="col-span-6">Name</div>
                <div className="col-span-2 text-center">Active</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              {accounts.map((a) => (
                <div key={a.id} className="grid grid-cols-12 border-t px-4 py-3 text-sm items-center">
                  <div className="col-span-2 font-bold text-slate-900">{a.code || "—"}</div>
                  <div className="col-span-6 text-slate-900">{a.name}</div>

                  <div className="col-span-2 text-center">
                    <span
                      className={`inline-flex rounded-lg border px-2 py-1 text-xs font-bold ${
                        a.is_active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-50 text-slate-700 border-slate-200"
                      }`}
                    >
                      {a.is_active ? "Yes" : "No"}
                    </span>
                  </div>

                  <div className="col-span-2 flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditId(a.id);
                        setCode(a.code || "");
                        setName(a.name || "");
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-900 hover:bg-slate-100"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => toggleActive(a)}
                      disabled={saving}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
                    >
                      {a.is_active ? "Disable" : "Enable"}
                    </button>

                    <button
                      onClick={() => deleteAccount(a.id)}
                      disabled={saving}
                      className="rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      Delete
                    </button>
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