"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { exportTableToExcel, printReport } from "@/lib/reportExport";

type Dept = { id: string; name: string };

type Subhead = {
  id: string;
  dept_id: string;
  code: string | null;
  name: string;
  approved_allocation: number | null;
  reserved_amount: number | null;
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

type MonthlyRow = {
  month: string;
  total: number;
};

type ExportRow = {
  section: string;
  sn: number | string;
  department: string;
  code: string;
  description: string;
  allocation: string;
  reserved: string;
  expenditure: string;
  balance: string;
  status: string;
};

function roleKey(role: string) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function naira(n: number) {
  return "₦ " + Math.round(n || 0).toLocaleString();
}

function plainAmount(n: number) {
  return Math.round(n || 0).toLocaleString();
}

function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function shortDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

export default function FinanceReportsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [myRole, setMyRole] = useState<string>("");
  const rk = roleKey(myRole);
  const canFinance = ["admin", "auditor", "account", "accounts", "accountofficer"].includes(rk);

  const [depts, setDepts] = useState<Dept[]>([]);
  const [subs, setSubs] = useState<Subhead[]>([]);
  const [approvedReqs, setApprovedReqs] = useState<ReqMini[]>([]);

  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState<string>(`${now.getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState<string>(`${now.getFullYear()}-12-31`);

  useEffect(() => {
    setDateFrom(`${year}-01-01`);
    setDateTo(`${year}-12-31`);
  }, [year]);

  async function loadBaseData() {
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

    if (!["admin", "auditor", "account", "accounts", "accountofficer"].includes(roleKey(r))) {
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
      .select("id,dept_id,code,name,approved_allocation,reserved_amount,expenditure,balance,is_active,updated_at")
      .order("name", { ascending: true });

    if (sErr) {
      setMsg("Failed to load subheads: " + sErr.message);
      setLoading(false);
      return;
    }

    setSubs((srows || []) as Subhead[]);
    setLoading(false);
  }

  async function loadApprovedRequests() {
    if (!canFinance) return;

    setMsg(null);

    const from = dateFrom;
    const toPlusOne = ymd(new Date(new Date(dateTo).getTime() + 24 * 60 * 60 * 1000));

    let q = supabase
      .from("requests")
      .select("id,amount,status,created_at")
      .or("status.ilike.%approve%,status.ilike.%paid%,status.ilike.%completed%")
      .gte("created_at", from)
      .lt("created_at", toPlusOne)
      .order("created_at", { ascending: true });

    if (deptFilter !== "ALL") {
      q = (q as any).eq("dept_id", deptFilter);
    }

    const { data, error } = await q;

    if (error) {
      setMsg("Failed to load approved/paid requests: " + error.message);
      setApprovedReqs([]);
      return;
    }

    setApprovedReqs((data || []) as ReqMini[]);
  }

  useEffect(() => {
    loadBaseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadApprovedRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFinance, dateFrom, dateTo, deptFilter]);

  const deptMap = useMemo(() => {
    const m: Record<string, Dept> = {};
    depts.forEach((d) => (m[d.id] = d));
    return m;
  }, [depts]);

  const selectedDepartmentName = useMemo(() => {
    if (deptFilter === "ALL") return "All Departments";
    return deptMap[deptFilter]?.name || "Selected Department";
  }, [deptFilter, deptMap]);

  const filteredSubs = useMemo(() => {
    if (deptFilter === "ALL") return subs;
    return subs.filter((s) => s.dept_id === deptFilter);
  }, [subs, deptFilter]);

  const budgetTotals = useMemo(() => {
    const annualBudget = filteredSubs.reduce(
      (a, s) => a + Number(s.approved_allocation || 0),
      0
    );
    const reserved = filteredSubs.reduce(
      (a, s) => a + Number(s.reserved_amount || 0),
      0
    );
    const totalExp = filteredSubs.reduce(
      (a, s) => a + Number(s.expenditure || 0),
      0
    );
    const remaining = filteredSubs.reduce(
      (a, s) => a + Number(s.balance || 0),
      0
    );

    const active = filteredSubs.filter((s) => s.is_active).length;
    const inactive = filteredSubs.filter((s) => !s.is_active).length;
    const negative = filteredSubs.filter((s) => Number(s.balance || 0) < 0).length;

    return { annualBudget, reserved, totalExp, remaining, active, inactive, negative };
  }, [filteredSubs]);

  const totalsByDept = useMemo(() => {
    const rows: Array<{
      dept_id: string;
      dept_name: string;
      allocation: number;
      reserved: number;
      expenditure: number;
      balance: number;
    }> = [];

    const acc: Record<
      string,
      { allocation: number; reserved: number; expenditure: number; balance: number }
    > = {};

    filteredSubs.forEach((s) => {
      const k = s.dept_id || "NO_DEPARTMENT";
      if (!acc[k]) {
        acc[k] = { allocation: 0, reserved: 0, expenditure: 0, balance: 0 };
      }

      acc[k].allocation += Number(s.approved_allocation || 0);
      acc[k].reserved += Number(s.reserved_amount || 0);
      acc[k].expenditure += Number(s.expenditure || 0);
      acc[k].balance += Number(s.balance || 0);
    });

    Object.keys(acc)
      .sort((a, b) => (deptMap[a]?.name || a).localeCompare(deptMap[b]?.name || b))
      .forEach((deptId) => {
        rows.push({
          dept_id: deptId,
          dept_name: deptMap[deptId]?.name || (deptId === "NO_DEPARTMENT" ? "No Department" : deptId),
          allocation: acc[deptId].allocation,
          reserved: acc[deptId].reserved,
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
    const labels = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const arr: MonthlyRow[] = Array.from({ length: 12 }, (_, i) => ({
      month: labels[i],
      total: 0,
    }));

    approvedReqs.forEach((r) => {
      const dt = new Date(r.created_at);
      const m = dt.getMonth();
      arr[m].total += Number(r.amount || 0);
    });

    const max = Math.max(1, ...arr.map((x) => x.total));
    const total = arr.reduce((a, x) => a + x.total, 0);

    return { arr, max, total };
  }, [approvedReqs]);

  function refreshReports() {
    loadBaseData();
    loadApprovedRequests();
  }

  function printFinanceReport() {
    printReport();
  }

  function exportExcel() {
    const summaryRows: ExportRow[] = [
      {
        section: "Summary",
        sn: 1,
        department: selectedDepartmentName,
        code: "",
        description: "Annual Budget / Approved Allocation",
        allocation: plainAmount(budgetTotals.annualBudget),
        reserved: "",
        expenditure: "",
        balance: "",
        status: "",
      },
      {
        section: "Summary",
        sn: 2,
        department: selectedDepartmentName,
        code: "",
        description: "Reserved Commitments",
        allocation: "",
        reserved: plainAmount(budgetTotals.reserved),
        expenditure: "",
        balance: "",
        status: "",
      },
      {
        section: "Summary",
        sn: 3,
        department: selectedDepartmentName,
        code: "",
        description: "Total Expenditure",
        allocation: "",
        reserved: "",
        expenditure: plainAmount(budgetTotals.totalExp),
        balance: "",
        status: "",
      },
      {
        section: "Summary",
        sn: 4,
        department: selectedDepartmentName,
        code: "",
        description: "Remaining Balance",
        allocation: "",
        reserved: "",
        expenditure: "",
        balance: plainAmount(budgetTotals.remaining),
        status: "",
      },
    ];

    const monthlyRows: ExportRow[] = monthly.arr.map((m, index) => ({
      section: "Monthly Expenditure",
      sn: index + 1,
      department: selectedDepartmentName,
      code: "",
      description: `${m.month} ${year}`,
      allocation: "",
      reserved: "",
      expenditure: plainAmount(m.total),
      balance: "",
      status: "",
    }));

    const deptRows: ExportRow[] = totalsByDept.map((d, index) => ({
      section: "Department Summary",
      sn: index + 1,
      department: d.dept_name,
      code: "",
      description: "Department allocation and expenditure summary",
      allocation: plainAmount(d.allocation),
      reserved: plainAmount(d.reserved),
      expenditure: plainAmount(d.expenditure),
      balance: plainAmount(d.balance),
      status: "",
    }));

    const subheadRows: ExportRow[] = expenditureBySubhead.map((s, index) => ({
      section: "Subhead Breakdown",
      sn: index + 1,
      department: deptMap[s.dept_id]?.name || s.dept_id || "—",
      code: s.code || "—",
      description: s.name || "—",
      allocation: plainAmount(Number(s.approved_allocation || 0)),
      reserved: plainAmount(Number(s.reserved_amount || 0)),
      expenditure: plainAmount(Number(s.expenditure || 0)),
      balance: plainAmount(Number(s.balance || 0)),
      status: s.is_active ? "Active" : "Inactive",
    }));

    const rows = [...summaryRows, ...monthlyRows, ...deptRows, ...subheadRows];

    exportTableToExcel<ExportRow>({
      fileName: `monthly_yearly_finance_report_${selectedDepartmentName}_${dateFrom}_to_${dateTo}`,
      sheetName: "Finance Report",
      title: "MONTHLY AND YEARLY FINANCE REPORT",
      subtitle: `Department: ${selectedDepartmentName} | Year: ${year} | Period: ${dateFrom} to ${dateTo}`,
      rows,
      columns: [
        { header: "Section", value: (row) => row.section },
        { header: "S/N", value: (row) => row.sn },
        { header: "Department", value: (row) => row.department },
        { header: "Code", value: (row) => row.code },
        { header: "Description", value: (row) => row.description },
        { header: "Allocation", value: (row) => row.allocation },
        { header: "Reserved", value: (row) => row.reserved },
        { header: "Expenditure", value: (row) => row.expenditure },
        { header: "Balance", value: (row) => row.balance },
        { header: "Status", value: (row) => row.status },
      ],
      footerRows: [
        [
          "Report Total",
          "",
          selectedDepartmentName,
          "",
          "",
          plainAmount(budgetTotals.annualBudget),
          plainAmount(budgetTotals.reserved),
          plainAmount(budgetTotals.totalExp),
          plainAmount(budgetTotals.remaining),
          "",
        ],
      ],
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-7xl py-10 text-slate-600">Loading...</div>
      </main>
    );
  }

  if (!canFinance) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-3xl py-10">
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <h1 className="text-xl font-extrabold text-slate-900">Finance Reports Access</h1>
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Access denied. Only Finance, Account, Auditor and Admin roles can access reports.
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4">
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }

          body {
            background: white !important;
          }

          .no-print {
            display: none !important;
          }

          .print-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: none !important;
          }

          .print-card {
            break-inside: avoid !important;
          }

          .print-title {
            text-align: center !important;
          }
        }
      `}</style>

      <div className="print-sheet mx-auto max-w-7xl py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="print-title">
            <div className="hidden text-center print:block">
              <div className="text-lg font-black uppercase text-slate-900">
                Islamic Education Trust
              </div>
              <div className="text-xs font-semibold text-slate-600">
                IW2, Ilmi Avenue Intermediate Housing Estate, PMB 229, Minna, Niger State - Nigeria
              </div>
              <div className="mt-3 border-y border-black py-2 text-base font-black uppercase">
                Monthly and Yearly Finance Report
              </div>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 print:mt-3 print:text-xl">
              Finance Reports Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Allocation, reserved commitments, expenditure, balances, and monthly spending.
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Department: {selectedDepartmentName} • Year: {year} • Period: {dateFrom} to {dateTo} • Generated:{" "}
              {new Date().toLocaleString()}
            </p>
          </div>

          <div className="no-print flex flex-wrap gap-2">
            <button
              onClick={refreshReports}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
            >
              Refresh
            </button>

            <button
              onClick={printFinanceReport}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Print / Save PDF
            </button>

            <button
              onClick={exportExcel}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              Export Excel
            </button>

            <button
              onClick={() => router.push("/finance/subheads")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Back to Finance
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
            {msg}
          </div>
        )}

        <div className="no-print mt-6 rounded-3xl border bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-sm font-semibold text-slate-800">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
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
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
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
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Date To</label>
              <input
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                type="date"
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-500">
            Monthly chart uses <b>Approved/Paid/Completed</b> requests within the selected date range.
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4 print:grid-cols-4">
          <KpiCard title="Annual Budget" value={naira(budgetTotals.annualBudget)} />
          <KpiCard title="Reserved" value={naira(budgetTotals.reserved)} />
          <KpiCard title="Total Expenditure" value={naira(budgetTotals.totalExp)} />
          <KpiCard title="Remaining Balance" value={naira(budgetTotals.remaining)} />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-4 print:grid-cols-4">
          <SmallCard title="Active Subheads" value={String(budgetTotals.active)} />
          <SmallCard title="Inactive Subheads" value={String(budgetTotals.inactive)} />
          <SmallCard title="Negative Balances" value={String(budgetTotals.negative)} />
          <SmallCard title="Monthly Request Value" value={naira(monthly.total)} />
        </div>

        <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm print:rounded-none print:border-black print:shadow-none">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Monthly Expenditure</h2>
              <p className="mt-1 text-sm text-slate-600">
                Approved/Paid/Completed requests totals per month ({year})
              </p>
            </div>
            <div className="text-xs text-slate-500">
              Range: {dateFrom} → {dateTo}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-12 items-end gap-2 h-40 print:hidden">
            {monthly.arr.map((m) => {
              const h = Math.round((m.total / monthly.max) * 100);

              return (
                <div key={m.month} className="flex flex-col items-center gap-2">
                  <div className="flex h-32 w-full items-end overflow-hidden rounded-lg bg-slate-100">
                    <div
                      className="w-full bg-blue-600"
                      style={{ height: `${h}%` }}
                      title={`${m.month}: ${naira(m.total)}`}
                    />
                  </div>
                  <div className="text-[11px] text-slate-600">{m.month}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-12 bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 print:bg-white print:text-[8px]">
                {monthly.arr.map((m) => (
                  <div key={m.month} className="text-center">
                    {m.month}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-12 border-t px-4 py-3 text-xs font-bold text-slate-900 print:text-[8px]">
                {monthly.arr.map((m) => (
                  <div key={m.month} className="text-center">
                    {naira(m.total)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 text-sm text-slate-700">
            Total request value in range:{" "}
            <b className="text-slate-900">{naira(monthly.total)}</b>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm print:rounded-none print:border-black print:shadow-none">
          <h2 className="text-lg font-bold text-slate-900">Total Allocation by Department</h2>
          <p className="mt-1 text-sm text-slate-600">
            Government-style summary by department.
          </p>

          {totalsByDept.length === 0 ? (
            <div className="mt-4 text-sm text-slate-700">No records.</div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <div className="min-w-[900px] print:min-w-0">
                <div className="grid grid-cols-14 bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600 print:bg-white print:text-[8px]">
                  <div className="col-span-4">Department</div>
                  <div className="col-span-3 text-right">Allocation</div>
                  <div className="col-span-2 text-right">Reserved</div>
                  <div className="col-span-3 text-right">Expenditure</div>
                  <div className="col-span-2 text-right">Balance</div>
                </div>

                {totalsByDept.map((r) => (
                  <div key={r.dept_id} className="grid grid-cols-14 border-t px-4 py-3 text-sm print:text-[8px]">
                    <div className="col-span-4 font-semibold text-slate-900">{r.dept_name}</div>
                    <div className="col-span-3 text-right font-semibold text-slate-900">
                      {naira(r.allocation)}
                    </div>
                    <div className="col-span-2 text-right font-semibold text-amber-700">
                      {naira(r.reserved)}
                    </div>
                    <div className="col-span-3 text-right text-red-700">
                      {naira(r.expenditure)}
                    </div>
                    <div className="col-span-2 text-right font-semibold text-emerald-700">
                      {naira(r.balance)}
                    </div>
                  </div>
                ))}

                <div className="grid grid-cols-14 border-t bg-slate-50 px-4 py-3 text-sm font-black print:bg-white print:text-[8px]">
                  <div className="col-span-4 uppercase text-slate-900">Total</div>
                  <div className="col-span-3 text-right text-slate-900">
                    {naira(budgetTotals.annualBudget)}
                  </div>
                  <div className="col-span-2 text-right text-amber-700">
                    {naira(budgetTotals.reserved)}
                  </div>
                  <div className="col-span-3 text-right text-red-700">
                    {naira(budgetTotals.totalExp)}
                  </div>
                  <div className="col-span-2 text-right text-emerald-700">
                    {naira(budgetTotals.remaining)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm print:rounded-none print:border-black print:shadow-none">
          <h2 className="text-lg font-bold text-slate-900">Total Expenditure by Subhead</h2>
          <p className="mt-1 text-sm text-slate-600">
            Detailed breakdown by subhead code.
          </p>

          {expenditureBySubhead.length === 0 ? (
            <div className="mt-4 text-sm text-slate-700">No subheads.</div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <div className="min-w-[1100px] print:min-w-0">
                <div className="grid grid-cols-17 bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600 print:bg-white print:text-[8px]">
                  <div className="col-span-3">Dept</div>
                  <div className="col-span-2">Code</div>
                  <div className="col-span-4">Subhead</div>
                  <div className="col-span-2 text-right">Allocation</div>
                  <div className="col-span-2 text-right">Reserved</div>
                  <div className="col-span-2 text-right">Expenditure</div>
                  <div className="col-span-2 text-right">Balance</div>
                </div>

                {expenditureBySubhead.slice(0, 80).map((s) => (
                  <div key={s.id} className="grid grid-cols-17 border-t px-4 py-3 text-sm print:text-[8px]">
                    <div className="col-span-3 text-slate-800">
                      {deptMap[s.dept_id]?.name || s.dept_id}
                    </div>
                    <div className="col-span-2 font-semibold text-slate-900">
                      {s.code || "—"}
                    </div>
                    <div className="col-span-4 text-slate-900">{s.name}</div>
                    <div className="col-span-2 text-right font-semibold text-blue-700">
                      {naira(Number(s.approved_allocation || 0))}
                    </div>
                    <div className="col-span-2 text-right font-semibold text-amber-700">
                      {naira(Number(s.reserved_amount || 0))}
                    </div>
                    <div className="col-span-2 text-right text-red-700">
                      {naira(Number(s.expenditure || 0))}
                    </div>
                    <div className="col-span-2 text-right font-semibold text-emerald-700">
                      {naira(Number(s.balance || 0))}
                    </div>
                  </div>
                ))}

                <div className="grid grid-cols-17 border-t bg-slate-50 px-4 py-3 text-sm font-black print:bg-white print:text-[8px]">
                  <div className="col-span-9 uppercase text-slate-900">Total</div>
                  <div className="col-span-2 text-right text-blue-700">
                    {naira(budgetTotals.annualBudget)}
                  </div>
                  <div className="col-span-2 text-right text-amber-700">
                    {naira(budgetTotals.reserved)}
                  </div>
                  <div className="col-span-2 text-right text-red-700">
                    {naira(budgetTotals.totalExp)}
                  </div>
                  <div className="col-span-2 text-right text-emerald-700">
                    {naira(budgetTotals.remaining)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {expenditureBySubhead.length > 80 && (
            <div className="mt-3 text-xs text-slate-500 print:hidden">
              Showing first 80 rows on screen. Use Export Excel for the full list.
            </div>
          )}
        </div>

        <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900 print:border-t print:border-black print:bg-white print:text-black">
          <div className="font-bold">Monthly and Yearly Reports Note</div>
          <p className="mt-1">
            This report summarizes yearly budget allocation, reserved commitments, expenditure,
            remaining balance and monthly approved/paid/completed request values. It supports
            management review, finance planning and internal reconciliation.
          </p>
        </div>
      </div>
    </main>
  );
}

function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="print-card rounded-3xl border bg-white p-6 shadow-sm print:rounded-none print:border-black print:p-2 print:shadow-none">
      <div className="text-sm font-semibold text-slate-600 print:text-[9px]">{title}</div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 print:text-[11px]">
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-500 print:text-[8px]">NGN</div>
    </div>
  );
}

function SmallCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="print-card rounded-2xl border bg-white p-4 shadow-sm print:rounded-none print:border-black print:p-2 print:shadow-none">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 print:text-[8px]">
        {title}
      </div>
      <div className="mt-2 text-lg font-extrabold text-slate-900 print:text-[10px]">
        {value}
      </div>
    </div>
  );
}