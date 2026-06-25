"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { exportTableToExcel, printReport } from "@/lib/reportExport";

type Dept = { id: string; name: string };

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
};

type Sub = {
  id: string;
  dept_id: string | null;
  bank_account_id: string | null;
  code: string | null;
  name: string;
  approved_allocation: number;
  reserved_amount: number;
  expenditure: number;
  balance: number;
  is_active: boolean;
  updated_at: string | null;
  allocation_note: string | null;
  allocation_date: string | null;
  request_count?: number;
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
  request_type: "Official" | "Personal" | string;
  personal_category: "Fund" | "NonFund" | string | null;
};

type TabKey = "overview" | "active" | "inactive" | "form" | "print";

function roleKey(role: string | null | undefined) {
  return (role || "").trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "");
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

function maskAccountNumber(value: string | null | undefined) {
  const raw = (value || "").trim();

  if (!raw) return "—";
  if (raw.length <= 4) return raw;

  return `${"*".repeat(Math.max(raw.length - 4, 0))}${raw.slice(-4)}`;
}

function bankLabel(account: BankAccount | null | undefined) {
  if (!account) return "No IET Bank Linked";
  return `${account.code ? `${account.code} — ` : ""}${account.name}`;
}

function bankSubLabel(account: BankAccount | null | undefined) {
  if (!account) return "Allocation source not selected";
  return `${account.bank_name || "Bank"} • ${maskAccountNumber(account.account_number)}`;
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

function computeTotals(subs: Sub[]) {
  const allocationTotal = subs.reduce((a, s) => a + Number(s.approved_allocation || 0), 0);
  const reservedTotal = subs.reduce((a, s) => a + Number(s.reserved_amount || 0), 0);
  const expenditureTotal = subs.reduce((a, s) => a + Number(s.expenditure || 0), 0);
  const balanceTotal = subs.reduce((a, s) => a + Number(s.balance || 0), 0);
  const activeCount = subs.filter((s) => s.is_active).length;
  const inactiveCount = subs.filter((s) => !s.is_active).length;
  const linkedCount = subs.filter((s) => Number(s.request_count || 0) > 0).length;
  const noBankCount = subs.filter((s) => !s.bank_account_id).length;
  const negativeBalanceCount = subs.filter((s) => Number(s.balance || 0) < 0).length;
  const lowBalanceCount = subs.filter((s) => {
    const allocation = Number(s.approved_allocation || 0);
    const balance = Number(s.balance || 0);
    return allocation > 0 && balance >= 0 && balance / allocation <= 0.1;
  }).length;

  return {
    allocationTotal,
    reservedTotal,
    expenditureTotal,
    balanceTotal,
    activeCount,
    inactiveCount,
    linkedCount,
    noBankCount,
    negativeBalanceCount,
    lowBalanceCount,
    totalCount: subs.length,
  };
}

function computeBankCapacity(account: BankAccount | null, currentSub: Sub | null) {
  if (!account) return 0;

  const baseUnallocated = Number(account.unallocated_balance || 0);
  const currentAllocationFromSameBank =
    currentSub?.bank_account_id === account.id ? Number(currentSub.approved_allocation || 0) : 0;

  return baseUnallocated + currentAllocationFromSameBank;
}

export default function SubheadsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [search, setSearch] = useState("");

  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState("Staff");
  const rk = roleKey(myRole);

  const canManage = rk === "admin" || rk === "auditor";
  const canAuditView = ["admin", "auditor", "account", "accounts", "accountofficer"].includes(rk);
  const canPrintCompleted = ["admin", "auditor", "account", "accounts", "accountofficer"].includes(rk);

  const [depts, setDepts] = useState<Dept[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [printableRequests, setPrintableRequests] = useState<PrintableRequest[]>([]);

  const [editId, setEditId] = useState<string | null>(null);
  const [deptId, setDeptId] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [allocation, setAllocation] = useState<number>(0);
  const [allocationNote, setAllocationNote] = useState("");
  const [active, setActive] = useState(true);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (options?.silent) setRefreshing(true);
      else setLoading(true);

      setMsg(null);

      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) {
        router.push("/login");
        return null;
      }

      setAuthUserId(auth.user.id);

      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .maybeSingle();

      const roleText = (prof?.role || "Staff") as string;
      const role = roleKey(roleText);
      setMyRole(roleText);

      await supabase.rpc("reqgen_recalculate_all_iet_accounts");

      const [deptRes, bankRes, subRes] = await Promise.all([
        supabase.from("departments").select("id,name").order("name", { ascending: true }),

        supabase
          .from("iet_accounts")
          .select(
            "id,code,name,bank_name,account_number,is_active,total_fund,allocated_amount,reserved_amount,expenditure,unallocated_balance,available_balance"
          )
          .order("name", { ascending: true }),

        supabase
          .from("subheads")
          .select(
            "id,dept_id,bank_account_id,code,name,approved_allocation,reserved_amount,expenditure,balance,is_active,updated_at,allocation_note,allocation_date"
          )
          .order("name", { ascending: true }),
      ]);

      if (deptRes.error) {
        setMsg("Failed to load departments: " + deptRes.error.message);
      }

      if (bankRes.error) {
        setMsg("Failed to load IET bank accounts: " + bankRes.error.message);
      }

      if (subRes.error) {
        setMsg("Failed to load subheads: " + subRes.error.message);
        setSubs([]);
        setLoading(false);
        setRefreshing(false);
        return null;
      }

      const freshDepts = (deptRes.data || []) as Dept[];
      const freshBanks = ((bankRes.data || []) as BankAccount[]).map((b) => ({
        ...b,
        is_active: b.is_active !== false,
        total_fund: Number(b.total_fund || 0),
        allocated_amount: Number(b.allocated_amount || 0),
        reserved_amount: Number(b.reserved_amount || 0),
        expenditure: Number(b.expenditure || 0),
        unallocated_balance: Number(b.unallocated_balance || 0),
        available_balance: Number(b.available_balance || 0),
      }));

      const baseSubs = ((subRes.data || []) as Sub[]).map((s) => ({
        ...s,
        approved_allocation: Number(s.approved_allocation || 0),
        reserved_amount: Number(s.reserved_amount || 0),
        expenditure: Number(s.expenditure || 0),
        balance: Number(s.balance || 0),
        is_active: s.is_active !== false,
      }));

      setDepts(freshDepts);
      setBanks(freshBanks);

      let requestCountBySubhead: Record<string, number> = {};

      if (baseSubs.length > 0) {
        const { data: linkedRows } = await supabase
          .from("requests")
          .select("subhead_id")
          .not("subhead_id", "is", null);

        (linkedRows || []).forEach((r: any) => {
          if (r.subhead_id) {
            requestCountBySubhead[r.subhead_id] = (requestCountBySubhead[r.subhead_id] || 0) + 1;
          }
        });
      }

      const freshSubs = baseSubs.map((s) => ({
        ...s,
        request_count: requestCountBySubhead[s.id] || 0,
      }));

      setSubs(freshSubs);

      let freshPrintable: PrintableRequest[] = [];

      if (["admin", "auditor", "account", "accounts", "accountofficer"].includes(role)) {
        const [officialRes, personalFundRes] = await Promise.all([
          supabase
            .from("requests")
            .select(
              "id,request_no,title,amount,status,current_stage,created_at,requester_name,account_name,subhead_id,request_type,personal_category"
            )
            .in("status", ["Paid", "Completed"])
            .eq("request_type", "Official")
            .order("created_at", { ascending: false })
            .limit(50),

          supabase
            .from("requests")
            .select(
              "id,request_no,title,amount,status,current_stage,created_at,requester_name,account_name,subhead_id,request_type,personal_category"
            )
            .in("status", ["Paid", "Completed"])
            .eq("request_type", "Personal")
            .eq("personal_category", "Fund")
            .order("created_at", { ascending: false })
            .limit(50),
        ]);

        if (!officialRes.error && !personalFundRes.error) {
          freshPrintable = [
            ...((officialRes.data || []) as PrintableRequest[]),
            ...((personalFundRes.data || []) as PrintableRequest[]),
          ]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 50);
        }
      }

      setPrintableRequests(freshPrintable);

      setLoading(false);
      setRefreshing(false);

      return {
        depts: freshDepts,
        banks: freshBanks,
        subs: freshSubs,
        printableRequests: freshPrintable,
      };
    },
    [router]
  );

  useEffect(() => {
    load();

    const refreshOnFocus = () => load({ silent: true });

    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") load({ silent: true });
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisible);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [load]);

  const deptMap = useMemo(() => {
    const m: Record<string, string> = {};
    depts.forEach((d) => {
      m[d.id] = d.name;
    });
    return m;
  }, [depts]);

  const bankMap = useMemo(() => {
    const m: Record<string, BankAccount> = {};
    banks.forEach((b) => {
      m[b.id] = b;
    });
    return m;
  }, [banks]);

  const subheadMap = useMemo(() => {
    const m: Record<string, string> = {};
    subs.forEach((s) => {
      m[s.id] = `${s.code ? `${s.code} — ` : ""}${s.name}`;
    });
    return m;
  }, [subs]);

  const currentSub = useMemo(() => {
    if (!editId) return null;
    return subs.find((x) => x.id === editId) || null;
  }, [subs, editId]);

  const selectedBank = useMemo(() => {
    if (!bankAccountId) return null;
    return bankMap[bankAccountId] || null;
  }, [bankAccountId, bankMap]);

  const selectedBankCapacity = useMemo(() => {
    return computeBankCapacity(selectedBank, currentSub);
  }, [selectedBank, currentSub]);

  const totals = useMemo(() => computeTotals(subs), [subs]);

  const filteredSubs = useMemo(() => {
    const s = search.trim().toLowerCase();

    return subs.filter((sub) => {
      if (activeTab === "active" && !sub.is_active) return false;
      if (activeTab === "inactive" && sub.is_active) return false;

      if (!s) return true;

      const bank = sub.bank_account_id ? bankMap[sub.bank_account_id] : null;

      const haystack = [
        sub.name,
        sub.code,
        sub.dept_id ? deptMap[sub.dept_id] : "",
        bankLabel(bank),
        bankSubLabel(bank),
        sub.is_active ? "active" : "inactive",
        sub.bank_account_id ? "bank linked" : "no bank",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(s);
    });
  }, [subs, search, activeTab, deptMap, bankMap]);

  function resetForm() {
    setEditId(null);
    setDeptId("");
    setBankAccountId("");
    setCode("");
    setName("");
    setAllocation(0);
    setAllocationNote("");
    setActive(true);
  }

  function startCreate() {
    resetForm();
    setActiveTab("form");
  }

  function startEdit(s: Sub) {
    setEditId(s.id);
    setDeptId(s.dept_id || "");
    setBankAccountId(s.bank_account_id || "");
    setCode(s.code || "");
    setName(s.name);
    setAllocation(Number(s.approved_allocation || 0));
    setAllocationNote(s.allocation_note || "");
    setActive(Boolean(s.is_active));
    setActiveTab("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (!canManage) {
      setMsg("Not allowed.");
      return;
    }

    if (!bankAccountId) {
      setMsg("❌ Select the IET Bank Account funding this subhead.");
      return;
    }

    if (name.trim().length < 2) {
      setMsg("❌ Subhead name too short.");
      return;
    }

    const alloc = Number(allocation || 0);

    if (Number.isNaN(alloc) || alloc < 0) {
      setMsg("❌ Allocation must be a valid non-negative amount.");
      return;
    }

    const reserved = Number(currentSub?.reserved_amount || 0);
    const expenditure = Number(currentSub?.expenditure || 0);
    const committed = reserved + expenditure;

    if (editId && alloc < committed) {
      setMsg(
        `❌ Allocation cannot be less than already committed amount. Reserved + Expenditure is ${naira(
          committed
        )}.`
      );
      return;
    }

    if (alloc > selectedBankCapacity) {
      setMsg(
        `❌ Allocation exceeds selected bank available unallocated capacity. Available capacity is ${naira(
          selectedBankCapacity
        )}.`
      );
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      let subheadId = editId;

      const basePayload: any = {
        dept_id: deptId || null,
        code: code.trim() || null,
        name: name.trim(),
        is_active: active,
      };

      if (!subheadId) {
        const { data, error } = await supabase
          .from("subheads")
          .insert({
            ...basePayload,
            bank_account_id: null,
            approved_allocation: 0,
            reserved_amount: 0,
            expenditure: 0,
            balance: 0,
            allocation_note: null,
            allocation_date: null,
          })
          .select("id")
          .single();

        if (error) throw new Error(error.message);

        subheadId = data.id;
      } else {
        const { error } = await supabase.from("subheads").update(basePayload).eq("id", subheadId);
        if (error) throw new Error(error.message);
      }

      const { error: allocationErr } = await supabase.rpc(
        "reqgen_assign_subhead_bank_allocation",
        {
          p_subhead_id: subheadId,
          p_bank_account_id: bankAccountId,
          p_new_allocation: alloc,
          p_actor_id: authUserId,
          p_note:
            allocationNote.trim() ||
            (editId
              ? "Subhead bank allocation updated from Subheads page."
              : "Subhead bank allocation created from Subheads page."),
        }
      );

      if (allocationErr) throw new Error(allocationErr.message);

      setMsg(
        editId
          ? "✅ Subhead updated and bank allocation recalculated."
          : "✅ Subhead created and bank allocation recorded."
      );

      resetForm();
      setActiveTab(active ? "active" : "inactive");
      await load({ silent: true });
      router.refresh();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Failed"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Sub, nextActive: boolean) {
    if (!canManage) {
      setMsg("Not allowed.");
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase
        .from("subheads")
        .update({ is_active: nextActive })
        .eq("id", s.id);

      if (error) throw new Error(error.message);

      setMsg(nextActive ? "✅ Subhead activated." : "✅ Subhead deactivated.");
      await load({ silent: true });
      router.refresh();
    } catch (e: any) {
      setMsg("❌ " + (e?.message || "Failed"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrDeactivate(s: Sub) {
    if (!canManage) {
      setMsg("Not allowed.");
      return;
    }

    const linked =
      Number(s.request_count || 0) > 0 ||
      Number(s.approved_allocation || 0) > 0 ||
      Number(s.reserved_amount || 0) > 0 ||
      Number(s.expenditure || 0) > 0;

    if (linked) {
      if (
        !confirm(
          "This subhead has request links or financial allocation/activity. It cannot be safely deleted. Do you want to deactivate it instead?"
        )
      ) {
        return;
      }

      await toggleActive(s, false);
      return;
    }

    if (!confirm("Delete this unused subhead permanently?")) return;

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase.from("subheads").delete().eq("id", s.id);
      if (error) throw new Error(error.message);

      setMsg("✅ Unused subhead deleted.");

      if (editId === s.id) resetForm();

      await load({ silent: true });
      router.refresh();
    } catch (e: any) {
      const text = e?.message || "Failed";

      if (
        text.toLowerCase().includes("foreign key") ||
        text.toLowerCase().includes("requests_subhead_id")
      ) {
        const { error } = await supabase
          .from("subheads")
          .update({ is_active: false })
          .eq("id", s.id);

        if (error) {
          setMsg("❌ Delete failed and deactivate also failed: " + error.message);
        } else {
          setMsg("✅ Subhead was linked to records, so it has been deactivated instead of deleted.");
          await load({ silent: true });
          router.refresh();
        }
      } else {
        setMsg("❌ " + text);
      }
    } finally {
      setSaving(false);
    }
  }

  async function printSubheadsReport() {
    setPrinting(true);
    await load({ silent: true });

    setTimeout(() => {
      printReport();
      setPrinting(false);
    }, 250);
  }

  async function exportSubheadsExcel() {
    setExporting(true);

    const fresh = await load({ silent: true });
    const exportSubs = fresh?.subs || subs;
    const exportDepts = fresh?.depts || depts;
    const exportBanks = fresh?.banks || banks;

    const exportDeptMap: Record<string, string> = {};
    exportDepts.forEach((d) => {
      exportDeptMap[d.id] = d.name;
    });

    const exportBankMap: Record<string, BankAccount> = {};
    exportBanks.forEach((b) => {
      exportBankMap[b.id] = b;
    });

    const exportTotals = computeTotals(exportSubs);

    exportTableToExcel<Sub>({
      fileName: `total_subheads_report_${new Date().toISOString().slice(0, 10)}`,
      sheetName: "Total Subheads",
      title: "TOTAL SUBHEADS REPORT",
      subtitle: `Total Subheads: ${exportTotals.totalCount} | Active: ${
        exportTotals.activeCount
      } | Allocation: ${naira(exportTotals.allocationTotal)} | Balance: ${naira(
        exportTotals.balanceTotal
      )}`,
      rows: exportSubs,
      columns: [
        { header: "S/N", value: (_row, index) => index + 1 },
        { header: "Department", value: (row) => (row.dept_id ? exportDeptMap[row.dept_id] : "—") },
        {
          header: "IET Bank",
          value: (row) => bankLabel(row.bank_account_id ? exportBankMap[row.bank_account_id] : null),
        },
        {
          header: "Bank Details",
          value: (row) =>
            bankSubLabel(row.bank_account_id ? exportBankMap[row.bank_account_id] : null),
        },
        { header: "Code", value: (row) => row.code || "—" },
        { header: "Subhead", value: (row) => row.name },
        { header: "Linked Requests", value: (row) => Number(row.request_count || 0) },
        { header: "Allocation", value: (row) => plainAmount(row.approved_allocation) },
        { header: "Reserved", value: (row) => plainAmount(row.reserved_amount) },
        { header: "Expenditure", value: (row) => plainAmount(row.expenditure) },
        { header: "Balance", value: (row) => plainAmount(row.balance) },
        { header: "Status", value: (row) => (row.is_active ? "Active" : "Inactive") },
        { header: "Allocation Note", value: (row) => row.allocation_note || "" },
        { header: "Updated", value: (row) => shortDate(row.updated_at) },
      ],
      footerRows: [
        [
          "Report Total",
          "",
          "",
          "",
          "",
          "",
          "",
          plainAmount(exportTotals.allocationTotal),
          plainAmount(exportTotals.reservedTotal),
          plainAmount(exportTotals.expenditureTotal),
          plainAmount(exportTotals.balanceTotal),
          "",
          "",
          "",
        ],
      ],
    });

    setExporting(false);
  }

  function openFinanceAudit() {
    router.push(`/finance/audit?updated=${Date.now()}`);
    router.refresh();
  }

  function backToFinance() {
    router.push(`/finance?updated=${Date.now()}`);
    router.refresh();
  }

  function openBanks() {
    router.push(`/finance/manage-accounts?updated=${Date.now()}`);
    router.refresh();
  }

  function printCompletedRequest(requestId: string) {
    router.push(`/requests/${requestId}/print?updated=${Date.now()}`);
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4">
        <div className="mx-auto max-w-7xl py-10 text-slate-600">Loading Subheads...</div>
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
                Total Subheads Report
              </div>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 print:mt-3 print:text-xl">
              Finance • Subheads
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Allocate subheads from IET bank accounts and monitor allocation, reservation, expenditure and balance.
            </p>
            <p className="mt-1 hidden text-xs font-semibold text-slate-500 print:block">
              Generated: {new Date().toLocaleString()}
            </p>
          </div>

          <div className="no-print flex flex-wrap gap-2">
            <button
              onClick={() => load({ silent: true })}
              disabled={refreshing || printing || exporting || saving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={startCreate}
              disabled={!canManage || refreshing || printing || exporting || saving}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              Add Subhead
            </button>

            <button
              onClick={printSubheadsReport}
              disabled={refreshing || printing || exporting || saving}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {printing ? "Preparing..." : "Print / Save PDF"}
            </button>

            <button
              onClick={exportSubheadsExcel}
              disabled={refreshing || printing || exporting || saving}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {exporting ? "Exporting..." : "Export Excel"}
            </button>

            <button
              onClick={openBanks}
              disabled={refreshing || printing || exporting || saving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 disabled:opacity-60"
            >
              IET Banks
            </button>

            {canAuditView && (
              <button
                onClick={openFinanceAudit}
                disabled={refreshing || printing || exporting || saving}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 disabled:opacity-60"
              >
                Audit & Reconciliation
              </button>
            )}

            <button
              onClick={backToFinance}
              disabled={refreshing || printing || exporting || saving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 disabled:opacity-60"
            >
              Back to Finance
            </button>
          </div>
        </div>

        {msg && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm">
            {msg}
          </div>
        )}

        <div className="no-print mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-900">
          Subheads now require an IET Bank funding source. Allocations are validated against bank unallocated funds and recorded through the finance allocation function.
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6 print:grid-cols-6">
          <StatCard title="Total Subheads" value={String(totals.totalCount)} tone="slate" />
          <StatCard title="Active Subheads" value={String(totals.activeCount)} tone="emerald" />
          <StatCard title="Allocation" value={naira(totals.allocationTotal)} tone="blue" />
          <StatCard title="Reserved" value={naira(totals.reservedTotal)} tone="amber" />
          <StatCard title="Expenditure" value={naira(totals.expenditureTotal)} tone="red" />
          <StatCard title="Balance" value={naira(totals.balanceTotal)} tone="emerald" />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6 print:grid-cols-6">
          <SmallStat title="Inactive Subheads" value={String(totals.inactiveCount)} />
          <SmallStat title="Linked to Requests" value={String(totals.linkedCount)} />
          <SmallStat title="No Bank Linked" value={String(totals.noBankCount)} />
          <SmallStat title="Negative Balance" value={String(totals.negativeBalanceCount)} />
          <SmallStat title="Low Balance" value={String(totals.lowBalanceCount)} />
          <SmallStat title="IET Banks" value={String(banks.length)} />
        </div>

        <div className="no-print mt-6 rounded-3xl border bg-white p-2 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <TabButton label="Overview" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
            <TabButton label="Active Subheads" active={activeTab === "active"} onClick={() => setActiveTab("active")} />
            <TabButton label="Inactive Subheads" active={activeTab === "inactive"} onClick={() => setActiveTab("inactive")} />
            <TabButton label={editId ? "Edit Subhead" : "Add Subhead"} active={activeTab === "form"} onClick={() => setActiveTab("form")} />
            {canPrintCompleted && (
              <TabButton label="Completed Requests" active={activeTab === "print"} onClick={() => setActiveTab("print")} />
            )}
          </div>
        </div>

        {(activeTab === "overview" || activeTab === "active" || activeTab === "inactive") && (
          <div className="no-print mt-6 rounded-3xl border bg-white p-5 shadow-sm">
            <label className="text-sm font-semibold text-slate-800">Search Subheads</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by subhead, code, department, IET bank or status..."
              className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
            />
          </div>
        )}

        {activeTab === "print" && canPrintCompleted && (
          <CompletedRequestsPanel
            printableRequests={printableRequests}
            subheadMap={subheadMap}
            refreshing={refreshing}
            saving={saving}
            printing={printing}
            exporting={exporting}
            onRefresh={() => load({ silent: true })}
            onPrint={printCompletedRequest}
          />
        )}

        {activeTab === "form" && (
          <SubheadForm
            canManage={canManage}
            saving={saving}
            editId={editId}
            depts={depts}
            banks={banks}
            deptId={deptId}
            bankAccountId={bankAccountId}
            selectedBank={selectedBank}
            selectedBankCapacity={selectedBankCapacity}
            code={code}
            name={name}
            allocation={allocation}
            allocationNote={allocationNote}
            active={active}
            currentSub={currentSub}
            onCancel={resetForm}
            onSave={save}
            setDeptId={setDeptId}
            setBankAccountId={setBankAccountId}
            setCode={setCode}
            setName={setName}
            setAllocation={setAllocation}
            setAllocationNote={setAllocationNote}
            setActive={setActive}
          />
        )}

        {(activeTab === "overview" || activeTab === "active" || activeTab === "inactive") && (
          <>
            <div className="mt-6 grid gap-4 xl:hidden print:hidden">
              {filteredSubs.length === 0 ? (
                <div className="rounded-2xl border bg-white p-5 text-sm text-slate-700 shadow-sm">
                  No subheads found.
                </div>
              ) : (
                filteredSubs.map((s) => (
                  <SubheadMobileCard
                    key={s.id}
                    s={s}
                    deptName={s.dept_id ? deptMap[s.dept_id] || "Unknown Department" : "No department"}
                    bank={s.bank_account_id ? bankMap[s.bank_account_id] : null}
                    canManage={canManage}
                    saving={saving}
                    onEdit={() => startEdit(s)}
                    onToggle={() => toggleActive(s, !s.is_active)}
                    onDelete={() => deleteOrDeactivate(s)}
                  />
                ))
              )}
            </div>

            <div className="mt-6 hidden xl:block rounded-3xl border bg-white shadow-sm overflow-hidden print:block print:rounded-none print:border-black print:shadow-none">
              <div className="border-b bg-slate-50 px-6 py-4 print:bg-white print:px-2">
                <h3 className="text-base font-bold text-slate-900 print:text-sm">Subheads Register</h3>
                <p className="mt-1 text-sm text-slate-600 print:text-[9px]">
                  Bank funding source, allocation, reserved commitments, actual expenditure and remaining balance.
                </p>
              </div>

              <SubheadTable
                subs={filteredSubs}
                deptMap={deptMap}
                bankMap={bankMap}
                totals={computeTotals(filteredSubs)}
                canManage={canManage}
                saving={saving}
                onEdit={startEdit}
                onToggle={toggleActive}
                onDelete={deleteOrDeactivate}
              />
            </div>
          </>
        )}

        <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900 print:border-t print:border-black print:bg-white print:text-black">
          <div className="font-bold">Subheads Bank Allocation Note</div>
          <p className="mt-1">
            Every operational subhead should now be linked to an IET Bank account. The bank account holds
            the lump sum fund, while subheads receive allocations from it. Reserved amounts and expenditure
            then roll back into bank-level reconciliation.
          </p>
        </div>
      </div>
    </main>
  );
}

function SubheadForm({
  canManage,
  saving,
  editId,
  depts,
  banks,
  deptId,
  bankAccountId,
  selectedBank,
  selectedBankCapacity,
  code,
  name,
  allocation,
  allocationNote,
  active,
  currentSub,
  onCancel,
  onSave,
  setDeptId,
  setBankAccountId,
  setCode,
  setName,
  setAllocation,
  setAllocationNote,
  setActive,
}: {
  canManage: boolean;
  saving: boolean;
  editId: string | null;
  depts: Dept[];
  banks: BankAccount[];
  deptId: string;
  bankAccountId: string;
  selectedBank: BankAccount | null;
  selectedBankCapacity: number;
  code: string;
  name: string;
  allocation: number;
  allocationNote: string;
  active: boolean;
  currentSub: Sub | null;
  onCancel: () => void;
  onSave: () => void;
  setDeptId: (v: string) => void;
  setBankAccountId: (v: string) => void;
  setCode: (v: string) => void;
  setName: (v: string) => void;
  setAllocation: (v: number) => void;
  setAllocationNote: (v: string) => void;
  setActive: (v: boolean) => void;
}) {
  const committed = Number(currentSub?.reserved_amount || 0) + Number(currentSub?.expenditure || 0);

  return (
    <div className="no-print mt-6 rounded-3xl border bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {editId ? "Edit Subhead Bank Allocation" : "Add New Subhead"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Select department, IET bank account, code, name, allocation and active status.
          </p>
        </div>

        {editId && (
          <button
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
          >
            Cancel Edit
          </button>
        )}
      </div>

      {!canManage && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          View only. Only Admin and Auditor can create, edit, activate, deactivate or delete subheads.
        </div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="xl:col-span-2">
          <label className="text-sm font-semibold text-slate-800">Department</label>
          <select
            value={deptId}
            onChange={(e) => setDeptId(e.target.value)}
            disabled={!canManage || saving}
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

        <div className="xl:col-span-2">
          <label className="text-sm font-semibold text-slate-800">Funding IET Bank</label>
          <select
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            disabled={!canManage || saving}
            className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
          >
            <option value="">— Select IET Bank Account —</option>
            {banks
              .filter((b) => b.is_active !== false || b.id === bankAccountId)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {bankLabel(b)} • Unallocated: {naira(b.unallocated_balance)}
                </option>
              ))}
          </select>
        </div>

        {selectedBank && (
          <div className="md:col-span-2 xl:col-span-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <MiniInfo title="Bank" value={bankSubLabel(selectedBank)} />
            <MiniInfo title="Total Fund" value={naira(selectedBank.total_fund)} />
            <MiniInfo title="Already Allocated" value={naira(selectedBank.allocated_amount)} />
            <MiniInfo title="Available Capacity" value={naira(selectedBankCapacity)} />
            <MiniInfo title="Bank Available Balance" value={naira(selectedBank.available_balance)} />
          </div>
        )}

        <div>
          <label className="text-sm font-semibold text-slate-800">Code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={!canManage || saving}
            placeholder="e.g. GA-004"
            className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-800">Allocation (₦)</label>
          <input
            value={allocation}
            onChange={(e) => setAllocation(Number(e.target.value || 0))}
            disabled={!canManage || saving}
            type="number"
            className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
          />
          {editId && committed > 0 && (
            <div className="mt-1 text-xs font-semibold text-amber-700">
              Minimum safe allocation: {naira(committed)}.
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="text-sm font-semibold text-slate-800">Subhead Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canManage || saving}
            placeholder="e.g. Vehicles Maintenance"
            className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
          />
        </div>

        <div className="md:col-span-2 xl:col-span-3">
          <label className="text-sm font-semibold text-slate-800">Allocation Note</label>
          <textarea
            value={allocationNote}
            onChange={(e) => setAllocationNote(e.target.value)}
            disabled={!canManage || saving}
            placeholder="Example: 2026 DIN departmental allocation from IET Bank."
            className="mt-1 h-24 w-full rounded-2xl border border-slate-200 px-3 py-3 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-50"
          />
        </div>

        <div className="flex items-end gap-3">
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={!canManage || saving}
            />
            Active
          </label>

          <button
            onClick={onSave}
            disabled={!canManage || saving}
            className="ml-auto rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : editId ? "Update Subhead" : "Create Subhead"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SubheadTable({
  subs,
  deptMap,
  bankMap,
  totals,
  canManage,
  saving,
  onEdit,
  onToggle,
  onDelete,
}: {
  subs: Sub[];
  deptMap: Record<string, string>;
  bankMap: Record<string, BankAccount>;
  totals: ReturnType<typeof computeTotals>;
  canManage: boolean;
  saving: boolean;
  onEdit: (s: Sub) => void;
  onToggle: (s: Sub, nextActive: boolean) => void;
  onDelete: (s: Sub) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1580px] w-full border-collapse text-sm print:min-w-0 print:text-[8px]">
        <thead>
          <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 print:border-b print:border-black print:bg-white print:text-[8px]">
            <th className="px-4 py-3 text-left">Department</th>
            <th className="px-4 py-3 text-left">IET Bank</th>
            <th className="px-4 py-3 text-left">Code</th>
            <th className="px-4 py-3 text-left">Subhead</th>
            <th className="px-4 py-3 text-center">Links</th>
            <th className="px-4 py-3 text-right">Allocation</th>
            <th className="px-4 py-3 text-right">Reserved</th>
            <th className="px-4 py-3 text-right">Expenditure</th>
            <th className="px-4 py-3 text-right">Balance</th>
            <th className="no-print px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>

        <tbody>
          {subs.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-6 py-6 text-sm text-slate-700">
                No subheads found.
              </td>
            </tr>
          ) : (
            subs.map((s) => {
              const bank = s.bank_account_id ? bankMap[s.bank_account_id] : null;

              return (
                <tr key={s.id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-900">
                      {s.dept_id ? deptMap[s.dept_id] || "Unknown Department" : "—"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{s.is_active ? "Active" : "Inactive"}</div>
                  </td>

                  <td className="px-4 py-4">
                    <div className={`font-semibold ${bank ? "text-slate-900" : "text-red-700"}`}>
                      {bankLabel(bank)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{bankSubLabel(bank)}</div>
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-900">{s.code || "—"}</td>

                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-900">{s.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Updated {shortDate(s.updated_at)}
                    </div>
                  </td>

                  <td className="px-4 py-4 text-center">
                    <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                      {Number(s.request_count || 0)}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-right font-semibold text-blue-700">
                    {naira(s.approved_allocation)}
                  </td>

                  <td className="px-4 py-4 text-right font-semibold text-amber-700">
                    {naira(s.reserved_amount)}
                  </td>

                  <td className="px-4 py-4 text-right font-semibold text-red-600">
                    {naira(s.expenditure)}
                  </td>

                  <td
                    className={`px-4 py-4 text-right font-bold ${
                      Number(s.balance || 0) < 0 ? "text-red-700" : "text-emerald-700"
                    }`}
                  >
                    {naira(s.balance)}
                  </td>

                  <td className="no-print px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        disabled={!canManage || saving}
                        onClick={() => onEdit(s)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50"
                      >
                        Edit
                      </button>

                      <button
                        disabled={!canManage || saving}
                        onClick={() => onToggle(s, !s.is_active)}
                        className={`rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
                          s.is_active ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
                        }`}
                      >
                        {s.is_active ? "Deactivate" : "Activate"}
                      </button>

                      <button
                        disabled={!canManage || saving}
                        onClick={() => onDelete(s)}
                        className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {Number(s.request_count || 0) > 0 ||
                        Number(s.approved_allocation || 0) > 0 ||
                        Number(s.reserved_amount || 0) > 0 ||
                        Number(s.expenditure || 0) > 0
                          ? "Deactivate"
                          : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>

        <tfoot>
          <tr className="border-t bg-slate-50 font-black print:bg-white">
            <td className="px-4 py-4 uppercase" colSpan={5}>
              Total
            </td>
            <td className="px-4 py-4 text-right text-blue-700">{naira(totals.allocationTotal)}</td>
            <td className="px-4 py-4 text-right text-amber-700">{naira(totals.reservedTotal)}</td>
            <td className="px-4 py-4 text-right text-red-700">{naira(totals.expenditureTotal)}</td>
            <td className="px-4 py-4 text-right text-emerald-700">{naira(totals.balanceTotal)}</td>
            <td className="no-print px-4 py-4" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function SubheadMobileCard({
  s,
  deptName,
  bank,
  canManage,
  saving,
  onEdit,
  onToggle,
  onDelete,
}: {
  s: Sub;
  deptName: string;
  bank: BankAccount | null;
  canManage: boolean;
  saving: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-bold text-slate-900">{s.name}</div>
          <div className="mt-1 text-sm text-slate-500">{deptName}</div>
          <div className="mt-1 text-xs text-slate-500">Code: {s.code || "—"}</div>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            s.is_active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {s.is_active ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="mt-3 rounded-2xl bg-slate-50 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Funding IET Bank
        </div>
        <div className={`mt-2 text-sm font-extrabold ${bank ? "text-slate-900" : "text-red-700"}`}>
          {bankLabel(bank)}
        </div>
        <div className="mt-1 text-xs text-slate-500">{bankSubLabel(bank)}</div>
      </div>

      <div className="mt-3 text-xs font-bold text-slate-600">
        Linked Requests: {Number(s.request_count || 0)}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <MiniMetric title="Allocation" value={naira(s.approved_allocation)} tone="blue" />
        <MiniMetric title="Reserved" value={naira(s.reserved_amount)} tone="amber" />
        <MiniMetric title="Expenditure" value={naira(s.expenditure)} tone="red" />
        <MiniMetric title="Balance" value={naira(s.balance)} tone="emerald" />
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          disabled={!canManage || saving}
          onClick={onEdit}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50"
        >
          Edit
        </button>

        <button
          disabled={!canManage || saving}
          onClick={onToggle}
          className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
            s.is_active ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {s.is_active ? "Deactivate" : "Activate"}
        </button>

        <button
          disabled={!canManage || saving}
          onClick={onDelete}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {Number(s.request_count || 0) > 0 ||
          Number(s.approved_allocation || 0) > 0 ||
          Number(s.reserved_amount || 0) > 0 ||
          Number(s.expenditure || 0) > 0
            ? "Deactivate"
            : "Delete"}
        </button>
      </div>
    </div>
  );
}

function CompletedRequestsPanel({
  printableRequests,
  subheadMap,
  refreshing,
  saving,
  printing,
  exporting,
  onRefresh,
  onPrint,
}: {
  printableRequests: PrintableRequest[];
  subheadMap: Record<string, string>;
  refreshing: boolean;
  saving: boolean;
  printing: boolean;
  exporting: boolean;
  onRefresh: () => void;
  onPrint: (requestId: string) => void;
}) {
  return (
    <div className="no-print mt-6 rounded-3xl border bg-white shadow-sm overflow-hidden">
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
          onClick={onRefresh}
          disabled={refreshing || printing || exporting || saving}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {printableRequests.length === 0 ? (
        <div className="p-6 text-sm text-slate-700">
          No payment-related completed or paid request is ready for printing yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                <th className="px-4 py-3 text-left">Request No</th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Type / Source</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Requester</th>
                <th className="px-4 py-3 text-left">Account</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {printableRequests.map((r) => (
                <tr key={r.id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-4 font-extrabold text-slate-900">{r.request_no}</td>

                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-900">{r.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {requestPrintSource(r, subheadMap)}
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                      {requestTypeLabel(r)}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-right font-bold text-slate-900">
                    {naira(r.amount)}
                  </td>

                  <td className="px-4 py-4">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                      {r.status}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-slate-700">{r.requester_name || "—"}</td>
                  <td className="px-4 py-4 text-slate-700">{r.account_name || "—"}</td>
                  <td className="px-4 py-4 text-slate-600">{shortDate(r.created_at)}</td>

                  <td className="px-4 py-4 text-right">
                    <button
                      onClick={() => onPrint(r.id)}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      Print
                    </button>
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

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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
    <div className="print-card rounded-3xl border bg-white p-5 shadow-sm print:rounded-none print:border-black print:p-2 print:shadow-none">
      <div className="text-sm font-semibold text-slate-500 print:text-[9px]">{title}</div>
      <div className={`mt-3 inline-flex rounded-2xl px-3 py-2 text-xl font-extrabold print:mt-1 print:p-0 print:text-[11px] ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}

function SmallStat({ title, value }: { title: string; value: string }) {
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

function MiniInfo({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="mt-2 text-sm font-extrabold text-slate-900">{value}</div>
    </div>
  );
}