"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Dept = { id: string; name: string };

type Sub = {
  id: string;
  dept_id: string | null;
  code: string | null;
  name: string;
  approved_allocation: number;
  expenditure: number;
  balance: number;
  is_active: boolean;
  updated_at: string;
};

function roleKey(role: string) {
  return (role || "").trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "");
}

function naira(n: number) {
  return "₦" + Math.round(n || 0).toLocaleString();
}

export default function SubheadsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [myRole, setMyRole] = useState("staff");
  const rk = roleKey(myRole);

  const canManage = rk === "admin" || rk === "auditor";
  const canAuditView = ["admin", "auditor", "account", "accountofficer"].includes(rk);

  const [depts, setDepts] = useState<Dept[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);

  const [editId, setEditId] = useState<string | null>(null);
  const [deptId, setDeptId] = useState<string>("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [allocation, setAllocation] = useState<number>(0);
  const [active, setActive] = useState(true);

  async function load() {
    setLoading(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .maybeSingle();

    setMyRole((prof?.role || "Staff") as string);

    const { data: drows } = await supabase.from("departments").select("id,name").order("name");
    setDepts((drows || []) as Dept[]);

    const { data: srows, error: sErr } = await supabase
      .from("subheads")
      .select("id,dept_id,code,name,approved_allocation,expenditure,balance,is_active,updated_at")
      .order("name");

    if (sErr) setMsg(sErr.message);
    setSubs((srows || []) as Sub[]);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const deptMap = useMemo(() => {
    const m: Record<string, string> = {};
    depts.forEach((d) => (m[d.id] = d.name));
    return m;
  }, [depts]);

  const totals = useMemo(() => {
    const allocationTotal = subs.reduce((a, s) => a + Number(s.approved_allocation || 0), 0);
    const expenditureTotal = subs.reduce((a, s) => a + Number(s.expenditure || 0), 0);
    const balanceTotal = subs.reduce((a, s) => a + Number(s.balance || 0), 0);
    const activeCount = subs.filter((s) => s.is_active).length;

    return {
      allocationTotal,
      expenditureTotal,
      balanceTotal,
      activeCount,
      totalCount: subs.length,
    };
  }, [subs]);

  function resetForm() {
    setEditId(null);
    setDeptId("");
    setCode("");
    setName("");
    setAllocation(0);
    setActive(true);
  }

  async function save() {
    if (!canManage) {
      setMsg("Not allowed.");
      return;
    }

    if (name.trim().length < 2) {
      setMsg("Subhead name too short.");
      return;
    }

    setSaving(true);
    setMsg(null);

    const payload: any = {
      dept_id: deptId || null,
      code: code.trim() || null,
      name: name.trim(),
      approved_allocation: Number(allocation || 0),
      is_active: active,
    };

    try {
      if (!editId) {
        payload.expenditure = 0;
        payload.balance = Number(allocation || 0);

        const { error } = await supabase.from("subheads").insert(payload);
        if (error) throw new Error(error.message);

        setMsg("✅ Subhead created.");
      } else {
        const current = subs.find((x) => x.id === editId);
        const exp = Number(current?.expenditure || 0);
        payload.balance = Number(allocation || 0) - exp;

        const { error } = await supabase.from("subheads").update(payload).eq("id", editId);
        if (error) throw new Error(error.message);

        setMsg("✅ Subhead updated.");
      }

      resetForm();
      await load();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Failed"));
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    if (!canManage) {
      setMsg("Not allowed.");
      return;
    }

    if (!confirm("Delete this subhead?")) return;

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase.from("subheads").delete().eq("id", id);
      if (error) throw new Error(error.message);

      setMsg("✅ Deleted.");
      await load();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Failed"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-7xl py-10 text-slate-600">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <div className="mx-auto max-w-7xl py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Finance • Subheads
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Manage subheads, allocations, expenditure and balances with a cleaner finance view.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canAuditView && (
              <button
                onClick={() => router.push("/finance/audit")}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
              >
                Audit Trail & Reconciliation
              </button>
            )}

            <button
              onClick={() => router.push("/finance")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
            >
              ← Back to Finance
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
            {msg}
          </div>
        )}

        {/* Summary cards */}
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            title="Total Subheads"
            value={String(totals.totalCount)}
            tone="slate"
          />
          <StatCard
            title="Active Subheads"
            value={String(totals.activeCount)}
            tone="emerald"
          />
          <StatCard
            title="Total Allocation"
            value={naira(totals.allocationTotal)}
            tone="blue"
          />
          <StatCard
            title="Total Expenditure"
            value={naira(totals.expenditureTotal)}
            tone="red"
          />
          <StatCard
            title="Total Balance"
            value={naira(totals.balanceTotal)}
            tone="emerald"
          />
        </div>

        {/* Form */}
        <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {editId ? "Edit Subhead" : "Create Subhead"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Create and manage departmental budget lines professionally.
              </p>
            </div>

            {editId && (
              <button
                onClick={resetForm}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Cancel Edit
              </button>
            )}
          </div>

          {!canManage && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              View only. Only Admin and Auditor can create, edit or delete subheads.
            </div>
          )}

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="xl:col-span-2">
              <label className="text-sm font-semibold text-slate-800">Department</label>
              <select
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
                disabled={!canManage}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
              >
                <option value="">— Not assigned —</option>
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={!canManage}
                placeholder="e.g. GA-004"
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Allocation (₦)</label>
              <input
                value={allocation}
                onChange={(e) => setAllocation(Number(e.target.value || 0))}
                disabled={!canManage}
                type="number"
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
              />
            </div>

            <div className="md:col-span-2 xl:col-span-3">
              <label className="text-sm font-semibold text-slate-800">Subhead Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canManage}
                placeholder="e.g. Vehicles Maintenance"
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
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
                onClick={save}
                disabled={!canManage || saving}
                className="ml-auto rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : editId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile / card view */}
        <div className="mt-6 grid gap-4 xl:hidden">
          {subs.length === 0 ? (
            <div className="rounded-2xl border bg-white p-5 text-sm text-slate-700 shadow-sm">
              No subheads yet.
            </div>
          ) : (
            subs.map((s) => (
              <div key={s.id} className="rounded-3xl border bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold text-slate-900">{s.name}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {s.dept_id ? deptMap[s.dept_id] : "No department"}
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      s.is_active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {s.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="mt-3 text-sm text-slate-700">
                  <span className="font-semibold">Code:</span> {s.code || "—"}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <MiniMetric title="Allocation" value={naira(Number(s.approved_allocation || 0))} tone="blue" />
                  <MiniMetric title="Expenditure" value={naira(Number(s.expenditure || 0))} tone="red" />
                  <MiniMetric title="Balance" value={naira(Number(s.balance || 0))} tone="emerald" />
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    disabled={!canManage}
                    onClick={() => {
                      setEditId(s.id);
                      setDeptId(s.dept_id || "");
                      setCode(s.code || "");
                      setName(s.name);
                      setAllocation(Number(s.approved_allocation || 0));
                      setActive(Boolean(s.is_active));
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Edit
                  </button>

                  <button
                    disabled={!canManage || saving}
                    onClick={() => del(s.id)}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop modern scrollable table */}
        <div className="mt-6 hidden xl:block rounded-3xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-slate-50 px-6 py-4">
            <h3 className="text-base font-bold text-slate-900">Subheads Register</h3>
            <p className="mt-1 text-sm text-slate-600">
              Modern scrollable view for finance control and reconciliation.
            </p>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[1250px]">
              <div className="grid grid-cols-15 bg-slate-100 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <div className="col-span-3">Department</div>
                <div className="col-span-2">Code</div>
                <div className="col-span-3">Subhead</div>
                <div className="col-span-2 text-right">Allocation</div>
                <div className="col-span-2 text-right">Expenditure</div>
                <div className="col-span-2 text-right">Balance</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>

              {subs.length === 0 ? (
                <div className="px-6 py-6 text-sm text-slate-700">No subheads yet.</div>
              ) : (
                subs.map((s) => (
                  <div
                    key={s.id}
                    className="grid grid-cols-15 items-center border-t px-6 py-4 text-sm hover:bg-slate-50"
                  >
                    <div className="col-span-3">
                      <div className="font-semibold text-slate-900">
                        {s.dept_id ? deptMap[s.dept_id] : "—"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {s.is_active ? "Active" : "Inactive"}
                      </div>
                    </div>

                    <div className="col-span-2 font-semibold text-slate-900">
                      {s.code || "—"}
                    </div>

                    <div className="col-span-3">
                      <div className="font-semibold text-slate-900">{s.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Updated {new Date(s.updated_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="col-span-2 text-right font-semibold text-blue-700">
                      {naira(Number(s.approved_allocation || 0))}
                    </div>

                    <div className="col-span-2 text-right font-semibold text-red-600">
                      {naira(Number(s.expenditure || 0))}
                    </div>

                    <div className="col-span-2 text-right font-bold text-emerald-700">
                      {naira(Number(s.balance || 0))}
                    </div>

                    <div className="col-span-1 flex justify-end gap-2">
                      <button
                        disabled={!canManage}
                        onClick={() => {
                          setEditId(s.id);
                          setDeptId(s.dept_id || "");
                          setCode(s.code || "");
                          setName(s.name);
                          setAllocation(Number(s.approved_allocation || 0));
                          setActive(Boolean(s.is_active));
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50"
                      >
                        Edit
                      </button>

                      <button
                        disabled={!canManage || saving}
                        onClick={() => del(s.id)}
                        className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "slate" | "blue" | "red" | "emerald";
}) {
  const toneClass =
    tone === "blue"
      ? "text-blue-700 bg-blue-50"
      : tone === "red"
      ? "text-red-700 bg-red-50"
      : tone === "emerald"
      ? "text-emerald-700 bg-emerald-50"
      : "text-slate-700 bg-slate-50";

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      <div className={`mt-3 inline-flex rounded-2xl px-3 py-2 text-xl font-extrabold ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}

function MiniMetric({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "blue" | "red" | "emerald";
}) {
  const toneClass =
    tone === "blue"
      ? "bg-blue-50 text-blue-700"
      : tone === "red"
      ? "bg-red-50 text-red-700"
      : "bg-emerald-50 text-emerald-700";

  return (
    <div className={`rounded-2xl p-3 ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-wide">{title}</div>
      <div className="mt-2 text-sm font-extrabold">{value}</div>
    </div>
  );
}