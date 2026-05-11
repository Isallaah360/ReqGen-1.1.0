"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type VoucherRow = {
  id: string;
  voucher_no: string;
  request_id: string;
  request_no: string | null;
  request_type: string | null;
  personal_category: string | null;
  payee_name: string | null;
  narration: string | null;
  amount: number | null;
  dept_name: string | null;
  subhead_code: string | null;
  subhead_name: string | null;
  prepared_by_name: string | null;
  checked_by_name: string | null;
  authorized_by_name: string | null;
  disbursement_mode: string | null;
  is_multi_request: boolean | null;
  item_count: number | null;
  total_amount: number | null;
  voucher_scope: string | null;
  status: string | null;
  created_at: string;
};

type SubheadRow = {
  id: string;
  code: string | null;
  name: string;
  approved_allocation: number | null;
  reserved_amount: number | null;
  expenditure: number | null;
  balance: number | null;
  is_active: boolean | null;
};

type RequestRow = {
  id: string;
  request_no: string;
  title: string;
  amount: number | null;
  status: string | null;
  current_stage: string | null;
  request_type: string | null;
  personal_category: string | null;
  created_at: string;
};

type ProfileMini = {
  id: string;
  role: string | null;
};

function roleKey(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function normalize(v: string | null | undefined) {
  return (v || "").toLowerCase().replace(/[^a-z]/g, "");
}

function naira(n: number | null | undefined) {
  return "₦" + Math.round(Number(n || 0)).toLocaleString();
}

function shortDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function shortDateTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

function daysOld(d: string | null | undefined) {
  if (!d) return 0;
  const created = new Date(d).getTime();
  const now = new Date().getTime();
  return Math.max(0, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
}

function categoryKey(v: { request_type: string | null; personal_category: string | null }) {
  const rt = normalize(v.request_type);
  const pc = normalize(v.personal_category);

  if (rt === "official") return "official";
  if (rt === "personal" && pc === "fund") return "personalfund";
  if (rt === "personal" && pc === "nonfund") return "personalnonfund";

  return "unknown";
}

function categoryLabel(v: { request_type: string | null; personal_category: string | null }) {
  const key = categoryKey(v);

  if (key === "official") return "Official";
  if (key === "personalfund") return "Personal Fund";
  if (key === "personalnonfund") return "Personal NonFund";

  return v.request_type || "—";
}

function categoryBadgeClass(v: { request_type: string | null; personal_category: string | null }) {
  const key = categoryKey(v);

  if (key === "official") return "border-blue-200 bg-blue-50 text-blue-700";
  if (key === "personalfund") return "border-purple-200 bg-purple-50 text-purple-700";
  if (key === "personalnonfund") return "border-slate-200 bg-slate-50 text-slate-700";

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function statusBadgeClass(status: string | null | undefined) {
  const s = (status || "").toLowerCase();

  if (s.includes("paid")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s.includes("cancel")) return "border-red-200 bg-red-50 text-red-700";
  if (s.includes("counter")) return "border-purple-200 bg-purple-50 text-purple-700";
  if (s.includes("authorized") || s.includes("checked")) return "border-blue-200 bg-blue-50 text-blue-700";
  if (s.includes("cheque")) return "border-amber-200 bg-amber-50 text-amber-700";
  if (s.includes("complete")) return "border-emerald-200 bg-emerald-50 text-emerald-700";

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function riskBadgeClass(level: "Low" | "Medium" | "High") {
  if (level === "High") return "border-red-200 bg-red-50 text-red-700";
  if (level === "Medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function inputDateValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

function isWithinDateRange(createdAt: string | null | undefined, from: string, to: string) {
  if (!createdAt) return false;

  const d = new Date(createdAt);
  const start = from ? new Date(`${from}T00:00:00`) : null;
  const end = to ? new Date(`${to}T23:59:59`) : null;

  if (start && d < start) return false;
  if (end && d > end) return false;

  return true;
}

export default function FinanceAuditPage() {
  const router = useRouter();

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [me, setMe] = useState<ProfileMini | null>(null);
  const rk = roleKey(me?.role);

  const canAccess = ["admin", "auditor", "account", "accounts", "accountofficer"].includes(rk);
  const canSensitiveAudit = ["admin", "auditor"].includes(rk);

  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [subheads, setSubheads] = useState<SubheadRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);

  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState(inputDateValue(firstDay));
  const [toDate, setToDate] = useState(inputDateValue(today));
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [modeFilter, setModeFilter] = useState("ALL");
  const [riskFilter, setRiskFilter] = useState("ALL");

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
      .select("id,role")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (profErr || !prof) {
      setMsg("Failed to load your profile: " + (profErr?.message || "Profile not found."));
      setLoading(false);
      return;
    }

    setMe(prof as ProfileMini);

    const role = roleKey(prof.role);
    if (!["admin", "auditor", "account", "accounts", "accountofficer"].includes(role)) {
      setMsg("Access denied. Only Finance, Account, Auditor and Admin roles can access Audit & Reconciliation.");
      setVouchers([]);
      setSubheads([]);
      setRequests([]);
      setLoading(false);
      return;
    }

    const [voucherRes, subheadRes, requestRes] = await Promise.all([
      supabase.rpc("get_payment_vouchers"),
      supabase
        .from("subheads")
        .select("id,code,name,approved_allocation,reserved_amount,expenditure,balance,is_active")
        .order("code", { ascending: true }),
      supabase
        .from("requests")
        .select("id,request_no,title,amount,status,current_stage,request_type,personal_category,created_at")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

    if (voucherRes.error) {
      setMsg("Failed to load payment vouchers: " + voucherRes.error.message);
      setVouchers([]);
    } else {
      setVouchers((voucherRes.data || []) as VoucherRow[]);
    }

    if (subheadRes.error) {
      setMsg("Failed to load subheads: " + subheadRes.error.message);
      setSubheads([]);
    } else {
      setSubheads((subheadRes.data || []) as SubheadRow[]);
    }

    if (requestRes.error) {
      setMsg("Failed to load requests: " + requestRes.error.message);
      setRequests([]);
    } else {
      setRequests((requestRes.data || []) as RequestRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredVouchers = useMemo(() => {
    const s = search.trim().toLowerCase();

    return vouchers.filter((v) => {
      if (!isWithinDateRange(v.created_at, fromDate, toDate)) return false;

      if (statusFilter !== "ALL" && (v.status || "") !== statusFilter) return false;

      if (modeFilter !== "ALL" && normalize(v.disbursement_mode) !== normalize(modeFilter)) {
        return false;
      }

      if (s) {
        const haystack = [
          v.voucher_no,
          v.request_no,
          v.payee_name,
          v.narration,
          v.dept_name,
          v.subhead_code,
          v.subhead_name,
          v.prepared_by_name,
          v.checked_by_name,
          v.authorized_by_name,
          v.status,
          v.disbursement_mode,
          v.voucher_scope,
          v.request_type,
          v.personal_category,
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(s)) return false;
      }

      return true;
    });
  }, [vouchers, search, fromDate, toDate, statusFilter, modeFilter]);

  const auditFindings = useMemo(() => {
    const findings: {
      id: string;
      title: string;
      description: string;
      level: "Low" | "Medium" | "High";
      count: number;
      action: string;
    }[] = [];

    const cancelled = filteredVouchers.filter((v) => (v.status || "") === "Cancelled");
    const unpaidOld = filteredVouchers.filter((v) => {
      const s = v.status || "";
      return s !== "Paid" && s !== "Cancelled" && daysOld(v.created_at) >= 7;
    });

    const chequeAwaiting = filteredVouchers.filter((v) => {
      const s = v.status || "";
      return ["Cheque Prepared", "Cheque Signed", "Counter Signed"].includes(s);
    });

    const missingPayee = filteredVouchers.filter((v) => !(v.payee_name || "").trim());
    const missingAmount = filteredVouchers.filter((v) => Number(v.total_amount || v.amount || 0) <= 0);

    const overdrawnSubheads = subheads.filter((s) => Number(s.balance || 0) < 0);
    const lowBalanceSubheads = subheads.filter((s) => {
      const approved = Number(s.approved_allocation || 0);
      const balance = Number(s.balance || 0);
      if (approved <= 0) return false;
      return balance >= 0 && balance / approved <= 0.1;
    });

    if (cancelled.length > 0) {
      findings.push({
        id: "cancelled",
        title: "Cancelled Payment Vouchers",
        description: "Cancelled vouchers should be reviewed to confirm why they were voided and whether linked requests were regenerated correctly.",
        level: cancelled.length >= 5 ? "High" : "Medium",
        count: cancelled.length,
        action: "Review cancelled PVs and confirm no duplicate payment occurred.",
      });
    }

    if (unpaidOld.length > 0) {
      findings.push({
        id: "old-pending",
        title: "Pending Vouchers Older Than 7 Days",
        description: "Vouchers that remain unpaid or unsigned for too long should be followed up.",
        level: unpaidOld.length >= 5 ? "High" : "Medium",
        count: unpaidOld.length,
        action: "Follow up with Account, Cheque Signer or Counter Signer depending on stage.",
      });
    }

    if (chequeAwaiting.length > 0) {
      findings.push({
        id: "cheque-workflow",
        title: "Cheque Workflow Items Awaiting Completion",
        description: "Cheque vouchers should pass through cheque signature, counter signature and final payment promptly.",
        level: chequeAwaiting.length >= 5 ? "High" : "Medium",
        count: chequeAwaiting.length,
        action: "Check assigned signers and pending cheque approvals.",
      });
    }

    if (missingPayee.length > 0) {
      findings.push({
        id: "missing-payee",
        title: "Voucher Records Missing Payee",
        description: "Every PV should have a clear payee name for accountability.",
        level: "High",
        count: missingPayee.length,
        action: "Inspect PV generation data and correct affected records.",
      });
    }

    if (missingAmount.length > 0) {
      findings.push({
        id: "missing-amount",
        title: "Voucher Records With Zero or Invalid Amount",
        description: "Every payment voucher must have a valid amount greater than zero.",
        level: "High",
        count: missingAmount.length,
        action: "Investigate affected PVs before printing or payment.",
      });
    }

    if (overdrawnSubheads.length > 0) {
      findings.push({
        id: "overdrawn-subheads",
        title: "Overdrawn Subheads",
        description: "One or more budget subheads have negative balances.",
        level: "High",
        count: overdrawnSubheads.length,
        action: "Reconcile allocation, reserved amount, expenditure and payment postings.",
      });
    }

    if (lowBalanceSubheads.length > 0) {
      findings.push({
        id: "low-balance-subheads",
        title: "Low Balance Subheads",
        description: "Some subheads have 10% or less of approved allocation remaining.",
        level: "Medium",
        count: lowBalanceSubheads.length,
        action: "Review spending pressure before approving more requests.",
      });
    }

    if (findings.length === 0) {
      findings.push({
        id: "clean",
        title: "No Major Audit Exceptions Found",
        description: "No critical exception was detected for the selected period.",
        level: "Low",
        count: 0,
        action: "Continue routine monitoring.",
      });
    }

    if (riskFilter === "ALL") return findings;
    return findings.filter((f) => f.level === riskFilter);
  }, [filteredVouchers, subheads, riskFilter]);

  const stats = useMemo(() => {
    const activeVouchers = filteredVouchers.filter((v) => (v.status || "") !== "Cancelled");

    const totalVoucherValue = activeVouchers.reduce(
      (a, v) => a + Number(v.total_amount || v.amount || 0),
      0
    );

    const paidVoucherValue = filteredVouchers
      .filter((v) => (v.status || "") === "Paid")
      .reduce((a, v) => a + Number(v.total_amount || v.amount || 0), 0);

    const pendingVoucherValue = filteredVouchers
      .filter((v) => {
        const s = v.status || "";
        return s !== "Paid" && s !== "Cancelled";
      })
      .reduce((a, v) => a + Number(v.total_amount || v.amount || 0), 0);

    const allocationTotal = subheads.reduce((a, s) => a + Number(s.approved_allocation || 0), 0);
    const reservedTotal = subheads.reduce((a, s) => a + Number(s.reserved_amount || 0), 0);
    const expenditureTotal = subheads.reduce((a, s) => a + Number(s.expenditure || 0), 0);
    const balanceTotal = subheads.reduce((a, s) => a + Number(s.balance || 0), 0);

    const officialRequests = requests.filter((r) => categoryKey(r) === "official").length;
    const personalFundRequests = requests.filter((r) => categoryKey(r) === "personalfund").length;
    const personalNonFundRequests = requests.filter((r) => categoryKey(r) === "personalnonfund").length;

    const openRequests = requests.filter((r) => {
      const s = (r.status || "").toLowerCase();
      return !s.includes("complete") && !s.includes("paid") && !s.includes("reject");
    }).length;

    const highFindings = auditFindings.filter((f) => f.level === "High").length;
    const mediumFindings = auditFindings.filter((f) => f.level === "Medium").length;

    return {
      totalVouchers: filteredVouchers.length,
      totalVoucherValue,
      paidVoucherValue,
      pendingVoucherValue,
      allocationTotal,
      reservedTotal,
      expenditureTotal,
      balanceTotal,
      officialRequests,
      personalFundRequests,
      personalNonFundRequests,
      openRequests,
      highFindings,
      mediumFindings,
    };
  }, [filteredVouchers, subheads, requests, auditFindings]);

  const subheadExceptions = useMemo(() => {
    return subheads
      .map((s) => {
        const approved = Number(s.approved_allocation || 0);
        const reserved = Number(s.reserved_amount || 0);
        const expenditure = Number(s.expenditure || 0);
        const balance = Number(s.balance || 0);

        let risk: "Low" | "Medium" | "High" = "Low";
        let note = "Healthy";

        if (balance < 0) {
          risk = "High";
          note = "Negative balance";
        } else if (approved > 0 && balance / approved <= 0.1) {
          risk = "Medium";
          note = "Low balance";
        } else if (reserved > balance && balance > 0) {
          risk = "Medium";
          note = "Reserved amount is high against balance";
        }

        return {
          ...s,
          approved,
          reserved,
          expenditure,
          balance,
          risk,
          note,
        };
      })
      .filter((s) => s.risk !== "Low")
      .sort((a, b) => {
        if (a.risk === b.risk) return a.name.localeCompare(b.name);
        return a.risk === "High" ? -1 : 1;
      });
  }, [subheads]);

  const pendingVouchers = useMemo(() => {
    return filteredVouchers
      .filter((v) => {
        const s = v.status || "";
        return s !== "Paid" && s !== "Cancelled";
      })
      .sort((a, b) => daysOld(b.created_at) - daysOld(a.created_at))
      .slice(0, 20);
  }, [filteredVouchers]);

  function resetFilters() {
    setSearch("");
    setFromDate(inputDateValue(firstDay));
    setToDate(inputDateValue(today));
    setStatusFilter("ALL");
    setModeFilter("ALL");
    setRiskFilter("ALL");
  }

  function printAuditReport() {
    window.print();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-7xl py-10 text-slate-600">
          Loading Audit & Reconciliation...
        </div>
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-3xl py-10">
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <h1 className="text-xl font-extrabold text-slate-900">
              Audit & Reconciliation Access
            </h1>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {msg || "Access denied. Only Finance, Account, Auditor and Admin roles can access this page."}
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
          body {
            background: white !important;
          }

          .no-print {
            display: none !important;
          }

          .audit-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <div className="audit-sheet mx-auto max-w-7xl py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Audit & Reconciliation
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Finance control room for vouchers, subheads, exceptions and reconciliation review.
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Period: {fromDate || "Beginning"} to {toDate || "Today"}
            </p>
          </div>

          <div className="no-print flex flex-wrap gap-2">
            <button
              onClick={load}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
            >
              Refresh
            </button>

            <button
              onClick={printAuditReport}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Print Audit Report
            </button>

            <button
              onClick={() => router.push("/payment-vouchers/reports")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
            >
              PV Reports
            </button>

            <button
              onClick={() => router.push("/finance/subheads")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
            >
              Subheads
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-2xl border bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
            {msg}
          </div>
        )}

        {!canSensitiveAudit && (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            You are viewing finance audit summaries. Sensitive administrative settings remain limited
            to Admin and Auditor roles.
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Voucher Value" value={naira(stats.totalVoucherValue)} tone="blue" />
          <StatCard title="Paid Value" value={naira(stats.paidVoucherValue)} tone="emerald" />
          <StatCard title="Pending Value" value={naira(stats.pendingVoucherValue)} tone="amber" />
          <StatCard title="Open Requests" value={String(stats.openRequests)} tone="purple" />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Approved Allocation" value={naira(stats.allocationTotal)} tone="blue" />
          <StatCard title="Reserved" value={naira(stats.reservedTotal)} tone="amber" />
          <StatCard title="Expenditure" value={naira(stats.expenditureTotal)} tone="purple" />
          <StatCard title="Balance" value={naira(stats.balanceTotal)} tone="emerald" />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MiniCard title="Total PVs" value={String(stats.totalVouchers)} />
          <MiniCard title="Official Requests" value={String(stats.officialRequests)} />
          <MiniCard title="Personal Fund" value={String(stats.personalFundRequests)} />
          <MiniCard title="Personal NonFund" value={String(stats.personalNonFundRequests)} />
          <MiniCard title="Audit Alerts" value={`${stats.highFindings} High / ${stats.mediumFindings} Medium`} />
        </div>

        <div className="no-print mt-6 rounded-3xl border bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="xl:col-span-2">
              <label className="text-sm font-semibold text-slate-800">Search</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search voucher no, payee, request no, department..."
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">PV Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="Authorized">Authorized</option>
                <option value="Cheque Prepared">Cheque Prepared</option>
                <option value="Cheque Signed">Cheque Signed</option>
                <option value="Counter Signed">Counter Signed</option>
                <option value="Paid">Paid</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Payment Mode</label>
              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Modes</option>
                <option value="Transfer">Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Risk Level</label>
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Risks</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-slate-50 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-900">Audit Findings</h2>
            <p className="mt-1 text-sm text-slate-600">
              Exception-based review of vouchers and subhead control indicators.
            </p>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {auditFindings.map((f) => (
              <div key={f.id} className="rounded-3xl border bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-extrabold text-slate-900">{f.title}</div>
                  <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${riskBadgeClass(f.level)}`}>
                    {f.level}
                  </span>
                </div>

                <div className="mt-2 text-sm font-semibold text-slate-700">
                  Count: {f.count}
                </div>

                <p className="mt-2 text-sm text-slate-600">{f.description}</p>

                <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-800">
                  Action: {f.action}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b bg-slate-50 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Pending Voucher Watchlist</h2>
              <p className="mt-1 text-sm text-slate-600">
                Active vouchers not yet marked as paid.
              </p>
            </div>

            {pendingVouchers.length === 0 ? (
              <EmptyState message="No pending voucher found for the selected filters." />
            ) : (
              <div className="max-h-[620px] overflow-auto">
                {pendingVouchers.map((v) => (
                  <div key={v.id} className="border-t px-6 py-4 hover:bg-slate-50">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-extrabold text-slate-900">{v.voucher_no}</div>
                        <div className="mt-1 text-sm text-slate-600">
                          {v.payee_name || "—"} • {v.dept_name || "—"}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusBadgeClass(v.status)}`}>
                          {v.status || "—"}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                          {daysOld(v.created_at)} day(s)
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                      <InfoLine label="Amount" value={naira(v.total_amount || v.amount)} />
                      <InfoLine label="Mode" value={v.disbursement_mode || "—"} />
                      <InfoLine label="Request" value={v.request_no || "—"} />
                      <InfoLine label="Type" value={categoryLabel(v)} />
                    </div>

                    <div className="no-print mt-3 flex justify-end gap-2">
                      <button
                        onClick={() => router.push(`/payment-vouchers/${v.id}`)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                      >
                        View
                      </button>

                      <button
                        onClick={() => router.push(`/payment-vouchers/${v.id}/print`)}
                        className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        Print
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b bg-slate-50 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Subhead Exceptions</h2>
              <p className="mt-1 text-sm text-slate-600">
                Budget lines requiring finance review.
              </p>
            </div>

            {subheadExceptions.length === 0 ? (
              <EmptyState message="No subhead exception found." />
            ) : (
              <div className="max-h-[620px] overflow-auto">
                {subheadExceptions.map((s) => (
                  <div key={s.id} className="border-t px-6 py-4 hover:bg-slate-50">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-extrabold text-slate-900">
                          {s.code ? `${s.code} — ` : ""}
                          {s.name}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-600">
                          {s.note}
                        </div>
                      </div>

                      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${riskBadgeClass(s.risk)}`}>
                        {s.risk}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                      <InfoLine label="Allocation" value={naira(s.approved)} />
                      <InfoLine label="Reserved" value={naira(s.reserved)} />
                      <InfoLine label="Expenditure" value={naira(s.expenditure)} />
                      <InfoLine label="Balance" value={naira(s.balance)} />
                    </div>

                    <div className="no-print mt-3 flex justify-end">
                      <button
                        onClick={() => router.push("/finance/subheads")}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                      >
                        Open Subheads
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-3xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-slate-50 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-900">Voucher Audit Register</h2>
            <p className="mt-1 text-sm text-slate-600">
              Filtered voucher register for reconciliation review.
            </p>
          </div>

          {filteredVouchers.length === 0 ? (
            <EmptyState message="No payment voucher found for selected filters." />
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1420px]">
                <div className="grid grid-cols-18 bg-slate-100 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <div className="col-span-2">PV No</div>
                  <div className="col-span-2">Request</div>
                  <div className="col-span-2">Payee</div>
                  <div className="col-span-2">Department</div>
                  <div className="col-span-1">Type</div>
                  <div className="col-span-1">Mode</div>
                  <div className="col-span-2 text-right">Amount</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1">Age</div>
                  <div className="col-span-1">Date</div>
                  <div className="col-span-3 text-right no-print">Action</div>
                </div>

                {filteredVouchers.map((v) => (
                  <div
                    key={v.id}
                    className="grid grid-cols-18 items-center border-t px-6 py-4 text-sm hover:bg-slate-50"
                  >
                    <div className="col-span-2 font-extrabold text-slate-900">
                      {v.voucher_no}
                    </div>

                    <div className="col-span-2 text-slate-700">{v.request_no || "—"}</div>

                    <div className="col-span-2 font-semibold text-slate-900">
                      {v.payee_name || "—"}
                    </div>

                    <div className="col-span-2 text-slate-700">{v.dept_name || "—"}</div>

                    <div className="col-span-1">
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${categoryBadgeClass(v)}`}>
                        {categoryLabel(v)}
                      </span>
                    </div>

                    <div className="col-span-1 text-slate-700">
                      {v.disbursement_mode || "—"}
                    </div>

                    <div className="col-span-2 text-right font-extrabold text-slate-900">
                      {naira(v.total_amount || v.amount)}
                    </div>

                    <div className="col-span-1">
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${statusBadgeClass(v.status)}`}>
                        {v.status || "—"}
                      </span>
                    </div>

                    <div className="col-span-1 text-slate-600">
                      {daysOld(v.created_at)}d
                    </div>

                    <div className="col-span-1 text-slate-600">
                      {shortDate(v.created_at)}
                    </div>

                    <div className="col-span-3 flex justify-end gap-2 no-print">
                      <button
                        onClick={() => router.push(`/payment-vouchers/${v.id}`)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                      >
                        View
                      </button>

                      <button
                        onClick={() => router.push(`/payment-vouchers/${v.id}/print`)}
                        className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        Print
                      </button>
                    </div>
                  </div>
                ))}

                <div className="grid grid-cols-18 border-t bg-slate-50 px-6 py-4 text-sm">
                  <div className="col-span-8 font-black uppercase text-slate-900">
                    Reconciliation Total
                  </div>
                  <div className="col-span-4 text-right font-black text-slate-900">
                    {naira(stats.totalVoucherValue)}
                  </div>
                  <div className="col-span-6 text-right text-xs font-semibold text-slate-500">
                    Excludes cancelled vouchers
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
          <div className="font-bold">Audit & Reconciliation Note</div>
          <p className="mt-1">
            This page provides management-level finance oversight: voucher exposure, payment status,
            cheque workflow delays, cancelled vouchers, subhead balance exceptions and reconciliation
            totals. It is designed as a mini-government finance audit control room.
          </p>
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
  tone: "blue" | "emerald" | "purple" | "amber" | "red" | "slate";
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "purple"
      ? "bg-purple-50 text-purple-700"
      : tone === "amber"
      ? "bg-amber-50 text-amber-700"
      : tone === "red"
      ? "bg-red-50 text-red-700"
      : tone === "slate"
      ? "bg-slate-50 text-slate-700"
      : "bg-blue-50 text-blue-700";

  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      <div className={`mt-3 inline-flex rounded-2xl px-3 py-2 text-xl font-extrabold ${cls}`}>
        {value}
      </div>
    </div>
  );
}

function MiniCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="mt-2 text-lg font-extrabold text-slate-900">
        {value}
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-500">{label}:</span>{" "}
      <b className="text-slate-900">{value}</b>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-6 text-sm text-slate-700">
      {message}
    </div>
  );
}