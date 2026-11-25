import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Database, Download, History, Search, Upload, Camera } from "lucide-react";
import { db, office } from "../../lib/core";
import { saveAndOpen } from "../../lib/files2";
import { ACCOUNT_COLUMNS, accountName, num, type Account } from "../../lib/finance";
import { addMonths, fyLabel, fyOfMonth, monthName, thisMonth } from "../../lib/reports";
import { readStatement, type StatementLine } from "../../lib/statement";
import { naira, when } from "../../lib/text";
import { downloadXlsx } from "../../lib/xlsx";
import { Body, Cell, Chip, Chips, Empty, FormSheet, Head, Item, More, Note, SearchBox, Skeleton, toast, useMore } from "../../ui";
import { Err, Stats, call, rows, useAction, useLoad } from "./kit";

/** App 4.1.0: the Audit office. The Audit Log is read only: nothing in it can be edited or deleted. */
type Ev = { at: string; actor_label: string | null; category: string; module: string; action: string; record_no: string | null; record_id: string | null; device: string | null };
const TABS: Array<{ k: string; label: string }> = [{ k: "all", label: "All" }, { k: "signin", label: "Sign-ins" }, { k: "approval", label: "Approvals" }, { k: "stamp", label: "Stamps" }, { k: "data", label: "Data" }, { k: "settings", label: "Settings" }, { k: "developer", label: "Developer" }];

export function AuditLog({ title = "Audit Log", only }: { title?: string; only?: string }) {
  const [days, setDays] = useState<"1" | "7" | "30" | "90">("7");
  const [tab, setTab] = useState(only || "all");
  const [q, setQ] = useState("");
  const { data, error, reload } = useLoad(async () => {
    const to = new Date(); const from = new Date(to.getTime() - Number(days) * 86400000);
    return rows<Ev>("reqgen_audit_events", { p_from: from.toISOString(), p_to: new Date(to.getTime() + 60000).toISOString() });
  }, [days]);
  const list = (data || []).filter((e) => (tab === "all" || e.category === tab) && (!q.trim() || `${e.actor_label} ${e.action} ${e.record_no} ${e.module}`.toLowerCase().includes(q.trim().toLowerCase())));
  const { shown, more, left } = useMore(list);
  return (
    <>
      <Head title={title} />
      <Body onRefresh={reload}>
        <Note tone="mu">Every action by every user. Nothing here can be edited or deleted.</Note>
        <Chips label="Period" value={days} onChange={setDays} items={[{ k: "1", label: "Today" }, { k: "7", label: "7 days" }, { k: "30", label: "30 days" }, { k: "90", label: "90 days" }]} />
        {!only ? <Chips label="Kind" value={tab} onChange={setTab} items={TABS} /> : null}
        <SearchBox value={q} onChange={setQ} placeholder="Search person, action or number" />
        <button type="button" className="btn bs block" disabled={!list.length} onClick={() => void downloadXlsx(`Audit_Log_${days}_days`, [{ name: "Audit Log", title: "ReqGen Audit Log", rows: list.map((e) => ({ When: when(e.at), Who: e.actor_label, Kind: e.category, Module: e.module, Action: e.action, Record: e.record_no, Device: e.device })) }]).catch(() => toast("Not saved.", "er"))}><Download size={18} />Save as Excel</button>
        <Err text={error} />
        {!data ? <Skeleton rows={5} /> : !list.length ? <Empty icon={<History size={28} />} title="Nothing in this period" text="Choose a longer period." /> : shown.map((e, i) => (
          <Item key={`${e.at}-${i}`} title={e.action} sub={`${e.actor_label || "System"}, ${when(e.at)}`} chip={<Chip tone="in">{e.module}</Chip>} facts={[e.record_no ? ["Record", e.record_no] : null, e.device ? ["Device", e.device] : null]} />
        ))}
        <More more={more} left={left} />
      </Body>
    </>
  );
}

type Step = { phase: string; at: string; title: string; who: string; tone: "blue" | "green" | "brand" | "red"; stamped: boolean };
export function WorkflowTrace() {
  const [no, setNo] = useState("");
  const [steps, setSteps] = useState<Step[] | null>(null);
  const { busy, err, setErr, run } = useAction();
  return (
    <>
      <Head title="Workflow Trace" />
      <Body>
        <p className="mu" style={{ margin: 0 }}>The full journey of a request or voucher, step by step.</p>
        <input className="inp" value={no} onChange={(e) => setNo(e.target.value.toUpperCase())} placeholder="REQ-… or PV-…" aria-label="Request or voucher number" />
        <button type="button" className="btn bp block" disabled={busy} onClick={() => { if (no.trim().length < 4) { setErr("Type the number."); return; } void run(null, async () => setSteps(await rows<Step>("reqgen_trace", { p_no: no.trim() })), "Found."); }}><Search size={18} />Trace</button>
        <Err text={err} />
        {steps ? (steps.length ? (
          <div className="card"><ol className="tl">{steps.map((s, i) => (
            <li key={i}><span className={`pt ${s.tone === "green" ? "ic-ok" : s.tone === "red" ? "ic-er" : "ic-in"}`}><span style={{ fontWeight: 800, fontSize: 12 }}>{i + 1}</span></span>
              <span className="tx"><b>{s.title}{s.stamped ? " (stamped)" : ""}</b><small>{s.phase}, {s.who}, {when(s.at)}</small></span></li>
          ))}</ol></div>
        ) : <Empty icon={<Search size={28} />} title="Not found" text="Check the number." />) : null}
      </Body>
    </>
  );
}

type Recon = { id: string; account_id: string; month: string; statement_opening: number; statement_closing: number; ledger_closing: number | null; difference: number | null; lines: StatementLine[]; status: "Open" | "Explained" | "Reconciled"; explanation: string | null; uploaded_by_label: string | null; reconciled_by_label: string | null };
export function Reconciliation() {
  const [month, setMonth] = useState(addMonths(thisMonth(), -1));
  const { data, error, reload } = useLoad(async () => {
    const c = await db();
    const [a, r] = await Promise.all([c.from("iet_accounts").select(ACCOUNT_COLUMNS).eq("is_active", true).order("name"), c.from("reqgen_reconciliations").select("*").eq("month", month)]);
    return { accounts: (a.data || []) as Account[], recs: (r.data || []) as Recon[] };
  }, [month]);
  const [upload, setUpload] = useState<null | { account: string; lines: StatementLine[]; opening: number; closing: number; file: string }>(null);
  const [decide, setDecide] = useState<null | { r: Recon; action: "explain" | "reconcile" | "reopen" }>(null);
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [forAcc, setForAcc] = useState("");
  const { busy, err, setErr, run } = useAction();
  return (
    <>
      <Head title="Finance Reconciliation" />
      <Body onRefresh={reload}>
        <p className="mu" style={{ margin: 0 }}>Bank statement against the ledger, account by account, month by month.</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" className="btn bs sm" aria-label="Month before" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft size={20} /></button>
          <b style={{ flex: 1, textAlign: "center" }}>{monthName(month)}</b>
          <button type="button" className="btn bs sm" aria-label="Next month" disabled={month >= thisMonth()} onClick={() => setMonth(addMonths(month, 1))}><ChevronRight size={20} /></button>
        </div>
        <Err text={error || err} />
        <input ref={fileRef} type="file" accept=".csv,.xlsx" hidden onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = "";
          if (!f) return;
          try { const st = await readStatement(f); setUpload({ account: forAcc, lines: st.lines, opening: st.opening, closing: st.closing, file: f.name }); }
          catch (x) { setErr(x instanceof Error ? x.message : "The statement could not be read."); }
        }} />
        {!data ? <Skeleton rows={3} /> : data.accounts.map((a) => {
          const r = data.recs.find((x) => x.account_id === a.id);
          return (
            <Item key={a.id} title={accountName(a)} sub={a.bank_name || ""} chip={<Chip tone={!r ? "mu" : r.status === "Reconciled" ? "ok" : r.status === "Explained" ? "in" : "wa"}>{r ? r.status : "No statement"}</Chip>}
              facts={r ? [["Statement closing", naira(r.statement_closing)], ["Ledger closing", naira(r.ledger_closing)], ["Difference", naira(r.difference)], r.explanation ? ["Explanation", r.explanation] : null] : [["Statement", "Upload the bank statement (CSV or Excel)"]]}>
              <button type="button" className="btn bs sm" onClick={() => { setForAcc(a.id); fileRef.current?.click(); }}><Upload size={16} />{r ? "Replace statement" : "Upload statement"}</button>
              {r && r.status !== "Reconciled" ? <><button type="button" className="btn bs sm" onClick={() => { setText(r.explanation || ""); setDecide({ r, action: "explain" }); }}>Explain</button><button type="button" className="btn bp sm" onClick={() => { setText(""); setDecide({ r, action: "reconcile" }); }}>Reconciled</button></> : null}
              {r && r.status === "Reconciled" ? <button type="button" className="btn bs sm" onClick={() => { setText(""); setDecide({ r, action: "reopen" }); }}>Reopen</button> : null}
            </Item>
          );
        })}
      </Body>
      <FormSheet open={!!upload} title="Save the statement?" sub={upload ? `${upload.file}: ${upload.lines.length} lines.` : ""} onClose={() => setUpload(null)} saveLabel="Save" busy={busy} error={err} onSave={() => {
        if (!upload) return;
        void run(null, () => call("reqgen_recon_save", { p_account: upload.account, p_month: month, p_opening: upload.opening, p_closing: upload.closing, p_lines: upload.lines }), "Statement saved and compared with the ledger.", async () => { setUpload(null); await reload(); });
      }}>
        {upload ? <Stats items={[{ label: "Opening", value: naira(upload.opening) }, { label: "Closing", value: naira(upload.closing) }, { label: "Money out", value: naira(upload.lines.reduce((t, l) => t + num(l.out), 0)) }, { label: "Money in", value: naira(upload.lines.reduce((t, l) => t + num(l.in), 0)) }]} /> : null}
      </FormSheet>
      <FormSheet open={!!decide} title={decide?.action === "reconcile" ? "Mark as reconciled?" : decide?.action === "reopen" ? "Reopen?" : "Explain the difference"} onClose={() => setDecide(null)} saveLabel="Save" busy={busy} error={err} onSave={() => {
        if (!decide) return;
        if (decide.action !== "reconcile" && text.trim().length < 3) { setErr("Write the note."); return; }
        void run(decide.action === "reconcile" ? "mark this month reconciled" : null, () => call("reqgen_recon_decide", { p_id: decide.r.id, p_action: decide.action, p_text: text.trim() }), "Saved.", async () => { setDecide(null); await reload(); });
      }}><label><span className="lbl">Note</span><textarea className="inp" value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 70 }} /></label></FormSheet>
    </>
  );
}

type LogRow = { id: string; action: string; financial_year: string | null; mode: string | null; actor_name: string | null; created_at: string; bytes: number | null };
type Stored = { id: string; created_at: string; financial_year: string | null; mode: string | null; actor_name: string | null; storage_path: string; bytes: number | null; url: string | null; summary: { tables?: number } | null };
type Report = { table: string; label: string; inFile: number; existing: number | null; missing: number | null; written: number; status: string; note: string };
type RestoreResult = { ok: boolean; mode: string; year: string; file: string; totals: { inFile: number; missing: number; written: number }; reports: Report[] };
const mb = (b: number | null) => (b ? `${(b / 1024 / 1024).toFixed(1)} MB` : "");

export function Backup() {
  const thisFy = fyOfMonth(thisMonth());
  const [fy, setFy] = useState(thisFy);
  const { data, error, reload } = useLoad(async () => {
    const [l, f] = await Promise.all([(await db()).from("reqgen_backup_log").select("id,action,financial_year,mode,actor_name,created_at,bytes").order("created_at", { ascending: false }).limit(30), office<{ files?: Stored[] }>("backup_files", { method: "GET" }).catch(() => ({ files: [] as Stored[] }))]);
    return { log: (l.data || []) as LogRow[], files: f.files || [] };
  }, []);
  const [preview, setPreview] = useState<null | { res: RestoreResult; path?: string; file?: File }>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { busy, err, run } = useAction();
  async function restore(mode: "preview" | "missing", src: { path?: string; file?: File }) {
    const form = new FormData();
    if (src.file) form.append("file", src.file); else form.append("path", src.path || "");
    form.append("mode", mode);
    return office<RestoreResult>("backup_restore", { body: form });
  }
  return (
    <>
      <Head title="Master Backup" />
      <Body onRefresh={reload}>
        <p className="mu" style={{ margin: 0 }}>Every record of a financial year in one file (CSV tables in a zip). A copy is kept every night.</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" className="btn bs sm" aria-label="Year before" onClick={() => setFy(fy - 1)}><ChevronLeft size={20} /></button>
          <b style={{ flex: 1, textAlign: "center" }}>FY {fyLabel(fy)}</b>
          <button type="button" className="btn bs sm" aria-label="Next year" disabled={fy >= thisFy} onClick={() => setFy(fy + 1)}><ChevronRight size={20} /></button>
        </div>
        <div className="grp">
          <Cell icon={<Download size={18} />} title="Download the backup" sub={`FY ${fyLabel(fy)}, saved on this phone`} onClick={() => void run(null, async () => { const bytes = await office<ArrayBuffer>("backup_export", { body: { year: String(fy) }, raw: true }); await saveAndOpen(`ReqGen_Backup_FY${fyLabel(fy).replace("/", "-")}.zip`, new Uint8Array(bytes), "application/zip"); }, "Backup saved.", reload)} />
          <Cell icon={<Camera size={18} />} title="Keep a copy now" sub="Stored safely in ReqGen" onClick={() => void run(null, () => office("backup_snapshot", { body: { year: String(thisFy) } }), "Copy kept.", reload)} />
          <Cell icon={<Upload size={18} />} title="Check a backup file" sub="See what it would restore (Super Admin)" onClick={() => fileRef.current?.click()} />
        </div>
        <input ref={fileRef} type="file" accept=".zip" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void run(null, async () => setPreview({ res: await restore("preview", { file: f }), file: f }), "Checked."); }} />
        <Err text={error || err} />
        {data?.files.length ? (<><div className="sect"><b>Kept copies</b></div>
          {data.files.map((f) => <Item key={f.id} title={`FY ${f.financial_year || ""} · ${mb(f.bytes)}`} sub={`${f.mode || ""} ${when(f.created_at)}${f.actor_name ? `, ${f.actor_name}` : ""}`}>
            <button type="button" className="btn bs sm" disabled={busy} onClick={() => void run(null, async () => setPreview({ res: await restore("preview", { path: f.storage_path }), path: f.storage_path }), "Checked.")}>Check</button>
          </Item>)}</>) : null}
        <div className="sect"><b>Backup log</b></div>
        {!data ? <Skeleton rows={3} /> : !data.log.length ? <Empty icon={<Database size={28} />} title="No backups yet" text="Backups appear here." /> : data.log.map((l) => <Cell key={l.id} icon={<Database size={18} />} title={`${l.action}${l.financial_year ? `, FY ${l.financial_year}` : ""}`} sub={`${l.actor_name || "Nightly"}, ${when(l.created_at)} ${mb(l.bytes)}`} />)}
      </Body>
      <FormSheet open={!!preview} title="What this backup holds" sub={preview ? `${preview.res.file}: ${preview.res.totals.inFile} records, ${preview.res.totals.missing} missing from ReqGen now.` : ""} onClose={() => setPreview(null)} saveLabel="Restore the missing records" busy={busy} error={err} onSave={() => {
        if (!preview) return;
        void run("restore the missing records", () => restore("missing", { path: preview.path, file: preview.file }), "Restored. Only missing records were added; nothing was overwritten.", async () => { setPreview(null); await reload(); });
      }}>
        {preview ? <div className="grp">{preview.res.reports.filter((r) => r.inFile).map((r) => <Cell key={r.table} icon={<Database size={18} />} title={r.label} sub={`${r.inFile} in file, ${r.missing ?? 0} missing`} />)}</div> : null}
        <Note tone="mu">Restoring adds only the records that are missing. Nothing is overwritten. Super Admin only, confirmed with your fingerprint or code.</Note>
      </FormSheet>
    </>
  );
}

