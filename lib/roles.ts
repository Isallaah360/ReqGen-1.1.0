export type AppRole =
  | "admin"
  | "auditor"
  | "account"
  | "accounts"
  | "accountofficer"
  | "pvsigner"
  | "pvcountersigner"
  | "hr"
  | "hrofficer1"
  | "hrofficer2"
  | "hrofficer3"
  | "registry"
  | "dg"
  | "director"
  | "staff";

export const REPORT_ACCESS_ROLES = [
  "admin",
  "auditor",
  "dg",
  "accountofficer",
] as const;

export type ProfileRoleRecord = {
  role_key?: string | null;
  role_name?: string | null;
  is_active?: boolean | null;
  is_primary?: boolean | null;
};

export function normalizeRole(value: string | null | undefined): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

export function buildRoleSet(
  fallbackRole: string | null | undefined,
  profileRoles: ProfileRoleRecord[] = []
): Set<string> {
  const roles = new Set<string>();
  const fallback = normalizeRole(fallbackRole);

  if (fallback) roles.add(fallback);

  profileRoles.forEach((record) => {
    if (record.is_active === false) return;

    const key = normalizeRole(record.role_key || record.role_name);
    if (key) roles.add(key);
  });

  if (roles.size === 0) roles.add("staff");
  return roles;
}

export function hasAnyRole(roleSet: Set<string>, roles: string[]): boolean {
  return roles.some((role) => roleSet.has(normalizeRole(role)));
}
