import { hasAnyRole, REPORT_ACCESS_ROLES } from "./roles";

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

export const ROUTE_POLICIES: RoutePolicy[] = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/reports", roles: [...REPORT_ACCESS_ROLES] },
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
  {
    prefix: "/hr",
    roles: ["admin", "auditor", "hr", "hrofficer1", "hrofficer2", "hrofficer3"],
  },
  { prefix: "/registry", roles: ["admin", "auditor", "registry"] },
  { prefix: "/audit", roles: ["admin", "auditor"] },
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
    ROUTE_POLICIES
      .slice()
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
  if (policy.authenticatedOnly) return true;
  if (!policy.roles || policy.roles.length === 0) return true;

  return hasAnyRole(roleSet, policy.roles);
}
