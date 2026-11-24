/**
 * App 2.1.0: the website's module list and access rules, used as they are, so the app shows
 * exactly the offices and pages the website allows for the same position.
 */
import { MODULES, type ModuleDef, type ModuleTile } from "@web/v4/modules";
import { canAccessPath } from "@web/permissions";
import { normalizeRole } from "@web/roles";

export type { ModuleDef, ModuleTile };
export { MODULES, normalizeRole };

/** The same rule as the website (lib/auth.ts accessRoleSet). */
export function roleSetOf(activeRoleKey: string | null, systemAccount: string | null) {
  const set = new Set<string>();
  const k = normalizeRole(activeRoleKey || "") || "staff";
  set.add(k);
  if (systemAccount === "developer") { set.add("developer"); set.add("admin"); }
  if (k === "superadmin") set.add("admin");
  return set;
}
export const allowed = (href: string, roles: Set<string>) => canAccessPath(href.split(/[?#]/)[0], roles);

/** Modules other than the ones that already have their own tabs. */
const OWN_TABS = new Set(["dashboard", "requests", "approvals", "notifications"]);
export function officesFor(roles: Set<string>) {
  return MODULES.filter((m) => !OWN_TABS.has(m.key) && allowed(m.href, roles))
    .map((m) => ({ ...m, tiles: m.tiles.filter((t) => allowed(t.href, roles)) }))
    .filter((m) => m.tiles.length > 0);
}
