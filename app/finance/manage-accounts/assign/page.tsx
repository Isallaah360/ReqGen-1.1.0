"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

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
  is_active: boolean | null;
};

type AssignmentRow = {
  id: string;
  officer_user_id: string;
  account_id: string;
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

export default function AssignAccountToOfficerPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [myRole, setMyRole] = useState<string>("Staff");
  const canManage = useMemo(() => ["admin", "auditor"].includes(roleKey(myRole)), [myRole]);

  const [officers, setOfficers] = useState<Profile[]>([]);
  const [accounts, setAccounts] = useState<IetAccount[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);

  // form
  const [selectedOfficerId, setSelectedOfficerId] = useState<string>("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  const officerMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    officers.forEach((o) => (m[o.id] = o));
    return m;
  }, [officers]);

  const accountMap = useMemo(() => {
    const m: Record<string, IetAccount> = {};
    accounts.forEach((a) => (m[a.id] = a));
    return m;
  }, [accounts]);

  async function loadAll() {
    setLoading(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }

    // my role
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (profErr) {
      setMsg("Failed to load your role: " + profErr.message);
      setLoading(false);
      return;
    }

    const r = (prof?.role || "Staff") as string;
    setMyRole(r);

    if (!["admin", "auditor"].includes(roleKey(r))) {
      router.push("/dashboard");
      return;
    }

    // officers list: AccountOfficer (and allow also Accounts/account)
    const { data: p, error: pErr } = await supabase
      .from("profiles")
      .select("id,full_name,email,role")
      .order("full_name", { ascending: true });

    if (pErr) {
      setMsg("Failed to load officers: " + pErr.message);
      setOfficers([]);
    } else {
      const list = ((p || []) as Profile[]).filter((x) => {
        const rk = roleKey(x.role);
        return ["accountofficer", "accounts", "account"].includes(rk);
      });
      setOfficers(list);
    }

    // accounts list
    const { data: a, error: aErr } = await supabase
      .from("iet_accounts")
      .select("id,code,name,is_active")
      .order("name", { ascending: true });

    if (aErr) {
      setMsg("Failed to load IET accounts: " + aErr.message);
      setAccounts([]);
    } else {
      setAccounts((a || []) as IetAccount[]);
    }

    // assignments list
    const { data: asg, error: asgErr } = await supabase
      .from("iet_account_officers")
      .select("id,officer_user_id,account_id,is_active,created_at,updated_at")
      .order("created_at", { ascending: false });

    if (asgErr) {
      setMsg("Failed to load assignments: " + asgErr.message);
      setAssignments([]);
    } else {
      setAssignments((asg || []) as AssignmentRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function assign() {
    if (!canManage) return;

    if (!selectedOfficerId) {
      setMsg("❌ Please select an Accounting Officer.");
      return;
    }
    if (!selectedAccountId) {
      setMsg("❌ Please select an Account Bucket.");
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase.from("iet_account_officers").upsert({
        officer_user_id: selectedOfficerId,
        account_id: selectedAccountId,
        is_active: true,
      });

      if (error) throw new Error(error.message);

      setMsg("✅ Assigned successfully.");
      setSelectedAccountId("");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Assign failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: AssignmentRow) {
    if (!canManage) return;

    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase
        .from("iet_account_officers")
        .update({ is_active: !row.is_active })
        .eq("id", row.id);

      if (error) throw new Error(error.message);

      await loadAll();
    } catch (e: any) {
      setMsg("❌ Update failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: AssignmentRow) {
    if (!canManage) return;

    const ok = confirm("Remove this assignment?");
    if (!ok) return;

    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase.from("iet_account_officers").delete().eq("id", row.id);
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Finance • Assign Accounts to Officers
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Admin/Auditor can assign IET Account buckets to Accounting Officers.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => router.push("/finance/manage-accounts")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Back
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
            {msg}
          </div>
        )}

        {!canManage ? (
          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm text-slate-700">
            You don’t have permission to assign accounts.
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">New Assignment</h2>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-semibold text-slate-800">Accounting Officer</label>
                <select
                  value={selectedOfficerId}
                  onChange={(e) => setSelectedOfficerId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="">-- Select Officer --</option>
                  {officers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {(o.full_name || o.email || o.id) + (o.role ? ` (${o.role})` : "")}
                    </option>
                  ))}
                </select>
                {officers.length === 0 && (
                  <div className="mt-2 text-xs text-red-600">
                    No Accounting Officers found. Make sure their profiles.role is "AccountOfficer".
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800">Account Bucket</label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="">-- Select Account --</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {(a.code ? `${a.code} — ` : "") + a.name + (a.is_active === false ? " (Inactive)" : "")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={assign}
                  disabled={saving}
                  className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Assign"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Current Assignments</h2>

          {assignments.length === 0 ? (
            <div className="mt-4 text-sm text-slate-700">No assignments yet.</div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-12 bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600">
                <div className="col-span-4">Officer</div>
                <div className="col-span-5">Account</div>
                <div className="col-span-1 text-center">Active</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              {assignments.map((row) => {
                const o = officerMap[row.officer_user_id];
                const a = accountMap[row.account_id];
                return (
                  <div key={row.id} className="grid grid-cols-12 border-t px-4 py-3 text-sm items-center">
                    <div className="col-span-4 font-semibold text-slate-900">
                      {o?.full_name || o?.email || row.officer_user_id}
                    </div>
                    <div className="col-span-5 text-slate-900">
                      {a ? `${a.code ? a.code + " — " : ""}${a.name}` : row.account_id}
                    </div>
                    <div className="col-span-1 text-center">
                      <span className={`inline-flex rounded-lg border px-2 py-1 text-xs font-bold ${
                        row.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-700 border-slate-200"
                      }`}>
                        {row.is_active ? "Yes" : "No"}
                      </span>
                    </div>

                    <div className="col-span-2 flex justify-end gap-2">
                      <button
                        onClick={() => toggleActive(row)}
                        disabled={saving}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
                      >
                        {row.is_active ? "Disable" : "Enable"}
                      </button>

                      <button
                        onClick={() => remove(row)}
                        disabled={saving}
                        className="rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
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
            Tip: If officers list is empty, ensure their <b>profiles.role</b> is exactly <b>AccountOfficer</b>.
          </div>
        </div>
      </div>
    </main>
  );
}