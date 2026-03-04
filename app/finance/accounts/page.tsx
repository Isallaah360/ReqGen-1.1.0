"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Acc = { id: string; code: string; name: string; is_active: boolean };
type UserRow = { id: string; email: string | null; role: string | null };

export default function AccountsAdminPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Acc[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedUser, setSelectedUser] = useState("");

  const accountOfficers = useMemo(
    () => users.filter((u) => (u.role || "") === "AccountOfficer" || (u.role || "") === "Admin" || (u.role || "") === "Auditor"),
    [users]
  );

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setMsg("Please login.");
        setLoading(false);
        return;
      }

      const { data: prof } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
      const role = (prof?.role || "") as string;
      if (!["Admin", "Auditor"].includes(role)) {
        setMsg("Not allowed.");
        setLoading(false);
        return;
      }

      const { data: a } = await supabase.from("iet_accounts").select("id,code,name,is_active").order("code");
      setAccounts((a || []) as any);

      const { data: u } = await supabase.from("profiles").select("id,email,role").order("email");
      setUsers((u || []) as any);

      setLoading(false);
    }
    load();
  }, []);

  async function refresh() {
    const { data: a } = await supabase.from("iet_accounts").select("id,code,name,is_active").order("code");
    setAccounts((a || []) as any);
  }

  async function createAccount() {
    setMsg(null);
    if (!code.trim() || !name.trim()) return setMsg("❌ Enter code and name.");
    const { error } = await supabase.from("iet_accounts").insert({ code: code.trim(), name: name.trim() });
    if (error) return setMsg("❌ " + error.message);
    setCode("");
    setName("");
    setMsg("✅ Account created.");
    await refresh();
  }

  async function assignAccountToOfficer() {
    setMsg(null);
    if (!selectedAccount || !selectedUser) return setMsg("❌ Select account and user.");

    const { error } = await supabase.from("account_officer_accounts").insert({
      account_id: selectedAccount,
      user_id: selectedUser,
    });

    if (error) return setMsg("❌ " + error.message);
    setMsg("✅ Assigned.");
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
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Accounts Setup</h1>
        <p className="mt-2 text-sm text-slate-600">Create IET accounts and assign to Accounting Officers.</p>

        {msg && <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">{msg}</div>}

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Create Account</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-semibold text-slate-800">Code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                placeholder="e.g. GENADMIN"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-800">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                placeholder="e.g. General Admin"
              />
            </div>
          </div>

          <button
            onClick={createAccount}
            className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Create
          </button>
        </div>

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Assign Account to Officer</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-800">Account</label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                <option value="">-- Select --</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Officer</label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                <option value="">-- Select --</option>
                {accountOfficers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email || u.id} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={assignAccountToOfficer}
            className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Assign
          </button>
        </div>
      </div>
    </main>
  );
}