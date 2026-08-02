"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ActionButton, EnterpriseHero, EnterpriseShell, SectionCard, StatCard } from "@/app/components/enterprise/EnterpriseUI";
import { activeRoleFromRpc, normalizeRows, text } from "@/app/components/enterprise/data";
import { EnterprisePrintDocument, PrintEngineStyles, type PrintColumn } from "@/app/components/print";

type Row = Record<string, unknown>;
type SourceKey = "requests" | "vouchers" | "transactions" | "subheads" | "accounts" | "hr_leave" | "hr_staff" | "seminar" | "registry" | "audit" | "admin_users" | "admin_roles" | "admin_departments" | "security";

type SourceConfig = {
  label: string;
  subtitle: string;
  table: string;
  columns: string;
  roles: string[];
  orientation?: "portrait" | "landscape";
  printColumns: PrintColumn[];
  summaryFields?: Array<{ label: string; key: string }>;
};

const SOURCES: Record<SourceKey, SourceConfig> = {
  requests: { label: "Requests Register", subtitle: "Institutional request workflow and status register", table: "requests", columns: "id,request_no,title,request_type,current_stage,status,created_at,department_id", roles: ["admin","auditor","dg","registry","hr","hrboss","staff"], orientation: "landscape", printColumns: [{key:"request_no",label:"Request No."},{key:"title",label:"Title"},{key:"request_type",label:"Type"},{key:"current_stage",label:"Stage"},{key:"status",label:"Status"},{key:"created_at",label:"Created"}] },
  vouchers: { label: "Payment Voucher Register", subtitle: "Payment voucher monitoring and authorization register", table: "payment_vouchers", columns: "id,voucher_no,voucher_type,status,total_amount,amount,payment_date,created_at", roles: ["admin","auditor","account","accounts","accountofficer"], printColumns: [{key:"voucher_no",label:"Voucher No."},{key:"voucher_type",label:"Type"},{key:"status",label:"Status"},{key:"display_amount",label:"Amount",align:"right"},{key:"payment_date",label:"Payment Date"},{key:"created_at",label:"Created"}] },
  transactions: { label: "Finance Transactions Report", subtitle: "Institutional finance transaction register", table: "finance_transactions", columns: "id,transaction_no,transaction_type,amount,transaction_date,request_id,voucher_id,is_reversed", roles: ["admin","auditor","account","accounts","accountofficer"], orientation: "landscape", printColumns: [{key:"transaction_no",label:"Transaction No."},{key:"transaction_type",label:"Type"},{key:"display_amount",label:"Amount",align:"right"},{key:"transaction_date",label:"Date"},{key:"request_id",label:"Request Ref."},{key:"is_reversed",label:"Reversed"}] },
  subheads: { label: "Subhead Budget Report", subtitle: "Budget allocation, reservation, expenditure and balance report", table: "subheads", columns: "id,code,name,approved_allocation,reserved_amount,expenditure,balance,is_active", roles: ["admin","auditor","account","accounts","accountofficer"], orientation: "landscape", printColumns: [{key:"code",label:"Code"},{key:"name",label:"Subhead"},{key:"approved_allocation_display",label:"Allocation",align:"right"},{key:"reserved_amount_display",label:"Reserved",align:"right"},{key:"expenditure_display",label:"Expenditure",align:"right"},{key:"balance_display",label:"Balance",align:"right"},{key:"is_active",label:"Active"}] },
  accounts: { label: "Institutional Accounts Report", subtitle: "Institutional account status and balance register", table: "iet_accounts", columns: "id,account_name,account_number,bank_name,current_balance,is_active,created_at", roles: ["admin","auditor","account","accounts","accountofficer"], printColumns: [{key:"account_name",label:"Account"},{key:"account_number",label:"Number"},{key:"bank_name",label:"Bank"},{key:"current_balance_display",label:"Balance",align:"right"},{key:"is_active",label:"Active"},{key:"created_at",label:"Created"}] },
  hr_leave: { label: "HR Leave Management Report", subtitle: "Leave request, decision and filing register", table: "hr_leave_requests", columns: "id,staff_name,leave_type,start_date,end_date,total_days,status,created_at", roles: ["admin","auditor","hr","hrboss","hr:leave"], printColumns: [{key:"staff_name",label:"Staff"},{key:"leave_type",label:"Leave Type"},{key:"start_date",label:"Start"},{key:"end_date",label:"End"},{key:"total_days",label:"Days",align:"center"},{key:"status",label:"Status"}] },
  hr_staff: { label: "HR Staff Files Report", subtitle: "Personnel file custody, completeness and retention register", table: "hr_staff_files", columns: "id,file_number,staff_name,employment_status,custody_status,current_location,document_completeness,retention_status", roles: ["admin","auditor","hr","hrboss","hr:stafffiling","hr:registrar","hr:archive"], orientation: "landscape", printColumns: [{key:"file_number",label:"File No."},{key:"staff_name",label:"Staff"},{key:"employment_status",label:"Employment"},{key:"custody_status",label:"Custody"},{key:"current_location",label:"Location"},{key:"document_completeness",label:"Completeness"},{key:"retention_status",label:"Retention"}] },
  seminar: { label: "Wednesday Weekly Seminar Report", subtitle: "Attendance, punctuality and departmental participation register", table: "hr_seminar_attendance", columns: "id,session_id,staff_id,department_id,time_in,attendance_status,late_minutes,remarks", roles: ["admin","auditor","hr","hrboss","hr:weeklyseminar"], orientation: "landscape", printColumns: [{key:"staff_id",label:"Staff ID"},{key:"department_id",label:"Department"},{key:"time_in",label:"Time In"},{key:"attendance_status",label:"Attendance"},{key:"late_minutes",label:"Late (mins)",align:"center"},{key:"remarks",label:"Remarks"}] },
  registry: { label: "Registry Operations Report", subtitle: "Incoming, outgoing, dispatch and archive correspondence register", table: "registry_correspondence", columns: "id,reference_no,direction,subject,sender_recipient,department_id,priority,status,received_sent_at,created_at", roles: ["admin","auditor","registry"], orientation: "landscape", printColumns: [{key:"reference_no",label:"Reference"},{key:"direction",label:"Direction"},{key:"subject",label:"Subject"},{key:"sender_recipient",label:"Sender / Recipient"},{key:"priority",label:"Priority"},{key:"status",label:"Status"},{key:"received_sent_at",label:"Date"}] },
  audit: { label: "Enterprise Audit Report", subtitle: "Who did what, under which role, and when", table: "enterprise_audit_events", columns: "id,module,action,actor_id,active_role,record_type,record_id,risk_level,details,created_at", roles: ["admin","auditor"], orientation: "landscape", printColumns: [{key:"created_at",label:"Date / Time"},{key:"module",label:"Module"},{key:"action",label:"Action"},{key:"actor_id",label:"Actor"},{key:"active_role",label:"Active Role"},{key:"record_id",label:"Record"},{key:"risk_level",label:"Risk"},{key:"details",label:"Details"}] },
  admin_users: { label: "User Administration Report", subtitle: "User account, department and access-status register", table: "profiles", columns: "id,full_name,email,role,department_id,is_active,mfa_enabled,created_at", roles: ["admin","auditor"], orientation: "landscape", printColumns: [{key:"full_name",label:"Name"},{key:"email",label:"Email"},{key:"role",label:"Primary Role"},{key:"department_id",label:"Department"},{key:"is_active",label:"Active"},{key:"mfa_enabled",label:"MFA"},{key:"created_at",label:"Created"}] },
  admin_roles: { label: "Roles & Permissions Report", subtitle: "Assigned role and activation register", table: "profile_roles", columns: "id,profile_id,role,role_key,role_name,is_active,created_at", roles: ["admin","auditor"], printColumns: [{key:"profile_id",label:"User"},{key:"role",label:"Role"},{key:"role_key",label:"Role Key"},{key:"role_name",label:"Role Name"},{key:"is_active",label:"Active"},{key:"created_at",label:"Assigned"}] },
  admin_departments: { label: "Departments Report", subtitle: "Institutional department status and governance register", table: "departments", columns: "id,name,code,is_active,created_at", roles: ["admin","auditor"], printColumns: [{key:"code",label:"Code"},{key:"name",label:"Department"},{key:"is_active",label:"Active"},{key:"created_at",label:"Created"}] },
  security: { label: "Security & Access Report", subtitle: "Working-role changes and account access events", table: "user_role_switch_history", columns: "id,user_id,previous_role_key,new_role_key,authorization_source,switched_at", roles: ["admin","auditor"], printColumns: [{key:"switched_at",label:"Date / Time"},{key:"user_id",label:"User"},{key:"previous_role_key",label:"Previous Role"},{key:"new_role_key",label:"New Role"},{key:"authorization_source",label:"Authorization"}] },
};

function normalizeRole(value: string) { return value.toLowerCase().replace(/[^a-z0-9:]+/g, ""); }
function money(value: unknown) { return `NGN ${Number(value ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function displayDate(value: unknown) { const raw = text(value); if (!raw) return "—"; const d = new Date(raw); return Number.isNaN(d.getTime()) ? raw : d.toLocaleString("en-NG"); }

export default function OutputCentrePage() {
  const searchParams = useSearchParams();
  const requested = searchParams.get("report") as SourceKey | null;
  const [role, setRole] = useState("staff");
  const [selected, setSelected] = useState<SourceKey>(requested && requested in SOURCES ? requested : "requests");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [printedBy, setPrintedBy] = useState("ReqGen User");
  const [department, setDepartment] = useState("");

  const available = useMemo(() => Object.entries(SOURCES).filter(([, config]) => config.roles.includes(normalizeRole(role))) as Array<[SourceKey, SourceConfig]>, [role]);

  const load = useCallback(async () => {
    setLoading(true); setWarning(null);
    try {
      const auth = await supabase.auth.getUser();
      const uid = auth.data.user?.id;
      if (!uid) throw new Error("Your session could not be verified.");
      const [active, profile] = await Promise.all([
        supabase.rpc("get_my_active_role"),
        supabase.from("profiles").select("full_name,email,department_id").eq("id", uid).maybeSingle(),
      ]);
      const roleValue = normalizeRole(activeRoleFromRpc(active.data));
      setRole(roleValue || "staff");
      setPrintedBy(profile.data?.full_name || profile.data?.email || auth.data.user?.email || "ReqGen User");
      setDepartment(text(profile.data?.department_id));
      const permitted = Object.entries(SOURCES).filter(([, config]) => config.roles.includes(roleValue)) as Array<[SourceKey, SourceConfig]>;
      const actualKey = permitted.some(([key]) => key === selected) ? selected : permitted[0]?.[0] ?? "requests";
      if (actualKey !== selected) setSelected(actualKey);
      const config = SOURCES[actualKey];
      const result = await supabase.from(config.table).select(config.columns).limit(1000);
      if (result.error) throw result.error;
      setRows(normalizeRows(result.data));
    } catch (error) {
      console.error(error); setRows([]); setWarning("The selected report source is unavailable or restricted to your active role.");
    } finally { setLoading(false); }
  }, [selected]);

  useEffect(() => { void load(); }, [load]);

  const normalizedRows = useMemo(() => rows.map((row) => ({
    ...row,
    created_at: displayDate(row.created_at), payment_date: displayDate(row.payment_date), transaction_date: displayDate(row.transaction_date), received_sent_at: displayDate(row.received_sent_at), switched_at: displayDate(row.switched_at),
    display_amount: money(row.total_amount ?? row.amount), approved_allocation_display: money(row.approved_allocation), reserved_amount_display: money(row.reserved_amount), expenditure_display: money(row.expenditure), balance_display: money(row.balance), current_balance_display: money(row.current_balance),
    details: typeof row.details === "object" ? JSON.stringify(row.details) : text(row.details),
  })), [rows]);

  const selectedConfig = SOURCES[selected];
  const documentId = `IET-${selected.toUpperCase()}-${new Date().toISOString().slice(0,10).replace(/-/g,"")}`;
  const observations = useMemo(() => {
    const list = [`${normalizedRows.length} record(s) were included in this report.`];
    if (selected === "audit") list.push("High-risk and sensitive actions require management review and documented resolution.");
    if (selected === "subheads") list.push("Negative or low balances should be reviewed before new commitments are approved.");
    if (selected === "seminar") list.push("Repeated lateness and unexplained absence should be addressed through HR follow-up.");
    return list;
  }, [normalizedRows.length, selected]);

  function exportCsv() {
    const headers = selectedConfig.printColumns.map((column) => column.key);
    const csv = [selectedConfig.printColumns.map((column) => column.label).join(","), ...normalizedRows.map((row) => headers.map((header) => `"${text(row[header]).replace(/"/g, '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${selected}-report.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <>
    <PrintEngineStyles />
    <div className="no-print"><EnterpriseShell><div className="mx-auto max-w-[1500px] space-y-6">
      <EnterpriseHero eyebrow="Enterprise Document Generation" title="IET Print & Output Centre" description="Generate official A4 institutional reports without printing application pages. Approved Request and Payment Voucher templates remain unchanged." actions={<><ActionButton tone="cyan" onClick={() => void load()}>{loading ? "Refreshing..." : "Refresh Data"}</ActionButton><ActionButton tone="emerald" onClick={exportCsv} disabled={!rows.length}>Export CSV</ActionButton><ActionButton tone="violet" onClick={() => window.print()} disabled={loading}>Print A4 Report</ActionButton></>} />
      {warning ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{warning}</div> : null}
      <section className="grid gap-4 sm:grid-cols-3"><StatCard label="Active Role" value={role || "Staff"} note="Controls available report templates" tone="slate" /><StatCard label="Available Templates" value={available.length} note="Authorized institutional outputs" tone="blue" /><StatCard label="Report Records" value={loading ? "—" : rows.length} note="Maximum 1,000 records" tone="emerald" /></section>
      <SectionCard title="Enterprise Report Templates" eyebrow="Select a report"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{available.map(([key, config]) => <button key={key} type="button" onClick={() => setSelected(key)} className={`min-h-14 rounded-xl px-4 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg ${selected === key ? "bg-gradient-to-r from-blue-800 to-cyan-600 ring-4 ring-blue-100" : "bg-gradient-to-r from-slate-700 to-slate-900"}`}>{config.label}</button>)}</div></SectionCard>
      <SectionCard title="A4 Print Preview" eyebrow="Official IET document"><p className="text-sm font-semibold text-slate-600">The preview below is isolated from the application UI. Printing produces only the official IET document.</p><div className="overflow-auto rounded-2xl bg-slate-200 p-2 sm:p-6"><EnterprisePrintDocument title={selectedConfig.label} subtitle={selectedConfig.subtitle} documentId={documentId} period="Current authorized data" printedBy={printedBy} activeRole={role} department={department} orientation={selectedConfig.orientation} summaries={[{label:"Records",value:normalizedRows.length},{label:"Report",value:selectedConfig.label},{label:"Role",value:role},{label:"Generated",value:new Date().toLocaleDateString("en-NG") }]} columns={selectedConfig.printColumns} rows={normalizedRows.slice(0,100)} observations={observations} recommendations={["Review exceptions and unresolved records before formal management decisions.","Retain the signed report in accordance with IET records policy."]} /></div></SectionCard>
    </div></EnterpriseShell></div>
    <div className="print-only"><EnterprisePrintDocument title={selectedConfig.label} subtitle={selectedConfig.subtitle} documentId={documentId} period="Current authorized data" printedBy={printedBy} activeRole={role} department={department} orientation={selectedConfig.orientation} summaries={[{label:"Records",value:normalizedRows.length},{label:"Report",value:selectedConfig.label},{label:"Role",value:role},{label:"Generated",value:new Date().toLocaleDateString("en-NG") }]} columns={selectedConfig.printColumns} rows={normalizedRows} observations={observations} recommendations={["Review exceptions and unresolved records before formal management decisions.","Retain the signed report in accordance with IET records policy."]} /></div>
  </>;
}
