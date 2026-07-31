import { supabase } from "@/lib/supabaseClient";
import {
  buildEffectiveRoleSet,
  buildRoleSet,
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
};

export async function getCurrentAuthContext(): Promise<AuthContext | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const userId = authData.user.id;
  const [profileResult, rolesResult, activeResult] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabase
      .from("profile_roles")
      .select("role_key,role_name,is_active,is_primary")
      .eq("profile_id", userId)
      .eq("is_active", true),
    supabase.rpc("get_my_active_role"),
  ]);

  const fallbackRole = profileResult.data?.role || null;
  const profileRoles = (rolesResult.data || []) as ProfileRoleRecord[];
  const assignedRoleSet = buildRoleSet(fallbackRole, profileRoles);
  const active = activeResult.data as
    | { active_role_key?: string; active_role_name?: string; authorization_source?: string }
    | null;

  return {
    userId,
    fallbackRole,
    profileRoles,
    assignedRoleSet,
    activeRoleKey: active?.active_role_key || null,
    activeRoleName: active?.active_role_name || null,
    activeRoleSource: active?.authorization_source || null,
    isAdmin: assignedRoleSet.has("admin"),
    roleSet: buildEffectiveRoleSet(assignedRoleSet, active?.active_role_key),
  };
}
