import { supabase } from "@/lib/supabaseClient";
import { isPermissionToken, normalizeRole, type ProfileRoleRecord } from "@/lib/roles";

export type ActiveRoleRecord = {
  user_id: string;
  active_role_key: string;
  active_role_name: string;
  authorization_source: string;
  updated_at: string;
};

export type AvailableRole = {
  key: string;
  name: string;
  source: "profile" | "profile_role";
};

/**
 * The positions a person genuinely holds: profiles.role plus active profile_roles.
 * v4.6.7: HR section permissions (hr_officer_assignments, shown before as
 * "hr:archive", "hr:registrar" …) are permission tokens, not positions, so they
 * are no longer listed here. They keep working on the server exactly as before.
 */
export async function getAvailableRoles(userId: string): Promise<AvailableRole[]> {
  const [profileResult, rolesResult] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabase
      .from("profile_roles")
      .select("role_key,role_name,is_active,is_primary")
      .eq("profile_id", userId)
      .eq("is_active", true),
  ]);

  const map = new Map<string, AvailableRole>();
  const fallback = normalizeRole(profileResult.data?.role);
  if (fallback && !isPermissionToken(fallback)) {
    map.set(fallback, {
      key: fallback,
      name: profileResult.data?.role || "Staff",
      source: "profile",
    });
  }

  ((rolesResult.data || []) as ProfileRoleRecord[]).forEach((role) => {
    const key = normalizeRole(role.role_key || role.role_name);
    if (!key || isPermissionToken(key)) return;
    map.set(key, {
      key,
      name: role.role_name || role.role_key || key,
      source: "profile_role",
    });
  });

  if (map.size === 0) {
    map.set("staff", { key: "staff", name: "Staff", source: "profile" });
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.key === "admin") return -1;
    if (b.key === "admin") return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function getActiveRole(userId: string): Promise<ActiveRoleRecord | null> {
  const { data } = await supabase
    .from("user_active_roles")
    .select("user_id,active_role_key,active_role_name,authorization_source,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  return (data as ActiveRoleRecord | null) || null;
}

export async function switchActiveRole(roleKey: string): Promise<ActiveRoleRecord> {
  const { data, error } = await supabase.rpc("set_my_active_role", {
    p_role_key: roleKey,
  });
  if (error) throw error;
  return data as ActiveRoleRecord;
}
