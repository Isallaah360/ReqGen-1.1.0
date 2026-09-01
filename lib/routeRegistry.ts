export type RouteRegistryItem = {
  pattern: string;
  title: string;
  rootHref: string | null;
  category: string;
  public: boolean;
  nav: boolean;
  searchable: boolean;
  description: string;
};

export type RootNavigationItem = { href: string; label: string; iconKey: string; };

export const ROOT_NAVIGATION: RootNavigationItem[] = [
  {
    "href": "/dashboard",
    "label": "DASHBOARD",
    "iconKey": "dashboard"
  },
  {
    "href": "/requests",
    "label": "REQUESTS",
    "iconKey": "requests"
  },
  {
    "href": "/approvals",
    "label": "APPROVALS",
    "iconKey": "approvals"
  },
  {
    "href": "/finance",
    "label": "FINANCE",
    "iconKey": "finance"
  },
  {
    "href": "/payment-vouchers",
    "label": "PAYMENT VOUCHERS",
    "iconKey": "voucher"
  },
  {
    "href": "/registry",
    "label": "REGISTRY",
    "iconKey": "registry"
  },
  {
    "href": "/reports",
    "label": "REPORTS",
    "iconKey": "reports"
  },
  {
    "href": "/audit-centre",
    "label": "AUDIT",
    "iconKey": "audit"
  },
  {
    "href": "/workflow",
    "label": "WORKFLOW",
    "iconKey": "workflow"
  },
  {
    "href": "/executive",
    "label": "COMMAND CENTRE",
    "iconKey": "command"
  },
  {
    "href": "/admin",
    "label": "ADMIN",
    "iconKey": "admin"
  },
  {
    "href": "/profile",
    "label": "PROFILE",
    "iconKey": "profile"
  }
];

export const ROUTE_REGISTRY: RouteRegistryItem[] = [
  {
    "pattern": "/admin/account-routing",
    "title": "Account Routing",
    "rootHref": "/admin",
    "category": "Settings / Configuration",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Department Account Routing"
  },
  {
    "pattern": "/admin/departments",
    "title": "Department Routing",
    "rootHref": "/admin",
    "category": "Settings / Configuration",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Departments"
  },
  {
    "pattern": "/admin",
    "title": "Admin Overview",
    "rootHref": "/admin",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Admin Overview"
  },
  {
    "pattern": "/admin/roles",
    "title": "Roles & Permissions",
    "rootHref": "/admin",
    "category": "Operational Workspace",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Roles & Permissions"
  },
  {
    "pattern": "/admin/security",
    "title": "Security Centre",
    "rootHref": "/admin",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Security Centre"
  },
  {
    "pattern": "/admin/settings",
    "title": "Routing Settings",
    "rootHref": "/admin",
    "category": "Settings / Configuration",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "System Settings"
  },
  {
    "pattern": "/admin/users",
    "title": "Users & Roles",
    "rootHref": "/admin",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "User Management"
  },
  {
    "pattern": "/approvals/action-centre",
    "title": "Action Centre",
    "rootHref": "/approvals",
    "category": "ITTT / Workflow Control",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Action Centre"
  },
  {
    "pattern": "/approvals",
    "title": "Approvals",
    "rootHref": "/approvals",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Approvals"
  },
  {
    "pattern": "/audit-centre",
    "title": "Audit",
    "rootHref": "/audit-centre",
    "category": "Audit / Governance",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Audit"
  },
  {
    "pattern": "/change-password",
    "title": "Change Password",
    "rootHref": "/profile",
    "category": "Form",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "Change Password"
  },
  {
    "pattern": "/dashboard/activity",
    "title": "Activity",
    "rootHref": "/dashboard",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Activity"
  },
  {
    "pattern": "/dashboard",
    "title": "Dashboard",
    "rootHref": "/dashboard",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Dashboard"
  },
  {
    "pattern": "/executive/analytics",
    "title": "Analytics",
    "rootHref": "/executive",
    "category": "Report / Analytics",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Analytics"
  },
  {
    "pattern": "/executive/audit",
    "title": "Audit",
    "rootHref": "/executive",
    "category": "Audit / Governance",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Audit"
  },
  {
    "pattern": "/executive/calendar",
    "title": "Calendar",
    "rootHref": "/executive",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Calendar"
  },
  {
    "pattern": "/executive/finance",
    "title": "Finance",
    "rootHref": "/executive",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Finance"
  },
  {
    "pattern": "/executive/meetings",
    "title": "Meetings",
    "rootHref": "/executive",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Meetings"
  },
  {
    "pattern": "/executive/notifications",
    "title": "Notifications",
    "rootHref": "/executive",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Notifications"
  },
  {
    "pattern": "/executive",
    "title": "Command Centre",
    "rootHref": "/executive",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Command Centre"
  },
  {
    "pattern": "/executive/registry",
    "title": "Registry",
    "rootHref": "/executive",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Registry"
  },
  {
    "pattern": "/executive/reports",
    "title": "Reports",
    "rootHref": "/executive",
    "category": "Report / Analytics",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Reports"
  },
  {
    "pattern": "/executive/requests",
    "title": "Requests",
    "rootHref": "/executive",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Requests"
  },
  {
    "pattern": "/finance/account-ledger",
    "title": "Account Ledger",
    "rootHref": "/finance",
    "category": "Register / Ledger",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Account Ledger"
  },
  {
    "pattern": "/finance/account-transfers",
    "title": "Account Transfers",
    "rootHref": "/finance",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Account Transfers"
  },
  {
    "pattern": "/finance/accounts",
    "title": "Accounts Setup (Legacy)",
    "rootHref": "/finance",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Accounts Setup (Legacy)"
  },
  {
    "pattern": "/finance/activity-history",
    "title": "Finance Activity History",
    "rootHref": "/finance",
    "category": "Register / Ledger",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Finance Activity History"
  },
  {
    "pattern": "/finance/assign-account",
    "title": "Account Assignment",
    "rootHref": "/finance",
    "category": "Sub-form / Transaction Form",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Account Assignment (Legacy)"
  },
  {
    "pattern": "/finance/audit",
    "title": "Finance Audit",
    "rootHref": "/finance",
    "category": "Audit / Governance",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Finance Audit"
  },
  {
    "pattern": "/finance/audit-trail",
    "title": "Finance Audit Trail",
    "rootHref": "/finance",
    "category": "Audit / Governance",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Finance Audit Trail"
  },
  {
    "pattern": "/finance/departments",
    "title": "Finance Departments",
    "rootHref": "/finance",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Finance Departments"
  },
  {
    "pattern": "/finance/export-centre",
    "title": "Finance Export Centre",
    "rootHref": "/finance",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Finance Export Centre"
  },
  {
    "pattern": "/finance/manage-accounts/assign",
    "title": "Assign Bank to Officer",
    "rootHref": "/finance",
    "category": "Sub-form / Transaction Form",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Assign Bank to Officer"
  },
  {
    "pattern": "/finance/manage-accounts",
    "title": "IET Bank Accounts",
    "rootHref": "/finance",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "IET Bank Accounts"
  },
  {
    "pattern": "/finance/manual-voucher",
    "title": "Manual Voucher",
    "rootHref": "/finance",
    "category": "Sub-form / Transaction Form",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Manual Voucher"
  },
  {
    "pattern": "/finance",
    "title": "Finance",
    "rootHref": "/finance",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Finance"
  },
  {
    "pattern": "/finance/print-centre",
    "title": "Finance Print Centre",
    "rootHref": "/finance",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Finance Print Centre"
  },
  {
    "pattern": "/finance/reports/annual",
    "title": "Annual Reports",
    "rootHref": "/finance",
    "category": "Report / Analytics",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Annual Finance Reports"
  },
  {
    "pattern": "/finance/reports/monthly",
    "title": "Monthly Reports",
    "rootHref": "/finance",
    "category": "Report / Analytics",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Monthly Finance Reports"
  },
  {
    "pattern": "/finance/reports",
    "title": "Finance Reports",
    "rootHref": "/finance",
    "category": "Report / Analytics",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Finance Reports"
  },
  {
    "pattern": "/finance/reports/print",
    "title": "Print Report",
    "rootHref": "/finance",
    "category": "Print View",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Finance Report Print"
  },
  {
    "pattern": "/finance/request/[id]",
    "title": "Finance Request",
    "rootHref": "/finance",
    "category": "Detail Page",
    "public": false,
    "nav": false,
    "searchable": false,
    "description": "Unable to open finance request"
  },
  {
    "pattern": "/finance/settings",
    "title": "Finance Settings",
    "rootHref": "/finance",
    "category": "Settings / Configuration",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Finance Settings"
  },
  {
    "pattern": "/finance/subhead-ledger",
    "title": "Subhead Ledger",
    "rootHref": "/finance",
    "category": "Register / Ledger",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Subhead Ledger"
  },
  {
    "pattern": "/finance/subheads",
    "title": "Finance Subheads",
    "rootHref": "/finance",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Finance Subheads"
  },
  {
    "pattern": "/finance/transactions",
    "title": "Finance Transactions",
    "rootHref": "/finance",
    "category": "Register / Ledger",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Finance Transactions"
  },
  {
    "pattern": "/finance/vouchers",
    "title": "Finance Vouchers",
    "rootHref": "/finance",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Finance Vouchers"
  },
  {
    "pattern": "/forgot-password",
    "title": "Forgot Password",
    "rootHref": null,
    "category": "Form",
    "public": true,
    "nav": false,
    "searchable": true,
    "description": "Forgot Password"
  },
  {
    "pattern": "/login",
    "title": "Login",
    "rootHref": null,
    "category": "Form",
    "public": true,
    "nav": false,
    "searchable": true,
    "description": "Login"
  },
  {
    "pattern": "/mfa",
    "title": "Mfa",
    "rootHref": null,
    "category": "Page / Dashboard",
    "public": true,
    "nav": false,
    "searchable": true,
    "description": "Mfa"
  },
  {
    "pattern": "/mfa/setup",
    "title": "Setup",
    "rootHref": null,
    "category": "Form",
    "public": true,
    "nav": false,
    "searchable": true,
    "description": "Setup"
  },
  {
    "pattern": "/output",
    "title": "Output Centre",
    "rootHref": "/reports",
    "category": "Utility / Information",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Output Centre"
  },
  {
    "pattern": "/",
    "title": "ReqGen",
    "rootHref": null,
    "category": "Utility / Information",
    "public": true,
    "nav": false,
    "searchable": false,
    "description": "ReqGen"
  },
  {
    "pattern": "/payment-vouchers/[id]",
    "title": "Payment Voucher Details",
    "rootHref": "/payment-vouchers",
    "category": "Detail Page",
    "public": false,
    "nav": false,
    "searchable": false,
    "description": "Payment Voucher Details"
  },
  {
    "pattern": "/payment-vouchers/[id]/print",
    "title": "Voucher Print",
    "rootHref": "/payment-vouchers",
    "category": "Print View",
    "public": false,
    "nav": false,
    "searchable": false,
    "description": "Payment Voucher Print View"
  },
  {
    "pattern": "/payment-vouchers/approved",
    "title": "Approved",
    "rootHref": "/payment-vouchers",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Approved"
  },
  {
    "pattern": "/payment-vouchers/history",
    "title": "History",
    "rootHref": "/payment-vouchers",
    "category": "Register / Ledger",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "History"
  },
  {
    "pattern": "/payment-vouchers/new",
    "title": "Create Voucher",
    "rootHref": "/payment-vouchers",
    "category": "Sub-form / Transaction Form",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "New"
  },
  {
    "pattern": "/payment-vouchers",
    "title": "Payment Vouchers",
    "rootHref": "/payment-vouchers",
    "category": "Operational Workspace",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Payment Vouchers"
  },
  {
    "pattern": "/payment-vouchers/pending",
    "title": "Pending",
    "rootHref": "/payment-vouchers",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Pending"
  },
  {
    "pattern": "/payment-vouchers/print-centre",
    "title": "Print Centre",
    "rootHref": "/payment-vouchers",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Print Centre"
  },
  {
    "pattern": "/payment-vouchers/reports",
    "title": "Voucher Reports",
    "rootHref": "/payment-vouchers",
    "category": "Redirect / Alias",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Voucher Reports"
  },
  {
    "pattern": "/payment-vouchers/settings",
    "title": "Payment Voucher Settings",
    "rootHref": "/payment-vouchers",
    "category": "Settings / Configuration",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Payment Voucher Settings"
  },
  {
    "pattern": "/profile/access",
    "title": "Access",
    "rootHref": "/profile",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "My Access"
  },
  {
    "pattern": "/profile/activity",
    "title": "Activity",
    "rootHref": "/profile",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "My Activity"
  },
  {
    "pattern": "/profile",
    "title": "Profile",
    "rootHref": "/profile",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Profile"
  },
  {
    "pattern": "/profile/security",
    "title": "Security",
    "rootHref": "/profile",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Profile Security"
  },
  {
    "pattern": "/registry/archive",
    "title": "Archive",
    "rootHref": "/registry",
    "category": "Register / Ledger",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Registry Archive Register"
  },
  {
    "pattern": "/registry/dispatch",
    "title": "Dispatch",
    "rootHref": "/registry",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Dispatch & Collection Register"
  },
  {
    "pattern": "/registry/incoming",
    "title": "Incoming Register",
    "rootHref": "/registry",
    "category": "Register / Ledger",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Incoming Register"
  },
  {
    "pattern": "/registry/operations",
    "title": "Registry Operations",
    "rootHref": "/registry",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Registry Operations"
  },
  {
    "pattern": "/registry/outgoing",
    "title": "Outgoing Register",
    "rootHref": "/registry",
    "category": "Register / Ledger",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Outgoing Register"
  },
  {
    "pattern": "/registry",
    "title": "Registry",
    "rootHref": "/registry",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Registry"
  },
  {
    "pattern": "/reports/enterprise-analytics",
    "title": "Analytics",
    "rootHref": "/reports",
    "category": "Report / Analytics",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Analytics Centre"
  },
  {
    "pattern": "/reports",
    "title": "Reports",
    "rootHref": "/reports",
    "category": "Report / Analytics",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Reports"
  },
  {
    "pattern": "/requests/[id]/edit",
    "title": "Edit Request",
    "rootHref": "/requests",
    "category": "Sub-form / Transaction Form",
    "public": false,
    "nav": false,
    "searchable": false,
    "description": "Edit Request"
  },
  {
    "pattern": "/requests/[id]",
    "title": "Details",
    "rootHref": "/requests",
    "category": "Detail Page",
    "public": false,
    "nav": false,
    "searchable": false,
    "description": "{isPersonalFund ? \"HR Funding Recommendation\" : \"Budget Subhead Assignment\"}"
  },
  {
    "pattern": "/requests/[id]/print",
    "title": "Request Print",
    "rootHref": "/requests",
    "category": "Print View",
    "public": false,
    "nav": false,
    "searchable": false,
    "description": "Request Print"
  },
  {
    "pattern": "/requests/new",
    "title": "Create Request",
    "rootHref": "/requests",
    "category": "Sub-form / Transaction Form",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Create Request"
  },
  {
    "pattern": "/requests",
    "title": "Requests",
    "rootHref": "/requests",
    "category": "Page / Dashboard",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Requests"
  },
  {
    "pattern": "/reset-password",
    "title": "Reset Password",
    "rootHref": null,
    "category": "Form",
    "public": true,
    "nav": false,
    "searchable": true,
    "description": "Reset Password"
  },
  {
    "pattern": "/signup",
    "title": "Signup",
    "rootHref": null,
    "category": "Form",
    "public": true,
    "nav": false,
    "searchable": true,
    "description": "Signup"
  },
  {
    "pattern": "/unauthorized",
    "title": "Access Restricted",
    "rootHref": null,
    "category": "Utility / Information",
    "public": true,
    "nav": false,
    "searchable": true,
    "description": "Access Restricted"
  },
  {
    "pattern": "/workflow",
    "title": "Workflow",
    "rootHref": "/workflow",
    "category": "ITTT / Workflow Control",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Workflow"
  }
];


function normalisePath(pathname: string) {
  if (!pathname) return "/";
  const clean = pathname.split("?")[0].split("#")[0] || "/";
  return clean.length > 1 ? clean.replace(/\/+$/, "") : clean;
}

function matchesPattern(pathname: string, pattern: string) {
  const p = normalisePath(pathname).split("/").filter(Boolean);
  const q = normalisePath(pattern).split("/").filter(Boolean);
  if (p.length !== q.length) return false;
  return q.every((segment, i) => segment.startsWith("[") && segment.endsWith("]") ? Boolean(p[i]) : segment === p[i]);
}

export function getRouteRegistryItem(pathname: string): RouteRegistryItem | null {
  const exact = ROUTE_REGISTRY.find((item) => item.pattern === normalisePath(pathname));
  if (exact) return exact;
  return ROUTE_REGISTRY.find((item) => item.pattern.includes("[") && matchesPattern(pathname, item.pattern)) || null;
}

export function getRootChildren(rootHref: string) {
  return ROUTE_REGISTRY.filter((item) => item.rootHref === rootHref && item.nav && item.pattern !== rootHref)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getSearchableRoutes() {
  return ROUTE_REGISTRY.filter((item) => item.searchable);
}
