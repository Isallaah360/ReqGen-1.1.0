import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildBackup, backupFileName } from "@/lib/server/backupBuild";
import { currentFyStart, fyLabel } from "@/lib/financialYear";

/**
 * ReqGen v4.5 — keep backup copies in the private "backups" storage bucket
 * (server only). Nightly copies are kept for 90 days; year-end copies for ever.
 */
export const BACKUP_BUCKET = "backups";
export const KEEP_DAYS = 90;

export async function storeBackup(admin: SupabaseClient, opts: { year?: number | null; mode: "nightly" | "on demand" | "year-end"; actorId: string | null; actorName: string }) {
  const year = opts.year === undefined ? currentFyStart() : opts.year;
  const built = await buildBackup(admin, year, opts.actorName);
  const stamp = built.generatedAt.replace(/[:.]/g, "-");
  const path = `${opts.mode === "year-end" ? "year-end" : opts.mode === "nightly" ? "nightly" : "manual"}/${year ? `FY${year}` : "all"}/${stamp}_${backupFileName(year, built.generatedAt)}`;
  const up = await admin.storage.from(BACKUP_BUCKET).upload(path, built.zip, { contentType: "application/zip", upsert: false });
  if (up.error) throw new Error(`The backup was built but could not be stored: ${up.error.message}`);
  const logged = await admin.from("reqgen_backup_log").insert({
    action: "backup", financial_year: year ? fyLabel(year) : "all", mode: opts.mode, actor_id: opts.actorId, actor_name: opts.actorName,
    storage_path: path, bytes: built.zip.byteLength, summary: { tables: built.tables, records: built.records, bytes: built.zip.byteLength },
  });
  if (logged.error) throw new Error(`The backup was stored at ${path} but could not be logged: ${logged.error.message}`);
  return { path, bytes: built.zip.byteLength, tables: built.tables, records: built.records };
}

/** Remove nightly copies older than 90 days (year-end and on-demand copies stay). */
export async function pruneNightly(admin: SupabaseClient) {
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86400000).toISOString();
  const { data } = await admin.from("reqgen_backup_log").select("storage_path").eq("mode", "nightly").lt("created_at", cutoff).not("storage_path", "is", null).limit(500);
  const paths = ((data || []) as Array<{ storage_path: string }>).map((r) => r.storage_path).filter(Boolean);
  if (paths.length) await admin.storage.from(BACKUP_BUCKET).remove(paths);
  return paths.length;
}
