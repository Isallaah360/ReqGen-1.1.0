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

  const policy = getRoutePolicy(pathname);
  if (!policy) return true;
  if (policy.authenticatedOnly) return roleSet.size > 0;
  if (!policy.roles?.length) return true;

  return hasAnyRole(roleSet, policy.roles);
}
