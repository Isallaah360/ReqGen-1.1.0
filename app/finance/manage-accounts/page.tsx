"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Profile = { id: string; full_name: string | null; role: string | null };
type Dept = { id: string; name: string; created_at: string };
type Account = { id: string; code: string; name: string; is_active: boolean; updated_at: string };
type Subhead = {
  id: string;
  dept_id: string;
  account_id: string | null;
  code: string | null;
  name: string;
  approved_allocation: number;
  expenditure: number;
  balance: number;
  is_active: boolean;
  updated_at: string;
};
type Assign = { id: string; account_id: string; officer_id: string; is_active: boolean; created_at: string };

function roleKey(role: string) {
  return (role || "").trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "");
}
function naira(n: number) {
  return "₦" + Math.round(Number(n || 0)).toLocaleString();
}

export default function ManageAccountsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [me, setMe] = useState<Profile | null>(null);

  const [users, setUsers] = useState<Profile[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [subheads, setSubheads] = useState<Subhead[]>([]);
  const [assignments, setAssignments] = useState<Assign[]>([]);

  const tabs = ["Departments", "Accounts", "Subheads", "Officers", "Assign"] as const;
  type Tab = (typeof tabs)[number];
  const [tab, setTab] = useState<Tab>("Departments");

  const canAdmin = useMemo(() => ["admin", "auditor"].includes(roleKey(me?.role || "")), [me]);

  // Dept form
  const [deptName, setDeptName] = useState("");
  const [deptEditId, setDeptEditId] = useState<string | null>(null);

  // Account form
  const [accCode, setAccCode] = useState("");
  const [accName, setAccName] = useState("");
  const [accEditId, setAccEditId] = useState<string | null>(null);

  // Subhead form
  const [subDeptId, setSubDeptId] = useState<string>("");
  const [subAccountId, setSubAccountId] = useState<string>("");
  const [subCode, setSubCode] = useState("");
  const [subName, setSubName] = useState("");
  const [subAlloc, setSubAlloc] = useState<string>("0");
  const [subEditId, setSubEditId] = useState<string | null>(null);

  // Promote officer
  const [promoteUserId, setPromoteUserId] = useState<string>("");

  // Assign
  const [assignAccountId, setAssignAccountId] = useState<string>("");
  const [assignOfficerId, setAssignOfficerId] = useState<string>("");

  const deptMap = useMemo(() => Object.fromEntries(depts.map((d) => [d.id, d])), [depts]);
  const accountMap = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts]);
  const userMap = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  const officers = useMemo(() => users.filter((u) => roleKey(u.role || "") === "accountofficer"), [users]);

  async function loadAll() {
    setLoading(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }

    const { data: my, error: myErr } = await supabase
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", auth.user.id)
      .single();

    if (myErr) {
      setMsg("Failed to load profile: " + myErr.message);
      setLoading(false);
      return;
    }

    setMe(my as any);

    if (!["admin", "auditor"].includes(roleKey((my as any)?.role || ""))) {
      router.push("/dashboard");
      return;
    }

    const { data: u } = await supabase.from("profiles").select("id,full_name,role").order("full_name");
    setUsers((u || []) as any);

    const { data: d, error: dErr } = await supabase.from("departments").select("id,name,created_at").order("name");
    if (dErr) setMsg("Departments load error: " + dErr.message);
    setDepts((d || []) as any);

    const { data: a, error: aErr } = await supabase
      .from("iet_accounts")
      .select("id,code,name,is_active,updated_at")
      .order("code");
    if (aErr) setMsg("Accounts load error: " + aErr.message);
    setAccounts((a || []) as any);

    const { data: s, error: sErr } = await supabase
      .from("subheads")
      .select("id,dept_id,account_id,code,name,approved_allocation,expenditure,balance,is_active,updated_at")
      .order("name");
    if (sErr) setMsg("Subheads load error: " + sErr.message);
    setSubheads((s || []) as any);

    const { data: asg, error: asgErr } = await supabase
      .from("iet_account_officer_assignments")
      .select("id,account_id,officer_id,is_active,created_at")
      .order("created_at", { ascending: false });

    if (asgErr) setMsg("Assignments load error: " + asgErr.message);
    setAssignments((asg || []) as any);

    // Defaults
    setSubDeptId((d || [])[0]?.id || "");
    setSubAccountId((a || [])[0]?.id || "");
    setPromoteUserId((u || [])[0]?.id || "");
    setAssignAccountId((a || [])[0]?.id || "");
    setAssignOfficerId((u || []).find((x: any) => roleKey(x.role || "") === "accountofficer")?.id || "");

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Departments
  async function saveDept() {
    if (!deptName.trim()) return setMsg("❌ Department name required.");
    setSaving(true);
    setMsg(null);
    try {
      if (deptEditId) {
        const { error } = await supabase.from("departments").update({ name: deptName.trim() }).eq("id", deptEditId);
        if (error) throw new Error(error.message);
        setMsg("✅ Department updated.");
      } else {
        const { error } = await supabase.from("departments").insert({ name: deptName.trim() });
        if (error) throw new Error(error.message);
        setMsg("✅ Department created.");
      }
      setDeptName("");
      setDeptEditId(null);
      await loadAll();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Failed"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteDept(id: string) {
    const ok = confirm("Delete this department? (All subheads under it will also be deleted)");
    if (!ok) return;
    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setMsg("✅ Department deleted.");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Delete failed"));
    } finally {
      setSaving(false);
    }
  }

  // ---------- Accounts
  async function saveAccount() {
    if (!accCode.trim() || !accName.trim()) return setMsg("❌ Account code and name required.");
    setSaving(true);
    setMsg(null);
    try {
      const payload = { code: accCode.trim().toUpperCase(), name: accName.trim() };
      if (accEditId) {
        const { error } = await supabase.from("iet_accounts").update(payload).eq("id", accEditId);
        if (error) throw new Error(error.message);
        setMsg("✅ Account updated.");
      } else {
        const { error } = await supabase.from("iet_accounts").insert({ ...payload, is_active: true });
        if (error) throw new Error(error.message);
        setMsg("✅ Account created.");
      }
      setAccEditId(null);
      setAccCode("");
      setAccName("");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Failed"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount(id: string) {
    const ok = confirm("Delete this account? (Assignments may be removed too)");
    if (!ok) return;
    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase.from("iet_accounts").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setMsg("✅ Account deleted.");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Delete failed"));
    } finally {
      setSaving(false);
    }
  }

  // ---------- Subheads
  async function saveSubhead() {
    if (!subDeptId) return setMsg("❌ Select department.");
    if (!subName.trim()) return setMsg("❌ Subhead name required.");

    const alloc = Number(subAlloc);
    if (!Number.isFinite(alloc) || alloc < 0) return setMsg("❌ Allocation must be valid number.");

    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        dept_id: subDeptId,
        account_id: subAccountId || null,
        code: subCode.trim() || null,
        name: subName.trim(),
        approved_allocation: alloc,
      };

      if (subEditId) {
        const { error } = await supabase.from("subheads").update(payload).eq("id", subEditId);
        if (error) throw new Error(error.message);
        setMsg("✅ Subhead updated.");
      } else {
        const { error } = await supabase.from("subheads").insert({
          ...payload,
          expenditure: 0,
          balance: alloc,
          is_active: true,
        });
        if (error) throw new Error(error.message);
        setMsg("✅ Subhead created.");
      }

      setSubEditId(null);
      setSubCode("");
      setSubName("");
      setSubAlloc("0");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Failed"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteSubhead(id: string) {
    const ok = confirm("Delete this subhead?");
    if (!ok) return;
    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase.from("subheads").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setMsg("✅ Subhead deleted.");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Delete failed"));
    } finally {
      setSaving(false);
    }
  }

  // ---------- Officers
  async function promoteToOfficer() {
    if (!promoteUserId) return setMsg("❌ Select a user.");
    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase.from("profiles").update({ role: "AccountOfficer" }).eq("id", promoteUserId);
      if (error) throw new Error(error.message);
      setMsg("✅ User promoted to AccountOfficer.");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Failed"));
    } finally {
      setSaving(false);
    }
  }

  async function demoteOfficer(userId: string) {
    const ok = confirm("Remove AccountOfficer role from this user?");
    if (!ok) return;
    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase.from("profiles").update({ role: "Staff" }).eq("id", userId);
      if (error) throw new Error(error.message);
      setMsg("✅ Officer removed (role reset to Staff).");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Failed"));
    } finally {
      setSaving(false);
    }
  }

  // ---------- Assign
  async function assignAccount() {
    if (!assignAccountId) return setMsg("❌ Select account.");
    if (!assignOfficerId) return setMsg("❌ Select officer.");
    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase.from("iet_account_officer_assignments").insert({
        account_id: assignAccountId,
        officer_id: assignOfficerId,
        is_active: true,
      });
      if (error) throw new Error(error.message);
      setMsg("✅ Assignment created.");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Assign failed"));
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignment(id: string) {
    const ok = confirm("Remove this assignment?");
    if (!ok) return;
    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase.from("iet_account_officer_assignments").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setMsg("✅ Assignment removed.");
      await loadAll();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Failed"));
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
  if (!canAdmin) return null;

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-6xl py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Manage Accounts</h1>
            <p className="mt-2 text-sm text-slate-600">
              Admin/Auditor can Create, Edit, Delete & Assign Departments, Subheads, Accounts and Accounting Officers.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => router.push("/finance/reports")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              ← Back to Finance
            </button>
            <button
              onClick={loadAll}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Refresh
            </button>
          </div>
        </div>

        {msg && <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">{msg}</div>}

        <div className="mt-6 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold border ${
                tab === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-800 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Departments */}
        {tab === "Departments" && (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="text-lg font-bold text-slate-900">{deptEditId ? "Edit Department" : "Create Department"}</div>

              <div className="mt-4">
                <label className="text-sm font-semibold text-slate-800">Name</label>
                <input
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                  placeholder="e.g. General Admin"
                />
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={saveDept}
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : deptEditId ? "Update" : "Create"}
                </button>
                {deptEditId && (
                  <button
                    onClick={() => {
                      setDeptEditId(null);
                      setDeptName("");
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="text-lg font-bold text-slate-900">Departments</div>
              {depts.length === 0 ? (
                <div className="mt-4 text-sm text-slate-600">No departments.</div>
              ) : (
                <div className="mt-4 space-y-2">
                  {depts.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                      <div className="font-semibold text-slate-900">{d.name}</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setDeptEditId(d.id);
                            setDeptName(d.name);
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold hover:bg-slate-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteDept(d.id)}
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
          </div>
        )}

        {/* Accounts */}
        {tab === "Accounts" && (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="text-lg font-bold text-slate-900">{accEditId ? "Edit Account" : "Create Account"}</div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-800">Code</label>
                  <input
                    value={accCode}
                    onChange={(e) => setAccCode(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                    placeholder="e.g. GENADMIN"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-800">Name</label>
                  <input
                    value={accName}
                    onChange={(e) => setAccName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                    placeholder="e.g. General Admin"
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={saveAccount}
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : accEditId ? "Update" : "Create"}
                </button>
                {accEditId && (
                  <button
                    onClick={() => {
                      setAccEditId(null);
                      setAccCode("");
                      setAccName("");
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="text-lg font-bold text-slate-900">IET Accounts</div>
              {accounts.length === 0 ? (
                <div className="mt-4 text-sm text-slate-600">No accounts.</div>
              ) : (
                <div className="mt-4 space-y-2">
                  {accounts.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                      <div>
                        <div className="font-semibold text-slate-900">{a.code} — {a.name}</div>
                        <div className="text-xs text-slate-500">Updated: {new Date(a.updated_at).toLocaleString()}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setAccEditId(a.id);
                            setAccCode(a.code);
                            setAccName(a.name);
                          }}
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
          </div>
        )}

        {/* Subheads */}
        {tab === "Subheads" && (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="text-lg font-bold text-slate-900">{subEditId ? "Edit Subhead" : "Create Subhead"}</div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-800">Department</label>
                  <select
                    value={subDeptId}
                    onChange={(e) => setSubDeptId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                  >
                    {depts.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-800">Account Bucket</label>
                  <select
                    value={subAccountId}
                    onChange={(e) => setSubAccountId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                  >
                    <option value="">-- None --</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-800">Code</label>
                  <input
                    value={subCode}
                    onChange={(e) => setSubCode(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                    placeholder="e.g. GA-004"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-800">Name</label>
                  <input
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                    placeholder="e.g. Vehicles Maintenance"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="text-sm font-semibold text-slate-800">Allocation (₦)</label>
                <input
                  value={subAlloc}
                  onChange={(e) => setSubAlloc(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                  inputMode="numeric"
                />
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={saveSubhead}
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : subEditId ? "Update" : "Create"}
                </button>
                {subEditId && (
                  <button
                    onClick={() => {
                      setSubEditId(null);
                      setSubCode("");
                      setSubName("");
                      setSubAlloc("0");
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="text-lg font-bold text-slate-900">Subheads</div>

              {subheads.length === 0 ? (
                <div className="mt-4 text-sm text-slate-600">No subheads.</div>
              ) : (
                <div className="mt-4 space-y-2 max-h-[540px] overflow-auto pr-2">
                  {subheads.map((s) => (
                    <div key={s.id} className="rounded-xl border border-slate-200 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">
                            {(s.code ? s.code + " — " : "") + s.name}
                          </div>
                          <div className="text-xs text-slate-600">
                            Dept: <b>{deptMap[s.dept_id]?.name || s.dept_id}</b> • Account:{" "}
                            <b>{s.account_id ? (accountMap[s.account_id]?.code || "—") : "—"}</b>
                          </div>
                          <div className="text-xs text-slate-600 mt-1">
                            Allocation: <b>{naira(s.approved_allocation)}</b> • Expenditure:{" "}
                            <b>{naira(s.expenditure)}</b> • Balance: <b>{naira(s.balance)}</b>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSubEditId(s.id);
                              setSubDeptId(s.dept_id);
                              setSubAccountId(s.account_id || "");
                              setSubCode(s.code || "");
                              setSubName(s.name);
                              setSubAlloc(String(Number(s.approved_allocation || 0)));
                              setTab("Subheads");
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteSubhead(s.id)}
                            disabled={saving}
                            className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 mt-2">
                        Updated: {new Date(s.updated_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Officers */}
        {tab === "Officers" && (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="text-lg font-bold text-slate-900">Create Accounting Officers</div>
              <div className="mt-2 text-sm text-slate-600">Promote any registered user to <b>AccountOfficer</b>.</div>

              <div className="mt-4">
                <label className="text-sm font-semibold text-slate-800">User</label>
                <select
                  value={promoteUserId}
                  onChange={(e) => setPromoteUserId(e.target.value)}
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

              <div className="mt-4">
                <button
                  onClick={promoteToOfficer}
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {saving ? "Working..." : "Promote to AccountOfficer"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="text-lg font-bold text-slate-900">Accounting Officers</div>
              {officers.length === 0 ? (
                <div className="mt-4 text-sm text-slate-600">No officers yet.</div>
              ) : (
                <div className="mt-4 space-y-2">
                  {officers.map((o) => (
                    <div key={o.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                      <div className="font-semibold text-slate-900">{o.full_name || "Unnamed"}</div>
                      <button
                        onClick={() => demoteOfficer(o.id)}
                        disabled={saving}
                        className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Assign */}
        {tab === "Assign" && (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
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
                      <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
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
                    {officers.map((o) => (
                      <option key={o.id} value={o.id}>{o.full_name || "Unnamed"}</option>
                    ))}
                  </select>
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

              {officers.length === 0 && (
                <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  No officers yet. Go to <b>Officers</b> tab and promote users.
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="text-lg font-bold text-slate-900">Current Assignments</div>

              {assignments.length === 0 ? (
                <div className="mt-4 text-sm text-slate-600">No assignments yet.</div>
              ) : (
                <div className="mt-4 space-y-2 max-h-[540px] overflow-auto pr-2">
                  {assignments.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {accountMap[a.account_id]?.code || "—"} → {userMap[a.officer_id]?.full_name || "Unnamed"}
                        </div>
                        <div className="text-xs text-slate-500">{new Date(a.created_at).toLocaleString()}</div>
                      </div>
                      <button
                        onClick={() => removeAssignment(a.id)}
                        disabled={saving}
                        className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-10 text-xs text-slate-500">
          If anything looks empty after updates → click <b>Refresh</b>.
        </div>
      </div>
    </main>
  );
}