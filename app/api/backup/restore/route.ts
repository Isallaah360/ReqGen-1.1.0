import { NextRequest, NextResponse } from "next/server";
import { strFromU8, unzipSync } from "fflate";
import { csvToObjects } from "@/lib/csv";
import { BACKUP_FORMAT, BACKUP_TABLES } from "@/lib/server/backupCatalog";
import { staffFromRequest } from "@/lib/server/staffAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * ReqGen v3.1.8 — Master Backup restore.
 * multipart form: file (the backup .zip, or its 02_REQGEN_MASTER.csv),
 *                 mode = "preview" | "missing" | "overwrite"
 * preview   — Admin or Auditor: what the file holds and what is missing now.
 * missing   — Admin: insert only records that do not exist (nothing changes).
 * overwrite — Admin: insert missing records and replace existing ones with the
 *             backup copy. Nothing is ever deleted.
 * Tables are restored parents-first; each table reports its own result.
 */

type Row = Record<string, unknown>;
type Report = { table: string; label: string; inFile: number; existing: number | null; missing: number | null; written: number; status: string; note: string };

function coerce(value: string, type: string | undefined): unknown {
  if (value === "") return null;
  if (type === "number") { const n = Number(value); return Number.isFinite(n) ? n : value; }
  if (type === "boolean") return value === "true" ? true : value === "false" ? false : value;
  if (type === "json") { try { return JSON.parse(value); } catch { return value; } }
  return value;
}

function chunks<T>(list: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export async function POST(req: NextRequest) {
  const ctx = await staffFromRequest(req.headers.get("authorization"));
  if ("error" in ctx) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const mode = String(form?.get("mode") || "preview");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Choose the backup file first." }, { status: 400 });
  if (!["preview", "missing", "overwrite"].includes(mode)) return NextResponse.json({ ok: false, error: "Unknown restore mode." }, { status: 400 });

  const isAdmin = ctx.roles.has("admin");
  if (mode !== "preview" && !isAdmin) {
    return NextResponse.json({ ok: false, error: "Only the Administrator can restore records. The Auditor can preview a backup." }, { status: 403 });
  }
  if (!isAdmin && !ctx.roles.has("auditor")) {
    return NextResponse.json({ ok: false, error: "Only Admin and the Auditor can open backups." }, { status: 403 });
  }

  // Read the file: the .zip from Master Backup, or its master CSV.
  const tables = new Map<string, Row[]>();
  let backupYear = "";
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
    if (isZip) {
      const entries = unzipSync(bytes);
      const manifestText = entries["01_MANIFEST.csv"] ? strFromU8(entries["01_MANIFEST.csv"]) : "";
      const manifest = csvToObjects(manifestText);
      const head = manifest.find((m) => m.table === "__backup__");
      if (!head || head.group !== BACKUP_FORMAT) throw new Error("This zip is not a ReqGen master backup.");
      backupYear = head.financial_year || "";
      for (const m of manifest) {
        if (m.table === "__backup__" || m.status !== "ok" || !m.file || !entries[m.file]) continue;
        const types = JSON.parse(m.columns_json || "{}") as Record<string, string>;
        const rows = csvToObjects(strFromU8(entries[m.file])).map((r) =>
          Object.fromEntries(Object.entries(r).map(([k, v]) => [k, coerce(v, types[k])])),
        );
        tables.set(m.table, rows);
      }
    } else {
      const master = csvToObjects(new TextDecoder().decode(bytes));
      if (!master.length || !("data_json" in master[0]) || !("table" in master[0])) throw new Error("This CSV is not a ReqGen master backup (02_REQGEN_MASTER.csv).");
      for (const r of master) {
        const list = tables.get(r.table) || [];
        list.push(JSON.parse(r.data_json) as Row);
        tables.set(r.table, list);
      }
    }
  } catch (caught) {
    return NextResponse.json({ ok: false, error: caught instanceof Error ? caught.message : "The backup file could not be read." }, { status: 400 });
  }

  const reports: Report[] = [];
  for (const entry of BACKUP_TABLES) {
    const rows = tables.get(entry.table);
    if (!rows?.length) continue;
    const report: Report = { table: entry.table, label: entry.label, inFile: rows.length, existing: null, missing: null, written: 0, status: "ok", note: "" };

    const ids = rows.map((r) => r.id).filter((v) => v !== null && v !== undefined && v !== "") as string[];
    if (ids.length === rows.length) {
      const found = new Set<string>();
      let failed = "";
      for (const part of chunks(ids, 200)) {
        const { data, error } = await ctx.admin.from(entry.table).select("id").in("id", part);
        if (error) { failed = error.message; break; }
        for (const d of (data || []) as Array<{ id: string }>) found.add(String(d.id));
      }
      if (failed) { report.status = "error"; report.note = failed; reports.push(report); continue; }
      report.existing = found.size;
      report.missing = rows.length - found.size;
    } else {
      report.note = "No id column — compared by primary key on restore.";
    }

    if (mode !== "preview") {
      const ignoreDuplicates = mode === "missing";
      // "missing": duplicates are ignored, so only absent records are inserted.
      const toWrite = rows;
      const errors: string[] = [];
      for (const part of chunks(toWrite, 300)) {
        const { error, count } = await ctx.admin.from(entry.table).upsert(part, { ignoreDuplicates, count: "exact" });
        if (error) errors.push(error.message);
        else report.written += count ?? part.length;
      }
      if (errors.length) { report.status = report.written ? "partial" : "error"; report.note = errors.slice(0, 2).join(" | "); }
    }
    reports.push(report);
  }

  const totals = reports.reduce((t, r) => ({ inFile: t.inFile + r.inFile, missing: t.missing + (r.missing || 0), written: t.written + r.written }), { inFile: 0, missing: 0, written: 0 });

  await ctx.admin.from("reqgen_backup_log").insert({
    action: mode === "preview" ? "preview" : "restore", financial_year: backupYear || null, mode,
    actor_id: ctx.userId, actor_name: ctx.name,
    summary: { file: file.name, ...totals, tables: reports.map((r) => ({ table: r.table, written: r.written, status: r.status })) },
  });

  return NextResponse.json({ ok: true, mode, year: backupYear, file: file.name, totals, reports });
}
