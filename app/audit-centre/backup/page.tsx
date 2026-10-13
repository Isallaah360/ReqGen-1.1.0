"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { confirmDialog } from "@/lib/dialog";
import { confirmFresh } from "@/lib/v4/freshConfirm";
import { currentFyStart, fyLabel, fyRangeText } from "@/lib/financialYear";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Card, Chip, Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

/**
 * ReqGen v4.5 — Audit › Master Backup (mock-up 78).
 * A full copy is kept every night at 02:00 (Vercel cron → /api/backup/nightly).
 * Admin and the Auditor can download, preview and "Back up now";
 * only the Administrator can restore (with a fresh fingerprint or 2FA code).
 */

type Report = { table: string; label: string; inFile: number; existing: number | null; missing: number | null; written: number; status: string; note: string };
type RestoreResult = { ok: boolean; error?: string; mode: string; year: string; file: string; totals: { inFile: number; missing: number; written: number }; reports: Report[] };
type LogRow = { id: string; action: string; financial_year: string | null; mode: string | null; actor_name: string | null; created_at: string; bytes: number | null; summary: Record<string, unknown> | null };
type Stored = { id: string; created_at: string; financial_year: string | null; mode: string | null; actor_name: string | null; storage_path: string; bytes: number | null; url: string | null; summary: { tables?: number } | null };

async function token() {
  const { data } = await supabase.auth.getSession();
  const value = data.session?.access_token;
  if (!value) throw new Error("Your session has expired. Please sign in again.");
  return value;
}

const when = (d: string) => new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const size = (b: number | null | undefined) => (!b ? "—" : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const tablesOf = (s: Record<string, unknown> | null) => (s && typeof s.tables === "number" ? s.tables : null);

function logTitle(l: LogRow) {
  const fy = l.financial_year && l.financial_year !== "all" ? `FY ${l.financial_year}` : "all years";
  if (l.action === "restore") return `Restored ${fy} (${l.mode === "overwrite" ? "overwrite" : "missing records"})`;
  if (l.action === "preview") return `Previewed ${fy}`;
  if (l.mode === "nightly") return "Nightly backup";
  if (l.mode === "year-end") return `Year-end copy — ${fy}`;
  if (l.mode === "download") return `Downloaded ${fy}`;
  return `Backed up ${fy}`;
}
function logChip(l: LogRow) {
  if (l.action === "restore") return <Chip tone="red">Restore</Chip>;
  if (l.action === "preview") return <Chip tone="grey">Preview</Chip>;
  if (l.mode === "download") return <Chip tone="blue">Download</Chip>;
  if (l.mode === "year-end") return <Chip tone="brand">Year end</Chip>;
  return <Chip tone="green">Done</Chip>;
}

export default function MasterBackupPage() {
  const me = useIdentity();
  const isAdmin = me.roleSet.has("admin");
  const thisFy = currentFyStart();
  const years = Array.from({ length: Math.min(3, Math.max(1, thisFy - 2023)) }, (_, i) => thisFy - i);
  const [log, setLog] = useState<LogRow[] | null>(null);
  const [stored, setStored] = useState<Stored[]>([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const [pick, setPick] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("reqgen_backup_log").select("id,action,financial_year,mode,actor_name,created_at,bytes,summary").order("created_at", { ascending: false }).limit(30);
    setLog((data || []) as LogRow[]);
    try {
      const res = await fetch("/api/backup/files", { headers: { Authorization: `Bearer ${await token()}` } });
      const body = (await res.json()) as { ok: boolean; files?: Stored[] };
      setStored(body.ok ? body.files || [] : []);
    } catch { setStored([]); }
  }, []);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void load(); }); }, [me.ready, load]);

  const latestFor = (fy: number) => stored.find((s) => s.financial_year === fyLabel(fy));
  const lastNightly = stored.find((s) => s.mode === "nightly") || stored[0];

  async function download(fy: number | "all") {
    setBusy(`dl-${fy}`); setMessage(null);
    try {
      const res = await fetch("/api/backup/export", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ year: String(fy) }) });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "The backup could not be created.");
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || `ReqGen_Master_Backup_${fy}.zip`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setMessage({ tone: "green", text: `Downloaded ${name} (${size(blob.size)}). Open it once to check it, then keep it somewhere safe.` });
      await load();
    } catch (e) { setMessage({ tone: "red", text: e instanceof Error ? e.message : "The backup could not be created." }); }
    finally { setBusy(""); }
  }

  async function backupNow() {
    setBusy("now"); setMessage(null);
    try {
      const res = await fetch("/api/backup/snapshot", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ year: String(thisFy) }) });
      const body = (await res.json()) as { ok: boolean; error?: string; bytes?: number; tables?: number };
      if (!body.ok) throw new Error(body.error || "The backup failed.");
      setMessage({ tone: "green", text: `Backup kept: FY ${fyLabel(thisFy)} · ${size(body.bytes)} · ${body.tables ?? "all"} tables.` });
      await load();
    } catch (e) { setMessage({ tone: "red", text: e instanceof Error ? e.message : "The backup failed." }); }
    finally { setBusy(""); }
  }

  async function run(mode: "preview" | "missing" | "overwrite", path?: string) {
    const source = path || pick;
    if (!source && !file) { setMessage({ tone: "red", text: "Choose a stored backup or a backup file first." }); return; }
    if (mode !== "preview") {
      const ok = await confirmDialog({
        title: mode === "missing" ? "Restore missing records?" : "Overwrite with the backup?",
        message: mode === "missing"
          ? "Records in the backup that no longer exist in ReqGen will be added back. Existing records are not changed."
          : "Records in ReqGen will be replaced with the copy in the backup, and missing ones added back.",
        details: ["Nothing is deleted.", "Preview first if you have not.", "This is recorded in the backup log and the Audit Log."],
        confirmLabel: mode === "missing" ? "Restore missing records" : "Overwrite with backup",
        tone: mode === "overwrite" ? "danger" : "warning",
      });
      if (!ok) return;
      const fresh = await confirmFresh("restore from a backup");
      if (fresh) { if (fresh !== "cancelled") setMessage({ tone: "red", text: fresh }); return; }
    }
    setBusy(`r-${mode}`); setMessage(null);
    try {
      const form = new FormData();
      if (file && !path) form.append("file", file); else form.append("path", source);
      form.append("mode", mode);
      const res = await fetch("/api/backup/restore", { method: "POST", headers: { Authorization: `Bearer ${await token()}` }, body: form });
      const body = (await res.json()) as RestoreResult;
      if (!res.ok || !body.ok) throw new Error(body.error || "The backup could not be processed.");
      setResult(body);
      setMessage({ tone: "green", text: mode === "preview" ? `Preview: ${body.totals.inFile} records in the backup, ${body.totals.missing} not in ReqGen now.` : `Restore finished: ${body.totals.written} records written.` });
      await load();
    } catch (e) { setMessage({ tone: "red", text: e instanceof Error ? e.message : "The backup could not be processed." }); }
    finally { setBusy(""); }
  }

  const storedOptions = [{ value: "", label: file ? "Using the file you chose" : "Choose a stored backup" }, ...stored.map((s) => ({ value: s.storage_path, label: `${when(s.created_at)} · ${s.financial_year && s.financial_year !== "all" ? `FY ${s.financial_year}` : "All years"} · ${size(s.bytes)}${s.mode === "nightly" ? " · nightly" : s.mode === "year-end" ? " · year end" : ""}` }))];

  return (
    <V4Page>
      <PageHead title="Master Backup" sub="A full copy of ReqGen is taken every night at 02:00. Download any financial year; only the Administrator can restore."
        actions={[{ label: busy === "now" ? "Backing up…" : "Back up now", icon: "database", kind: "primary", disabled: busy !== "", onClick: () => void backupNow() }]} />
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {log === null ? <Skeleton lines={2} /> : lastNightly ? (
        <Notice tone="green">Last backup <b>{when(lastNightly.created_at)}</b> · {size(lastNightly.bytes)} · {lastNightly.summary?.tables ?? "all"} tables · nightly copies kept for 90 days, year-end copies kept for ever.</Notice>
      ) : <Notice tone="amber">No stored backup yet. The first nightly copy is taken at 02:00, or press <b>Back up now</b>.</Notice>}
      <Notice tone="blue"><b>Year end (31 August):</b> ReqGen makes the full year copy, you download it and check it opens, then the Super Admin clears that closed year from the live database. The database stays small, and every year is kept safely in its file.</Notice>

      <section className="v4-fycards">
        {years.map((fy) => {
          const last = latestFor(fy);
          return (
            <article key={fy} className="v4-fycard" data-fy={fy}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span className="v4-fy">FY {fyLabel(fy)}</span>{fy === thisFy ? <Chip tone="amber">Current year</Chip> : <Chip tone="green">Closed</Chip>}</div>
              <p className="v4-help">{fyRangeText(fy)} · requests, vouchers, ledger, registry, audit log</p>
              <dl className="v4-kv"><dt>Size</dt><dd>{size(last?.bytes)}</dd><dt>Last copy</dt><dd>{last ? `${when(last.created_at)}${last.mode === "year-end" ? " (year end)" : ""}` : "None kept yet"}</dd></dl>
              <div className="v4-acts">
                <button className="v4-btn v4-btn-primary" type="button" disabled={busy !== ""} onClick={() => void download(fy)}><Icon name="download" />{busy === `dl-${fy}` ? "Preparing…" : "Download"}</button>
                <button className="v4-btn v4-btn-secondary" type="button" disabled={busy !== "" || !last} title={last ? undefined : "No stored copy for this year yet"} onClick={() => last && void run("preview", last.storage_path)}><Icon name="eye" />Preview</button>
              </div>
            </article>
          );
        })}
      </section>

      {result ? (
        <Card title={`${result.mode === "preview" ? "Preview" : "Restore result"} — ${result.file}`}>
          <p className="v4-muted" style={{ margin: "0 18px 10px" }}>Financial year in file: {result.year || "—"} · {result.totals.inFile} records · {result.totals.missing} not in ReqGen{result.mode !== "preview" ? ` · ${result.totals.written} written` : ""}</p>
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Table</th><th className="v4-num">In backup</th><th className="v4-num">In ReqGen</th><th className="v4-num">Missing now</th>{result.mode !== "preview" ? <th className="v4-num">Written</th> : null}<th>Status</th></tr></thead>
              <tbody>{result.reports.map((r) => (
                <tr key={r.table}><td className="v4-strong">{r.label}</td><td className="v4-num">{r.inFile}</td><td className="v4-num">{r.existing ?? "—"}</td><td className="v4-num">{r.missing ?? "—"}</td>
                  {result.mode !== "preview" ? <td className="v4-num">{r.written}</td> : null}
                  <td>{r.status === "ok" ? <Chip tone="green">OK</Chip> : <Chip tone="amber">{`${r.status}: ${r.note}`}</Chip>}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <div className="v4-cols">
        <Card title="Backup log">
          {log === null ? <Skeleton lines={5} /> : log.length ? (
            <div className="v4-table-wrap">
              <table className="v4-data v4-stack">
                <thead><tr><th>When</th><th>What</th><th className="v4-hide-sm">Details</th><th>Type</th></tr></thead>
                <tbody>{log.map((l) => (
                  <tr key={l.id}>
                    <td className="v4-num">{new Date(l.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td><span className="v4-strong">{logTitle(l)}</span><span className="v4-sub">{l.mode === "nightly" ? "System" : l.actor_name || "—"}</span></td>
                    <td className="v4-hide-sm" data-label="Details">{l.action === "backup" ? `${size(l.bytes ?? (l.summary?.bytes as number | undefined))}${tablesOf(l.summary) ? ` · ${tablesOf(l.summary)} tables` : ""}` : `${String(l.summary?.inFile ?? "—")} records`}</td>
                    <td>{logChip(l)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>No backup recorded yet.</p>}
        </Card>

        <section className="v4-danger-zone v4-card-pad">
          <h2 className="v4-h2" style={{ marginBottom: 6 }}>Restore</h2>
          <p className="v4-help" style={{ margin: "0 0 14px" }}>Administrator only. Auditors can download and preview but not restore. Nothing is ever deleted by a restore.</p>
          <div className="v4-field"><span className="v4-flabel">Backup to restore</span>
            <Select ariaLabel="Backup to restore" value={pick} onChange={(v) => { setPick(v); if (v) setFile(null); setResult(null); }} options={storedOptions} disabled={busy !== ""} />
          </div>
          <label className="v4-field" style={{ marginTop: 10 }}><span className="v4-flabel">Or a backup file you downloaded</span>
            <span className="v4-control"><Icon name="upload" /><input className="v4-input" type="file" accept=".zip,.csv" disabled={busy !== ""} onChange={(e) => { setFile(e.target.files?.[0] || null); if (e.target.files?.[0]) setPick(""); setResult(null); }} /></span>
          </label>
          <div className="v4-form-actions" style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="v4-btn v4-btn-secondary" type="button" disabled={busy !== "" || (!pick && !file)} onClick={() => void run("preview")}><Icon name="eye" />{busy === "r-preview" ? "Checking…" : "Preview"}</button>
            {isAdmin ? (
              <>
                <button className="v4-btn v4-btn-primary" type="button" disabled={busy !== "" || (!pick && !file)} onClick={() => void run("missing")}><Icon name="returned" />{busy === "r-missing" ? "Restoring…" : "Restore missing records"}</button>
                <button className="v4-btn v4-btn-danger" type="button" disabled={busy !== "" || (!pick && !file)} onClick={() => void run("overwrite")}><Icon name="alert" />{busy === "r-overwrite" ? "Restoring…" : "Restore…"}</button>
              </>
            ) : null}
          </div>
          {busy.startsWith("r-") ? <p className="v4-help" style={{ marginTop: 10 }}>Working… large backups can take up to a minute.</p> : null}
        </section>
      </div>
    </V4Page>
  );
}
