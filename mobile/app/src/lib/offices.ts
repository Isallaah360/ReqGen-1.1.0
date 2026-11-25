/**
 * App 4.0.0: which offices a position can open. The app's own copy of the ReqGen position rules
 * (lib/rules), so the app shows exactly the offices the same position has, without the website.
 */
import { DEVELOPER_MODULE, MODULES, type ModuleDef, type ModuleTile } from "./rules/modules";
import { canAccessPath } from "./rules/permissions";
import { normalizeRole } from "./rules/roles";

export type { ModuleDef, ModuleTile };
export { MODULES, normalizeRole };

export function roleSetOf(activeRoleKey: string | null, systemAccount: string | null) {
  const set = new Set<string>();
  const k = normalizeRole(activeRoleKey || "") || "staff";
  set.add(k);
  if (systemAccount === "developer") { set.add("developer"); set.add("admin"); }
  if (k === "superadmin") set.add("admin");
  return set;
}
export const allowed = (href: string, roles: Set<string>) => canAccessPath(href.split(/[?#]/)[0], roles);

/** Offices other than the ones that already have their own tabs. */
const OWN_TABS = new Set(["dashboard", "requests", "approvals", "notifications"]);
export function officesFor(roles: Set<string>) {
  // the Developer Console sits at the top for the Developer account only (as on the website)
  return [...(roles.has("developer") ? [DEVELOPER_MODULE] : []), ...MODULES].filter((m) => !OWN_TABS.has(m.key) && allowed(m.href, roles))
    .map((m) => ({ ...m, tiles: m.tiles.filter((t) => allowed(t.href, roles)) }))
    .filter((m) => m.tiles.length > 0);
}
