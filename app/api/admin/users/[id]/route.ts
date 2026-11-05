import { NextRequest, NextResponse } from "next/server";
import { adminFromRequest, adminLog, type AdminContext } from "@/lib/server/adminAuth";
import { decodeJwt } from "@/lib/server/mfaWindow";

export const runtime = "nodejs";

function fail(error: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error, details }, { status });
}

type Check = { table: string; column: string; label: string };

/** Anything here means the person has history in ReqGen: they stay deactivated, never deleted. */
const HISTORY: Check[] = [
  { table: "requests", column: "created_by", label: "requests they made" },
  { table: "requests", column: "current_owner", label: "requests waiting with them" },
  { table: "requests", column: "assigned_account_officer_id", label: "requests assigned to them as Account Officer" },
  { table: "request_history", column: "action_by", label: "approvals or other actions on requests" },
  { table: "request_attachments", column: "uploaded_by", label: "attachments" },
  { table: "request_attachment_checks", column: "checked_by", label: "attachment checks" },
  { table: "payment_vouchers", column: "created_by", label: "payment vouchers" },
  { table: "payment_vouchers", column: "current_signing_owner", label: "vouchers waiting with them" },
  { table: "payment_voucher_history", column: "action_by", label: "signatures on vouchers" },
  { table: "finance_transactions", column: "posted_by", label: "payments or finance postings" },
  { table: "iet_account_transactions", column: "actor_id", label: "account transactions" },
  { table: "reqgen_transfers", column: "initiated_by", label: "account transfers" },
  { table: "reqgen_finance_reversals", column: "initiated_by", label: "reversals" },
  { table: "registry_correspondence", column: "created_by", label: "registry records" },
];

/** Settings that still name the person: change them first (the routing engine is never changed from here). */
const SETTINGS: Check[] = [
  { table: "departments", column: "hod_user_id", label: "Head of a department (Administration › Departments)" },
  { table: "departments", column: "director_user_id", label: "DOD of a department (Administration › Departments)" },
  { table: "department_account_routing", column: "officer_user_id", label: "Account Officer of a department (Administration › Departments)" },
  { table: "reqgen_department_stage_officers", column: "user_id", label: "an officer on an approval route (Routing Engine)" },
  { table: "reqgen_stage_backups", column: "user_id", label: "a backup officer (Routing Engine)" },
  { table: "iet_account_officer_assignments", column: "officer_user_id", label: "the officer of an IET account (Finance › Assign officers)" },
];

/** Personal rows that go with the account. */
const PERSONAL: Check[] = [
  { table: "profile_roles", column: "profile_id", label: "positions" },
  { table: "user_active_roles", column: "user_id", label: "acting-as choice" },
  { table: "user_role_switch_history", column: "user_id", label: "position switches" },
  { table: "reqgen_trusted_devices", column: "user_id", label: "passcodes" },
  { table: "reqgen_webauthn_credentials", column: "user_id", label: "fingerprints" },
  { table: "reqgen_officer_availability", column: "user_id", label: "away notes" },
  { table: "reqgen_request_drafts", column: "owner_id", label: "drafts" },
  { table: "notifications", column: "user_id", label: "notifications" },
  { table: "sms_otps", column: "user_id", label: "one-time codes" },
];

const missing = (m: string) => /does not exist|could not find|schema cache/i.test(m);

/** Seconds since the caller last entered their 2FA code (from the session token), or null. */
function secondsSince2fa(token: string) {
  const amr = decodeJwt(token).amr;
  if (!Array.isArray(amr)) return null;
  const times = amr.filter((a: { method?: string }) => a?.method === "totp").map((a: { timestamp?: number }) => Number(a.timestamp || 0)).filter(Boolean);
  if (!times.length) return null;
  return Math.floor(Date.now() / 1000) - Math.max(...times);
}

/**
 * v4.6.9 — delete a DEACTIVATED account permanently (Super Admin only).
 *   * The account must already be deactivated, and must not be a system account or your own.
 *   * It must have no history (requests, approvals, signatures, vouchers, payments, registry records).
 *     Anyone with history stays deactivated, so every record keeps its name.
 *   * Settings that still name them (HOD, DOD, Account Officer, route officer, backup) must be
 *     changed first. This route never edits the routing engine.
 *   * body { confirm: "DELETE" }, and a 2FA code entered in the last 5 minutes.
 *   * Written to the Audit Log before the account is removed.
 * GET returns what would block the deletion, so the screen can explain it before asking.
 */
async function blockers(ctx: AdminContext, id: string) {
  const history: Record<string, number> = {};
  const settings: string[] = [];
  for (const c of HISTORY) {
    const { count, error } = await ctx.admin.from(c.table).select(c.column, { count: "exact", head: true }).eq(c.column, id);
    if (error) { if (missing(error.message)) continue; throw new Error(`Could not check ${c.label}. Nothing was deleted.`); }
    if (count) history[c.label] = (history[c.label] || 0) + count;
  }
  for (const c of SETTINGS) {
    const { count, error } = await ctx.admin.from(c.table).select(c.column, { count: "exact", head: true }).eq(c.column, id);
    if (error) { if (missing(error.message)) continue; throw new Error(`Could not check ${c.label}. Nothing was deleted.`); }
    if (count) settings.push(c.label);
  }
  return { history, settings };
}

async function loadTarget(ctx: AdminContext, id: string) {
  const { data, error } = await ctx.admin.from("profiles").select("id,full_name,email,system_account,is_active").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as { id: string; full_name: string | null; email: string | null; system_account: string | null; is_active: boolean | null } | null;
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = await adminFromRequest(req.headers.get("authorization"));
  if ("error" in ctx) return fail(ctx.error, ctx.status);
  if (ctx.system !== "superadmin") return fail("Only the Super Admin can delete accounts.", 403);
  const { id } = await context.params;
  try {
    const target = await loadTarget(ctx, id);
    if (!target) return fail("That staff member was not found.", 404);
    const b = await blockers(ctx, id);
    return NextResponse.json({ ok: true, deactivated: target.is_active === false, system: !!target.system_account, ...b });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Check failed.", 500);
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = await adminFromRequest(req.headers.get("authorization"));
  if ("error" in ctx) return fail(ctx.error, ctx.status);
  if (ctx.system !== "superadmin") return fail("Only the Super Admin can delete accounts.", 403);
  const { id } = await context.params;
  if (!id) return fail("Choose the account.");
  if (id === ctx.actorId) return fail("You cannot delete your own account.", 409);
  const body = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (String(body.confirm || "").trim() !== "DELETE") return fail("Type DELETE to confirm.");
  const since = secondsSince2fa(ctx.token);
  if (since === null || since > 300) return fail("Enter your 2FA code again to confirm it is you.", 403);

  try {
    const target = await loadTarget(ctx, id);
    if (!target) return fail("That staff member was not found.", 404);
    if (target.system_account) return fail("A system account can never be deleted.", 409);
    if (target.is_active !== false) return fail("Deactivate the account first. Only deactivated accounts can be deleted.", 409);
    const b = await blockers(ctx, id);
    const kinds = Object.keys(b.history);
    if (kinds.length) return fail(`This account has history in ReqGen (${kinds.join(", ")}). It stays deactivated so every record keeps its name.`, 409, b);
    if (b.settings.length) return fail(`This account is still named as ${b.settings.join("; ")}. Change that first.`, 409, b);

    const label = String(target.full_name || target.email || "Staff");
    // Logged first: if anything after this fails, the attempt is still on record.
    await adminLog(ctx, "Deactivated account deleted", label, id, { email: target.email });

    for (const c of PERSONAL) {
      const { error } = await ctx.admin.from(c.table).delete().eq(c.column, id);
      if (error && !missing(error.message)) return fail(`Could not remove their ${c.label}: ${error.message}. The account was not deleted.`, 500);
    }
    const { error: authError } = await ctx.admin.auth.admin.deleteUser(id);
    if (authError && !/not found/i.test(authError.message)) return fail("The sign-in could not be removed: " + authError.message, 500);
    const { error: profileError } = await ctx.admin.from("profiles").delete().eq("id", id);
    if (profileError && !missing(profileError.message)) return fail("The profile could not be removed: " + profileError.message, 500);

    return NextResponse.json({ ok: true, deleted: { id, name: label, email: target.email } });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Delete failed.", 500);
  }
}

/**
 * ReqGen v4.6 — staff record actions (mock-up 82). Super Admin or Developer.
 * body: { action: "profile", fullName?, deptId? }
 *       { action: "deactivate", reason }   sign-in is blocked; history, positions and signatures stay
 *       { action: "reactivate" }
 *       { action: "reset2fa" }             the person sets up a new authenticator at next sign-in
 *       { action: "removePasscodes" }      every trusted-device passcode stops working
 * Every action is written to the Audit Log. A system account can only be changed by the Developer.
 */
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = await adminFromRequest(req.headers.get("authorization"));
  if ("error" in ctx) return fail(ctx.error, ctx.status);
  const { id } = await context.params;
  const body = (await req.json().catch(() => ({}))) as { action?: string; reason?: string; fullName?: string; deptId?: string | null };
  const action = String(body.action || "");

  const { data: target, error: targetError } = await ctx.admin.from("profiles").select("id,full_name,email,system_account,is_active").eq("id", id).maybeSingle();
  if (targetError) return fail(targetError.message, 500);
  if (!target) return fail("That staff member was not found.", 404);
  const label = String(target.full_name || target.email || "Staff");
  if (target.system_account && ctx.system !== "developer") return fail("Only the Developer can change a system account.", 403);

  if (action === "profile") {
    const patch: Record<string, unknown> = {};
    if (typeof body.fullName === "string") {
      const name = body.fullName.trim();
      if (name.length < 3) return fail("Write the full name.");
      patch.full_name = name;
    }
    if (body.deptId !== undefined) patch.dept_id = body.deptId || null;
    if (!Object.keys(patch).length) return fail("Nothing to change.");
    const { error } = await ctx.admin.from("profiles").update(patch).eq("id", id);
    if (error) return fail(error.message, 500);
    await adminLog(ctx, "Staff record changed", label, id, { fields: Object.keys(patch) });
    return NextResponse.json({ ok: true });
  }

  if (action === "deactivate" || action === "reactivate") {
    if (id === ctx.actorId) return fail("You cannot deactivate your own account.", 409);
    const off = action === "deactivate";
    const reason = String(body.reason || "").trim();
    if (off && reason.length < 4) return fail("Write the reason for deactivating.");
    const banned = await ctx.admin.auth.admin.updateUserById(id, { ban_duration: off ? "876000h" : "none" });
    if (banned.error) return fail(`Sign-in could not be ${off ? "blocked" : "restored"}: ${banned.error.message}`, 500);
    const { error } = await ctx.admin.from("profiles").update(off
      ? { is_active: false, deactivated_at: new Date().toISOString(), deactivated_reason: reason }
      : { is_active: true, deactivated_at: null, deactivated_reason: null }).eq("id", id);
    if (error) return fail(error.message, 500);
    if (off) await ctx.admin.from("reqgen_trusted_devices").update({ revoked_at: new Date().toISOString(), revoked_reason: "Account deactivated" }).eq("user_id", id).is("revoked_at", null);
    await adminLog(ctx, off ? "Staff deactivated" : "Staff reactivated", label, id, off ? { reason } : undefined);
    return NextResponse.json({ ok: true });
  }

  if (action === "reset2fa") {
    const listed = await ctx.admin.auth.admin.mfa.listFactors({ userId: id });
    if (listed.error) return fail(listed.error.message, 500);
    let removed = 0;
    for (const f of listed.data?.factors || []) {
      const del = await ctx.admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: id });
      if (del.error) return fail(del.error.message, 500);
      removed += 1;
    }
    await adminLog(ctx, "2FA reset", label, id, { factors: removed });
    return NextResponse.json({ ok: true, removed });
  }

  if (action === "removePasscodes") {
    const { data, error } = await ctx.admin.from("reqgen_trusted_devices").update({ revoked_at: new Date().toISOString(), revoked_reason: "Removed by the Super Admin" })
      .eq("user_id", id).is("revoked_at", null).select("id");
    if (error) return fail(error.message, 500);
    await adminLog(ctx, "Passcodes removed", label, id, { devices: (data || []).length });
    return NextResponse.json({ ok: true, removed: (data || []).length });
  }

  return fail("Unknown action.");
}
