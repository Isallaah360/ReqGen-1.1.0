import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { decodeJwt } from "@/lib/server/mfaWindow";

/**
 * ReqGen v4.6.6 — the guard for destructive actions (financial reset, restore).
 * The caller must be the Super Admin account (ietreqgen@gmail.com) acting as Super Admin,
 * or the Developer account — decided by the database, the same rule every finance action
 * uses — and must have typed the 2FA code in the last FRESH_MINUTES (the access token
 * then carries a fresh "totp" proof).
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
  const profile = await admin.from("profiles").select("full_name,system_account,is_active").eq("id", data.user.id).maybeSingle();
  const p = profile.data as { full_name?: string | null; system_account?: string | null; is_active?: boolean | null } | null;
  if (!p) return { error: "Your account could not be verified.", status: 403 };
  if (p.is_active === false) return { error: "This account is deactivated.", status: 403 };

  // v4.6.6: the database decides (reqgen_finance_powers.can_reset) — the Super Admin account
  // (ietreqgen@gmail.com) acting as Super Admin, or the Developer account
  const asUser = createClient(url, anon, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const powers = await asUser.rpc("reqgen_finance_powers");
  if (!powers.error && powers.data) {
    const d = powers.data as { can_reset?: boolean; is_super_admin?: boolean; reason?: string | null };
    const allowed = typeof d.can_reset === "boolean" ? d.can_reset : !!d.is_super_admin;
    if (!allowed) return { error: d.reason && /Acting as/.test(d.reason) ? d.reason : "Only the Super Admin or the Developer can do this.", status: 403 };
  } else {
    const check = await asUser.rpc("reqgen_is_super_admin");
    if (check.error || check.data !== true) return { error: "Only the Super Admin, acting as Super Admin, can do this.", status: 403 };
  }
  if (opts.fresh && !freshTotp(token)) return { error: `Type your 2FA code first (it is valid for ${FRESH_MINUTES} minutes).`, status: 403 };

  return { admin, asUser, userId: data.user.id, name: String(p.full_name || data.user.email || "Super Admin") };
}
