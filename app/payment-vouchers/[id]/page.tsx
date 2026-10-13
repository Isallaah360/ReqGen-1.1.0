"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { normalizeRole } from "@/lib/roles";
import { promptDialog } from "@/lib/dialog";
import { confirmFresh } from "@/lib/v4/freshConfirm";
import { nairaExact, nairaInWords } from "@/lib/v4/money";
import { shortDate, waitedFor } from "@/lib/v4/requestText";
import { SECTIONS, isManual, pvAmount, pvChip, pvMode, pvStage, pvSteps, type ScheduleLine, type Voucher } from "@/lib/v4/vouchers";
import { useIdentity } from "@/app/components/v4/useIdentity";
import { remindVoucher } from "@/app/components/v4/useVouchers";
import Icon from "@/app/components/v4/Icon";
import SignatureInk from "@/app/components/ui/SignatureInk";
import { Select } from "@/app/components/v4/Select";
import { Chip, Notice, Skeleton, V4Page } from "@/app/components/v4/ui";

type Item = { id: string; request_id: string | null; request_no: string | null; title: string | null; amount: number | null; dept_name: string | null; subhead_code: string | null; subhead_name: string | null; requester_name: string | null };
type Hist = { id: string; action_type: string | null; from_status: string | null; to_status: string | null; comment: string | null; actor_name: string | null; actor_role: string | null; created_at: string };
type PvFile = { id: string; file_name: string; file_path: string; uploaded_by_label: string | null; created_at: string };
type Msg = { tone: "red" | "green" | "amber" | "blue"; text: string };

const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const todayIso = () => new Date().toISOString().slice(0, 10);

export default function VoucherRecordPage() {
  return <Suspense fallback={<V4Page><Skeleton lines={8} /></V4Page>}><VoucherRecord /></Suspense>;
}

/** Payment Vouchers › Voucher record (mock-up 50): one action card for whoever holds the voucher now. */
function VoucherRecord() {
  const me = useIdentity();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = String(params.id || "");
  const role = normalizeRole(me.role).replace(/\d+$/, "");
  const isOfficer = ["account", "accounts", "accountofficer"].includes(role);
  const isAdmin = role === "admin";
  const isAuditor = role === "auditor";
  const isDG = role === "dg" || role === "directorgeneral";

  const [v, setV] = useState<Voucher | null | undefined>(undefined);
  const [items, setItems] = useState<Item[]>([]);
  const [hist, setHist] = useState<Hist[]>([]);
  const [schedule, setSchedule] = useState<ScheduleLine[]>([]);
  const [pvFiles, setPvFiles] = useState<PvFile[]>([]);
  const [counters, setCounters] = useState<string[]>([]);
  const [mySig, setMySig] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [checks, setChecks] = useState({ amounts: false, bank: false });
  const [paidOn, setPaidOn] = useState(todayIso());
  const [paidRef, setPaidRef] = useState("");
  const [newCounter, setNewCounter] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(search.get("made") ? { tone: "green", text: "Voucher generated, numbered and sent to the Auditor. Each payee has been told." } : null);

  const load = useCallback(async () => {
    let rec = await supabase.rpc("reqgen_pv_record", { p_voucher_id: id });
    if (rec.error && /could not find the function|schema cache/i.test(rec.error.message)) rec = await supabase.rpc("get_payment_voucher_detail", { p_voucher_id: id });
    if (rec.error) { setLoadError(rec.error.message); setV(null); return; }
    const row = (Array.isArray(rec.data) ? rec.data[0] : rec.data) as Voucher | undefined;
    setV(row || null);
    if (!row) return;
    const [it, h, s, c, p, f] = await Promise.all([
      supabase.rpc("get_payment_voucher_items", { p_voucher_id: id }),
      supabase.rpc("reqgen_pv_history", { p_voucher_id: id }).then((r) => (r.error ? supabase.rpc("get_payment_voucher_history", { p_voucher_id: id }) : r)),
      supabase.from("reqgen_pv_transfer_schedule").select("*").eq("voucher_id", id).order("line_no"),
      supabase.from("payment_voucher_counter_signatories").select("full_name,signatory_type").eq("is_active", true).order("full_name"),
      supabase.from("profiles").select("signature_url").eq("id", me.userId).maybeSingle(),
      supabase.from("reqgen_pv_attachments").select("id,file_name,file_path,uploaded_by_label,created_at").eq("voucher_id", id).order("created_at"),
    ]);
    setPvFiles(f.error ? [] : ((f.data || []) as PvFile[]));
    setItems((it.data || []) as Item[]);
    setHist(((h.data || []) as Hist[]).slice().reverse());
    setSchedule((s.data || []) as ScheduleLine[]);
    setCounters(((c.data || []) as Array<{ full_name: string; signatory_type: string | null }>).filter((x) => !x.signatory_type || /counter/i.test(x.signatory_type)).map((x) => x.full_name));
    setMySig((p.data as { signature_url?: string | null } | null)?.signature_url || null);
  }, [id, me.userId]);
  useEffect(() => { if (me.ready && id) queueMicrotask(() => { void load(); }); }, [me.ready, id, load]);

  const stage = pvStage(v?.status);
  const steps = useMemo(() => (v ? pvSteps(v) : []), [v]);
  const isPreparer = !!v && v.prepared_by === me.userId;
  const myCheck = !!v && stage === "check" && isAuditor && !isPreparer && (!v.current_signing_owner || v.current_signing_owner === me.userId);
  const myCounter = !!v && stage === "counter" && v.cheque_counter_signed_by === me.userId;
  const myAuthorise = !!v && stage === "dg" && isDG;
  const myPay = !!v && stage === "ready" && (isOfficer || isAdmin);
  const myResend = !!v && stage === "returned" && (isPreparer || isAdmin);
  const canCancel = !!v && !["paid", "cancelled"].includes(stage) && (isAuditor || isAdmin || (isPreparer && ["check", "returned"].includes(stage)));
  const canRemind = !!v && ["check", "counter", "dg"].includes(stage) && (isOfficer || isAuditor || isAdmin);
  const canChangeCounter = !!v && (isOfficer || isAdmin) && (stage === "check" || (stage === "counter" && !v.cheque_counter_signed_at));
  const canSetSection = !!v && (isPreparer || isAdmin) && !v.checked_at && !["paid", "cancelled"].includes(stage);
  const canReissue = !!v && stage === "cancelled" && (isOfficer || isAdmin) && !isManual(v);

  async function run(fn: () => PromiseLike<{ error: { message: string } | null; data?: unknown }>, ok: string) {
    setBusy(true); setMsg(null);
    const { error } = await fn();
    setBusy(false);
    if (error) { setMsg({ tone: "red", text: error.message }); return false; }
    setMsg({ tone: "green", text: ok });
    setComment("");
    await load();
    return true;
  }

  async function sign(kind: "check" | "counter" | "dg") {
    if (!v) return;
    if (kind === "check" && !(checks.amounts && checks.bank)) { setMsg({ tone: "red", text: "Tick both checks before you sign." }); return; }
    if (!mySig) { setMsg({ tone: "red", text: "Your signature is missing. Add it in My Account › Signature before signing." }); return; }
    if (kind === "dg") {
      const why = await confirmFresh("sign, stamp and authorise this voucher");
      if (why) { if (why !== "cancelled") setMsg({ tone: "red", text: why }); return; }
    }
    await run(() => supabase.rpc("reqgen_pv_sign", { p_voucher_id: v.id, p_comment: comment.trim() || null }),
      kind === "check" ? `${v.voucher_no} checked and signed. The Counter Signer has been told.`
        : kind === "counter" ? `${v.voucher_no} counter-signed. The Director General has been told.`
          : `${v.voucher_no} signed, stamped and authorised. Account has been told it is ready to pay.`);
  }

  async function sendBack() {
    if (!v) return;
    const reason = await promptDialog({ title: "Send this voucher back to Account?", message: "The Account Officer sees your reason, corrects the voucher and sends it again. Signing then starts again from the Auditor.", label: "Reason", defaultValue: comment, confirmLabel: "Send back", tone: "danger" });
    if (!reason) return;
    await run(() => supabase.rpc("reqgen_pv_return", { p_voucher_id: v.id, p_reason: reason }), `${v.voucher_no} sent back to the Account Officer.`);
  }

  async function resend() {
    if (!v) return;
    const note = await promptDialog({ title: "Send the voucher again?", message: "Say what you corrected. Signing starts again from the Auditor.", label: "What did you correct?", confirmLabel: "Send again" });
    if (!note) return;
    await run(() => supabase.rpc("reqgen_pv_resend", { p_voucher_id: v.id, p_comment: note }), `${v.voucher_no} sent again to the Auditor.`);
  }

  async function markPaid() {
    if (!v) return;
    if (!paidOn) { setMsg({ tone: "red", text: "Choose the date it was paid." }); return; }
    const why = await confirmFresh("record this payment");
    if (why) { if (why !== "cancelled") setMsg({ tone: "red", text: why }); return; }
    await run(() => supabase.rpc("reqgen_pv_mark_paid", { p_voucher_id: v.id, p_paid_on: paidOn, p_reference: paidRef.trim() || null }), `${v.voucher_no} marked as paid. The ledgers are updated and each payee has been told.`);
  }

  async function cancel() {
    if (!v) return;
    const reason = await promptDialog({ title: `Cancel ${v.voucher_no}?`, message: "The number is kept and shown as cancelled. The requests become ready for a new voucher.", label: "Reason", confirmLabel: "Cancel voucher", tone: "danger" });
    if (!reason) return;
    await run(() => supabase.rpc("reqgen_pv_cancel", { p_voucher_id: v.id, p_reason: reason }), `${v.voucher_no} cancelled. Its requests are ready for a new voucher.`);
  }

  async function openFile(file: PvFile) {
    const { data, error } = await supabase.storage.from("voucher-attachments").createSignedUrl(file.file_path, 120);
    if (error || !data?.signedUrl) { setMsg({ tone: "red", text: error?.message || "The file could not be opened." }); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function remind() {
    if (!v) return;
    setBusy(true); setMsg(null);
    const res = await remindVoucher(v.id);
    setBusy(false);
    setMsg(res.error ? { tone: "red", text: res.error } : { tone: "green", text: `Reminder sent to ${res.sentTo || "the officer holding it"}.` });
    if (!res.error) await load();
  }

  async function changeCounter() {
    if (!v || !newCounter) return;
    await run(() => supabase.rpc("reqgen_pv_assign_signers", { p_voucher_id: v.id, p_cheque_signed_by_name: null, p_counter_signatory_name: newCounter, p_checker_id: null }), `Counter Signer changed to ${newCounter}.`);
    setNewCounter("");
  }

  async function setSection(s: string) {
    if (!v) return;
    await run(() => supabase.rpc("reqgen_pv_set_preparing_as", { p_voucher_id: v.id, p_section: s }), `Preparing as Account Officer, ${s}.`);
  }

  if (v === undefined) return <V4Page><Skeleton lines={8} /></V4Page>;
  if (v === null) {
    return (
      <V4Page>
        <Notice tone="red" title="This voucher cannot be opened.">{loadError || "It does not exist, or it is not one you prepare, check or sign."}</Notice>
        <Link className="v4-btn v4-btn-secondary" href="/payment-vouchers/centre"><Icon name="left" />Voucher Centre</Link>
      </V4Page>
    );
  }

  const chip = pvChip(v.status);
  const amount = pvAmount(v);
  const payee = Number(v.payee_count || 1) > 1 ? `${v.payee_count} payees` : String(v.payee_name || v.cash_payee_name || "—").toUpperCase();
  const lastStepPayee = Number(v.payee_count || 1) > 1 ? `${v.payee_count} payees` : String(v.payee_name || "Payee").toUpperCase();
  const waitingSince = v.updated_at || v.created_at;

  return (
    <V4Page>
      <section className="v4-card v4-card-pad">
        <div className="v4-rec">
          <div>
            <Chip tone={chip.tone}>{chip.label}</Chip>
            <h1 className="v4-page-title" style={{ marginTop: 8 }}>{v.voucher_no || "Payment voucher"}</h1>
            <div className="v4-meta">
              <span>Payee <b>{payee}</b></span>
              <span>Mode <b>{pvMode(v)}</b></span>
              <span>Requests <b>{items.length || v.item_count || 1}</b></span>
              <span>Prepared <b>{shortDate(v.prepared_at || v.created_at)}</b>{v.prepared_section ? <> · {v.prepared_section}</> : null}</span>
              {isManual(v) ? <span><b>Manual voucher</b></span> : null}
            </div>
          </div>
          <div className="v4-right">
            <div className="v4-label">Total</div>
            <div className="v4-amount-big">{nairaExact(amount)}</div>
            <span className="v4-help" style={{ fontSize: 12.5 }}>{nairaInWords(amount)}</span>
            <div className="v4-btns">
              {canRemind ? <button className="v4-btn v4-btn-secondary" type="button" disabled={busy} onClick={() => void remind()}><Icon name="bell" />Remind</button> : null}
              {canCancel ? <button className="v4-btn v4-btn-secondary" type="button" disabled={busy} style={{ color: "var(--v4-red)" }} onClick={() => void cancel()}><Icon name="x" />Cancel</button> : null}
              {canReissue ? <Link className="v4-btn v4-btn-secondary" href={`/payment-vouchers/new?reissue=${v.id}`}><Icon name="returned" />Reissue</Link> : null}
              <Link className="v4-btn v4-btn-secondary" href={`/payment-vouchers/${v.id}/print`}><Icon name="printer" />{stage === "ready" || stage === "paid" ? "Print" : "Preview print"}</Link>
            </div>
          </div>
        </div>
      </section>

      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {stage === "returned" ? <Notice tone="red" title={`Sent back by ${v.returned_by_name || "a signer"}${v.returned_at ? ` · ${when(v.returned_at)}` : ""}`}>“{v.returned_reason || "No reason given"}”</Notice> : null}
      {stage === "cancelled" ? <Notice tone="red" title="This voucher is cancelled.">{v.cancel_reason ? `“${v.cancel_reason}” · ` : ""}The number is kept. Its requests are ready for a new voucher.</Notice> : null}
      {stage === "paid" ? <Notice tone="green" title={`Paid on ${shortDate(v.paid_on || v.paid_at)}`}>{v.paid_by_name ? `Recorded by ${v.paid_by_name}` : "Recorded"}{v.paid_reference ? ` · bank reference ${v.paid_reference}` : ""}. The account and subhead ledgers show this payment.</Notice> : null}

      {myCheck ? (
        <section className="v4-action-card v4-card-pad">
          <h2 className="v4-h2" style={{ marginBottom: 4 }}>Your action: Check and sign as Auditor</h2>
          <p className="v4-help" style={{ margin: "0 0 12px" }}>Check the requests, amounts and subhead below. Your signature goes on <b>Checked By</b>; the Counter Signer is told next.</p>
          <label className="v4-check"><input type="checkbox" checked={checks.amounts} onChange={(e) => setChecks({ ...checks, amounts: e.target.checked })} /> Amounts match the attached requests</label>
          <label className="v4-check"><input type="checkbox" checked={checks.bank} onChange={(e) => setChecks({ ...checks, bank: e.target.checked })} /> Payee {v.disbursement_mode === "Transfer" ? "bank details match" : "details match"} the request</label>
          <CommentBox value={comment} onChange={setComment} />
          <div className="v4-form-actions">
            <button className="v4-btn v4-btn-secondary" type="button" disabled={busy} onClick={() => void sendBack()}>Return to Account</button>
            <button className="v4-btn v4-btn-primary v4-btn-lg" type="button" disabled={busy} onClick={() => void sign("check")}><Icon name="pentool" />{busy ? "Signing…" : "Check and sign"}</button>
          </div>
        </section>
      ) : null}

      {myCounter ? (
        <section className="v4-action-card v4-card-pad">
          <h2 className="v4-h2" style={{ marginBottom: 4 }}>Your action: Counter-sign</h2>
          <p className="v4-help" style={{ margin: "0 0 12px" }}>Checked by {v.checked_by_name || "the Auditor"}. Your signature goes on the counter signature line; the Director General is told next.</p>
          <CommentBox value={comment} onChange={setComment} />
          <div className="v4-form-actions">
            <button className="v4-btn v4-btn-secondary" type="button" disabled={busy} onClick={() => void sendBack()}>Send back</button>
            <button className="v4-btn v4-btn-primary v4-btn-lg" type="button" disabled={busy} onClick={() => void sign("counter")}><Icon name="pentool" />{busy ? "Signing…" : "Counter-sign"}</button>
          </div>
        </section>
      ) : null}

      {myAuthorise ? (
        <section className="v4-action-card v4-card-pad">
          <h2 className="v4-h2" style={{ marginBottom: 4 }}>Your action: Sign, stamp and authorise</h2>
          <p className="v4-help" style={{ margin: "0 0 12px" }}>One touch puts your signature on <b>Authorized By</b> and on the cheque line, places the IET stamp beside your signature, and authorises the payment. Account is told it is ready to pay. You confirm with your fingerprint or 2FA code.</p>
          <div className="v4-stamp-preview">
            <div className="v4-demo">
              {mySig ? <span className="rg-sig-slot" style={{ position: "absolute", left: 18, bottom: 4, width: 140, height: 44 }}><SignatureInk src={mySig} alt="Your signature" /></span> : null}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="v4-iet-stamp" src="/v4/iet-stamp.png" alt="IET stamp" />
            </div>
            <div><strong>Signature + IET stamp</strong><span>Same for vouchers from requests and manual vouchers. Nothing on the voucher moves.</span></div>
          </div>
          <CommentBox value={comment} onChange={setComment} />
          <div className="v4-form-actions">
            <button className="v4-btn v4-btn-secondary" type="button" disabled={busy} onClick={() => void sendBack()}>Send back</button>
            <button className="v4-btn v4-btn-primary v4-btn-lg" type="button" disabled={busy} onClick={() => void sign("dg")}><Icon name="fingerprint" />{busy ? "Working…" : "Sign, stamp and authorise"}</button>
          </div>
        </section>
      ) : null}

      {myPay ? (
        <section className="v4-action-card v4-card-pad">
          <h2 className="v4-h2" style={{ marginBottom: 4 }}>Ready to pay</h2>
          <p className="v4-help" style={{ margin: "0 0 12px" }}>Fully signed and authorised. After paying, mark it paid; the payee’s saved signature fills Received By, and the payment is written in the account and subhead ledgers.</p>
          <div className="v4-form-grid">
            <label className="v4-field"><span className="v4-flabel">Paid on <span className="v4-req">*</span></span><input className="v4-input" type="date" max={todayIso()} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} /></label>
            <label className="v4-field"><span className="v4-flabel">Bank reference</span><input className="v4-input" value={paidRef} placeholder={v.disbursement_mode === "Cheque" ? `Cheque ${v.cheque_no || ""}` : "Transfer reference"} onChange={(e) => setPaidRef(e.target.value)} /></label>
          </div>
          <div className="v4-form-actions">
            <Link className="v4-btn v4-btn-secondary" href={`/payment-vouchers/${v.id}/print`}><Icon name="printer" />Print voucher</Link>
            <button className="v4-btn v4-btn-primary v4-btn-lg" type="button" disabled={busy} onClick={() => void markPaid()}><Icon name="check" />{busy ? "Saving…" : "Mark as paid"}</button>
          </div>
        </section>
      ) : null}

      {myResend ? (
        <section className="v4-action-card v4-card-pad">
          <h2 className="v4-h2" style={{ marginBottom: 4 }}>Your action: Correct and send again</h2>
          <p className="v4-help" style={{ margin: "0 0 12px" }}>Fix what was asked{isManual(v) ? " in the manual voucher" : " — for a wrong request or amount, cancel this voucher and reissue it"}. Then send it again: signing starts again from the Auditor.</p>
          <div className="v4-form-actions">
            {isManual(v) ? <Link className="v4-btn v4-btn-secondary" href={`/payment-vouchers/manual?id=${v.id}`}><Icon name="pen" />Edit manual voucher</Link> : null}
            <button className="v4-btn v4-btn-primary v4-btn-lg" type="button" disabled={busy} onClick={() => void resend()}><Icon name="send" />Send again</button>
          </div>
        </section>
      ) : null}

      <section className="v4-card v4-card-pad">
        <h2 className="v4-h2" style={{ marginBottom: 12 }}>Signing order</h2>
        <ol className="v4-chain">
          {steps.map((s, i) => {
            const isMe = s.state === "now" && ((s.key === "checked" && myCheck) || (s.key === "counter" && myCounter) || (s.key === "dg" && myAuthorise) || (s.key === "paid" && myPay));
            return (
              <li key={s.key} className={`v4-${stage === "cancelled" && s.state !== "done" ? "wait" : s.state}`}>
                <span className="v4-st">{i + 1} · {s.key === "paid" ? "Received" : s.label}</span>
                <strong>{isMe ? "You" : s.key === "paid" ? lastStepPayee : s.who}</strong>
                <span className="v4-r">{s.key === "paid" ? (stage === "paid" ? `Paid ${shortDate(v.paid_on || v.paid_at)}` : "Payee · after payment") : s.role}{s.state === "now" && s.key !== "paid" && stage !== "returned" ? ` · waiting ${waitedFor(waitingSince)}` : ""}</span>
                <em>{s.state === "done" && s.at ? when(s.at) : ""}</em>
                <span className="v4-ink">{s.state === "done" && s.key !== "paid" ? <span className="v4-chip v4-chip-green"><Icon name="pentool" size="sm" />{s.key === "dg" ? "Signed + stamp" : "Signed"}</span> : null}</span>
              </li>
            );
          })}
        </ol>
        {canChangeCounter || canSetSection ? (
          <div className="v4-form-grid" style={{ marginTop: 16 }}>
            {canSetSection ? (
              <div className="v4-field"><span className="v4-flabel">Preparing as</span><Select ariaLabel="Preparing as" value={v.prepared_section || ""} placeholder="Choose the section" onChange={(s) => void setSection(s)} options={SECTIONS.map((s) => ({ value: s, label: `Account Officer — ${s}` }))} /><span className="v4-help">Can change until the Auditor checks.</span></div>
            ) : null}
            {canChangeCounter ? (
              <div className="v4-field"><span className="v4-flabel">Change the Counter Signer</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1 }}><Select ariaLabel="Counter Signer" value={newCounter} placeholder={v.counter_signatory_name || v.cheque_counter_signed_by_name || "Choose"} onChange={setNewCounter} options={counters.filter((n) => n !== (v.counter_signatory_name || v.cheque_counter_signed_by_name)).map((n) => ({ value: n, label: n }))} /></div>
                  <button className="v4-btn v4-btn-secondary" type="button" disabled={!newCounter || busy} onClick={() => void changeCounter()}>Save</button>
                </div>
                <span className="v4-help">Only before the Counter Signer signs.</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {schedule.length > 1 || (schedule.length === 1 && Number(v.payee_count || 1) > 1) ? (
        <section className="v4-card">
          <div className="v4-card-head"><h2 className="v4-h2">Transfer schedule · {schedule.length} payee{schedule.length === 1 ? "" : "s"}</h2><span className="v4-help">Printed with the voucher for the bank.</span></div>
          <div className="v4-table-wrap">
            <table className="v4-data v4-stack">
              <thead><tr><th>#</th><th>Account name</th><th>Bank</th><th>Account no.</th><th className="v4-hide-sm">Requests</th><th className="v4-r">Amount</th></tr></thead>
              <tbody>
                {schedule.map((l) => (
                  <tr key={l.id}><td>{l.line_no}</td><td data-label="Account name"><span className="v4-strong">{l.account_name}</span></td><td data-label="Bank">{l.bank_name}</td><td data-label="Account no." className="v4-num">{l.account_number}</td><td className="v4-hide-sm">{(l.request_ids || []).length}</td><td className="v4-r v4-num v4-strong">{nairaExact(l.amount)}</td></tr>
                ))}
                <tr><td colSpan={5} className="v4-r v4-strong v4-hide-sm">Total to transfer</td><td className="v4-r v4-num v4-strong">{nairaExact(schedule.reduce((t, l) => t + Number(l.amount || 0), 0))}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="v4-cols">
        <section className="v4-card">
          <div className="v4-card-head"><h2 className="v4-h2">{isManual(v) ? "Lines on this voucher" : "Requests on this voucher"}</h2></div>
          {items.length ? (
            <div className="v4-table-wrap">
              <table className="v4-data v4-stack">
                <thead><tr><th>Request</th><th className="v4-r">Amount</th><th>Subhead</th><th className="v4-r">Open</th></tr></thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td><span className="v4-strong">{it.request_no || "—"}</span><span className="v4-sub">{it.title || ""}{it.requester_name ? ` · ${it.requester_name}` : ""}</span></td>
                      <td className="v4-r v4-num v4-strong">{nairaExact(it.amount)}</td>
                      <td data-label="Subhead">{it.subhead_code ? `${it.subhead_code} — ${it.subhead_name || ""}` : "—"}</td>
                      <td className="v4-r">{it.request_id ? <Link className="v4-btn v4-btn-secondary" style={{ minHeight: 38, padding: "0 12px" }} href={`/requests/${it.request_id}`}>Request</Link> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="v4-muted" style={{ padding: "16px 20px", margin: 0 }}>{v.narration || "No lines."}</p>}
          {pvFiles.length ? (
            <ul className="v4-files" style={{ padding: "0 20px 16px" }}>
              {pvFiles.map((f) => (
                <li key={f.id}><span className="v4-fi">{/\.pdf$/i.test(f.file_name) ? "PDF" : "IMG"}</span><span className="v4-ft"><strong>{f.file_name}</strong><span>{f.uploaded_by_label || ""} · {shortDate(f.created_at)}</span></span><button type="button" className="v4-btn v4-btn-ghost" onClick={() => void openFile(f)}>Open</button></li>
              ))}
            </ul>
          ) : null}
        </section>
        <section className="v4-card">
          <div className="v4-card-head"><h2 className="v4-h2">History</h2></div>
          {hist.length ? (
            <ul className="v4-timeline" style={{ padding: "16px 20px 0" }}>
              {hist.map((h) => {
                const look = histLook(h);
                return (
                  <li key={h.id}>
                    <span className={`v4-ti v4-t-${look.tone}`}><Icon name={look.icon} /></span>
                    <span><strong>{look.text}</strong><span>{h.actor_name || ""}{h.comment ? ` · “${h.comment}”` : ""}</span></span>
                    <span className="v4-time">{when(h.created_at)}</span>
                  </li>
                );
              })}
            </ul>
          ) : <p className="v4-muted" style={{ padding: "16px 20px", margin: 0 }}>No history yet.</p>}
        </section>
      </div>
      <div><button className="v4-btn v4-btn-ghost" type="button" onClick={() => router.push("/payment-vouchers/centre")}><Icon name="left" />Voucher Centre</button></div>
    </V4Page>
  );
}

function CommentBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <label className="v4-field" style={{ marginTop: 12 }}><span className="v4-flabel">Comment (optional)</span><input className="v4-input" value={value} maxLength={300} onChange={(e) => onChange(e.target.value)} /></label>;
}

function histLook(h: Hist): { tone: string; icon: string; text: string } {
  const a = String(h.action_type || "").toLowerCase();
  if (a.includes("return")) return { tone: "red", icon: "returned", text: "Sent back to Account" };
  if (a.includes("cancel")) return { tone: "red", icon: "x", text: "Cancelled" };
  if (a.includes("remind")) return { tone: "blue", icon: "bell", text: "Reminder sent" };
  if (a === "paid" || a === "pay") return { tone: "green", icon: "wallet", text: "Paid" };
  if (a.includes("authoris") || a.includes("authoriz")) return { tone: "green", icon: "pentool", text: "Signed, stamped and authorised by the DG" };
  if (a.includes("counter")) return { tone: "green", icon: "pentool", text: "Counter-signed" };
  if (a === "check") return { tone: "green", icon: "check", text: "Checked and signed by the Auditor" };
  if (a.includes("assign")) return { tone: "blue", icon: "users", text: "Signers set" };
  if (a.includes("sent again")) return { tone: "blue", icon: "send", text: "Corrected and sent again" };
  if (a.includes("prepared") || a.includes("generate") || a.includes("create")) return { tone: "green", icon: "pen", text: "Prepared and signed" };
  return { tone: "blue", icon: "info", text: h.action_type || "Updated" };
}
