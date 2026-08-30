import type { RouteRegistryItem } from "@/lib/routeRegistry";

export type RMBPageClass = "Root Page / Dashboard" | "Operational Workspace" | "Register / Ledger" | "Form" | "Sub-form / Transaction Form" | "Detail Page" | "ITTT / Workflow Control" | "Settings / Configuration" | "Audit / Governance" | "Report / Analytics" | "Print View" | "Utility / Information" | "Redirect / Alias";
export type RMBDesignStatus = "MOCKUP LOCKED" | "UNIQUE MOCKUP REQUIRED" | "CANONICAL TEMPLATE REQUIRED" | "CONSOLIDATE / REDIRECT" | "RETIRE / REDIRECT";
export type RMBTemplate = "DashboardShell" | "WorkspaceShell" | "RegisterShell" | "FormShell" | "TransactionFormShell" | "DetailShell" | "ITTTWorkflowShell" | "SettingsShell" | "AuditShell" | "ReportShell" | "PrintShell" | "UtilityShell" | "RedirectOnly";

const LOCKED_ROUTES = new Set<string>([
  "/admin",
  "/admin/access-audit",
  "/admin/account-routing",
  "/admin/audit",
  "/admin/departments",
  "/admin/release-readiness",
  "/admin/roles",
  "/admin/security",
  "/admin/settings",
  "/admin/system-health",
  "/admin/users",
  "/admin/workflow-test",
  "/approvals",
  "/approvals/action-centre",
  "/audit-centre",
  "/dashboard",
  "/finance",
  "/finance/account-ledger",
  "/finance/account-transfers",
  "/finance/departments",
  "/finance/manage-accounts",
  "/finance/manage-accounts/assign",
  "/finance/manual-voucher",
  "/finance/reports",
  "/finance/reports/monthly",
  "/finance/subhead-ledger",
  "/finance/subheads",
  "/finance/transactions",
  "/finance/vouchers",
  "/hr",
  "/hr/analytics",
  "/hr/archive",
  "/hr/assessments/annual-360",
  "/hr/assignments",
  "/hr/audit",
  "/hr/capacity-building/departments",
  "/hr/capacity-building/staff",
  "/hr/compliance",
  "/hr/department-kpi",
  "/hr/filing",
  "/hr/leave",
  "/hr/my-work",
  "/hr/officer-performance",
  "/hr/output",
  "/hr/registrar",
  "/hr/registrar/analytics",
  "/hr/registrar/assessments/annual-360",
  "/hr/registrar/capacity-building/departments",
  "/hr/registrar/capacity-building/staff",
  "/hr/registrar/compliance",
  "/hr/registrar/department-kpi",
  "/hr/registrar/officer-performance",
  "/hr/registrar/output",
  "/hr/registrar/reports",
  "/hr/registrar/settings",
  "/hr/registrar/weekly-seminar",
  "/hr/reports",
  "/hr/review",
  "/hr/settings",
  "/hr/staff",
  "/hr/weekly-seminar",
  "/payment-vouchers",
  "/payment-vouchers/[id]",
  "/payment-vouchers/[id]/print",
  "/payment-vouchers/reports",
  "/payment-vouchers/settings",
  "/registry",
  "/registry/archive",
  "/registry/dispatch",
  "/registry/incoming",
  "/registry/operations",
  "/registry/outgoing",
  "/reports",
  "/reports/enterprise-analytics",
  "/requests",
  "/requests/new",
  "/staff",
  "/staff/attendance",
  "/staff/downloads",
  "/staff/leave",
  "/staff/leave/new",
  "/staff/notifications",
  "/staff/performance",
  "/staff/profile",
  "/staff/requests",
  "/staff/training",
  "/workflow"
]);
const UNIQUE_MOCKUP_ROUTES = new Set<string>([
  "/executive",
  "/executive/analytics",
  "/executive/audit",
  "/executive/calendar",
  "/executive/finance",
  "/executive/hr",
  "/executive/meetings",
  "/executive/notifications",
  "/executive/registry",
  "/executive/reports",
  "/executive/requests",
  "/finance/activity-history",
  "/finance/audit",
  "/finance/audit-trail",
  "/finance/export-centre",
  "/finance/print-centre",
  "/finance/settings"
]);
const CONSOLIDATE_ROUTES: Record<string,string> = {
  "/finance/accounts": "/finance/manage-accounts",
  "/finance/assign-account": "/finance/manage-accounts/assign"
};
const RETIRE_ROUTES: Record<string,string> = {
  "/test-supabase": "/admin/system-health"
};

const CLASS_MAP: Record<string, RMBPageClass> = {
  "Page / Dashboard": "Root Page / Dashboard",
  "Operational Workspace": "Operational Workspace",
  "Register / Ledger": "Register / Ledger",
  "Form": "Form",
  "Sub-form / Transaction Form": "Sub-form / Transaction Form",
  "Detail Page": "Detail Page",
  "ITTT / Workflow Control": "ITTT / Workflow Control",
  "Settings / Configuration": "Settings / Configuration",
  "Audit / Governance": "Audit / Governance",
  "Report / Analytics": "Report / Analytics",
  "Print View": "Print View",
  "Utility / Information": "Utility / Information",
  "Redirect / Alias": "Redirect / Alias",
};

const TEMPLATE_MAP: Record<RMBPageClass, RMBTemplate> = {
  "Root Page / Dashboard": "DashboardShell",
  "Operational Workspace": "WorkspaceShell",
  "Register / Ledger": "RegisterShell",
  "Form": "FormShell",
  "Sub-form / Transaction Form": "TransactionFormShell",
  "Detail Page": "DetailShell",
  "ITTT / Workflow Control": "ITTTWorkflowShell",
  "Settings / Configuration": "SettingsShell",
  "Audit / Governance": "AuditShell",
  "Report / Analytics": "ReportShell",
  "Print View": "PrintShell",
  "Utility / Information": "UtilityShell",
  "Redirect / Alias": "RedirectOnly",
};

export function getRMBPageArchitecture(item: RouteRegistryItem) {
  const pageClass = CLASS_MAP[item.category] ?? "Operational Workspace";
  let designStatus: RMBDesignStatus = "CANONICAL TEMPLATE REQUIRED";
  let target: string | null = null;
  if (LOCKED_ROUTES.has(item.pattern)) designStatus = "MOCKUP LOCKED";
  else if (RETIRE_ROUTES[item.pattern]) { designStatus = "RETIRE / REDIRECT"; target = RETIRE_ROUTES[item.pattern]; }
  else if (CONSOLIDATE_ROUTES[item.pattern]) { designStatus = "CONSOLIDATE / REDIRECT"; target = CONSOLIDATE_ROUTES[item.pattern]; }
  else if (UNIQUE_MOCKUP_ROUTES.has(item.pattern)) designStatus = "UNIQUE MOCKUP REQUIRED";
  return { pageClass, template: TEMPLATE_MAP[pageClass], designStatus, target };
}

export const RMB_LOCKED_ROUTE_COUNT = LOCKED_ROUTES.size;
export const RMB_UNIQUE_MOCKUP_ROUTE_COUNT = UNIQUE_MOCKUP_ROUTES.size;
