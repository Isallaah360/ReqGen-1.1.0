"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
};

type Account = {
  id: string;
  code: string | null;
  name: string;
  bank_name: string | null;
  account_number: string | null;
  is_active: boolean | null;
};

type AssignmentRow = {
  id: string;
  account_id: string;
  officer_user_id: string;
  created_at: string;
};

function roleKey(role: string) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

export default function AssignAccountOfficerPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [myRole, setMyRole] = useState<string>("");

  const canManage = useMemo(() => {
    const rk = roleKey(myRole);
    return rk === "admin" || rk === "auditor";
  }, [myRole]);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [officers, setOfficers] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);

  const [accountId, setAccountId] = useState<string>("");
  const [officerId, setOfficerId] = useState<string>("");

  const accountMap = useMemo(() => {
    const m: Record<string, Account> = {};
    accounts.forEach((a) => (m[a.id] = a));
    return m;
  }, [accounts]);

  const officerMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    officers.forEach((o) => (m[o.id] = o));
    return m;
  }, [officers]);

  async function loadAll() {
    setLoading(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }

    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (pErr) {
      setMsg("Failed to load role: " + pErr.message);
      setLoading(false);
      return;
    }

    const role = (prof?.role || "Staff") as string;
    setMyRole(role);

    if (!["admin", "auditor"].includes(roleKey(role))) {
      router.push("/dashboard");
      return;
    }

    // accounts (active first)
    const { data: arows, error: aErr } = await supabase
      .from("iet_accounts")
      .select("id,code,name,bank_name,account_number,is_active")
      .order("is_active", { ascending: false })
      .order("name", { ascending: true });

    if (aErr) {
      setMsg("Failed to load accounts: " + aErr.message);
      setAccounts([]);
    } else {
      setAccounts((arows || []) as Account[]);
    }

    // officers (role = AccountOfficer)
    const { data: orows, error: oErr } = await supabase
      .from("profiles")
      .select("id,full_name,email,role")
      .eq("role", "AccountOfficer")
      .order("full_name", { ascending: true });

    if (oErr) {
      setMsg("Failed to load officers: " + oErr.message);
      setOfficers([]);
    } else {
      setOfficers((orows || []) as Profile[]);
    }

    // assignments
    const { data: asn, error: asnErr } = await supabase
      .from("iet_account_officer_assignments")
      .select("id,account_id,officer_user_id,created_at")
      .order("created_at", { ascending: false });

    if (asnErr) {
      setMsg("Failed to load assignments: " + asnErr.message);
      setAssignments([]);
    } else {
      setAssignments((asn || []) as AssignmentRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function assign() {
    if (!canManage) return;

    if (!accountId) {
      setMsg("❌ Please select an account.");
      return;
    }
    if (!officerId) {
      setMsg("❌ Please select an officer.");
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      // ✅ 1 officer per bank = upsert using UNIQUE(account_id)
      const { error } = await supabase
        .from("iet_account_officer_assignments")
        .upsert(
          {
            account_id: accountId,
            officer_user_id: officerId,
          } as any,
          { onConflict: "account_id" }
        );

      if (error) throw new Error(error.message);

      setMsg("✅ Assigned successfully.");
      setAccountId("");
      setOfficerId("");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Assign failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignment(id: string) {
    if (!canManage) return;

    const ok = confirm("Remove this assignment?");
    if (!ok) return;

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase
        .from("iet_account_officer_assignments")
        .delete()
        .eq("id", id);

      if (error) throw new Error(error.message);
      setMsg("✅ Removed.");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Remove failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Assign Bank Account to Accounting Officer
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Rule: <b>1 officer per bank account</b>. Officers are users with role <b>AccountOfficer</b>.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/finance/manage-accounts"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              ← Back to Manage Accounts
            </Link>

            <Link
              href="/finance"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Back to Finance
            </Link>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
            {msg}
          </div>
        )}

        {/* ASSIGN FORM */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Assign</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-800">Account</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="">-- Select --</option>
                {accounts
                  .filter((a) => a.is_active !== false)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {(a.code ? `${a.code} — ` : "") + a.name} ({a.bank_name || "Bank"} {a.account_number || ""})
                    </option>
                  ))}
              </select>
              <div className="mt-1 text-xs text-slate-500">
                Only active accounts are shown.
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Officer</label>
              <select
                value={officerId}
                onChange={(e) => setOfficerId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="">-- Select --</option>
                {officers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {(o.full_name || o.email || o.id) + " (AccountOfficer)"}
                  </option>
                ))}
              </select>
              {officers.length === 0 && (
                <div className="mt-2 text-xs text-red-600">
                  No AccountOfficer users found. Set users role to <b>AccountOfficer</b> in Admin.
                </div>
              )}
            </div>
          </div>

          <div className="mt-5">
            <button
              onClick={assign}
              disabled={saving}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Working..." : "Assign Officer"}
            </button>
          </div>
        </div>

        {/* ASSIGNMENTS TABLE */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Current Assignments</h2>

          {assignments.length === 0 ? (
            <div className="mt-4 text-sm text-slate-700">No assignments yet.</div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-12 bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600">
                <div className="col-span-5">Bank Account</div>
                <div className="col-span-5">Officer</div>
                <div className="col-span-2 text-right">Action</div>
              </div>

              {assignments.map((x) => {
                const a = accountMap[x.account_id];
                const o = officerMap[x.officer_user_id];
                return (
                  <div key={x.id} className="grid grid-cols-12 border-t px-4 py-3 text-sm">
                    <div className="col-span-5 text-slate-900">
                      {a
                        ? `${a.code ? a.code + " — " : ""}${a.name} (${a.bank_name || "Bank"} ${a.account_number || ""})`
                        : x.account_id}
                    </div>

                    <div className="col-span-5 text-slate-800">
                      {o ? o.full_name || o.email || o.id : x.officer_user_id}
                    </div>

                    <div className="col-span-2 flex justify-end">
                      <button
                        onClick={() => removeAssignment(x.id)}
                        disabled={saving}
                        className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 text-xs text-slate-500">
            If assignment upsert fails, your DB must have <b>UNIQUE(account_id)</b> on the assignments table.
          </div>
        </div>
      </div>
    </main>
  );
}