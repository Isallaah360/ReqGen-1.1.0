import { supabase } from "@/lib/supabaseClient";
import {
  buildEffectiveRoleSet,
  buildRoleSet,
  normalizeRole,
  type ProfileRoleRecord,
} from "@/lib/roles";

export type AuthContext = {
  userId: string;
  fallbackRole: string | null;
  profileRoles: ProfileRoleRecord[];
  assignedRoleSet: Set<string>;
  activeRoleKey: string | null;
  activeRoleName: string | null;
  activeRoleSource: string | null;
  isAdmin: boolean;
  roleSet: Set<string>;
  /** v4.6.6: "superadmin" or "developer" for the two system accounts, otherwise null. */
  systemAccount: string | null;
  /** v4.6.6: false when the person signed in but has no staff record (profile) yet. */
  hasProfile: boolean;
};

/**
 * v4.6.6 — the roles a page check uses: the position the person is acting as, plus
 * "developer" for the Developer system account (it opens the Developer Console).
 */
export function accessRoleSet(context: Pick<AuthContext, "activeRoleKey" | "systemAccount">): Set<string> {
  const set = new Set<string>();
  if (context.activeRoleKey) set.add(context.activeRoleKey);
  if (context.systemAccount === "developer") { set.add("developer"); set.add("admin"); }
  if (context.activeRoleKey === "superadmin") set.add("admin");
  return set;
}

function parseActiveRole(value: unknown): {
  key: string | null;
  name: string | null;
  source: string | null;
} {
  if (Array.isArray(value)) return parseActiveRole(value[0]);
  if (typeof value === "string") {
    return { key: normalizeRole(value) || null, name: value || null, source: null };
  }
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    const rawKey =
      row.active_role_key ??
      row.role_key ??
      row.role ??
      row.get_my_active_role ??
      row.reqgen_current_active_role;
    const key = normalizeRole(String(rawKey ?? "")) || null;
    return {
      key,
      name: String(row.active_role_name ?? row.role_name ?? rawKey ?? "") || null,
      source: String(row.authorization_source ?? "") || null,
    };
  }
  return { key: null, name: null, source: null };
}

export async function getCurrentAuthContext(): Promise<AuthContext | null> {
  // Use the locally persisted Supabase session first. A temporary network error
  // from getUser must never be interpreted as an intentional logout.
  const { data: sessionData } = await supabase.auth.getSession();
  let user = sessionData.session?.user ?? null;

  if (!user) {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return null;
    user = authData.user;
  }

  const userId = user.id;
  const [profileResult, rolesResult, activeResult] = await Promise.all([
    supabase.from("profiles").select("role,system_account").eq("id", userId).maybeSingle(),
    supabase
      .from("profile_roles")
      .select("role_key,role_name,is_active,is_primary")
      .eq("profile_id", userId)
      .eq("is_active", true),
    supabase.rpc("get_my_active_role"),
  ]);

  const profileRow = (profileResult.data || null) as { role?: string | null; system_account?: string | null } | null;
  const fallbackRole = profileRow?.role || null;
  const systemAccount = profileRow?.system_account || null;
  const profileRoles = (rolesResult.data || []) as ProfileRoleRecord[];
  const assignedRoleSet = buildRoleSet(fallbackRole, profileRoles);
  const active = parseActiveRole(activeResult.data);
  const activeRoleKey = active.key || normalizeRole(fallbackRole || "") || null;

  return {
    userId,
    fallbackRole,
    profileRoles,
    assignedRoleSet,
    activeRoleKey,
    activeRoleName: active.name || fallbackRole,
    activeRoleSource: active.source,
    isAdmin: assignedRoleSet.has("admin"),
    roleSet: buildEffectiveRoleSet(assignedRoleSet, activeRoleKey),
    systemAccount,
    hasProfile: profileResult.error ? true : !!profileRow,
  };
}
