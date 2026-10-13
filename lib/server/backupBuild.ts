import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { strToU8, zipSync } from "fflate";
import { toCsv } from "@/lib/csv";
import { BACKUP_FORMAT, BACKUP_TABLES, BACKUP_VERSION } from "@/lib/server/backupCatalog";
import { fyBounds, fyLabel, fyRangeText } from "@/lib/financialYear";

/**
 * ReqGen — build the Master Backup zip (v3.1.8 format, unchanged).
 * Shared by the download route, "Back up now" and the nightly job (v4.5).
 *   00_README.txt / 01_MANIFEST.csv / 02_REQGEN_MASTER.csv / tables/NN_<table>.csv
 */
type Row = Record<string, unknown>;

function columnTypes(rows: Row[]) {
  const types: Record<string, string> = {};
  for (const row of rows) {
    for (const [k, v] of Object.entries(row)) {
      if (v === null || v === undefined) { types[k] = types[k] || "text"; continue; }
      const t = typeof v === "object" ? "json" : typeof v === "number" ? "number" : typeof v === "boolean" ? "boolean" : "text";
      if (!types[k] || types[k] === "text") types[k] = t;
    }
  }
  return types;
}

function summaryOf(row: Row) {
  const pick = ["request_no", "voucher_no", "title", "full_name", "name", "code", "payee_name", "status", "amount", "total_amount", "balance", "action_type"];
  return pick.filter((k) => row[k] !== undefined && row[k] !== null && row[k] !== "").map((k) => `${k}: ${String(row[k])}`).join(" | ");
}

export async function buildBackup(admin: SupabaseClient, yearNum: number | null, actorName: string) {
  const ctx = { admin, name: actorName };
  const from = yearNum ? fyBounds(yearNum).from : null;
  const to = yearNum ? fyBounds(yearNum).to : null;
  const files: Record<string, Uint8Array> = {};
  const manifest: Row[] = [];
  const master: Row[] = [];
  const generatedAt = new Date().toISOString();

  let index = 0;
  for (const entry of BACKUP_TABLES) {
    index++;
    const rows: Row[] = [];
    let status = "ok";
    let note = "";
    let filtered = Boolean(entry.dated && from);
    for (let page = 0; page < 200; page++) {
      let query = ctx.admin.from(entry.table).select("*").range(page * 1000, page * 1000 + 999);
      if (filtered) query = query.gte("created_at", from as string).lt("created_at", to as string);
      const { data, error } = await query;
      if (error) {
        if (filtered && /created_at/.test(error.message)) { filtered = false; note = "no created_at column: all years included"; page = -1; rows.length = 0; continue; }
        status = /does not exist|schema cache/i.test(error.message) ? "not present" : "error";
        note = error.message;
        break;
      }
      rows.push(...((data || []) as Row[]));
      if (!data || data.length < 1000) break;
    }

    const types = columnTypes(rows);
    const columns = Object.keys(types);
    const name = `tables/${String(index).padStart(2, "0")}_${entry.table}.csv`;
    if (status === "ok") files[name] = strToU8(toCsv(rows, columns));
    manifest.push({
      order: index, table: entry.table, group: entry.group, label: entry.label,
      financial_year: entry.dated && filtered && yearNum ? fyLabel(yearNum) : "all", rows: rows.length, status, note,
      file: status === "ok" ? name : "", columns_json: JSON.stringify(types),
    });
    for (const row of rows) {
      master.push({
        table: entry.table, group: entry.group, id: row.id ?? "",
        record_date: row.created_at ?? "", summary: summaryOf(row), data_json: JSON.stringify(row),
      });
    }
  }

  const readme = [
    "IET REQGEN — MASTER BACKUP",
    `Format: ${BACKUP_FORMAT} v${BACKUP_VERSION}`,
    `Financial year: ${yearNum ? `${fyLabel(yearNum)} (${fyRangeText(yearNum)}, by record date)` : "All years"}`,
    `Generated: ${generatedAt} by ${ctx.name}`,
    "",
    "HOW TO READ",
    "  01_MANIFEST.csv        lists every table, its row count and status.",
    "  02_REQGEN_MASTER.csv   every record in one sheet. Filter the 'table' column in Excel.",
    "  tables/*.csv           one sheet per table with all columns, ready for manual audit.",
    "",
    "HOW TO RESTORE",
    "  ReqGen > Audit Centre > Master Backup > Restore. Upload THIS zip file unchanged.",
    "  Preview first. 'Restore missing records' only adds records that are missing;",
    "  'Overwrite' replaces existing records with the backup copy. Nothing is ever deleted.",
    "",
    "NOTE  Signature, photo and attachment FILES stay in storage; the backup keeps their",
    "      paths, so restored requests and vouchers print with the stored signatures.",
  ].join("\r\n");

  files["00_README.txt"] = strToU8(readme);
  files["01_MANIFEST.csv"] = strToU8(toCsv([
    { order: 0, table: "__backup__", group: BACKUP_FORMAT, label: `version ${BACKUP_VERSION}`, financial_year: yearNum ? fyLabel(yearNum) : "all", rows: master.length, status: "ok", note: `generated ${generatedAt} by ${ctx.name}`, file: "", columns_json: "" },
    ...manifest,
  ]));
  files["02_REQGEN_MASTER.csv"] = strToU8(toCsv(master, ["table", "group", "id", "record_date", "summary", "data_json"]));

  const zip = zipSync(files, { level: 6 });
  return { zip, tables: manifest.length, records: master.length, generatedAt };
}

export function backupFileName(yearNum: number | null, generatedAt: string) {
  return `ReqGen_Master_Backup_${yearNum ? `FY${yearNum}-${String((yearNum + 1) % 100).padStart(2, "0")}` : "AllYears"}_${generatedAt.slice(0, 10)}.zip`;
}
