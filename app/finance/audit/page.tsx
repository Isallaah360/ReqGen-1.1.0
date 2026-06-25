"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { exportTableToExcel, printReport } from "@/lib/reportExport";

type ProfileMini = {
  id: string;
  role: string | null;
};

type BankAccount = {
  id: string;
  code: string | null;
  name: string;
  bank_name: string | null;
  account_number: string | null;
  is_active: boolean | null;
  total_fund: number | null;
  allocated_amount: number | null;
  reserved_amount: number | null;
  expenditure: number | null;
  unallocated_balance: number | null;
  available_balance: number | null;
  last_recalculated_at: string | null;
};

type DeptRow = {
  id: string;
  name: string;
};

type SubheadRow = {
  id: string;
  dept_id: string | null;
  bank_account_id: string | null;
  code: string | null;
  name: string;
  approved_allocation: number | null;
  reserved_amount: number | null;
  expenditure: number | null;
  balance: number | null;
  is_active: boolean | null;
  updated_at: string | null;
};

type LedgerRow = {
  id: string;
  bank_account_id: string;
  department_id: string | null;
  subhead_id: string | null;
  request_id: string | null;
  voucher_id: string | null;
  entry_type: string;
  amount: number | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
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
  subhead_id: string | null;
  created_at: string;
};

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

type AuditFinding = {
  id: string;
  title: string;
  description: string;
  level: "Low" | "Medium" | "High";
  count: number;
  action: string;
};

type SubheadException = SubheadRow & {
  approved: number;
  reserved: number;
  spent: number;
  remaining: number;
  risk: "Low" | "Medium" | "High";
  note: string;
};

type BankException = BankAccount & {
  risk: "Low" | "Medium" | "High";
  note: string;
};

type DepartmentSummary = {
  department_id: string;
  department_name: string;
  subheads: number;
  allocation: number;
  reserved: number;
  expenditure: number;
  balance: number;
};

type TabKey = "overview" | "banks" | "departments" | "subheads" | "vouchers" | "ledger";

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

function plainAmount(n: number | null | undefined) {
  return Math.round(Number(n || 0)).toLocaleString();
}

function shortDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function shortDateTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

function inputDateValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

function maskAccountNumber(value: string | null | undefined) {
  const raw = (value || "").trim();

  if (!raw) return "—";
  if (raw.length <= 4) return raw;

  return `${"*".repeat(Math.max(raw.length - 4, 0))}${raw.slice(-4)}`;
}

function daysOld(d: string | null | undefined) {
  if (!d) return 0;

  const created = new Date(d).getTime();
  const now = new Date().getTime();

  return Math.max(0, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
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

function bankLabel(bank: BankAccount | null | undefined) {
  if (!bank) return "No IET Bank Linked";
  return `${bank.code ? `${bank.code} — ` : ""}${bank.name}`;
}

function bankSubLabel(bank: BankAccount | null | undefined) {
  if (!bank) return "No bank details";
  return `${bank.bank_name || "Bank"} • ${maskAccountNumber(bank.account_number)}`;
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

function filterVouchers(
  vouchers: VoucherRow[],
  search: string,
  fromDate: string,
  toDate: string,
  statusFilter: string,
  modeFilter: string
) {
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
}

function filterLedger(
  ledger: LedgerRow[],
  search: string,
  fromDate: string,
  toDate: string,
  entryTypeFilter: string
) {
  const s = search.trim().toLowerCase();

  return ledger.filter((row) => {
    if (!isWithinDateRange(row.created_at, fromDate, toDate)) return false;

    if (entryTypeFilter !== "ALL" && row.entry_type !== entryTypeFilter) return false;

    if (s) {
      const haystack = [
        row.entry_type,
        row.amount,
        row.description,
        row.bank_account_id,
        row.department_id,
        row.subhead_id,
        row.request_id,
        row.voucher_id,
      ]
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(s)) return false;
    }

    return true;
  });
}

function buildSubheadExceptions(subheads: SubheadRow[]) {
  return subheads
    .map((s) => {
      const approved = Number(s.approved_allocation || 0);
      const reserved = Number(s.reserved_amount || 0);
      const spent = Number(s.expenditure || 0);
      const remaining = Number(s.balance || 0);

      let risk: "Low" | "Medium" | "High" = "Low";
      let note = "Healthy";

      if (!s.bank_account_id) {
        risk = "High";
        note = "No IET bank account linked";
      } else if (remaining < 0) {
        risk = "High";
        note = "Negative subhead balance";
      } else if (approved > 0 && remaining / approved <= 0.1) {
        risk = "Medium";
        note = "Low balance";
      } else if (reserved > remaining && remaining > 0) {
        risk = "Medium";
        note = "Reserved amount is high against balance";
      } else if (s.is_active === false && (reserved > 0 || spent > 0)) {
        risk = "Medium";
        note = "Inactive but has financial activity";
      }

      return {
        ...s,
        approved,
        reserved,
        spent,
        remaining,
        risk,
        note,
      };
    })
    .filter((s) => s.risk !== "Low")
    .sort((a, b) => {
      if (a.risk === b.risk) return a.name.localeCompare(b.name);
      return a.risk === "High" ? -1 : 1;
    });
}

function buildBankExceptions(banks: BankAccount[]) {
  return banks
    .map((b) => {
      let risk: "Low" | "Medium" | "High" = "Low";
      let note = "Healthy";

      if (Number(b.total_fund || 0) <= 0) {
        risk = "High";
        note = "Bank has no total fund";
      } else if (Number(b.unallocated_balance || 0) < 0) {
        risk = "High";
        note = "Bank is over-allocated";
      } else if (Number(b.available_balance || 0) < 0) {
        risk = "High";
        note = "Bank available balance is negative";
      } else if (b.is_active === false && Number(b.allocated_amount || 0) > 0) {
        risk = "Medium";
        note = "Inactive bank still funds subheads";
      } else if (Number(b.unallocated_balance || 0) === 0 && Number(b.total_fund || 0) > 0) {
        risk = "Medium";
        note = "Fully allocated";
      }

      return { ...b, risk, note };
    })
    .filter((b) => b.risk !== "Low")
    .sort((a, b) => {
      if (a.risk === b.risk) return a.name.localeCompare(b.name);
      return a.risk === "High" ? -1 : 1;
    });
}

function buildDepartmentSummary(depts: DeptRow[], subheads: SubheadRow[]) {
  const map: Record<string, DepartmentSummary> = {};

  subheads.forEach((s) => {
    const id = s.dept_id || "NO_DEPARTMENT";

    if (!map[id]) {
      const deptName =
        id === "NO_DEPARTMENT" ? "No Department" : depts.find((d) => d.id === id)?.name || id;

      map[id] = {
        department_id: id,
        department_name: deptName,
        subheads: 0,
        allocation: 0,
        reserved: 0,
        expenditure: 0,
        balance: 0,
      };
    }

    map[id].subheads += 1;
    map[id].allocation += Number(s.approved_allocation || 0);
    map[id].reserved += Number(s.reserved_amount || 0);
    map[id].expenditure += Number(s.expenditure || 0);
    map[id].balance += Number(s.balance || 0);
  });

  return Object.values(map).sort((a, b) => a.department_name.localeCompare(b.department_name));
}

function buildAuditFindings(
  filteredVouchers: VoucherRow[],
  banks: BankAccount[],
  subheads: SubheadRow[],
  requests: RequestRow[],
  riskFilter: string
) {
  const findings: AuditFinding[] = [];

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

  const noBankSubheads = subheads.filter((s) => !s.bank_account_id);
  const overdrawnSubheads = subheads.filter((s) => Number(s.balance || 0) < 0);

  const lowBalanceSubheads = subheads.filter((s) => {
    const approved = Number(s.approved_allocation || 0);
    const balance = Number(s.balance || 0);
    if (approved <= 0) return false;
    return balance >= 0 && balance / approved <= 0.1;
  });

  const overAllocatedBanks = banks.filter((b) => Number(b.unallocated_balance || 0) < 0);
  const negativeBankAvailable = banks.filter((b) => Number(b.available_balance || 0) < 0);
  const unfundedBanks = banks.filter((b) => Number(b.total_fund || 0) <= 0);

  const officialWithoutSubhead = requests.filter((r) => {
    const key = categoryKey(r);
    const s = normalize(r.status);
    return key === "official" && !r.subhead_id && !["rejected", "deleted", "cancelled"].includes(s);
  });

  if (unfundedBanks.length > 0) {
    findings.push({
      id: "unfunded-banks",
      title: "IET Bank Accounts Without Fund",
      description:
        "Some IET bank accounts have zero total fund. Allocations cannot be properly controlled until funding is entered.",
      level: "High",
      count: unfundedBanks.length,
      action: "Open IET Banks page and set total fund for affected accounts.",
    });
  }

  if (overAllocatedBanks.length > 0) {
    findings.push({
      id: "overallocated-banks",
      title: "Over-Allocated IET Banks",
      description: "Some banks have allocated more to subheads than the total bank fund permits.",
      level: "High",
      count: overAllocatedBanks.length,
      action: "Reduce affected subhead allocations or increase the correct bank fund.",
    });
  }

  if (negativeBankAvailable.length > 0) {
    findings.push({
      id: "negative-bank-available",
      title: "Negative Bank Available Balance",
      description: "Some banks show negative available balance after reservations and expenditure.",
      level: "High",
      count: negativeBankAvailable.length,
      action: "Review reservations, expenditure and bank funding records.",
    });
  }

  if (noBankSubheads.length > 0) {
    findings.push({
      id: "subheads-no-bank",
      title: "Subheads Without IET Bank Funding Source",
      description:
        "Some subheads are not linked to any IET bank account, making reconciliation incomplete.",
      level: "High",
      count: noBankSubheads.length,
      action: "Open Subheads and assign each operational subhead to an IET Bank account.",
    });
  }

  if (officialWithoutSubhead.length > 0) {
    findings.push({
      id: "official-no-subhead",
      title: "Official Requests Without Subhead",
      description:
        "Some active official requests have no subhead assignment. This may prevent accurate budget control.",
      level: "High",
      count: officialWithoutSubhead.length,
      action: "Review active official requests and assign correct subheads before finance processing.",
    });
  }

  if (cancelled.length > 0) {
    findings.push({
      id: "cancelled",
      title: "Cancelled Payment Vouchers",
      description:
        "Cancelled vouchers should be reviewed to confirm why they were voided and whether linked requests were regenerated correctly.",
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
      description:
        "Cheque vouchers should pass through cheque signature, counter signature and final payment promptly.",
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
}

function buildStats(
  filteredVouchers: VoucherRow[],
  banks: BankAccount[],
  subheads: SubheadRow[],
  requests: RequestRow[],
  auditFindings: AuditFinding[]
) {
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

  const bankTotalFund = banks.reduce((a, b) => a + Number(b.total_fund || 0), 0);
  const bankAllocated = banks.reduce((a, b) => a + Number(b.allocated_amount || 0), 0);
  const bankUnallocated = banks.reduce((a, b) => a + Number(b.unallocated_balance || 0), 0);
  const bankReserved = banks.reduce((a, b) => a + Number(b.reserved_amount || 0), 0);
  const bankExpenditure = banks.reduce((a, b) => a + Number(b.expenditure || 0), 0);
  const bankAvailable = banks.reduce((a, b) => a + Number(b.available_balance || 0), 0);

  const allocationTotal = subheads.reduce((a, s) => a + Number(s.approved_allocation || 0), 0);
  const reservedTotal = subheads.reduce((a, s) => a + Number(s.reserved_amount || 0), 0);
  const expenditureTotal = subheads.reduce((a, s) => a + Number(s.expenditure || 0), 0);
  const balanceTotal = subheads.reduce((a, s) => a + Number(s.balance || 0), 0);

  const officialRequests = requests.filter((r) => categoryKey(r) === "official").length;
  const personalFundRequests = requests.filter((r) => categoryKey(r) === "personalfund").length;
  const personalNonFundRequests = requests.filter((r) => categoryKey(r) === "personalnonfund").length;

  const openRequests = requests.filter((r) => {
    const s = normalize(r.status);
    return !s.includes("complete") && !s.includes("paid") && !s.includes("reject");
  }).length;

  const highFindings = auditFindings.filter((f) => f.level === "High").length;
  const mediumFindings = auditFindings.filter((f) => f.level === "Medium").length;

  return {
    totalVouchers: filteredVouchers.length,
    totalVoucherValue,
    paidVoucherValue,
    pendingVoucherValue,

    bankTotalFund,
    bankAllocated,
    bankUnallocated,
    bankReserved,
    bankExpenditure,
    bankAvailable,

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
}

export default function FinanceAuditPage() {
  const router = useRouter();

  const today = useMemo(() => new Date(), []);
  const firstDay = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [me, setMe] = useState<ProfileMini | null>(null);
  const rk = roleKey(me?.role);

  const canAccess = ["admin", "auditor", "account", "accounts", "accountofficer"].includes(rk);
  const canSensitiveAudit = ["admin", "auditor"].includes(rk);

  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [depts, setDepts] = useState<DeptRow[]>([]);
  const [subheads, setSubheads] = useState<SubheadRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);

  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState(inputDateValue(firstDay));
  const [toDate, setToDate] = useState(inputDateValue(today));
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [modeFilter, setModeFilter] = useState("ALL");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [entryTypeFilter, setEntryTypeFilter] = useState("ALL");

  const load = useCallback(
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
        .select("id,role")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (profErr || !prof) {
        setMsg("Failed to load your profile: " + (profErr?.message || "Profile not found."));
        setLoading(false);
        setRefreshing(false);
        return null;
      }

      setMe(prof as ProfileMini);

      const role = roleKey(prof.role);

      if (!["admin", "auditor", "account", "accounts", "accountofficer"].includes(role)) {
        setMsg(
          "Access denied. Only Finance, Account, Auditor and Admin roles can access Audit & Reconciliation."
        );
        setBanks([]);
        setDepts([]);
        setSubheads([]);
        setRequests([]);
        setVouchers([]);
        setLedger([]);
        setLoading(false);
        setRefreshing(false);

        return {
          banks: [] as BankAccount[],
          depts: [] as DeptRow[],
          subheads: [] as SubheadRow[],
          requests: [] as RequestRow[],
          vouchers: [] as VoucherRow[],
          ledger: [] as LedgerRow[],
        };
      }

      await supabase.rpc("reqgen_recalculate_all_iet_accounts");

      const [bankRes, deptRes, subheadRes, requestRes, voucherRes, ledgerRes] = await Promise.all([
        supabase
          .from("iet_accounts")
          .select(
            "id,code,name,bank_name,account_number,is_active,total_fund,allocated_amount,reserved_amount,expenditure,unallocated_balance,available_balance,last_recalculated_at"
          )
          .order("name", { ascending: true }),

        supabase.from("departments").select("id,name").order("name", { ascending: true }),

        supabase
          .from("subheads")
          .select(
            "id,dept_id,bank_account_id,code,name,approved_allocation,reserved_amount,expenditure,balance,is_active,updated_at"
          )
          .order("code", { ascending: true }),

        supabase
          .from("requests")
          .select(
            "id,request_no,title,amount,status,current_stage,request_type,personal_category,subhead_id,created_at"
          )
          .order("created_at", { ascending: false })
          .limit(500),

        supabase.rpc("get_payment_vouchers"),

        supabase
          .from("iet_bank_ledger")
          .select(
            "id,bank_account_id,department_id,subhead_id,request_id,voucher_id,entry_type,amount,description,created_by,created_at"
          )
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      let freshBanks: BankAccount[] = [];
      let freshDepts: DeptRow[] = [];
      let freshSubheads: SubheadRow[] = [];
      let freshRequests: RequestRow[] = [];
      let freshVouchers: VoucherRow[] = [];
      let freshLedger: LedgerRow[] = [];

      if (bankRes.error) {
        setMsg("Failed to load IET banks: " + bankRes.error.message);
      } else {
        freshBanks = ((bankRes.data || []) as BankAccount[]).map((b) => ({
          ...b,
          total_fund: Number(b.total_fund || 0),
          allocated_amount: Number(b.allocated_amount || 0),
          reserved_amount: Number(b.reserved_amount || 0),
          expenditure: Number(b.expenditure || 0),
          unallocated_balance: Number(b.unallocated_balance || 0),
          available_balance: Number(b.available_balance || 0),
        }));
        setBanks(freshBanks);
      }

      if (deptRes.error) {
        setMsg("Failed to load departments: " + deptRes.error.message);
      } else {
        freshDepts = (deptRes.data || []) as DeptRow[];
        setDepts(freshDepts);
      }

      if (subheadRes.error) {
        setMsg("Failed to load subheads: " + subheadRes.error.message);
      } else {
        freshSubheads = ((subheadRes.data || []) as SubheadRow[]).map((s) => ({
          ...s,
          approved_allocation: Number(s.approved_allocation || 0),
          reserved_amount: Number(s.reserved_amount || 0),
          expenditure: Number(s.expenditure || 0),
          balance: Number(s.balance || 0),
        }));
        setSubheads(freshSubheads);
      }

      if (requestRes.error) {
        setMsg("Failed to load requests: " + requestRes.error.message);
      } else {
        freshRequests = (requestRes.data || []) as RequestRow[];
        setRequests(freshRequests);
      }

      if (voucherRes.error) {
        setMsg("Failed to load payment vouchers: " + voucherRes.error.message);
      } else {
        freshVouchers = (voucherRes.data || []) as VoucherRow[];
        setVouchers(freshVouchers);
      }

      if (ledgerRes.error) {
        setMsg("Failed to load bank ledger: " + ledgerRes.error.message);
      } else {
        freshLedger = ((ledgerRes.data || []) as LedgerRow[]).map((l) => ({
          ...l,
          amount: Number(l.amount || 0),
        }));
        setLedger(freshLedger);
      }

      setLoading(false);
      setRefreshing(false);

      return {
        banks: freshBanks,
        depts: freshDepts,
        subheads: freshSubheads,
        requests: freshRequests,
        vouchers: freshVouchers,
        ledger: freshLedger,
      };
    },
    [router]
  );

  useEffect(() => {
    load();

    const refreshOnFocus = () => {
      load({ silent: true });
    };

    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") {
        load({ silent: true });
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisible);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [load]);

  const bankMap = useMemo(() => {
    const m: Record<string, BankAccount> = {};
    banks.forEach((b) => {
      m[b.id] = b;
    });
    return m;
  }, [banks]);

  const deptMap = useMemo(() => {
    const m: Record<string, DeptRow> = {};
    depts.forEach((d) => {
      m[d.id] = d;
    });
    return m;
  }, [depts]);

  const subheadMap = useMemo(() => {
    const m: Record<string, SubheadRow> = {};
    subheads.forEach((s) => {
      m[s.id] = s;
    });
    return m;
  }, [subheads]);

  const filteredVouchers = useMemo(() => {
    return filterVouchers(vouchers, search, fromDate, toDate, statusFilter, modeFilter);
  }, [vouchers, search, fromDate, toDate, statusFilter, modeFilter]);

  const filteredLedger = useMemo(() => {
    return filterLedger(ledger, search, fromDate, toDate, entryTypeFilter);
  }, [ledger, search, fromDate, toDate, entryTypeFilter]);

  const bankExceptions = useMemo(() => buildBankExceptions(banks), [banks]);
  const subheadExceptions = useMemo(() => buildSubheadExceptions(subheads), [subheads]);
  const departmentSummary = useMemo(() => buildDepartmentSummary(depts, subheads), [depts, subheads]);

  const auditFindings = useMemo<AuditFinding[]>(() => {
    return buildAuditFindings(filteredVouchers, banks, subheads, requests, riskFilter);
  }, [filteredVouchers, banks, subheads, requests, riskFilter]);

  const stats = useMemo(() => {
    return buildStats(filteredVouchers, banks, subheads, requests, auditFindings);
  }, [filteredVouchers, banks, subheads, requests, auditFindings]);

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
    setEntryTypeFilter("ALL");
  }

  async function printAuditReport() {
    setPrinting(true);
    await load({ silent: true });

    setTimeout(() => {
      printReport();
      setPrinting(false);
    }, 250);
  }

  async function exportAuditExcel() {
    setExporting(true);

    const fresh = await load({ silent: true });

    const exportBanks = fresh?.banks || banks;
    const exportDepts = fresh?.depts || depts;
    const exportSubheads = fresh?.subheads || subheads;
    const exportRequests = fresh?.requests || requests;
    const exportVouchers = fresh?.vouchers || vouchers;
    const exportLedger = fresh?.ledger || ledger;

    const exportFilteredVouchers = filterVouchers(
      exportVouchers,
      search,
      fromDate,
      toDate,
      statusFilter,
      modeFilter
    );

    const exportFilteredLedger = filterLedger(
      exportLedger,
      search,
      fromDate,
      toDate,
      entryTypeFilter
    );

    const exportFindings = buildAuditFindings(
      exportFilteredVouchers,
      exportBanks,
      exportSubheads,
      exportRequests,
      riskFilter
    );

    const exportStats = buildStats(
      exportFilteredVouchers,
      exportBanks,
      exportSubheads,
      exportRequests,
      exportFindings
    );

    const exportBankExceptions = buildBankExceptions(exportBanks);
    const exportSubheadExceptions = buildSubheadExceptions(exportSubheads);
    const exportDeptSummary = buildDepartmentSummary(exportDepts, exportSubheads);

    const exportBankMap: Record<string, BankAccount> = {};
    exportBanks.forEach((b) => {
      exportBankMap[b.id] = b;
    });

    const exportDeptMap: Record<string, DeptRow> = {};
    exportDepts.forEach((d) => {
      exportDeptMap[d.id] = d;
    });

    const exportSubheadMap: Record<string, SubheadRow> = {};
    exportSubheads.forEach((s) => {
      exportSubheadMap[s.id] = s;
    });

    type AuditExportRow = {
      section: string;
      sn: number | string;
      reference: string;
      description: string;
      category: string;
      status: string;
      amount: string;
      risk: string;
      action: string;
      date: string;
    };

    const summaryRows: AuditExportRow[] = [
      {
        section: "Summary",
        sn: 1,
        reference: "Total IET Bank Fund",
        description: "Total lump sum fund across IET bank accounts",
        category: "Banks",
        status: "Summary",
        amount: plainAmount(exportStats.bankTotalFund),
        risk: "",
        action: "",
        date: "",
      },
      {
        section: "Summary",
        sn: 2,
        reference: "Allocated to Subheads",
        description: "Total allocation from IET banks to subheads",
        category: "Banks/Subheads",
        status: "Summary",
        amount: plainAmount(exportStats.bankAllocated),
        risk: "",
        action: "",
        date: "",
      },
      {
        section: "Summary",
        sn: 3,
        reference: "Unallocated Bank Balance",
        description: "Bank fund not yet allocated to subheads",
        category: "Banks",
        status: "Summary",
        amount: plainAmount(exportStats.bankUnallocated),
        risk: "",
        action: "",
        date: "",
      },
      {
        section: "Summary",
        sn: 4,
        reference: "Reserved",
        description: "Total reserved amount from subheads",
        category: "Subheads",
        status: "Summary",
        amount: plainAmount(exportStats.reservedTotal),
        risk: "",
        action: "",
        date: "",
      },
      {
        section: "Summary",
        sn: 5,
        reference: "Expenditure",
        description: "Total expenditure from subheads",
        category: "Subheads",
        status: "Summary",
        amount: plainAmount(exportStats.expenditureTotal),
        risk: "",
        action: "",
        date: "",
      },
      {
        section: "Summary",
        sn: 6,
        reference: "Voucher Value",
        description: "Total active voucher value excluding cancelled vouchers",
        category: "Payment Vouchers",
        status: "Summary",
        amount: plainAmount(exportStats.totalVoucherValue),
        risk: "",
        action: "",
        date: "",
      },
    ];

    const findingRows: AuditExportRow[] = exportFindings.map((f, index) => ({
      section: "Audit Finding",
      sn: index + 1,
      reference: f.title,
      description: f.description,
      category: "Exception",
      status: `Count: ${f.count}`,
      amount: "",
      risk: f.level,
      action: f.action,
      date: "",
    }));

    const bankRows: AuditExportRow[] = exportBanks.map((b, index) => ({
      section: "IET Bank",
      sn: index + 1,
      reference: bankLabel(b),
      description: bankSubLabel(b),
      category: "Bank Funding",
      status: b.is_active === false ? "Inactive" : "Active",
      amount: `Total Fund: ${plainAmount(b.total_fund)} | Allocated: ${plainAmount(
        b.allocated_amount
      )} | Unallocated: ${plainAmount(b.unallocated_balance)} | Reserved: ${plainAmount(
        b.reserved_amount
      )} | Expenditure: ${plainAmount(b.expenditure)} | Available: ${plainAmount(
        b.available_balance
      )}`,
      risk:
        Number(b.unallocated_balance || 0) < 0 || Number(b.available_balance || 0) < 0
          ? "High"
          : "Low",
      action: "Review bank funding, allocation and reconciliation balances.",
      date: shortDateTime(b.last_recalculated_at),
    }));

    const departmentRows: AuditExportRow[] = exportDeptSummary.map((d, index) => ({
      section: "Department Summary",
      sn: index + 1,
      reference: d.department_name,
      description: `Subheads: ${d.subheads}`,
      category: "Department",
      status: "Summary",
      amount: `Allocation: ${plainAmount(d.allocation)} | Reserved: ${plainAmount(
        d.reserved
      )} | Expenditure: ${plainAmount(d.expenditure)} | Balance: ${plainAmount(d.balance)}`,
      risk: d.balance < 0 ? "High" : "Low",
      action: d.balance < 0 ? "Review department subhead balances." : "Routine monitoring.",
      date: "",
    }));

    const bankExceptionRows: AuditExportRow[] = exportBankExceptions.map((b, index) => ({
      section: "Bank Exception",
      sn: index + 1,
      reference: bankLabel(b),
      description: b.note,
      category: "Bank",
      status: b.is_active === false ? "Inactive" : "Active",
      amount: `Total Fund: ${plainAmount(b.total_fund)} | Available: ${plainAmount(
        b.available_balance
      )}`,
      risk: b.risk,
      action: "Review IET bank funding and allocations.",
      date: "",
    }));

    const subheadExceptionRows: AuditExportRow[] = exportSubheadExceptions.map((s, index) => {
      const bank = s.bank_account_id ? exportBankMap[s.bank_account_id] : null;

      return {
        section: "Subhead Exception",
        sn: index + 1,
        reference: `${s.code || ""} ${s.name}`.trim(),
        description: `${s.note} | ${bankLabel(bank)}`,
        category: "Subhead",
        status: s.is_active === false ? "Inactive" : "Active",
        amount: `Allocation: ${plainAmount(s.approved)} | Reserved: ${plainAmount(
          s.reserved
        )} | Expenditure: ${plainAmount(s.spent)} | Balance: ${plainAmount(s.remaining)}`,
        risk: s.risk,
        action: "Review subhead allocation, reserved amount, expenditure and bank link.",
        date: "",
      };
    });

    const ledgerRows: AuditExportRow[] = exportFilteredLedger.map((l, index) => {
      const bank = exportBankMap[l.bank_account_id];
      const dept = l.department_id ? exportDeptMap[l.department_id] : null;
      const sub = l.subhead_id ? exportSubheadMap[l.subhead_id] : null;

      return {
        section: "Bank Ledger",
        sn: index + 1,
        reference: l.entry_type,
        description: `${bankLabel(bank)} | ${dept?.name || "No department"} | ${
          sub ? `${sub.code || ""} ${sub.name}`.trim() : "No subhead"
        } | ${l.description || ""}`,
        category: "Ledger",
        status: "Posted",
        amount: plainAmount(l.amount),
        risk: "",
        action: "Ledger movement record.",
        date: shortDateTime(l.created_at),
      };
    });

    const voucherRows: AuditExportRow[] = exportFilteredVouchers.map((v, index) => ({
      section: "Voucher Register",
      sn: index + 1,
      reference: v.voucher_no,
      description: `${v.payee_name || "—"} | ${v.dept_name || "—"} | ${v.request_no || "—"}`,
      category: `${categoryLabel(v)} / ${v.disbursement_mode || "—"}`,
      status: v.status || "—",
      amount: plainAmount(v.total_amount || v.amount),
      risk:
        (v.status || "") !== "Paid" && (v.status || "") !== "Cancelled" && daysOld(v.created_at) >= 7
          ? "Medium"
          : "Low",
      action:
        (v.status || "") === "Paid"
          ? "No action required."
          : (v.status || "") === "Cancelled"
          ? "Review cancellation reason."
          : "Follow up pending payment/signature workflow.",
      date: shortDate(v.created_at),
    }));

    const rows = [
      ...summaryRows,
      ...findingRows,
      ...bankRows,
      ...departmentRows,
      ...bankExceptionRows,
      ...subheadExceptionRows,
      ...ledgerRows,
      ...voucherRows,
    ];

    exportTableToExcel<AuditExportRow>({
      fileName: `audit_reconciliation_report_${fromDate}_to_${toDate}`,
      sheetName: "Audit Report",
      title: "AUDIT AND RECONCILIATION REPORT",
      subtitle: `Period: ${fromDate || "Beginning"} to ${toDate || "Today"} | Total Bank Fund: ${naira(
        exportStats.bankTotalFund
      )} | Voucher Value: ${naira(exportStats.totalVoucherValue)} | Alerts: ${
        exportStats.highFindings
      } High / ${exportStats.mediumFindings} Medium`,
      rows,
      columns: [
        { header: "Section", value: (row) => row.section },
        { header: "S/N", value: (row) => row.sn },
        { header: "Reference", value: (row) => row.reference },
        { header: "Description", value: (row) => row.description },
        { header: "Category", value: (row) => row.category },
        { header: "Status", value: (row) => row.status },
        { header: "Amount / Values", value: (row) => row.amount },
        { header: "Risk", value: (row) => row.risk },
        { header: "Recommended Action", value: (row) => row.action },
        { header: "Date", value: (row) => row.date },
      ],
      footerRows: [
        [
          "Summary Total",
          "",
          "IET Bank Fund",
          "Total bank funding across all IET accounts",
          "",
          "",
          plainAmount(exportStats.bankTotalFund),
          "",
          "",
          "",
        ],
      ],
    });

    setExporting(false);
  }

  function openVoucher(voucherId: string) {
    router.push(`/payment-vouchers/${voucherId}?updated=${Date.now()}`);
    router.refresh();
  }

  function printVoucher(voucherId: string) {
    router.push(`/payment-vouchers/${voucherId}/print?updated=${Date.now()}`);
    router.refresh();
  }

  function openPvReports() {
    router.push(`/payment-vouchers/reports?updated=${Date.now()}`);
    router.refresh();
  }

  function openSubheads() {
    router.push(`/finance/subheads?updated=${Date.now()}`);
    router.refresh();
  }

  function openBanks() {
    router.push(`/finance/manage-accounts?updated=${Date.now()}`);
    router.refresh();
  }

  function goDashboard() {
    router.push(`/dashboard?updated=${Date.now()}`);
    router.refresh();
  }

  function backToFinance() {
    router.push(`/finance?updated=${Date.now()}`);
    router.refresh();
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
              onClick={goDashboard}
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

          .audit-sheet {
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

      <div className="audit-sheet mx-auto max-w-7xl py-8">
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
                Audit & Reconciliation Report
              </div>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 print:mt-3 print:text-xl">
              Audit & Reconciliation
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Finance control room for IET banks, subheads, bank ledger, vouchers and reconciliation warnings.
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Period: {fromDate || "Beginning"} to {toDate || "Today"} • Generated:{" "}
              {new Date().toLocaleString()}
            </p>
          </div>

          <div className="no-print flex flex-wrap gap-2">
            <button
              onClick={() => load({ silent: true })}
              disabled={refreshing || printing || exporting}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={printAuditReport}
              disabled={refreshing || printing || exporting}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {printing ? "Preparing..." : "Print / Save PDF"}
            </button>

            <button
              onClick={exportAuditExcel}
              disabled={refreshing || printing || exporting}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {exporting ? "Exporting..." : "Export Excel"}
            </button>

            <button
              onClick={openBanks}
              disabled={refreshing || printing || exporting}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 disabled:opacity-60"
            >
              IET Banks
            </button>

            <button
              onClick={openSubheads}
              disabled={refreshing || printing || exporting}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 disabled:opacity-60"
            >
              Subheads
            </button>

            <button
              onClick={openPvReports}
              disabled={refreshing || printing || exporting}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 disabled:opacity-60"
            >
              PV Reports
            </button>

            <button
              onClick={backToFinance}
              disabled={refreshing || printing || exporting}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 disabled:opacity-60"
            >
              Finance
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-2xl border bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
            {msg}
          </div>
        )}

        <div className="no-print mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-900">
          This page reconciles IET Bank funds, subhead allocations, request commitments, payment vouchers and bank ledger records.
        </div>

        {!canSensitiveAudit && (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            You are viewing finance audit summaries. Sensitive administrative settings remain limited
            to Admin and Auditor roles.
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4 print:grid-cols-4">
          <StatCard title="Total IET Bank Fund" value={naira(stats.bankTotalFund)} tone="blue" />
          <StatCard title="Allocated to Subheads" value={naira(stats.bankAllocated)} tone="purple" />
          <StatCard title="Unallocated Bank Balance" value={naira(stats.bankUnallocated)} tone="emerald" />
          <StatCard title="Bank Available Balance" value={naira(stats.bankAvailable)} tone="emerald" />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4 print:grid-cols-4">
          <StatCard title="Voucher Value" value={naira(stats.totalVoucherValue)} tone="blue" />
          <StatCard title="Paid Value" value={naira(stats.paidVoucherValue)} tone="emerald" />
          <StatCard title="Pending Value" value={naira(stats.pendingVoucherValue)} tone="amber" />
          <StatCard title="Open Requests" value={String(stats.openRequests)} tone="purple" />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5 print:grid-cols-5">
          <MiniCard title="IET Banks" value={String(banks.length)} />
          <MiniCard title="Subheads" value={String(subheads.length)} />
          <MiniCard title="Departments" value={String(depts.length)} />
          <MiniCard title="Bank Ledger Rows" value={String(ledger.length)} />
          <MiniCard title="Audit Alerts" value={`${stats.highFindings} High / ${stats.mediumFindings} Medium`} />
        </div>

        <div className="no-print mt-6 rounded-3xl border bg-white p-2 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <TabButton label="Overview" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
            <TabButton label="IET Banks" active={activeTab === "banks"} onClick={() => setActiveTab("banks")} />
            <TabButton label="Departments" active={activeTab === "departments"} onClick={() => setActiveTab("departments")} />
            <TabButton label="Subheads" active={activeTab === "subheads"} onClick={() => setActiveTab("subheads")} />
            <TabButton label="Vouchers" active={activeTab === "vouchers"} onClick={() => setActiveTab("vouchers")} />
            <TabButton label="Bank Ledger" active={activeTab === "ledger"} onClick={() => setActiveTab("ledger")} />
          </div>
        </div>

        <div className="no-print mt-6 rounded-3xl border bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="xl:col-span-2">
              <label className="text-sm font-semibold text-slate-800">Search</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search voucher, payee, bank ledger, request, department..."
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

            <div>
              <label className="text-sm font-semibold text-slate-800">Ledger Type</label>
              <select
                value={entryTypeFilter}
                onChange={(e) => setEntryTypeFilter(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Ledger Types</option>
                <option value="Bank Funding">Bank Funding</option>
                <option value="Subhead Allocation">Subhead Allocation</option>
                <option value="Allocation Adjustment">Allocation Adjustment</option>
                <option value="Reservation">Reservation</option>
                <option value="Reservation Release">Reservation Release</option>
                <option value="Expenditure">Expenditure</option>
                <option value="Payment Voucher">Payment Voucher</option>
                <option value="Correction">Correction</option>
                <option value="System Recalculation">System Recalculation</option>
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

        {(activeTab === "overview" || activeTab === "banks") && (
          <BanksPanel banks={banks} exceptions={bankExceptions} onOpenBanks={openBanks} />
        )}

        {(activeTab === "overview" || activeTab === "departments") && (
          <DepartmentPanel rows={departmentSummary} />
        )}

        {(activeTab === "overview" || activeTab === "subheads") && (
          <SubheadsPanel rows={subheadExceptions} bankMap={bankMap} onOpenSubheads={openSubheads} />
        )}

        {(activeTab === "overview" || activeTab === "ledger") && (
          <LedgerPanel
            rows={filteredLedger}
            bankMap={bankMap}
            deptMap={deptMap}
            subheadMap={subheadMap}
          />
        )}

        {activeTab === "overview" && <FindingsPanel findings={auditFindings} />}

        {(activeTab === "overview" || activeTab === "vouchers") && (
          <>
            <PendingVouchersPanel
              rows={pendingVouchers}
              onOpenVoucher={openVoucher}
              onPrintVoucher={printVoucher}
            />

            <VoucherRegisterPanel
              rows={filteredVouchers}
              totalVoucherValue={stats.totalVoucherValue}
              onOpenVoucher={openVoucher}
              onPrintVoucher={printVoucher}
            />
          </>
        )}

        <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900 print:border-t print:border-black print:bg-white print:text-black">
          <div className="font-bold">Audit & Reconciliation Note</div>
          <p className="mt-1">
            This page provides management-level oversight across IET bank funding, bank-to-subhead
            allocation, reserved commitments, expenditure, payment vouchers, pending cheque workflow,
            subhead exceptions, and bank ledger movements.
          </p>
        </div>
      </div>
    </main>
  );
}

function BanksPanel({
  banks,
  exceptions,
  onOpenBanks,
}: {
  banks: BankAccount[];
  exceptions: BankException[];
  onOpenBanks: () => void;
}) {
  return (
    <div className="mt-6 rounded-3xl border bg-white shadow-sm overflow-hidden print:rounded-none print:border-black print:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-6 py-4 print:bg-white">
        <div>
          <h2 className="text-lg font-bold text-slate-900">IET Bank Funding Summary</h2>
          <p className="mt-1 text-sm text-slate-600">
            Bank funding source, allocation, reservation, expenditure and available balance.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenBanks}
          className="no-print rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
        >
          Manage Banks
        </button>
      </div>

      {banks.length === 0 ? (
        <EmptyState message="No IET bank account found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full border-collapse text-sm print:min-w-0 print:text-[8px]">
            <thead>
              <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 print:bg-white">
                <th className="px-4 py-3 text-left">Bank Account</th>
                <th className="px-4 py-3 text-right">Total Fund</th>
                <th className="px-4 py-3 text-right">Allocated</th>
                <th className="px-4 py-3 text-right">Unallocated</th>
                <th className="px-4 py-3 text-right">Reserved</th>
                <th className="px-4 py-3 text-right">Expenditure</th>
                <th className="px-4 py-3 text-right">Available</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>

            <tbody>
              {banks.map((b) => (
                <tr key={b.id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <div className="font-extrabold text-slate-900">{bankLabel(b)}</div>
                    <div className="mt-1 text-xs text-slate-500">{bankSubLabel(b)}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Recalculated: {shortDateTime(b.last_recalculated_at)}
                    </div>
                  </td>

                  <td className="px-4 py-4 text-right font-bold text-blue-700">{naira(b.total_fund)}</td>
                  <td className="px-4 py-4 text-right font-bold text-purple-700">{naira(b.allocated_amount)}</td>
                  <td
                    className={`px-4 py-4 text-right font-bold ${
                      Number(b.unallocated_balance || 0) < 0 ? "text-red-700" : "text-emerald-700"
                    }`}
                  >
                    {naira(b.unallocated_balance)}
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-amber-700">{naira(b.reserved_amount)}</td>
                  <td className="px-4 py-4 text-right font-bold text-red-700">{naira(b.expenditure)}</td>
                  <td
                    className={`px-4 py-4 text-right font-black ${
                      Number(b.available_balance || 0) < 0 ? "text-red-700" : "text-emerald-700"
                    }`}
                  >
                    {naira(b.available_balance)}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${
                        b.is_active === false
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {b.is_active === false ? "Inactive" : "Active"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {exceptions.length > 0 && (
        <div className="border-t bg-amber-50 p-5 print:bg-white">
          <div className="font-extrabold text-amber-900">Bank Exceptions</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3 print:grid-cols-3">
            {exceptions.map((b) => (
              <div key={b.id} className="rounded-2xl border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-extrabold text-slate-900">{bankLabel(b)}</div>
                    <div className="mt-1 text-xs text-slate-500">{bankSubLabel(b)}</div>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${riskBadgeClass(b.risk)}`}>
                    {b.risk}
                  </span>
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-700">{b.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DepartmentPanel({ rows }: { rows: DepartmentSummary[] }) {
  return (
    <div className="mt-6 rounded-3xl border bg-white shadow-sm overflow-hidden print:rounded-none print:border-black print:shadow-none">
      <div className="border-b bg-slate-50 px-6 py-4 print:bg-white">
        <h2 className="text-lg font-bold text-slate-900">Department Allocation Summary</h2>
        <p className="mt-1 text-sm text-slate-600">
          Department-level allocation, reserved amount, expenditure and balance from linked subheads.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No department allocation summary found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full border-collapse text-sm print:min-w-0 print:text-[8px]">
            <thead>
              <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 print:bg-white">
                <th className="px-4 py-3 text-left">Department</th>
                <th className="px-4 py-3 text-center">Subheads</th>
                <th className="px-4 py-3 text-right">Allocation</th>
                <th className="px-4 py-3 text-right">Reserved</th>
                <th className="px-4 py-3 text-right">Expenditure</th>
                <th className="px-4 py-3 text-right">Balance</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => (
                <tr key={r.department_id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-4 font-extrabold text-slate-900">{r.department_name}</td>
                  <td className="px-4 py-4 text-center font-bold text-slate-700">{r.subheads}</td>
                  <td className="px-4 py-4 text-right font-bold text-blue-700">{naira(r.allocation)}</td>
                  <td className="px-4 py-4 text-right font-bold text-amber-700">{naira(r.reserved)}</td>
                  <td className="px-4 py-4 text-right font-bold text-red-700">{naira(r.expenditure)}</td>
                  <td
                    className={`px-4 py-4 text-right font-black ${
                      r.balance < 0 ? "text-red-700" : "text-emerald-700"
                    }`}
                  >
                    {naira(r.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SubheadsPanel({
  rows,
  bankMap,
  onOpenSubheads,
}: {
  rows: SubheadException[];
  bankMap: Record<string, BankAccount>;
  onOpenSubheads: () => void;
}) {
  return (
    <div className="mt-6 rounded-3xl border bg-white shadow-sm overflow-hidden print:rounded-none print:border-black print:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-6 py-4 print:bg-white">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Subhead Exceptions</h2>
          <p className="mt-1 text-sm text-slate-600">Budget lines requiring finance review.</p>
        </div>

        <button
          type="button"
          onClick={onOpenSubheads}
          className="no-print rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
        >
          Open Subheads
        </button>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No subhead exception found." />
      ) : (
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3 print:grid-cols-3 print:p-2">
          {rows.map((s) => {
            const bank = s.bank_account_id ? bankMap[s.bank_account_id] : null;

            return (
              <div
                key={s.id}
                className="print-card rounded-3xl border bg-white p-5 shadow-sm print:rounded-none print:border-black print:p-2 print:shadow-none"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-extrabold text-slate-900">
                      {s.code ? `${s.code} — ` : ""}
                      {s.name}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">{bankLabel(bank)}</div>
                  </div>

                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${riskBadgeClass(s.risk)}`}>
                    {s.risk}
                  </span>
                </div>

                <div className="mt-3 text-sm font-semibold text-slate-700">{s.note}</div>

                <div className="mt-4 grid gap-2 text-sm">
                  <InfoLine label="Allocation" value={naira(s.approved)} />
                  <InfoLine label="Reserved" value={naira(s.reserved)} />
                  <InfoLine label="Expenditure" value={naira(s.spent)} />
                  <InfoLine label="Balance" value={naira(s.remaining)} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LedgerPanel({
  rows,
  bankMap,
  deptMap,
  subheadMap,
}: {
  rows: LedgerRow[];
  bankMap: Record<string, BankAccount>;
  deptMap: Record<string, DeptRow>;
  subheadMap: Record<string, SubheadRow>;
}) {
  return (
    <div className="mt-6 rounded-3xl border bg-white shadow-sm overflow-hidden print:rounded-none print:border-black print:shadow-none">
      <div className="border-b bg-slate-50 px-6 py-4 print:bg-white">
        <h2 className="text-lg font-bold text-slate-900">IET Bank Ledger</h2>
        <p className="mt-1 text-sm text-slate-600">
          Ledger movement records for bank funding, subhead allocation and reconciliation entries.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No bank ledger record found for the selected filters." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full border-collapse text-sm print:min-w-0 print:text-[8px]">
            <thead>
              <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 print:bg-white">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Entry Type</th>
                <th className="px-4 py-3 text-left">IET Bank</th>
                <th className="px-4 py-3 text-left">Department/Subhead</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Description</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((l) => {
                const bank = bankMap[l.bank_account_id];
                const dept = l.department_id ? deptMap[l.department_id] : null;
                const sub = l.subhead_id ? subheadMap[l.subhead_id] : null;

                return (
                  <tr key={l.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-4 text-slate-600">{shortDateTime(l.created_at)}</td>
                    <td className="px-4 py-4">
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                        {l.entry_type}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-bold text-slate-900">{bankLabel(bank)}</div>
                      <div className="mt-1 text-xs text-slate-500">{bankSubLabel(bank)}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900">{dept?.name || "—"}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {sub ? `${sub.code ? `${sub.code} — ` : ""}${sub.name}` : "No subhead"}
                      </div>
                    </td>
                    <td
                      className={`px-4 py-4 text-right font-black ${
                        Number(l.amount || 0) < 0 ? "text-red-700" : "text-emerald-700"
                      }`}
                    >
                      {naira(l.amount)}
                    </td>
                    <td className="px-4 py-4 text-slate-700">{l.description || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FindingsPanel({ findings }: { findings: AuditFinding[] }) {
  return (
    <div className="mt-6 rounded-3xl border bg-white shadow-sm overflow-hidden print:rounded-none print:border-black print:shadow-none">
      <div className="border-b bg-slate-50 px-6 py-4 print:bg-white">
        <h2 className="text-lg font-bold text-slate-900">Audit Findings</h2>
        <p className="mt-1 text-sm text-slate-600">
          Exception-based review of banks, subheads, vouchers and workflow control indicators.
        </p>
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3 print:grid-cols-3 print:p-2">
        {findings.map((f) => (
          <div
            key={f.id}
            className="print-card rounded-3xl border bg-white p-5 shadow-sm print:rounded-none print:border-black print:p-2 print:shadow-none"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="font-extrabold text-slate-900 print:text-[10px]">{f.title}</div>
              <span
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold print:p-0 print:text-[9px] ${riskBadgeClass(
                  f.level
                )}`}
              >
                {f.level}
              </span>
            </div>

            <div className="mt-2 text-sm font-semibold text-slate-700 print:text-[9px]">
              Count: {f.count}
            </div>

            <p className="mt-2 text-sm text-slate-600 print:text-[8px]">{f.description}</p>

            <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-800 print:bg-white print:p-0 print:text-[8px]">
              Action: {f.action}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PendingVouchersPanel({
  rows,
  onOpenVoucher,
  onPrintVoucher,
}: {
  rows: VoucherRow[];
  onOpenVoucher: (voucherId: string) => void;
  onPrintVoucher: (voucherId: string) => void;
}) {
  return (
    <div className="mt-6 rounded-3xl border bg-white shadow-sm overflow-hidden print:rounded-none print:border-black print:shadow-none">
      <div className="border-b bg-slate-50 px-6 py-4 print:bg-white print:px-2">
        <h2 className="text-lg font-bold text-slate-900 print:text-sm">Pending Voucher Watchlist</h2>
        <p className="mt-1 text-sm text-slate-600 print:text-[9px]">
          Active vouchers not yet marked as paid.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No pending voucher found for the selected filters." />
      ) : (
        <div className="max-h-[620px] overflow-auto print:max-h-none print:overflow-visible">
          {rows.map((v) => (
            <div key={v.id} className="border-t px-6 py-4 hover:bg-slate-50 print:px-2 print:py-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-extrabold text-slate-900 print:text-[10px]">{v.voucher_no}</div>
                  <div className="mt-1 text-sm text-slate-600 print:text-[8px]">
                    {v.payee_name || "—"} • {v.dept_name || "—"}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold print:border-0 print:p-0 print:text-[8px] ${statusBadgeClass(
                      v.status
                    )}`}
                  >
                    {v.status || "—"}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 print:border-0 print:bg-white print:p-0 print:text-[8px]">
                    {daysOld(v.created_at)} day(s)
                  </span>
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-sm md:grid-cols-2 print:text-[8px]">
                <InfoLine label="Amount" value={naira(v.total_amount || v.amount)} />
                <InfoLine label="Mode" value={v.disbursement_mode || "—"} />
                <InfoLine label="Request" value={v.request_no || "—"} />
                <InfoLine label="Type" value={categoryLabel(v)} />
              </div>

              <div className="no-print mt-3 flex justify-end gap-2">
                <button
                  onClick={() => onOpenVoucher(v.id)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                >
                  View
                </button>

                <button
                  onClick={() => onPrintVoucher(v.id)}
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
  );
}

function VoucherRegisterPanel({
  rows,
  totalVoucherValue,
  onOpenVoucher,
  onPrintVoucher,
}: {
  rows: VoucherRow[];
  totalVoucherValue: number;
  onOpenVoucher: (voucherId: string) => void;
  onPrintVoucher: (voucherId: string) => void;
}) {
  return (
    <div className="mt-6 rounded-3xl border bg-white shadow-sm overflow-hidden print:rounded-none print:border-black print:shadow-none">
      <div className="border-b bg-slate-50 px-6 py-4 print:bg-white print:px-2">
        <h2 className="text-lg font-bold text-slate-900 print:text-sm">Voucher Audit Register</h2>
        <p className="mt-1 text-sm text-slate-600 print:text-[9px]">
          Filtered voucher register for reconciliation review.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="No payment voucher found for selected filters." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[1350px] w-full border-collapse text-sm print:min-w-0 print:text-[8px]">
            <thead>
              <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 print:bg-white">
                <th className="px-4 py-3 text-left">PV No</th>
                <th className="px-4 py-3 text-left">Request</th>
                <th className="px-4 py-3 text-left">Payee</th>
                <th className="px-4 py-3 text-left">Department</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Mode</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Age</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="no-print px-4 py-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((v) => (
                <tr key={v.id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-4 font-extrabold text-slate-900">{v.voucher_no}</td>
                  <td className="px-4 py-4 text-slate-700">{v.request_no || "—"}</td>
                  <td className="px-4 py-4 font-semibold text-slate-900">{v.payee_name || "—"}</td>
                  <td className="px-4 py-4 text-slate-700">{v.dept_name || "—"}</td>
                  <td className="px-4 py-4">
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">
                      {categoryLabel(v)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-700">{v.disbursement_mode || "—"}</td>
                  <td className="px-4 py-4 text-right font-extrabold text-slate-900">
                    {naira(v.total_amount || v.amount)}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${statusBadgeClass(v.status)}`}>
                      {v.status || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{daysOld(v.created_at)}d</td>
                  <td className="px-4 py-4 text-slate-600">{shortDate(v.created_at)}</td>
                  <td className="no-print px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onOpenVoucher(v.id)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                      >
                        View
                      </button>

                      <button
                        onClick={() => onPrintVoucher(v.id)}
                        className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        Print
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr className="border-t bg-slate-50 font-black print:bg-white">
                <td className="px-4 py-4 uppercase text-slate-900" colSpan={6}>
                  Reconciliation Total
                </td>
                <td className="px-4 py-4 text-right text-slate-900">
                  {naira(totalVoucherValue)}
                </td>
                <td className="px-4 py-4 text-xs font-semibold text-slate-500" colSpan={4}>
                  Excludes cancelled vouchers
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
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
    <div className="print-card rounded-3xl border bg-white p-5 shadow-sm print:rounded-none print:border-black print:p-2 print:shadow-none">
      <div className="text-sm font-semibold text-slate-500 print:text-[9px]">{title}</div>
      <div className={`mt-3 inline-flex rounded-2xl px-3 py-2 text-xl font-extrabold print:mt-1 print:p-0 print:text-[11px] ${cls}`}>
        {value}
      </div>
    </div>
  );
}

function MiniCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="print-card rounded-2xl border bg-white p-4 shadow-sm print:rounded-none print:border-black print:p-2 print:shadow-none">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 print:text-[8px]">
        {title}
      </div>
      <div className="mt-2 text-lg font-extrabold text-slate-900 print:mt-1 print:text-[10px]">
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
  return <div className="p-6 text-sm text-slate-700">{message}</div>;
}