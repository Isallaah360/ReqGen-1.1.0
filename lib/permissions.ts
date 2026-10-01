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
  { prefix: "/admin/account-routing", roles: ["admin"] },
  { prefix: "/admin/department-routing", roles: ["admin"] },
  { prefix: "/admin/departments", roles: ["admin"] },
  { prefix: "/admin/settings", roles: ["admin"] },
  { prefix: "/admin/users", roles: ["admin"] },
  { prefix: "/admin/roles", roles: ["admin"] },
  { prefix: "/admin/security", roles: ["admin", "auditor"] },
  { prefix: "/admin", roles: ["admin"] },

  { prefix: "/audit-centre", roles: ["admin", "auditor"] },
  { prefix: "/workflow", roles: ["admin", "auditor"] },
  { prefix: "/payment-vouchers/settings", roles: ["admin", "auditor"] },

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
  { prefix: "/registry", roles: ["admin", "auditor", "registry", "registrar"] },
  { prefix: "/reports", roles: ["admin", "auditor"] },

  { prefix: "/test-supabase", roles: ["admin"] },
  { prefix: "/change-password", authenticatedOnly: true },
  { prefix: "/output", roles: ["admin", "auditor"] },
  { prefix: "/approvals", authenticatedOnly: true },
  { prefix: "/requests", authenticatedOnly: true },
  { prefix: "/dashboard", authenticatedOnly: true },
  { prefix: "/profile", authenticatedOnly: true },
  { prefix: "/about", authenticatedOnly: true },
  { prefix: "/docs", authenticatedOnly: true },
];

/**
 * v3.0.2 — role denials that sit on top of the allow-list policies above.
 * Registry TRACKS request movement only: while acting as Registry, a user may
 * not open, edit or print the content of any individual request. (Their own
 * requests remain available after switching to their Staff role.)
 */
export const ROUTE_DENIALS: Array<{ pattern: RegExp; roles: string[]; reason: string }> = [
  {
    pattern: /^\/requests\/(?!new(?:\/|$))[^/]+(?:\/.*)?$/,
    roles: ["registry"],
    reason: "Registry tracks request movement only and cannot open request contents.",
  },
];

export function deniedByRole(pathname: string, roleSet: Set<string>) {
  return ROUTE_DENIALS.find((rule) => rule.pattern.test(pathname) && hasAnyRole(roleSet, rule.roles)) || null;
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname);
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
