"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Dept = { id: string; name: string };
type Account = { id: string; name: string };
type Me = { id: string; role: string };

type Subhead = {
  id: string;
  dept_id: string;
  account_id: string | null;
  code: string;
  name: string;
  approved_allocation: number;
  expenditure: number;
  balance: number;
  is_active: boolean;
  updated_at: string;
};

function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export default function FinanceSubheadsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [me, setMe] = useState<Me | null>(null);

  const [depts, setDepts] = useState<Dept[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rows, setRows] = useState<Subhead[]>([]);

  const [deptFilter, setDeptFilter] = useState<string>("");
  const [accountFilter, setAccountFilter] = useState<string>("");

  // form
  const [editing, setEditing] = useState<Subhead | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [deptId, setDeptId] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [approvedAllocation, setApprovedAllocation] = useState<string>("0");
  const [expenditure, setExpenditure] = useState<string>("0");
  const [isActive, setIsActive] = useState(true);

  const canFinance = useMemo(() => {
    const r = me?.role || "";
    return ["Admin", "Auditor", "AccountOfficer"].includes(r);
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
      .select("id,role")
      .eq("id", auth.user.id)
      .single();

    if (meErr) {
      setMsg("Failed to load profile: " + meErr.message);
      setLoading(false);
      return;
    }

    setMe(myProf as Me);

    // Departments (active)
    const { data: dRows, error: dErr } = await supabase
      .from("departments")
      .select("id,name")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (dErr) setMsg("Failed to load departments: " + dErr.message);
    setDepts((dRows || []) as Dept[]);

    // Accounts (Auditor/Admin can see all; if AccountOfficer has no select policy, will be empty => that is OK)
    const { data: aRows } = await supabase
      .from("iet_accounts")
      .select("id,name")
      .eq("is_active", true)
      .order("name", { ascending: true });

    setAccounts((aRows || []) as Account[]);

    await loadSubheads();

    setLoading(false);
  }

  async function loadSubheads() {
    setMsg(null);

    let q = supabase
      .from("subheads")
      .select(
        "id,dept_id,account_id,code,name,approved_allocation,expenditure,balance,is_active,updated_at"
      )
      .order("updated_at", { ascending: false });

    if (deptFilter) q = q.eq("dept_id", deptFilter);
    if (accountFilter) q = q.eq("account_id", accountFilter);

    const { data, error } = await q;
    if (error) {
      setMsg("Failed to load subheads: " + error.message);
      setRows([]);
      return;
    }
    setRows((data || []) as Subhead[]);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (!loading) loadSubheads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deptFilter, accountFilter]);

  function resetForm() {
    setEditing(null);
    setCode("");
    setName("");
    setDeptId("");
    setAccountId("");
    setApprovedAllocation("0");
    setExpenditure("0");
    setIsActive(true);
  }

  function startEdit(s: Subhead) {
    setEditing(s);
    setCode(s.code || "");
    setName(s.name || "");
    setDeptId(s.dept_id || "");
    setAccountId(s.account_id || "");
    setApprovedAllocation(String(n(s.approved_allocation)));
    setExpenditure(String(n(s.expenditure)));
    setIsActive(!!s.is_active);
    setMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validate(): string | null {
    if (!code.trim()) return "Code is required.";
    if (!name.trim()) return "Name is required.";
    if (!deptId) return "Department is required.";
    if (!accountId) return "Account bucket is required.";
    if (n(approvedAllocation) < 0) return "Approved allocation must be >= 0.";
    if (n(expenditure) < 0) return "Expenditure must be >= 0.";
    return null;
  }

  async function save() {
    setMsg(null);
    const err = validate();
    if (err) return setMsg("❌ " + err);

    try {
      const payload: any = {
        code: code.trim(),
        name: name.trim(),
        dept_id: deptId,
        account_id: accountId || null,
        approved_allocation: n(approvedAllocation),
        expenditure: n(expenditure),
        is_active: isActive,
      };

      if (editing) {
        const { error } = await supabase
          .from("subheads")
          .update(payload)
          .eq("id", editing.id);

        if (error) throw new Error(error.message);
        setMsg("✅ Subhead updated.");
      } else {
        const { error } = await supabase.from("subheads").insert(payload);
        if (error) throw new Error(error.message);
        setMsg("✅ Subhead created.");
      }

      resetForm();
      await loadSubheads();
    } catch (e: any) {
      setMsg("❌ Save failed: " + (e?.message || "Unknown error"));
    }
  }

  async function del(id: string) {
    setMsg(null);
    try {
      const { error } = await supabase.from("subheads").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setMsg("✅ Deleted.");
      await loadSubheads();
    } catch (e: any) {
      setMsg("❌ Delete failed: " + (e?.message || "Unknown error"));
    }
  }

  function exportCSV() {
    const headers = [
      "Dept_ID",
      "Account_ID",
      "Code",
      "Name",
      "Approved_Allocation",
      "Expenditure",
      "Balance",
      "Is_Active",
      "Updated_At",
    ];

    const lines = rows.map((r) => [
      r.dept_id,
      r.account_id || "",
      r.code,
      r.name,
      String(n(r.approved_allocation)),
      String(n(r.expenditure)),
      String(n(r.balance)),
      r.is_active ? "TRUE" : "FALSE",
      r.updated_at,
    ]);

    const csv =
      headers.join(",") +
      "\n" +
      lines
        .map((x) =>
          x
            .map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`)
            .join(",")
        )
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `subheads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-5xl py-10 text-slate-600">Loading...</div>
      </main>
    );
  }

  if (!canFinance) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-5xl py-10">
          <div className="rounded-2xl border bg-white p-6 shadow-sm text-slate-700">
            You do not have Finance access.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-5xl py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Finance — Subheads
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Create, allocate NGN, assign departments and accounts, and export records.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={exportCSV}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Export CSV
            </button>

            {["Admin", "Auditor"].includes(me?.role || "") && (
              <button
                onClick={() => router.push("/finance/accounts")}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Manage Accounts
              </button>
            )}
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
            {msg}
          </div>
        )}

        {/* Form */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">
              {editing ? "Edit Subhead" : "Create Subhead"}
            </h2>
            {editing && (
              <button
                onClick={resetForm}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-800">Code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                placeholder="e.g. DIN-001"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                placeholder="e.g. Media Logistics"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Department</label>
              <select
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="">-- Select --</option>
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Account Bucket</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="">-- Select --</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-xs text-slate-500">
                Account officers will only see subheads inside accounts assigned to them.
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">
                Approved Allocation (₦)
              </label>
              <input
                value={approvedAllocation}
                onChange={(e) => setApprovedAllocation(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                placeholder="0"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Expenditure (₦)</label>
              <input
                value={expenditure}
                onChange={(e) => setExpenditure(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
                placeholder="0"
              />
            </div>

            <div className="md:col-span-2">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Active
              </label>
            </div>
          </div>

          <button
            onClick={save}
            className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            {editing ? "Save Changes" : "Create Subhead"}
          </button>
        </div>

        {/* Filters + Table */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Subheads Records</h2>
              <p className="mt-1 text-sm text-slate-600">
                Click any record to edit.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div>
                <div className="text-xs font-semibold text-slate-600">Filter Dept</div>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="mt-1 w-56 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="">All</option>
                  {depts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-600">Filter Account</div>
                <select
                  value={accountFilter}
                  onChange={(e) => setAccountFilter(e.target.value)}
                  className="mt-1 w-56 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="">All</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => {
                  setDeptFilter("");
                  setAccountFilter("");
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Clear
              </button>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="mt-4 text-sm text-slate-700">No subheads found.</div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-12 bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600">
                <div className="col-span-2">Code</div>
                <div className="col-span-4">Name</div>
                <div className="col-span-2 text-right">Approved</div>
                <div className="col-span-2 text-right">Spent</div>
                <div className="col-span-2 text-right">Balance</div>
              </div>

              {rows.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-12 items-center border-t px-4 py-3 text-sm hover:bg-slate-50"
                >
                  <button
                    className="col-span-2 text-left font-semibold text-slate-900 hover:underline"
                    onClick={() => startEdit(r)}
                    title="Edit"
                  >
                    {r.code}
                  </button>

                  <button
                    className="col-span-4 text-left text-slate-800 hover:underline"
                    onClick={() => startEdit(r)}
                    title="Edit"
                  >
                    {r.name}
                    {!r.is_active && (
                      <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        Inactive
                      </span>
                    )}
                  </button>

                  <div className="col-span-2 text-right font-semibold text-slate-900">
                    {n(r.approved_allocation).toLocaleString()}
                  </div>
                  <div className="col-span-2 text-right text-slate-800">
                    {n(r.expenditure).toLocaleString()}
                  </div>
                  <div className="col-span-2 text-right font-semibold text-slate-900">
                    {n(r.balance).toLocaleString()}
                  </div>

                  {/* Delete button (RLS will block if not allowed) */}
                  <div className="col-span-12 mt-2 flex justify-end">
                    <button
                      onClick={() => del(r.id)}
                      className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="col-span-12 mt-2 text-xs text-slate-500">
                    Updated: {new Date(r.updated_at).toLocaleString()}
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