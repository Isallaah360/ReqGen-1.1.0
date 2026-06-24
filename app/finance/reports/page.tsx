"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { exportTableToExcel, printReport } from "@/lib/reportExport";

type Dept = { id: string; name: string };

type Subhead = {
  id: string;
  dept_id: string | null;
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
  dept_id: string | null;
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

type TabKey = "overview" | "departments" | "subheads" | "monthly";

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function naira(n: number | null | undefined) {
  return "₦ " + Math.round(Number(n || 0)).toLocaleString();
}

function plainAmount(n: number | null | undefined) {
  return Math.round(Number(n || 0)).toLocaleString();
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

function buildDeptMap(depts: Dept[]) {
  const m: Record<string, Dept> = {};
  depts.forEach((d) => {
    m[d.id] = d;
  });
  return m;
}

function getSelectedDepartmentName(deptFilter: string, deptMap: Record<string, Dept>) {
  if (deptFilter === "ALL") return "All Departments";
  return deptMap[deptFilter]?.name || "Selected Department";
}

function getFilteredSubs(subs: Subhead[], deptFilter: string) {
  if (deptFilter === "ALL") return subs;
  return subs.filter((s) => s.dept_id === deptFilter);
}

function getBudgetTotals(filteredSubs: Subhead[]) {
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

  const active = filteredSubs.filter((s) => s.is_active !== false).length;
  const inactive = filteredSubs.filter((s) => s.is_active === false).length;
  const negative = filteredSubs.filter((s) => Number(s.balance || 0) < 0).length;
  const lowBalance = filteredSubs.filter((s) => {
    const allocation = Number(s.approved_allocation || 0);
    const balance = Number(s.balance || 0);
    return allocation > 0 && balance >= 0 && balance / allocation <= 0.1;
  }).length;

  return {
    annualBudget,
    reserved,
    totalExp,
    remaining,
    active,
    inactive,
    negative,
    lowBalance,
    totalSubheads: filteredSubs.length,
  };
}

function getTotalsByDept(filteredSubs: Subhead[], deptMap: Record<string, Dept>) {
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

  return Object.keys(acc)
    .sort((a, b) => (deptMap[a]?.name || a).localeCompare(deptMap[b]?.name || b))
    .map((deptId) => ({
      dept_id: deptId,
      dept_name: deptMap[deptId]?.name || (deptId === "NO_DEPARTMENT" ? "No Department" : deptId),
      allocation: acc[deptId].allocation,
      reserved: acc[deptId].reserved,
      expenditure: acc[deptId].expenditure,
      balance: acc[deptId].balance,
    }));
}

function getMonthlyRows(requests: ReqMini[]) {
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const arr: MonthlyRow[] = Array.from({ length: 12 }, (_, i) => ({
    month: labels[i],
    total: 0,
  }));

  requests.forEach((r) => {
    const dt = new Date(r.created_at);
    const m = dt.getMonth();

    if (m >= 0 && m <= 11) {
      arr[m].total += Number(r.amount || 0);
    }
  });

  const max = Math.max(1, ...arr.map((x) => x.total));
  const total = arr.reduce((a, x) => a + x.total, 0);

  return { arr, max, total };
}

export default function FinanceReportsPage() {
  const router = useRouter();

  const currentDate = new Date();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [myRole, setMyRole] = useState<string>("Staff");
  const rk = roleKey(myRole);
  const canFinance = ["admin", "auditor", "account", "accounts", "accountofficer"].includes(rk);

  const [depts, setDepts] = useState<Dept[]>([]);
  const [subs, setSubs] = useState<Subhead[]>([]);
  const [approvedReqs, setApprovedReqs] = useState<ReqMini[]>([]);

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [search, setSearch] = useState("");

  const [year, setYear] = useState<number>(currentDate.getFullYear());
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState<string>(`${currentDate.getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState<string>(`${currentDate.getFullYear()}-12-31`);

  useEffect(() => {
    setDateFrom(`${year}-01-01`);
    setDateTo(`${year}-12-31`);
  }, [year]);

  const loadBaseData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (options?.silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMsg(null);

      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) {
        router.push("/login");
        return null;
      }

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (profErr) {
        setMsg("Failed to load role: " + profErr.message);
        setLoading(false);
        setRefreshing(false);
        return null;
      }

      const role = (prof?.role || "Staff") as string;
      setMyRole(role);

      if (!["admin", "auditor", "account", "accounts", "accountofficer"].includes(roleKey(role))) {
        router.push(`/dashboard?updated=${Date.now()}`);
        router.refresh();
        return null;
      }

      const [deptRes, subheadRes] = await Promise.all([
        supabase.from("departments").select("id,name").order("name", { ascending: true }),

        supabase
          .from("subheads")
          .select("id,dept_id,code,name,approved_allocation,reserved_amount,expenditure,balance,is_active,updated_at")
          .order("name", { ascending: true }),
      ]);

      if (deptRes.error) {
        setMsg("Failed to load departments: " + deptRes.error.message);
        setLoading(false);
        setRefreshing(false);
        return null;
      }

      if (subheadRes.error) {
        setMsg("Failed to load subheads: " + subheadRes.error.message);
        setLoading(false);
        setRefreshing(false);
        return null;
      }

      const freshDepts = (deptRes.data || []) as Dept[];
      const freshSubs = (subheadRes.data || []) as Subhead[];

      setDepts(freshDepts);
      setSubs(freshSubs);

      setLoading(false);
      setRefreshing(false);

      return { depts: freshDepts, subs: freshSubs };
    },
    [router]
  );

  const loadApprovedRequests = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!canFinance) return [];

      if (options?.silent) {
        setRefreshing(true);
      }

      setMsg(null);

      const toPlusOne = ymd(new Date(new Date(dateTo).getTime() + 24 * 60 * 60 * 1000));

      let q = supabase
        .from("requests")
        .select("id,amount,status,created_at,dept_id")
        .or("status.ilike.%approve%,status.ilike.%paid%,status.ilike.%completed%")
        .gte("created_at", dateFrom)
        .lt("created_at", toPlusOne)
        .order("created_at", { ascending: true });

      if (deptFilter !== "ALL") {
        q = q.eq("dept_id", deptFilter);
      }

      const { data, error } = await q;

      if (error) {
        setMsg("Failed to load approved/paid requests: " + error.message);
        setApprovedReqs([]);
        setRefreshing(false);
        return [];
      }

      const freshRequests = (data || []) as ReqMini[];
      setApprovedReqs(freshRequests);
      setRefreshing(false);

      return freshRequests;
    },
    [canFinance, dateFrom, dateTo, deptFilter]
  );

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    loadApprovedRequests();
  }, [loadApprovedRequests]);

  useEffect(() => {
    const refreshOnFocus = () => {
      refreshReports();
    };

    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") {
        refreshReports();
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisible);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadBaseData, loadApprovedRequests]);

  const deptMap = useMemo(() => buildDeptMap(depts), [depts]);

  const selectedDepartmentName = useMemo(() => {
    return getSelectedDepartmentName(deptFilter, deptMap);
  }, [deptFilter, deptMap]);

  const filteredSubs = useMemo(() => {
    return getFilteredSubs(subs, deptFilter);
  }, [subs, deptFilter]);

  const searchedSubs = useMemo(() => {
    const s = search.trim().toLowerCase();

    if (!s) return filteredSubs;

    return filteredSubs.filter((x) => {
      const haystack = [
        deptMap[x.dept_id || ""]?.name,
        x.code,
        x.name,
        x.is_active === false ? "inactive" : "active",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(s);
    });
  }, [filteredSubs, search, deptMap]);

  const budgetTotals = useMemo(() => getBudgetTotals(filteredSubs), [filteredSubs]);

  const totalsByDept = useMemo(() => getTotalsByDept(filteredSubs, deptMap), [filteredSubs, deptMap]);

  const expenditureBySubhead = useMemo(() => {
    return [...searchedSubs].sort((a, b) => {
      const diff = Number(b.expenditure || 0) - Number(a.expenditure || 0);
      if (diff !== 0) return diff;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [searchedSubs]);

  const monthly = useMemo(() => getMonthlyRows(approvedReqs), [approvedReqs]);

  async function refreshReports() {
    setRefreshing(true);
    await loadBaseData({ silent: true });
    await loadApprovedRequests({ silent: true });
    setRefreshing(false);
    router.refresh();
  }

  async function printFinanceReport() {
    setPrinting(true);
    await refreshReports();

    setTimeout(() => {
      printReport();
      setPrinting(false);
    }, 250);
  }

  async function exportExcel() {
    setExporting(true);

    const freshBase = await loadBaseData({ silent: true });
    const freshRequests = await loadApprovedRequests({ silent: true });

    const exportDepts = freshBase?.depts || depts;
    const exportSubsAll = freshBase?.subs || subs;
    const exportDeptMap = buildDeptMap(exportDepts);
    const exportFilteredSubs = getFilteredSubs(exportSubsAll, deptFilter);
    const exportBudgetTotals = getBudgetTotals(exportFilteredSubs);
    const exportTotalsByDept = getTotalsByDept(exportFilteredSubs, exportDeptMap);
    const exportMonthly = getMonthlyRows(freshRequests || approvedReqs);
    const exportSelectedDepartmentName = getSelectedDepartmentName(deptFilter, exportDeptMap);

    const summaryRows: ExportRow[] = [
      {
        section: "Summary",
        sn: 1,
        department: exportSelectedDepartmentName,
        code: "",
        description: "Annual Budget / Approved Allocation",
        allocation: plainAmount(exportBudgetTotals.annualBudget),
        reserved: "",
        expenditure: "",
        balance: "",
        status: "",
      },
      {
        section: "Summary",
        sn: 2,
        department: exportSelectedDepartmentName,
        code: "",
        description: "Reserved Commitments",
        allocation: "",
        reserved: plainAmount(exportBudgetTotals.reserved),
        expenditure: "",
        balance: "",
        status: "",
      },
      {
        section: "Summary",
        sn: 3,
        department: exportSelectedDepartmentName,
        code: "",
        description: "Total Expenditure",
        allocation: "",
        reserved: "",
        expenditure: plainAmount(exportBudgetTotals.totalExp),
        balance: "",
        status: "",
      },
      {
        section: "Summary",
        sn: 4,
        department: exportSelectedDepartmentName,
        code: "",
        description: "Remaining Balance",
        allocation: "",
        reserved: "",
        expenditure: "",
        balance: plainAmount(exportBudgetTotals.remaining),
        status: "",
      },
    ];

    const monthlyRows: ExportRow[] = exportMonthly.arr.map((m, index) => ({
      section: "Monthly Expenditure",
      sn: index + 1,
      department: exportSelectedDepartmentName,
      code: "",
      description: `${m.month} ${year}`,
      allocation: "",
      reserved: "",
      expenditure: plainAmount(m.total),
      balance: "",
      status: "",
    }));

    const deptRows: ExportRow[] = exportTotalsByDept.map((d, index) => ({
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

    const subheadRows: ExportRow[] = exportFilteredSubs.map((s, index) => ({
      section: "Subhead Breakdown",
      sn: index + 1,
      department: exportDeptMap[s.dept_id || ""]?.name || s.dept_id || "—",
      code: s.code || "—",
      description: s.name || "—",
      allocation: plainAmount(s.approved_allocation),
      reserved: plainAmount(s.reserved_amount),
      expenditure: plainAmount(s.expenditure),
      balance: plainAmount(s.balance),
      status: s.is_active === false ? "Inactive" : "Active",
    }));

    const rows = [...summaryRows, ...monthlyRows, ...deptRows, ...subheadRows];

    exportTableToExcel<ExportRow>({
      fileName: `monthly_yearly_finance_report_${exportSelectedDepartmentName}_${dateFrom}_to_${dateTo}`,
      sheetName: "Finance Report",
      title: "MONTHLY AND YEARLY FINANCE REPORT",
      subtitle: `Department: ${exportSelectedDepartmentName} | Year: ${year} | Period: ${dateFrom} to ${dateTo}`,
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
          exportSelectedDepartmentName,
          "",
          "",
          plainAmount(exportBudgetTotals.annualBudget),
          plainAmount(exportBudgetTotals.reserved),
          plainAmount(exportBudgetTotals.totalExp),
          plainAmount(exportBudgetTotals.remaining),
          "",
        ],
      ],
    });

    setExporting(false);
  }

  function backToFinance() {
    router.push(`/finance?updated=${Date.now()}`);
    router.refresh();
  }

  function openSubheads() {
    router.push(`/finance/subheads?updated=${Date.now()}`);
    router.refresh();
  }

  function openAudit() {
    router.push(`/finance/audit?updated=${Date.now()}`);
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-7xl py-10 text-slate-600">Loading Finance Reports...</div>
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
              onClick={() => router.push(`/dashboard?updated=${Date.now()}`)}
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
          @page { size: A4 landscape; margin: 10mm; }

          body { background: white !important; }

          .no-print { display: none !important; }

          .print-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: none !important;
          }

          .print-card { break-inside: avoid !important; }

          .print-title { text-align: center !important; }
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
              Allocation, reserved commitments, expenditure, balances and monthly spending.
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Department: {selectedDepartmentName} • Year: {year} • Period: {dateFrom} to {dateTo} • Generated:{" "}
              {new Date().toLocaleString()}
            </p>
          </div>

          <div className="no-print flex flex-wrap gap-2">
            <button
              onClick={refreshReports}
              disabled={refreshing || printing || exporting}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={printFinanceReport}
              disabled={refreshing || printing || exporting}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {printing ? "Preparing..." : "Print / Save PDF"}
            </button>

            <button
              onClick={exportExcel}
              disabled={refreshing || printing || exporting}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {exporting ? "Exporting..." : "Export Excel"}
            </button>

            <button
              onClick={openSubheads}
              disabled={refreshing || printing || exporting}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              Subheads
            </button>

            <button
              onClick={openAudit}
              disabled={refreshing || printing || exporting}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
            >
              Audit
            </button>

            <button
              onClick={backToFinance}
              disabled={refreshing || printing || exporting}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
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

        <div className="no-print mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-900">
          This report page refreshes automatically when you return to it. Print and Excel export reload fresh finance data first.
        </div>

        <div className="no-print mt-6 rounded-3xl border bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-sm font-semibold text-slate-800">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                {Array.from({ length: 7 }, (_, i) => currentDate.getFullYear() - 3 + i).map((y) => (
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

          <div className="mt-4">
            <label className="text-sm font-semibold text-slate-800">Search Subheads</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by department, code, subhead name or status..."
              className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
            />
          </div>

          <div className="mt-3 text-xs text-slate-500">
            Monthly chart uses <b>Approved/Paid/Completed</b> requests within the selected date range.
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4 print:grid-cols-4">
          <KpiCard title="Annual Budget" value={naira(budgetTotals.annualBudget)} tone="blue" />
          <KpiCard title="Reserved" value={naira(budgetTotals.reserved)} tone="amber" />
          <KpiCard title="Total Expenditure" value={naira(budgetTotals.totalExp)} tone="red" />
          <KpiCard title="Remaining Balance" value={naira(budgetTotals.remaining)} tone="emerald" />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-5 print:grid-cols-5">
          <SmallCard title="Total Subheads" value={String(budgetTotals.totalSubheads)} />
          <SmallCard title="Active Subheads" value={String(budgetTotals.active)} />
          <SmallCard title="Inactive Subheads" value={String(budgetTotals.inactive)} />
          <SmallCard title="Negative Balances" value={String(budgetTotals.negative)} />
          <SmallCard title="Monthly Request Value" value={naira(monthly.total)} />
        </div>

        <div className="no-print mt-6 rounded-3xl border bg-white p-2 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <TabButton label="Overview" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
            <TabButton label="Monthly" active={activeTab === "monthly"} onClick={() => setActiveTab("monthly")} />
            <TabButton label="Departments" active={activeTab === "departments"} onClick={() => setActiveTab("departments")} />
            <TabButton label="Subheads" active={activeTab === "subheads"} onClick={() => setActiveTab("subheads")} />
          </div>
        </div>

        {(activeTab === "overview" || activeTab === "monthly") && (
          <MonthlyPanel monthly={monthly} year={year} dateFrom={dateFrom} dateTo={dateTo} />
        )}

        {(activeTab === "overview" || activeTab === "departments") && (
          <DepartmentSummaryPanel rows={totalsByDept} totals={budgetTotals} />
        )}

        {(activeTab === "overview" || activeTab === "subheads") && (
          <SubheadBreakdownPanel
            rows={expenditureBySubhead}
            deptMap={deptMap}
            totals={budgetTotals}
          />
        )}

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

function MonthlyPanel({
  monthly,
  year,
  dateFrom,
  dateTo,
}: {
  monthly: { arr: MonthlyRow[]; max: number; total: number };
  year: number;
  dateFrom: string;
  dateTo: string;
}) {
  return (
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

      <div className="mt-4 grid h-40 grid-cols-12 items-end gap-2 print:hidden">
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
        <table className="min-w-[720px] w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 uppercase tracking-wide text-slate-600 print:bg-white print:text-[8px]">
              {monthly.arr.map((m) => (
                <th key={m.month} className="px-3 py-3 text-center">
                  {m.month}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t font-bold text-slate-900 print:text-[8px]">
              {monthly.arr.map((m) => (
                <td key={m.month} className="px-3 py-3 text-center">
                  {naira(m.total)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-sm text-slate-700">
        Total request value in range: <b className="text-slate-900">{naira(monthly.total)}</b>
      </div>
    </div>
  );
}

function DepartmentSummaryPanel({
  rows,
  totals,
}: {
  rows: Array<{
    dept_id: string;
    dept_name: string;
    allocation: number;
    reserved: number;
    expenditure: number;
    balance: number;
  }>;
  totals: ReturnType<typeof getBudgetTotals>;
}) {
  return (
    <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm print:rounded-none print:border-black print:shadow-none">
      <h2 className="text-lg font-bold text-slate-900">Total Allocation by Department</h2>
      <p className="mt-1 text-sm text-slate-600">Government-style summary by department.</p>

      {rows.length === 0 ? (
        <div className="mt-4 text-sm text-slate-700">No records.</div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[900px] w-full border-collapse text-sm print:min-w-0 print:text-[8px]">
            <thead>
              <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 print:bg-white print:text-[8px]">
                <th className="px-4 py-3 text-left">Department</th>
                <th className="px-4 py-3 text-right">Allocation</th>
                <th className="px-4 py-3 text-right">Reserved</th>
                <th className="px-4 py-3 text-right">Expenditure</th>
                <th className="px-4 py-3 text-right">Balance</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => (
                <tr key={r.dept_id} className="border-t">
                  <td className="px-4 py-3 font-semibold text-slate-900">{r.dept_name}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{naira(r.allocation)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-700">{naira(r.reserved)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-700">{naira(r.expenditure)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">{naira(r.balance)}</td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr className="border-t bg-slate-50 font-black print:bg-white">
                <td className="px-4 py-3 uppercase text-slate-900">Total</td>
                <td className="px-4 py-3 text-right text-slate-900">{naira(totals.annualBudget)}</td>
                <td className="px-4 py-3 text-right text-amber-700">{naira(totals.reserved)}</td>
                <td className="px-4 py-3 text-right text-red-700">{naira(totals.totalExp)}</td>
                <td className="px-4 py-3 text-right text-emerald-700">{naira(totals.remaining)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function SubheadBreakdownPanel({
  rows,
  deptMap,
  totals,
}: {
  rows: Subhead[];
  deptMap: Record<string, Dept>;
  totals: ReturnType<typeof getBudgetTotals>;
}) {
  return (
    <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm print:rounded-none print:border-black print:shadow-none">
      <h2 className="text-lg font-bold text-slate-900">Total Expenditure by Subhead</h2>
      <p className="mt-1 text-sm text-slate-600">Detailed breakdown by subhead code.</p>

      {rows.length === 0 ? (
        <div className="mt-4 text-sm text-slate-700">No subheads.</div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[1100px] w-full border-collapse text-sm print:min-w-0 print:text-[8px]">
            <thead>
              <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 print:bg-white print:text-[8px]">
                <th className="px-4 py-3 text-left">Dept</th>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Subhead</th>
                <th className="px-4 py-3 text-right">Allocation</th>
                <th className="px-4 py-3 text-right">Reserved</th>
                <th className="px-4 py-3 text-right">Expenditure</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>

            <tbody>
              {rows.slice(0, 100).map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-3 text-slate-800">
                    {deptMap[s.dept_id || ""]?.name || s.dept_id || "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{s.code || "—"}</td>
                  <td className="px-4 py-3 text-slate-900">{s.name}</td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-700">{naira(s.approved_allocation)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-700">{naira(s.reserved_amount)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-700">{naira(s.expenditure)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">{naira(s.balance)}</td>
                  <td className="px-4 py-3 text-slate-700">{s.is_active === false ? "Inactive" : "Active"}</td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr className="border-t bg-slate-50 font-black print:bg-white">
                <td className="px-4 py-3 uppercase text-slate-900" colSpan={3}>
                  Total
                </td>
                <td className="px-4 py-3 text-right text-blue-700">{naira(totals.annualBudget)}</td>
                <td className="px-4 py-3 text-right text-amber-700">{naira(totals.reserved)}</td>
                <td className="px-4 py-3 text-right text-red-700">{naira(totals.totalExp)}</td>
                <td className="px-4 py-3 text-right text-emerald-700">{naira(totals.remaining)}</td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {rows.length > 100 && (
        <div className="mt-3 text-xs text-slate-500 print:hidden">
          Showing first 100 rows on screen. Use Export Excel for the full list.
        </div>
      )}
    </div>
  );
}

function KpiCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "blue" | "amber" | "red" | "emerald";
}) {
  const cls =
    tone === "amber"
      ? "bg-amber-50 text-amber-700"
      : tone === "red"
      ? "bg-red-50 text-red-700"
      : tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-blue-50 text-blue-700";

  return (
    <div className="print-card rounded-3xl border bg-white p-6 shadow-sm print:rounded-none print:border-black print:p-2 print:shadow-none">
      <div className="text-sm font-semibold text-slate-600 print:text-[9px]">{title}</div>
      <div className={`mt-2 inline-flex rounded-2xl px-3 py-2 text-xl font-extrabold tracking-tight print:p-0 print:text-[11px] ${cls}`}>
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

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-4 py-3 text-sm font-bold transition ${
        active ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-700 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}