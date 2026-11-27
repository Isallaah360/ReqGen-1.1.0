import { useMemo, useState } from "react";
import { Bell, Check, CornerUpLeft, FileText, Paperclip, PenLine, Printer, Send, Stamp, Wallet, X, Plus, UserCheck } from "lucide-react";
import { db, office, plainError } from "../../lib/core";
import { saveAndOpen } from "../../lib/files2";
import { fmtAmount, kb, parseAmount } from "../../lib/files";
import { day, naira, when } from "../../lib/text";
import { SECTIONS, isManual, pvAmount, pvChip, pvMode, pvNowWith, pvStage, pvSteps, type ScheduleLine, type Voucher } from "../../lib/vouchers";
import { ACCOUNT_COLUMNS, NIGERIAN_BANKS, SUBHEAD_COLUMNS, accountAvailable, accountName, subheadLabel, subheadLeft, type Account, type Subhead } from "../../lib/finance";
import { printVoucher } from "../../lib/a4";
import { useApp } from "../../App";
import { AttachButtons, Body, Cell, Chip, Chips, Empty, Head, Item, More, Note, SearchBox, Sheet, Skeleton, toast, useMore, useNav } from "../../ui";
import { Err, Facts, TONE, call, isAdminRole, isAuditorRole, isDgRole, isOfficerRole, one, parsed, rows, todayIso, useAction, useLoad } from "./kit";

type Item = { id: string; request_id: string | null; request_no: string | null; title: string | null; amount: number | null; dept_name: string | null; subhead_code: string | null; subhead_name: string | null; requester_name: string | null };
type Hist = { id: string; action_type: string | null; comment: string | null; actor_name: string | null; actor_role: string | null; created_at: string };
type PvFile = { id: string; file_name: string; file_path: string; uploaded_by_label: string | null; created_at: string };

async function loadVouchers(): Promise<Voucher[]> {
  const c = await db();
  let res = await c.rpc("reqgen_pv_list");
  if (res.error && /could not find the function|schema cache/i.test(res.error.message)) res = await c.rpc("get_payment_vouchers");
  if (res.error) throw new Error(res.error.message);
  return (res.data || []) as Voucher[];
}

/** Remind whoever holds a voucher: SMS, e-mail and an app notice (the website's own logic, run on Supabase). */
export async function remindVoucher(id: string) {
  try {
    const j = await office<{ recipients?: Array<{ name: string }> }>("pv_remind", { body: { voucherId: id } });
    return `Reminder sent to ${(j.recipients || []).map((r) => r.name).join(", ") || "the officer holding it"}.`;
  } catch (e) {
    const msg = plainError(e);
    if (/minutes|already/i.test(msg)) throw new Error(msg);
    await call("reqgen_pv_remind", { p_voucher_id: id });
    return "Reminder sent in the app.";
  }
}

export type PvMode = "centre" | "tracker" | "ready" | "history" | "print" | "mine";
const TITLES: Record<PvMode, string> = { centre: "Voucher Centre", tracker: "Signing Tracker", ready: "Ready to Pay", history: "Paid History", print: "Print Centre", mine: "Vouchers to Sign" };

/** Every voucher list: the centre, the tracker, ready to pay, paid history, print centre and "to sign". */
export function VoucherList({ mode, title }: { mode: PvMode; title?: string }) {
  const { me } = useApp();
  const { push } = useNav();
  const [q, setQ] = useState("");
  const [f, setF] = useState<"all" | "signing" | "ready" | "paid" | "returned" | "cancelled">("all");
  const { data, error, reload } = useLoad(async () => {
    if (mode !== "mine") return loadVouchers();
    const r = await rows<Voucher>("get_payment_vouchers_assigned_to_me");
    return r.filter((x) => String(x.status || "").startsWith("Pending"));
  }, [mode]);
  const now = Date.now();
  const list = useMemo(() => {
    let r = data || [];
    if (mode === "tracker") r = r.filter((v) => ["check", "counter", "dg"].includes(pvStage(v.status))).sort((a, b) => String(a.updated_at || a.created_at).localeCompare(String(b.updated_at || b.created_at)));
    if (mode === "ready") r = r.filter((v) => pvStage(v.status) === "ready");
    if (mode === "history") r = r.filter((v) => ["paid", "cancelled"].includes(pvStage(v.status)));
    if (mode === "centre" && f !== "all") r = r.filter((v) => { const s = pvStage(v.status); return f === "signing" ? ["check", "counter", "dg"].includes(s) : s === f; });
    const t = q.trim().toLowerCase();
    if (t) r = r.filter((v) => [v.voucher_no, v.payee_name, v.narration, v.request_no, v.dept_name].some((x) => String(x || "").toLowerCase().includes(t)));
    return r;
  }, [data, mode, f, q]);
  const { shown, more, left } = useMore(list);
  const total = list.reduce((t, v) => t + pvAmount(v), 0);
  const officer = isOfficerRole(me.role) || isAdminRole(me.role);
  return (
    <>
      <Head title={title || TITLES[mode]} />
      <Body onRefresh={reload}>
        {mode === "centre" && officer ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn bp sm" style={{ flex: 1 }} onClick={() => push(<GenerateVoucher />)}><Plus size={18} />From requests</button>
            <button type="button" className="btn bs sm" style={{ flex: 1 }} onClick={() => push(<ManualVoucher />)}><PenLine size={18} />Manual</button>
          </div>
        ) : null}
        <SearchBox value={q} onChange={setQ} placeholder="Search number, payee or narration" />
        {mode === "centre" ? <Chips label="Status" value={f} onChange={setF} items={[{ k: "all", label: "All" }, { k: "signing", label: "In signing" }, { k: "ready", label: "Ready to pay" }, { k: "paid", label: "Paid" }, { k: "returned", label: "Sent back" }, { k: "cancelled", label: "Cancelled" }]} /> : null}
        <Err text={error} />
        {data ? <p className="mu" style={{ margin: 0 }}>{list.length} voucher{list.length === 1 ? "" : "s"}, {naira(total)}</p> : null}
        {!data ? <Skeleton rows={4} /> : !list.length ? <Empty icon={<FileText size={28} />} title="No vouchers here" text={mode === "mine" ? "Nothing is waiting for your check or signature." : "Vouchers appear here as they are prepared."} /> : shown.map((v) => {
          const c = pvChip(v.status);
          const waited = Math.max(0, Math.round((now - new Date(v.updated_at || v.created_at || now).getTime()) / 3600000));
          return (
            <Item key={v.id} title={v.voucher_no || "Voucher"} sub={`${String(v.payee_name || v.cash_payee_name || "Payee").toUpperCase()}${v.dept_name ? `, ${v.dept_name}` : ""}`} chip={<Chip tone={TONE[c.tone]}>{c.label}</Chip>}
              facts={[["Amount", naira(pvAmount(v))], ["Mode", pvMode(v)], mode === "tracker" || mode === "centre" ? ["Now with", pvNowWith(v)] : null, mode === "tracker" ? ["Waiting", waited < 24 ? `${waited} h` : `${Math.round(waited / 24)} days`] : null, ["Date", day(v.paid_on || v.created_at)]]}
              onClick={() => push(<VoucherRecord id={v.id} onChanged={reload} />)}>
              {mode === "print" ? <button type="button" className="btn bs sm" onClick={() => void printById(v.id)}><Printer size={16} />A4 PDF</button> : null}
              {mode === "tracker" && officer ? <button type="button" className="btn bs sm" onClick={async () => { try { toast(await remindVoucher(v.id)); } catch (e) { toast(plainError(e), "er"); } }}><Bell size={16} />Remind</button> : null}
            </Item>
          );
        })}
        <More more={more} left={left} />
      </Body>
    </>
  );
}

async function loadRecord(id: string) {
  const c = await db();
  let rec = await c.rpc("reqgen_pv_record", { p_voucher_id: id });
  if (rec.error && /could not find the function|schema cache/i.test(rec.error.message)) rec = await c.rpc("get_payment_voucher_detail", { p_voucher_id: id });
  if (rec.error) throw new Error(rec.error.message);
  const v = one<Voucher>(rec.data);
  if (!v) throw new Error("This voucher is not open to you, or it was removed.");
  const [it, h, s, cs, files] = await Promise.all([
    c.rpc("get_payment_voucher_items", { p_voucher_id: id }),
    c.rpc("reqgen_pv_history", { p_voucher_id: id }).then((r) => (r.error ? c.rpc("get_payment_voucher_history", { p_voucher_id: id }) : r)),
    c.from("reqgen_pv_transfer_schedule").select("*").eq("voucher_id", id).order("line_no"),
    c.from("payment_voucher_counter_signatories").select("full_name,signatory_type").eq("is_active", true).order("full_name"),
    c.from("reqgen_pv_attachments").select("id,file_name,file_path,uploaded_by_label,created_at").eq("voucher_id", id).order("created_at"),
  ]);
  return {
    v, items: (it.data || []) as Item[], hist: ((h.data || []) as Hist[]).slice().reverse(), schedule: (s.data || []) as ScheduleLine[],
    counters: ((cs.data || []) as Array<{ full_name: string; signatory_type: string | null }>).filter((x) => !x.signatory_type || /counter/i.test(x.signatory_type)).map((x) => x.full_name),
    files: (files.data || []) as PvFile[],
  };
}
async function printById(id: string) {
  try { const r = await loadRecord(id); await printVoucher(r.v, r.items, r.schedule); void call("reqgen_log_print", { p_kind: "voucher", p_doc_id: id, p_doc_no: r.v.voucher_no || "" }).catch(() => null); }
  catch (e) { toast(plainError(e), "er"); }
}

/** One voucher: the record, its signing steps and the one action for whoever holds it now. */
export function VoucherRecord({ id, onChanged }: { id: string; onChanged?: () => void }) {
  const { me } = useApp();
  const { push } = useNav();
  const { data, error, reload } = useLoad(() => loadRecord(id), [id]);
  const [sheet, setSheet] = useState<null | "sign" | "back" | "resend" | "pay" | "cancel" | "counter" | "section">(null);
  const after = async () => { setSheet(null); await reload(); onChanged?.(); };
  if (error && !data) return <><Head title="Voucher" /><Body><Note tone="er">{error}</Note></Body></>;
  if (!data) return <><Head title="Voucher" /><Body><Skeleton rows={5} /></Body></>;
  const { v, items, hist, schedule, counters, files } = data;
  const stage = pvStage(v.status);
  const chip = pvChip(v.status);
  const isPreparer = v.prepared_by === me.id;
  const officer = isOfficerRole(me.role), admin = isAdminRole(me.role), auditor = isAuditorRole(me.role), dg = isDgRole(me.role);
  const myCheck = stage === "check" && auditor && !isPreparer && (!v.current_signing_owner || v.current_signing_owner === me.id);
  const myCounter = stage === "counter" && v.cheque_counter_signed_by === me.id;
  const myAuthorise = stage === "dg" && dg;
  const myPay = stage === "ready" && (officer || admin);
  const myResend = stage === "returned" && (isPreparer || admin);
  const canCancel = !["paid", "cancelled"].includes(stage) && (auditor || admin || (isPreparer && ["check", "returned"].includes(stage)));
  const canRemind = ["check", "counter", "dg"].includes(stage) && (officer || auditor || admin);
  const canChangeCounter = (officer || admin) && (stage === "check" || (stage === "counter" && !v.cheque_counter_signed_at));
  const canSetSection = (isPreparer || admin) && !v.checked_at && !["paid", "cancelled"].includes(stage);
  const canReissue = stage === "cancelled" && (officer || admin) && !isManual(v);
  const signKind = myCheck ? "check" : myCounter ? "counter" : myAuthorise ? "dg" : null;
  const payee = Number(v.payee_count || 1) > 1 ? `${v.payee_count} payees` : String(v.payee_name || v.cash_payee_name || "-").toUpperCase();
  const steps = pvSteps(v);
  const bar = !!signKind || myPay || myResend;
  return (
    <>
      <Head title={v.voucher_no || "Voucher"} />
      <Body bar={bar} onRefresh={reload}>
        <div className="card">
          <div className="row"><Chip tone={TONE[chip.tone]}>{chip.label}</Chip><span className="amt">{naira(pvAmount(v))}</span></div>
          <p className="title">{payee}</p>
          {v.narration ? <p className="p">{v.narration}</p> : null}
          <Facts rows={[["Mode", pvMode(v)], v.dept_name ? ["Department", v.dept_name] : null, v.subhead_code || v.subhead_name ? ["Subhead", `${v.subhead_code ? `${v.subhead_code}: ` : ""}${v.subhead_name || ""}`] : null, ["Prepared", `${v.prepared_by_name || "Account Officer"}${v.prepared_section ? `, ${v.prepared_section}` : ""}`], ["Now with", pvNowWith(v)], isManual(v) ? ["Kind", "Manual voucher"] : null, v.paid_on ? ["Paid on", day(v.paid_on)] : null, v.paid_reference ? ["Reference", v.paid_reference] : null]} />
        </div>
        {v.returned_reason && stage === "returned" ? <Note tone="wa">Sent back by {v.returned_by_name || "the signer"}: “{v.returned_reason}”</Note> : null}
        {v.cancel_reason && stage === "cancelled" ? <Note tone="er">Cancelled: “{v.cancel_reason}”</Note> : null}
        {signKind && !me.signature_url ? <Note tone="er">Add your signature in Me › Signature and photo before you sign.</Note> : null}

        <div className="sect"><b>Signing</b></div>
        <div className="card">
          <ol className="tl">
            {steps.map((s) => (
              <li key={s.key}>
                <span className={`pt ${s.state === "done" ? "ic-ok" : s.state === "now" ? "ic-wa" : "ic-mu"}`}>{s.state === "done" ? <Check size={16} /> : <span style={{ fontWeight: 800, fontSize: 12 }}>{steps.indexOf(s) + 1}</span>}</span>
                <span className="tx"><b>{s.label}</b><small>{s.who}, {s.role}{s.at && s.state === "done" ? `, ${when(s.at)}` : s.state === "now" ? ", waiting" : ""}</small></span>
              </li>
            ))}
          </ol>
        </div>

        {schedule.length ? (<><div className="sect"><b>Transfer schedule</b></div>
          <div className="grp">{schedule.map((l) => <Cell key={l.id} icon={<Wallet size={18} />} title={`${l.account_name}`} sub={`${l.account_number}, ${l.bank_name}`} right={<b style={{ whiteSpace: "nowrap" }}>{naira(l.amount)}</b>} />)}</div></>) : null}

        {items.length ? (<><div className="sect"><b>Requests on this voucher</b></div>
          <div className="grp">{items.map((i) => <Cell key={i.id} icon={<FileText size={18} />} title={i.request_no || "Request"} sub={`${i.title || ""}${i.requester_name ? `, ${i.requester_name}` : ""}`} wrap right={<b style={{ whiteSpace: "nowrap" }}>{naira(i.amount)}</b>} />)}</div></>) : null}

        {files.length ? (<><div className="sect"><b>Supporting files</b></div>
          <div className="grp">{files.map((f) => <Cell key={f.id} icon={<Paperclip size={18} />} title={f.file_name} sub={`${f.uploaded_by_label || ""} ${day(f.created_at)}`} onClick={async () => {
            const { data: s } = await (await db()).storage.from("voucher-attachments").createSignedUrl(f.file_path, 300);
            if (!s?.signedUrl) { toast("The file could not be opened.", "er"); return; }
            try { const r = await fetch(s.signedUrl); await saveAndOpen(f.file_name, new Uint8Array(await r.arrayBuffer()), r.headers.get("content-type") || undefined); } catch { toast("The file could not be opened.", "er"); }
          }} />)}</div></>) : null}

        <div className="sect"><b>More</b></div>
        <div className="grp">
          <Cell icon={<Printer size={18} />} title="A4 PDF (IET voucher)" sub="Save, print or share" onClick={() => void printVoucher(v, items, schedule).then(() => call("reqgen_log_print", { p_kind: "voucher", p_doc_id: v.id, p_doc_no: v.voucher_no || "" }).catch(() => null)).catch((e) => toast(plainError(e), "er"))} />
          {canRemind ? <Cell icon={<Bell size={18} />} title="Remind the signer" sub={`SMS, e-mail and app notice to ${pvNowWith(v)}`} onClick={async () => { try { toast(await remindVoucher(v.id)); await reload(); } catch (e) { toast(plainError(e), "er"); } }} /> : null}
          {canChangeCounter ? <Cell icon={<UserCheck size={18} />} title="Change the Counter Signer" sub={v.counter_signatory_name || "Not chosen"} onClick={() => setSheet("counter")} /> : null}
          {canSetSection ? <Cell icon={<PenLine size={18} />} title="Preparing as" sub={v.prepared_section ? `Account Officer, ${v.prepared_section}` : "Choose the section"} onClick={() => setSheet("section")} /> : null}
          {signKind ? <Cell icon={<CornerUpLeft size={18} />} title="Send back to Account" sub="With your reason" onClick={() => setSheet("back")} /> : null}
          {canReissue ? <Cell icon={<Plus size={18} />} title="Reissue" sub="A new voucher for the same requests" onClick={() => push(<GenerateVoucher reissueOf={v.id} />)} /> : null}
          {canCancel ? <Cell icon={<X size={18} />} iconTone="er" title="Cancel this voucher" sub="The number is kept as cancelled" onClick={() => setSheet("cancel")} /> : null}
        </div>

        {hist.length ? (<><div className="sect"><b>History</b></div>
          <div className="card"><ol className="tl">{hist.map((h) => (
            <li key={h.id}><span className="pt ic-in"><Check size={15} /></span><span className="tx"><b>{h.action_type || "Update"}</b><small>{h.actor_name || ""}{h.actor_role ? `, ${h.actor_role}` : ""}, {when(h.created_at)}</small>{h.comment ? <p className="quote">{h.comment}</p> : null}</span></li>
          ))}</ol></div></>) : null}
      </Body>
      {bar ? (
        <div className="bar">
          {signKind ? <button type="button" className="btn bp" disabled={!me.signature_url} onClick={() => setSheet("sign")}>{signKind === "dg" ? <Stamp size={18} /> : <Check size={18} />}{signKind === "check" ? "Check and sign" : signKind === "counter" ? "Counter-sign" : "Sign, stamp and authorise"}</button> : null}
          {myPay ? <button type="button" className="btn bp" onClick={() => setSheet("pay")}><Wallet size={18} />Mark as paid</button> : null}
          {myResend ? <button type="button" className="btn bp" onClick={() => setSheet("resend")}><Send size={18} />Send again</button> : null}
        </div>
      ) : null}
      {signKind ? <SignSheet open={sheet === "sign"} kind={signKind} v={v} onClose={() => setSheet(null)} onDone={after} /> : null}
      <ReasonSheet open={sheet === "back"} title="Send back to Account?" sub="The Account Officer sees your reason, corrects the voucher and sends it again. Signing starts again from the Auditor." label="Reason" button="Send back" danger onClose={() => setSheet(null)}
        run={(t) => call("reqgen_pv_return", { p_voucher_id: v.id, p_reason: t })} ok={`${v.voucher_no} sent back to the Account Officer.`} confirm="send this voucher back" onDone={after} />
      <ReasonSheet open={sheet === "resend"} title="Send the voucher again?" sub="Say what you corrected. Signing starts again from the Auditor." label="What did you correct?" button="Send again" onClose={() => setSheet(null)}
        run={(t) => call("reqgen_pv_resend", { p_voucher_id: v.id, p_comment: t })} ok={`${v.voucher_no} sent again to the Auditor.`} confirm="send the voucher again" onDone={after} />
      <ReasonSheet open={sheet === "cancel"} title={`Cancel ${v.voucher_no}?`} sub="The number is kept and shown as cancelled. The requests become ready for a new voucher." label="Reason" button="Cancel voucher" danger onClose={() => setSheet(null)}
        run={(t) => call("reqgen_pv_cancel", { p_voucher_id: v.id, p_reason: t })} ok={`${v.voucher_no} cancelled.`} confirm="cancel this voucher" onDone={after} />
      <PaySheet open={sheet === "pay"} v={v} onClose={() => setSheet(null)} onDone={after} />
      <PickSheet open={sheet === "counter"} title="Counter Signer" list={counters} value={v.counter_signatory_name || ""} onClose={() => setSheet(null)}
        run={(x) => call("reqgen_pv_assign_signers", { p_voucher_id: v.id, p_cheque_signed_by_name: null, p_counter_signatory_name: x, p_checker_id: null })} ok={(x) => `Counter Signer changed to ${x}.`} onDone={after} />
      <PickSheet open={sheet === "section"} title="Preparing as" list={[...SECTIONS]} value={v.prepared_section || ""} onClose={() => setSheet(null)}
        run={(x) => call("reqgen_pv_set_preparing_as", { p_voucher_id: v.id, p_section: x })} ok={(x) => `Preparing as Account Officer, ${x}.`} onDone={after} />
    </>
  );
}

function SignSheet({ open, kind, v, onClose, onDone }: { open: boolean; kind: "check" | "counter" | "dg"; v: Voucher; onClose: () => void; onDone: () => Promise<void> }) {
  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(false);
  const [note, setNote] = useState("");
  const { busy, err, setErr, run } = useAction();
  return (
    <Sheet open={open} onClose={onClose} title={kind === "check" ? "Check and sign" : kind === "counter" ? "Counter-sign" : "Sign, stamp and authorise"}>
      <p className="mu" style={{ fontSize: 14 }}>{naira(pvAmount(v))} to {String(v.payee_name || "the payee").toUpperCase()}. {kind === "dg" ? "Your signature and the IET stamp are added; Account is told it is ready to pay." : "Your signature is added and the next signer is told."}</p>
      {kind === "check" ? (
        <div className="grp">
          {[[c1, setC1, "The amounts agree with the requests"], [c2, setC2, "The payee and bank details are correct"]].map(([on, set, t]) => (
            <button key={String(t)} type="button" className="cell" role="checkbox" aria-checked={!!on} onClick={() => (set as (b: boolean) => void)(!on)}>
              <span className={`box${on ? " on" : ""}`} aria-hidden="true">{on ? <Check size={15} strokeWidth={3} /> : null}</span><span className="t"><b>{String(t)}</b></span>
            </button>
          ))}
        </div>
      ) : null}
      <label><span className="lbl">Comment (optional)</span><textarea className="inp" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} style={{ minHeight: 70 }} /></label>
      <Err text={err} />
      <button type="button" className="btn bp block" disabled={busy} onClick={() => {
        if (kind === "check" && !(c1 && c2)) { setErr("Tick both checks before you sign."); return; }
        void run(kind === "dg" ? "sign, stamp and authorise this voucher" : "sign this voucher", () => call("reqgen_pv_sign", { p_voucher_id: v.id, p_comment: note.trim() || null }),
          kind === "check" ? "Checked and signed. The Counter Signer is told." : kind === "counter" ? "Counter-signed. The Director General is told." : "Signed, stamped and authorised. Account is told.", onDone);
      }}>{busy ? "Signing…" : kind === "dg" ? "Sign, stamp and authorise" : "Sign"}</button>
    </Sheet>
  );
}

function ReasonSheet({ open, title, sub, label, button, danger, onClose, run: doIt, ok, confirm, onDone }: { open: boolean; title: string; sub: string; label: string; button: string; danger?: boolean; onClose: () => void; run: (t: string) => Promise<unknown>; ok: string; confirm: string; onDone: () => Promise<void> }) {
  const [t, setT] = useState("");
  const { busy, err, setErr, run } = useAction();
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="mu" style={{ fontSize: 14 }}>{sub}</p>
      <label><span className="lbl">{label}</span><textarea className="inp" value={t} maxLength={500} onChange={(e) => setT(e.target.value)} style={{ minHeight: 80 }} /></label>
      <Err text={err} />
      <button type="button" className={`btn block ${danger ? "bd" : "bp"}`} disabled={busy} onClick={() => { if (t.trim().length < 3) { setErr("Write it first."); return; } void run(confirm, () => doIt(t.trim()), ok, onDone); }}>{busy ? "Saving…" : button}</button>
    </Sheet>
  );
}

function PaySheet({ open, v, onClose, onDone }: { open: boolean; v: Voucher; onClose: () => void; onDone: () => Promise<void> }) {
  const [on, setOn] = useState(todayIso());
  const [ref, setRef] = useState("");
  const { busy, err, setErr, run } = useAction();
  return (
    <Sheet open={open} onClose={onClose} title="Mark as paid">
      <p className="mu" style={{ fontSize: 14 }}>{naira(pvAmount(v))}. The ledgers are updated and each payee is told.</p>
      <label><span className="lbl">Date paid</span><input className="inp" type="date" value={on} max={todayIso()} onChange={(e) => setOn(e.target.value)} /></label>
      <label><span className="lbl">Bank reference (optional)</span><input className="inp" value={ref} maxLength={80} onChange={(e) => setRef(e.target.value)} /></label>
      <Err text={err} />
      <button type="button" className="btn bp block" disabled={busy} onClick={() => { if (!on) { setErr("Choose the date."); return; } void run("record this payment", () => call("reqgen_pv_mark_paid", { p_voucher_id: v.id, p_paid_on: on, p_reference: ref.trim() || null }), `${v.voucher_no} marked as paid.`, onDone); }}>{busy ? "Saving…" : "Mark as paid"}</button>
    </Sheet>
  );
}

function PickSheet({ open, title, list, value, onClose, run: doIt, ok, onDone }: { open: boolean; title: string; list: string[]; value: string; onClose: () => void; run: (x: string) => Promise<unknown>; ok: (x: string) => string; onDone: () => Promise<void> }) {
  const [x, setX] = useState(value);
  const { busy, err, run } = useAction();
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="grp" role="radiogroup" aria-label={title}>
        {list.map((n) => <button key={n} type="button" className="cell" role="radio" aria-checked={x === n} onClick={() => setX(n)}><span className="t"><b>{n}</b></span><span className={`box${x === n ? " on" : ""}`} aria-hidden="true">{x === n ? <Check size={15} strokeWidth={3} /> : null}</span></button>)}
      </div>
      <Err text={err} />
      <button type="button" className="btn bp block" disabled={busy || !x || x === value} onClick={() => void run(null, () => doIt(x), ok(x), onDone)}>{busy ? "Saving…" : "Save"}</button>
    </Sheet>
  );
}

// ---- Generate from requests ------------------------------------------------------------------------------
type Ready = { id: string; request_no: string | null; title: string | null; amount: number | null; request_type: string | null; personal_category: string | null; requester_name: string | null; dept_name: string | null; subhead_code: string | null; subhead_name: string | null };
type Saved = { payee_key: string; payee_name: string | null; account_name: string; account_number: string; bank_name: string };
type Line = { account_name: string; account_number: string; bank_name: string };
type Mode = "Transfer" | "Cash" | "Cheque";
const CAP = 10;
const payeeKey = (n: string | null | undefined) => String(n || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "");
const isOfficialReq = (r: Ready) => String(r.request_type || "").toLowerCase() === "official";

export function GenerateVoucher({ reissueOf, preselect }: { reissueOf?: string; preselect?: string }) {
  const { me } = useApp();
  const { replace } = useNav();
  const may = isOfficerRole(me.role) || isAdminRole(me.role);
  const { data, error } = useLoad(async () => {
    const c = await db();
    const [r, s, cs] = await Promise.all([
      c.rpc("get_requests_ready_for_payment_voucher"),
      c.from("reqgen_payee_bank_accounts").select("payee_key,payee_name,account_name,account_number,bank_name"),
      c.from("payment_voucher_counter_signatories").select("full_name,signatory_type,is_active").eq("is_active", true).order("full_name"),
    ]);
    if (r.error) throw new Error(r.error.message);
    let reissue: { voucher_no?: string; items: string[]; section?: string; counter?: string; narration?: string; mode?: string } | null = null;
    if (reissueOf) {
      const [v, it] = await Promise.all([c.rpc("reqgen_pv_record", { p_voucher_id: reissueOf }), c.rpc("get_payment_voucher_items", { p_voucher_id: reissueOf })]);
      const old = one<{ voucher_no?: string; prepared_section?: string; counter_signatory_name?: string; narration?: string; disbursement_mode?: string }>(v.data);
      reissue = { voucher_no: old?.voucher_no, items: ((it.data || []) as Array<{ request_id: string }>).map((x) => x.request_id), section: old?.prepared_section, counter: old?.counter_signatory_name, narration: old?.narration, mode: old?.disbursement_mode };
    }
    return {
      ready: (r.data || []) as Ready[], saved: new Map(((s.data || []) as Saved[]).map((x) => [x.payee_key, x])),
      counters: ((cs.data || []) as Array<{ full_name: string; signatory_type: string | null }>).filter((x) => !x.signatory_type || /counter/i.test(x.signatory_type)).map((x) => x.full_name), reissue,
    };
  }, [reissueOf]);
  const [kind, setKind] = useState<"official" | "personal">("official");
  const [picked, setPicked] = useState<string[] | null>(null);
  const [section, setSection] = useState("");
  const [mode, setMode] = useState<Mode>("Transfer");
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [counter, setCounter] = useState("");
  const [cashPayee, setCashPayee] = useState("");
  const [cheque, setCheque] = useState({ no: "", date: todayIso(), bank: "" });
  const [narration, setNarration] = useState("");
  const { busy, err, setErr, run } = useAction();

  const pick = picked ?? (data ? (data.reissue?.items.filter((x) => data.ready.some((r) => r.id === x)) || (preselect && data.ready.some((r) => r.id === preselect) ? [preselect] : [])) : []);
  const ready = data?.ready || [];
  const official = ready.filter(isOfficialReq), personal = ready.filter((r) => !isOfficialReq(r));
  const list = kind === "official" ? official : personal;
  const chosen = ready.filter((r) => pick.includes(r.id));
  const total = chosen.reduce((t, r) => t + Number(r.amount || 0), 0);
  const payees = useMemo(() => {
    const m = new Map<string, { name: string; ids: string[]; amount: number }>();
    chosen.forEach((r) => { const k = payeeKey(r.requester_name) || r.id; const p = m.get(k) || { name: String(r.requester_name || "Payee").toUpperCase(), ids: [], amount: 0 }; p.ids.push(r.id); p.amount += Number(r.amount || 0); m.set(k, p); });
    return [...m.entries()];
  }, [chosen]);
  const many = payees.length > 1;
  const effMode: Mode = many ? "Transfer" : mode;
  const sec = section || data?.reissue?.section || "";
  const ctr = counter || data?.reissue?.counter || "";
  const line = (k: string, name: string): Line => lines[k] || (data?.saved.get(k) ? { account_name: data.saved.get(k)!.account_name, account_number: data.saved.get(k)!.account_number, bank_name: data.saved.get(k)!.bank_name } : { account_name: name, account_number: "", bank_name: "" });
  const lineOk = (l: Line) => l.account_name.trim().length > 1 && l.account_number.replace(/\D/g, "").length === 10 && l.bank_name.trim().length > 1;

  function toggle(r: Ready) {
    setErr(null);
    if (!isOfficialReq(r)) { setPicked(pick.includes(r.id) ? [] : [r.id]); return; }
    const only = pick.filter((x) => official.some((o) => o.id === x));
    if (only.includes(r.id)) setPicked(only.filter((x) => x !== r.id));
    else if (only.length >= CAP) toast(`Up to ${CAP} requests on one voucher.`, "er");
    else setPicked([...only, r.id]);
  }
  function generate() {
    if (!chosen.length) { setErr("Tick at least one request."); return; }
    if (!sec) { setErr("Choose who you are preparing as."); return; }
    if (!ctr) { setErr("Choose the Counter Signer."); return; }
    if (effMode === "Transfer") { const bad = payees.filter(([k, p]) => !lineOk(line(k, p.name))).map(([, p]) => p.name); if (bad.length) { setErr(`Complete the bank details (account name, 10-digit number, bank) for: ${bad.join(", ")}.`); return; } }
    if (effMode === "Cheque" && (!cheque.no.trim() || !cheque.bank)) { setErr("Type the cheque number and choose the bank."); return; }
    const schedule = effMode === "Transfer" ? payees.map(([k, p]) => { const l = line(k, p.name); return { payee_name: p.name, account_name: l.account_name.trim().toUpperCase(), account_number: l.account_number.replace(/\D/g, ""), bank_name: l.bank_name.trim(), request_ids: p.ids }; }) : [];
    let made: { voucher_id?: string; voucher_no?: string } | null = null;
    void run("prepare and send this voucher", async () => {
      made = parsed<{ voucher_id?: string; voucher_no?: string }>(await call("reqgen_pv_generate", {
        p_request_ids: pick, p_mode: effMode, p_preparing_as: sec, p_counter_signer: ctr, p_schedule: schedule,
        p_cash_payee: effMode === "Cash" ? (cashPayee.trim() || payees[0]?.[1].name || null) : null,
        p_cheque_no: effMode === "Cheque" ? cheque.no.trim() : null, p_cheque_date: effMode === "Cheque" ? cheque.date || null : null,
        p_cheque_bank: effMode === "Cheque" ? cheque.bank : null, p_narration: (narration || data?.reissue?.narration || "").trim() || null, p_reissue_of: data?.reissue?.voucher_no ? reissueOf : null,
      }));
    }, "Voucher prepared and sent to the Auditor. Each payee is told.", () => { const m = made as { voucher_id?: string } | null; if (m?.voucher_id) replace(<VoucherRecord id={m.voucher_id} />); });
  }

  if (!may) return <><Head title="Generate from Requests" /><Body><Note tone="wa">Only an Account Officer prepares payment vouchers. You can open and sign vouchers from the Voucher Centre.</Note></Body></>;
  return (
    <>
      <Head title={data?.reissue?.voucher_no ? `Reissue ${data.reissue.voucher_no}` : "Generate from Requests"} />
      <Body bar>
        <Err text={error} />
        <p className="mu" style={{ margin: 0 }}>Official requests from any staff can share one voucher (up to {CAP}). A personal request gets a voucher of its own.</p>
        <Chips label="Request type" value={kind} onChange={(k) => { setKind(k); setPicked([]); }} items={[{ k: "official", label: "Official", n: official.length }, { k: "personal", label: "Personal", n: personal.length }]} />
        {!data ? <Skeleton rows={3} /> : !list.length ? <Empty icon={<FileText size={28} />} title="Nothing ready" text="Requests approved by the DG and released by Account appear here." /> : (
          <div className="grp" role="group" aria-label="Requests ready for a voucher">
            {list.map((r) => { const on = pick.includes(r.id); return (
              <button key={r.id} type="button" className="cell" role="checkbox" aria-checked={on} onClick={() => toggle(r)}>
                <span className={`box${on ? " on" : ""}`} aria-hidden="true">{on ? <Check size={15} strokeWidth={3} /> : null}</span>
                <span className="t"><b>{r.request_no} · {naira(r.amount)}</b><small className="wrap">{r.title}{r.requester_name ? `, ${r.requester_name}` : ""}{r.subhead_code ? `, ${r.subhead_code}` : ""}</small></span>
              </button>
            ); })}
          </div>
        )}
        {chosen.length ? (
          <>
            <div className="card"><div className="row"><b>{chosen.length} request{chosen.length === 1 ? "" : "s"}, {payees.length} payee{payees.length === 1 ? "" : "s"}</b><span className="amt">{naira(total)}</span></div></div>
            <label><span className="lbl">Preparing as</span><select className="inp" value={sec} onChange={(e) => setSection(e.target.value)}><option value="">Choose the section</option>{SECTIONS.map((s) => <option key={s} value={s}>Account Officer: {s}</option>)}</select></label>
            <div><span className="lbl">How it is paid</span><Chips label="Mode" value={effMode} onChange={(m) => !many && setMode(m)} items={many ? [{ k: "Transfer", label: "Transfer (several payees)" }] : [{ k: "Transfer", label: "Transfer" }, { k: "Cheque", label: "Cheque" }, { k: "Cash", label: "Cash" }]} /></div>
            {effMode === "Transfer" ? payees.map(([k, p]) => { const l = line(k, p.name); const set = (patch: Partial<Line>) => setLines((all) => ({ ...all, [k]: { ...l, ...patch } })); return (
              <div className="card" key={k}>
                <div className="row"><b>{p.name}</b><span className="amt">{naira(p.amount)}</span></div>
                <label><span className="lbl">Account name</span><input className="inp" value={l.account_name} onChange={(e) => set({ account_name: e.target.value })} /></label>
                <label><span className="lbl">Account number (10 digits)</span><input className="inp" inputMode="numeric" maxLength={10} value={l.account_number} onChange={(e) => set({ account_number: e.target.value.replace(/\D/g, "") })} /></label>
                <label><span className="lbl">Bank</span><input className="inp" list="rg-banks" value={l.bank_name} onChange={(e) => set({ bank_name: e.target.value })} /></label>
              </div>
            ); }) : null}
            <datalist id="rg-banks">{NIGERIAN_BANKS.map((b) => <option key={b} value={b} />)}</datalist>
            {effMode === "Cash" ? <label><span className="lbl">Paid in cash to</span><input className="inp" value={cashPayee} placeholder={payees[0]?.[1].name} onChange={(e) => setCashPayee(e.target.value)} /></label> : null}
            {effMode === "Cheque" ? (<>
              <label><span className="lbl">Cheque number</span><input className="inp" value={cheque.no} onChange={(e) => setCheque({ ...cheque, no: e.target.value })} /></label>
              <label><span className="lbl">Cheque date</span><input className="inp" type="date" value={cheque.date} onChange={(e) => setCheque({ ...cheque, date: e.target.value })} /></label>
              <label><span className="lbl">Bank</span><input className="inp" list="rg-banks" value={cheque.bank} onChange={(e) => setCheque({ ...cheque, bank: e.target.value })} /></label>
            </>) : null}
            <label><span className="lbl">Counter Signer</span><select className="inp" value={ctr} onChange={(e) => setCounter(e.target.value)}><option value="">Choose the Counter Signer</option>{(data?.counters || []).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
            <label><span className="lbl">Narration (optional)</span><textarea className="inp" value={narration || data?.reissue?.narration || ""} maxLength={500} onChange={(e) => setNarration(e.target.value)} placeholder="Being payment for…" style={{ minHeight: 70 }} /></label>
          </>
        ) : null}
        <Err text={err} />
      </Body>
      <div className="bar"><button type="button" className="btn bp" disabled={busy || !chosen.length} onClick={generate}><Send size={18} />{busy ? "Preparing…" : `Sign and send${chosen.length ? `, ${naira(total)}` : ""}`}</button></div>
    </>
  );
}

// ---- Manual voucher --------------------------------------------------------------------------------------
const REASONS = ["Utility bill", "Bank charge", "Emergency", "Other"];
export function ManualVoucher() {
  const { me } = useApp();
  const { replace } = useNav();
  const may = isOfficerRole(me.role) || isAdminRole(me.role);
  const { data, error } = useLoad(async () => {
    const c = await db();
    const [d, a, s, r, cs] = await Promise.all([
      c.from("departments").select("id,name").order("name"), c.from("iet_accounts").select(ACCOUNT_COLUMNS).order("name"),
      c.from("subheads").select(SUBHEAD_COLUMNS).eq("is_active", true).order("code"), c.from("department_account_routing").select("dept_id,iet_account_id,is_active"),
      c.from("payment_voucher_counter_signatories").select("full_name,signatory_type").eq("is_active", true).order("full_name"),
    ]);
    return { depts: (d.data || []) as Array<{ id: string; name: string }>, accounts: (a.data || []) as Account[], subs: (s.data || []) as Subhead[], routes: (r.data || []) as Array<{ dept_id: string; iet_account_id: string; is_active: boolean | null }>, counters: ((cs.data || []) as Array<{ full_name: string; signatory_type: string | null }>).filter((x) => !x.signatory_type || /counter/i.test(x.signatory_type)).map((x) => x.full_name) };
  }, []);
  const [f, setF] = useState({ dept: "", account: "", subhead: "", reason: "", section: "", payee: "", amount: "", date: todayIso(), mode: "Transfer" as Mode, narration: "", counter: "", reference: "" });
  const [files, setFiles] = useState<File[]>([]);
  const { busy, err, setErr, run } = useAction();
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const amt = parseAmount(f.amount);
  const acc = data?.accounts.find((a) => a.id === f.account);
  const sub = data?.subs.find((s) => s.id === f.subhead);
  const covered = !!acc && !!sub && amt > 0 && accountAvailable(acc) >= amt && subheadLeft(sub) >= amt;
  const deptAccounts = data ? data.accounts.filter((a) => data.routes.some((r) => r.dept_id === f.dept && r.iet_account_id === a.id && r.is_active !== false)) : [];
  const accounts = deptAccounts.length ? deptAccounts : data?.accounts || [];

  function send() {
    const why = !f.dept ? "Choose the department." : !f.account ? "Choose the IET account." : !f.subhead ? "Choose the subhead." : !f.reason ? "Choose the reason." : !f.section ? "Choose who you are preparing as." : f.payee.trim().length < 2 ? "Type the payee." : !(amt > 0) ? "Type the amount." : f.narration.trim().length < 3 ? "Write the narration." : !f.counter ? "Choose the Counter Signer." : !covered ? "The account or the subhead does not cover this amount." : "";
    if (why) { setErr(why); return; }
    let id = "";
    void run("sign and send this manual voucher", async () => {
      const narration = f.narration.trim().toLowerCase().startsWith(f.reason.toLowerCase()) ? f.narration.trim() : `${f.reason}: ${f.narration.trim()}`;
      const res = one<{ voucher_id?: string }>(parsed(await call("save_manual_payment_voucher", { p_voucher_id: null, p_account_id: f.account, p_subhead_id: f.subhead, p_payee_name: f.payee.trim().toUpperCase(), p_narration: narration, p_amount: amt, p_payment_method: f.mode, p_payment_reference: f.reference.trim() || null, p_payment_date: f.date })));
      id = res?.voucher_id || "";
      if (!id) throw new Error("The voucher was not saved. Try again.");
      await call("reqgen_pv_manual_prepare", { p_voucher_id: id, p_section: f.section, p_mode: f.mode, p_reason: f.reason });
      const c = await db();
      for (const file of files) {
        const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
        const up = await c.storage.from("voucher-attachments").upload(path, file, { upsert: false });
        if (!up.error) await c.rpc("reqgen_pv_add_attachment", { p_voucher_id: id, p_file_name: file.name, p_file_path: path, p_file_size: file.size });
      }
      await call("post_manual_payment_voucher", { p_voucher_id: id });
      await call("reqgen_pv_assign_signers", { p_voucher_id: id, p_cheque_signed_by_name: null, p_counter_signatory_name: f.counter, p_checker_id: null });
    }, "Manual voucher posted and sent to the Auditor.", () => { if (id) replace(<VoucherRecord id={id} />); });
  }

  if (!may) return <><Head title="Manual Voucher" /><Body><Note tone="wa">Only an Account Officer prepares payment vouchers.</Note></Body></>;
  return (
    <>
      <Head title="Manual Voucher" />
      <Body bar>
        <Err text={error} />
        <p className="mu" style={{ margin: 0 }}>A voucher with no request: a utility bill, a bank charge or an emergency. It is written in the account and subhead ledgers when you send it.</p>
        <label><span className="lbl">Department</span><select className="inp" value={f.dept} onChange={(e) => set({ dept: e.target.value, subhead: "", account: "" })}><option value="">Choose the department</option>{(data?.depts || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label><span className="lbl">Paid from (IET account)</span><select className="inp" value={f.account} onChange={(e) => set({ account: e.target.value })}><option value="">Choose the account</option>{accounts.map((a) => <option key={a.id} value={a.id}>{accountName(a)}{a.bank_name ? `, ${a.bank_name}` : ""} ({naira(accountAvailable(a))} free)</option>)}</select></label>
        <label><span className="lbl">Subhead</span><select className="inp" value={f.subhead} onChange={(e) => set({ subhead: e.target.value })}><option value="">Choose the subhead</option>{(data?.subs || []).filter((s) => s.dept_id === f.dept).map((s) => <option key={s.id} value={s.id}>{subheadLabel(s)} ({naira(subheadLeft(s))} left)</option>)}</select></label>
        <label><span className="lbl">Reason</span><select className="inp" value={f.reason} onChange={(e) => set({ reason: e.target.value })}><option value="">Choose the reason</option>{REASONS.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
        <label><span className="lbl">Preparing as</span><select className="inp" value={f.section} onChange={(e) => set({ section: e.target.value })}><option value="">Choose the section</option>{SECTIONS.map((s) => <option key={s} value={s}>Account Officer: {s}</option>)}</select></label>
        <label><span className="lbl">Payee</span><input className="inp" value={f.payee} onChange={(e) => set({ payee: e.target.value })} /></label>
        <label><span className="lbl">Amount (₦)</span><input className="inp" inputMode="decimal" value={f.amount} onChange={(e) => set({ amount: fmtAmount(e.target.value) })} /></label>
        {amt > 0 && acc && sub ? <Note tone={covered ? "ok" : "er"}>{covered ? "The account and the subhead cover this amount." : "The account or the subhead does not cover this amount."}</Note> : null}
        <label><span className="lbl">Payment date</span><input className="inp" type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} /></label>
        <div><span className="lbl">How it is paid</span><Chips label="Mode" value={f.mode} onChange={(m) => set({ mode: m })} items={[{ k: "Transfer", label: "Transfer" }, { k: "Cheque", label: "Cheque" }, { k: "Cash", label: "Cash" }]} /></div>
        <label><span className="lbl">Payment reference (optional)</span><input className="inp" value={f.reference} onChange={(e) => set({ reference: e.target.value })} /></label>
        <label><span className="lbl">Narration</span><textarea className="inp" value={f.narration} maxLength={500} onChange={(e) => set({ narration: e.target.value })} placeholder="Being payment for…" style={{ minHeight: 70 }} /></label>
        <label><span className="lbl">Counter Signer</span><select className="inp" value={f.counter} onChange={(e) => set({ counter: e.target.value })}><option value="">Choose the Counter Signer</option>{(data?.counters || []).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <div>
          <span className="lbl">Supporting files (optional)</span>
          {files.length ? <div className="grp" style={{ marginBottom: 8 }}>{files.map((x, i) => <div className="cell" key={`${x.name}-${i}`}><span className="av ic-mu"><Paperclip size={18} /></span><span className="t"><b>{x.name}</b><small>{kb(x.size)}</small></span><button type="button" className="ib" aria-label={`Remove ${x.name}`} onClick={() => setFiles((all) => all.filter((_, j) => j !== i))}><X size={18} /></button></div>)}</div> : null}
          <AttachButtons onFiles={(list) => { const add = Array.from(list || []).filter((x) => x.size <= 10 * 1024 * 1024); setFiles((all) => [...all, ...add]); }} />
        </div>
        <Err text={err} />
      </Body>
      <div className="bar"><button type="button" className="btn bp" disabled={busy} onClick={send}><Send size={18} />{busy ? "Sending…" : "Sign and send to the Auditor"}</button></div>
    </>
  );
}

// ---- Signatories -----------------------------------------------------------------------------------------
export function Signatories() {
  const { me } = useApp();
  const may = isOfficerRole(me.role) || isAdminRole(me.role) || isAuditorRole(me.role);
  const { data, error, reload } = useLoad(async () => {
    const c = await db();
    const [s, p] = await Promise.all([
      c.from("payment_voucher_counter_signatories").select("id,full_name,signatory_type,is_active").order("full_name"),
      c.from("profiles").select("id,full_name,is_active").order("full_name"),
    ]);
    if (s.error) throw new Error(s.error.message);
    return { list: (s.data || []) as Array<{ id: string; full_name: string; signatory_type: string | null; is_active: boolean }>, people: ((p.data || []) as Array<{ id: string; full_name: string | null; is_active: boolean | null }>).filter((x) => x.is_active !== false && x.full_name) };
  }, []);
  const [add, setAdd] = useState("");
  const { busy, err, run } = useAction();
  return (
    <>
      <Head title="Signatories" />
      <Body onRefresh={reload}>
        <p className="mu" style={{ margin: 0 }}>Counter Signers who may be chosen on a voucher. Switching one off keeps their past signatures.</p>
        <Err text={error || err} />
        {!data ? <Skeleton rows={3} /> : (
          <div className="grp">
            {data.list.map((r) => (
              <Cell key={r.id} icon={<UserCheck size={18} />} iconTone={r.is_active ? "ok" : "mu"} title={r.full_name} sub={r.is_active ? "Can be chosen" : "Switched off"}
                right={may ? <button type="button" className="btn bs sm" disabled={busy} onClick={() => void run(null, async () => { const { error: e } = await (await db()).from("payment_voucher_counter_signatories").update({ is_active: !r.is_active, updated_at: new Date().toISOString() }).eq("id", r.id); if (e) throw new Error(e.message); }, r.is_active ? `${r.full_name} switched off.` : `${r.full_name} can be chosen again.`, reload)}>{r.is_active ? "Switch off" : "Switch on"}</button> : undefined} />
            ))}
          </div>
        )}
        {may && data ? (
          <div className="card">
            <b>Add a Counter Signer</b>
            <select className="inp" value={add} onChange={(e) => setAdd(e.target.value)}><option value="">Choose the staff member</option>{data.people.filter((p) => !data.list.some((l) => l.full_name === p.full_name)).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
            <button type="button" className="btn bp block" disabled={busy || !add} onClick={() => { const p = data.people.find((x) => x.id === add); if (!p) return; void run(null, async () => { const { error: e } = await (await db()).from("payment_voucher_counter_signatories").insert({ full_name: String(p.full_name).trim(), signatory_type: "CounterSigner", is_active: true, created_by: me.id }); if (e) throw new Error(e.message); }, `${p.full_name} added.`, async () => { setAdd(""); await reload(); }); }}><Plus size={18} />Add</button>
          </div>
        ) : null}
      </Body>
    </>
  );
}
