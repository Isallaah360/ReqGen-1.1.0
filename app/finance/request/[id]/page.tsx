"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { normalizeRole } from "@/lib/roles";
import { promptDialog } from "@/lib/dialog";
import { isAwaitingUser } from "@/lib/approvalQueue";
import { confirmFresh } from "@/lib/v4/freshConfirm";
import { ACCOUNT_COLUMNS, NIGERIAN_BANKS, SUBHEAD_COLUMNS, accountAvailable, accountName, accountSub, loadFinanceSettings, num, subheadLabel, type Account, type Subhead } from "@/lib/v4/finance";
import { nairaExact, nairaInWords } from "@/lib/v4/money";
import { shortDate, stageTitle } from "@/lib/v4/requestText";
import { SECTIONS } from "@/lib/v4/vouchers";
import RequestAccessGate from "@/app/components/requests/RequestAccessGate";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Chip, Notice, Skeleton, V4Page } from "@/app/components/v4/ui";

type Req = {
  id: string; request_no: string | null; title: string | null; details: string | null; amount: number | null; status: string | null; current_stage: string | null;
  current_owner: string | null; assigned_account_officer_id: string | null; assigned_account_officer_user_id: string | null; assigned_account_officer_name: string | null;
  requester_name: string | null; dept_id: string | null; subhead_id: string | null; request_type: string | null; personal_category: string | null; updated_at: string | null; created_at: string | null;
};
const REQ_COLUMNS = "id,request_no,title,details,amount,status,current_stage,current_owner,assigned_account_officer_id,assigned_account_officer_user_id,assigned_account_officer_name,requester_name,dept_id,subhead_id,request_type,personal_category,updated_at,created_at";
type Attachment = { id: string; file_name: string; file_path: string; file_size: number | null };
type Chain = { step_order: number; stage: string; owner_name: string | null; state: string; acted_by_name: string | null; acted_at: string | null };
type Mode = "Transfer" | "Cash" | "Cheque";
type Msg = { tone: "red" | "green" | "amber" | "blue"; text: string };

const payeeKey = (n: string | null | undefined) => String(n || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "");
const todayIso = () => new Date().toISOString().slice(0, 10);

/** Finance › Treat a request (mock-up 38): release the fund and prepare its payment voucher in one step. */
export default function TreatRequestPage() {
  const params = useParams<{ id: string }>();
  return <RequestAccessGate requestId={params?.id}><TreatRequest /></RequestAccessGate>;
}

function TreatRequest() {
  const me = useIdentity();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = String(params.id || "");
  const role = normalizeRole(me.role).replace(/\d+$/, "");
  const isOfficer = ["account", "accounts", "accountofficer"].includes(role);

  const [req, setReq] = useState<Req | null | undefined>(undefined);
  const [dept, setDept] = useState("");
  const [sub, setSub] = useState<Subhead | null>(null);
  const [acc, setAcc] = useState<Account | null>(null);
  const [chain, setChain] = useState<Chain[]>([]);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [counters, setCounters] = useState<string[]>([]);
  const [mySig, setMySig] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("Transfer");
  const [section, setSection] = useState("");
  const [bank, setBank] = useState({ name: "", number: "", bank: "", saved: false });
  const [cashPayee, setCashPayee] = useState("");
  const [cheque, setCheque] = useState({ no: "", date: todayIso(), bank: "" });
  const [counter, setCounter] = useState("");
  const [narration, setNarration] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);

  const loadChecks = useCallback(async (rid: string) => {
    const { data } = await supabase.from("request_attachment_checks").select("attachment_id,checked_by").eq("request_id", rid).eq("checked_by", me.userId);
    setChecked(new Set(((data || []) as Array<{ attachment_id: string }>).map((c) => c.attachment_id)));
  }, [me.userId]);

  const load = useCallback(async () => {
    const r = await supabase.from("requests").select(REQ_COLUMNS).eq("id", id).maybeSingle();
    if (r.error || !r.data) { setReq(null); if (r.error) setMsg({ tone: "red", text: r.error.message }); return; }
    const row = r.data as Req;
    setReq(row);
    setNarration((n) => n || row.title || "");
    const [d, s, c, a, sig, signers, saved, settings] = await Promise.all([
      row.dept_id ? supabase.from("departments").select("name").eq("id", row.dept_id).maybeSingle() : Promise.resolve({ data: null }),
      row.subhead_id ? supabase.from("subheads").select(SUBHEAD_COLUMNS).eq("id", row.subhead_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.rpc("reqgen_request_chain", { p_request_id: id }),
      supabase.from("request_attachments").select("id,file_name,file_path,file_size").eq("request_id", id).order("created_at"),
      supabase.from("profiles").select("signature_url").eq("id", me.userId).maybeSingle(),
      supabase.from("payment_voucher_counter_signatories").select("full_name,signatory_type").eq("is_active", true).order("full_name"),
      supabase.from("reqgen_payee_bank_accounts").select("account_name,account_number,bank_name").eq("payee_key", payeeKey(row.requester_name)).maybeSingle(),
      loadFinanceSettings(),
    ]);
    setDept(String((d.data as { name?: string } | null)?.name || ""));
    const subhead = (s.data as Subhead | null) || null;
    setSub(subhead);
    if (subhead?.bank_account_id) {
      const ac = await supabase.from("iet_accounts").select(ACCOUNT_COLUMNS).eq("id", subhead.bank_account_id).maybeSingle();
      setAcc((ac.data as Account | null) || null);
    }
    setChain(c.error ? [] : ((c.data || []) as Chain[]));
    setFiles((a.data || []) as Attachment[]);
    setMySig((sig.data as { signature_url?: string | null } | null)?.signature_url || null);
    const names = ((signers.data || []) as Array<{ full_name: string; signatory_type: string | null }>).filter((x) => !x.signatory_type || /counter|both/i.test(x.signatory_type)).map((x) => x.full_name);
    setCounters(names);
    if (names.length === 1) setCounter((v) => v || names[0]);
    const sb = saved.data as { account_name: string; account_number: string; bank_name: string } | null;
    setBank((b) => (b.number ? b : sb ? { name: sb.account_name, number: sb.account_number, bank: sb.bank_name, saved: true } : { name: String(row.requester_name || "").toUpperCase(), number: "", bank: "", saved: false }));
    setMode(settings.default_payment_method);
    await loadChecks(id);
  }, [id, me.userId, loadChecks]);
  useEffect(() => { if (me.ready && id) queueMicrotask(() => { void load(); }); }, [me.ready, id, load]);

  const atAccount = !!req && String(req.current_stage || "").toLowerCase() === "account";
  const mine = !!req && isOfficer && atAccount && isAwaitingUser(req, me.userId, me.role);
  const amount = num(req?.amount);
  const allChecked = files.every((f) => checked.has(f.id));
  const dgDone = useMemo(() => chain.filter((c) => c.state === "done").pop(), [chain]);
  const bankOk = bank.name.trim().length > 1 && bank.number.replace(/\D/g, "").length === 10 && bank.bank.trim().length > 1;

  async function checkFile(f: Attachment) {
    const { data } = await supabase.storage.from("request-attachments").createSignedUrl(f.file_path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
    if (checked.has(f.id) || !req) return;
    const { error } = await supabase.from("request_attachment_checks").upsert({
      request_id: req.id, attachment_id: f.id, checked_by: me.userId, checked_by_name: me.name || null, checked_by_role: "Account Officer",
      check_status: "Checked", check_comment: `Checked by ${me.name || "officer"}`, checked_at: new Date().toISOString(),
    }, { onConflict: "attachment_id,checked_by" });
    if (error) { setMsg({ tone: "red", text: "Attachment check failed: " + error.message }); return; }
    await supabase.from("request_history").insert({ request_id: req.id, action_type: "Attachment Checked", comment: `${f.file_name} was checked by ${me.name || "officer"} (Account Officer).`, to_stage: req.current_stage, actor_name: me.name || null, actor_role_key: role, actor_role_name: "Account Officer", action_by: me.userId });
    await loadChecks(req.id);
  }

  async function treat() {
    if (!req) return;
    setMsg(null);
    const why = !mySig ? "Your signature is missing. Add it in My Account › Signature first."
      : !allChecked ? "Open and check every attachment first."
        : !section ? "Choose who you are preparing as."
          : mode === "Transfer" && !bankOk ? "Complete the bank details: account name, 10-digit account number and bank."
            : mode === "Cheque" && (!cheque.no.trim() || !cheque.bank) ? "Type the cheque number and choose the bank."
              : !counter ? "Choose the Counter Signer."
                : narration.trim().length < 3 ? "Write the narration." : null;
    if (why) { setMsg({ tone: "red", text: why }); return; }
    const fresh = await confirmFresh("release the fund and prepare the voucher");
    if (fresh) { if (fresh !== "cancelled") setMsg({ tone: "red", text: fresh }); return; }
    setBusy(true);
    const step = await supabase.rpc("approve_request_step", { p_request_id: req.id, p_actor_id: me.userId, p_comment: `Fund released. ${narration.trim()}`, p_signature_url: mySig });
    if (step.error) { setBusy(false); setMsg({ tone: "red", text: step.error.message }); return; }
    const pv = await supabase.rpc("reqgen_pv_generate", {
      p_request_ids: [req.id], p_mode: mode, p_preparing_as: section, p_counter_signer: counter,
      p_schedule: mode === "Transfer" ? [{ payee_name: String(req.requester_name || "").toUpperCase(), account_name: bank.name.trim().toUpperCase(), account_number: bank.number.replace(/\D/g, ""), bank_name: bank.bank, request_ids: [req.id] }] : [],
      p_cash_payee: mode === "Cash" ? (cashPayee.trim() || String(req.requester_name || "").toUpperCase()) : null,
      p_cheque_no: mode === "Cheque" ? cheque.no.trim() : null, p_cheque_date: mode === "Cheque" ? cheque.date : null, p_cheque_bank: mode === "Cheque" ? cheque.bank : null,
      p_narration: narration.trim(), p_reissue_of: null,
    });
    setBusy(false);
    if (pv.error) {
      setMsg({ tone: "amber", text: `The fund is released for ${req.request_no}, but the voucher was not created: ${pv.error.message} Create it from Payment Vouchers › Generate from Requests.` });
      await load();
      return;
    }
    const res = (typeof pv.data === "string" ? JSON.parse(pv.data) : pv.data) as { voucher_id?: string };
    router.push(res?.voucher_id ? `/payment-vouchers/${res.voucher_id}?made=1` : "/payment-vouchers/centre");
  }

  async function sendBack() {
    if (!req) return;
    const reason = await promptDialog({ title: "Return to the requester?", message: "They see your reason, correct the request and send it again.", label: "Reason", confirmLabel: "Return", tone: "danger" });
    if (!reason) return;
    setBusy(true);
    const { error } = await supabase.rpc("reqgen_return_request", { p_request_id: req.id, p_comment: reason, p_signature_url: mySig });
    setBusy(false);
    if (error) { setMsg({ tone: "red", text: error.message }); return; }
    router.push("/finance/processing");
  }

  if (req === undefined) return <V4Page><Skeleton lines={8} /></V4Page>;
  if (req === null) return <V4Page><Notice tone="red" title="This request cannot be opened.">{msg?.text || "It does not exist, or it is not one you can treat."}</Notice><Link className="v4-btn v4-btn-secondary" href="/finance/processing"><Icon name="left" />Request Processing</Link></V4Page>;

  const reservedForThis = amount;
  const availableAfter = sub ? num(sub.approved_allocation) - num(sub.expenditure) - num(sub.reserved_amount) : 0;

  return (
    <V4Page>
      <section className="v4-card v4-card-pad">
        <div className="v4-rec">
          <div>
            {mine ? <Chip tone="amber">Your step: Account Officer</Chip> : <Chip tone={atAccount ? "amber" : "green"}>{atAccount ? `With ${req.assigned_account_officer_name || "Account"}` : req.status || "—"}</Chip>}
            <h1 className="v4-page-title" style={{ marginTop: 8 }}>{req.request_no} · {req.title}</h1>
            <div className="v4-meta">
              <span>Requester <b>{req.requester_name || "—"}</b></span>
              {dept ? <span>Department <b>{dept}</b></span> : null}
              {dgDone ? <span>Approved by {stageTitle(dgDone.stage)} <b>{shortDate(dgDone.acted_at)}</b></span> : null}
            </div>
          </div>
          <div className="v4-right">
            <div className="v4-label">Amount</div>
            <div className="v4-amount-big">{nairaExact(amount)}</div>
            <span className="v4-help" style={{ fontSize: 12.5 }}>{nairaInWords(amount)}</span>
            <div className="v4-btns"><Link className="v4-btn v4-btn-secondary" href={`/requests/${req.id}`}><Icon name="file" />Full request</Link></div>
          </div>
        </div>
      </section>

      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {!mine ? <Notice tone="blue" title={atAccount ? "This request is with another officer." : "This request is no longer at the Account step."}>{atAccount ? `Only ${req.assigned_account_officer_name || "the Account Officer it was sent to"} treats it.` : "Its voucher, if any, is in Payment Vouchers › Voucher Centre."}</Notice> : null}

      <section className="v4-card v4-card-pad">
        <h2 className="v4-h2" style={{ marginBottom: 12 }}>Budget and account</h2>
        {sub ? (
          <div className="v4-balance-strip">
            <div><span>Subhead</span><b>{subheadLabel(sub)}</b></div>
            <div><span>Approved</span><b>{nairaExact(sub.approved_allocation)}</b></div>
            <div><span>Reserved for this</span><b>{nairaExact(reservedForThis)}</b></div>
            <div><span>Available after</span><b>{nairaExact(availableAfter)}</b></div>
          </div>
        ) : <p className="v4-muted" style={{ margin: 0 }}>{String(req.request_type || "").toLowerCase() === "personal" ? "Personal fund request — no subhead." : "No subhead on this request."}</p>}
        <dl className="v4-kv" style={{ marginTop: 14 }}>
          <dt>Paid from</dt><dd>{acc ? <>{accountName(acc)} <span className="v4-muted">· {accountSub(acc)}</span></> : "—"}</dd>
          <dt>Account officer</dt><dd>{req.assigned_account_officer_name || me.name || "—"}</dd>
          <dt>Account available</dt><dd className="v4-num">{acc ? nairaExact(accountAvailable(acc)) : "—"}</dd>
        </dl>
      </section>

      <div className="v4-split">
        <section className="v4-card v4-card-pad">
          <div className="v4-section-title"><span className="v4-no">1</span><h2 className="v4-h2">Treat and prepare the payment voucher</h2></div>
          <fieldset disabled={!mine || busy} style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="v4-form-grid">
              <div className="v4-field v4-span-2">
                <span className="v4-flabel">How will it be paid? <span className="v4-req">*</span></span>
                <div className="v4-segmented" role="tablist" aria-label="How will it be paid?">
                  {(["Transfer", "Cash", "Cheque"] as Mode[]).map((m) => <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}>{m}</button>)}
                </div>
              </div>
              {mode === "Transfer" ? (
                <>
                  <label className="v4-field"><span className="v4-flabel">Account name <span className="v4-req">*</span></span><input className="v4-input" value={bank.name} onChange={(e) => setBank({ ...bank, name: e.target.value.toUpperCase(), saved: false })} /></label>
                  <label className="v4-field"><span className="v4-flabel">Account number <span className="v4-req">*</span></span><input className="v4-input v4-num" inputMode="numeric" maxLength={10} value={bank.number} onChange={(e) => setBank({ ...bank, number: e.target.value.replace(/\D/g, "").slice(0, 10), saved: false })} />{bank.saved ? <span className="v4-help">Filled from {req.requester_name}’s saved bank details.</span> : null}</label>
                  <div className="v4-field"><span className="v4-flabel">Bank <span className="v4-req">*</span></span><Select ariaLabel="Bank" searchable value={bank.bank} onChange={(v) => setBank({ ...bank, bank: v, saved: false })} placeholder="Choose the bank" options={[...new Set([...(bank.bank ? [bank.bank] : []), ...NIGERIAN_BANKS])].map((b) => ({ value: b, label: b }))} /></div>
                </>
              ) : null}
              {mode === "Cash" ? <label className="v4-field"><span className="v4-flabel">Cash paid to</span><input className="v4-input" value={cashPayee} placeholder={String(req.requester_name || "").toUpperCase()} onChange={(e) => setCashPayee(e.target.value)} /></label> : null}
              {mode === "Cheque" ? (
                <>
                  <label className="v4-field"><span className="v4-flabel">Cheque no. <span className="v4-req">*</span></span><input className="v4-input" value={cheque.no} onChange={(e) => setCheque({ ...cheque, no: e.target.value })} /></label>
                  <label className="v4-field"><span className="v4-flabel">Cheque date</span><input className="v4-input" type="date" value={cheque.date} onChange={(e) => setCheque({ ...cheque, date: e.target.value })} /></label>
                  <div className="v4-field"><span className="v4-flabel">Bank <span className="v4-req">*</span></span><Select ariaLabel="Cheque bank" searchable value={cheque.bank} onChange={(v) => setCheque({ ...cheque, bank: v })} placeholder="Choose the bank" options={NIGERIAN_BANKS.map((b) => ({ value: b, label: b }))} /></div>
                </>
              ) : null}
              <div className="v4-field"><span className="v4-flabel">Preparing as <span className="v4-req">*</span></span><Select ariaLabel="Preparing as" value={section} onChange={setSection} placeholder="Choose the section" options={SECTIONS.map((s) => ({ value: s, label: `Account Officer — ${s}` }))} /></div>
              <div className="v4-field"><span className="v4-flabel">Counter Signer <span className="v4-req">*</span></span><Select ariaLabel="Counter Signer" value={counter} onChange={setCounter} disabled={!counters.length} placeholder={counters.length ? "Choose" : "No Counter Signer yet"} options={counters.map((n) => ({ value: n, label: n }))} /><span className="v4-help">Then the Director General signs and authorises.</span></div>
              <label className="v4-field v4-span-2"><span className="v4-flabel">Narration <span className="v4-req">*</span></span><input className="v4-input" value={narration} maxLength={240} onChange={(e) => setNarration(e.target.value)} /></label>
            </div>
          </fieldset>
          <Notice tone="blue">Treating records that the fund is released from the subhead, and creates the voucher with your signature on Prepared By. The Auditor checks it next, then the Counter Signer, then the Director General. You confirm with your fingerprint or 2FA code.</Notice>
          {mine ? (
            <div className="v4-form-actions">
              <button type="button" className="v4-btn v4-btn-ghost" onClick={() => router.push("/finance/processing")}>Cancel</button>
              <button type="button" className="v4-btn v4-btn-secondary" disabled={busy} onClick={() => void sendBack()}>Return to requester</button>
              <button type="button" className="v4-btn v4-btn-primary" disabled={busy} onClick={() => void treat()}><Icon name="fingerprint" />{busy ? "Working…" : "Treat and create voucher"}</button>
            </div>
          ) : null}
        </section>

        <aside className="v4-side-stack">
          <section className="v4-card v4-card-pad">
            <h3 className="v4-h3" style={{ marginBottom: 10 }}>Approved by</h3>
            {chain.length ? (
              <ol className="v4-numbered">
                {chain.filter((c) => c.stage && !/account|hr ?filing/i.test(c.stage)).map((c) => (
                  <li key={`${c.step_order}-${c.stage}`}>{stageTitle(c.stage)} · <span className="v4-muted">{c.state === "done" ? c.acted_by_name || c.owner_name || "—" : c.state === "skipped" ? "skipped" : "waiting"}</span></li>
                ))}
              </ol>
            ) : <p className="v4-help" style={{ margin: 0 }}>The approval chain appears here.</p>}
          </section>
          <section className="v4-card v4-card-pad">
            <h3 className="v4-h3" style={{ marginBottom: 10 }}>Attachments</h3>
            {files.length ? (
              <ul className="v4-files">
                {files.map((f) => (
                  <li key={f.id}><span className="v4-fi">{/\.pdf$/i.test(f.file_name) ? "PDF" : "IMG"}</span><span className="v4-ft"><strong>{f.file_name}</strong><span>{f.file_size ? `${Math.ceil(f.file_size / 1024)} KB` : ""}{checked.has(f.id) ? " · checked by you" : " · not checked yet"}</span></span><button type="button" className="v4-btn v4-btn-ghost" onClick={() => void checkFile(f)}>{checked.has(f.id) ? "View" : "Open & check"}</button></li>
                ))}
              </ul>
            ) : <p className="v4-help" style={{ margin: 0 }}>No attachment.</p>}
          </section>
        </aside>
      </div>
    </V4Page>
  );
}
