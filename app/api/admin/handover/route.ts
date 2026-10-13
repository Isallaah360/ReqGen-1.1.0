import { NextRequest, NextResponse } from "next/server";
import { adminFromRequest, adminLog } from "@/lib/server/adminAuth";

export const runtime = "nodejs";

/**
 * ReqGen v4.6 — hand the Super Admin account over to a new keeper (mock-up 80).
 * The account stays the Trust's own (ietreqgen@gmail.com); only its keeper changes.
 * Only the Super Admin, signed in with 2FA in this session, with the typed words HAND OVER.
 *   1. every passcode and fingerprint on the account stops working;
 *   2. its authenticator (2FA) is removed — the new keeper sets up their own at next sign-in;
 *   3. the new keeper is asked to choose a new password at next sign-in;
 *   4. every session of the account is signed out;
 *   5. the hand-over is written to the Audit Log, with the new keeper's name.
 * body: { keeper: "Full name of the new keeper", confirm: "HAND OVER" }
 */
export async function POST(req: NextRequest) {
  const ctx = await adminFromRequest(req.headers.get("authorization"));
  if ("error" in ctx) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });
  if (ctx.system !== "superadmin") return NextResponse.json({ ok: false, error: "Only the Super Admin account can be handed over, by its current keeper." }, { status: 403 });
  if (!ctx.aal2) return NextResponse.json({ ok: false, error: "Confirm it is you with your 2FA code first." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { keeper?: string; confirm?: string };
  const keeper = String(body.keeper || "").trim();
  if (keeper.length < 3) return NextResponse.json({ ok: false, error: "Write the full name of the new keeper." }, { status: 400 });
  if (String(body.confirm || "").trim().toUpperCase() !== "HAND OVER") return NextResponse.json({ ok: false, error: "Type HAND OVER to confirm." }, { status: 400 });

  const now = new Date().toISOString();
  await ctx.admin.from("reqgen_trusted_devices").update({ revoked_at: now, revoked_reason: "Account handed over" }).eq("user_id", ctx.actorId).is("revoked_at", null);
  await ctx.admin.from("reqgen_webauthn_credentials").delete().eq("user_id", ctx.actorId);
  const factors = await ctx.admin.auth.admin.mfa.listFactors({ userId: ctx.actorId });
  for (const f of factors.data?.factors || []) await ctx.admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: ctx.actorId });
  await ctx.admin.auth.admin.updateUserById(ctx.actorId, { user_metadata: { temporary_password: true, keeper } });
  await ctx.admin.from("app_settings").upsert({ key: "SUPERADMIN_KEEPER", value: `${keeper} · since ${now.slice(0, 10)}` }, { onConflict: "key" });
  await adminLog(ctx, "Super Admin account handed over", keeper, ctx.actorId, { keeper });
  await ctx.admin.auth.admin.signOut(ctx.token, "global").catch(() => null);
  return NextResponse.json({ ok: true });
}
