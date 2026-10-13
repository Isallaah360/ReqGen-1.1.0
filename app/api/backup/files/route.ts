import { NextRequest, NextResponse } from "next/server";
import { BACKUP_BUCKET } from "@/lib/server/backupStore";
import { staffFromRequest } from "@/lib/server/staffAuth";

export const runtime = "nodejs";

/** ReqGen v4.5 — stored backup copies with a short-lived download link (Admin / Auditor). */
export async function GET(req: NextRequest) {
  const ctx = await staffFromRequest(req.headers.get("authorization"));
  if ("error" in ctx) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });
  if (!["admin", "auditor"].some((r) => ctx.roles.has(r))) return NextResponse.json({ ok: false, error: "Only Admin and the Auditor can see backups." }, { status: 403 });
  const { data, error } = await ctx.admin.from("reqgen_backup_log").select("id,created_at,financial_year,mode,actor_name,storage_path,bytes,summary")
    .eq("action", "backup").not("storage_path", "is", null).order("created_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const rows = (data || []) as Array<{ storage_path: string } & Record<string, unknown>>;
  const signed = await ctx.admin.storage.from(BACKUP_BUCKET).createSignedUrls(rows.map((r) => r.storage_path), 600, { download: true });
  const links = new Map((signed.data || []).map((s) => [s.path, s.signedUrl]));
  return NextResponse.json({ ok: true, files: rows.map((r) => ({ ...r, url: links.get(r.storage_path) || null })) });
}
