"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Me = { id: string; role: string; email: string | null };
type Account = { id: string; name: string; is_active: boolean };
type UserRow = { id: string; email: string | null; role: string | null };
type AssignRow = { id: string; account_id: string; user_id: string; created_at: string };

export default function FinanceAccountsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [me, setMe] = useState<Me | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [officers, setOfficers] = useState<UserRow[]>([]);
  const [assignments, setAssignments] = useState<AssignRow[]>([]);

  const [newAccountName, setNewAccountName] = useState("");

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedOfficerId, setSelectedOfficerId] = useState("");

  const isAuditorOrAdmin = useMemo(() => {
    const r = me?.role || "";
    return ["Admin", "Auditor"].includes(r);
  }, [me]);

  async function loadAll() {
    setLoading(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }

    const { data: myProf, error: meErr } = await supabase
      .from("profiles")
      .select("id,role,email")
      .eq("id", auth.user.id)
      .single();

    if (meErr) {
      setMsg("Failed to load profile: " + meErr.message);
      setLoading(false);
      return;
    }

    setMe(myProf as Me);

    // Load accounts
    const { data: a, error: aErr } = await supabase
      .from("iet_accounts")
      .select("id,name,is_active")
      .order("name", { ascending: true });

    if (aErr) setMsg("Failed to load accounts: " + aErr.message);
    setAccounts((a || []) as Account[]);

    // Load officers (AccountOfficer role)
    const { data: u, error: uErr } = await supabase
      .from("profiles")
      .select("id,email,role")
      .eq("role", "AccountOfficer")
      .order("email", { ascending: true });

    if (uErr) setMsg("Failed to load officers: " + uErr.message);
    setOfficers((u || []) as UserRow[]);

    // Load assignments
    const { data: asn, error: asnErr } = await supabase
      .from("account_officer_accounts")
      .select("id,account_id,user_id,created_at")
      .order("created_at", { ascending: false });

    if (asnErr) setMsg("Failed to load assignments: " + asnErr.message);
    setAssignments((asn || []) as AssignRow[]);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function createAccount() {
    setMsg(null);
    const name = newAccountName.trim();
    if (name.length < 2) return setMsg("❌ Account name is required.");

    try {
      const { error } = await supabase.from("iet_accounts").insert({
        name,
        is_active: true,
      });

      if (error) throw new Error(error.message);

      setNewAccountName("");
      setMsg("✅ Account created.");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Create failed: " + (e?.message || "Unknown error"));
    }
  }

  async function toggleActive(a: Account) {
    setMsg(null);
    try {
      const { error } = await supabase
        .from("iet_accounts")
        .update({ is_active: !a.is_active })
        .eq("id", a.id);

      if (error) throw new Error(error.message);
      setMsg("✅ Updated.");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Update failed: " + (e?.message || "Unknown error"));
    }
  }

  async function assign() {
    setMsg(null);
    if (!selectedAccountId) return setMsg("❌ Select account.");
    if (!selectedOfficerId) return setMsg("❌ Select officer.");

    try {
      const { error } = await supabase.from("account_officer_accounts").insert({
        account_id: selectedAccountId,
        user_id: selectedOfficerId,
      });

      if (error) throw new Error(error.message);

      setMsg("✅ Assigned.");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Assign failed: " + (e?.message || "Unknown error"));
    }
  }

  async function removeAssignment(id: string) {
    setMsg(null);
    try {
      const { error } = await supabase
        .from("account_officer_accounts")
        .delete()
        .eq("id", id);

      if (error) throw new Error(error.message);

      setMsg("✅ Removed.");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Remove failed: " + (e?.message || "Unknown error"));
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-5xl py-10 text-slate-600">Loading...</div>
      </main>
    );
  }

  if (!isAuditorOrAdmin) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-5xl py-10">
          <div className="rounded-2xl border bg-white p-6 shadow-sm text-slate-700">
            Only Auditor/Admin can manage accounts.
          </div>
        </div>
      </main>
    );
  }

  const accountName = (id: string) => accounts.find((x) => x.id === id)?.name || id;
  const userEmail = (id: string) => officers.find((x) => x.id === id)?.email || id;

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-5xl py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Finance — Accounts
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Create IET account buckets and assign them to accounting officers.
            </p>
          </div>

          <button
            onClick={() => router.push("/finance/subheads")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Back to Subheads
          </button>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
            {msg}
          </div>
        )}

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Create Account</h2>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              placeholder="e.g. General Admin, DIN, ASAP-ALLI"
            />
            <button
              onClick={createAccount}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Create
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Assign Account to Officer</h2>
          <p className="mt-1 text-sm text-slate-600">
            Officers are users with role <b>AccountOfficer</b> in profiles.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-sm font-semibold text-slate-800">Account</label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="">-- Select --</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {a.is_active ? "" : "(Inactive)"}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-800">Officer</label>
              <select
                value={selectedOfficerId}
                onChange={(e) => setSelectedOfficerId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="">-- Select --</option>
                {officers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.email || o.id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={assign}
            className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Assign
          </button>
        </div>

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Accounts List</h2>

          {accounts.length === 0 ? (
            <div className="mt-3 text-sm text-slate-700">No accounts yet.</div>
          ) : (
            <div className="mt-4 space-y-3">
              {accounts.map((a) => (
                <div key={a.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-bold text-slate-900">{a.name}</div>

                    <button
                      onClick={() => toggleActive(a)}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold text-white ${
                        a.is_active ? "bg-slate-700 hover:bg-slate-800" : "bg-blue-600 hover:bg-blue-700"
                      }`}
                    >
                      {a.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>

                  <div className="mt-3 text-xs text-slate-500">
                    Account ID: {a.id}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Assignments</h2>

          {assignments.length === 0 ? (
            <div className="mt-3 text-sm text-slate-700">No assignments yet.</div>
          ) : (
            <div className="mt-4 space-y-3">
              {assignments.map((x) => (
                <div key={x.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-slate-900">
                      <b>{accountName(x.account_id)}</b> → {userEmail(x.user_id)}
                    </div>
                    <button
                      onClick={() => removeAssignment(x.id)}
                      className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {new Date(x.created_at).toLocaleString()}
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