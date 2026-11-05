export type AppRole =
  | "admin"
  | "auditor"
  | "account"
  | "accounts"
  | "accountofficer"
  | "pvsigner"
  | "pvcountersigner"
  | "hr"
  | "hrboss" // legacy key; display name is HR Coordinator
  | "hrcoordinator"
  | "pd"
  | "padg"
  | "hrofficer"
  | "hrofficer1"
  | "hrofficer2"
  | "hrofficer3"
  | "registry"
  | "registrar"
  | "generalsecretary"
  | "dinadmin"
  | "deanadmin" // legacy compatibility alias; display name is DIN Admin
  | "dg"
  | "director"
  | "hod"
  | "staff";


export const REPORT_ACCESS_ROLES = ["admin", "auditor"] as const;

export type ProfileRoleRecord = {
  role_key?: string | null;
  role_name?: string | null;
  is_active?: boolean | null;
  is_primary?: boolean | null;
};

export function normalizeRole(value: string | null | undefined): string {
  const normalized = (value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:]+/g, "");

  // Historical installations may still contain the retired "deanadmin" key.
  // ReqGen's canonical role is DIN Admin; normalize the legacy key at runtime.
  if (normalized === "deanadmin") return "dinadmin";
  if (normalized === "gensec") return "generalsecretary";
  // v4.0.0 position names: PO is now PD (Program Director), HR Boss is now
  // HR Coordinator. Old keys keep working until the v4 database step renames them.
  if (normalized === "po" || normalized === "programofficer" || normalized === "programmeofficer" || normalized === "programdirector") return "pd";
  if (normalized === "hrboss" || normalized === "headofhr" || normalized === "hrcoordinator") return "hrcoordinator";
  return normalized;
}

/** v4 position names, as printed on screens, letters, vouchers and the audit log. */
const POSITION_NAMES: Record<string, string> = {
  admin: "Super Admin",
  superadmin: "Super Admin",
  developer: "Developer",
  dg: "Director General",
  generalsecretary: "General Secretary",
  padg: "PA to the DG",
  dod: "DOD",
  director: "DOD",
  hod: "HOD",
  pd: "PD",
  dinadmin: "DIN Admin",
  registrar: "Registrar",
  hrcoordinator: "HR Coordinator",
  hr: "HR Officer",
  hrofficer: "HR Officer",
  hrofficer1: "HR Officer",
  hrofficer2: "HR Officer",
  hrofficer3: "HR Officer",
  account: "Account Officer",
  accounts: "Account Officer",
  accountofficer: "Account Officer",
  auditor: "Auditor",
  pvsigner: "Counter Signer",
  pvcountersigner: "Counter Signer",
  registry: "Registry",
  staff: "Staff",
};

/**
 * v4.6.7: keys with a colon (hr:archive, hr:registrar, hr:annual360assessment …) are
 * PERMISSION TOKENS from hr_officer_assignments, not positions. They still grant what
 * they grant on the server; they are never listed as a position or offered in
 * "Acting as". Old records that carry one read as the HR Officer position.
 */
export function isPermissionToken(value: string | null | undefined): boolean {
  return normalizeRole(value).includes(":");
}

export function roleDisplayName(value: string | null | undefined): string {
  const normalized = normalizeRole(value);
  if (POSITION_NAMES[normalized]) return POSITION_NAMES[normalized];
  if (normalized.startsWith("hr:")) return "HR Officer";
  return String(value || "Staff").trim() || "Staff";
}

const STAGE_POSITION: Record<string, string> = {
  hr: "HR Coordinator", hrfiling: "HR Coordinator", dg: "Director General", registrar: "Registrar", dinadmin: "DIN Admin",
  hod: "HOD", dod: "DOD", director: "DOD", pd: "PD", po: "PD", account: "Account Officer",
};

/**
 * v4.6.8: the position printed beside a signature, read from the history line. The Routing Engine
 * writes "registrar (acting HR)" when the officer named for a step in Routing Engine settings
 * signs it; that reads as the step's position ("HR Coordinator"). Raw keys read as position
 * names. The stored history is not changed.
 */
export function signedAsLabel(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const acting = raw.match(/\(acting\s+(.+?)\)\s*$/i);
  if (acting) {
    const stage = normalizeRole(acting[1]);
    return STAGE_POSITION[stage] || modernisePositionText(acting[1]);
  }
  const k = normalizeRole(raw);
  if (POSITION_NAMES[k] || k.startsWith("hr:")) return roleDisplayName(raw);
  return modernisePositionText(raw);
}

/** Replaces retired position words inside free text (history lines, names). */
export function modernisePositionText(text: string | null | undefined): string {
  return String(text || "")
    .replace(/\bHR Boss\b/g, "HR Coordinator")
    .replace(/\bHead of HR\b/g, "HR Coordinator")
    .replace(/\bDean Admin\b/gi, "DIN Admin")
    .replace(/\bProgra(?:m|mme) Officer\b/g, "Program Director")
    .replace(/\bPO\b/g, "PD");
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
