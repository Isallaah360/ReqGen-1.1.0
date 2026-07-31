import { supabase } from "@/lib/supabaseClient";
import { normalizeRole, type ProfileRoleRecord } from "@/lib/roles";

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
  source: "profile" | "profile_role" | "hr_assignment";
};

export async function getAvailableRoles(userId: string): Promise<AvailableRole[]> {
  const [profileResult, rolesResult, hrResult] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabase
      .from("profile_roles")
      .select("role_key,role_name,is_active,is_primary")
      .eq("profile_id", userId)
      .eq("is_active", true),
    supabase
      .from("hr_officer_assignments")
      .select("section_key,is_active")
      .eq("officer_id", userId)
      .eq("is_active", true),
  ]);

  const map = new Map<string, AvailableRole>();
  const fallback = normalizeRole(profileResult.data?.role);
  if (fallback) {
    map.set(fallback, {
      key: fallback,
      name: profileResult.data?.role || "Staff",
      source: "profile",
    });
  }

  ((rolesResult.data || []) as ProfileRoleRecord[]).forEach((role) => {
    const key = normalizeRole(role.role_key || role.role_name);
    if (!key) return;
    map.set(key, {
      key,
      name: role.role_name || role.role_key || key,
      source: "profile_role",
    });
  });

  for (const row of hrResult.data || []) {
    const section = normalizeRole(row.section_key);
    if (!section) continue;
    const key = `hr:${section}`;
    const label = section
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
    map.set(key, {
      key,
      name: `${label} Officer`,
      source: "hr_assignment",
    });
  }

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
