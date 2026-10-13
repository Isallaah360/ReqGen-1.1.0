"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { normalizeRole } from "@/lib/roles";
import { confirmDialog, promptDialog } from "@/lib/dialog";
import { fyOf } from "@/lib/v4/finance";
import { formatAmountInput, nairaExact, parseAmount } from "@/lib/v4/money";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

type Year = { fy_start: number; status: string; locked_by_label: string | null; locked_at: string | null; lock_note: string | null; unlocked_by_label: string | null; unlocked_at: string | null; unlock_reason: string | null; closed_by_label: string | null; closed_at: string | null };
type Log = { key: string; new_value: string | null; changed_by_label: string | null; changed_at: string };

const label = (y: number) => `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const SETTING_NAME: Record<string, string> = { default_payment_method: "Default payment method", cash_dg_note_above: "Large cash limit" };

/** Finance › Finance Settings (mock-up 45). Saved for everyone; every change logged. */
export default function FinanceSettingsPage() {
  const me = useIdentity();
  const role = normalizeRole(me.role);
  const isAdmin = role === "admin";
  const canEdit = isAdmin || role === "auditor";
  const fy = fyOf();
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<Year | null>(null);
  const [method, setMethod] = useState("Transfer");
  const [cashLimit, setCashLimit] = useState("200,000");
  const [saved, setSaved] = useState<{ method: string; cash: string }>({ method: "Transfer", cash: "200000" });
  const [log, setLog] = useState<Log[]>([]);
  const [msg, setMsg] = useState<{ tone: "red" | "green" | "amber"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notReady, setNotReady] = useState(false);

  const load = useCallback(async () => {
    const [y, s, l] = await Promise.all([
      supabase.from("reqgen_financial_years").select("*").eq("fy_start", fy).maybeSingle(),
      supabase.from("reqgen_finance_settings").select("key,value"),
      supabase.from("reqgen_finance_settings_log").select("key,new_value,changed_by_label,changed_at").order("changed_at", { ascending: false }).limit(5),
    ]);
    if (s.error && /does not exist|schema cache/i.test(s.error.message)) setNotReady(true);
    setYear((y.data || null) as Year | null);
    const m = Object.fromEntries(((s.data || []) as Array<{ key: string; value: string | null }>).map((r) => [r.key, r.value || ""]));
    const pm = m.default_payment_method || "Transfer";
    const cl = m.cash_dg_note_above || "200000";
    setMethod(pm); setCashLimit(formatAmountInput(cl)); setSaved({ method: pm, cash: cl });
    setLog((l.data || []) as Log[]);
    setLoading(false);
  }, [fy]);
  useEffect(() => { if (me.ready) queueMicrotask(() => { void load(); }); }, [me.ready, load]);

  async function save() {
    const cash = parseAmount(cashLimit);
    if (!Number.isFinite(cash) || cash <= 0) { setMsg({ tone: "red", text: "Type the large-cash limit in naira." }); return; }
    setBusy(true); setMsg(null);
    const steps: Array<[string, string]> = [];
    if (method !== saved.method) steps.push(["default_payment_method", method]);
    if (String(cash) !== String(Number(saved.cash))) steps.push(["cash_dg_note_above", String(cash)]);
    for (const [k, v] of steps) {
      const { error } = await supabase.rpc("reqgen_save_finance_setting", { p_key: k, p_value: v });
      if (error) { setBusy(false); setMsg({ tone: "red", text: error.message }); return; }
    }
    setBusy(false);
    setMsg({ tone: "green", text: steps.length ? "Settings saved for everyone. The change is in the log." : "Nothing changed." });
    await load();
  }

  async function lockYear() {
    const note = await promptDialog({ title: `Lock the FY ${label(fy)} budget?`, message: "Subhead allocations can then change only through an approved transfer (Account Officer → Auditor → DG).", label: "Note (e.g. Approved by the Board on …)", required: false, confirmLabel: "Lock budget" });
    if (note === null) return;
    const { error } = await supabase.rpc("reqgen_fy_lock", { p_fy: fy, p_note: note || null });
    setMsg(error ? { tone: "red", text: error.message } : { tone: "green", text: `FY ${label(fy)} budget locked.` });
    await load();
  }
  async function unlockYear() {
    const reason = await promptDialog({ title: `Unlock the FY ${label(fy)} budget?`, message: "Allocations can then be edited directly again. The reason is kept.", label: "Reason", confirmLabel: "Unlock", tone: "danger" });
    if (!reason) return;
    const { error } = await supabase.rpc("reqgen_fy_unlock", { p_fy: fy, p_reason: reason });
    setMsg(error ? { tone: "red", text: error.message } : { tone: "green", text: `FY ${label(fy)} budget unlocked.` });
    await load();
  }
  async function closeYear() {
    const ok = await confirmDialog({ title: `Close FY ${label(fy)}?`, message: "Do this in August, after the year-end Master Backup is downloaded and checked. The next year opens automatically.", confirmLabel: "Close the year", tone: "danger" });
    if (!ok) return;
    const { error } = await supabase.rpc("reqgen_fy_close", { p_fy: fy, p_note: null });
    setMsg(error ? { tone: "red", text: error.message } : { tone: "green", text: `FY ${label(fy)} closed.` });
    await load();
  }

  if (loading) return <V4Page><PageHead title="Finance Settings" /><div className="v4-card"><Skeleton lines={8} /></div></V4Page>;
  const status = year?.status || "Open";
  const last = log[0];

  return (
    <V4Page>
      <PageHead title="Finance Settings" sub="Saved for everyone in ReqGen. Changes are recorded in the log." />
      {notReady ? <Notice tone="amber" title="Settings are switched on by the v4.2.0 database step.">Ask the Super Admin to run database/v4_2_0_finance.sql.</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {!canEdit ? <Notice tone="blue">Only the Super Admin and the Auditor change these settings. You are acting as {me.roleName}.</Notice> : null}
      <div className="v4-split">
        <form className="v4-card v4-card-pad" style={{ display: "flex", flexDirection: "column", gap: 24 }} onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <section><div className="v4-section-title"><span className="v4-no">1</span><h2 className="v4-h2">Financial year</h2></div>
            <div className="v4-form-grid">
              <div className="v4-field"><span className="v4-flabel">Starts on</span><span className="v4-locked"><Icon name="lock" size="sm" />1 September</span></div>
              <div className="v4-field"><span className="v4-flabel">Current year</span><span className="v4-locked">{label(fy)} (1 Sep {fy} – 31 Aug {fy + 1})</span></div>
              <div className="v4-field v4-span-2"><span className="v4-flabel">Budget</span>
                <div className="v4-fy-status">
                  <span className={`v4-chip v4-chip-${status === "Open" ? "green" : status === "Locked" ? "amber" : "grey"}`}>{status === "Locked" ? "Approved and locked" : status === "Closed" ? "Closed" : "Open for changes"}</span>
                  <span className="v4-help">{status === "Locked" ? `Locked by ${year?.locked_by_label || "—"} on ${when(year?.locked_at || null)}${year?.lock_note ? ` · “${year.lock_note}”` : ""}` : status === "Closed" ? `Closed by ${year?.closed_by_label || "—"} on ${when(year?.closed_at || null)}` : year?.unlocked_at ? `Unlocked by ${year.unlocked_by_label} on ${when(year.unlocked_at)}: “${year.unlock_reason}”` : "Allocations can be edited by the Super Admin and the Auditor."}</span>
                  <span className="v4-fy-actions">
                    {status === "Open" && canEdit ? <button type="button" className="v4-btn v4-btn-secondary" onClick={() => void lockYear()}><Icon name="lock" />Approve and lock budget</button> : null}
                    {status === "Locked" && isAdmin ? <button type="button" className="v4-btn v4-btn-ghost" onClick={() => void unlockYear()}>Unlock</button> : null}
                    {status !== "Closed" && isAdmin ? <button type="button" className="v4-btn v4-btn-ghost" style={{ color: "var(--v4-red)" }} onClick={() => void closeYear()}>Close the year</button> : null}
                  </span>
                </div></div>
            </div>
            <p className="v4-help" style={{ margin: "8px 0 0" }}>IET’s financial year runs September to August. Reports, backups and filters all use it. The year is closed in August, after the year-end backup.</p></section>

          <section><div className="v4-section-title"><span className="v4-no">2</span><h2 className="v4-h2">Numbering</h2></div>
            <div className="v4-form-grid">
              <div className="v4-field"><span className="v4-flabel">Payment vouchers</span><span className="v4-locked"><Icon name="lock" size="sm" />PV-{new Date().getFullYear()}-000001</span></div>
              <div className="v4-field"><span className="v4-flabel">Manual vouchers</span><span className="v4-locked"><Icon name="lock" size="sm" />MPV-{new Date().getFullYear()}-0001</span></div>
              <div className="v4-field"><span className="v4-flabel">Transfers</span><span className="v4-locked"><Icon name="lock" size="sm" />TRF-{new Date().getFullYear()}-0001</span></div>
              <div className="v4-field"><span className="v4-flabel">Requests</span><span className="v4-locked"><Icon name="lock" size="sm" />REQ-YYYYMM-NNNNNN</span></div>
            </div>
            <p className="v4-help" style={{ margin: "8px 0 0" }}>Numbers are given by the database, in order, and never reused — a cancelled voucher keeps its number.</p></section>

          <section><div className="v4-section-title"><span className="v4-no">3</span><h2 className="v4-h2">Defaults</h2></div>
            <div className="v4-form-grid">
              <div className="v4-field"><label className="v4-flabel" htmlFor="fs-method" style={{ fontSize: 13, fontWeight: 700 }}>Default payment method</label>
                <Select id="fs-method" value={method} onChange={setMethod} disabled={!canEdit} options={[{ value: "Transfer", label: "Transfer" }, { value: "Cheque", label: "Cheque" }, { value: "Cash", label: "Cash" }]} />
                <span className="v4-help">Chosen first when an officer treats a request. Payment ways are Transfer, Cheque and Cash only.</span></div>
              <label className="v4-field"><span className="v4-flabel">Cash payments above (₦) need a DG note</span>
                <input className="v4-input v4-num" inputMode="decimal" value={cashLimit} onChange={(e) => setCashLimit(formatAmountInput(e.target.value))} disabled={!canEdit} />
                <span className="v4-help">The DG adds a reason when authorising cash above {nairaExact(parseAmount(cashLimit) || 0)}.</span></label>
            </div></section>

          <section><div className="v4-section-title"><span className="v4-no">4</span><h2 className="v4-h2">Safeguards</h2></div>
            {[
              ["Posted records are locked", "Paid vouchers and approved transfers cannot be edited. Corrections go through a new record."],
              ["Spending above the subhead balance is blocked", "A request that the subhead cannot cover cannot be submitted (a draft can be saved)."],
              ["Signing, stamping and paying need fingerprint or 2FA", "Never the passcode alone."],
              ["Transfers change the ledgers only after the DG approves", "Account Officer → Auditor → Director General (or the General Secretary acting)."],
            ].map(([t, s]) => (
              <div key={t} className="v4-setting"><span><strong>{t}</strong><span>{s}</span></span><span className="v4-chip v4-chip-green"><Icon name="lock" size="sm" />Always on</span></div>
            ))}</section>

          {canEdit ? <div className="v4-form-actions"><button className="v4-btn v4-btn-primary" type="submit" disabled={busy || notReady}><Icon name="check" />{busy ? "Saving…" : "Save settings"}</button></div> : null}
        </form>
        <aside className="v4-side-stack">
          <section className="v4-card v4-card-pad"><h2 className="v4-h3" style={{ marginBottom: 10 }}>Last changed</h2>
            {last ? <dl className="v4-kv"><dt>By</dt><dd>{last.changed_by_label || "—"}</dd><dt>When</dt><dd>{when(last.changed_at)}</dd><dt>What</dt><dd>{SETTING_NAME[last.key] || last.key}</dd></dl> : <p className="v4-muted" style={{ margin: 0, fontSize: 13.5 }}>No change yet.</p>}
          </section>
          {log.length > 1 ? <section className="v4-card v4-card-pad"><h2 className="v4-h3" style={{ marginBottom: 10 }}>Earlier changes</h2>
            <ul className="v4-rows v4-compact-rows">{log.slice(1).map((l) => <li key={l.changed_at + l.key}><span className="v4-rt"><strong>{SETTING_NAME[l.key] || l.key} → {l.key === "cash_dg_note_above" ? nairaExact(l.new_value) : l.new_value}</strong><span>{l.changed_by_label} · {when(l.changed_at)}</span></span></li>)}</ul></section> : null}
        </aside>
      </div>
    </V4Page>
  );
}
