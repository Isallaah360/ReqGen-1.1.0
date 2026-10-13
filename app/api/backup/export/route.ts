import { NextRequest, NextResponse } from "next/server";
import { backupFileName, buildBackup } from "@/lib/server/backupBuild";
import { staffFromRequest } from "@/lib/server/staffAuth";
import { fyLabel } from "@/lib/financialYear";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * ReqGen v3.1.8 — Master Backup download (Admin / Auditor).
 * POST { year: "2026" | "all" } → a .zip containing:
 *   00_README.txt              how to read and restore the backup
 *   01_MANIFEST.csv            every table: rows, columns, column types, status
 *   02_REQGEN_MASTER.csv       ALL records in one sheet (table, id, date, summary, data)
 *   tables/NN_<table>.csv      one readable CSV per table (open in Excel)
 * v4.5: the zip is built by lib/server/backupBuild.ts (shared with the nightly copy).
 */
export async function POST(req: NextRequest) {
  const ctx = await staffFromRequest(req.headers.get("authorization"));
  if ("error" in ctx) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });
  if (!["admin", "auditor"].some((r) => ctx.roles.has(r))) {
    return NextResponse.json({ ok: false, error: "Only Admin and the Auditor can download the master backup." }, { status: 403 });
  }

  let year = "all";
  try { year = String(((await req.json()) as { year?: string }).year || "all"); } catch { /* default */ }
  const yearNum = /^\d{4}$/.test(year) ? Number(year) : null;
  const built = await buildBackup(ctx.admin, yearNum, ctx.name);

  await ctx.admin.from("reqgen_backup_log").insert({
    action: "backup", financial_year: yearNum ? fyLabel(yearNum) : "all", mode: "download",
    actor_id: ctx.userId, actor_name: ctx.name, bytes: built.zip.byteLength,
    summary: { tables: built.tables, records: built.records, bytes: built.zip.byteLength },
  });

  return new NextResponse(Buffer.from(built.zip), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${backupFileName(yearNum, built.generatedAt)}"`,
      "Cache-Control": "no-store",
    },
  });
}
