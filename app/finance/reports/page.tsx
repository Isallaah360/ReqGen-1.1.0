"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Dept = { id: string; name: string };
type Subhead = {
  id: string;
  dept_id: string;
  code: string | null;
  name: string;
  approved_allocation: number | null;
  expenditure: number | null;
  balance: number | null;
  is_active: boolean | null;
  updated_at: string | null;
};

type ReqMini = {
  id: string;
  amount: number | null;
  status: string | null;
  created_at: string;
};

function naira(n: number) {
  return "₦ " + Math.round(n).toLocaleString();
}

function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function FinanceReportsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [myRole, setMyRole] = useState<string>("");
  const canFinance = ["Admin", "Auditor", "AccountOfficer"].includes(myRole);

  const [depts, setDepts] = useState<Dept[]>([]);
  const [subs, setSubs] = useState<Subhead[]>([]);
  const [approvedReqs, setApprovedReqs] = useState<ReqMini[]>([]);

  // filters
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState<string>(`${year}-01-01`);
  const [dateTo, setDateTo] = useState<string>(`${year}-12-31`);

  useEffect(() => {
    setDateFrom(`${year}-01-01`);
    setDateTo(`${year}-12-31`);
  }, [year]);

  useEffect(() => {
    async function load() {
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

      const r = (prof?.role || "Staff") as string;
      setMyRole(r);

      if (!["Admin", "Auditor", "AccountOfficer"].includes(r)) {
        router.push("/dashboard");
        return;
      }

      const { data: drows, error: dErr } = await supabase
        .from("departments")
        .select("id,name")
        .order("name", { ascending: true });

      if (dErr) {
        setMsg("Failed to load departments: " + dErr.message);
        setLoading(false);
        return;
      }
      setDepts((drows || []) as Dept[]);

      const { data: srows, error: sErr } = await supabase
        .from("subheads")
        .select("id,dept_id,code,name,approved_allocation,expenditure,balance,is_active,updated_at")
        .order("name", { ascending: true });

      if (sErr) {
        setMsg("Failed to load subheads: " + sErr.message);
        setLoading(false);
        return;
      }
      setSubs((srows || []) as Subhead[]);

      setLoading(false);
    }

    load();
  }, [router]);

  useEffect(() => {
    async function loadApproved() {
      if (!canFinance) return;

      setMsg(null);

      const from = dateFrom;
      const toPlusOne = ymd(new Date(new Date(dateTo).getTime() + 24 * 60 * 60 * 1000));

      let q = supabase
        .from("requests")
        .select("id,amount,status,created_at")
        .ilike("status", "%approve%")
        .gte("created_at", from)
        .lt("created_at", toPlusOne)
        .order("created_at", { ascending: true });

      if (deptFilter !== "ALL") {
        q = (q as any).eq("dept_id", deptFilter);
      }

      const { data, error } = await q;

      if (error) {
        setMsg("Failed to load approved requests: " + error.message);
        setApprovedReqs([]);
        return;
      }

      setApprovedReqs((data || []) as ReqMini[]);
    }

    loadApproved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFinance, dateFrom, dateTo, deptFilter]);

  const deptMap = useMemo(() => {
    const m: Record<string, Dept> = {};
    depts.forEach((d) => (m[d.id] = d));
    return m;
  }, [depts]);

  const filteredSubs = useMemo(() => {
    if (deptFilter === "ALL") return subs;
    return subs.filter((s) => s.dept_id === deptFilter);
  }, [subs, deptFilter]);

  const budgetTotals = useMemo(() => {
    const annualBudget = filteredSubs.reduce((a, s) => a + Number(s.approved_allocation || 0), 0);
    const totalExp = filteredSubs.reduce((a, s) => a + Number(s.expenditure || 0), 0);
    const remaining = filteredSubs.reduce((a, s) => a + Number(s.balance || 0), 0);
    return { annualBudget, totalExp, remaining };
  }, [filteredSubs]);

  const totalsByDept = useMemo(() => {
    const rows: Array<{
      dept_id: string;
      dept_name: string;
      allocation: number;
      expenditure: number;
      balance: number;
    }> = [];

    const acc: Record<string, { allocation: number; expenditure: number; balance: number }> = {};

    filteredSubs.forEach((s) => {
      const k = s.dept_id;
      if (!acc[k]) acc[k] = { allocation: 0, expenditure: 0, balance: 0 };
      acc[k].allocation += Number(s.approved_allocation || 0);
      acc[k].expenditure += Number(s.expenditure || 0);
      acc[k].balance += Number(s.balance || 0);
    });

    Object.keys(acc)
      .sort((a, b) => (deptMap[a]?.name || "").localeCompare(deptMap[b]?.name || ""))
      .forEach((deptId) => {
        rows.push({
          dept_id: deptId,
          dept_name: deptMap[deptId]?.name || deptId,
          allocation: acc[deptId].allocation,
          expenditure: acc[deptId].expenditure,
          balance: acc[deptId].balance,
        });
      });

    return rows;
  }, [filteredSubs, deptMap]);

  const expenditureBySubhead = useMemo(() => {
    return [...filteredSubs].sort((a, b) => {
      const ea = Number(b.expenditure || 0) - Number(a.expenditure || 0);
      if (ea !== 0) return ea;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [filteredSubs]);

  const monthly = useMemo(() => {
    const arr = Array.from({ length: 12 }, (_, i) => ({ month: i, total: 0 }));
    approvedReqs.forEach((r) => {
      const dt = new Date(r.created_at);
      const m = dt.getMonth();
      arr[m].total += Number(r.amount || 0);
    });
    const max = Math.max(1, ...arr.map((x) => x.total));
    return { arr, max };
  }, [approvedReqs]);

  function exportCSV() {
    const lines: string[] = [];
    lines.push(
      [
        "Department",
        "Subhead Code",
        "Subhead Name",
        "Approved Allocation (NGN)",
        "Expenditure (NGN)",
        "Balance (NGN)",
        "Is Active",
        "Updated At",
      ].join(",")
    );

    expenditureBySubhead.forEach((s) => {
      const deptName = deptMap[s.dept_id]?.name || s.dept_id;
      const row = [
        csv(deptName),
        csv(s.code || ""),
        csv(s.name || ""),
        String(Number(s.approved_allocation || 0)),
        String(Number(s.expenditure || 0)),
        String(Number(s.balance || 0)),
        String(Boolean(s.is_active)),
        csv(s.updated_at || ""),
      ];
      lines.push(row.join(","));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-report-${deptFilter}-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openPDF() {
    // ✅ SAFE PRINT: store filters then open print page without query params
    localStorage.setItem(
      "fin_print_filters",
      JSON.stringify({
        deptId: deptFilter,
        dateFrom,
        dateTo,
        year,
      })
    );

    window.open("/finance/reports/print", "_blank");
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
              Finance Reports Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Mini government finance view: budget, expenditure, balances, and monthly spending.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportCSV}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Export Excel (CSV)
            </button>
            <button
              onClick={openPDF}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Export PDF
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">
            {msg}
          </div>
        )}

        {/* Filters */}
        <div className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-sm font-semibold text-slate-800">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              >
                {Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Department</label>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Departments</option>
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Date From</label>
              <input
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Date To</label>
              <input
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-500">
            Monthly chart uses <b>Approved</b> requests within the date range.
          </div>
        </div>

        {/* Budget Tracking cards */}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <KpiCard title="Annual Budget" value={naira(budgetTotals.annualBudget)} />
          <KpiCard title="Total Expenditure" value={naira(budgetTotals.totalExp)} />
          <KpiCard title="Remaining Balance" value={naira(budgetTotals.remaining)} />
        </div>

        {/* Monthly chart */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Monthly Expenditure</h2>
              <p className="mt-1 text-sm text-slate-600">
                Approved requests totals per month ({year})
              </p>
            </div>
            <div className="text-xs text-slate-500">
              Range: {dateFrom} → {dateTo}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-12 gap-2 items-end h-40">
            {monthly.arr.map((m) => {
              const h = Math.round((m.total / monthly.max) * 100);
              const label = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m.month];
              return (
                <div key={m.month} className="flex flex-col items-center gap-2">
                  <div className="w-full rounded-lg bg-slate-100 overflow-hidden h-32 flex items-end">
                    <div
                      className="w-full bg-blue-600"
                      style={{ height: `${h}%` }}
                      title={`${label}: ${naira(m.total)}`}
                    />
                  </div>
                  <div className="text-[11px] text-slate-600">{label}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 text-sm text-slate-700">
            Total approved spending in range:{" "}
            <b className="text-slate-900">{naira(monthly.arr.reduce((a, x) => a + x.total, 0))}</b>
          </div>
        </div>

        {/* Totals by Department */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Total Allocation by Department</h2>
          <p className="mt-1 text-sm text-slate-600">Government-style summary by ministry/department.</p>

          {totalsByDept.length === 0 ? (
            <div className="mt-4 text-sm text-slate-700">No records.</div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-12 bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600">
                <div className="col-span-4">Department</div>
                <div className="col-span-3 text-right">Allocation</div>
                <div className="col-span-3 text-right">Expenditure</div>
                <div className="col-span-2 text-right">Balance</div>
              </div>

              {totalsByDept.map((r) => (
                <div key={r.dept_id} className="grid grid-cols-12 border-t px-4 py-3 text-sm">
                  <div className="col-span-4 font-semibold text-slate-900">{r.dept_name}</div>
                  <div className="col-span-3 text-right text-slate-900 font-semibold">{naira(r.allocation)}</div>
                  <div className="col-span-3 text-right text-slate-900">{naira(r.expenditure)}</div>
                  <div className="col-span-2 text-right font-semibold text-slate-900">{naira(r.balance)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expenditure by Subhead */}
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Total Expenditure by Subhead</h2>
          <p className="mt-1 text-sm text-slate-600">Detailed breakdown by subhead code.</p>

          {expenditureBySubhead.length === 0 ? (
            <div className="mt-4 text-sm text-slate-700">No subheads.</div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-12 bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600">
                <div className="col-span-3">Dept</div>
                <div className="col-span-2">Code</div>
                <div className="col-span-3">Subhead</div>
                <div className="col-span-2 text-right">Expenditure</div>
                <div className="col-span-2 text-right">Balance</div>
              </div>

              {expenditureBySubhead.slice(0, 60).map((s) => (
                <div key={s.id} className="grid grid-cols-12 border-t px-4 py-3 text-sm">
                  <div className="col-span-3 text-slate-800">{deptMap[s.dept_id]?.name || s.dept_id}</div>
                  <div className="col-span-2 font-semibold text-slate-900">{s.code || "—"}</div>
                  <div className="col-span-3 text-slate-900">{s.name}</div>
                  <div className="col-span-2 text-right text-slate-900">{naira(Number(s.expenditure || 0))}</div>
                  <div className="col-span-2 text-right font-semibold text-slate-900">{naira(Number(s.balance || 0))}</div>
                </div>
              ))}
            </div>
          )}

          {expenditureBySubhead.length > 60 && (
            <div className="mt-3 text-xs text-slate-500">Showing first 60 rows. Use Export for full list.</div>
          )}
        </div>
      </div>
    </main>
  );
}

function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="text-sm font-semibold text-slate-600">{title}</div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">NGN</div>
    </div>
  );
}

function csv(v: string) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}