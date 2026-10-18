import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { decodeJwt } from "@/lib/server/mfaWindow";

/**
 * ReqGen v4.6.3 — the guard for destructive actions (financial reset, restore).
 * The caller must be the Trust's Super Admin system account (never the Developer),
 * active, acting as Super Admin, and must have typed the 2FA code in the last
 * FRESH_MINUTES (the access token then carries a fresh "totp" proof).
 */
export const FRESH_MINUTES = 10;

export type SuperAdminContext = {
  admin: SupabaseClient;   // service client (server only)
  asUser: SupabaseClient;  // runs database functions as the Super Admin, so they check auth.uid() too
  userId: string;
  name: string;
};

type Fail = { error: string; status: number };

export function freshTotp(token: string, minutes = FRESH_MINUTES) {
  const amr = decodeJwt(token).amr;
  if (!Array.isArray(amr)) return false;
  const limit = Date.now() / 1000 - minutes * 60;
  return amr.some((m) => (m as { method?: string }).method === "totp" && Number((m as { timestamp?: number }).timestamp) >= limit);
}

export async function superAdminFromRequest(authorization: string | null, opts: { fresh?: boolean } = {}): Promise<SuperAdminContext | Fail> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return { error: "Server environment variables are incomplete.", status: 500 };
  const token = String(authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: "Unauthorized.", status: 401 };
  const { data, error } = await createClient(url, anon, { auth: { persistSession: false } }).auth.getUser(token);
  if (error || !data.user) return { error: "Unauthorized.", status: 401 };

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const [profile, acting] = await Promise.all([
    admin.from("profiles").select("full_name,system_account,is_active").eq("id", data.user.id).maybeSingle(),
    admin.from("user_active_roles").select("active_role_key").eq("user_id", data.user.id).maybeSingle(),
  ]);
  const p = profile.data as { full_name?: string | null; system_account?: string | null; is_active?: boolean | null } | null;
  if (!p) return { error: "Your account could not be verified.", status: 403 };
  if (p.is_active === false) return { error: "This account is deactivated.", status: 403 };
  if (p.system_account !== "superadmin") return { error: "Only the Super Admin can do this. The Developer and other administrators cannot.", status: 403 };
  const role = String((acting.data as { active_role_key?: string | null } | null)?.active_role_key || "admin").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!["admin", "superadmin"].includes(role)) return { error: "Switch \"Acting as\" to Super Admin first.", status: 403 };
  if (opts.fresh && !freshTotp(token)) return { error: `Type your 2FA code first (it is valid for ${FRESH_MINUTES} minutes).`, status: 403 };

  const asUser = createClient(url, anon, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  return { admin, asUser, userId: data.user.id, name: String(p.full_name || data.user.email || "Super Admin") };
}
