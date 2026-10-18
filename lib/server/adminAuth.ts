import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { decodeJwt } from "@/lib/server/mfaWindow";
import { accountProblem } from "@/lib/server/staffAuth";

/**
 * ReqGen v4.6 — server check for Administration routes. The caller must be the
 * Super Admin or the Developer (role "admin" or a system account). Returns a
 * service client, the caller and whether the caller confirmed 2FA in this session.
 */
export type AdminContext = {
  admin: SupabaseClient;
  token: string;
  actorId: string;
  actorEmail: string;
  system: "superadmin" | "developer" | null;
  aal2: boolean;
};

const key = (v: unknown) => String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export async function adminFromRequest(authorization: string | null): Promise<AdminContext | { error: string; status: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return { error: "Server environment variables are incomplete.", status: 500 };
  const token = String(authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: "Unauthorized.", status: 401 };
  const { data, error } = await createClient(url, anon, { auth: { persistSession: false } }).auth.getUser(token);
  if (error || !data.user) return { error: "Unauthorized.", status: 401 };
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const problem = await accountProblem(admin, data.user.id);
  if (problem) return { error: problem, status: 403 };
  const [profile, roles] = await Promise.all([
    admin.from("profiles").select("role,system_account").eq("id", data.user.id).maybeSingle(),
    admin.from("profile_roles").select("role_key,is_active").eq("profile_id", data.user.id),
  ]);
  const system = (profile.data?.system_account as AdminContext["system"]) || null;
  const isAdmin = Boolean(system) || key(profile.data?.role) === "admin"
    || ((roles.data || []) as Array<{ role_key: string | null; is_active: boolean | null }>).some((r) => r.is_active !== false && key(r.role_key) === "admin");
  if (!isAdmin) return { error: "Only the Super Admin or the Developer can do this.", status: 403 };
  return { admin, token, actorId: data.user.id, actorEmail: String(data.user.email || ""), system, aal2: decodeJwt(token).aal === "aal2" };
}

/** Write one line to the Audit Log for a server action (never blocks the action). */
export async function adminLog(ctx: AdminContext, action: string, recordNo: string | null, recordId: string | null, details?: Record<string, unknown>) {
  try {
    await ctx.admin.rpc("reqgen_admin_log", { p_actor: ctx.actorId, p_action: action, p_record_no: recordNo, p_record_id: recordId, p_details: details || null });
  } catch {
    /* the log never stops the work */
  }
}
