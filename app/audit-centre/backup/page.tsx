"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, DatabaseBackup, Download, Eye, FileArchive, History, RotateCcw, ShieldAlert, Upload } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { confirmDialog } from "@/lib/dialog";
import { PageHeader } from "@/app/components/ui/PageHeader";

/**
 * ReqGen v3.1.8 — Audit Centre → 2. Master Backup (Admin and Auditor).
 * 1. Download a master backup for a financial year (zip of CSV sheets).
 * 2. Preview a backup file, and (Admin) restore missing or all records.
 * 3. Backup and restore log.
 */

type Report = { table: string; label: string; inFile: number; existing: number | null; missing: number | null; written: number; status: string; note: string };
type RestoreResult = { ok: boolean; error?: string; mode: string; year: string; file: string; totals: { inFile: number; missing: number; written: number }; reports: Report[] };
type LogRow = { id: string; action: string; financial_year: string | null; mode: string | null; actor_name: string | null; created_at: string; summary: Record<string, unknown> | null };

const CONTENTS = [
  ["People", "User accounts, roles, HR assignments, role switches"],
  ["Requests", "Requests, approvals and signatures, attachment records and checks"],
  ["Payment vouchers", "Vouchers, items, signing and reminder history, PV signatories"],
  ["Budget and finance", "Subheads and balances, expenditure transactions, bank ledger, finance activity"],
  ["Banking", "IET bank accounts and balances, account officers, department account routing"],
  ["Workflow", "Route templates, steps, department routes, backups, availability"],
  ["Organisation and audit", "Departments, roles, settings, registry correspondence, audit log"],
];

async function token() {
  const { data } = await supabase.auth.getSession();
  const value = data.session?.access_token;
  if (!value) throw new Error("Your session has expired. Please sign in again.");
  return value;
}

function dateTime(d: string) {
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function MasterBackupPage() {
  const thisYear = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: thisYear - 2023 }, (_, i) => String(thisYear - i)), [thisYear]);
  const [year, setYear] = useState(String(thisYear));
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState<"" | "backup" | "restore">("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const [log, setLog] = useState<LogRow[]>([]);

  const loadLog = useCallback(async () => {
    const { data } = await supabase.from("reqgen_backup_log").select("id,action,financial_year,mode,actor_name,created_at,summary").order("created_at", { ascending: false }).limit(20);
    setLog((data || []) as LogRow[]);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void (async () => {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;
        const [profile, roles] = await Promise.all([
          supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle(),
          supabase.from("profile_roles").select("role_key,is_active").eq("profile_id", auth.user.id),
        ]);
        const keys = [profile.data?.role, ...((roles.data || []) as Array<{ role_key: string | null; is_active: boolean | null }>).filter((r) => r.is_active !== false).map((r) => r.role_key)];
        setIsAdmin(keys.some((k) => String(k || "").toLowerCase().replace(/[^a-z]/g, "") === "admin"));
        await loadLog();
      })();
    });
  }, [loadLog]);

  async function download() {
    setBusy("backup");
    setMessage(null);
    try {
      const response = await fetch("/api/backup/export", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ year }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "The backup could not be created.");
      }
      const blob = await response.blob();
      const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") || "")?.[1] || `ReqGen_Master_Backup_${year}.zip`;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 4000);
      setMessage({ tone: "ok", text: `Backup downloaded: ${name} (${(blob.size / 1024).toFixed(0)} KB). Keep it in a safe place.` });
      await loadLog();
    } catch (caught) {
      setMessage({ tone: "error", text: caught instanceof Error ? caught.message : "The backup could not be created." });
    } finally {
      setBusy("");
    }
  }

  async function run(mode: "preview" | "missing" | "overwrite") {
    if (!file) { setMessage({ tone: "error", text: "Choose the backup file first." }); return; }
    if (mode !== "preview") {
      const ok = await confirmDialog({
        title: mode === "missing" ? "Restore missing records?" : "Overwrite with the backup?",
        message: mode === "missing"
          ? "Records in the backup that no longer exist in ReqGen will be added back. Existing records are not changed."
          : "Records in ReqGen will be replaced with the copy in the backup, and missing ones added back.",
        details: ["Nothing is deleted.", "Run Preview first if you have not.", "This action is recorded in the backup log."],
        confirmLabel: mode === "missing" ? "Restore missing records" : "Overwrite with backup",
        tone: mode === "overwrite" ? "danger" : "warning",
      });
      if (!ok) return;
    }
    setBusy("restore");
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("mode", mode);
      const response = await fetch("/api/backup/restore", { method: "POST", headers: { Authorization: `Bearer ${await token()}` }, body: form });
      const body = (await response.json()) as RestoreResult;
      if (!response.ok || !body.ok) throw new Error(body.error || "The backup could not be processed.");
      setResult(body);
      setMessage({
        tone: "ok",
        text: mode === "preview"
          ? `Preview: ${body.totals.inFile} records in the file, ${body.totals.missing} not in ReqGen now.`
          : `Restore finished: ${body.totals.written} records written.`,
      });
      await loadLog();
    } catch (caught) {
      setMessage({ tone: "error", text: caught instanceof Error ? caught.message : "The backup could not be processed." });
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="rg-backup">
      <PageHeader title="Master Backup" description="Download a complete, auditable copy of ReqGen by financial year, and restore records from it." />

      {message ? <div className={`rg-pvd-message is-${message.tone}`} role="status">{message.text}</div> : null}

      <section className="rg-backup-grid">
        <article className="rg-backup-card is-download">
          <header><span><DatabaseBackup size={20} /></span><div><h2>1. Download a backup</h2><p>One zip file of CSV sheets you can open in Excel and audit by hand.</p></div></header>
          <label>Financial year
            <select value={year} onChange={(e) => setYear(e.target.value)} disabled={busy !== ""}>
              {years.map((y) => <option key={y} value={y}>{y} (1 Jan – 31 Dec)</option>)}
              <option value="all">All years</option>
            </select>
          </label>
          <ul className="rg-backup-files">
            <li><FileArchive size={15} /> <b>02_REQGEN_MASTER.csv</b> every record in one sheet — filter by table</li>
            <li><Archive size={15} /> <b>tables/*.csv</b> one full sheet per table</li>
            <li><Eye size={15} /> <b>01_MANIFEST.csv</b> row counts and status of every table</li>
          </ul>
          <button type="button" className="rg-btn rg-btn-primary" onClick={() => void download()} disabled={busy !== ""}>
            <Download size={16} /> {busy === "backup" ? "Preparing backup..." : `Download backup${year === "all" ? " (all years)" : ` for ${year}`}`}
          </button>
        </article>

        <article className="rg-backup-card is-restore">
          <header><span><RotateCcw size={20} /></span><div><h2>2. Restore from a backup</h2><p>Upload the backup zip unchanged (or its master CSV). Preview first.</p></div></header>
          <label className="rg-backup-drop">
            <Upload size={18} />
            <span>{file ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB` : "Choose the backup .zip or 02_REQGEN_MASTER.csv"}</span>
            <input type="file" accept=".zip,.csv" onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }} disabled={busy !== ""} />
          </label>
          <div className="rg-backup-actions">
            <button type="button" className="rg-btn rg-btn-secondary" onClick={() => void run("preview")} disabled={!file || busy !== ""}><Eye size={15} /> Preview</button>
            {isAdmin ? (
              <>
                <button type="button" className="rg-btn rg-btn-primary" onClick={() => void run("missing")} disabled={!file || busy !== ""}><RotateCcw size={15} /> Restore missing records</button>
                <button type="button" className="rg-btn rg-btn-danger" onClick={() => void run("overwrite")} disabled={!file || busy !== ""}><ShieldAlert size={15} /> Overwrite with backup</button>
              </>
            ) : <p className="rg-backup-hint">The Auditor can preview a backup. Restoring records is done by the Administrator.</p>}
          </div>
          {busy === "restore" ? <p className="rg-backup-hint">Working... large backups can take up to a minute.</p> : null}
        </article>
      </section>

      {result ? (
        <section className="rg-backup-report">
          <header><h2>{result.mode === "preview" ? "Preview" : "Restore result"} — {result.file}</h2><p>Financial year in file: {result.year || "—"} · {result.totals.inFile} records · {result.totals.missing} not in ReqGen{result.mode !== "preview" ? ` · ${result.totals.written} written` : ""}</p></header>
          <div className="rg-register-table">
            <table>
              <thead><tr><th>Table</th><th>In backup</th><th>Already in ReqGen</th><th>Missing now</th>{result.mode !== "preview" ? <th>Written</th> : null}<th>Status</th></tr></thead>
              <tbody>
                {result.reports.map((r) => (
                  <tr key={r.table}>
                    <td>{r.label}</td><td>{r.inFile}</td><td>{r.existing ?? "—"}</td><td>{r.missing ?? "—"}</td>
                    {result.mode !== "preview" ? <td>{r.written}</td> : null}
                    <td className="rg-col-text">{r.status === "ok" ? "OK" : `${r.status}: ${r.note}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="rg-backup-grid">
        <article className="rg-backup-card">
          <header><span><Archive size={20} /></span><div><h2>What a backup contains</h2><p>Everything ReqGen records. Signature, photo and attachment files stay in storage; their paths are kept.</p></div></header>
          <dl className="rg-backup-contents">{CONTENTS.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </article>
        <article className="rg-backup-card">
          <header><span><History size={20} /></span><div><h2>3. Backup log</h2><p>Every download, preview and restore.</p></div></header>
          <ul className="rg-backup-log">
            {log.length ? log.map((l) => (
              <li key={l.id}>
                <b>{l.action === "backup" ? "Backup" : l.action === "restore" ? `Restore (${l.mode})` : "Preview"}</b>
                <span>{l.financial_year || "all years"} · {l.actor_name || "—"}</span>
                <em>{dateTime(l.created_at)}</em>
              </li>
            )) : <li className="rg-backup-hint">No backup recorded yet.</li>}
          </ul>
        </article>
      </section>
    </main>
  );
}
