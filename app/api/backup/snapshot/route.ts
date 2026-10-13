import { NextRequest, NextResponse } from "next/server";
import { storeBackup } from "@/lib/server/backupStore";
import { staffFromRequest } from "@/lib/server/staffAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

/** ReqGen v4.5 — "Back up now": a full copy kept in the private backups store (Admin / Auditor). POST { year?: "2026" | "all" }. */
export async function POST(req: NextRequest) {
  const ctx = await staffFromRequest(req.headers.get("authorization"));
  if ("error" in ctx) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });
  if (!["admin", "auditor"].some((r) => ctx.roles.has(r))) return NextResponse.json({ ok: false, error: "Only Admin and the Auditor can take a backup." }, { status: 403 });
  let year: number | null | undefined;
  try { const y = String(((await req.json()) as { year?: string }).year || ""); year = /^\d{4}$/.test(y) ? Number(y) : y === "all" ? null : undefined; } catch { year = undefined; }
  try {
    const out = await storeBackup(ctx.admin, { year, mode: "on demand", actorId: ctx.userId, actorName: ctx.name });
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "The backup failed." }, { status: 500 });
  }
}
