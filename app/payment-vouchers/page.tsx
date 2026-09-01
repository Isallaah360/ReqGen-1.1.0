"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, CheckCircle2, ChevronRight, CircleX, Clock3, Download, FileSpreadsheet, MoreVertical, Plus, Search, Settings2, Users, WalletCards, X } from "lucide-react";
import styles from "./payment-vouchers-overview.module.css";
import { supabase } from "@/lib/supabaseClient";

type VoucherRow = {
  id: string;
  voucher_no: string;
  request_id: string | null;
  request_no: string | null;
  request_type: string | null;
  personal_category: string | null;
  payee_name: string | null;
  narration: string | null;
  amount: number | null;
  dept_id?: string | null;
  dept_name: string | null;
  subhead_id?: string | null;
  subhead_code: string | null;
  subhead_name: string | null;
  bank_account_id?: string | null;
  bank_account_name?: string | null;
  prepared_by_name: string | null;
  checked_by_name: string | null;
  authorized_by_name: string | null;
  disbursement_mode: string | null;
  payment_reference?: string | null;
  is_multi_request: boolean | null;
  item_count: number | null;
  total_amount: number | null;
  voucher_scope: string | null;
  voucher_origin?: string | null;
  manual_voucher_reason?: string | null;
  status: string | null;
  created_at: string;
};

type ReadyRequest = {
  id: string;
  request_no: string;
  title: string;
  details: string;
  amount: number | null;
  status: string | null;
  current_stage: string | null;
  created_at: string;
  request_type: string | null;
  personal_category: string | null;
  requester_name: string | null;
  dept_id: string | null;
  dept_name: string | null;
  subhead_id: string | null;
  subhead_code: string | null;
  subhead_name: string | null;
  account_name: string | null;
};

type ProfileRole = {
  id: string;
  profile_id: string;
  role_key: string;
  role_name: string;
  is_primary: boolean;
  is_active: boolean;
};

type SignatoryType = "ChequeSigner" | "CounterSigner" | "Both";

type PVSignatory = {
  id: string;
  full_name: string;
  signatory_type: SignatoryType | null;
};

type DepartmentRow = {
  id: string;
  name: string;
};

type SubheadRow = {
  id: string;
  dept_id: string | null;
  code: string | null;
  name: string;
  balance: number | null;
  expenditure: number | null;
  approved_allocation?: number | null;
};

type BankAccountRow = {
  id: string;
  account_name: string;
  balance: number | null;
  source_table: "bank_accounts" | "finance_accounts" | "accounts";
};

type GenerateVoucherResult = { voucher_no?: string | null; voucher_id?: string | null };
type DeleteVoucherResult = { deleted_voucher_no?: string | null };

type DisbursementMode = "Transfer" | "Cash" | "Cheque";

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

function personKey(v: string | null | undefined) {
  return (v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function naira(n: number | null | undefined) {
  return "₦" + Math.round(Number(n || 0)).toLocaleString();
}

function shortDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function categoryKey(v: { request_type: string | null; personal_category: string | null }) {
  const rt = normalize(v.request_type);
  const pc = normalize(v.personal_category);

  if (rt === "official") return "official";
  if (rt === "personal" && pc === "fund") return "personalfund";
  if (rt === "personal" && (pc === "nonfund" || pc === "others" || pc === "leave")) {
    return "personalnonfund";
  }

  return "unknown";
}

function isVoucherEligible(v: { request_type: string | null; personal_category: string | null }) {
  const key = categoryKey(v);
  return key === "official" || key === "personalfund";
}

function categoryLabel(v: { request_type: string | null; personal_category: string | null }) {
  const key = categoryKey(v);

  if (key === "official") return "Official";
  if (key === "personalfund") return "Personal Fund";
  if (key === "personalnonfund") return "Personal Other";

  return v.request_type || "—";
}




function hasAnyRole(roleSet: Set<string>, keys: string[]) {
  return keys.some((key) => roleSet.has(roleKey(key)));
}

function mapBankAccount(row: Record<string, unknown>, source: BankAccountRow["source_table"]): BankAccountRow {
  const accountName = [row.account_name, row.bank_name, row.name, row.title, row.account_no, row.account_number]
    .find((value) => typeof value === "string" && value.trim().length > 0);
  return {
    id: String(row.id ?? ""),
    account_name: typeof accountName === "string" ? accountName : "Finance Account",
    balance: Number(row.balance ?? row.current_balance ?? row.available_balance ?? 0),
    source_table: source,
  };
}

export default function PaymentVouchersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState("Staff");
  const [myRoles, setMyRoles] = useState<ProfileRole[]>([]);

  const roleSet = useMemo(() => {
    const set = new Set<string>();

    if (myRole) set.add(roleKey(myRole));

    myRoles.forEach((r) => {
      if (r.is_active) set.add(roleKey(r.role_key));
    });

    return set;
  }, [myRole, myRoles]);

  const canAccess = hasAnyRole(roleSet, [
    "admin",
    "auditor",
    "account",
    "accounts",
    "accountofficer",
    "pvsigner",
    "pvcountersigner",
  ]);

  const canManualVoucher = hasAnyRole(roleSet, [
    "admin",
    "auditor",
    "account",
    "accounts",
    "accountofficer",
  ]);

  const canDeleteVoucher = hasAnyRole(roleSet, ["admin", "auditor"]);

  const [rows, setRows] = useState<VoucherRow[]>([]);
  const [readyRows, setReadyRows] = useState<ReadyRequest[]>([]);
  const [pvSignatories, setPvSignatories] = useState<PVSignatory[]>([]);

  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [subheads, setSubheads] = useState<SubheadRow[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountRow[]>([]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ReadyRequest | null>(null);

  const [search, setSearch] = useState("");
  const [readySearch, setReadySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [moreOpen, setMoreOpen] = useState<string | null>(null);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);

  const [mode, setMode] = useState<DisbursementMode>("Transfer");

  const [transferAccountName, setTransferAccountName] = useState("");
  const [transferAccountNumber, setTransferAccountNumber] = useState("");
  const [transferBankName, setTransferBankName] = useState("");

  const [cashPayeeName, setCashPayeeName] = useState("");

  const [chequeNo, setChequeNo] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [chequeBankName, setChequeBankName] = useState("");
  const [chequeSignedByName, setChequeSignedByName] = useState("");
  const [counterSignatoryName, setCounterSignatoryName] = useState("");

  const [showManualModal, setShowManualModal] = useState(false);

  useEffect(() => {
    if (searchParams.get("create") === "1") setShowCreateWorkspace(true);
    if (searchParams.get("manual") === "1") setShowManualModal(true);
  }, [searchParams]);
  const [manualDeptId, setManualDeptId] = useState("");
  const [manualSubheadId, setManualSubheadId] = useState("");
  const [manualBankAccountId, setManualBankAccountId] = useState("");
  const [manualPayeeName, setManualPayeeName] = useState("");
  const [manualNarration, setManualNarration] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualMode, setManualMode] = useState<DisbursementMode>("Transfer");
  const [manualReference, setManualReference] = useState("");

  const chequeSigners = useMemo(() => {
    return pvSignatories.filter(
      (x) => x.signatory_type === "ChequeSigner" || x.signatory_type === "Both"
    );
  }, [pvSignatories]);

  const counterSigners = useMemo(() => {
    return pvSignatories.filter(
      (x) => x.signatory_type === "CounterSigner" || x.signatory_type === "Both"
    );
  }, [pvSignatories]);

  const selectedRequests = useMemo(() => {
    const set = new Set(selectedIds);
    return readyRows.filter((r) => set.has(r.id));
  }, [readyRows, selectedIds]);

  const selectedTotal = useMemo(() => {
    return selectedRequests.reduce((a, r) => a + Number(r.amount || 0), 0);
  }, [selectedRequests]);

  const selectionCategory = useMemo(() => {
    if (selectedRequests.length === 0) return null;
    return categoryKey(selectedRequests[0]);
  }, [selectedRequests]);

  const selectionPayee = useMemo(() => {
    if (selectedRequests.length === 0) return null;
    return selectedRequests[0].requester_name || "";
  }, [selectedRequests]);

  const manualSubheads = useMemo(() => {
    if (!manualDeptId) return subheads;
    return subheads.filter((s) => s.dept_id === manualDeptId || !s.dept_id);
  }, [subheads, manualDeptId]);

  const selectedManualSubhead = useMemo(() => {
    return subheads.find((s) => s.id === manualSubheadId) || null;
  }, [subheads, manualSubheadId]);

  const selectedManualBank = useMemo(() => {
    return bankAccounts.find((a) => a.id === manualBankAccountId) || null;
  }, [bankAccounts, manualBankAccountId]);

  const manualAmountNumber = useMemo(() => {
    return Number(manualAmount || 0);
  }, [manualAmount]);

  const selectionSummary = useMemo(() => {
    if (selectedRequests.length === 0) {
      return {
        valid: false,
        message: "Select at least one voucher-ready request.",
      };
    }

    if (selectedRequests.length > 10) {
      return {
        valid: false,
        message: "You can select maximum 10 requests per payment voucher.",
      };
    }

    const firstCategory = categoryKey(selectedRequests[0]);
    const firstPayee = personKey(selectedRequests[0].requester_name);

    if (!["official", "personalfund"].includes(firstCategory)) {
      return {
        valid: false,
        message: "Only Official and Personal Fund requests can generate payment vouchers.",
      };
    }

    const badCategory = selectedRequests.find((r) => categoryKey(r) !== firstCategory);
    if (badCategory) {
      return {
        valid: false,
        message:
          "Selected requests must be from the same category: Official with Official, or Personal Fund with Personal Fund.",
      };
    }

    const badPayee = selectedRequests.find((r) => personKey(r.requester_name) !== firstPayee);
    if (badPayee) {
      return {
        valid: false,
        message: "Selected requests must belong to the same requester/payee.",
      };
    }

    if (selectedTotal <= 0) {
      return {
        valid: false,
        message: "Total voucher amount must be greater than zero.",
      };
    }

    return {
      valid: true,
      message:
        selectedRequests.length === 1
          ? "Ready to generate a single-request payment voucher."
          : `Ready to generate a combined payment voucher with ${selectedRequests.length} requests.`,
    };
  }, [selectedRequests, selectedTotal]);

  async function loadBankAccounts() {
    const sources: BankAccountRow["source_table"][] = [
      "bank_accounts",
      "finance_accounts",
      "accounts",
    ];

    for (const source of sources) {
      const { data, error } = await supabase.from(source).select("*").limit(100);

      if (!error && data) {
        return (data as Array<Record<string, unknown>>).map((row) => mapBankAccount(row, source));
      }
    }

    return [];
  }

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
        return;
      }

      setUserId(auth.user.id);

      const [profRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle(),

        supabase
          .from("profile_roles")
          .select("id,profile_id,role_key,role_name,is_primary,is_active")
          .eq("profile_id", auth.user.id)
          .eq("is_active", true),
      ]);

      if (profRes.error) {
        setMsg("Failed to load your profile: " + profRes.error.message);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const fallbackRole = (profRes.data?.role || "Staff") as string;
      const activeRoles = (rolesRes.data || []) as ProfileRole[];

      setMyRole(fallbackRole);
      setMyRoles(activeRoles);

      const nextRoleSet = new Set<string>();
      if (fallbackRole) nextRoleSet.add(roleKey(fallbackRole));
      activeRoles.forEach((r) => {
        if (r.is_active) nextRoleSet.add(roleKey(r.role_key));
      });

      if (
        !hasAnyRole(nextRoleSet, [
          "admin",
          "auditor",
          "account",
          "accounts",
          "accountofficer",
          "pvsigner",
          "pvcountersigner",
        ])
      ) {
        setMsg("Access denied. Only Admin, Auditor and Account Officers can view payment vouchers.");
        setRows([]);
        setReadyRows([]);
        setPvSignatories([]);
        setDepartments([]);
        setSubheads([]);
        setBankAccounts([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const [voucherRes, readyRes, signatoryRes, deptRes, subheadRes, bankRows] =
        await Promise.all([
          supabase.rpc("get_payment_vouchers"),
          supabase.rpc("get_requests_ready_for_payment_voucher"),
          supabase
            .from("payment_voucher_counter_signatories")
            .select("id,full_name,signatory_type")
            .eq("is_active", true)
            .order("full_name", { ascending: true }),
          supabase.from("departments").select("id,name").order("name", { ascending: true }),
          supabase
            .from("subheads")
            .select("id,dept_id,code,name,balance,expenditure,approved_allocation")
            .order("name", { ascending: true }),
          loadBankAccounts(),
        ]);

      if (voucherRes.error) {
        setMsg("Failed to load payment vouchers: " + voucherRes.error.message);
        setRows([]);
      } else {
        setRows((voucherRes.data || []) as VoucherRow[]);
      }

      if (readyRes.error) {
        setMsg("Failed to load voucher-ready requests: " + readyRes.error.message);
        setReadyRows([]);
        setSelectedIds([]);
      } else {
        const ready = ((readyRes.data || []) as ReadyRequest[]).filter(isVoucherEligible);
        setReadyRows(ready);
        setSelectedIds((prev) => prev.filter((id) => ready.some((r) => r.id === id)));
      }

      if (signatoryRes.error) {
        setPvSignatories([]);
      } else {
        const list = (signatoryRes.data || []) as PVSignatory[];
        setPvSignatories(list);

        const firstChequeSigner = list.find(
          (x) => x.signatory_type === "ChequeSigner" || x.signatory_type === "Both"
        );

        const firstCounterSigner = list.find(
          (x) => x.signatory_type === "CounterSigner" || x.signatory_type === "Both"
        );

        if (!chequeSignedByName && firstChequeSigner) {
          setChequeSignedByName(firstChequeSigner.full_name);
        }

        if (!counterSignatoryName && firstCounterSigner) {
          setCounterSignatoryName(firstCounterSigner.full_name);
        }
      }

      if (deptRes.error) {
        setDepartments([]);
      } else {
        setDepartments((deptRes.data || []) as DepartmentRow[]);
      }

      if (subheadRes.error) {
        setSubheads([]);
      } else {
        setSubheads((subheadRes.data || []) as SubheadRow[]);
      }

      setBankAccounts(bankRows);

      setLoading(false);
      setRefreshing(false);
    },
    [router, chequeSignedByName, counterSignatoryName]
  );

  useEffect(() => {
    queueMicrotask(() => { void load(); });

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

  
  function openVoucher(voucherId: string) {
    router.push(`/payment-vouchers/${voucherId}?updated=${Date.now()}`);
    router.refresh();
  }

  function printVoucher(voucherId: string) {
    router.push(`/payment-vouchers/${voucherId}/print?updated=${Date.now()}`);
    router.refresh();
  }

  function toggleSelectRequest(r: ReadyRequest) {
    setMsg(null);

    if (!isVoucherEligible(r)) {
      setMsg("❌ Only Official and Personal Fund requests can generate payment vouchers.");
      return;
    }

    setSelectedIds((prev) => {
      const exists = prev.includes(r.id);

      if (exists) {
        return prev.filter((id) => id !== r.id);
      }

      if (prev.length >= 10) {
        setMsg("❌ You can select maximum 10 requests per payment voucher.");
        return prev;
      }

      const current = readyRows.filter((x) => prev.includes(x.id));
      if (current.length > 0) {
        const firstCategory = categoryKey(current[0]);
        const firstPayee = personKey(current[0].requester_name);

        if (categoryKey(r) !== firstCategory) {
          setMsg("❌ Selected requests must be from the same category.");
          return prev;
        }

        if (personKey(r.requester_name) !== firstPayee) {
          setMsg("❌ Selected requests must belong to the same requester/payee.");
          return prev;
        }
      }

      return [...prev, r.id];
    });
  }

  function clearSelection() {
    setSelectedIds([]);
    setSelectedRequest(null);
    setMsg(null);
  }

  function openManualVoucher() {
    router.push("/finance/manual-voucher");
  }

  function closeManualVoucher() {
    if (manualSaving) return;
    setShowManualModal(false);
  }

  function validateManualVoucher() {
    if (!manualDeptId) return "Select a department.";
    if (!manualSubheadId) return "Select a subhead.";
    if (!manualPayeeName.trim()) return "Enter payee name.";
    if (manualNarration.trim().length < 5) return "Enter a clear purpose / narration.";
    if (!manualAmountNumber || manualAmountNumber <= 0) return "Amount must be greater than zero.";

    if (selectedManualSubhead && Number(selectedManualSubhead.balance || 0) < manualAmountNumber) {
      return `Insufficient subhead balance. Available: ${naira(selectedManualSubhead.balance)}.`;
    }

    if (
      manualBankAccountId &&
      selectedManualBank &&
      Number(selectedManualBank.balance || 0) < manualAmountNumber
    ) {
      return `Insufficient bank account balance. Available: ${naira(selectedManualBank.balance)}.`;
    }

    return null;
  }

  async function createManualVoucher() {
    const validation = validateManualVoucher();

    if (validation) {
      setMsg("❌ " + validation);
      return;
    }

    const ok = confirm(
      `Create manual payment voucher for ${manualPayeeName.trim()}?\n\nAmount: ${naira(
        manualAmountNumber
      )}\n\nThis will deduct the amount from the selected subhead${manualBankAccountId ? " and selected bank account" : ""
      }.`
    );

    if (!ok) return;

    setManualSaving(true);
    setMsg(null);

    try {
      const { data, error } = await supabase.rpc("create_manual_payment_voucher", {
        p_dept_id: manualDeptId,
        p_subhead_id: manualSubheadId,
        p_bank_account_id: manualBankAccountId || null,
        p_payee_name: manualPayeeName.trim(),
        p_narration: manualNarration.trim(),
        p_amount: manualAmountNumber,
        p_disbursement_mode: manualMode,
        p_payment_reference: manualReference.trim() || null,
        p_manual_voucher_reason: manualReason.trim() || null,
        p_actor_id: userId,
      });

      if (error) throw new Error(error.message);

      const result = Array.isArray(data) ? data[0] : data;
      const voucherNo = result?.voucher_no || "Manual Voucher";
      const voucherId = result?.voucher_id;

      setMsg(`✅ ${voucherNo} created successfully.`);
      setShowManualModal(false);

      await load({ silent: true });

      if (voucherId) {
        setTimeout(() => {
          printVoucher(voucherId);
        }, 500);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setMsg("❌ Failed to create manual voucher: " + message);
    } finally {
      setManualSaving(false);
    }
  }

  function openGenerateModalFromSelection() {
    if (!selectionSummary.valid) {
      setMsg("❌ " + selectionSummary.message);
      return;
    }

    const first = selectedRequests[0];

    setSelectedRequest(first);
    setMode("Transfer");

    setTransferAccountName(first.requester_name || "");
    setTransferAccountNumber("");
    setTransferBankName("");

    setCashPayeeName(first.requester_name || "");

    setChequeNo("");
    setChequeDate("");
    setChequeBankName("");
    setChequeSignedByName(chequeSigners[0]?.full_name || "");
    setCounterSignatoryName(counterSigners[0]?.full_name || "");

    setMsg(null);
  }

  
  function closeGenerateModal() {
    if (generating) return;
    setSelectedRequest(null);
  }

  function validateDisbursement() {
    if (selectedRequests.length < 1) return "No request selected.";
    if (selectedRequests.length > 10) return "Maximum 10 requests can be combined in one voucher.";

    if (!selectionSummary.valid) return selectionSummary.message;

    if (mode === "Transfer") {
      if (!transferAccountName.trim()) return "Transfer requires Account Name.";
      if (!transferAccountNumber.trim()) return "Transfer requires Account Number.";
      if (!transferBankName.trim()) return "Transfer requires Bank Name.";
    }

    if (mode === "Cash") {
      if (!cashPayeeName.trim()) return "Cash requires Payee Name.";
    }

    if (mode === "Cheque") {
      if (!chequeNo.trim()) return "Cheque requires Cheque Number.";
      if (!chequeDate) return "Cheque requires Cheque Date.";
      if (!chequeBankName.trim()) return "Cheque requires Bank Name.";
      if (!chequeSignedByName.trim()) return "Cheque requires Cheque Signed By.";
      if (!counterSignatoryName.trim()) return "Cheque requires Counter Signed By.";
      if (personKey(chequeSignedByName) === personKey(counterSignatoryName)) {
        return "Cheque Signer and Counter Signer cannot be the same person.";
      }
    }

    return null;
  }

  async function generateVoucher() {
    const validation = validateDisbursement();

    if (validation) {
      setMsg("❌ " + validation);
      return;
    }

    const count = selectedRequests.length;
    const ok = confirm(
      count === 1
        ? "Generate payment voucher for this request?"
        : `Generate one combined payment voucher for ${count} selected requests?`
    );

    if (!ok) return;

    setGenerating(true);
    setMsg(null);

    try {
      const { data, error } = await supabase.rpc("generate_multi_payment_voucher", {
        p_request_ids: selectedIds,
        p_disbursement_mode: mode,

        p_transfer_account_name: mode === "Transfer" ? transferAccountName.trim() : null,
        p_transfer_account_number: mode === "Transfer" ? transferAccountNumber.trim() : null,
        p_transfer_bank_name: mode === "Transfer" ? transferBankName.trim() : null,

        p_cash_payee_name: mode === "Cash" ? cashPayeeName.trim() : null,

        p_cheque_no: mode === "Cheque" ? chequeNo.trim() : null,
        p_cheque_date: mode === "Cheque" ? chequeDate : null,
        p_cheque_bank_name: mode === "Cheque" ? chequeBankName.trim() : null,
        p_cheque_signed_by_name: mode === "Cheque" ? chequeSignedByName.trim() : null,
        p_counter_signatory_name: mode === "Cheque" ? counterSignatoryName.trim() : null,
      });

      if (error) throw new Error(error.message);

      const generated = data as GenerateVoucherResult | null;
      const voucherNo = generated?.voucher_no || "Payment Voucher";
      const voucherId = generated?.voucher_id;

      setMsg(
        count === 1
          ? `✅ ${voucherNo} generated successfully.`
          : `✅ ${voucherNo} generated successfully for ${count} requests.`
      );

      setSelectedRequest(null);
      setSelectedIds([]);

      await load({ silent: true });

      if (voucherId) {
        setTimeout(() => {
          printVoucher(voucherId);
        }, 500);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setMsg("❌ Failed to generate voucher: " + message);
    } finally {
      setGenerating(false);
    }
  }

  async function deleteVoucher(v: VoucherRow) {
    if (!canDeleteVoucher) {
      setMsg("❌ Only Admin and Auditor can delete payment vouchers.");
      return;
    }

    const ok = confirm(
      `Permanently delete ${v.voucher_no}?\n\nThis will allow linked request(s) to generate a new payment voucher.\n\nThis action cannot be undone.`
    );

    if (!ok) return;

    setMsg(null);

    try {
      const { data, error } = await supabase.rpc("delete_payment_voucher_for_regeneration", {
        p_voucher_id: v.id,
      });

      if (error) throw new Error(error.message);

      const deletedVoucherNo = (data as DeleteVoucherResult | null)?.deleted_voucher_no || v.voucher_no;

      setMsg(`✅ ${deletedVoucherNo} deleted. Linked request(s) can now generate a new PV.`);
      await load({ silent: true });
      router.refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setMsg("❌ Failed to delete voucher: " + message);
    } finally {
    }
  }

  const filteredReadyRows = useMemo(() => {
    const s = readySearch.trim().toLowerCase();

    return readyRows.filter((r) => {
      if (!isVoucherEligible(r)) return false;

      if (!s) return true;

      const haystack = [
        r.request_no,
        r.title,
        r.details,
        r.requester_name,
        r.dept_name,
        r.status,
        r.request_type,
        r.personal_category,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(s);
    });
  }, [readyRows, readySearch]);

  const filteredRows = useMemo(() => {
    const s = search.trim().toLowerCase();

    return rows.filter((v) => {
      if (statusFilter !== "ALL" && (v.status || "") !== statusFilter) return false;

      if (typeFilter === "Official" && normalize(v.request_type) !== "official") return false;

      if (typeFilter === "PersonalFund") {
        if (!(normalize(v.request_type) === "personal" && normalize(v.personal_category) === "fund")) {
          return false;
        }
      }

      if (typeFilter === "Single" && normalize(v.voucher_scope) !== "single") return false;
      if (typeFilter === "Multiple" && normalize(v.voucher_scope) !== "multiple") return false;
      if (typeFilter === "Manual" && normalize(v.voucher_scope) !== "manual") return false;

      if (s) {
        const haystack = [
          v.voucher_no,
          v.request_no,
          v.payee_name,
          v.narration,
          v.dept_name,
          v.subhead_code,
          v.subhead_name,
          v.bank_account_name,
          v.prepared_by_name,
          v.checked_by_name,
          v.authorized_by_name,
          v.status,
          v.request_type,
          v.personal_category,
          v.disbursement_mode,
          v.voucher_scope,
          v.voucher_origin,
          v.manual_voucher_reason,
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(s)) return false;
      }

      return true;
    });
  }, [rows, search, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const single = rows.filter((x) => normalize(x.voucher_scope) === "single").length;
    const multiple = rows.filter((x) => normalize(x.voucher_scope) === "multiple").length;
    const manual = rows.filter((x) => normalize(x.voucher_scope) === "manual").length;
    const paid = rows.filter((x) => normalize(x.status) === "paid").length;
    const pending = rows.filter((x) => ["prepared", "checked"].includes(normalize(x.status))).length;
    const approved = rows.filter((x) => ["authorized", "chequeprepared", "chequesigned", "countersigned", "paid"].includes(normalize(x.status))).length;

    const totalAmount = rows
      .filter((x) => (x.status || "") !== "Cancelled")
      .reduce((a, x) => a + Number(x.total_amount || x.amount || 0), 0);

    const readyOfficial = readyRows.filter((r) => categoryKey(r) === "official").length;
    const readyPersonalFund = readyRows.filter((r) => categoryKey(r) === "personalfund").length;
    const readyTotalAmount = readyRows.reduce((a, r) => a + Number(r.amount || 0), 0);

    return {
      total,
      single,
      multiple,
      manual,
      paid,
      pending,
      approved,
      totalAmount,
      readyOfficial,
      readyPersonalFund,
      readyTotalAmount,
    };
  }, [rows, readyRows]);

  const overviewRows = useMemo(() => {
    return filteredRows.filter((v) => {
      if (departmentFilter !== "ALL" && (v.dept_name || "") !== departmentFilter) return false;
      const created = v.created_at ? new Date(v.created_at) : null;
      if (created && fromDate && created < new Date(`${fromDate}T00:00:00`)) return false;
      if (created && toDate && created > new Date(`${toDate}T23:59:59`)) return false;
      return true;
    });
  }, [filteredRows, departmentFilter, fromDate, toDate]);

  useEffect(() => { queueMicrotask(() => setCurrentPage(1)); }, [search, statusFilter, typeFilter, departmentFilter, fromDate, toDate, rowsPerPage]);
  const pageCount = Math.max(1, Math.ceil(overviewRows.length / rowsPerPage));
  const safePage = Math.min(currentPage, pageCount);
  const pagedRows = overviewRows.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);
  const rejectedCount = rows.filter((v) => ["cancelled", "rejected"].includes(normalize(v.status))).length;
  const approvedAmount = rows.filter((v) => ["authorized", "chequeprepared", "chequesigned", "countersigned", "paid"].includes(normalize(v.status))).reduce((sum, v) => sum + Number(v.total_amount || v.amount || 0), 0);
  const pendingAmount = rows.filter((v) => ["prepared", "checked"].includes(normalize(v.status))).reduce((sum, v) => sum + Number(v.total_amount || v.amount || 0), 0);
  const rejectedAmount = rows.filter((v) => ["cancelled", "rejected"].includes(normalize(v.status))).reduce((sum, v) => sum + Number(v.total_amount || v.amount || 0), 0);
  const otherAmount = Math.max(0, stats.totalAmount - approvedAmount - pendingAmount);
  const summaryAmount = Math.max(1, approvedAmount + pendingAmount + rejectedAmount + otherAmount);
  const approvedPct = (approvedAmount / summaryAmount) * 100;
  const pendingPct = (pendingAmount / summaryAmount) * 100;
  const rejectedPct = (rejectedAmount / summaryAmount) * 100;
  const otherPct = Math.max(0, 100 - approvedPct - pendingPct - rejectedPct);
  const recentVouchers = [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 4);

  function clearOverviewFilters() {
    setSearch(""); setStatusFilter("ALL"); setTypeFilter("ALL"); setDepartmentFilter("ALL");
    setFromDate(`${new Date().getFullYear()}-01-01`); setToDate(new Date().toISOString().slice(0, 10));
  }

  function exportOverviewCsv() {
    const headers = ["Voucher No", "Date", "Department", "Beneficiary", "Description", "Amount", "Status"];
    const csv = [headers, ...overviewRows.map((v) => [v.voucher_no, shortDate(v.created_at), v.dept_name || "", v.payee_name || "", v.narration || "", String(v.total_amount || v.amount || 0), v.status || ""]) ]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"','""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `payment-vouchers-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-7xl py-10 text-slate-600">
          Loading payment vouchers...
        </div>
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-3xl py-10">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h1 className="text-xl font-extrabold text-slate-900">Payment Voucher Access</h1>

            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {msg || "Access denied."}
            </div>

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="reqgen-btn reqgen-btn-slate mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.breadcrumb}>
        <button type="button" onClick={() => router.push("/dashboard")}>Home</button>
        <ChevronRight size={13} />
        <button type="button" onClick={() => router.push("/finance")}>Finance</button>
        <ChevronRight size={13} />
        <span>Payment Vouchers</span>
      </div>

      <header className={styles.hero}>
        <div className={styles.heroIdentity}>
          <div className={styles.titleIcon}><FileSpreadsheet size={26} /></div>
          <div>
            <h1>Payment Vouchers</h1>
            <p>Create, manage and track all payment vouchers.</p>
          </div>
        </div>
        <div className={styles.heroMeta}>
          <div className={styles.metaItem}><CalendarDays size={17} /><span>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</span></div>
          <div className={styles.metaDivider} />
          <div className={styles.metaItem}><Users size={17} /><span>Secure Finance Workspace</span></div>
          <button className={styles.primaryButton} onClick={() => setShowCreateWorkspace(true)}><Plus size={18}/>Create New Voucher</button>
        </div>
      </header>

      {msg ? <div className={styles.message}>{msg}</div> : null}

      <section className={styles.kpiGrid}>
        <article className={styles.kpi}>
          <span className={`${styles.kpiIcon} ${styles.tone_blue}`}><FileSpreadsheet size={21}/></span>
          <div className={styles.kpiContent}><small>Total Vouchers</small><strong>{stats.total}</strong><p>This Month</p><button onClick={() => clearOverviewFilters()}>View all vouchers <ChevronRight size={13}/></button></div>
        </article>
        <article className={styles.kpi}>
          <span className={`${styles.kpiIcon} ${styles.tone_green}`}><CheckCircle2 size={21}/></span>
          <div className={styles.kpiContent}><small>Approved Vouchers</small><strong>{stats.approved}</strong><p>{stats.total ? ((stats.approved / stats.total) * 100).toFixed(1) : "0.0"}% of total vouchers</p><button onClick={() => router.push("/payment-vouchers/approved")}>View approved <ChevronRight size={13}/></button></div>
        </article>
        <article className={styles.kpi}>
          <span className={`${styles.kpiIcon} ${styles.tone_amber}`}><Clock3 size={21}/></span>
          <div className={styles.kpiContent}><small>Pending Vouchers</small><strong>{stats.pending}</strong><p>{stats.total ? ((stats.pending / stats.total) * 100).toFixed(1) : "0.0"}% of total vouchers</p><button onClick={() => router.push("/payment-vouchers/pending")}>View pending <ChevronRight size={13}/></button></div>
        </article>
        <article className={styles.kpi}>
          <span className={`${styles.kpiIcon} ${styles.tone_red}`}><CircleX size={21}/></span>
          <div className={styles.kpiContent}><small>Rejected Vouchers</small><strong>{rejectedCount}</strong><p>{stats.total ? ((rejectedCount / stats.total) * 100).toFixed(1) : "0.0"}% of total vouchers</p><button onClick={() => setStatusFilter("Cancelled")}>View rejected <ChevronRight size={13}/></button></div>
        </article>
        <article className={styles.kpi}>
          <span className={`${styles.kpiIcon} ${styles.tone_violet}`}><WalletCards size={21}/></span>
          <div className={styles.kpiContent}><small>Total Amount</small><strong className={styles.moneyValue}>{naira(stats.totalAmount)}</strong><p className={styles.positive}>↑ Active voucher value</p><button onClick={() => router.push("/reports#payment-voucher-report")}>View summary <ChevronRight size={13}/></button></div>
        </article>
      </section>

      <div className={styles.contentGrid}>
        <section className={styles.registerCard}>
          <div className={styles.tableToolbar}>
            <h2>Payment Vouchers</h2>
            <div className={styles.toolbarControls}>
              <select aria-label="Department filter" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
                <option value="ALL">All Departments</option>{departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
              <div className={styles.dateRange}><input aria-label="From date" type="date" value={fromDate} onChange={(e)=>setFromDate(e.target.value)} /><span>–</span><input aria-label="To date" type="date" value={toDate} onChange={(e)=>setToDate(e.target.value)} /></div>
              <select aria-label="Status filter" value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}>
                <option value="ALL">Filters</option><option value="Prepared">Prepared</option><option value="Checked">Checked</option><option value="Authorized">Authorized</option><option value="Paid">Paid</option><option value="Cancelled">Rejected</option>
              </select>
              <div className={styles.searchBox}><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search vouchers..."/><Search size={16}/></div>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>PV No.</th><th>Date</th><th>Payee / Description</th><th>Department</th><th className={styles.right}>Amount (₦)</th><th>Status</th><th>Created By</th><th>Action</th></tr></thead>
              <tbody>
                {pagedRows.length ? pagedRows.map((v) => <tr key={v.id}>
                  <td><button className={styles.voucherLink} onClick={() => openVoucher(v.id)}>{v.voucher_no}</button></td>
                  <td>{shortDate(v.created_at)}</td>
                  <td><strong className={styles.payee}>{v.payee_name || "—"}</strong><span className={styles.description}>{v.narration || "—"}</span></td>
                  <td><span className={styles.departmentTag}>{v.dept_name || "—"}</span></td>
                  <td className={`${styles.right} ${styles.amount}`}>{Number(v.total_amount || v.amount || 0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                  <td><span className={`${styles.status} ${styles[`status_${normalize(v.status)||"default"}`]||styles.status_default}`}>{normalize(v.status)==="cancelled"?"Rejected":v.status||"—"}</span></td>
                  <td>{v.prepared_by_name || "—"}</td>
                  <td><div className={styles.moreWrap}><button className={styles.actionDots} title="Voucher actions" onClick={()=>setMoreOpen(moreOpen===v.id?null:v.id)}><MoreVertical size={17}/></button>{moreOpen===v.id?<div className={styles.moreMenu}><button onClick={()=>openVoucher(v.id)}>View details</button><button onClick={()=>printVoucher(v.id)}>Print / PDF</button>{canDeleteVoucher?<button className={styles.dangerText} onClick={()=>deleteVoucher(v)}>Delete voucher</button>:null}</div>:null}</div></td>
                </tr>) : <tr><td colSpan={8} className={styles.empty}>No payment voucher found for the selected filter.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className={styles.tableFooter}>
            <span>Showing {overviewRows.length?(safePage-1)*rowsPerPage+1:0} to {Math.min(safePage*rowsPerPage,overviewRows.length)} of {overviewRows.length} vouchers</span>
            <div className={styles.pagination}><button disabled={safePage===1} onClick={()=>setCurrentPage(p=>Math.max(1,p-1))}>‹</button>{Array.from({length:Math.min(4,pageCount)},(_,i)=>i+1).map(p=><button key={p} className={p===safePage?styles.activePage:""} onClick={()=>setCurrentPage(p)}>{p}</button>)}{pageCount>4?<span>…</span>:null}{pageCount>4?<button onClick={()=>setCurrentPage(pageCount)}>{pageCount}</button>:null}<button disabled={safePage===pageCount} onClick={()=>setCurrentPage(p=>Math.min(pageCount,p+1))}>›</button></div>
            <select aria-label="Rows per page" value={rowsPerPage} onChange={(e)=>setRowsPerPage(Number(e.target.value))}><option value={10}>10 per page</option><option value={20}>20 per page</option><option value={50}>50 per page</option></select>
          </div>
        </section>

        <aside className={styles.sideStack}>
          <section className={styles.sideCard}>
            <h3>Voucher Summary <span>(This Month)</span></h3>
            <div className={styles.summaryLayout}>
              <div className={styles.donut} style={{background:`conic-gradient(#10b981 0 ${approvedPct}%, #f59e0b ${approvedPct}% ${approvedPct+pendingPct}%, #ef4444 ${approvedPct+pendingPct}% ${approvedPct+pendingPct+rejectedPct}%, #2563eb ${approvedPct+pendingPct+rejectedPct}% 100%)`}}><div><strong>{naira(stats.totalAmount)}</strong><span>Total Amount</span></div></div>
              <div className={styles.legend}>
                <SummaryLegend color="green" label="Approved" amount={approvedAmount} percent={approvedPct} />
                <SummaryLegend color="amber" label="Pending" amount={pendingAmount} percent={pendingPct} />
                <SummaryLegend color="red" label="Rejected" amount={rejectedAmount} percent={rejectedPct} />
                <SummaryLegend color="blue" label="Others" amount={otherAmount} percent={otherPct} />
              </div>
            </div>
          </section>

          <section className={styles.sideCard}>
            <div className={styles.sideHeading}><h3>Recent Vouchers</h3><button onClick={() => clearOverviewFilters()}>View all</button></div>
            <div className={styles.recentList}>
              {recentVouchers.length ? recentVouchers.map((v) => <button key={v.id} className={styles.recentItem} onClick={() => openVoucher(v.id)}>
                <span className={`${styles.recentIcon} ${["cancelled","rejected"].includes(normalize(v.status))?styles.recentRed:["prepared","checked"].includes(normalize(v.status))?styles.recentAmber:styles.recentGreen}`}>{["cancelled","rejected"].includes(normalize(v.status))?<CircleX size={16}/>: ["prepared","checked"].includes(normalize(v.status))?<Clock3 size={16}/>:<CheckCircle2 size={16}/>}</span>
                <span className={styles.recentCopy}><strong>{v.voucher_no}</strong><small>{v.payee_name || "—"}</small><small>{shortDate(v.created_at)}</small></span>
                <span className={styles.recentAmount}>{naira(v.total_amount || v.amount)}<small>{normalize(v.status)==="cancelled"?"Rejected":v.status||"—"}</small></span>
              </button>) : <div className={styles.emptyCompact}>No recent vouchers.</div>}
            </div>
          </section>

          <section className={styles.sideCard}>
            <h3>Quick Actions</h3>
            <div className={styles.quickGrid}>
              <button onClick={() => setShowCreateWorkspace(true)}><span className={styles.quickViolet}><Plus size={19}/></span>Create Voucher</button>
              <button onClick={() => router.push("/reports#payment-voucher-report")}><span className={styles.quickGreen}><FileSpreadsheet size={19}/></span>Voucher Report</button>
              <button onClick={exportOverviewCsv}><span className={styles.quickBlue}><Download size={19}/></span>Download Report</button>
              <button onClick={() => router.push("/payment-vouchers/settings")}><span className={styles.quickAmber}><Settings2 size={19}/></span>Voucher Settings</button>
            </div>
          </section>
        </aside>
      </div>

      {showCreateWorkspace ? <div className={styles.overlay} onMouseDown={(e)=>{if(e.target===e.currentTarget)setShowCreateWorkspace(false)}}><section className={styles.createModal}><div className={styles.modalHead}><div><div className={styles.eyebrow}>CREATE PAYMENT VOUCHER</div><h2>Select Voucher-Ready Requests</h2><p>Select 1 to 10 compatible Official or Personal Fund requests.</p></div><button onClick={()=>setShowCreateWorkspace(false)}><X size={18}/></button></div><div className={styles.modalSearch}><Search size={16}/><input value={readySearch} onChange={(e)=>setReadySearch(e.target.value)} placeholder="Search request no., title, requester, department..."/></div><div className={styles.readyList}>{filteredReadyRows.map(r=><label key={r.id} className={`${styles.readyRow} ${selectedIds.includes(r.id)?styles.readySelected:""}`}><input type="checkbox" checked={selectedIds.includes(r.id)} onChange={()=>toggleSelectRequest(r)}/><div><b>{r.request_no}</b><span>{r.title}</span><small>{r.dept_name||"—"} • {categoryLabel(r)} • {naira(r.amount)}</small></div></label>)}</div><div className={styles.selectionNotice}>{selectionSummary.message}{selectedRequests.length?<b>Payee: {selectionPayee||"—"} • Total: {naira(selectedTotal)}</b>:null}</div><div className={styles.modalActions}>{canManualVoucher?<button onClick={openManualVoucher}>Manual Voucher</button>:null}<button onClick={clearSelection}>Clear</button><button className={styles.primaryButton} disabled={!selectionSummary.valid||generating} onClick={()=>{setShowCreateWorkspace(false);openGenerateModalFromSelection();}}>{selectedRequests.length>1?"Generate Combined PV":"Generate Voucher"}</button></div></section></div>:null}
        {showManualModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">
                    Create Manual Payment Voucher
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Use this for controlled finance entries not generated from a request.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeManualVoucher}
                  className="reqgen-btn reqgen-btn-violet rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-800">Department</label>
                  <select
                    value={manualDeptId}
                    onChange={(e) => {
                      setManualDeptId(e.target.value);
                      setManualSubheadId("");
                    }}
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-800">Subhead</label>
                  <select
                    value={manualSubheadId}
                    onChange={(e) => setManualSubheadId(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
                  >
                    <option value="">Select Subhead</option>
                    {manualSubheads.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code ? `${s.code} - ` : ""}
                        {s.name} | Balance: {naira(s.balance)}
                      </option>
                    ))}
                  </select>

                  {selectedManualSubhead && (
                    <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900">
                      Available Subhead Balance: {naira(selectedManualSubhead.balance)}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-800">
                    Bank / Finance Account
                  </label>
                  <select
                    value={manualBankAccountId}
                    onChange={(e) => setManualBankAccountId(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
                  >
                    <option value="">No bank account selected</option>
                    {bankAccounts.map((a) => (
                      <option key={`${a.source_table}-${a.id}`} value={a.id}>
                        {a.account_name} | Balance: {naira(a.balance)}
                      </option>
                    ))}
                  </select>

                  {bankAccounts.length === 0 && (
                    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                      No finance account table was readable. Manual PV can still deduct subhead only.
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-800">Disbursement Mode</label>
                  <select
                    value={manualMode}
                    onChange={(e) => setManualMode(e.target.value as DisbursementMode)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
                  >
                    <option value="Transfer">Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                <Field
                  label="Payee Name"
                  value={manualPayeeName}
                  onChange={setManualPayeeName}
                  placeholder="Who is receiving the payment?"
                />

                <Field
                  label="Amount"
                  value={manualAmount}
                  onChange={(v) => setManualAmount(v.replace(/[^\d.]/g, ""))}
                  placeholder="0"
                />

                <div className="md:col-span-2">
                  <Field
                    label="Payment Reference"
                    value={manualReference}
                    onChange={setManualReference}
                    placeholder="Transfer ref, cheque no, cash note, etc. optional"
                  />
                </div>

                <div className="md:col-span-2">
                  <TextArea
                    label="Narration / Purpose"
                    value={manualNarration}
                    onChange={setManualNarration}
                    placeholder="Clearly describe the purpose of this manual voucher"
                  />
                </div>

                <div className="md:col-span-2">
                  <TextArea
                    label="Manual Voucher Reason"
                    value={manualReason}
                    onChange={setManualReason}
                    placeholder="Why is this voucher being entered manually? optional but recommended"
                  />
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                <b>Important:</b> Creating this voucher will deduct the amount from the selected
                subhead balance. If a bank/finance account is selected, it will also deduct from that
                account balance.
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={closeManualVoucher}
                  disabled={manualSaving}
                  className="reqgen-btn reqgen-btn-rose rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={createManualVoucher}
                  disabled={manualSaving}
                  className="reqgen-btn reqgen-btn-rose rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {manualSaving ? "Creating..." : "Create Manual Voucher"}
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900">
                    Generate Payment Voucher
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {selectedRequests.length === 1
                      ? "Generate a single-request payment voucher."
                      : `Generate one combined payment voucher for ${selectedRequests.length} requests.`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeGenerateModal}
                  className="reqgen-btn reqgen-btn-slate rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 rounded-2xl border bg-slate-50 p-4 text-sm">
                <div className="font-extrabold text-slate-900">
                  {selectedRequests.length === 1 ? selectedRequests[0]?.request_no : "Combined PV"}
                </div>

                <div className="mt-1 font-semibold text-slate-800">
                  {selectedRequests.length === 1
                    ? selectedRequests[0]?.title
                    : `${selectedRequests.length} approved requests selected`}
                </div>

                <div className="mt-1 text-slate-600">
                  Payee: {selectionPayee || "—"} •{" "}
                  {selectionCategory === "official" ? "Official" : "Personal Fund"} •{" "}
                  <b>{naira(selectedTotal)}</b>
                </div>

                {selectedRequests.length > 1 && (
                  <div className="mt-3 max-h-40 space-y-2 overflow-auto">
                    {selectedRequests.map((r) => (
                      <div key={r.id} className="rounded-xl border bg-white px-3 py-2">
                        <div className="font-bold text-slate-900">{r.request_no}</div>
                        <div className="text-slate-700">{r.title}</div>
                        <div className="text-xs font-semibold text-slate-500">
                          {naira(r.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5">
                <label className="text-sm font-semibold text-slate-800">Disbursement Mode</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as DisbursementMode)}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 outline-none focus:border-blue-500"
                >
                  <option value="Transfer">Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              {mode === "Transfer" && (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field
                    label="Account Name"
                    value={transferAccountName}
                    onChange={setTransferAccountName}
                    placeholder="Payee account name"
                  />

                  <Field
                    label="Account Number"
                    value={transferAccountNumber}
                    onChange={setTransferAccountNumber}
                    placeholder="Account number"
                  />

                  <div className="md:col-span-2">
                    <Field
                      label="Bank Name"
                      value={transferBankName}
                      onChange={setTransferBankName}
                      placeholder="Bank name"
                    />
                  </div>
                </div>
              )}

              {mode === "Cash" && (
                <div className="mt-4">
                  <Field
                    label="Payee Name"
                    value={cashPayeeName}
                    onChange={setCashPayeeName}
                    placeholder="Cash payee name"
                  />
                </div>
              )}

              {mode === "Cheque" && (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field
                    label="Cheque No"
                    value={chequeNo}
                    onChange={setChequeNo}
                    placeholder="Cheque number"
                  />

                  <div>
                    <label className="text-sm font-semibold text-slate-800">Cheque Date</label>
                    <input
                      value={chequeDate}
                      onChange={(e) => setChequeDate(e.target.value)}
                      type="date"
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 outline-none focus:border-blue-500"
                    />
                  </div>

                  <Field
                    label="Bank Name"
                    value={chequeBankName}
                    onChange={setChequeBankName}
                    placeholder="Bank name"
                  />

                  <div>
                    <label className="text-sm font-semibold text-slate-800">Cheque Signed By</label>
                    <select
                      value={chequeSignedByName}
                      onChange={(e) => setChequeSignedByName(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 outline-none focus:border-blue-500"
                    >
                      {chequeSigners.length === 0 ? (
                        <option value="">No active cheque signer found</option>
                      ) : (
                        chequeSigners.map((person) => (
                          <option key={person.id} value={person.full_name}>
                            {person.full_name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-800">Counter Signed By</label>
                    <select
                      value={counterSignatoryName}
                      onChange={(e) => setCounterSignatoryName(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 outline-none focus:border-blue-500"
                    >
                      {counterSigners.length === 0 ? (
                        <option value="">No active counter signer found</option>
                      ) : (
                        counterSigners.map((person) => (
                          <option key={person.id} value={person.full_name}>
                            {person.full_name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={closeGenerateModal}
                  disabled={generating}
                  className="reqgen-btn reqgen-btn-rose rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={generateVoucher}
                  disabled={generating}
                  className="reqgen-btn reqgen-btn-rose rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {generating ? "Generating..." : "Generate Voucher"}
                </button>
              </div>
            </div>
          </div>
        )}


    </main>
  );
}


function SummaryLegend({ color, label, amount, percent }: { color: "green" | "amber" | "red" | "blue"; label: string; amount: number; percent: number }) {
  return (
    <div className={styles.legendItem}>
      <span className={`${styles.legendDot} ${styles[`legend${color.charAt(0).toUpperCase()}${color.slice(1)}`]}`} />
      <div><strong>{label}</strong><small>{percent.toFixed(1)}%</small></div>
      <span className={styles.legendAmount}>{naira(amount)}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-800">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 outline-none focus:border-blue-500"
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-800">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 outline-none focus:border-blue-500"
      />
    </div>
  );
}

