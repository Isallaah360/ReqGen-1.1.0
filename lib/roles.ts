export type AppRole =
  | "admin"
  | "auditor"
  | "account"
  | "accounts"
  | "accountofficer"
  | "pvsigner"
  | "pvcountersigner"
  | "hr"
  | "hrboss"
  | "hrofficer"
  | "hrofficer1"
  | "hrofficer2"
  | "hrofficer3"
  | "registry"
  | "registrar"
  | "generalsecretary"
  | "deanadmin"
  | "dg"
  | "director"
  | "staff";


export const REPORT_ACCESS_ROLES = ["admin", "auditor"] as const;

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
    .replace(/[^a-z0-9:]+/g, "");
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

export function buildEffectiveRoleSet(
  assignedRoles: Set<string>,
  activeRole: string | null | undefined
): Set<string> {
  const effective = new Set<string>();
  const normalizedActive = normalizeRole(activeRole);
  if (normalizedActive) effective.add(normalizedActive);

  if (!normalizedActive) {
    assignedRoles.forEach((role) => effective.add(role));
  }

  if (effective.size === 0) effective.add("staff");
  return effective;
}

export function hasAnyRole(roleSet: Set<string>, roles: string[]): boolean {
  return roles.some((role) => roleSet.has(normalizeRole(role)));
}
