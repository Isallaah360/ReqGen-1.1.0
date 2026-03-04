"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Acc = { id: string; name: string; code: string | null; bucket: string | null };
type UserMini = { id: string; full_name: string | null; role: string | null; email: string | null };

export default function AssignAccountToOfficerPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [myRole, setMyRole] = useState<string>("");

  const [accounts, setAccounts] = useState<Acc[]>([]);
  const [officers, setOfficers] = useState<UserMini[]>([]);

  const [accountId, setAccountId] = useState<string>("");
  const [officerId, setOfficerId] = useState<string>("");

  const canAssign = useMemo(() => ["Admin", "Auditor"].includes(myRole), [myRole]);

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

    // Accounts (must exist now)
    const { data: a, error: aErr } = await supabase
      .from("iet_accounts")
      .select("id,name,code,bucket")
      .order("name", { ascending: true });

    if (aErr) {
      setMsg("Failed to load accounts: " + aErr.message);
      setAccounts([]);
    } else {
      const list = (a || []) as any;
      setAccounts(list);
      if (!accountId && list.length) setAccountId(list[0].id);
    }

    // Officers: load ALL profiles that are AccountOfficer role
    // ✅ This fixes your dropdown showing only you + Patricia.
    const { data: u, error: uErr } = await supabase
      .from("profiles")
      .select("id,full_name,role,email")
      .in("role", ["AccountOfficer", "Accounts", "Account"]) // tolerant
      .order("full_name", { ascending: true });

    if (uErr) {
      setMsg((x) => (x ? x + " | " : "") + "Failed to load officers: " + uErr.message);
      setOfficers([]);
    } else {
      const list = (u || []) as any;
      setOfficers(list);
      if (!officerId && list.length) setOfficerId(list[0].id);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function assign() {
    if (!canAssign) return;
    if (!accountId || !officerId) {
      setMsg("❌ Pick account + officer.");
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase.from("iet_account_officers").insert({
        account_id: accountId,
        officer_id: officerId,
      });
      if (error) throw new Error(error.message);

      setMsg("✅ Assigned successfully.");
    } catch (e: any) {
      setMsg("❌ Assign failed: " + (e?.message || "Unknown error"));
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

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-4xl py-10">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Assign Account to Officer</h1>
            <p className="mt-2 text-sm text-slate-600">
              Link each IET account bucket to the correct Accounting Officer.
            </p>
          </div>

          <button
            onClick={() => router.push("/finance/manage-accounts")}
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

        {!canAssign ? (
          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm text-slate-700">
            You don’t have permission to assign accounts.
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-slate-800">Account Bucket</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {(a.code || a.bucket || "ACC") + " — " + a.name}
                    </option>
                  ))}
                </select>
                {accounts.length === 0 && (
                  <div className="mt-2 text-xs text-red-600">
                    No accounts found. Create buckets first in Manage Accounts.
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800">Accounting Officer</label>
                <select
                  value={officerId}
                  onChange={(e) => setOfficerId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-500"
                >
                  {officers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {(u.full_name || u.email || "Officer") + " (" + (u.role || "Staff") + ")"}
                    </option>
                  ))}
                </select>
                {officers.length === 0 && (
                  <div className="mt-2 text-xs text-red-600">
                    No Account Officers found. Set their role to AccountOfficer in profiles.
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={assign}
              disabled={saving || accounts.length === 0 || officers.length === 0}
              className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Assigning..." : "Assign"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}