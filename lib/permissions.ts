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
  { prefix: "/admin/workflow-test", roles: ["admin"] },
  { prefix: "/admin/access-audit", roles: ["admin"] },
  { prefix: "/admin/system-health", roles: ["admin"] },
  { prefix: "/admin/account-routing", roles: ["admin"] },
  { prefix: "/admin/departments", roles: ["admin"] },
  { prefix: "/admin/settings", roles: ["admin"] },
  { prefix: "/admin/users", roles: ["admin"] },
  { prefix: "/admin/roles", roles: ["admin"] },
  { prefix: "/admin/security", roles: ["admin", "auditor"] },
  { prefix: "/admin/audit", roles: ["admin", "auditor"] },
  { prefix: "/admin", roles: ["admin"] },

  { prefix: "/audit-centre", roles: ["admin", "auditor"] },
  { prefix: "/workflow", roles: ["admin", "auditor", "dg"] },

  { prefix: "/hr/assignments", roles: ["admin", "hrboss", "hr"] },
  { prefix: "/hr/review", roles: ["admin", "hrboss", "hr"] },
  { prefix: "/hr/audit", roles: ["admin", "hrboss", "hr"] },
  {
    prefix: "/hr",
    roles: [
      "admin",
      "hrboss",
      "hr",
      "hrofficer",
      "hrofficer1",
      "hrofficer2",
      "hrofficer3",
      "hr:stafffiling",
      "hr:leave",
      "hr:registrar",
      "hr:archive",
      "hr:weeklyseminar",
      "hr:staffcapacitybuilding",
      "hr:departmentcapacitybuilding",
      "hr:departmentkpi",
      "hr:annual360assessment",
    ],
  },

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
      "dg",
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
      "pvsigner",
      "pvcountersigner",
      "dg",
      "director",
    ],
  },
  { prefix: "/registry", roles: ["admin", "auditor", "registry"] },
  { prefix: "/reports", roles: ["admin", "auditor", "dg", "accountofficer"] },

  { prefix: "/output", authenticatedOnly: true },
  { prefix: "/approvals", authenticatedOnly: true },
  { prefix: "/requests", authenticatedOnly: true },
  { prefix: "/dashboard", authenticatedOnly: true },
  { prefix: "/notifications", authenticatedOnly: true },
  { prefix: "/profile", authenticatedOnly: true },
  { prefix: "/settings", authenticatedOnly: true },
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
