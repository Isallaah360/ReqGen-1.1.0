import { normalizeRole } from "@/lib/roles";

/**
 * ReqGen v4.1.2 — who may see subhead figures (allocation, reserved,
 * expenditure, balance). Build Reference §3 and §5, with the owner's
 * 12 October 2026 instruction.
 *
 * Decided by the position the person is ACTING AS right now, never by every
 * position they hold: a Super Admin acting as Registry sees what Registry sees.
 *
 *   May see:   DG, General Secretary, DOD, HOD, DIN Admin, Registrar, HR
 *              Coordinator and HR Officers, Account Officers, Auditor, Super Admin (and the
 *              Developer, who acts as Super Admin).
 *   Never see: Staff, Registry, PD (Program Director), PA to the DG and
 *              Counter Signer. Staff get the live check only:
 *              "fund available" or "not enough".
 */
const SEE_BALANCES = new Set([
  "dg",
  "generalsecretary",
  "dod",
  "director",
  "hod",
  "dinadmin",
  "registrar",
  "hrcoordinator",
  "hr",
  "hrofficer",
  "account",
  "accounts",
  "accountofficer",
  "auditor",
  "admin",
]);

/** The position key without a trailing number (dinadmin2 → dinadmin, hrofficer1 → hrofficer). */
export function basePosition(key: string | null | undefined) {
  const k = normalizeRole(key);
  if (k.startsWith("hr:")) return "hrofficer";
  return k.replace(/\d+$/, "");
}

export function canSeeBudgetBalances(activePosition: string | null | undefined) {
  return SEE_BALANCES.has(basePosition(activePosition));
}

export const BUDGET_HIDDEN_POSITIONS = ["staff", "registry", "pd", "padg", "pvsigner", "pvcountersigner"] as const;
