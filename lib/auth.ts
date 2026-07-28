import { supabase } from "@/lib/supabaseClient";
import { buildRoleSet, type ProfileRoleRecord } from "@/lib/roles";

export type AuthContext = {
  userId: string;
  fallbackRole: string | null;
  profileRoles: ProfileRoleRecord[];
  roleSet: Set<string>;
};

export async function getCurrentAuthContext(): Promise<AuthContext | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) return null;

  const userId = authData.user.id;

  const [profileResult, rolesResult] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabase
      .from("profile_roles")
      .select("role_key,role_name,is_active,is_primary")
      .eq("profile_id", userId)
      .eq("is_active", true),
  ]);

  const fallbackRole = profileResult.data?.role || null;
  const profileRoles = (rolesResult.data || []) as ProfileRoleRecord[];

  return {
    userId,
    fallbackRole,
    profileRoles,
    roleSet: buildRoleSet(fallbackRole, profileRoles),
  };
}
