import "server-only";

/**
 * ReqGen v3.1.8 — what the Master Backup contains, in RESTORE order
 * (parents before children). "dated" tables are filtered by financial year
 * on created_at; reference tables are always included in full.
 * Secrets (OTP codes) and delivery logs are deliberately excluded.
 */
export type BackupTable = { table: string; group: string; label: string; dated: boolean };

export const BACKUP_TABLES: BackupTable[] = [
  { table: "departments", group: "Organisation", label: "Departments", dated: false },
  { table: "reqgen_roles", group: "Organisation", label: "Roles", dated: false },
  { table: "profiles", group: "People", label: "User accounts (profiles)", dated: false },
  { table: "profile_roles", group: "People", label: "User roles", dated: false },
  { table: "user_active_roles", group: "People", label: "Active roles", dated: false },
  { table: "hr_officer_assignments", group: "People", label: "HR officer assignments", dated: false },
  { table: "subheads", group: "Budget", label: "Subheads and balances", dated: false },
  { table: "iet_accounts", group: "Banking", label: "IET bank accounts and balances", dated: false },
  { table: "iet_account_officers", group: "Banking", label: "Account officers", dated: false },
  { table: "iet_account_officer_assignments", group: "Banking", label: "Account officer assignments", dated: false },
  { table: "account_officer_accounts", group: "Banking", label: "Officer-account links", dated: false },
  { table: "department_account_routing", group: "Banking", label: "Department account routing", dated: false },
  { table: "payment_voucher_counter_signatories", group: "Payment vouchers", label: "PV signatories (PV Settings)", dated: false },
  { table: "reqgen_route_templates", group: "Workflow", label: "Route templates", dated: false },
  { table: "reqgen_route_steps", group: "Workflow", label: "Route steps", dated: false },
  { table: "reqgen_department_routes", group: "Workflow", label: "Department routes", dated: false },
  { table: "reqgen_stage_backups", group: "Workflow", label: "Stage backups", dated: false },
  { table: "reqgen_officer_availability", group: "Workflow", label: "Officer availability", dated: false },
  { table: "app_settings", group: "Organisation", label: "App settings", dated: false },
  { table: "requests", group: "Requests", label: "Requests", dated: true },
  { table: "request_history", group: "Requests", label: "Approvals and signatures (request history)", dated: true },
  { table: "request_attachments", group: "Requests", label: "Attachment records", dated: true },
  { table: "request_attachment_checks", group: "Requests", label: "Attachment checks", dated: true },
  { table: "payment_vouchers", group: "Payment vouchers", label: "Payment vouchers (signed, counter-signed, authorised)", dated: true },
  { table: "payment_voucher_items", group: "Payment vouchers", label: "Voucher items", dated: true },
  { table: "payment_voucher_history", group: "Payment vouchers", label: "Voucher history and reminders", dated: true },
  { table: "finance_transactions", group: "Finance", label: "Expenditure transactions", dated: true },
  { table: "iet_bank_ledger", group: "Finance", label: "Bank ledger", dated: true },
  { table: "finance_activity_history", group: "Finance", label: "Finance activity", dated: true },
  { table: "registry_correspondence", group: "Registry", label: "Registry correspondence", dated: true },
  { table: "hr_assignment_history", group: "People", label: "HR assignment history", dated: true },
  { table: "user_role_switch_history", group: "Audit", label: "Role switches", dated: true },
  { table: "audit_logs", group: "Audit", label: "Audit log (user activity)", dated: true },
  // v4.1 – v4.5 tables
  { table: "reqgen_financial_years", group: "Budget", label: "Financial years (open, locked, closed)", dated: false },
  { table: "reqgen_finance_settings", group: "Finance", label: "Finance settings", dated: false },
  { table: "reqgen_finance_settings_log", group: "Finance", label: "Finance settings changes", dated: true },
  { table: "reqgen_transfers", group: "Finance", label: "Transfers between accounts and subheads", dated: true },
  { table: "reqgen_request_budget_lines", group: "Requests", label: "Budget lines on request letters", dated: true },
  { table: "reqgen_request_drafts", group: "Requests", label: "Saved drafts", dated: true },
  { table: "reqgen_payee_bank_accounts", group: "Payment vouchers", label: "Payee bank details", dated: false },
  { table: "reqgen_pv_transfer_schedule", group: "Payment vouchers", label: "Transfer schedules", dated: true },
  { table: "reqgen_pv_attachments", group: "Payment vouchers", label: "Manual voucher attachments (records)", dated: true },
  { table: "reqgen_print_log", group: "Reports", label: "Print register", dated: false },
  { table: "reqgen_compliance_runs", group: "Reports", label: "Compliance runs", dated: false },
  { table: "reqgen_registry_archive", group: "Registry", label: "Archive (retention and shelf)", dated: false },
  { table: "reqgen_reminder_log", group: "Registry", label: "Reminders", dated: true },
  { table: "reqgen_reconciliations", group: "Audit", label: "Bank reconciliations", dated: false },
  { table: "reqgen_audit_log", group: "Audit", label: "Audit log (v4, append-only)", dated: false },
];

export const BACKUP_FORMAT = "reqgen-master-backup";
export const BACKUP_VERSION = 1;
