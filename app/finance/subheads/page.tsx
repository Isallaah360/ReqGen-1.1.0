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
  reserved_amount: number;
  expenditure: number;
  balance: number;
  is_active: boolean;
  updated_at: string;
};

type PrintableRequest = {
  id: string;
  request_no: string;
  title: string;
  amount: number;
  status: string;
  current_stage: string;
  created_at: string;
  requester_name: string | null;
  account_name: string | null;
  subhead_id: string | null;
  request_type: "Official" | "Personal";
  personal_category: "Fund" | "NonFund" | null;
};

function roleKey(role: string) {
  return (role || "").trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "");
}

function naira(n: number) {
  return "₦" + Math.round(n || 0).toLocaleString();
}

function shortDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function requestTypeLabel(r: PrintableRequest) {
  if ((r.request_type || "").toUpperCase() === "OFFICIAL") return "Official";
  if ((r.personal_category || "").toUpperCase() === "FUND") return "Personal Fund";
  if ((r.personal_category || "").toUpperCase() === "NONFUND") return "Personal NonFund";
  return "Personal";
}

function requestPrintSource(r: PrintableRequest, subheadMap: Record<string, string>) {
  if ((r.request_type || "").toUpperCase() === "OFFICIAL") {
    return subheadMap[r.subhead_id || ""] || "No subhead";
  }

  if ((r.personal_category || "").toUpperCase() === "FUND") {
    return "Personal Fund • No subhead";
  }

  return "Not applicable";
}

export default function SubheadsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [myRole, setMyRole] = useState("staff");
  const rk = roleKey(myRole);

  const canManage = rk === "admin" || rk === "auditor";
  const canAuditView = ["admin", "auditor", "account", "accounts", "accountofficer"].includes(rk);
  const canPrintCompleted = ["admin", "auditor", "account", "accounts", "accountofficer"].includes(rk);

  const [depts, setDepts] = useState<Dept[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [printableRequests, setPrintableRequests] = useState<PrintableRequest[]>([]);

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

    const { data: drows } = await supabase
      .from("departments")
      .select("id,name")
      .order("name", { ascending: true });

    setDepts((drows || []) as Dept[]);

    const { data: srows, error: sErr } = await supabase
      .from("subheads")
      .select("id,dept_id,code,name,approved_allocation,reserved_amount,expenditure,balance,is_active,updated_at")
      .order("name", { ascending: true });

    if (sErr) setMsg(sErr.message);
    setSubs((srows || []) as Sub[]);

    const role = roleKey((prof?.role || "Staff") as string);
    const allowedPrint = ["admin", "auditor", "account", "accounts", "accountofficer"].includes(role);

    if (allowedPrint) {
      const { data: reqRows, error: reqErr } = await supabase
        .from("requests")
        .select(
          "id,request_no,title,amount,status,current_stage,created_at,requester_name,account_name,subhead_id,request_type,personal_category"
        )
        .in("status", ["Paid", "Completed"])
        .or("request_type.eq.Official,and(request_type.eq.Personal,personal_category.eq.Fund)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (reqErr) {
        setMsg("Failed to load printable requests: " + reqErr.message);
      } else {
        setPrintableRequests((reqRows || []) as PrintableRequest[]);
      }
    } else {
      setPrintableRequests([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deptMap = useMemo(() => {
    const m: Record<string, string> = {};
    depts.forEach((d) => (m[d.id] = d.name));
    return m;
  }, [depts]);

  const subheadMap = useMemo(() => {
    const m: Record<string, string> = {};
    subs.forEach((s) => {
      m[s.id] = `${s.code ? `${s.code} — ` : ""}${s.name}`;
    });
    return m;
  }, [subs]);

  const totals = useMemo(() => {
    const allocationTotal = subs.reduce((a, s) => a + Number(s.approved_allocation || 0), 0);
    const reservedTotal = subs.reduce((a, s) => a + Number(s.reserved_amount || 0), 0);
    const expenditureTotal = subs.reduce((a, s) => a + Number(s.expenditure || 0), 0);
    const balanceTotal = subs.reduce((a, s) => a + Number(s.balance || 0), 0);
    const activeCount = subs.filter((s) => s.is_active).length;

    return {
      allocationTotal,
      reservedTotal,
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

    const current = editId ? subs.find((x) => x.id === editId) : null;
    const reserved = Number(current?.reserved_amount || 0);
    const exp = Number(current?.expenditure || 0);
    const alloc = Number(allocation || 0);

    const payload: any = {
      dept_id: deptId || null,
      code: code.trim() || null,
      name: name.trim(),
      approved_allocation: alloc,
      is_active: active,
    };

    try {
      if (!editId) {
        payload.reserved_amount = 0;
        payload.expenditure = 0;
        payload.balance = alloc;

        const { error } = await supabase.from("subheads").insert(payload);
        if (error) throw new Error(error.message);

        setMsg("✅ Subhead created.");
      } else {
        payload.balance = alloc - reserved - exp;

        const { error } = await supabase
          .from("subheads")
          .update(payload)
          .eq("id", editId);

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
              Manage allocations, commitments, expenditures, balances and payment-related completed request printouts.
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

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Total Subheads" value={String(totals.totalCount)} tone="slate" />
          <StatCard title="Active Subheads" value={String(totals.activeCount)} tone="emerald" />
          <StatCard title="Allocation" value={naira(totals.allocationTotal)} tone="blue" />
          <StatCard title="Reserved" value={naira(totals.reservedTotal)} tone="amber" />
          <StatCard title="Expenditure" value={naira(totals.expenditureTotal)} tone="red" />
          <StatCard title="Balance" value={naira(totals.balanceTotal)} tone="emerald" />
        </div>

        {canPrintCompleted && (
          <div className="mt-6 rounded-3xl border bg-white shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Payment-Related Completed Requests Ready for Print
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Shows Official requests and Personal Fund requests only. Personal NonFund requests are handled by HR Filing.
                </p>
              </div>

              <button
                onClick={load}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Refresh
              </button>
            </div>

            {printableRequests.length === 0 ? (
              <div className="p-6 text-sm text-slate-700">
                No payment-related completed or paid request is ready for printing yet.
              </div>
            ) : (
              <>
                <div className="grid gap-3 p-4 xl:hidden">
                  {printableRequests.map((r) => (
                    <div key={r.id} className="rounded-2xl border bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-extrabold text-slate-900">{r.request_no}</div>
                          <div className="mt-1 text-sm font-semibold text-slate-800">
                            {r.title}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {requestPrintSource(r, subheadMap)}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                            {requestTypeLabel(r)}
                          </span>
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                            {r.status}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                        <div>
                          <span className="text-slate-500">Amount:</span>{" "}
                          <b>{naira(Number(r.amount || 0))}</b>
                        </div>
                        <div>
                          <span className="text-slate-500">Requester:</span>{" "}
                          <b>{r.requester_name || "—"}</b>
                        </div>
                        <div>
                          <span className="text-slate-500">Date:</span>{" "}
                          <b>{shortDate(r.created_at)}</b>
                        </div>
                      </div>

                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={() => router.push(`/requests/${r.id}/print`)}
                          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          Print
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden xl:block overflow-x-auto">
                  <div className="min-w-[1180px]">
                    <div className="grid grid-cols-13 bg-slate-100 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      <div className="col-span-2">Request No</div>
                      <div className="col-span-3">Title</div>
                      <div className="col-span-2">Type / Source</div>
                      <div className="col-span-1 text-right">Amount</div>
                      <div className="col-span-1">Status</div>
                      <div className="col-span-1">Requester</div>
                      <div className="col-span-1">Account</div>
                      <div className="col-span-1">Date</div>
                      <div className="col-span-1 text-right">Action</div>
                    </div>

                    {printableRequests.map((r) => (
                      <div
                        key={r.id}
                        className="grid grid-cols-13 items-center border-t px-6 py-4 text-sm hover:bg-slate-50"
                      >
                        <div className="col-span-2 font-extrabold text-slate-900">
                          {r.request_no}
                        </div>

                        <div className="col-span-3">
                          <div className="font-semibold text-slate-900">{r.title}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {requestPrintSource(r, subheadMap)}
                          </div>
                        </div>

                        <div className="col-span-2">
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                            {requestTypeLabel(r)}
                          </span>
                        </div>

                        <div className="col-span-1 text-right font-bold text-slate-900">
                          {naira(Number(r.amount || 0))}
                        </div>

                        <div className="col-span-1">
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                            {r.status}
                          </span>
                        </div>

                        <div className="col-span-1 text-slate-700">
                          {r.requester_name || "—"}
                        </div>

                        <div className="col-span-1 text-slate-700">
                          {r.account_name || "—"}
                        </div>

                        <div className="col-span-1 text-slate-600">
                          {shortDate(r.created_at)}
                        </div>

                        <div className="col-span-1 flex justify-end">
                          <button
                            onClick={() => router.push(`/requests/${r.id}/print`)}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            Print
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {editId ? "Edit Subhead" : "Create Subhead"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Create and manage departmental budget lines.
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

                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <MiniMetric title="Allocation" value={naira(Number(s.approved_allocation || 0))} tone="blue" />
                  <MiniMetric title="Reserved" value={naira(Number(s.reserved_amount || 0))} tone="amber" />
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

        <div className="mt-6 hidden xl:block rounded-3xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-slate-50 px-6 py-4">
            <h3 className="text-base font-bold text-slate-900">Subheads Register</h3>
            <p className="mt-1 text-sm text-slate-600">
              Allocation, reserved commitments, actual expenditure and remaining balance.
            </p>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[1320px]">
              <div className="grid grid-cols-17 bg-slate-100 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <div className="col-span-3">Department</div>
                <div className="col-span-2">Code</div>
                <div className="col-span-3">Subhead</div>
                <div className="col-span-2 text-right">Allocation</div>
                <div className="col-span-2 text-right">Reserved</div>
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
                    className="grid grid-cols-17 items-center border-t px-6 py-4 text-sm hover:bg-slate-50"
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
                        Updated {shortDate(s.updated_at)}
                      </div>
                    </div>

                    <div className="col-span-2 text-right font-semibold text-blue-700">
                      {naira(Number(s.approved_allocation || 0))}
                    </div>

                    <div className="col-span-2 text-right font-semibold text-amber-700">
                      {naira(Number(s.reserved_amount || 0))}
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
  tone: "slate" | "blue" | "red" | "emerald" | "amber";
}) {
  const toneClass =
    tone === "blue"
      ? "text-blue-700 bg-blue-50"
      : tone === "red"
      ? "text-red-700 bg-red-50"
      : tone === "emerald"
      ? "text-emerald-700 bg-emerald-50"
      : tone === "amber"
      ? "text-amber-700 bg-amber-50"
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
  tone: "blue" | "red" | "emerald" | "amber";
}) {
  const toneClass =
    tone === "blue"
      ? "bg-blue-50 text-blue-700"
      : tone === "red"
      ? "bg-red-50 text-red-700"
      : tone === "amber"
      ? "bg-amber-50 text-amber-700"
      : "bg-emerald-50 text-emerald-700";

  return (
    <div className={`rounded-2xl p-3 ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-wide">{title}</div>
      <div className="mt-2 text-sm font-extrabold">{value}</div>
    </div>
  );
}