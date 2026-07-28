"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { exportTableToExcel } from "@/lib/reportExport";

type OutputMode = "print" | "export";
type Department = { id: string; name: string };
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
};
type Voucher = {
  id: string;
  voucher_no: string | null;
  amount: number | null;
  total_amount: number | null;
  status: string | null;
  payment_date: string | null;
  posted_at: string | null;
  department_id: string | null;
  dept_id: string | null;
  voucher_type: string | null;
};
type Tx = {
  id: string;
  transaction_no: string | null;
  transaction_type: string | null;
  amount: number | null;
  transaction_date: string;
  subhead_id: string | null;
  voucher_id: string | null;
  request_id: string | null;
  is_reversed: boolean | null;
};
type ExportRow = {
  section: string;
  sn: number | string;
  department: string;
  code: string;
  description: string;
  allocation: number | string;
  reserved: number | string;
  expenditure: number | string;
  balance: number | string;
  status: string;
};

function roleKey(value: string | null | undefined) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "");
}

function money(value: number | null | undefined) {
  return `NGN ${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function shortMoney(value: number | null | undefined) {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1_000_000_000) return `NGN ${(amount / 1_000_000_000).toFixed(2)}bn`;
  if (Math.abs(amount) >= 1_000_000) return `NGN ${(amount / 1_000_000).toFixed(2)}m`;
  if (Math.abs(amount) >= 1_000) return `NGN ${(amount / 1_000).toFixed(1)}k`;
  return money(amount);
}

function dateLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ymd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function csvSafeFilePart(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "");
}

export default function FinanceOutputWorkspace({ mode }: { mode: OutputMode }) {
  const router = useRouter();
  const now = new Date();
  const currentYear = now.getFullYear();

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState("Staff");
  const [actorName, setActorName] = useState("Finance Officer");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subheads, setSubheads] = useState<Subhead[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [year, setYear] = useState(currentYear);
  const [departmentId, setDepartmentId] = useState("ALL");
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`);
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`);

  const canFinance = ["admin", "auditor", "account", "accounts", "accountofficer"].includes(
    roleKey(role)
  );

  useEffect(() => {
    setDateFrom(`${year}-01-01`);
    setDateTo(`${year}-12-31`);
  }, [year]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const userId = authData.user.id;
      const [profileRes, roleRes, deptRes, subheadRes, voucherRes, txRes] = await Promise.all([
        supabase.from("profiles").select("full_name,email").eq("id", userId).maybeSingle(),
        supabase.from("profile_roles").select("role").eq("profile_id", userId),
        supabase.from("departments").select("id,name").order("name"),
        supabase
          .from("subheads")
          .select("id,dept_id,code,name,approved_allocation,reserved_amount,expenditure,balance,is_active")
          .order("code"),
        supabase
          .from("payment_vouchers")
          .select("id,voucher_no,amount,total_amount,status,payment_date,posted_at,department_id,dept_id,voucher_type")
          .order("created_at", { ascending: false }),
        supabase
          .from("finance_transactions")
          .select("id,transaction_no,transaction_type,amount,transaction_date,subhead_id,voucher_id,request_id,is_reversed")
          .order("transaction_date", { ascending: false }),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (roleRes.error) throw roleRes.error;
      if (deptRes.error) throw deptRes.error;
      if (subheadRes.error) throw subheadRes.error;
      if (voucherRes.error) throw voucherRes.error;
      if (txRes.error) throw txRes.error;

      const roles = (roleRes.data || []).map((item: { role: string }) => item.role);
      setRole(roles[0] || "Staff");
      setActorName(profileRes.data?.full_name || profileRes.data?.email || "Finance Officer");
      setDepartments((deptRes.data || []) as Department[]);
      setSubheads((subheadRes.data || []) as Subhead[]);
      setVouchers((voucherRes.data || []) as Voucher[]);
      setTransactions((txRes.data || []) as Tx[]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to load finance output records.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const departmentMap = useMemo(() => {
    return Object.fromEntries(departments.map((department) => [department.id, department.name]));
  }, [departments]);

  const selectedDepartment =
    departmentId === "ALL" ? "All Departments" : departmentMap[departmentId] || "Selected Department";

  const filteredSubheads = useMemo(() => {
    if (departmentId === "ALL") return subheads;
    return subheads.filter((subhead) => subhead.dept_id === departmentId);
  }, [departmentId, subheads]);

  const filteredVouchers = useMemo(() => {
    const from = new Date(`${dateFrom}T00:00:00`).getTime();
    const to = new Date(`${dateTo}T23:59:59`).getTime();

    return vouchers.filter((voucher) => {
      const value = voucher.payment_date || voucher.posted_at;
      if (!value) return false;
      const timestamp = new Date(value).getTime();
      const voucherDepartment = voucher.department_id || voucher.dept_id;
      const departmentMatch = departmentId === "ALL" || voucherDepartment === departmentId;
      return departmentMatch && timestamp >= from && timestamp <= to;
    });
  }, [dateFrom, dateTo, departmentId, vouchers]);

  const subheadIds = useMemo(() => new Set(filteredSubheads.map((subhead) => subhead.id)), [filteredSubheads]);

  const filteredTransactions = useMemo(() => {
    const from = new Date(`${dateFrom}T00:00:00`).getTime();
    const to = new Date(`${dateTo}T23:59:59`).getTime();
    return transactions.filter((transaction) => {
      const timestamp = new Date(`${transaction.transaction_date}T00:00:00`).getTime();
      const departmentMatch = departmentId === "ALL" || (transaction.subhead_id && subheadIds.has(transaction.subhead_id));
      return departmentMatch && timestamp >= from && timestamp <= to && transaction.is_reversed !== true;
    });
  }, [dateFrom, dateTo, departmentId, subheadIds, transactions]);

  const totals = useMemo(() => {
    const allocation = filteredSubheads.reduce((sum, row) => sum + Number(row.approved_allocation || 0), 0);
    const reserved = filteredSubheads.reduce((sum, row) => sum + Number(row.reserved_amount || 0), 0);
    const expenditure = filteredSubheads.reduce((sum, row) => sum + Number(row.expenditure || 0), 0);
    const balance = filteredSubheads.reduce((sum, row) => sum + Number(row.balance || 0), 0);
    const postedVouchers = filteredVouchers.filter((row) => (row.status || "").toLowerCase() === "posted");
    const postedValue = postedVouchers.reduce(
      (sum, row) => sum + Number(row.total_amount ?? row.amount ?? 0),
      0
    );
    return {
      allocation,
      reserved,
      expenditure,
      balance,
      postedCount: postedVouchers.length,
      postedValue,
      transactionCount: filteredTransactions.length,
    };
  }, [filteredSubheads, filteredTransactions.length, filteredVouchers]);

  const departmentRows = useMemo(() => {
    const grouped: Record<string, { name: string; allocation: number; expenditure: number; balance: number }> = {};
    filteredSubheads.forEach((row) => {
      const id = row.dept_id || "UNASSIGNED";
      if (!grouped[id]) {
        grouped[id] = {
          name: departmentMap[id] || "Unassigned",
          allocation: 0,
          expenditure: 0,
          balance: 0,
        };
      }
      grouped[id].allocation += Number(row.approved_allocation || 0);
      grouped[id].expenditure += Number(row.expenditure || 0);
      grouped[id].balance += Number(row.balance || 0);
    });
    return Object.values(grouped)
      .sort((a, b) => b.expenditure - a.expenditure)
      .slice(0, 6);
  }, [departmentMap, filteredSubheads]);

  const topSubheads = useMemo(() => {
    return [...filteredSubheads]
      .sort((a, b) => Number(b.expenditure || 0) - Number(a.expenditure || 0))
      .slice(0, 8);
  }, [filteredSubheads]);

  async function prepareFreshData() {
    setWorking(true);
    await loadData();
    await new Promise((resolve) => setTimeout(resolve, 180));
  }

  async function printOnePageReport() {
    await prepareFreshData();
    document.body.classList.add("finance-output-printing");
    window.print();
    setTimeout(() => {
      document.body.classList.remove("finance-output-printing");
      setWorking(false);
    }, 350);
  }

  async function exportExcel() {
    await prepareFreshData();

    const summaryRows: ExportRow[] = [
      ["Approved Allocation", totals.allocation],
      ["Reserved Amount", totals.reserved],
      ["Expenditure", totals.expenditure],
      ["Available Balance", totals.balance],
      ["Posted Voucher Value", totals.postedValue],
    ].map(([description, value], index) => ({
      section: "Executive Summary",
      sn: index + 1,
      department: selectedDepartment,
      code: "",
      description: String(description),
      allocation: description === "Approved Allocation" ? Number(value) : "",
      reserved: description === "Reserved Amount" ? Number(value) : "",
      expenditure:
        description === "Expenditure" || description === "Posted Voucher Value" ? Number(value) : "",
      balance: description === "Available Balance" ? Number(value) : "",
      status: "",
    }));

    const departmentExport: ExportRow[] = departmentRows.map((row, index) => ({
      section: "Department Performance",
      sn: index + 1,
      department: row.name,
      code: "",
      description: "Allocation and expenditure summary",
      allocation: row.allocation,
      reserved: "",
      expenditure: row.expenditure,
      balance: row.balance,
      status: row.balance < 0 ? "Overdrawn" : "Within Budget",
    }));

    const subheadExport: ExportRow[] = filteredSubheads.map((row, index) => ({
      section: "Subhead Performance",
      sn: index + 1,
      department: departmentMap[row.dept_id || ""] || "Unassigned",
      code: row.code || "",
      description: row.name,
      allocation: Number(row.approved_allocation || 0),
      reserved: Number(row.reserved_amount || 0),
      expenditure: Number(row.expenditure || 0),
      balance: Number(row.balance || 0),
      status: row.is_active === false ? "Inactive" : Number(row.balance || 0) < 0 ? "Overdrawn" : "Active",
    }));

    exportTableToExcel<ExportRow>({
      fileName: `IET_Finance_Report_${csvSafeFilePart(selectedDepartment)}_${dateFrom}_to_${dateTo}`,
      sheetName: "Finance Report",
      title: "ISLAMIC EDUCATION TRUST - FINANCE PERFORMANCE REPORT",
      subtitle: `${selectedDepartment} | ${dateLabel(dateFrom)} to ${dateLabel(dateTo)} | Prepared by ${actorName}`,
      rows: [...summaryRows, ...departmentExport, ...subheadExport],
      columns: [
        { header: "Section", value: (row) => row.section },
        { header: "S/N", value: (row) => row.sn },
        { header: "Department", value: (row) => row.department },
        { header: "Code", value: (row) => row.code },
        { header: "Description", value: (row) => row.description },
        { header: "Approved Allocation", value: (row) => row.allocation },
        { header: "Reserved", value: (row) => row.reserved },
        { header: "Expenditure", value: (row) => row.expenditure },
        { header: "Balance", value: (row) => row.balance },
        { header: "Status", value: (row) => row.status },
      ],
      footerRows: [
        [
          "GRAND TOTAL",
          "",
          selectedDepartment,
          "",
          "",
          String(totals.allocation),
          String(totals.reserved),
          String(totals.expenditure),
          String(totals.balance),
          "",
        ],
      ],
    });

    setWorking(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 font-[inherit]">
        <div className="mx-auto max-w-7xl py-12 text-slate-600">Loading Finance Output Centre...</div>
      </main>
    );
  }

  if (!canFinance) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 font-[inherit]">
        <div className="mx-auto max-w-3xl py-12">
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
            You are not authorised to access Finance reports and exports.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="finance-output-page min-h-screen bg-[radial-gradient(circle_at_top_left,_#eaf4ff_0,_#f8fafc_40%,_#f8fafc_100%)] px-4 py-8 font-[inherit] text-slate-900">
      <div className="mx-auto max-w-7xl">
        <section className="hero-enter relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(120deg,#07163d_0%,#073c91_48%,#07b8e8_74%,#130b18_100%)] px-6 py-8 text-white shadow-[0_28px_80px_rgba(2,36,94,.28)] md:px-10 md:py-10">
          <div className="hero-orb absolute -right-16 -top-20 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="relative grid gap-7 lg:grid-cols-[1fr_310px] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[.22em] text-amber-300">Finance Output Management</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                {mode === "print" ? "Print & PDF Centre" : "Excel Export Centre"}
              </h1>
              <p className="mt-4 max-w-3xl text-sm font-medium leading-7 text-blue-50/90 md:text-base">
                Generate one-page institutional A4 reports and structured Excel workbooks from verified Finance records.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 no-print">
                <button className="action secondary" onClick={() => router.push("/finance")}>🏛 Finance Control Centre</button>
                <button className="action cyan" onClick={() => router.push("/finance/reports?view=output")}>📊 Reports Centre</button>
              </div>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-xl">
              <p className="text-xs font-black uppercase tracking-[.18em] text-blue-100">Current Output Scope</p>
              <p className="mt-3 text-2xl font-black">{selectedDepartment}</p>
              <p className="mt-1 text-sm text-blue-100">{dateLabel(dateFrom)} — {dateLabel(dateTo)}</p>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="scope-tile"><strong>{filteredSubheads.length}</strong><span>Subheads</span></div>
                <div className="scope-tile"><strong>{totals.postedCount}</strong><span>Vouchers</span></div>
                <div className="scope-tile"><strong>{totals.transactionCount}</strong><span>Entries</span></div>
              </div>
            </div>
          </div>
        </section>

        {error && <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-800">⚠ {error}</div>}

        <section className="panel-enter mt-5 rounded-[1.7rem] border border-slate-200/80 bg-white/95 p-5 shadow-[0_16px_50px_rgba(15,23,42,.08)] no-print">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="field"><span>Fiscal Year</span><select value={year} onChange={(event) => setYear(Number(event.target.value))}>{Array.from({ length: 7 }, (_, index) => currentYear - 3 + index).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="field"><span>Department</span><select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}><option value="ALL">All Departments</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
            <label className="field"><span>Date From</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
            <label className="field"><span>Date To</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
            <div className="flex items-end gap-2">
              <button className="action cyan w-full" disabled={working} onClick={loadData}>↻ Refresh</button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="action blue" disabled={working} onClick={printOnePageReport}>🖨 {working ? "Preparing..." : "Print / Save PDF"}</button>
            <button className="action green" disabled={working} onClick={exportExcel}>📗 {working ? "Preparing..." : "Export Standard Excel"}</button>
          </div>
        </section>

        <section className="mt-6 overflow-auto rounded-[1.7rem] border border-slate-200 bg-slate-200/60 p-4 shadow-inner no-print-preview">
          <div className="mx-auto w-[210mm] max-w-full origin-top rounded-sm bg-white shadow-[0_24px_70px_rgba(15,23,42,.18)]">
            <ReportSheet
              actorName={actorName}
              dateFrom={dateFrom}
              dateTo={dateTo}
              selectedDepartment={selectedDepartment}
              totals={totals}
              departmentRows={departmentRows}
              topSubheads={topSubheads}
              departmentMap={departmentMap}
            />
          </div>
        </section>
      </div>

      <style jsx global>{`
        .finance-output-page * { box-sizing: border-box; }
        .hero-enter { animation: outputRise .65s cubic-bezier(.2,.7,.2,1) both; }
        .panel-enter { animation: outputRise .65s .08s cubic-bezier(.2,.7,.2,1) both; }
        .hero-orb { animation: outputFloat 6s ease-in-out infinite alternate; }
        @keyframes outputRise { from { opacity: 0; transform: translateY(18px) scale(.99); } to { opacity: 1; transform: none; } }
        @keyframes outputFloat { from { transform: translate3d(0,0,0); } to { transform: translate3d(-30px,24px,0); } }
        .action { display:inline-flex; min-height:46px; align-items:center; justify-content:center; gap:.55rem; border-radius:14px; padding:.75rem 1.05rem; font-weight:900; transition:transform .18s ease, box-shadow .18s ease, opacity .18s ease; }
        .action:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 14px 30px rgba(15,23,42,.14); }
        .action:disabled { cursor:not-allowed; opacity:.55; }
        .action.secondary { border:1px solid rgba(255,255,255,.28); background:rgba(255,255,255,.08); color:white; }
        .action.cyan { border:1px solid #67e8f9; background:linear-gradient(135deg,#06b6d4,#0ea5e9); color:white; }
        .action.blue { border:1px solid #60a5fa; background:linear-gradient(135deg,#2563eb,#0284c7); color:white; }
        .action.green { border:1px solid #4ade80; background:linear-gradient(135deg,#16a34a,#059669); color:white; }
        .scope-tile { border:1px solid rgba(255,255,255,.12); border-radius:14px; background:rgba(255,255,255,.08); padding:.7rem .3rem; }
        .scope-tile strong { display:block; font-size:1.1rem; }
        .scope-tile span { display:block; margin-top:.15rem; font-size:.63rem; font-weight:900; text-transform:uppercase; letter-spacing:.09em; color:#dbeafe; }
        .field span { display:block; margin-bottom:.45rem; font-size:.72rem; font-weight:900; text-transform:uppercase; letter-spacing:.1em; color:#334155; }
        .field input,.field select { width:100%; min-height:46px; border:1px solid #cbd5e1; border-radius:14px; background:white; padding:0 .9rem; font:inherit; font-weight:700; color:#0f172a; outline:none; }
        .field input:focus,.field select:focus { border-color:#0ea5e9; box-shadow:0 0 0 4px rgba(14,165,233,.12); }
        .a4-sheet { width:210mm; height:297mm; overflow:hidden; background:white; color:#0f172a; padding:10mm 11mm 9mm; font-family:inherit; }
        .report-logo { width:18mm; height:18mm; object-fit:contain; }
        .report-table { width:100%; border-collapse:collapse; table-layout:fixed; }
        .report-table th { background:#eaf2ff; color:#173a72; font-size:8px; text-transform:uppercase; letter-spacing:.05em; text-align:left; padding:5px 5px; border:1px solid #cbd5e1; }
        .report-table td { font-size:8px; padding:4px 5px; border:1px solid #dbe2ea; vertical-align:top; line-height:1.3; }
        .report-table .amount { text-align:right; white-space:nowrap; }
        .print-only { display:none; }
        @media print {
          @page { size:A4 portrait; margin:0; }
          html,body { width:210mm; height:297mm; background:white !important; }
          body.finance-output-printing * { visibility:hidden !important; }
          body.finance-output-printing .print-sheet,
          body.finance-output-printing .print-sheet * { visibility:visible !important; }
          body.finance-output-printing .print-sheet { position:absolute !important; left:0; top:0; margin:0 !important; box-shadow:none !important; }
          .no-print,.no-print-preview { display:none !important; }
          .print-only { display:block !important; }
          .a4-sheet { width:210mm !important; height:297mm !important; }
        }
        @media (max-width:900px) {
          .no-print-preview { overflow-x:auto; }
          .a4-sheet { transform-origin:top left; }
        }
      `}</style>
    </main>
  );
}

function ReportSheet({
  actorName,
  dateFrom,
  dateTo,
  selectedDepartment,
  totals,
  departmentRows,
  topSubheads,
  departmentMap,
}: {
  actorName: string;
  dateFrom: string;
  dateTo: string;
  selectedDepartment: string;
  totals: {
    allocation: number;
    reserved: number;
    expenditure: number;
    balance: number;
    postedCount: number;
    postedValue: number;
    transactionCount: number;
  };
  departmentRows: { name: string; allocation: number; expenditure: number; balance: number }[];
  topSubheads: Subhead[];
  departmentMap: Record<string, string>;
}) {
  const utilisation = totals.allocation > 0 ? Math.min(999, (totals.expenditure / totals.allocation) * 100) : 0;

  return (
    <article className="a4-sheet print-sheet">
      <header className="flex items-center gap-4 border-b-[3px] border-[#174f9f] pb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/iet-logo.png" alt="Islamic Education Trust logo" className="report-logo" />
        <div className="min-w-0 flex-1 text-center">
          <h2 className="text-[17px] font-black uppercase tracking-[.07em] text-[#153d75]">Islamic Education Trust</h2>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-[.14em] text-slate-500">Finance Performance Report</p>
        </div>
        <div className="w-[40mm] text-right text-[8px] leading-4 text-slate-600">
          <p><strong>Report ID:</strong> IET-FIN-{new Date().getFullYear()}-{String(new Date().getMonth() + 1).padStart(2, "0")}</p>
          <p><strong>Generated:</strong> {new Date().toLocaleString("en-NG")}</p>
          <p><strong>Prepared by:</strong> {actorName}</p>
        </div>
      </header>

      <section className="mt-3 grid grid-cols-[1fr_1fr_1.3fr] gap-2 rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2 text-[8px]">
        <div><strong className="block text-[#174f9f]">Reporting Scope</strong>{selectedDepartment}</div>
        <div><strong className="block text-[#174f9f]">Reporting Period</strong>{dateLabel(dateFrom)} — {dateLabel(dateTo)}</div>
        <div><strong className="block text-[#174f9f]">Basis</strong>Posted vouchers, finance transactions and approved subhead balances.</div>
      </section>

      <section className="mt-3 grid grid-cols-4 gap-2">
        {[
          ["Approved Allocation", shortMoney(totals.allocation)],
          ["Reserved", shortMoney(totals.reserved)],
          ["Expenditure", shortMoney(totals.expenditure)],
          ["Available Balance", shortMoney(totals.balance)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 p-2">
            <p className="text-[7px] font-black uppercase tracking-[.08em] text-slate-500">{label}</p>
            <p className="mt-1 text-[12px] font-black text-slate-900">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-3 grid grid-cols-[1.2fr_.8fr] gap-3">
        <div>
          <div className="mb-1 flex items-end justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-[.08em] text-[#174f9f]">Department Performance</h3>
            <span className="text-[7px] text-slate-500">Top departments by expenditure</span>
          </div>
          <table className="report-table">
            <thead><tr><th style={{ width: "33%" }}>Department</th><th>Allocation</th><th>Expenditure</th><th>Balance</th></tr></thead>
            <tbody>
              {departmentRows.length ? departmentRows.map((row) => (
                <tr key={row.name}><td>{row.name}</td><td className="amount">{shortMoney(row.allocation)}</td><td className="amount">{shortMoney(row.expenditure)}</td><td className="amount">{shortMoney(row.balance)}</td></tr>
              )) : <tr><td colSpan={4}>No department records within the selected scope.</td></tr>}
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="mb-1 text-[10px] font-black uppercase tracking-[.08em] text-[#174f9f]">Control Indicators</h3>
          <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-[8px]">
            <Indicator label="Budget utilisation" value={`${utilisation.toFixed(1)}%`} />
            <Indicator label="Posted vouchers" value={String(totals.postedCount)} />
            <Indicator label="Posted voucher value" value={shortMoney(totals.postedValue)} />
            <Indicator label="Finance entries" value={String(totals.transactionCount)} />
            <div className="pt-1">
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#1d73d4]" style={{ width: `${Math.min(100, utilisation)}%` }} /></div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-3">
        <div className="mb-1 flex items-end justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-[.08em] text-[#174f9f]">Priority Subhead Performance</h3>
          <span className="text-[7px] text-slate-500">Highest expenditure classifications</span>
        </div>
        <table className="report-table">
          <thead><tr><th style={{ width: "10%" }}>Code</th><th style={{ width: "24%" }}>Subhead</th><th style={{ width: "19%" }}>Department</th><th>Allocation</th><th>Reserved</th><th>Expenditure</th><th>Balance</th></tr></thead>
          <tbody>
            {topSubheads.length ? topSubheads.map((row) => (
              <tr key={row.id}>
                <td>{row.code || "—"}</td><td>{row.name}</td><td>{departmentMap[row.dept_id || ""] || "Unassigned"}</td>
                <td className="amount">{shortMoney(row.approved_allocation)}</td><td className="amount">{shortMoney(row.reserved_amount)}</td><td className="amount">{shortMoney(row.expenditure)}</td><td className="amount">{shortMoney(row.balance)}</td>
              </tr>
            )) : <tr><td colSpan={7}>No subhead records within the selected scope.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="mt-3 grid grid-cols-[1fr_1fr] gap-3 text-[8px]">
        <div className="rounded-lg border border-slate-200 p-3">
          <h3 className="font-black uppercase tracking-[.07em] text-[#174f9f]">Management Observation</h3>
          <p className="mt-1 leading-4 text-slate-600">
            Expenditure represents {utilisation.toFixed(1)}% of approved allocation. The remaining balance is {shortMoney(totals.balance)} after recognised expenditure and current reservations.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <h3 className="font-black uppercase tracking-[.07em] text-[#174f9f]">Control Note</h3>
          <p className="mt-1 leading-4 text-slate-600">
            This report is generated from current Finance records. Source vouchers, transaction registers and ledgers remain the authoritative audit evidence.
          </p>
        </div>
      </section>

      <footer className="mt-4 grid grid-cols-3 gap-8 text-center text-[8px] text-slate-600">
        <Signature label="Prepared by Finance" />
        <Signature label="Reviewed / Audited" />
        <Signature label="Approved by Management" />
      </footer>

      <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2 text-[7px] text-slate-500">
        <span>ReqGen Finance Control Centre • Islamic Education Trust</span>
        <span>Confidential Finance Document • Page 1 of 1</span>
      </div>
    </article>
  );
}

function Indicator({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between border-b border-slate-100 pb-1"><span className="text-slate-600">{label}</span><strong className="text-slate-900">{value}</strong></div>;
}

function Signature({ label }: { label: string }) {
  return <div><div className="mt-6 border-t border-slate-400 pt-1">{label}</div><div className="mt-1 text-[7px]">Name / Signature / Date</div></div>;
}
