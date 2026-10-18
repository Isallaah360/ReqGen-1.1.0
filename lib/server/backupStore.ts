import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { strFromU8, unzipSync } from "fflate";
import { csvToObjects } from "@/lib/csv";
import { buildBackup, backupFileName } from "@/lib/server/backupBuild";
import { currentFyStart, fyLabel } from "@/lib/financialYear";

/**
 * ReqGen v4.5 — keep backup copies in the private "backups" storage bucket
 * (server only). Nightly copies are kept for 90 days; year-end copies for ever.
 * v4.6.3: every stored copy is read back and checked before it is logged as verified;
 * a financial reset accepts only a verified "pre-reset" copy.
 */
export const BACKUP_BUCKET = "backups";
export const KEEP_DAYS = 90;

export type BackupMode = "nightly" | "on demand" | "year-end" | "pre-reset";

/** Read a stored zip back and check every table's row count against what was written. */
async function verifyStored(admin: SupabaseClient, path: string, expected: { records: number; bytes: number }) {
  const got = await admin.storage.from(BACKUP_BUCKET).download(path);
  if (got.error || !got.data) return `the stored copy could not be read back (${got.error?.message || "missing"})`;
  const bytes = new Uint8Array(await got.data.arrayBuffer());
  if (bytes.byteLength !== expected.bytes) return `the stored copy has ${bytes.byteLength} bytes, ${expected.bytes} were written`;
  try {
    const entries = unzipSync(bytes);
    const manifest = csvToObjects(strFromU8(entries["01_MANIFEST.csv"] || new Uint8Array()));
    const head = manifest.find((m) => m.table === "__backup__");
    if (!head) return "the stored copy has no manifest";
    let rows = 0;
    for (const m of manifest) {
      if (m.table === "__backup__" || m.status !== "ok") continue;
      const file = entries[m.file];
      if (!file) return `the stored copy is missing ${m.file}`;
      const count = csvToObjects(strFromU8(file)).length;
      if (count !== Number(m.rows)) return `${m.table} has ${count} rows in the copy, ${m.rows} expected`;
      rows += count;
    }
    if (rows !== expected.records || Number(head.rows) !== expected.records) return `the copy holds ${rows} records, ${expected.records} expected`;
  } catch (e) {
    return `the stored copy could not be opened (${e instanceof Error ? e.message : "unreadable"})`;
  }
  return null;
}

export async function storeBackup(admin: SupabaseClient, opts: { year?: number | null; mode: BackupMode; actorId: string | null; actorName: string }) {
  const year = opts.year === undefined ? (opts.mode === "pre-reset" ? null : currentFyStart()) : opts.year;
  const built = await buildBackup(admin, year, opts.actorName);
  const stamp = built.generatedAt.replace(/[:.]/g, "-");
  const folder = opts.mode === "year-end" ? "year-end" : opts.mode === "nightly" ? "nightly" : opts.mode === "pre-reset" ? "pre-reset" : "manual";
  const path = `${folder}/${year ? `FY${year}` : "all"}/${stamp}_${backupFileName(year, built.generatedAt)}`;
  const up = await admin.storage.from(BACKUP_BUCKET).upload(path, built.zip, { contentType: "application/zip", upsert: false });
  if (up.error) throw new Error(`The backup was built but could not be stored: ${up.error.message}`);
  const problem = await verifyStored(admin, path, { records: built.records, bytes: built.zip.byteLength });
  const row = {
    action: "backup", financial_year: year ? fyLabel(year) : "all", mode: opts.mode, actor_id: opts.actorId, actor_name: opts.actorName,
    storage_path: path, bytes: built.zip.byteLength, verified: !problem,
    summary: { tables: built.tables, records: built.records, bytes: built.zip.byteLength, verified: !problem, problem },
  };
  let logged = await admin.from("reqgen_backup_log").insert(row).select("id").single();
  // before v4_6_3 SQL is run the log has no "verified" column: keep backing up, record it in the summary only
  if (logged.error && /verified/.test(logged.error.message) && opts.mode !== "pre-reset") {
    const { verified: _skip, ...older } = row;
    void _skip;
    logged = await admin.from("reqgen_backup_log").insert(older).select("id").single();
  }
  if (logged.error) throw new Error(`The backup was stored at ${path} but could not be logged: ${logged.error.message}`);
  if (problem) throw new Error(`The backup was stored but did not pass the check: ${problem}. Try again.`);
  return { id: (logged.data as { id: string }).id, path, bytes: built.zip.byteLength, tables: built.tables, records: built.records, verified: true };
}

/** Remove nightly copies older than 90 days (year-end and on-demand copies stay). */
export async function pruneNightly(admin: SupabaseClient) {
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86400000).toISOString();
  const { data } = await admin.from("reqgen_backup_log").select("storage_path").eq("mode", "nightly").lt("created_at", cutoff).not("storage_path", "is", null).limit(500);
  const paths = ((data || []) as Array<{ storage_path: string }>).map((r) => r.storage_path).filter(Boolean);
  if (paths.length) await admin.storage.from(BACKUP_BUCKET).remove(paths);
  return paths.length;
}
