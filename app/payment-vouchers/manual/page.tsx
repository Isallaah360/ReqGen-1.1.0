"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { normalizeRole } from "@/lib/roles";
import { confirmDialog } from "@/lib/dialog";
import { ACCOUNT_COLUMNS, SUBHEAD_COLUMNS, accountAvailable, accountName, accountSub, loadFinanceSettings, subheadLabel, subheadLeft, type Account, type Subhead } from "@/lib/v4/finance";
import { formatAmountInput, nairaExact, nairaInWords, parseAmount } from "@/lib/v4/money";
import { shortDate } from "@/lib/v4/requestText";
import { SECTIONS, type Voucher } from "@/lib/v4/vouchers";
import { useIdentity } from "@/app/components/v4/useIdentity";
import Icon from "@/app/components/v4/Icon";
import { Select } from "@/app/components/v4/Select";
import { Notice, PageHead, Skeleton, V4Page } from "@/app/components/v4/ui";

type Dept = { id: string; name: string };
type Routing = { dept_id: string | null; iet_account_id: string | null; is_active: boolean | null };
type Mode = "Transfer" | "Cash" | "Cheque";
type Draft = Pick<Voucher, "id" | "voucher_no" | "payee_name" | "narration" | "amount" | "total_amount" | "status" | "updated_at" | "created_at">;

const REASONS = ["Utility bill", "Bank charge", "Emergency", "Other"];
const MAX_FILE = 10 * 1024 * 1024;
/** <voucher id>/<time>-<safe file name> in the private voucher-attachments bucket. */
function storagePath(voucherId: string, f: File) { return `${voucherId}/${Date.now()}-${f.name.replace(/[^\w.-]+/g, "_")}`; }
const todayIso = () => new Date().toISOString().slice(0, 10);
const one = <T,>(d: unknown): T | null => ((Array.isArray(d) ? d[0] : d) as T) || null;
const parsed = <T,>(d: unknown): T => (typeof d === "string" ? JSON.parse(d) : d) as T;

export default function ManualVoucherPage() {
  return <Suspense fallback={<V4Page><Skeleton lines={8} /></V4Page>}><Keyed /></Suspense>;
}

/** A fresh form for each voucher opened (?id=…), so nothing carries over. */
function Keyed() {
  const params = useSearchParams();
  return <ManualVoucher key={params.get("id") || "new"} />;
}

/** Payment Vouchers › Manual Voucher (mock-up 49): a payment with no request, same signing order. */
function ManualVoucher() {
  const me = useIdentity();
  const router = useRouter();
  const params = useSearchParams();
  const role = normalizeRole(me.role).replace(/\d+$/, "");
  const mayPrepare = ["account", "accounts", "accountofficer", "admin"].includes(role);
  const fileInput = useRef<HTMLInputElement>(null);

  const [depts, setDepts] = useState<Dept[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [subs, setSubs] = useState<Subhead[]>([]);
  const [routing, setRouting] = useState<Routing[]>([]);
  const [counters, setCounters] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [ready, setReady] = useState(false);

  const [voucherId, setVoucherId] = useState<string | null>(params.get("id"));
  const [voucherNo, setVoucherNo] = useState("");
  const [posted, setPosted] = useState(false);
  const [dept, setDept] = useState("");
  const [account, setAccount] = useState("");
  const [subhead, setSubhead] = useState("");
  const [reason, setReason] = useState("");
  const [section, setSection] = useState("");
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [payDate, setPayDate] = useState(todayIso());
  const [mode, setMode] = useState<Mode>("Transfer");
  const [narration, setNarration] = useState("");
  const [counter, setCounter] = useState("");
  const [reference, setReference] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<"" | "draft" | "send">("");
  const [msg, setMsg] = useState<{ tone: "red" | "green" | "amber" | "blue"; text: string } | null>(null);

  const loadDrafts = useCallback(async () => {
    const { data } = await supabase.from("payment_vouchers").select("id,voucher_no,payee_name,narration,amount,total_amount,status,updated_at,created_at")
      .eq("voucher_type", "Manual").eq("prepared_by", me.userId).in("status", ["Prepared", "Draft"]).order("updated_at", { ascending: false }).limit(10);
    setDrafts((data || []) as Draft[]);
  }, [me.userId]);

  const load = useCallback(async () => {
    const [d, a, s, r, c, settings] = await Promise.all([
      supabase.from("departments").select("id,name").order("name"),
      supabase.from("iet_accounts").select(ACCOUNT_COLUMNS).order("name"),
      supabase.from("subheads").select(SUBHEAD_COLUMNS).eq("is_active", true).order("code"),
      supabase.from("department_account_routing").select("dept_id,iet_account_id,is_active"),
      supabase.from("payment_voucher_counter_signatories").select("full_name,signatory_type").eq("is_active", true).order("full_name"),
      loadFinanceSettings(),
    ]);
    setDepts((d.data || []) as Dept[]);
    setAccounts(((a.data || []) as Account[]).filter((x) => x.is_active !== false));
    setSubs((s.data || []) as Subhead[]);
    setRouting((r.data || []) as Routing[]);
    const names = ((c.data || []) as Array<{ full_name: string; signatory_type: string | null }>).filter((x) => !x.signatory_type || /counter|both/i.test(x.signatory_type)).map((x) => x.full_name);
    setCounters(names);
    if (names.length === 1) setCounter((v) => v || names[0]);
    setMode((m) => (params.get("id") ? m : settings.default_payment_method));
    const id = params.get("id");
    if (id) {
      const v = await supabase.rpc("reqgen_pv_record", { p_voucher_id: id });
      const row = one<Voucher & { account_id?: string | null; department_id?: string | null; payment_reference?: string | null; payment_date?: string | null; payment_method?: string | null; posted_at?: string | null }>(v.data);
      if (row && (row.voucher_type === "Manual" || row.voucher_origin === "Manual")) {
        setVoucherNo(row.voucher_no || "");
        setPosted(!!row.posted_at);
        setAccount(row.account_id || "");
        setSubhead(row.subhead_id || "");
        const sh = ((s.data || []) as Subhead[]).find((x) => x.id === row.subhead_id);
        setDept(row.dept_id || row.department_id || sh?.dept_id || "");
        setPayee(row.payee_name || "");
        setAmount(formatAmountInput(String(row.total_amount || row.amount || "")));
        setPayDate(row.payment_date || todayIso());
        const m = row.disbursement_mode || row.payment_method;
        if (m === "Transfer" || m === "Cash" || m === "Cheque") setMode(m);
        setNarration(row.narration || "");
        setReference(row.payment_reference || "");
        setSection(row.prepared_section || "");
        if (row.counter_signatory_name) setCounter(row.counter_signatory_name);
      } else {
        setMsg({ tone: "red", text: "That manual voucher cannot be opened here." });
        setVoucherId(null);
      }
    }
    setReady(true);
  }, [params]);

  useEffect(() => {
    if (me.ready && mayPrepare) queueMicrotask(() => { void load(); void loadDrafts(); });
  }, [me.ready, mayPrepare, load, loadDrafts]);

  // the department's own IET accounts first, then the rest
  const deptAccounts = useMemo(() => new Set(routing.filter((r) => r.dept_id === dept && r.is_active !== false).map((r) => r.iet_account_id)), [routing, dept]);
  const accountOpts = useMemo(() => [...accounts].sort((a, b) => Number(deptAccounts.has(b.id)) - Number(deptAccounts.has(a.id))).map((a) => ({ value: a.id, label: accountName(a), hint: accountSub(a) || undefined, group: deptAccounts.has(a.id) ? "This department" : "Other IET accounts" })), [accounts, deptAccounts]);
  const subOpts = useMemo(() => subs.filter((s) => (!dept || s.dept_id === dept) && (!account || !s.bank_account_id || s.bank_account_id === account)), [subs, dept, account]);
  const acc = accounts.find((a) => a.id === account) || null;
  const sub = subs.find((s) => s.id === subhead) || null;
  const amt = parseAmount(amount);
  const accFree = acc ? accountAvailable(acc) : 0;
  const subFree = sub ? subheadLeft(sub) : 0;
  const covered = !!acc && !!sub && amt > 0 && accFree >= amt && subFree >= amt;

  function pickDept(id: string) {
    setDept(id); setSubhead("");
    const own = routing.find((r) => r.dept_id === id && r.is_active !== false && r.iet_account_id);
    if (own?.iet_account_id && !posted) setAccount(own.iet_account_id);
  }

  function check(forSend: boolean): string | null {
    if (!dept) return "Choose the department.";
    if (!account) return "Choose the IET account it is paid from.";
    if (!subhead) return "Choose the subhead.";
    if (!reason) return "Choose the reason for a manual voucher.";
    if (!section) return "Choose who you are preparing as.";
    if (payee.trim().length < 2) return "Type the payee.";
    if (!(amt > 0)) return "Type the amount.";
    if (!payDate) return "Choose the payment date.";
    if (narration.trim().length < 3) return "Write the narration.";
    if (forSend && !counter) return "Choose the Counter Signer.";
    if (forSend && !covered) return "The account or the subhead does not cover this amount.";
    return null;
  }

  async function save(): Promise<string | null> {
    const fullNarration = narration.trim().toLowerCase().startsWith(reason.toLowerCase()) ? narration.trim() : `${reason}: ${narration.trim()}`;
    const { data, error } = await supabase.rpc("save_manual_payment_voucher", {
      p_voucher_id: voucherId, p_account_id: account, p_subhead_id: subhead, p_payee_name: payee.trim().toUpperCase(), p_narration: fullNarration,
      p_amount: amt, p_payment_method: mode, p_payment_reference: reference.trim() || null, p_payment_date: payDate,
    });
    if (error) { setMsg({ tone: "red", text: error.message }); return null; }
    const res = one<{ voucher_id?: string; voucher_no?: string }>(parsed(data));
    const id = res?.voucher_id || voucherId;
    if (!id) { setMsg({ tone: "red", text: "The voucher was not saved. Try again." }); return null; }
    setVoucherId(id); setVoucherNo(res?.voucher_no || voucherNo); setNarration(fullNarration);
    const prep = await supabase.rpc("reqgen_pv_manual_prepare", { p_voucher_id: id, p_section: section, p_mode: mode, p_reason: reason });
    if (prep.error) { setMsg({ tone: "red", text: prep.error.message }); return null; }
    for (const f of files) {
      const path = storagePath(id, f);
      const up = await supabase.storage.from("voucher-attachments").upload(path, f, { upsert: false });
      if (up.error) { setMsg({ tone: "amber", text: `${f.name} was not uploaded: ${up.error.message}` }); continue; }
      await supabase.rpc("reqgen_pv_add_attachment", { p_voucher_id: id, p_file_name: f.name, p_file_path: path, p_file_size: f.size });
    }
    setFiles([]);
    return id;
  }

  async function saveDraft() {
    setMsg(null);
    const why = check(false);
    if (why) { setMsg({ tone: "red", text: why }); return; }
    setBusy("draft");
    const id = await save();
    setBusy("");
    if (id) { setMsg({ tone: "green", text: `Draft ${voucherNo || "manual voucher"} saved. Nothing is posted until you sign and send it.` }); await loadDrafts(); }
  }

  async function signAndSend() {
    setMsg(null);
    const why = check(true);
    if (why) { setMsg({ tone: "red", text: why }); return; }
    const ok = await confirmDialog({ title: "Sign and send to the Auditor?", message: `${nairaExact(amt)} to ${payee.trim().toUpperCase()} is written in the ${accountName(acc)} account and ${subheadLabel(sub)} ledgers now, and the voucher goes to the Auditor.`, details: ["Amount, account, subhead and payee are locked after this.", "Signing order: Auditor → Counter Signer → Director General."], confirmLabel: "Sign and send" });
    if (!ok) return;
    setBusy("send");
    const id = posted ? voucherId : await save();
    if (!id) { setBusy(""); return; }
    if (!posted) {
      const post = await supabase.rpc("post_manual_payment_voucher", { p_voucher_id: id });
      if (post.error) { setBusy(""); setMsg({ tone: "red", text: post.error.message }); return; }
    }
    const assign = await supabase.rpc("reqgen_pv_assign_signers", { p_voucher_id: id, p_cheque_signed_by_name: null, p_counter_signatory_name: counter, p_checker_id: null });
    setBusy("");
    if (assign.error) { setMsg({ tone: "amber", text: `Posted and sent to the Auditor, but the Counter Signer was not saved: ${assign.error.message} Choose it on the voucher.` }); router.push(`/payment-vouchers/${id}`); return; }
    router.push(`/payment-vouchers/${id}?made=1`);
  }

  function addFiles(list: FileList | null) {
    const picked = Array.from(list || []);
    const bad = picked.find((f) => f.size > MAX_FILE || !/^(application\/pdf|image\/)/.test(f.type));
    if (bad) { setMsg({ tone: "red", text: `${bad.name}: use a PDF or picture under 10 MB.` }); return; }
    setFiles((f) => [...f, ...picked].slice(0, 5));
  }

  if (me.ready && !mayPrepare) {
    return <V4Page><PageHead title="Manual Voucher" /><Notice tone="amber" title="Only an Account Officer prepares payment vouchers.">Acting as {me.roleName}, you can open and sign vouchers from the Voucher Centre.</Notice></V4Page>;
  }
  if (!ready) return <V4Page><PageHead title="Manual Voucher" /><Skeleton lines={8} /></V4Page>;

  return (
    <V4Page>
      <PageHead title={voucherNo ? `Manual Voucher · ${voucherNo}` : "Manual Voucher"} sub="For a payment with no request (bank charges, utilities, emergencies). It follows the same signing order." />
      {posted ? <Notice tone="amber" title="This voucher is already posted.">Amount, account, subhead and payee are locked. You can correct the narration, mode and reference. To change the money, cancel it and prepare a new one.</Notice> : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <div className="v4-split">
        <section className="v4-card v4-card-pad">
          <div className="v4-section-title"><span className="v4-no">1</span><h2 className="v4-h2">Where it is paid from</h2></div>
          <div className="v4-form-grid">
            <div className="v4-field"><span className="v4-flabel">Department <span className="v4-req">*</span></span><Select ariaLabel="Department" searchable disabled={posted} value={dept} onChange={pickDept} placeholder="Choose the department" options={depts.map((d) => ({ value: d.id, label: d.name }))} /></div>
            <div className="v4-field"><span className="v4-flabel">IET account <span className="v4-req">*</span></span><Select ariaLabel="IET account" disabled={posted} value={account} onChange={(v) => { setAccount(v); setSubhead(""); }} placeholder="Choose the account" options={accountOpts} /></div>
            <div className="v4-field"><span className="v4-flabel">Subhead <span className="v4-req">*</span></span><Select ariaLabel="Subhead" searchable disabled={posted || !dept} value={subhead} onChange={setSubhead} placeholder={dept ? (subOpts.length ? "Choose the subhead" : "No subhead for this account") : "Choose the department first"} options={subOpts.map((s) => ({ value: s.id, label: subheadLabel(s), hint: `left ${nairaExact(subheadLeft(s))}` }))} /></div>
            <div className="v4-field"><span className="v4-flabel">Reason for a manual voucher <span className="v4-req">*</span></span><Select ariaLabel="Reason" value={reason} onChange={setReason} placeholder="Choose the reason" options={REASONS.map((r) => ({ value: r, label: r }))} /></div>
            <div className="v4-field v4-span-2"><span className="v4-flabel">Preparing as <span className="v4-req">*</span></span><Select ariaLabel="Preparing as" value={section} onChange={setSection} placeholder="Choose the section" options={SECTIONS.map((s) => ({ value: s, label: `Account Officer — ${s}` }))} /><span className="v4-help">Printed on the voucher: “Prepared by {me.name || "you"} — Account Officer{section ? `, ${section}` : ""}”.</span></div>
          </div>

          <div className="v4-section-title" style={{ marginTop: 22 }}><span className="v4-no">2</span><h2 className="v4-h2">Payee and payment</h2></div>
          <div className="v4-form-grid">
            <label className="v4-field"><span className="v4-flabel">Payee <span className="v4-req">*</span></span><input className="v4-input" disabled={posted} value={payee} onChange={(e) => setPayee(e.target.value.toUpperCase())} placeholder="NIGER STATE WATER BOARD" /></label>
            <label className="v4-field"><span className="v4-flabel">Amount (₦) <span className="v4-req">*</span></span><input className="v4-input v4-num" inputMode="decimal" disabled={posted} value={amount} onChange={(e) => setAmount(formatAmountInput(e.target.value))} placeholder="0.00" /><span className="v4-help">{amt > 0 ? nairaInWords(amt) : "Amount in words appears here."}</span></label>
            <label className="v4-field"><span className="v4-flabel">Payment date <span className="v4-req">*</span></span><input className="v4-input" type="date" value={payDate} max={todayIso()} onChange={(e) => setPayDate(e.target.value)} /></label>
            <div className="v4-field"><span className="v4-flabel">Mode</span><Select ariaLabel="Mode" value={mode} onChange={(v) => setMode(v as Mode)} options={[{ value: "Cash", label: "Cash" }, { value: "Transfer", label: "Transfer" }, { value: "Cheque", label: "Cheque" }]} /></div>
            <label className="v4-field v4-span-2"><span className="v4-flabel">Narration <span className="v4-req">*</span></span><input className="v4-input" value={narration} maxLength={240} onChange={(e) => setNarration(e.target.value)} placeholder="Water bill, October 2026" /></label>
            <div className="v4-field"><span className="v4-flabel">Counter Signer <span className="v4-req">*</span></span><Select ariaLabel="Counter Signer" value={counter} onChange={setCounter} disabled={!counters.length} placeholder={counters.length ? "Choose" : "No Counter Signer yet"} options={counters.map((n) => ({ value: n, label: n }))} /></div>
            <label className="v4-field"><span className="v4-flabel">Payment reference</span><input className="v4-input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bill or receipt number" /></label>
          </div>

          <div className="v4-section-title" style={{ marginTop: 22 }}><span className="v4-no">3</span><h2 className="v4-h2">Attachment</h2></div>
          <input ref={fileInput} type="file" accept="application/pdf,image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <button type="button" className="v4-dropzone v4-dropzone-btn" onClick={() => fileInput.current?.click()}><Icon name="upload" /><span>Add the bill or receipt · PDF or picture</span></button>
          {files.length ? <ul className="v4-files">{files.map((f, i) => <li key={`${f.name}-${i}`}><span className="v4-fi">{f.type.includes("pdf") ? "PDF" : "IMG"}</span><span className="v4-ft"><strong>{f.name}</strong><span>{Math.ceil(f.size / 1024)} KB · uploads when you save</span></span><button type="button" className="v4-btn v4-btn-ghost" onClick={() => setFiles((all) => all.filter((_, j) => j !== i))}>Remove</button></li>)}</ul> : null}

          <div className="v4-form-actions">
            <button type="button" className="v4-btn v4-btn-ghost" onClick={() => router.push("/payment-vouchers/centre")}>Cancel</button>
            {!posted ? <button type="button" className="v4-btn v4-btn-secondary" disabled={!!busy} onClick={() => void saveDraft()}>{busy === "draft" ? "Saving…" : "Save draft"}</button> : null}
            <button type="button" className="v4-btn v4-btn-primary" disabled={!!busy} onClick={() => void signAndSend()}><Icon name="pen" />{busy === "send" ? "Sending…" : "Sign and send to Auditor"}</button>
          </div>
        </section>

        <aside className="v4-side-stack">
          <section className="v4-card v4-card-pad">
            <h3 className="v4-h3" style={{ marginBottom: 10 }}>Live check</h3>
            <dl className="v4-kv">
              <dt>{acc ? accountName(acc) : "Account"}</dt><dd className="v4-num">{acc ? nairaExact(accFree) : "—"}</dd>
              <dt>{sub ? `${subheadLabel(sub)} left` : "Subhead left"}</dt><dd className="v4-num">{sub ? nairaExact(subFree) : "—"}</dd>
              <dt>After this voucher</dt><dd className="v4-num">{sub && amt > 0 ? nairaExact(subFree - amt) : "—"}</dd>
            </dl>
            {acc && sub && amt > 0 ? (
              <div className={`v4-livecheck ${covered ? "v4-lc-ok" : "v4-lc-no"}`} style={{ marginTop: 12 }}>
                <Icon name={covered ? "check" : "alert"} />
                <span><strong>{covered ? "Can be paid" : "Not enough"}</strong><span>{covered ? `Account and subhead both cover ${nairaExact(amt)}.` : accFree < amt ? `${accountName(acc)} has only ${nairaExact(accFree)} free.` : `${subheadLabel(sub)} has only ${nairaExact(subFree)} left.`}</span></span>
              </div>
            ) : <p className="v4-help" style={{ margin: "10px 0 0" }}>Choose the account, subhead and amount.</p>}
          </section>
          <section className="v4-card v4-card-pad">
            <h3 className="v4-h3" style={{ marginBottom: 10 }}>My drafts</h3>
            {drafts === null ? <Skeleton lines={2} /> : drafts.length ? (
              <ul className="v4-files">
                {drafts.map((d) => (
                  <li key={d.id}><span className="v4-fi v4-x">MPV</span><span className="v4-ft"><strong>{d.voucher_no} · {d.narration || d.payee_name}</strong><span>{nairaExact(d.total_amount || d.amount)} · saved {shortDate(d.updated_at || d.created_at)}</span></span><Link className="v4-btn v4-btn-ghost" href={`/payment-vouchers/manual?id=${d.id}`}>Open</Link></li>
                ))}
              </ul>
            ) : <p className="v4-help" style={{ margin: 0 }}>No draft.</p>}
          </section>
        </aside>
      </div>
    </V4Page>
  );
}
