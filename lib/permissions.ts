import { hasAnyRole } from "./roles";

export type RoutePolicy = {
  prefix: string;
  roles?: string[];
  authenticatedOnly?: boolean;
};

export const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/mfa",
  "/mfa/setup",
  "/unauthorized",
];

/**
 * Route rules are ordered from the most specific route to the broadest route.
 * getRoutePolicy also sorts by prefix length as a defensive safeguard.
 */
export const ROUTE_POLICIES: RoutePolicy[] = [
  // v4.6.6: the Developer Console is the Developer system account's own workspace
  { prefix: "/developer", roles: ["developer"] },
  { prefix: "/admin/account-routing", roles: ["admin"] },
  { prefix: "/admin/department-routing", roles: ["admin"] },
  { prefix: "/admin/departments", roles: ["admin"] },
  { prefix: "/admin/settings", roles: ["admin"] },
  { prefix: "/admin/users", roles: ["admin"] },
  { prefix: "/admin/roles", roles: ["admin"] },
  { prefix: "/admin", roles: ["admin"] },

  // v4.5: Finance Reconciliation is done by the Account Officer and checked by the Auditor (mock-up 77)
  { prefix: "/audit-centre/reconciliation", roles: ["admin", "auditor", "account", "accounts", "accountofficer"] },
  { prefix: "/audit-centre", roles: ["admin", "auditor"] },
  { prefix: "/workflow", roles: ["admin", "auditor"] },
  { prefix: "/payment-vouchers/settings", roles: ["admin", "auditor"] },
  // v4.2: the Director General (or the General Secretary acting) approves and stamps transfers
  { prefix: "/finance/account-transfers", roles: ["admin", "auditor", "account", "accounts", "accountofficer", "dg", "directorgeneral", "generalsecretary"] },
  // v4.6.3: integrity and the Transaction Centre are also for the DG's office, who approves reversals
  { prefix: "/finance/integrity", roles: ["admin", "auditor", "account", "accounts", "accountofficer", "dg", "directorgeneral", "generalsecretary"] },
  { prefix: "/finance/transactions-centre", roles: ["admin", "auditor", "account", "accounts", "accountofficer", "dg", "directorgeneral", "generalsecretary"] },

  {
    prefix: "/payment-vouchers",
    roles: [
      "admin",
      "auditor",
      "account",
      "accounts",
      "accountofficer",
      "pvsigner",
      "pvcountersigner",
    ],
  },
  {
    prefix: "/finance",
    roles: [
      "admin",
      "auditor",
      "account",
      "accounts",
      "accountofficer",
    ],
  },
  // v4.5: Request Tracking is shared with Finance and the DG's office (reqgen_registry_tracking decides the same)
  { prefix: "/registry/tracking", roles: ["admin", "auditor", "registry", "registrar", "account", "accounts", "accountofficer", "dg", "directorgeneral", "generalsecretary"] },
  { prefix: "/registry", roles: ["admin", "auditor", "registry", "registrar"] },
  // v4.4 Reports (mock-up 57): every person has Reports; each report shows only what they may see
  // (the database decides the scope — reqgen_report_tier). Some reports are for some positions only.
  { prefix: "/reports/compliance", roles: ["admin", "auditor"] },
  { prefix: "/reports/registry", roles: ["admin", "auditor", "registry", "registrar"] },
  { prefix: "/reports/enterprise-analytics", roles: ["admin", "auditor", "dg", "directorgeneral", "generalsecretary"] },
  { prefix: "/reports/finance-statements", roles: ["admin", "auditor", "account", "accounts", "accountofficer", "dg", "directorgeneral", "generalsecretary"] },
  { prefix: "/reports/vouchers", roles: ["admin", "auditor", "account", "accounts", "accountofficer", "dg", "directorgeneral", "generalsecretary"] },
  // v4.6: the A4 monthly finance report shows subhead allocations — Finance, the DG's office, Auditor, Super Admin only
  { prefix: "/reports/print", roles: ["admin", "auditor", "account", "accounts", "accountofficer", "dg", "directorgeneral", "generalsecretary"] },
  { prefix: "/reports", authenticatedOnly: true },

  { prefix: "/test-supabase", roles: ["admin"] },
  { prefix: "/change-password", authenticatedOnly: true },
  { prefix: "/output", roles: ["admin", "auditor"] },
  { prefix: "/approvals", authenticatedOnly: true },
  { prefix: "/requests", authenticatedOnly: true },
  { prefix: "/dashboard", authenticatedOnly: true },
  { prefix: "/profile", authenticatedOnly: true },
  { prefix: "/notifications", authenticatedOnly: true },
  { prefix: "/about", authenticatedOnly: true },
  { prefix: "/docs", authenticatedOnly: true },
  // v4.6.6: release notes published by the Developer
  { prefix: "/whats-new", authenticatedOnly: true },
];

/**
 * v3.0.2 — role denials that sit on top of the allow-list policies above.
 * Registry TRACKS request movement only: while acting as Registry, a user may
 * not open, edit or print the content of any individual request. (Their own
 * requests remain available after switching to their Staff role.)
 */
export const ROUTE_DENIALS: Array<{ pattern: RegExp; roles: string[]; reason: string }> = [
  {
    pattern: /^\/requests\/(?!(?:new|mine)(?:\/|$))[^/]+(?:\/.*)?$/,
    roles: ["registry"],
    reason: "Registry tracks request movement only and cannot open request contents.",
  },
];

export function deniedByRole(pathname: string, roleSet: Set<string>) {
  return ROUTE_DENIALS.find((rule) => rule.pattern.test(pathname) && hasAnyRole(roleSet, rule.roles)) || null;
}

/** v4.1: the public QR check page for printed letters and vouchers. */
export const PUBLIC_PREFIXES = ["/check/"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export function getRoutePolicy(pathname: string): RoutePolicy | null {
  return (
    ROUTE_POLICIES.slice()
      .sort((a, b) => b.prefix.length - a.prefix.length)
      .find(
        (policy) =>
          pathname === policy.prefix || pathname.startsWith(`${policy.prefix}/`)
      ) || null
  );
}

export function canAccessPath(pathname: string, roleSet: Set<string>): boolean {
  if (isPublicPath(pathname)) return true;
  if (deniedByRole(pathname, roleSet)) return false;

  const policy = getRoutePolicy(pathname);
  if (!policy) return true;
  if (policy.authenticatedOnly) return roleSet.size > 0;
  if (!policy.roles?.length) return true;

  return hasAnyRole(roleSet, policy.roles);
}
