"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type IetAccount = {
  id: string;
  code: string | null;
  name: string;
  bank_name: string | null;
  account_number: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type Profile = { id: string; full_name: string | null; role: string | null };

type Assignment = { id: string; account_id: string; officer_user_id: string; created_at: string };

function roleKey(role: string) {
  return (role || "").trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "");
}

export default function ManageAccountsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [myRole, setMyRole] = useState("staff");
  const rk = roleKey(myRole);
  const canManage = rk === "admin" || rk === "auditor";

  const [accounts, setAccounts] = useState<IetAccount[]>([]);
  const [officers, setOfficers] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // form
  const [editId, setEditId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [acctNo, setAcctNo] = useState("");
  const [active, setActive] = useState(true);

  // assign form
  const [assignAccountId, setAssignAccountId] = useState("");
  const [assignOfficerId, setAssignOfficerId] = useState("");

  async function load() {
    setLoading(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return router.push("/login");

    const { data: prof } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
    setMyRole((prof?.role || "Staff") as string);

    // Accounts
    const { data: arows, error: aErr } = await supabase
      .from("iet_accounts")
      .select("id,code,name,bank_name,account_number,is_active,created_at,updated_at")
      .order("name");

    if (aErr) setMsg(aErr.message);
    setAccounts((arows || []) as any);

    // Officers list (from profiles)
    const { data: prows, error: pErr } = await supabase
      .from("profiles")
      .select("id,full_name,role")
      .order("full_name", { ascending: true });

    if (pErr) setMsg((x) => (x ? x + " | " : "") + pErr.message);

    const allUsers = (prows || []) as Profile[];
    const offs = allUsers.filter((u) => {
      const k = roleKey(u.role || "");
      return k.includes("accountofficer") || k === "account" || k === "accounts" || k.includes("accountant");
    });
    setOfficers(offs);

    // Assignments
    const { data: asg, error: asgErr } = await supabase
      .from("iet_account_assignments")
      .select("id,account_id,officer_user_id,created_at")
      .order("created_at", { ascending: false });

    if (asgErr) setMsg((x) => (x ? x + " | " : "") + asgErr.message);
    setAssignments((asg || []) as any);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setEditId(null);
    setCode("");
    setName("");
    setBank("");
    setAcctNo("");
    setActive(true);
  }

  async function saveAccount() {
    if (!canManage) return setMsg("Not allowed.");
    if (name.trim().length < 2) return setMsg("Name too short.");

    setSaving(true);
    setMsg(null);

    const payload: any = {
      code: code.trim() || null,
      name: name.trim(),
      bank_name: bank.trim() || null,
      account_number: acctNo.trim() || null,
      is_active: active,
    };

    try {
      if (!editId) {
        const { error } = await supabase.from("iet_accounts").insert(payload);
        if (error) throw new Error(error.message);
        setMsg("✅ Account created.");
      } else {
        const { error } = await supabase.from("iet_accounts").update(payload).eq("id", editId);
        if (error) throw new Error(error.message);
        setMsg("✅ Account updated.");
      }
      resetForm();
      await load();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Failed"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount(id: string) {
    if (!canManage) return setMsg("Not allowed.");
    if (!confirm("Delete this IET account?")) return;

    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase.from("iet_accounts").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setMsg("✅ Deleted.");
      await load();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Failed"));
    } finally {
      setSaving(false);
    }
  }

  async function assign() {
    if (!canManage) return setMsg("Not allowed.");
    if (!assignAccountId || !assignOfficerId) return setMsg("Select account and officer.");

    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase.from("iet_account_assignments").insert({
        account_id: assignAccountId,
        officer_user_id: assignOfficerId,
      });
      if (error) throw new Error(error.message);
      setMsg("✅ Assigned.");
      setAssignAccountId("");
      setAssignOfficerId("");
      await load();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Failed"));
    } finally {
      setSaving(false);
    }
  }

  async function unassign(id: string) {
    if (!canManage) return setMsg("Not allowed.");
    if (!confirm("Remove this assignment?")) return;

    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase.from("iet_account_assignments").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setMsg("✅ Removed.");
      await load();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Failed"));
    } finally {
      setSaving(false);
    }
  }

  const accountMap = useMemo(() => {
    const m: Record<string, IetAccount> = {};
    accounts.forEach((a) => (m[a.id] = a));
    return m;
  }, [accounts]);

  const officerMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    officers.forEach((o) => (m[o.id] = o));
    return m;
  }, [officers]);

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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Manage Accounts</h1>
            <p className="mt-2 text-sm text-slate-600">
              Create IET bank accounts and assign them to Accounting Officers.
            </p>
          </div>

          <button
            onClick={() => router.push("/finance")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            ← Back to Finance
          </button>
        </div>

        {msg && <div className="mt-4 rounded-xl bg-white border px-4 py-3 text-sm text-slate-800">{msg}</div>}

        {/* Create/Edit */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-lg font-bold text-slate-900">{editId ? "Edit Account" : "Create Account"}</div>

          {!canManage && (
            <div className="mt-3 rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
              View only (Admin/Auditor can edit).
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div>
              <label className="text-sm font-semibold text-slate-800">Code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={!canManage}
                placeholder="e.g. GENADMIN"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-800">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canManage}
                placeholder="e.g. General Admin"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>

            <div className="flex items-end gap-3">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  disabled={!canManage}
                />
                Active
              </label>

              <button
                onClick={saveAccount}
                disabled={!canManage || saving}
                className="ml-auto rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : editId ? "Update" : "Create"}
              </button>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-800">Bank</label>
              <input
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                disabled={!canManage}
                placeholder="e.g. Jaiz Bank"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-800">Account Number</label>
              <input
                value={acctNo}
                onChange={(e) => setAcctNo(e.target.value)}
                disabled={!canManage}
                placeholder="e.g. 0123456789"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
          </div>

          {editId && (
            <button onClick={resetForm} className="mt-3 text-sm font-semibold text-slate-700 hover:underline">
              Cancel edit
            </button>
          )}
        </div>

        {/* Assign */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-lg font-bold text-slate-900">Assign Account to Officer</div>
          <p className="mt-1 text-sm text-slate-600">
            Officers are fetched from users whose role contains “Account Officer/Accounts/Accountant”.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-sm font-semibold text-slate-800">Account</label>
              <select
                value={assignAccountId}
                onChange={(e) => setAssignAccountId(e.target.value)}
                disabled={!canManage}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                <option value="">— Select —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {(a.code ? a.code + " — " : "") + a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Officer</label>
              <select
                value={assignOfficerId}
                onChange={(e) => setAssignOfficerId(e.target.value)}
                disabled={!canManage}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                <option value="">— Select —</option>
                {officers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.full_name || o.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={assign}
                disabled={!canManage || saving}
                className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? "Working..." : "Assign"}
              </button>
            </div>
          </div>

          {officers.length === 0 && (
            <div className="mt-4 rounded-xl border bg-yellow-50 p-4 text-sm text-yellow-800">
              No Accounting Officers found. Assign some users a role like “Account Officer”.
              (We’ll add Admin Users page next.)
            </div>
          )}
        </div>

        {/* Accounts list */}
        <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="grid grid-cols-12 bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600">
            <div className="col-span-3">Account</div>
            <div className="col-span-3">Bank / No</div>
            <div className="col-span-4">Assignments</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {accounts.length === 0 ? (
            <div className="p-4 text-sm text-slate-700">No accounts yet.</div>
          ) : (
            accounts.map((a) => {
              const asg = assignments.filter((x) => x.account_id === a.id);
              return (
                <div key={a.id} className="grid grid-cols-12 border-t px-4 py-3 text-sm">
                  <div className="col-span-3 font-semibold text-slate-900">
                    {(a.code ? a.code + " — " : "") + a.name}
                  </div>
                  <div className="col-span-3 text-slate-800">
                    {(a.bank_name || "—") + " / " + (a.account_number || "—")}
                  </div>

                  <div className="col-span-4">
                    {asg.length === 0 ? (
                      <span className="text-slate-500">Not assigned</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {asg.map((x) => (
                          <button
                            key={x.id}
                            onClick={() => unassign(x.id)}
                            disabled={!canManage || saving}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                            title="Click to remove assignment"
                          >
                            {officerMap[x.officer_user_id]?.full_name || x.officer_user_id} ✕
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="col-span-2 flex justify-end gap-2">
                    <button
                      disabled={!canManage}
                      onClick={() => {
                        setEditId(a.id);
                        setCode(a.code || "");
                        setName(a.name || "");
                        setBank(a.bank_name || "");
                        setAcctNo(a.account_number || "");
                        setActive(Boolean(a.is_active));
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      disabled={!canManage || saving}
                      onClick={() => deleteAccount(a.id)}
                      className="rounded-lg bg-red-600 px-3 py-1 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}