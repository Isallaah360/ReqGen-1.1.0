import { NextRequest, NextResponse } from "next/server";
import { storeBackup } from "@/lib/server/backupStore";
import { superAdminFromRequest } from "@/lib/server/superAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

const SCOPES = new Set(["finance", "vouchers", "requests"]);
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * ReqGen v4.6.3 — Financial Reset Centre (Super Admin only, fresh 2FA code).
 *   { action: "backup" }  takes a full backup, stores it, reads it back and checks it
 *   { action: "reset", backupId, scopes, confirm: "RESET FINANCE", reason }
 *                         runs reqgen_finance_reset as the Super Admin: one transaction,
 *                         checked to 0.00, recorded, or nothing changes at all
 */
export async function POST(req: NextRequest) {
  const ctx = await superAdminFromRequest(req.headers.get("authorization"), { fresh: true });
  if ("error" in ctx) return json({ ok: false, error: ctx.error }, ctx.status);
  const body = (await req.json().catch(() => ({}))) as { action?: string; backupId?: string; scopes?: unknown; confirm?: string; reason?: string };

  if (body.action === "backup") {
    try {
      const out = await storeBackup(ctx.admin, { year: null, mode: "pre-reset", actorId: ctx.userId, actorName: ctx.name });
      return json({ ok: true, backup: out });
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "The backup failed. Nothing was reset." }, 500);
    }
  }

  if (body.action === "reset") {
    const scopes = Array.isArray(body.scopes) ? body.scopes.map(String).filter((s) => SCOPES.has(s)) : [];
    if (!scopes.includes("finance")) return json({ ok: false, error: "A reset always includes the finance records." }, 400);
    if (!/^[0-9a-f-]{36}$/i.test(String(body.backupId || ""))) return json({ ok: false, error: "Take the backup first." }, 400);
    const { data, error } = await ctx.asUser.rpc("reqgen_finance_reset", {
      p_scopes: scopes, p_confirm: String(body.confirm || ""), p_backup_id: body.backupId, p_reason: String(body.reason || ""),
    });
    if (error) return json({ ok: false, error: `${error.message} Nothing was changed.` }, 400);
    return json({ ok: true, result: data });
  }

  return json({ ok: false, error: "Unknown action." }, 400);
}
