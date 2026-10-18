"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useFinancePowers } from "@/lib/v4/financePowers";
import { confirmFresh } from "@/lib/v4/freshConfirm";
import { nairaExact } from "@/lib/v4/money";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Card, Chip, Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

type Scope = "finance" | "vouchers" | "requests";
type PreviewRow = { part: string; item: string; rows: number; note: string };
type Backup = { id: string; path: string; records: number; tables: number; bytes: number; at: number };
type Totals = Record<string, number>;
type Done = { reset_no: string; cleared: Record<string, number>; before: Totals; after: Totals };
type ResetRow = { id: string; reset_no: string; scopes: string[]; reason: string; backup_path: string | null; verified: boolean; reset_label: string; created_at: string; before_totals: Totals };

const SCOPES: Array<{ key: Scope; title: string; about: string }> = [
  { key: "finance", title: "Finance records (always)", about: "Ledger lines, account transactions, transfers, reversals and reconciliations. Every subhead and IET account figure goes to ₦0.00." },
  { key: "vouchers", title: "Payment vouchers", about: "Every voucher with its lines, signing history, transfer schedule and attachments list." },
  { key: "requests", title: "Requests", about: "Every request with its history, attachments list, drafts and reminders. Needs the vouchers to be cleared too." },
];
const TABLE_TEXT: Record<string, string> = {
  iet_bank_ledger: "Bank ledger lines", iet_account_transactions: "Account transactions", finance_transactions: "Finance transactions",
  reqgen_transfers: "Transfers", account_transfers: "Old account transfers", reqgen_finance_reversals: "Reversals", finance_activity_history: "Finance activity",
  reqgen_reconciliations: "Bank reconciliations", payment_vouchers: "Payment vouchers", payment_voucher_items: "Voucher lines",
  payment_voucher_history: "Voucher signing history", reqgen_pv_attachments: "Voucher attachments", reqgen_pv_transfer_schedule: "Transfer schedules",
  manual_payment_voucher_audit: "Manual voucher history", requests: "Requests", request_history: "Request history", request_attachments: "Request attachments",
  reqgen_request_drafts: "Drafts", reqgen_reminder_log: "Reminders", subheads: "Subheads", iet_accounts: "IET accounts",
};
const KEPT = ["Staff accounts, sign-ins, 2FA, fingerprints and passcodes", "Positions, departments and routing", "Subhead names, codes and IDs", "IET account names and bank details", "Settings, signatories and security rules", "The Audit Log, backups and the record of every reset"];

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

/**
 * Administration › Financial Reset (v4.6.3, Super Admin only). Clears the finance test
 * records and sets every subhead and IET account figure to ₦0.00, after a preview, a
 * verified backup, the 2FA code and the typed words RESET FINANCE. The database does it in
 * one transaction and checks the result; if anything fails, nothing changes.
 */
export default function FinanceResetPage() {
  const me = useIdentity();
  const [scopes, setScopes] = useState<Set<Scope>>(new Set(["finance", "vouchers", "requests"]));
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState<"backup" | "reset" | null>(null);
  const [msg, setMsg] = useState<{ tone: "green" | "red" | "amber"; text: string } | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [history, setHistory] = useState<ResetRow[]>([]);
  const [clock, setClock] = useState(() => Date.now());

  const powers = useFinancePowers(me.userId, me.role);
  const isSuperAdmin = powers.canReset;
  const scopeList = SCOPES.map((s) => s.key).filter((k) => scopes.has(k));

  useEffect(() => {
    if (!me.ready || !me.userId) return;
    queueMicrotask(async () => {
      const [h] = await Promise.all([
        supabase.from("reqgen_finance_resets").select("id,reset_no,scopes,reason,backup_path,verified,reset_label,created_at,before_totals").order("created_at", { ascending: false }).limit(20),
      ]);
      setHistory((h.data || []) as ResetRow[]);
    });
  }, [me.ready, me.userId, done]);

  const loadPreview = useCallback(async (list: Scope[]) => {
    setPreview(null); setPreviewError(null);
    const { data, error } = await supabase.rpc("reqgen_finance_reset_preview", { p_scopes: list });
    if (error) { setPreviewError(/does not exist|schema cache/i.test(error.message) ? "The Financial Reset is switched on by the v4.6.3 database step (database/v4_6_3_finance_integrity_reset.sql)." : error.message); setPreview([]); return; }
    setPreview(((data || []) as PreviewRow[]).map((r) => ({ ...r, rows: Number(r.rows) })));
  }, []);
  const scopeKey = scopeList.join(",");
  useEffect(() => { if (isSuperAdmin) queueMicrotask(() => { void loadPreview(scopeKey.split(",") as Scope[]); }); }, [isSuperAdmin, loadPreview, scopeKey]);
  useEffect(() => { const t = window.setInterval(() => setClock(Date.now()), 30000); return () => window.clearInterval(t); }, []);

  function toggle(k: Scope) {
    if (k === "finance") return;
    setBackup(null);
    setScopes((cur) => {
      const next = new Set(cur);
      if (next.has(k)) { next.delete(k); if (k === "vouchers") next.delete("requests"); } else { next.add(k); if (k === "requests") next.add("vouchers"); }
      return next;
    });
  }

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/finance/reset", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` }, body: JSON.stringify(body) });
    return (await res.json().catch(() => ({ ok: false, error: "The server did not answer." }))) as { ok: boolean; error?: string; backup?: Omit<Backup, "at">; result?: Done };
  }

  async function takeBackup() {
    setMsg(null);
    const why = await confirmFresh("take the backup before the reset", { codeOnly: true });
    if (why) { if (why !== "cancelled") setMsg({ tone: "red", text: why }); return; }
    setBusy("backup");
    const out = await post({ action: "backup" });
    setBusy(null);
    if (!out.ok || !out.backup) { setMsg({ tone: "red", text: out.error || "The backup failed. Nothing was reset." }); return; }
    setBackup({ ...out.backup, at: Date.now() });
    setMsg({ tone: "green", text: "The backup is stored, read back and checked. You can now reset within the next hour." });
  }

  async function reset() {
    setMsg(null);
    if (!backup) return;
    const why = await confirmFresh("reset the finance records", { codeOnly: true });
    if (why) { if (why !== "cancelled") setMsg({ tone: "red", text: why }); return; }
    setBusy("reset");
    const out = await post({ action: "reset", backupId: backup.id, scopes: scopeList, confirm: typed, reason: reason.trim() });
    setBusy(null);
    if (!out.ok || !out.result) { setMsg({ tone: "red", text: out.error || "The reset failed. Nothing was changed." }); return; }
    setDone(out.result); setBackup(null); setTyped(""); setReason("");
    void loadPreview(scopeList);
  }

  const cleared = (preview || []).filter((r) => r.note === "will be cleared");
  const blockers = (preview || []).filter((r) => r.part === "blocker");
  const keptRows = (preview || []).filter((r) => r.note.startsWith("kept"));
  const backupFresh = !!backup && clock - backup.at < 55 * 60000;
  const ready = isSuperAdmin && backupFresh && !blockers.length && reason.trim().length >= 10 && typed === "RESET FINANCE" && !busy;

  if (me.ready && powers.ready && !isSuperAdmin) {
    return (
      <V4Page>
        <PageHead title="Financial Reset" sub="Clear the finance test records and start the new year at ₦0.00." />
        <Notice tone="amber" title="Only the Super Admin can reset the finance records">
          {powers.reason && /Acting as/.test(powers.reason) ? powers.reason : "Sign in as the Super Admin and act as Super Admin. The Developer and other positions cannot run a reset."}
        </Notice>
        <Notice tone="blue">To fix one wrong total without clearing everything, use <Link href="/finance/integrity">Finance › Integrity</Link>.</Notice>
      </V4Page>
    );
  }

  return (
    <V4Page>
      <PageHead title="Financial Reset" sub="Clear the finance test records and start at ₦0.00. Staff, departments, subhead names and bank details are kept." />
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}

      {done ? (
        <section className="v4-card v4-card-pad">
          <div className="v4-section-title"><span className="v4-no"><Icon name="tick" size="sm" /></span><h2 className="v4-h2">{done.reset_no} — reset complete and checked</h2></div>
          <div className="v4-cols">
            <dl className="v4-kv">
              <dt>Subheads — allocated</dt><dd>{nairaExact(done.before.subheads_allocated)} → {nairaExact(done.after.subheads_allocated)}</dd>
              <dt>Subheads — spent</dt><dd>{nairaExact(done.before.subheads_spent)} → {nairaExact(done.after.subheads_spent)}</dd>
              <dt>Subheads — reserved</dt><dd>{nairaExact(done.before.subheads_reserved)} → {nairaExact(done.after.subheads_reserved)}</dd>
              <dt>IET accounts — total fund</dt><dd>{nairaExact(done.before.accounts_total_fund)} → {nairaExact(done.after.accounts_total_fund)}</dd>
              <dt>IET accounts — available</dt><dd>{nairaExact(done.before.accounts_available)} → {nairaExact(done.after.accounts_available)}</dd>
            </dl>
            <dl className="v4-kv">
              {Object.entries(done.cleared).map(([t, n]) => <span key={t} style={{ display: "contents" }}><dt>{TABLE_TEXT[t] || t}</dt><dd>{n} cleared</dd></span>)}
            </dl>
          </div>
          <div style={{ marginTop: 14 }}><Notice tone="green">Every figure now reads ₦0.00. Next: the Auditor sets each IET account&rsquo;s fund from the bank statement, then gives each subhead its allocation in Finance › Budget &amp; Subheads.</Notice></div>
        </section>
      ) : null}

      <section className="v4-card v4-card-pad">
        <div className="v4-section-title"><span className="v4-no">1</span><h2 className="v4-h2">Choose what to clear</h2></div>
        <div style={{ display: "grid", gap: 12 }}>
          {SCOPES.map((s) => (
            <label key={s.key} className="v4-check">
              <input type="checkbox" checked={scopes.has(s.key)} disabled={s.key === "finance" || !!busy} onChange={() => toggle(s.key)} />
              <span><b>{s.title}</b><span className="v4-help" style={{ display: "block" }}>{s.about}</span></span>
            </label>
          ))}
        </div>
      </section>

      <div className="v4-cols">
        <Card title="2 · What the reset will clear">
          {preview === null ? <div className="v4-card-body"><Skeleton lines={6} /></div> : previewError ? <div className="v4-card-body"><Notice tone="amber">{previewError}</Notice></div> : (
            <div className="v4-table-wrap">
              <table className="v4-data v4-stack">
                <thead><tr><th>Records</th><th className="v4-r">Now</th><th>After the reset</th></tr></thead>
                <tbody>
                  {cleared.map((r) => <tr key={r.item}><td><span className="v4-strong">{TABLE_TEXT[r.item] || r.item}</span></td><td className="v4-r v4-num" data-label="Now">{r.rows}</td><td data-label="After"><Chip tone={r.rows ? "red" : "grey"}>{r.rows ? "Cleared" : "Already empty"}</Chip></td></tr>)}
                  {keptRows.map((r) => <tr key={r.item}><td><span className="v4-strong">{TABLE_TEXT[r.item] || r.item}</span></td><td className="v4-r v4-num" data-label="Now">{r.rows}</td><td data-label="After"><Chip tone="green">Kept · figures to ₦0.00</Chip></td></tr>)}
                </tbody>
              </table>
            </div>
          )}
          {blockers.length ? <div className="v4-card-body"><Notice tone="red" title="The reset cannot run yet">{blockers.map((b) => `${b.item}: ${b.rows} row(s) ${b.note}`).join(" · ")}</Notice></div> : null}
        </Card>
        <Card title="Always kept" pad>
          <ul className="v4-access" style={{ gridTemplateColumns: "1fr" }}>
            {KEPT.map((k) => <li key={k} className="v4-yes" style={{ listStyle: "none" }}><Icon name="check" />{k}</li>)}
          </ul>
        </Card>
      </div>

      <section className="v4-card v4-card-pad">
        <div className="v4-section-title"><span className="v4-no">3</span><h2 className="v4-h2">Take a verified backup</h2></div>
        <p className="v4-help" style={{ margin: "0 0 12px" }}>A full copy of ReqGen is stored in the private backups store, read back and checked record by record. It is required, and it is how you undo a reset (Audit › Master Backup › Restore).</p>
        {backup ? (
          <Notice tone={backupFresh ? "green" : "amber"} title={backupFresh ? "Backup verified" : "This backup is more than an hour old — take a new one"}>
            {backup.records.toLocaleString("en-GB")} records in {backup.tables} tables · {(backup.bytes / 1024).toFixed(0)} KB · {backup.path}
          </Notice>
        ) : null}
        <button className="v4-btn v4-btn-secondary" type="button" disabled={!isSuperAdmin || !!busy || !!blockers.length} onClick={() => void takeBackup()}><Icon name="database" />{busy === "backup" ? "Backing up and checking…" : backupFresh ? "Take a new backup" : "Confirm with 2FA and take the backup"}</button>
      </section>

      <section className="v4-card v4-card-pad v4-danger-zone">
        <div className="v4-section-title"><span className="v4-no">4</span><h2 className="v4-h2">Confirm and reset</h2></div>
        <div className="v4-form-grid">
          <label className="v4-field v4-span-2"><span className="v4-flabel">Reason <span className="v4-req">*</span></span>
            <textarea className="v4-input" rows={2} value={reason} placeholder="e.g. Clearing the pilot test records before the 2026/27 financial year starts." onChange={(e) => setReason(e.target.value)} disabled={!backupFresh || !!busy} />
          </label>
          <label className="v4-field"><span className="v4-flabel">Type RESET FINANCE <span className="v4-req">*</span></span>
            <input className="v4-input" value={typed} autoComplete="off" spellCheck={false} onChange={(e) => setTyped(e.target.value)} disabled={!backupFresh || !!busy} placeholder="RESET FINANCE" />
          </label>
        </div>
        <p className="v4-help" style={{ margin: "12px 0" }}>The database clears everything in one step and checks that every figure reads ₦0.00. If anything fails, nothing at all is changed. The reset is kept in the record below and in the Audit Log, and the DG and the Auditor are told.</p>
        <button className="v4-btn v4-btn-danger" type="button" disabled={!ready} onClick={() => void reset()}><Icon name="alert" />{busy === "reset" ? "Resetting and checking…" : "Confirm with 2FA and reset the finance records"}</button>
      </section>

      <Card title="Resets done">
        {history.length ? (
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Reset</th><th>Cleared</th><th className="v4-hide-md">Reason</th><th>Checked</th><th className="v4-hide-sm">Backup</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td><span className="v4-strong">{h.reset_no}</span><span className="v4-sub">{h.reset_label} · {new Date(h.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span></td>
                    <td data-label="Cleared">{h.scopes.join(", ")}</td>
                    <td className="v4-hide-md">{h.reason}</td>
                    <td data-label="Checked">{h.verified ? <Chip tone="green">All ₦0.00</Chip> : <Chip tone="red">Not checked</Chip>}</td>
                    <td className="v4-hide-sm">{h.backup_path || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="v4-muted" style={{ padding: 20, margin: 0 }}>No reset has been done.</p>}
      </Card>
    </V4Page>
  );
}
