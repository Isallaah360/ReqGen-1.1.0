"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

function categoryBadgeClass(v: { request_type: string | null; personal_category: string | null }) {
  const key = categoryKey(v);

  if (key === "official") return "border-blue-200 bg-blue-50 text-blue-700";
  if (key === "personalfund") return "border-purple-200 bg-purple-50 text-purple-700";

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function statusBadgeClass(status: string | null | undefined) {
  const s = (status || "").toLowerCase();

  if (s.includes("paid")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s.includes("cancel")) return "border-red-200 bg-red-50 text-red-700";
  if (s.includes("counter")) return "border-purple-200 bg-purple-50 text-purple-700";
  if (s.includes("authorized") || s.includes("checked")) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (s.includes("cheque")) return "border-amber-200 bg-amber-50 text-amber-700";
  if (s.includes("complete")) return "border-emerald-200 bg-emerald-50 text-emerald-700";

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function scopeBadgeClass(scope: string | null | undefined) {
  const s = normalize(scope);

  if (s === "multiple") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  if (s === "manual") return "border-amber-200 bg-amber-50 text-amber-700";

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function hasAnyRole(roleSet: Set<string>, keys: string[]) {
  return keys.some((key) => roleSet.has(roleKey(key)));
}

function mapBankAccount(row: any, source: BankAccountRow["source_table"]): BankAccountRow {
  return {
    id: String(row.id),
    account_name:
      row.account_name ||
      row.bank_name ||
      row.name ||
      row.title ||
      row.account_no ||
      row.account_number ||
      "Finance Account",
    balance: Number(row.balance ?? row.current_balance ?? row.available_balance ?? 0),
    source_table: source,
  };
}

export default function PaymentVouchersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
        return (data as any[]).map((row) => mapBankAccount(row, source));
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

  function openRequest(requestId: string) {
    router.push(`/requests/${requestId}?updated=${Date.now()}`);
    router.refresh();
  }

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
    setMsg(null);
    setShowManualModal(true);
    setManualDeptId("");
    setManualSubheadId("");
    setManualBankAccountId("");
    setManualPayeeName("");
    setManualNarration("");
    setManualReason("");
    setManualAmount("");
    setManualMode("Transfer");
    setManualReference("");
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

  function openGenerateModalSingle(r: ReadyRequest) {
    if (!isVoucherEligible(r)) {
      setMsg("❌ Only Official and Personal Fund requests can generate payment vouchers.");
      return;
    }

    setSelectedIds([r.id]);
    setSelectedRequest(r);
    setMode("Transfer");

    setTransferAccountName(r.requester_name || "");
    setTransferAccountNumber("");
    setTransferBankName("");

    setCashPayeeName(r.requester_name || "");

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

      const voucherNo = (data as any)?.voucher_no || "Payment Voucher";
      const voucherId = (data as any)?.voucher_id;

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

    setDeletingId(v.id);
    setMsg(null);

    try {
      const { data, error } = await supabase.rpc("delete_payment_voucher_for_regeneration", {
        p_voucher_id: v.id,
      });

      if (error) throw new Error(error.message);

      const deletedVoucherNo = (data as any)?.deleted_voucher_no || v.voucher_no;

      setMsg(`✅ ${deletedVoucherNo} deleted. Linked request(s) can now generate a new PV.`);
      await load({ silent: true });
      router.refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setMsg("❌ Failed to delete voucher: " + message);
    } finally {
      setDeletingId(null);
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
    const paid = rows.filter((x) => (x.status || "") === "Paid").length;

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
      totalAmount,
      readyOfficial,
      readyPersonalFund,
      readyTotalAmount,
    };
  }, [rows, readyRows]);

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
      <div className="mx-auto max-w-7xl py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Payment Vouchers
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Official IET payment voucher register for request-based and manual finance payments.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canManualVoucher && (
              <button
                type="button"
                onClick={openManualVoucher}
                disabled={Boolean(deletingId) || generating || refreshing}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                Manual Voucher
              </button>
            )}

            <button
              type="button"
              onClick={() => load({ silent: true })}
              disabled={Boolean(deletingId) || generating || refreshing}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/payment-vouchers/reports")}
              disabled={Boolean(deletingId) || generating}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              PV Reports
            </button>

            <button
              type="button"
              onClick={() => router.push("/payment-vouchers/settings")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
            >
              PV Settings
            </button>

            <button
              type="button"
              onClick={() => router.push("/finance/subheads")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
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

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-8">
          <StatCard title="Ready Requests" value={String(readyRows.length)} tone="emerald" />
          <StatCard title="Ready Official" value={String(stats.readyOfficial)} tone="blue" />
          <StatCard title="Ready Personal" value={String(stats.readyPersonalFund)} tone="purple" />
          <StatCard title="Ready Value" value={naira(stats.readyTotalAmount)} tone="amber" />
          <StatCard title="Total Vouchers" value={String(stats.total)} tone="blue" />
          <StatCard title="Combined PVs" value={String(stats.multiple)} tone="purple" />
          <StatCard title="Manual PVs" value={String(stats.manual)} tone="emerald" />
          <StatCard title="Total Value" value={naira(stats.totalAmount)} tone="amber" />
        </div>

        <div className="mt-6 rounded-3xl border bg-white shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 px-6 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Requests Ready for Voucher</h2>
              <p className="mt-1 text-sm text-slate-600">
                Select 1 to 10 compatible Official or Personal Fund requests to generate one payment voucher.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                {readyRows.length} ready
              </span>

              <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">
                {selectedRequests.length} selected
              </span>
            </div>
          </div>

          <div className="border-b bg-white px-6 py-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <label className="text-sm font-semibold text-slate-800">Search ready requests</label>
                <input
                  value={readySearch}
                  onChange={(e) => setReadySearch(e.target.value)}
                  placeholder="Search request no, title, requester, department..."
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={selectedRequests.length === 0 || generating}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50"
                >
                  Clear Selection
                </button>

                <button
                  type="button"
                  onClick={openGenerateModalFromSelection}
                  disabled={!selectionSummary.valid || generating}
                  className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {selectedRequests.length > 1 ? "Generate Combined PV" : "Generate PV"}
                </button>
              </div>
            </div>

            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${selectionSummary.valid
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
            >
              {selectionSummary.message}
              {selectedRequests.length > 0 && (
                <div className="mt-1 font-bold">
                  Payee: {selectionPayee || "—"} • Category:{" "}
                  {selectionCategory === "official"
                    ? "Official"
                    : selectionCategory === "personalfund"
                      ? "Personal Fund"
                      : "—"}{" "}
                  • Total: {naira(selectedTotal)}
                </div>
              )}
            </div>
          </div>

          {filteredReadyRows.length === 0 ? (
            <div className="p-6 text-sm text-slate-700">
              No request is currently ready for voucher generation.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1280px]">
                <div className="grid grid-cols-16 bg-slate-100 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <div className="col-span-1">Select</div>
                  <div className="col-span-2">Request No</div>
                  <div className="col-span-3">Title</div>
                  <div className="col-span-2">Department</div>
                  <div className="col-span-1">Type</div>
                  <div className="col-span-1 text-right">Amount</div>
                  <div className="col-span-2">Requester</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-3 text-right">Action</div>
                </div>

                {filteredReadyRows.map((r) => {
                  const checked = selectedIds.includes(r.id);

                  return (
                    <div
                      key={r.id}
                      className={`grid grid-cols-16 items-center border-t px-6 py-4 text-sm hover:bg-slate-50 ${checked ? "bg-blue-50/50" : ""
                        }`}
                    >
                      <div className="col-span-1">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelectRequest(r)}
                          className="h-4 w-4"
                        />
                      </div>

                      <div className="col-span-2 font-extrabold text-slate-900">
                        {r.request_no}
                      </div>

                      <div className="col-span-3">
                        <div className="font-semibold text-slate-900">{r.title}</div>
                        <div className="mt-1 line-clamp-1 text-xs text-slate-500">
                          {r.details}
                        </div>
                      </div>

                      <div className="col-span-2 text-slate-700">{r.dept_name || "—"}</div>

                      <div className="col-span-1">
                        <span
                          className={`rounded-full border px-2 py-1 text-[11px] font-bold ${categoryBadgeClass(r)}`}
                        >
                          {categoryLabel(r)}
                        </span>
                      </div>

                      <div className="col-span-1 text-right font-bold text-slate-900">
                        {naira(r.amount)}
                      </div>

                      <div className="col-span-2 text-slate-700">{r.requester_name || "—"}</div>

                      <div className="col-span-1">
                        <span
                          className={`rounded-full border px-2 py-1 text-[11px] font-bold ${statusBadgeClass(r.status)}`}
                        >
                          {r.status || "—"}
                        </span>
                      </div>

                      <div className="col-span-3 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openRequest(r.id)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                        >
                          Request
                        </button>

                        <button
                          type="button"
                          onClick={() => openGenerateModalSingle(r)}
                          disabled={generating || Boolean(deletingId)}
                          className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          Single PV
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleSelectRequest(r)}
                          disabled={generating}
                          className={`rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${checked
                              ? "bg-red-600 hover:bg-red-700"
                              : "bg-purple-600 hover:bg-purple-700"
                            }`}
                        >
                          {checked ? "Remove" : "Add"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-3xl border bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-semibold text-slate-800">Search Vouchers</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search voucher no, request no, payee..."
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Voucher / Request Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Vouchers</option>
                <option value="Official">Official</option>
                <option value="PersonalFund">Personal Fund</option>
                <option value="Single">Single PV</option>
                <option value="Multiple">Combined PV</option>
                <option value="Manual">Manual PV</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800">Voucher Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="Prepared">Prepared</option>
                <option value="Checked">Checked</option>
                <option value="Authorized">Authorized</option>
                <option value="Cheque Prepared">Cheque Prepared</option>
                <option value="Cheque Signed">Cheque Signed</option>
                <option value="Counter Signed">Counter Signed</option>
                <option value="Paid">Paid</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6 hidden xl:block rounded-3xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-slate-50 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-900">Voucher Register</h2>
            <p className="mt-1 text-sm text-slate-600">
              Generated payment vouchers linked to approved requests and manual finance entries.
            </p>
          </div>

          {filteredRows.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1500px]">
                <div className="grid grid-cols-19 bg-slate-100 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <div className="col-span-2">Voucher No</div>
                  <div className="col-span-2">Request No</div>
                  <div className="col-span-2">Payee</div>
                  <div className="col-span-2">Narration</div>
                  <div className="col-span-1 text-right">Amount</div>
                  <div className="col-span-2">Department</div>
                  <div className="col-span-1">Type</div>
                  <div className="col-span-1">Scope</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1">Date</div>
                  <div className="col-span-4 text-right">Actions</div>
                </div>

                {filteredRows.map((v) => (
                  <div
                    key={v.id}
                    className="grid grid-cols-19 items-center border-t px-6 py-4 text-sm hover:bg-slate-50"
                  >
                    <div className="col-span-2 font-extrabold text-slate-900">
                      {v.voucher_no}
                    </div>

                    <div className="col-span-2 text-slate-700">{v.request_no || "Manual"}</div>

                    <div className="col-span-2 font-semibold text-slate-900">
                      {v.payee_name || "—"}
                    </div>

                    <div className="col-span-2">
                      <div className="line-clamp-2 text-slate-700">{v.narration || "—"}</div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        Items: {v.item_count || 1}
                      </div>
                    </div>

                    <div className="col-span-1 text-right font-bold text-slate-900">
                      {naira(v.total_amount || v.amount)}
                    </div>

                    <div className="col-span-2 text-slate-700">{v.dept_name || "—"}</div>

                    <div className="col-span-1">
                      {normalize(v.voucher_scope) === "manual" ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
                          Manual
                        </span>
                      ) : (
                        <span
                          className={`rounded-full border px-2 py-1 text-[11px] font-bold ${categoryBadgeClass(v)}`}
                        >
                          {categoryLabel(v)}
                        </span>
                      )}
                    </div>

                    <div className="col-span-1">
                      <span
                        className={`rounded-full border px-2 py-1 text-[11px] font-bold ${scopeBadgeClass(v.voucher_scope)}`}
                      >
                        {v.voucher_scope || "Single"}
                      </span>
                    </div>

                    <div className="col-span-1">
                      <span
                        className={`rounded-full border px-2 py-1 text-[11px] font-bold ${statusBadgeClass(v.status)}`}
                      >
                        {v.status || "—"}
                      </span>
                    </div>

                    <div className="col-span-1 text-slate-600">{shortDate(v.created_at)}</div>

                    <div className="col-span-4 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openVoucher(v.id)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                      >
                        View
                      </button>

                      <button
                        type="button"
                        onClick={() => printVoucher(v.id)}
                        className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        Print
                      </button>

                      {canDeleteVoucher && (
                        <button
                          type="button"
                          onClick={() => deleteVoucher(v)}
                          disabled={deletingId === v.id || generating}
                          className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {deletingId === v.id ? "Deleting..." : "Delete"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-4 xl:hidden">
          {filteredRows.length === 0 ? (
            <EmptyState />
          ) : (
            filteredRows.map((v) => (
              <div key={v.id} className="rounded-3xl border bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-extrabold text-slate-900">{v.voucher_no}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-800">
                      Request: {v.request_no || "Manual"}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">{v.dept_name || "—"}</div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${scopeBadgeClass(v.voucher_scope)}`}
                    >
                      {v.voucher_scope || "Single"} • {v.item_count || 1}
                    </span>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${statusBadgeClass(v.status)}`}
                    >
                      {v.status || "—"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <InfoLine label="Payee" value={v.payee_name || "—"} />
                  <InfoLine label="Amount" value={naira(v.total_amount || v.amount)} />
                  <InfoLine label="Prepared By" value={v.prepared_by_name || "—"} />
                  <InfoLine label="Mode" value={v.disbursement_mode || "—"} />
                  <InfoLine label="Bank Account" value={v.bank_account_name || "—"} />
                  <InfoLine label="Date" value={shortDate(v.created_at)} />
                </div>

                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="font-semibold text-slate-900">Narration</div>
                  <div className="mt-1 line-clamp-3 whitespace-pre-wrap">{v.narration || "—"}</div>
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openVoucher(v.id)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    View
                  </button>

                  <button
                    type="button"
                    onClick={() => printVoucher(v.id)}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Print
                  </button>

                  {canDeleteVoucher && (
                    <button
                      type="button"
                      onClick={() => deleteVoucher(v)}
                      disabled={deletingId === v.id || generating}
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deletingId === v.id ? "Deleting..." : "Delete"}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

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
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
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
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={createManualVoucher}
                  disabled={manualSaving}
                  className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
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
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
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
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={generateVoucher}
                  disabled={generating}
                  className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {generating ? "Generating..." : "Generate Voucher"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
          <div className="font-bold">Payment Voucher Note</div>
          <p className="mt-1">
            You can generate PVs from approved requests or create manual PVs for controlled finance
            entries. Manual PVs deduct from the selected subhead and selected bank/finance account
            where applicable.
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
  tone: "blue" | "emerald" | "purple" | "slate" | "amber" | "red";
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

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-500">{label}:</span>{" "}
      <b className="text-slate-900">{value}</b>
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

function EmptyState() {
  return (
    <div className="rounded-2xl border bg-white p-6 text-sm text-slate-700 shadow-sm xl:rounded-none xl:border-0 xl:shadow-none">
      No payment voucher found for the selected filter.
    </div>
  );
}
