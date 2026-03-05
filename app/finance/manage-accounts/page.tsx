"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
};

type Account = {
  id: string;
  code: string | null;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type OfficerRow = {
  id: string;
  officer_user_id: string;
  account_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function roleKey(role: string) {
  return (role || "")
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
  const canManage = useMemo(() => {
    const rk = roleKey(myRole);
    return rk === "admin" || rk === "auditor";
  }, [myRole]);

  // Accounts CRUD
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Officers / users
  const [users, setUsers] = useState<Profile[]>([]);
  const [officerUserId, setOfficerUserId] = useState<string>("");
  const [officerRole, setOfficerRole] = useState<"AccountOfficer" | "Account">("AccountOfficer");

  // Assignments
  const [assignAccountId, setAssignAccountId] = useState<string>("");
  const [assignOfficerId, setAssignOfficerId] = useState<string>("");
  const [assignments, setAssignments] = useState<OfficerRow[]>([]);

  const officers = useMemo(() => {
    // show anyone whose role looks like account officer
    const allowed = new Set(["accountofficer", "accounts", "account", "finance"]);
    return users.filter((u) => allowed.has(roleKey(u.role || "")));
  }, [users]);

  const userMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    users.forEach((u) => (m[u.id] = u));
    return m;
  }, [users]);

  const accountMap = useMemo(() => {
    const m: Record<string, Account> = {};
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

    if (!["Admin", "Auditor"].includes(r)) {
      router.push("/dashboard");
      return;
    }

    // load accounts
    const { data: arows, error: aErr } = await supabase
      .from("iet_accounts")
      .select("id,code,name,is_active,created_at,updated_at")
      .order("created_at", { ascending: false });

    if (aErr) {
      setMsg("Failed to load accounts: " + aErr.message);
      setAccounts([]);
    } else {
      setAccounts((arows || []) as Account[]);
    }

    // load users (profiles)
    const { data: urows, error: uErr } = await supabase
      .from("profiles")
      .select("id,full_name,role")
      .order("full_name", { ascending: true });

    if (uErr) {
      setMsg((prev) => (prev ? prev + "\n" : "") + "Failed to load users: " + uErr.message);
      setUsers([]);
    } else {
      setUsers((urows || []) as Profile[]);
    }

    // load assignments
    const { data: asg, error: asgErr } = await supabase
      .from("iet_account_officers")
      .select("id,officer_user_id,account_id,is_active,created_at,updated_at")
      .order("created_at", { ascending: false });

    if (asgErr) {
      setMsg((prev) => (prev ? prev + "\n" : "") + "Failed to load assignments: " + asgErr.message);
      setAssignments([]);
    } else {
      setAssignments((asg || []) as OfficerRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setEditId(null);
    setCode("");
    setName("");
    setIsActive(true);
  }

  async function saveAccount() {
    if (!canManage) return;
    if (!name.trim()) {
      setMsg("❌ Account name is required.");
      return;
    }

    const c = code.trim() || null;

    setSaving(true);
    setMsg(null);
    try {
      if (!editId) {
        const { error } = await supabase.from("iet_accounts").insert({
          code: c,
          name: name.trim(),
          is_active: isActive,
        });
        if (error) throw new Error(error.message);
        setMsg("✅ Account created.");
      } else {
        const { error } = await supabase
          .from("iet_accounts")
          .update({
            code: c,
            name: name.trim(),
            is_active: isActive,
          })
          .eq("id", editId);
        if (error) throw new Error(error.message);
        setMsg("✅ Account updated.");
      }

      resetForm();
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Save failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function editAccount(a: Account) {
    setEditId(a.id);
    setCode(a.code || "");
    setName(a.name || "");
    setIsActive(Boolean(a.is_active));
    setMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteAccount(id: string) {
    if (!canManage) return;
    const ok = confirm("Delete this account? Any assignments to officers will also be removed.");
    if (!ok) return;

    setSaving(true);
    setMsg(null);
    try {
      // delete assignments first (safe)
      await supabase.from("iet_account_officers").delete().eq("account_id", id);

      const { error } = await supabase.from("iet_accounts").delete().eq("id", id);
      if (error) throw new Error(error.message);

      setMsg("✅ Account deleted.");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Delete failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function createOfficerRole() {
    if (!canManage) return;
    if (!officerUserId) {
      setMsg("❌ Select a user to make Accounting Officer.");
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: officerRole })
        .eq("id", officerUserId);

      if (error) throw new Error(error.message);

      setMsg("✅ Officer created/updated successfully.");
      setOfficerUserId("");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Failed to update officer role: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function assignAccount() {
    if (!canManage) return;
    if (!assignAccountId || !assignOfficerId) {
      setMsg("❌ Select both Account and Officer.");
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase.from("iet_account_officers").insert({
        officer_user_id: assignOfficerId,
        account_id: assignAccountId,
        is_active: true,
      });

      if (error) throw new Error(error.message);

      setMsg("✅ Assigned successfully.");
      setAssignAccountId("");
      setAssignOfficerId("");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Assign failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleAssignment(row: OfficerRow) {
    if (!canManage) return;

    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase
        .from("iet_account_officers")
        .update({ is_active: !row.is_active })
        .eq("id", row.id);

      if (error) throw new Error(error.message);

      setMsg("✅ Assignment updated.");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ Update failed: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteAssignment(id: string) {
    if (!canManage) return;
    const ok = confirm("Remove this assignment?");
    if (!ok) return;

    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase.from("iet_account_officers").delete().eq("id", id);
      if (error) throw new Error(error.message);

      setMsg("✅ Assignment removed.");
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
              Accounts Setup
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Create IET accounts and assign them to Accounting Officers.
            </p>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-800 whitespace-pre-line">
            {msg}
          </div>
        )}

        {/* Create / Edit Account */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-lg font-bold text-slate-900">
            {editId ? "Edit Account" : "Create Account"}
          </div>

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

          <div className="mt-4 flex items-center gap-2">
            <input
              id="active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <label htmlFor="active" className="text-sm text-slate-700">
              Active
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={saveAccount}
              disabled={saving}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : editId ? "Update" : "Create"}
            </button>

            {editId && (
              <button
                onClick={resetForm}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Accounts list */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-lg font-bold text-slate-900">All IET Accounts</div>

          {accounts.length === 0 ? (
            <div className="mt-4 text-sm text-slate-700">No accounts yet.</div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-12 bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600">
                <div className="col-span-3">Code</div>
                <div className="col-span-5">Name</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              {accounts.map((a) => (
                <div key={a.id} className="grid grid-cols-12 border-t px-4 py-3 text-sm">
                  <div className="col-span-3 font-semibold text-slate-900">{a.code || "—"}</div>
                  <div className="col-span-5 text-slate-900">{a.name}</div>
                  <div className="col-span-2">
                    <span
                      className={`inline-flex rounded-lg border px-2 py-1 text-xs font-semibold ${
                        a.is_active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-50 text-slate-700 border-slate-200"
                      }`}
                    >
                      {a.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="col-span-2 flex justify-end gap-2">
                    <button
                      onClick={() => editAccount(a)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteAccount(a.id)}
                      disabled={saving}
                      className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Accounting Officer */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-lg font-bold text-slate-900">Create Accounting Officer</div>
          <p className="mt-1 text-sm text-slate-600">
            Pick a registered user and set their role to <b>AccountOfficer</b>.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-800">User</label>
              <select
                value={officerUserId}
                onChange={(e) => setOfficerUserId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="">-- Select --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(u.full_name || "Unnamed") + " • " + (u.role || "Staff")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Set Role</label>
              <select
                value={officerRole}
                onChange={(e) => setOfficerRole(e.target.value as any)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="AccountOfficer">AccountOfficer</option>
                <option value="Account">Account</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={createOfficerRole}
              disabled={saving}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Working..." : "Make Accounting Officer"}
            </button>
          </div>
        </div>

        {/* Assign Account to Officer */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-lg font-bold text-slate-900">Assign Account to Officer</div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-800">Account</label>
              <select
                value={assignAccountId}
                onChange={(e) => setAssignAccountId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="">-- Select --</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {(a.code || "—") + " • " + a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Officer</label>
              <select
                value={assignOfficerId}
                onChange={(e) => setAssignOfficerId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="">-- Select --</option>
                {officers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(u.full_name || "Unnamed") + " • " + (u.role || "Staff")}
                  </option>
                ))}
              </select>

              {officers.length === 0 && (
                <div className="mt-2 text-xs text-red-600">
                  No Accounting Officers found. Use “Create Accounting Officer” above.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={assignAccount}
              disabled={saving}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Assigning..." : "Assign"}
            </button>
          </div>
        </div>

        {/* Assignments table */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-lg font-bold text-slate-900">Officer Assignments</div>

          {assignments.length === 0 ? (
            <div className="mt-4 text-sm text-slate-700">No assignments yet.</div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-12 bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600">
                <div className="col-span-5">Officer</div>
                <div className="col-span-5">Account</div>
                <div className="col-span-1">Status</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>

              {assignments.map((r) => {
                const u = userMap[r.officer_user_id];
                const a = accountMap[r.account_id];
                return (
                  <div key={r.id} className="grid grid-cols-12 border-t px-4 py-3 text-sm">
                    <div className="col-span-5 text-slate-900">
                      {(u?.full_name || "Unknown") + " • " + (u?.role || "—")}
                    </div>
                    <div className="col-span-5 text-slate-900">
                      {(a?.code || "—") + " • " + (a?.name || "Unknown")}
                    </div>
                    <div className="col-span-1">
                      <span
                        className={`inline-flex rounded-lg border px-2 py-1 text-xs font-semibold ${
                          r.is_active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-50 text-slate-700 border-slate-200"
                        }`}
                      >
                        {r.is_active ? "On" : "Off"}
                      </span>
                    </div>
                    <div className="col-span-1 flex justify-end gap-2">
                      <button
                        onClick={() => toggleAssignment(r)}
                        disabled={saving}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold hover:bg-slate-100 disabled:opacity-60"
                      >
                        Toggle
                      </button>
                      <button
                        onClick={() => deleteAssignment(r.id)}
                        disabled={saving}
                        className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        X
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-8 text-xs text-slate-500">
          Access: Admin/Auditor only.
        </div>
      </div>
    </main>
  );
}