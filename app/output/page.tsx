"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  ActionButton,
  EnterpriseHero,
  EnterpriseShell,
  SectionCard,
  StatCard,
} from "@/app/components/enterprise/EnterpriseUI";
import { normalizeRows, text } from "@/app/components/enterprise/data";
import {
  EnterprisePrintDocument,
  PrintEngineStyles,
  type PrintColumn,
} from "@/app/components/print";

type Row = Record<string, unknown>;
type SourceKey =
  | "requests"
  | "vouchers"
  | "transactions"
  | "subheads"
  | "accounts"
  | "hr_leave"
  | "hr_staff"
  | "seminar"
  | "registry"
  | "audit"
  | "admin_users"
  | "admin_roles"
  | "admin_departments"
  | "security";

type SourceConfig = {
  label: string;
  shortLabel: string;
  subtitle: string;
  table: string;
  columns: string;
  roles: string[];
  icon: string;
  gradient: string;
  orientation?: "portrait" | "landscape";
  printColumns: PrintColumn[];
};

const ALL_ROLES = [
  "admin",
  "auditor",
  "dg",
  "registry",
  "hr",
  "hrboss",
  "staff",
  "account",
  "accounts",
  "accountofficer",
];

const SOURCES: Record<SourceKey, SourceConfig> = {
  requests: {
    label: "Requests Register",
    shortLabel: "Requests",
    subtitle: "Institutional request workflow and status register",
    table: "requests",
    columns:
      "id,request_no,title,request_type,current_stage,status,created_at,department_id",
    roles: ALL_ROLES,
    icon: "📋",
    gradient: "from-blue-700 via-blue-600 to-cyan-500",
    orientation: "landscape",
    printColumns: [
      { key: "request_no", label: "Request No." },
      { key: "title", label: "Title" },
      { key: "request_type", label: "Type" },
      { key: "current_stage", label: "Stage" },
      { key: "status", label: "Status" },
      { key: "created_at", label: "Created" },
    ],
  },
  vouchers: {
    label: "Payment Voucher Register",
    shortLabel: "Vouchers",
    subtitle: "Payment voucher monitoring and authorization register",
    table: "payment_vouchers",
    columns:
      "id,voucher_no,voucher_type,status,total_amount,amount,payment_date,created_at",
    roles: ["admin", "auditor", "account", "accounts", "accountofficer"],
    icon: "🧾",
    gradient: "from-violet-700 via-purple-600 to-fuchsia-500",
    printColumns: [
      { key: "voucher_no", label: "Voucher No." },
      { key: "voucher_type", label: "Type" },
      { key: "status", label: "Status" },
      { key: "display_amount", label: "Amount", align: "right" },
      { key: "payment_date", label: "Payment Date" },
      { key: "created_at", label: "Created" },
    ],
  },
  transactions: {
    label: "Finance Transactions Report",
    shortLabel: "Transactions",
    subtitle: "Institutional finance transaction register",
    table: "finance_transactions",
    columns:
      "id,transaction_no,transaction_type,amount,transaction_date,request_id,voucher_id,is_reversed",
    roles: ["admin", "auditor", "account", "accounts", "accountofficer"],
    icon: "💳",
    gradient: "from-emerald-700 via-emerald-600 to-teal-500",
    orientation: "landscape",
    printColumns: [
      { key: "transaction_no", label: "Transaction No." },
      { key: "transaction_type", label: "Type" },
      { key: "display_amount", label: "Amount", align: "right" },
      { key: "transaction_date", label: "Date" },
      { key: "request_id", label: "Request Ref." },
      { key: "is_reversed", label: "Reversed" },
    ],
  },
  subheads: {
    label: "Subhead Budget Report",
    shortLabel: "Subheads",
    subtitle: "Budget allocation, reservation, expenditure and balance report",
    table: "subheads",
    columns:
      "id,code,name,approved_allocation,reserved_amount,expenditure,balance,is_active",
    roles: ["admin", "auditor", "account", "accounts", "accountofficer"],
    icon: "📊",
    gradient: "from-amber-600 via-orange-500 to-yellow-400",
    orientation: "landscape",
    printColumns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Subhead" },
      {
        key: "approved_allocation_display",
        label: "Allocation",
        align: "right",
      },
      { key: "reserved_amount_display", label: "Reserved", align: "right" },
      { key: "expenditure_display", label: "Expenditure", align: "right" },
      { key: "balance_display", label: "Balance", align: "right" },
      { key: "is_active", label: "Active" },
    ],
  },
  accounts: {
    label: "Institutional Accounts Report",
    shortLabel: "Accounts",
    subtitle: "Institutional account status and balance register",
    table: "iet_accounts",
    columns:
      "id,name,code,account_number,bank_name,total_fund,allocated_amount,is_active,created_at",
    roles: ["admin", "auditor", "account", "accounts", "accountofficer"],
    icon: "🏦",
    gradient: "from-cyan-700 via-sky-600 to-blue-500",
    printColumns: [
      { key: "name", label: "Account" },
      { key: "code", label: "Code" },
      { key: "account_number", label: "Number" },
      { key: "bank_name", label: "Bank" },
      { key: "total_fund_display", label: "Total Fund", align: "right" },
      {
        key: "allocated_amount_display",
        label: "Allocated",
        align: "right",
      },
      { key: "is_active", label: "Active" },
    ],
  },
  hr_leave: {
    label: "HR Leave Management Report",
    shortLabel: "HR Leave",
    subtitle: "Leave request, decision and filing register",
    table: "hr_leave_requests",
    columns:
      "id,staff_name,leave_type,start_date,end_date,total_days,status,created_at",
    roles: ["admin", "auditor", "hr", "hrboss", "hr:leave"],
    icon: "🗓️",
    gradient: "from-pink-700 via-rose-600 to-red-500",
    printColumns: [
      { key: "staff_name", label: "Staff" },
      { key: "leave_type", label: "Leave Type" },
      { key: "start_date", label: "Start" },
      { key: "end_date", label: "End" },
      { key: "total_days", label: "Days", align: "center" },
      { key: "status", label: "Status" },
    ],
  },
  hr_staff: {
    label: "HR Staff Files Report",
    shortLabel: "Staff Files",
    subtitle: "Personnel file custody, completeness and retention register",
    table: "hr_staff_files",
    columns:
      "id,file_number,staff_name,employment_status,custody_status,current_location,document_completeness,retention_status",
    roles: [
      "admin",
      "auditor",
      "hr",
      "hrboss",
      "hr:stafffiling",
      "hr:registrar",
      "hr:archive",
    ],
    icon: "🗂️",
    gradient: "from-indigo-700 via-indigo-600 to-violet-500",
    orientation: "landscape",
    printColumns: [
      { key: "file_number", label: "File No." },
      { key: "staff_name", label: "Staff" },
      { key: "employment_status", label: "Employment" },
      { key: "custody_status", label: "Custody" },
      { key: "current_location", label: "Location" },
      { key: "document_completeness", label: "Completeness" },
      { key: "retention_status", label: "Retention" },
    ],
  },
  seminar: {
    label: "Wednesday Weekly Seminar Report",
    shortLabel: "Seminar",
    subtitle: "Attendance, punctuality and departmental participation register",
    table: "hr_seminar_attendance",
    columns:
      "id,session_id,staff_id,department_id,time_in,attendance_status,late_minutes,remarks",
    roles: ["admin", "auditor", "hr", "hrboss", "hr:weeklyseminar"],
    icon: "🎓",
    gradient: "from-teal-700 via-teal-600 to-emerald-500",
    orientation: "landscape",
    printColumns: [
      { key: "staff_id", label: "Staff ID" },
      { key: "department_id", label: "Department" },
      { key: "time_in", label: "Time In" },
      { key: "attendance_status", label: "Attendance" },
      { key: "late_minutes", label: "Late (mins)", align: "center" },
      { key: "remarks", label: "Remarks" },
    ],
  },
  registry: {
    label: "Registry Operations Report",
    shortLabel: "Registry",
    subtitle: "Incoming, outgoing, dispatch and archive correspondence register",
    table: "registry_correspondence",
    columns:
      "id,reference_no,direction,subject,sender_recipient,department_id,priority,status,received_sent_at,created_at",
    roles: ["admin", "auditor", "registry"],
    icon: "📨",
    gradient: "from-slate-700 via-slate-600 to-blue-500",
    orientation: "landscape",
    printColumns: [
      { key: "reference_no", label: "Reference" },
      { key: "direction", label: "Direction" },
      { key: "subject", label: "Subject" },
      { key: "sender_recipient", label: "Sender / Recipient" },
      { key: "priority", label: "Priority" },
      { key: "status", label: "Status" },
      { key: "received_sent_at", label: "Date" },
    ],
  },
  audit: {
    label: "Audit Report",
    shortLabel: "Audit",
    subtitle: "Who did what, under which role, and when",
    table: "enterprise_audit_events",
    columns:
      "id,module,action,actor_id,active_role,record_type,record_id,risk_level,details,created_at",
    roles: ["admin", "auditor"],
    icon: "🛡️",
    gradient: "from-red-800 via-rose-700 to-orange-500",
    orientation: "landscape",
    printColumns: [
      { key: "created_at", label: "Date / Time" },
      { key: "module", label: "Module" },
      { key: "action", label: "Action" },
      { key: "actor_id", label: "Actor" },
      { key: "active_role", label: "Active Role" },
      { key: "record_id", label: "Record" },
      { key: "risk_level", label: "Risk" },
      { key: "details", label: "Details" },
    ],
  },
  admin_users: {
    label: "User Administration Report",
    shortLabel: "Users",
    subtitle: "User account, department and access-status register",
    table: "profiles",
    columns: "id,full_name,email,role,department_id,is_active,created_at",
    roles: ["admin", "auditor"],
    icon: "👥",
    gradient: "from-blue-800 via-indigo-700 to-violet-500",
    orientation: "landscape",
    printColumns: [
      { key: "full_name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "role", label: "Primary Role" },
      { key: "department_id", label: "Department" },
      { key: "is_active", label: "Active" },
      { key: "created_at", label: "Created" },
    ],
  },
  admin_roles: {
    label: "Roles & Permissions Report",
    shortLabel: "Roles",
    subtitle: "Assigned role and activation register",
    table: "profile_roles",
    columns: "id,profile_id,role,role_key,role_name,is_active,created_at",
    roles: ["admin", "auditor"],
    icon: "🔐",
    gradient: "from-purple-800 via-violet-700 to-indigo-500",
    printColumns: [
      { key: "profile_id", label: "User" },
      { key: "role", label: "Role" },
      { key: "role_key", label: "Role Key" },
      { key: "role_name", label: "Role Name" },
      { key: "is_active", label: "Active" },
      { key: "created_at", label: "Assigned" },
    ],
  },
  admin_departments: {
    label: "Departments Report",
    shortLabel: "Departments",
    subtitle: "Institutional department status and governance register",
    table: "departments",
    columns: "id,name,is_active,created_at",
    roles: ["admin", "auditor"],
    icon: "🏢",
    gradient: "from-cyan-800 via-cyan-700 to-sky-500",
    printColumns: [
      { key: "name", label: "Department" },
      { key: "is_active", label: "Active" },
      { key: "created_at", label: "Created" },
    ],
  },
  security: {
    label: "Security & Access Report",
    shortLabel: "Security",
    subtitle: "Working-role changes and account access events",
    table: "user_role_switch_history",
    columns:
      "id,user_id,previous_role_key,new_role_key,authorization_source,switched_at",
    roles: ["admin", "auditor"],
    icon: "🔒",
    gradient: "from-slate-900 via-slate-700 to-cyan-600",
    printColumns: [
      { key: "switched_at", label: "Date / Time" },
      { key: "user_id", label: "User" },
      { key: "previous_role_key", label: "Previous Role" },
      { key: "new_role_key", label: "New Role" },
      { key: "authorization_source", label: "Authorization" },
    ],
  },
};

function normalizeRole(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9:]+/g, "");
}

function extractActiveRole(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = extractActiveRole(item);
      if (parsed) return parsed;
    }
    return "";
  }
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    const candidates = [
      row.active_role_key,
      row.active_role,
      row.role_key,
      row.role,
      row.get_my_active_role,
    ];
    for (const candidate of candidates) {
      const parsed = extractActiveRole(candidate);
      if (parsed) return parsed;
    }
  }
  return "";
}

function money(value: unknown) {
  return `NGN ${Number(value ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function displayDate(value: unknown) {
  const raw = text(value);
  if (!raw) return "—";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString("en-NG");
}

async function fetchSource(config: SourceConfig) {
  const result = await supabase.from(config.table).select(config.columns).limit(1000);
  if (!result.error) return normalizeRows(result.data);

  // Some deployed databases have evolved column names. A safe broad fallback
  // keeps Admin reporting operational while RLS still controls row access.
  const fallback = await supabase.from(config.table).select("*").limit(1000);
  if (fallback.error) throw fallback.error;
  return normalizeRows(fallback.data);
}

export default function OutputCentrePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get("report") as SourceKey | null;
  const [role, setRole] = useState("staff");
  const [selected, setSelected] = useState<SourceKey>(
    requested && requested in SOURCES ? requested : "requests"
  );
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [printedBy, setPrintedBy] = useState("ReqGen User");
  const [department, setDepartment] = useState("");
  const [legacyRequests, setLegacyRequests] = useState<Row[]>([]);
  const [legacyVouchers, setLegacyVouchers] = useState<Row[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [selectedVoucherId, setSelectedVoucherId] = useState("");
  const [legacyLoading, setLegacyLoading] = useState(false);

  const available = useMemo(
    () =>
      Object.entries(SOURCES).filter(([, config]) =>
        config.roles.includes(normalizeRole(role))
      ) as Array<[SourceKey, SourceConfig]>,
    [role]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setWarning(null);

    try {
      const auth = await supabase.auth.getUser();
      const uid = auth.data.user?.id;
      if (!uid) throw new Error("Your session could not be verified.");

      const [active, profile] = await Promise.all([
        supabase.rpc("get_my_active_role"),
        supabase
          .from("profiles")
          .select("full_name,email,department_id,role")
          .eq("id", uid)
          .maybeSingle(),
      ]);

      const rpcRole = normalizeRole(extractActiveRole(active.data));
      const profileRole = normalizeRole(text(profile.data?.role));
      const roleValue = rpcRole || profileRole || "staff";

      setRole(roleValue);
      setPrintedBy(
        profile.data?.full_name ||
          profile.data?.email ||
          auth.data.user?.email ||
          "ReqGen User"
      );
      setDepartment(text(profile.data?.department_id));

      const permitted = Object.entries(SOURCES).filter(([, config]) =>
        config.roles.includes(roleValue)
      ) as Array<[SourceKey, SourceConfig]>;

      if (!permitted.length) {
        setRows([]);
        setWarning("No report template is assigned to the current active role.");
        return;
      }

      const actualKey = permitted.some(([key]) => key === selected)
        ? selected
        : permitted[0][0];

      if (actualKey !== selected) setSelected(actualKey);

      const resultRows = await fetchSource(SOURCES[actualKey]);
      setRows(resultRows);

      setLegacyLoading(true);
      const [requestLegacyResult, voucherLegacyResult] = await Promise.all([
        supabase
          .from("requests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
        ["admin", "auditor", "account", "accounts", "accountofficer"].includes(roleValue)
          ? supabase
              .from("payment_vouchers")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const requestOptions = normalizeRows(requestLegacyResult.data);
      const voucherOptions = normalizeRows(voucherLegacyResult.data);
      setLegacyRequests(requestOptions);
      setLegacyVouchers(voucherOptions);
      setSelectedRequestId((current) => current || text(requestOptions[0]?.id));
      setSelectedVoucherId((current) => current || text(voucherOptions[0]?.id));
      setLegacyLoading(false);
    } catch (error) {
      console.error("Unable to load enterprise report:", error);
      setRows([]);
      setLegacyLoading(false);
      setWarning(
        "The report source could not be loaded. Confirm that its database table exists and that the current active role has read access."
      );
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    void load();
  }, [load]);

  const normalizedRows = useMemo<Row[]>(
    () =>
      rows.map((row): Row => ({
        ...row,
        created_at: displayDate(row.created_at),
        payment_date: displayDate(row.payment_date),
        transaction_date: displayDate(row.transaction_date),
        received_sent_at: displayDate(row.received_sent_at),
        switched_at: displayDate(row.switched_at),
        display_amount: money(row.total_amount ?? row.amount),
        approved_allocation_display: money(row.approved_allocation),
        reserved_amount_display: money(row.reserved_amount),
        expenditure_display: money(row.expenditure),
        balance_display: money(row.balance ?? row.available_balance),
        current_balance_display: money(row.current_balance),
        total_fund_display: money(row.total_fund),
        allocated_amount_display: money(row.allocated_amount),
        details:
          row.details !== null && typeof row.details === "object"
            ? JSON.stringify(row.details)
            : text(row.details),
      })),
    [rows]
  );

  const selectedConfig = SOURCES[selected];
  const documentId = `IET-${selected.toUpperCase()}-${new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "")}`;

  const observations = useMemo(() => {
    const list = [`${normalizedRows.length} record(s) were included in this report.`];
    if (selected === "audit")
      list.push(
        "High-risk and sensitive actions require management review and documented resolution."
      );
    if (selected === "subheads")
      list.push(
        "Negative or low balances should be reviewed before new commitments are approved."
      );
    if (selected === "seminar")
      list.push(
        "Repeated lateness and unexplained absence should be addressed through HR follow-up."
      );
    return list;
  }, [normalizedRows.length, selected]);

  function openLegacyRequestPrint() {
    if (!selectedRequestId) {
      setWarning("Select a Request before opening the approved legacy Request template.");
      return;
    }
    router.push(`/requests/${selectedRequestId}/print`);
  }

  function openLegacyVoucherPrint() {
    if (!selectedVoucherId) {
      setWarning("Select a Payment Voucher before opening the approved legacy PV template.");
      return;
    }
    router.push(`/payment-vouchers/${selectedVoucherId}/print`);
  }

  function exportCsv() {
    const headers = selectedConfig.printColumns.map((column) => column.key);
    const csv = [
      selectedConfig.printColumns.map((column) => column.label).join(","),
      ...normalizedRows.map((row) =>
        headers
          .map(
            (header) => `"${text(row[header]).replace(/"/g, '""')}"`
          )
          .join(",")
      ),
    ].join("\n");

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selected}-report.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PrintEngineStyles />

      <div className="no-print">
        <EnterpriseShell>
          <div className="mx-auto max-w-[1500px] space-y-6">
            <EnterpriseHero
              eyebrow="Enterprise Document Generation"
              title="IET Print & Output Centre"
              description="Generate official A4 institutional reports from live authorized data. The approved Request and Payment Voucher templates remain protected and unchanged."
              actions={
                <>
                  <Link
                    href="/dashboard"
                    className="reqgen-btn reqgen-btn-slate"
                  >
                    ← Main Dashboard
                  </Link>
                  <Link
                    href="/reports"
                    className="reqgen-btn reqgen-btn-blue"
                  >
                    Reports & Analytics
                  </Link>
                  <ActionButton tone="cyan" onClick={() => void load()}>
                    {loading ? "Refreshing..." : "Refresh Data"}
                  </ActionButton>
                  <ActionButton
                    tone="emerald"
                    onClick={exportCsv}
                    disabled={!rows.length}
                  >
                    Export CSV
                  </ActionButton>
                  <ActionButton
                    tone="violet"
                    onClick={() => window.print()}
                    disabled={loading}
                  >
                    Print A4 Report
                  </ActionButton>
                </>
              }
            />

            <section className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
              <div className="overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-800 p-6 text-white shadow-2xl">
                <div className="flex items-start gap-4">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 text-4xl shadow-inner backdrop-blur">
                    🖨️
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                      Institutional Output Engine
                    </div>
                    <h2 className="mt-2 text-2xl font-black">
                      Official IET A4 Documents
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-blue-100">
                      Select a live report, inspect the official preview, then print or save it as PDF without application navigation or dashboard clutter.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 p-5 text-white shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-2xl shadow-inner">📄</div>
                    <div>
                      <div className="text-base font-black">Approved IET Request Template</div>
                      <div className="text-xs font-bold text-blue-100">Original legacy Request printout</div>
                    </div>
                  </div>
                  <label className="mt-4 block text-xs font-black uppercase tracking-wider text-blue-100">Select Request</label>
                  <select
                    value={selectedRequestId}
                    onChange={(event) => setSelectedRequestId(event.target.value)}
                    className="mt-2 min-h-12 w-full rounded-xl border border-white/30 bg-white/95 px-3 text-sm font-bold text-slate-950 shadow-sm outline-none focus:ring-4 focus:ring-white/30"
                  >
                    {!legacyRequests.length ? <option value="">No Request available</option> : null}
                    {legacyRequests.map((row) => (
                      <option key={text(row.id)} value={text(row.id)}>
                        {text(row.request_no, "Request")} — {text(row.title, "Untitled Request")}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={openLegacyRequestPrint}
                    disabled={legacyLoading || !selectedRequestId}
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-black text-blue-800 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {legacyLoading ? "Loading Requests..." : "Open Original Request Print"}
                  </button>
                </div>

                <div className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-700 via-purple-600 to-fuchsia-500 p-5 text-white shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-2xl shadow-inner">🧾</div>
                    <div>
                      <div className="text-base font-black">Approved IET Payment Voucher</div>
                      <div className="text-xs font-bold text-violet-100">Original protected PV printout</div>
                    </div>
                  </div>
                  <label className="mt-4 block text-xs font-black uppercase tracking-wider text-violet-100">Select Voucher</label>
                  <select
                    value={selectedVoucherId}
                    onChange={(event) => setSelectedVoucherId(event.target.value)}
                    className="mt-2 min-h-12 w-full rounded-xl border border-white/30 bg-white/95 px-3 text-sm font-bold text-slate-950 shadow-sm outline-none focus:ring-4 focus:ring-white/30"
                  >
                    {!legacyVouchers.length ? <option value="">No Payment Voucher available</option> : null}
                    {legacyVouchers.map((row) => (
                      <option key={text(row.id)} value={text(row.id)}>
                        {text(row.voucher_no, text(row.pv_no, "Payment Voucher"))} — {text(row.status, "Pending")}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={openLegacyVoucherPrint}
                    disabled={legacyLoading || !selectedVoucherId}
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-black text-violet-800 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {legacyLoading ? "Loading Vouchers..." : "Open Original PV Print"}
                  </button>
                </div>
              </div>
            </section>

            {warning ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900 shadow-sm">
                {warning}
              </div>
            ) : null}

            <section className="grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Active Role"
                value={role || "Staff"}
                note="Determines visible report templates"
                tone="slate"
              />
              <StatCard
                label="Available Templates"
                value={available.length}
                note="Authorized institutional outputs"
                tone="blue"
              />
              <StatCard
                label="Report Records"
                value={loading ? "—" : rows.length}
                note="Maximum 1,000 records per output"
                tone="emerald"
              />
            </section>

            <SectionCard title="Enterprise Report Library" eyebrow="Live templates">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {available.map(([key, config]) => {
                  const active = selected === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelected(key)}
                      className={`group relative min-h-[168px] overflow-hidden rounded-2xl border border-white/25 bg-gradient-to-br ${config.gradient} p-5 text-left !text-white shadow-xl transition hover:-translate-y-1 hover:brightness-105 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-blue-200 ${
                        active ? "ring-4 ring-blue-200" : ""
                      }`}
                    >
                      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10" />
                      <div className="relative flex items-start justify-between gap-3">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-2xl shadow-inner backdrop-blur">
                          {config.icon}
                        </div>
                        <span className="rounded-full border border-white/20 bg-white/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider !text-white backdrop-blur">
                          {active ? "Selected" : "A4 Report"}
                        </span>
                      </div>
                      <div className="relative mt-5 text-base font-black uppercase tracking-wide !text-white">
                        {config.shortLabel}
                      </div>
                      <p className="relative mt-2 line-clamp-2 text-xs font-bold leading-5 !text-white/90">
                        {config.subtitle}
                      </p>
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="Official A4 Print Preview" eyebrow="IET enterprise document">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 p-4">
                <div>
                  <div className="text-sm font-black text-slate-950">
                    {selectedConfig.label}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-600">
                    {selectedConfig.subtitle}
                  </div>
                </div>
                <div className="rounded-xl bg-white px-3 py-2 text-xs font-black text-blue-700 shadow-sm">
                  {loading ? "Loading live data..." : `${rows.length} record(s) ready`}
                </div>
              </div>

              <div className="overflow-auto rounded-2xl bg-slate-200 p-2 sm:p-6">
                <EnterprisePrintDocument
                  title={selectedConfig.label}
                  subtitle={selectedConfig.subtitle}
                  documentId={documentId}
                  period="Current authorized data"
                  printedBy={printedBy}
                  activeRole={role}
                  department={department}
                  orientation={selectedConfig.orientation}
                  summaries={[
                    { label: "Records", value: normalizedRows.length },
                    { label: "Report", value: selectedConfig.shortLabel },
                    { label: "Role", value: role },
                    {
                      label: "Generated",
                      value: new Date().toLocaleDateString("en-NG"),
                    },
                  ]}
                  columns={selectedConfig.printColumns}
                  rows={normalizedRows.slice(0, 100)}
                  observations={observations}
                  recommendations={[
                    "Review exceptions and unresolved records before formal management decisions.",
                    "Retain the signed report in accordance with IET records policy.",
                  ]}
                />
              </div>
            </SectionCard>
          </div>
        </EnterpriseShell>
      </div>

      <div className="print-only">
        <EnterprisePrintDocument
          title={selectedConfig.label}
          subtitle={selectedConfig.subtitle}
          documentId={documentId}
          period="Current authorized data"
          printedBy={printedBy}
          activeRole={role}
          department={department}
          orientation={selectedConfig.orientation}
          summaries={[
            { label: "Records", value: normalizedRows.length },
            { label: "Report", value: selectedConfig.shortLabel },
            { label: "Role", value: role },
            {
              label: "Generated",
              value: new Date().toLocaleDateString("en-NG"),
            },
          ]}
          columns={selectedConfig.printColumns}
          rows={normalizedRows}
          observations={observations}
          recommendations={[
            "Review exceptions and unresolved records before formal management decisions.",
            "Retain the signed report in accordance with IET records policy.",
          ]}
        />
      </div>
    </>
  );
}
