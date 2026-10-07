import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type StaffContext = { admin: SupabaseClient; userId: string; name: string; roles: Set<string> };

function key(v: string | null | undefined) {
  return String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Verifies the Bearer token and returns a service client plus the caller's roles. */
export async function staffFromRequest(authorization: string | null): Promise<StaffContext | { error: string; status: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return { error: "Server environment variables are incomplete.", status: 500 };
  const token = String(authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: "Unauthorized.", status: 401 };
  const { data, error } = await createClient(url, anon).auth.getUser(token);
  if (error || !data.user) return { error: "Unauthorized.", status: 401 };
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const [profile, extra] = await Promise.all([
    admin.from("profiles").select("full_name,role").eq("id", data.user.id).maybeSingle(),
    admin.from("profile_roles").select("role_key,is_active").eq("profile_id", data.user.id),
  ]);
  const roles = new Set<string>();
  if (profile.data?.role) roles.add(key(profile.data.role as string));
  for (const r of (extra.data || []) as Array<{ role_key: string | null; is_active: boolean | null }>) {
    if (r.is_active !== false && r.role_key) roles.add(key(r.role_key));
  }
  return { admin, userId: data.user.id, name: String(profile.data?.full_name || data.user.email || "Officer"), roles };
}
