export type RouteRegistryItem = { pattern: string; title: string; rootHref: string | null; category: string; public: boolean; nav: boolean; searchable: boolean; description: string; };
export type RootNavigationItem = { href: string; label: string; iconKey: string; };

export const ROOT_NAVIGATION: RootNavigationItem[] = [
  { href: "/dashboard", label: "DASHBOARD", iconKey: "dashboard" },
  { href: "/requests", label: "REQUESTS", iconKey: "requests" },
  { href: "/approvals", label: "APPROVALS", iconKey: "approvals" },
  { href: "/finance", label: "FINANCE", iconKey: "finance" },
  { href: "/payment-vouchers", label: "PAYMENT VOUCHERS", iconKey: "voucher" },
  { href: "/registry", label: "REGISTRY", iconKey: "registry" },
  { href: "/reports", label: "REPORTS", iconKey: "reports" },
  { href: "/audit-centre", label: "AUDIT", iconKey: "audit" },
  { href: "/admin", label: "ADMIN", iconKey: "admin" },
  { href: "/profile", label: "PROFILE", iconKey: "profile" },
];

export const ROUTE_REGISTRY: RouteRegistryItem[] = [
  {
    "pattern": "/about",
    "title": "About",
    "rootHref": "/about",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /about"
  },
  {
    "pattern": "/admin/access-audit",
    "title": "Admin - Access Audit",
    "rootHref": "/admin",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /admin/access-audit"
  },
  {
    "pattern": "/admin/account-routing",
    "title": "Admin - Account Routing",
    "rootHref": "/admin",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /admin/account-routing"
  },
  {
    "pattern": "/admin/audit",
    "title": "Admin - Audit",
    "rootHref": "/admin",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /admin/audit"
  },
  {
    "pattern": "/admin/departments",
    "title": "Admin - Departments",
    "rootHref": "/admin",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /admin/departments"
  },
  {
    "pattern": "/admin",
    "title": "Admin",
    "rootHref": "/admin",
    "category": "Application Route",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "ReqGen route /admin"
  },
  {
    "pattern": "/admin/release-readiness",
    "title": "Admin - Release Readiness",
    "rootHref": "/admin",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /admin/release-readiness"
  },
  {
    "pattern": "/admin/roles",
    "title": "Admin - Roles",
    "rootHref": "/admin",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /admin/roles"
  },
  {
    "pattern": "/admin/security",
    "title": "Admin - Security",
    "rootHref": "/admin",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /admin/security"
  },
  {
    "pattern": "/admin/settings",
    "title": "Admin - Settings",
    "rootHref": "/admin",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /admin/settings"
  },
  {
    "pattern": "/admin/system-health",
    "title": "Admin - System Health",
    "rootHref": "/admin",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /admin/system-health"
  },
  {
    "pattern": "/admin/users",
    "title": "Admin - Users",
    "rootHref": "/admin",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /admin/users"
  },
  {
    "pattern": "/admin/workflow-test",
    "title": "Admin - Workflow Test",
    "rootHref": "/admin",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /admin/workflow-test"
  },
  {
    "pattern": "/approvals/action-centre",
    "title": "Approvals - Action Centre",
    "rootHref": "/approvals",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /approvals/action-centre"
  },
  {
    "pattern": "/approvals",
    "title": "Approvals",
    "rootHref": "/approvals",
    "category": "Application Route",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "ReqGen route /approvals"
  },
  {
    "pattern": "/audit-centre",
    "title": "Audit Centre",
    "rootHref": "/audit-centre",
    "category": "Application Route",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "ReqGen route /audit-centre"
  },
  {
    "pattern": "/change-password",
    "title": "Change Password",
    "rootHref": "/change-password",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /change-password"
  },
  {
    "pattern": "/dashboard/activity",
    "title": "Dashboard - Activity",
    "rootHref": "/dashboard",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /dashboard/activity"
  },
  {
    "pattern": "/dashboard",
    "title": "Dashboard",
    "rootHref": "/dashboard",
    "category": "Application Route",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "ReqGen route /dashboard"
  },
  {
    "pattern": "/docs",
    "title": "Docs",
    "rootHref": "/docs",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /docs"
  },










  {
    "pattern": "/finance/account-ledger",
    "title": "Finance - Account Ledger",
    "rootHref": "/finance",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /finance/account-ledger"
  },
  {
    "pattern": "/finance/account-transfers",
    "title": "Finance - Account Transfers",
    "rootHref": "/finance",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /finance/account-transfers"
  },
  {
    "pattern": "/finance/accounts",
    "title": "Finance - Accounts",
    "rootHref": "/finance",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /finance/accounts"
  },
  {
    "pattern": "/finance/activity-history",
    "title": "Finance - Activity History",
    "rootHref": "/finance",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /finance/activity-history"
  },
  {
    "pattern": "/finance/assign-account",
    "title": "Finance - Assign Account",
    "rootHref": "/finance",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /finance/assign-account"
  },
  {
    "pattern": "/finance/audit",
    "title": "Finance - Audit",
    "rootHref": "/finance",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /finance/audit"
  },
  {
    "pattern": "/finance/audit-trail",
    "title": "Finance - Audit Trail",
    "rootHref": "/finance",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /finance/audit-trail"
  },
  {
    "pattern": "/finance/departments",
    "title": "Finance - Departments",
    "rootHref": "/finance",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /finance/departments"
  },
  {
    "pattern": "/finance/export-centre",
    "title": "Finance - Export Centre",
    "rootHref": "/finance",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /finance/export-centre"
  },
  {
    "pattern": "/finance/manage-accounts/assign",
    "title": "Finance - Manage Accounts - Assign",
    "rootHref": "/finance",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /finance/manage-accounts/assign"
  },
  {
    "pattern": "/finance/manage-accounts",
    "title": "Finance - Manage Accounts",
    "rootHref": "/finance",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /finance/manage-accounts"
  },
  {
    "pattern": "/payment-vouchers/manual",
    "title": "Create Manual Payment Voucher",
    "rootHref": "/payment-vouchers",
    "category": "Application Route",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "Create and manage controlled manual payment vouchers"
  },
  {
    "pattern": "/finance/manual-voucher",
    "title": "Legacy Manual Voucher Redirect",
    "rootHref": "/payment-vouchers",
    "category": "Compatibility Redirect",
    "public": false,
    "nav": false,
    "searchable": false,
    "description": "Compatibility redirect to /payment-vouchers/manual"
  },
  {
    "pattern": "/finance",
    "title": "Finance",
    "rootHref": "/finance",
    "category": "Application Route",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "ReqGen route /finance"
  },
  {
    "pattern": "/finance/print-centre",
    "title": "Finance - Print Centre",
    "rootHref": "/finance",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /finance/print-centre"
  },
  {
    "pattern": "/finance/processing",
    "title": "Finance - Processing",
    "rootHref": "/finance",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /finance/processing"
  },
  {
    "pattern": "/finance/reports/annual",
    "title": "Finance - Reports - Annual",
    "rootHref": "/finance",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /finance/reports/annual"
  },
  {
    "pattern": "/finance/reports/monthly",
    "title": "Finance - Reports - Monthly",
    "rootHref": "/finance",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /finance/reports/monthly"
  },
  {
    "pattern": "/finance/reports",
    "title": "Finance - Reports",
    "rootHref": "/finance",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /finance/reports"
  },
  {
    "pattern": "/finance/reports/print",
    "title": "Finance - Reports - Print",
    "rootHref": "/finance",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /finance/reports/print"
  },
  {
    "pattern": "/finance/request/[id]",
    "title": "Finance - Request - Detail",
    "rootHref": "/finance",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /finance/request/[id]"
  },
  {
    "pattern": "/finance/settings",
    "title": "Finance - Settings",
    "rootHref": "/finance",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /finance/settings"
  },
  {
    "pattern": "/finance/subhead-ledger",
    "title": "Finance - Subhead Ledger",
    "rootHref": "/finance",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /finance/subhead-ledger"
  },
  {
    "pattern": "/finance/subheads",
    "title": "Finance - Subheads",
    "rootHref": "/finance",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /finance/subheads"
  },
  {
    "pattern": "/finance/transactions",
    "title": "Finance - Transactions",
    "rootHref": "/finance",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /finance/transactions"
  },
  {
    "pattern": "/finance/vouchers",
    "title": "Finance - Vouchers",
    "rootHref": "/finance",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /finance/vouchers"
  },
  {
    "pattern": "/forgot-password",
    "title": "Forgot Password",
    "rootHref": "/forgot-password",
    "category": "Application Route",
    "public": true,
    "nav": false,
    "searchable": false,
    "description": "ReqGen route /forgot-password"
  },
  {
    "pattern": "/login",
    "title": "Login",
    "rootHref": "/login",
    "category": "Application Route",
    "public": true,
    "nav": false,
    "searchable": false,
    "description": "ReqGen route /login"
  },
  {
    "pattern": "/mfa",
    "title": "Mfa",
    "rootHref": "/mfa",
    "category": "Application Route",
    "public": true,
    "nav": false,
    "searchable": false,
    "description": "ReqGen route /mfa"
  },
  {
    "pattern": "/mfa/setup",
    "title": "Mfa - Setup",
    "rootHref": "/mfa",
    "category": "Application Route",
    "public": true,
    "nav": false,
    "searchable": false,
    "description": "ReqGen route /mfa/setup"
  },
  {
    "pattern": "/output",
    "title": "Output",
    "rootHref": "/output",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": false,
    "description": "ReqGen route /output"
  },
  {
    "pattern": "/",
    "title": "Home",
    "rootHref": null,
    "category": "Application Route",
    "public": true,
    "nav": false,
    "searchable": false,
    "description": "ReqGen route /"
  },
  {
    "pattern": "/payment-vouchers/[id]",
    "title": "Payment Vouchers - Detail",
    "rootHref": "/payment-vouchers",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /payment-vouchers/[id]"
  },
  {
    "pattern": "/payment-vouchers/[id]/print",
    "title": "Payment Vouchers - Detail - Print",
    "rootHref": "/payment-vouchers",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /payment-vouchers/[id]/print"
  },
  {
    "pattern": "/payment-vouchers/approved",
    "title": "Payment Vouchers - Approved",
    "rootHref": "/payment-vouchers",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /payment-vouchers/approved"
  },
  {
    "pattern": "/payment-vouchers/history",
    "title": "Payment Vouchers - History",
    "rootHref": "/payment-vouchers",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /payment-vouchers/history"
  },
  {
    "pattern": "/payment-vouchers/new",
    "title": "Payment Vouchers - New",
    "rootHref": "/payment-vouchers",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /payment-vouchers/new"
  },
  {
    "pattern": "/workflow",
    "title": "Workflow (legacy redirect)",
    "rootHref": "/workflow",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": false,
    "description": "Legacy redirect only — sends old /workflow links to Audit Centre. Not a standalone module."
  },
  {
    "pattern": "/payment-vouchers",
    "title": "Payment Vouchers",
    "rootHref": "/payment-vouchers",
    "category": "Application Route",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "ReqGen route /payment-vouchers"
  },
  {
    "pattern": "/payment-vouchers/pending",
    "title": "Payment Vouchers - Pending",
    "rootHref": "/payment-vouchers",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /payment-vouchers/pending"
  },
  {
    "pattern": "/payment-vouchers/print-centre",
    "title": "Payment Vouchers - Print Centre",
    "rootHref": "/payment-vouchers",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /payment-vouchers/print-centre"
  },
  {
    "pattern": "/payment-vouchers/reports",
    "title": "Payment Vouchers - Reports",
    "rootHref": "/payment-vouchers",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /payment-vouchers/reports"
  },
  {
    "pattern": "/payment-vouchers/settings",
    "title": "Payment Vouchers - Settings",
    "rootHref": "/payment-vouchers",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /payment-vouchers/settings"
  },
  {
    "pattern": "/profile/access",
    "title": "Profile - Access",
    "rootHref": "/profile",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /profile/access"
  },
  {
    "pattern": "/profile/activity",
    "title": "Profile - Activity",
    "rootHref": "/profile",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /profile/activity"
  },
  {
    "pattern": "/profile",
    "title": "Profile",
    "rootHref": "/profile",
    "category": "Application Route",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "ReqGen route /profile"
  },
  {
    "pattern": "/profile/security",
    "title": "Profile - Security",
    "rootHref": "/profile",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /profile/security"
  },
  {
    "pattern": "/profile/security/replace-authenticator",
    "title": "Profile - Security - Replace Authenticator",
    "rootHref": "/profile",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /profile/security/replace-authenticator"
  },
  {
    "pattern": "/registry/archive",
    "title": "Registry - Archive",
    "rootHref": "/registry",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /registry/archive"
  },
  {
    "pattern": "/registry/dispatch",
    "title": "Registry - Dispatch",
    "rootHref": "/registry",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /registry/dispatch"
  },
  {
    "pattern": "/registry/incoming",
    "title": "Registry - Incoming",
    "rootHref": "/registry",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /registry/incoming"
  },
  {
    "pattern": "/registry/operations",
    "title": "Registry - Operations",
    "rootHref": "/registry",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /registry/operations"
  },
  {
    "pattern": "/registry/outgoing",
    "title": "Registry - Outgoing",
    "rootHref": "/registry",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /registry/outgoing"
  },
  {
    "pattern": "/registry",
    "title": "Registry",
    "rootHref": "/registry",
    "category": "Application Route",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "ReqGen route /registry"
  },
  {
    "pattern": "/reports/enterprise-analytics",
    "title": "Reports - Enterprise Analytics",
    "rootHref": "/reports",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /reports/enterprise-analytics"
  },
  {
    "pattern": "/reports",
    "title": "Reports",
    "rootHref": "/reports",
    "category": "Application Route",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "ReqGen route /reports"
  },
  {
    "pattern": "/requests/[id]/edit",
    "title": "Requests - Detail - Edit",
    "rootHref": "/requests",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /requests/[id]/edit"
  },
  {
    "pattern": "/requests/[id]",
    "title": "Requests - Detail",
    "rootHref": "/requests",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /requests/[id]"
  },
  {
    "pattern": "/requests/[id]/print",
    "title": "Requests - Detail - Print",
    "rootHref": "/requests",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /requests/[id]/print"
  },
  {
    "pattern": "/requests/new",
    "title": "Requests - New",
    "rootHref": "/requests",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": true,
    "description": "ReqGen route /requests/new"
  },
  {
    "pattern": "/requests",
    "title": "Requests",
    "rootHref": "/requests",
    "category": "Application Route",
    "public": false,
    "nav": true,
    "searchable": true,
    "description": "ReqGen route /requests"
  },
  {
    "pattern": "/reset-password",
    "title": "Reset Password",
    "rootHref": "/reset-password",
    "category": "Application Route",
    "public": true,
    "nav": false,
    "searchable": false,
    "description": "ReqGen route /reset-password"
  },
  {
    "pattern": "/signup",
    "title": "Signup",
    "rootHref": "/signup",
    "category": "Application Route",
    "public": true,
    "nav": false,
    "searchable": false,
    "description": "ReqGen route /signup"
  },
  {
    "pattern": "/test-supabase",
    "title": "Test Supabase",
    "rootHref": "/test-supabase",
    "category": "Application Route",
    "public": false,
    "nav": false,
    "searchable": false,
    "description": "ReqGen route /test-supabase"
  },
  {
    "pattern": "/unauthorized",
    "title": "Unauthorized",
    "rootHref": "/unauthorized",
    "category": "Application Route",
    "public": true,
    "nav": false,
    "searchable": false,
    "description": "ReqGen route /unauthorized"
  },
];

function normalizePathname(pathname: string): string {
  const clean = (pathname || "/").split("?")[0].split("#")[0] || "/";
  if (clean === "/") return clean;
  return clean.endsWith("/") ? clean.slice(0, -1) : clean;
}

function routePatternMatches(pattern: string, pathname: string): boolean {
  const patternSegments = normalizePathname(pattern).split("/").filter(Boolean);
  const pathSegments = normalizePathname(pathname).split("/").filter(Boolean);
  if (patternSegments.length !== pathSegments.length) return false;

  return patternSegments.every((segment, index) => {
    if (segment.startsWith("[") && segment.endsWith("]")) return Boolean(pathSegments[index]);
    return segment === pathSegments[index];
  });
}

export function getRouteRegistryItem(pathname: string): RouteRegistryItem | undefined {
  const normalized = normalizePathname(pathname);

  const exact = ROUTE_REGISTRY.find((route) => normalizePathname(route.pattern) === normalized);
  if (exact) return exact;

  return ROUTE_REGISTRY.find((route) => routePatternMatches(route.pattern, normalized));
}

