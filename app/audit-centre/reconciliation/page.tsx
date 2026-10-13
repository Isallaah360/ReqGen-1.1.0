"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { promptDialog } from "@/lib/dialog";
import { ACCOUNT_COLUMNS, accountName, type Account } from "@/lib/v4/finance";
import { nairaExact } from "@/lib/v4/money";
import { addMonths, monthName, thisMonth } from "@/lib/v4/reports";
import { matchLines, readStatement, type LedgerEvent, type StatementLine } from "@/lib/v4/statement";
import { downloadXlsx } from "@/lib/v4/xlsx";
import { useIdentity } from "@/app/components/v4/useIdentity";
import { normalizeRole } from "@/lib/roles";
import Icon from "@/app/components/v4/Icon";
import Modal from "@/app/components/v4/Modal";
import { Select } from "@/app/components/v4/Select";
import { Chip, Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

type Recon = { id: string; account_id: string; month: string; statement_opening: number; statement_closing: number; ledger_closing: number | null; difference: number | null; lines: StatementLine[]; status: "Open" | "Explained" | "Reconciled"; explanation: string | null; uploaded_by_label: string | null; reconciled_by_label: string | null };

/** Audit › Finance Reconciliation (mock-up 77): bank statements against the ReqGen ledger. */
export default function ReconciliationPage() {
  const me = useIdentity();
  const role = normalizeRole(me.role).replace(/\d+$/, "");
  const canReconcile = role === "auditor" || role === "admin";
  const [month, setMonth] = useState(addMonths(thisMonth(), -1));
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recons, setRecons] = useState<Recon[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<string>("");
  const [only, setOnly] = useState<"all" | "unmatched">("all");
  const [upload, setUpload] = useState<{ account: string; lines: StatementLine[]; opening: number; closing: number; file: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "green" | "red" | "amber"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [a, r] = await Promise.all([
      supabase.from("iet_accounts").select(ACCOUNT_COLUMNS).eq("is_active", true).order("name"),
      supabase.from("reqgen_reconciliations").select("*").eq("month", month),
    ]);
    setError(r.error?.message || a.error?.message || null);
    setAccounts((a.data || []) as Account[]);
    setRecons((r.data || []) as Recon[]);
  }, [month]);
  useEffect(() => { if (me.ready) queueMicrotask(() => { setRecons(null); void load(); }); }, [me.ready, load]);

  const byAcc = useMemo(() => new Map((recons || []).map((r) => [r.account_id, r])), [recons]);
  const current = sel ? byAcc.get(sel) : (recons || [])[0];
  const lines = (current?.lines || []).filter((l) => only === "all" || !l.matched);
  const unmatched = (current?.lines || []).filter((l) => !l.matched).length;
  const differences = (recons || []).filter((r) => Number(r.difference || 0) !== 0 && r.status !== "Reconciled").length;

  async function pickFile(f: File | undefined, account: string) {
    if (!f) return;
    setMsg(null);
    try {
      const st = await readStatement(f);
      const { data, error: e } = await supabase.rpc("reqgen_recon_ledger", { p_account: account, p_month: month });
      if (e) throw new Error(e.message);
      const inMonth = st.lines.filter((l) => l.date.startsWith(month));
      if (!inMonth.length) throw new Error(`The statement has no lines in ${monthName(month)}.`);
      setUpload({ account, lines: matchLines(inMonth, (data || []) as LedgerEvent[]), opening: st.opening, closing: inMonth[inMonth.length - 1].balance ?? st.closing, file: f.name });
    } catch (err) {
      setMsg({ tone: "red", text: err instanceof Error ? err.message : "The statement could not be read." });
    }
  }

  async function save() {
    if (!upload) return;
    setBusy(true);
    const { data, error: e } = await supabase.rpc("reqgen_recon_save", { p_account: upload.account, p_month: month, p_opening: upload.opening, p_closing: upload.closing, p_lines: upload.lines });
    setBusy(false);
    if (e) { setMsg({ tone: "red", text: e.message }); return; }
    const res = (typeof data === "string" ? JSON.parse(data) : data) as { difference?: number };
    setMsg({ tone: Number(res?.difference || 0) === 0 ? "green" : "amber", text: Number(res?.difference || 0) === 0 ? "Statement saved — it matches the ReqGen ledger." : `Statement saved — a difference of ${nairaExact(Math.abs(Number(res.difference)))} needs explaining.` });
    setSel(upload.account); setUpload(null);
    await load();
  }

  async function decide(action: "explain" | "reconcile" | "reopen") {
    if (!current) return;
    let text: string | null = null;
    if (action === "explain") {
      text = await promptDialog({ title: "Explain the difference", message: "For example: bank charges not yet in ReqGen — a manual voucher will be raised.", label: "Explanation", defaultValue: current.explanation || "", confirmLabel: "Save" });
      if (!text) return;
    }
    const { error: e } = await supabase.rpc("reqgen_recon_decide", { p_id: current.id, p_action: action, p_text: text });
    setMsg(e ? { tone: "red", text: e.message } : { tone: "green", text: action === "reconcile" ? `${monthName(month)} marked reconciled.` : action === "reopen" ? "Reopened." : "Explanation saved." });
    if (!e) await load();
  }

  return (
    <V4Page>
      <PageHead title="Finance Reconciliation" sub="Bank statements against the ReqGen ledger. Differences are flagged for the Auditor to explain."
        actions={[
          { label: "Upload statement", icon: "upload", kind: "secondary", onClick: () => setUpload({ account: sel || accounts[0]?.id || "", lines: [], opening: 0, closing: 0, file: "" }) },
          { label: "Export Excel", icon: "download", kind: "secondary", disabled: !recons?.length, onClick: () => downloadXlsx(`Reconciliation_${month}`, (recons || []).map((r) => ({ name: accountName(accounts.find((a) => a.id === r.account_id)), title: `${accountName(accounts.find((a) => a.id === r.account_id))} — ${monthName(month)} · ${r.status}`, rows: (r.lines || []).map((l) => ({ Date: l.date, Details: l.details, Reference: l.ref, Out: l.out || null, In: l.in || null, Balance: l.balance, Match: l.matched || "Not matched" })) }))) },
        ]} />
      {error ? <Notice tone="red">{error}</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <span className="v4-monthpick" aria-label="Month">
          <button type="button" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}><Icon name="left" /></button>
          <b>{monthName(month)}</b>
          <button type="button" aria-label="Next month" disabled={month >= thisMonth()} onClick={() => setMonth(addMonths(month, 1))}><Icon name="right" /></button>
        </span>
        {differences ? <Chip tone="amber">{differences} difference{differences === 1 ? "" : "s"} to explain</Chip> : recons?.length ? <Chip tone="green">All statements match</Chip> : null}
      </div>
      {recons === null ? <Skeleton lines={4} /> : (
        <section className="v4-bankcards">
          {accounts.map((a) => {
            const r = byAcc.get(a.id);
            const diff = Number(r?.difference || 0);
            return (
              <article key={a.id} className={`v4-bankcard${r && diff !== 0 && r.status !== "Reconciled" ? " v4-bad" : ""}`} onClick={() => setSel(a.id)} style={{ cursor: "pointer", outline: current?.account_id === a.id ? "2px solid var(--v4-brand)" : undefined }}>
                <div className="v4-top"><span><strong>{a.name}</strong><span>{a.bank_name}</span></span>
                  {r ? <Chip tone={r.status === "Reconciled" ? "green" : diff === 0 ? "green" : r.status === "Explained" ? "blue" : "amber"}>{r.status === "Reconciled" ? "Reconciled" : diff === 0 ? "Matched" : r.status === "Explained" ? "Explained" : "Difference"}</Chip> : <Chip tone="grey">No statement</Chip>}</div>
                {r ? (
                  <dl className="v4-kv"><dt>Bank statement</dt><dd>{nairaExact(r.statement_closing)}</dd><dt>ReqGen ledger</dt><dd>{nairaExact(r.ledger_closing)}</dd><dt>Difference</dt><dd style={{ color: diff === 0 ? "var(--v4-green)" : "#B26A00" }}>{nairaExact(Math.abs(diff))}</dd></dl>
                ) : <p className="v4-help" style={{ margin: "8px 0 0" }}>Upload the {monthName(month, true)} statement.</p>}
              </article>
            );
          })}
        </section>
      )}
      {current ? (
        <section className="v4-card">
          <div className="v4-card-head">
            <h2 className="v4-h2">Statement lines · {accountName(accounts.find((a) => a.id === current.account_id))} · {monthName(month)}</h2>
            <div className="v4-segmented" role="tablist" aria-label="Show">
              <button type="button" role="tab" aria-selected={only === "all"} onClick={() => setOnly("all")}>All</button>
              <button type="button" role="tab" aria-selected={only === "unmatched"} onClick={() => setOnly("unmatched")}>Not matched <span className="v4-n">{unmatched}</span></button>
            </div>
          </div>
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>Date</th><th>Details</th><th className="v4-r">Out</th><th className="v4-r">In</th><th className="v4-r v4-hide-sm">Balance</th><th>Match</th></tr></thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={`${l.date}-${i}`}>
                    <td className="v4-num">{new Date(l.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</td>
                    <td><span className="v4-strong">{l.details || "—"}</span><span className="v4-sub">{l.ref || "—"}</span></td>
                    <td className="v4-r v4-num v4-debit">{l.out ? nairaExact(l.out) : ""}</td>
                    <td className="v4-r v4-num v4-credit">{l.in ? nairaExact(l.in) : ""}</td>
                    <td className="v4-r v4-num v4-hide-sm">{l.balance === null ? "" : nairaExact(l.balance)}</td>
                    <td data-label="Match">{l.matched ? <Chip tone="green">{l.matched === "opening" ? "Opening" : `Matched · ${l.matched}`}</Chip> : <Chip tone="amber">Not matched</Chip>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="v4-card-pad">
            {Number(current.difference || 0) !== 0 ? <p className="v4-help" style={{ margin: "0 0 12px" }}>The statement ends at {nairaExact(current.statement_closing)}; ReqGen expects {nairaExact(current.ledger_closing)}. {unmatched ? `${unmatched} line${unmatched === 1 ? " is" : "s are"} on the statement but not in ReqGen — add a manual voucher or explain.` : ""}</p> : null}
            {current.explanation ? <Notice tone="blue" title="Explanation">{current.explanation}</Notice> : null}
            <div className="v4-form-actions">
              {current.status !== "Reconciled" && Number(current.difference || 0) !== 0 ? <button type="button" className="v4-btn v4-btn-secondary" onClick={() => void decide("explain")}>Explain difference</button> : null}
              {canReconcile && current.status !== "Reconciled" ? <button type="button" className="v4-btn v4-btn-primary" onClick={() => void decide("reconcile")}><Icon name="check" />Mark month reconciled</button> : null}
              {canReconcile && current.status === "Reconciled" ? <button type="button" className="v4-btn v4-btn-secondary" onClick={() => void decide("reopen")}>Reopen</button> : null}
              {current.status === "Reconciled" ? <Chip tone="green">Reconciled by {current.reconciled_by_label}</Chip> : null}
            </div>
          </div>
        </section>
      ) : null}
      <Modal open={!!upload} wide title="Upload statement" sub={`Bank statement for ${monthName(month)} — CSV or Excel. Lines are matched against vouchers paid, manual vouchers and transfers recorded in ReqGen.`} onClose={() => setUpload(null)} busy={busy}
        footer={<><button type="button" className="v4-btn v4-btn-ghost" onClick={() => setUpload(null)} disabled={busy}>Cancel</button><button type="button" className="v4-btn v4-btn-primary" onClick={() => void save()} disabled={busy || !upload?.lines.length}><Icon name="check" />{busy ? "Saving…" : "Save statement"}</button></>}>
        {upload ? (
          <>
            <div className="v4-form-grid">
              <div className="v4-field"><span className="v4-flabel">IET account</span><Select ariaLabel="IET account" value={upload.account} onChange={(v) => setUpload({ ...upload, account: v, lines: [] })} options={accounts.map((a) => ({ value: a.id, label: a.name, hint: a.bank_name || undefined }))} /></div>
              <div className="v4-field"><span className="v4-flabel">Statement file</span>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,text/csv" hidden onChange={(e) => { void pickFile(e.target.files?.[0], upload.account); e.target.value = ""; }} />
                <button type="button" className="v4-btn v4-btn-secondary" disabled={!upload.account} onClick={() => fileRef.current?.click()}><Icon name="upload" />{upload.file || "Choose CSV or Excel"}</button></div>
            </div>
            {upload.lines.length ? (
              <dl className="v4-kv" style={{ marginTop: 14 }}>
                <dt>Lines in {monthName(month, true)}</dt><dd>{upload.lines.length}</dd>
                <dt>Matched to ReqGen</dt><dd>{upload.lines.filter((l) => l.matched).length}</dd>
                <dt>Opening balance</dt><dd>{nairaExact(upload.opening)}</dd>
                <dt>Closing balance</dt><dd>{nairaExact(upload.closing)}</dd>
              </dl>
            ) : <p className="v4-help" style={{ marginTop: 14 }}>The file needs a heading row with Date, Details, Debit, Credit and Balance (the usual bank export).</p>}
          </>
        ) : null}
      </Modal>
    </V4Page>
  );
}
